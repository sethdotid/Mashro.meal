import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType, db, handleFirestoreError } from '../firebase';
import { CustomMcqQuestion, SiteContentConfig, mergeSiteContent } from '../types/siteConfig';
import { StoredSurveyResponse, SurveyDraft } from '../types/survey';
import { buildFirestorePayload } from '../utils/surveyLogic';
import {
  deriveMashroVaultId,
  generateSurveyResponseId,
  hydrateSiteConfigFromFirestoreDocs,
  splitSiteConfigForFirestore,
  stripUndefinedDeep,
  verifyClientAdminToken,
  verifyPinAndIssueToken,
} from '../utils/vaultCrypto';

const COLLECTION_RESPONSES = 'survey_responses';

const ADMIN_PIN_OVERRIDE = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env?.VITE_ADMIN_PIN;

export interface OwnerGoogleFormConfig {
  formId: string;
  formTitle: string;
  responderUri: string;
  updatedAtMs?: number;
}

let vaultIdPromise: Promise<string> | null = null;

function getVaultId(): Promise<string> {
  if (!vaultIdPromise) {
    vaultIdPromise = deriveMashroVaultId(
      firebaseConfig.projectId,
      firebaseConfig.firestoreDatabaseId
    );
  }
  return vaultIdPromise;
}

function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'permission-denied' ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions')
  );
}

function isQuotaExceeded(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.toLowerCase().includes('quota exceeded');
}

function toUserFriendlyFirestoreError(error: unknown, fallback: string): Error {
  if (isQuotaExceeded(error)) {
    return new Error(
      'Kuota harian gratis Firebase Firestore telah tercapai. Kuota akan otomatis reset besok.'
    );
  }
  return error instanceof Error ? error : new Error(fallback);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function extractTimestampMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    val &&
    typeof val === 'object' &&
    'toMillis' in val &&
    typeof (val as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (val instanceof Date) {
    return val.getTime();
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  return Date.now();
}

async function assertValidAdminToken(token: string): Promise<void> {
  const ok = await verifyClientAdminToken(token, ADMIN_PIN_OVERRIDE);
  if (!ok) {
    throw new Error('Sesi admin tidak valid atau telah berakhir. Silakan login kembali.');
  }
}

/**
 * Submits a completed survey response directly to Firebase Firestore in <= 4.5s
 * with zero backend/Google Cloud dependency.
 */
export async function submitSurveyResponse(
  draft: SurveyDraft,
  customQuestions: CustomMcqQuestion[] = []
): Promise<string> {
  const payload = stripUndefinedDeep(buildFirestorePayload(draft, customQuestions));
  const vaultId = await getVaultId();
  const docId = generateSurveyResponseId();
  const vaultPath = `owner_vault/${vaultId}/responses/${docId}`;
  const vaultRef = doc(db, 'owner_vault', vaultId, 'responses', docId);
  const mirrorRef = doc(db, COLLECTION_RESPONSES, docId);

  const firestoreDoc = {
    ...payload,
    createdAt: serverTimestamp(),
  };

  try {
    await withTimeout(
      setDoc(vaultRef, firestoreDoc),
      4200,
      'Waktu pengiriman melebihi 4,5 detik. Periksa koneksi internet Anda lalu coba kirim ulang.'
    );
  } catch (err) {
    if (isPermissionDenied(err)) {
      handleFirestoreError(err, OperationType.CREATE, vaultPath);
    }
    throw toUserFriendlyFirestoreError(err, 'Gagal mengirim jawaban survei ke Firebase Firestore.');
  }

  // Secondary collection mirror runs non-blockingly (capped at 500ms) so UI remains <= 4.5s
  void withTimeout(
    setDoc(mirrorRef, firestoreDoc),
    3000,
    'Mirror timeout'
  ).catch(() => {
    // Primary durable record is already saved in owner_vault
  });

  return docId;
}

export async function adminLoginWithPin(pin: string): Promise<{ token: string; expiresAt: number }> {
  return verifyPinAndIssueToken(pin, ADMIN_PIN_OVERRIDE);
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  return verifyClientAdminToken(token, ADMIN_PIN_OVERRIDE);
}

export async function fetchSurveyResponses(token: string): Promise<StoredSurveyResponse[]> {
  await assertValidAdminToken(token);
  const vaultId = await getVaultId();
  const collPath = `owner_vault/${vaultId}/responses`;
  const responsesQuery = query(
    collection(db, 'owner_vault', vaultId, 'responses'),
    where('source', '==', 'web_survey'),
    limit(500)
  );

  try {
    let snap;
    try {
      snap = await withTimeout(
        getDocsFromServer(responsesQuery),
        6000,
        'Waktu muat data Firebase melebihi batas. Coba muat ulang.'
      );
    } catch (serverErr) {
      if (isPermissionDenied(serverErr)) throw serverErr;
      snap = await getDocs(responsesQuery);
    }

    const items: StoredSurveyResponse[] = snap.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        ...(data as Omit<StoredSurveyResponse, 'id' | 'createdAtMs'>),
        id: docSnap.id,
        createdAtMs: extractTimestampMs(data.createdAt),
      };
    });

    items.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return items;
  } catch (err) {
    if (isPermissionDenied(err)) {
      handleFirestoreError(err, OperationType.LIST, collPath);
    }
    throw toUserFriendlyFirestoreError(err, 'Gagal memuat daftar respons survei dari Firebase.');
  }
}

export async function deleteSurveyResponse(responseId: string, token: string): Promise<void> {
  await assertValidAdminToken(token);
  const vaultId = await getVaultId();
  const docPath = `owner_vault/${vaultId}/responses/${responseId}`;

  try {
    await withTimeout(
      deleteDoc(doc(db, 'owner_vault', vaultId, 'responses', responseId)),
      4500,
      'Waktu penghapusan respons melebihi batas.'
    );
  } catch (err) {
    if (isPermissionDenied(err)) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
    throw toUserFriendlyFirestoreError(err, 'Gagal menghapus respons survei dari Firebase.');
  }
}

async function safeGetSiteConfigDoc(
  vaultId: string,
  configId: 'main' | 'hero_image' | 'composition_image' | 'google_form'
): Promise<Record<string, unknown> | null> {
  const docPath = `owner_vault/${vaultId}/site_config/${configId}`;
  const docRef = doc(db, 'owner_vault', vaultId, 'site_config', configId);
  try {
    let snap;
    try {
      snap = await withTimeout(getDocFromServer(docRef), 4500, 'Timeout');
    } catch (serverErr) {
      if (isPermissionDenied(serverErr)) throw serverErr;
      snap = await getDoc(docRef);
    }
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch (err) {
    if (isPermissionDenied(err)) {
      handleFirestoreError(err, OperationType.GET, docPath);
    }
    return null;
  }
}

export async function fetchSiteConfig(): Promise<Partial<SiteContentConfig> | null> {
  try {
    const vaultId = await getVaultId();
    const [mainData, heroData, compData] = await Promise.all([
      safeGetSiteConfigDoc(vaultId, 'main'),
      safeGetSiteConfigDoc(vaultId, 'hero_image'),
      safeGetSiteConfigDoc(vaultId, 'composition_image'),
    ]);
    return hydrateSiteConfigFromFirestoreDocs(mainData, heroData, compData);
  } catch {
    return null;
  }
}

export async function saveSiteConfig(
  siteConfig: SiteContentConfig,
  token: string
): Promise<SiteContentConfig> {
  await assertValidAdminToken(token);
  const vaultId = await getVaultId();
  const split = splitSiteConfigForFirestore(siteConfig);

  const mainRef = doc(db, 'owner_vault', vaultId, 'site_config', 'main');
  const heroRef = doc(db, 'owner_vault', vaultId, 'site_config', 'hero_image');
  const compRef = doc(db, 'owner_vault', vaultId, 'site_config', 'composition_image');

  try {
    const batch = writeBatch(db);
    batch.set(mainRef, {
      schemaVersion: 1,
      content: split.mainContent,
      updatedAt: serverTimestamp(),
    });

    if (split.heroImageDoc) {
      batch.set(heroRef, {
        ...split.heroImageDoc,
        updatedAt: serverTimestamp(),
      });
    } else {
      const heroSnap = await getDoc(heroRef).catch(() => null);
      if (heroSnap?.exists()) {
        batch.delete(heroRef);
      }
    }

    if (split.compositionImageDoc) {
      batch.set(compRef, {
        ...split.compositionImageDoc,
        updatedAt: serverTimestamp(),
      });
    } else {
      const compSnap = await getDoc(compRef).catch(() => null);
      if (compSnap?.exists()) {
        batch.delete(compRef);
      }
    }

    await withTimeout(
      batch.commit(),
      8000,
      'Waktu penyimpanan konten ke Firebase melebihi batas (8 detik). Silakan coba simpan kembali.'
    );
    return mergeSiteContent(siteConfig);
  } catch (err) {
    if (isPermissionDenied(err)) {
      handleFirestoreError(err, OperationType.WRITE, `owner_vault/${vaultId}/site_config/main`);
    }
    throw toUserFriendlyFirestoreError(err, 'Gagal menyimpan perubahan konten ke Firebase Firestore.');
  }
}

export async function resetSiteConfig(token: string): Promise<void> {
  await assertValidAdminToken(token);
  const vaultId = await getVaultId();
  const ids: ('main' | 'hero_image' | 'composition_image')[] = [
    'main',
    'hero_image',
    'composition_image',
  ];

  try {
    const refs = ids.map((id) => doc(db, 'owner_vault', vaultId, 'site_config', id));
    const snaps = await Promise.all(refs.map((ref) => getDoc(ref).catch(() => null)));
    const batch = writeBatch(db);
    let hasDeletes = false;
    snaps.forEach((snap, idx) => {
      if (snap?.exists()) {
        batch.delete(refs[idx]);
        hasDeletes = true;
      }
    });
    if (hasDeletes) {
      await withTimeout(batch.commit(), 5000, 'Waktu reset konten melebihi batas.');
    }
  } catch (err) {
    if (isPermissionDenied(err)) {
      handleFirestoreError(err, OperationType.DELETE, `owner_vault/${vaultId}/site_config/main`);
    }
    throw toUserFriendlyFirestoreError(err, 'Gagal mengatur ulang konten ke bawaan.');
  }
}

export async function loadOwnerGoogleFormConfig(
  token: string
): Promise<OwnerGoogleFormConfig | null> {
  await assertValidAdminToken(token);
  const vaultId = await getVaultId();
  const data = await safeGetSiteConfigDoc(vaultId, 'google_form');
  if (!data || typeof data.responderUri !== 'string') return null;

  return {
    formId: typeof data.formId === 'string' ? data.formId : 'manual-form',
    formTitle:
      typeof data.formTitle === 'string'
        ? data.formTitle
        : 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan',
    responderUri: data.responderUri,
    updatedAtMs: data.updatedAt ? extractTimestampMs(data.updatedAt) : undefined,
  };
}

export async function saveOwnerGoogleFormConfig(
  config: OwnerGoogleFormConfig,
  token: string
): Promise<OwnerGoogleFormConfig> {
  await assertValidAdminToken(token);
  const vaultId = await getVaultId();
  const docPath = `owner_vault/${vaultId}/site_config/google_form`;
  const docRef = doc(db, 'owner_vault', vaultId, 'site_config', 'google_form');

  const payload = {
    schemaVersion: 1,
    formId: String(config.formId || 'manual-form').trim().slice(0, 128),
    formTitle: String(config.formTitle || 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan')
      .trim()
      .slice(0, 200),
    responderUri: String(config.responderUri || '').trim().slice(0, 400),
    updatedAt: serverTimestamp(),
  };

  try {
    await withTimeout(setDoc(docRef, payload), 4500, 'Waktu penyimpanan tautan Google Form melebihi batas.');
    return {
      formId: payload.formId,
      formTitle: payload.formTitle,
      responderUri: payload.responderUri,
      updatedAtMs: Date.now(),
    };
  } catch (err) {
    if (isPermissionDenied(err)) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
    throw toUserFriendlyFirestoreError(err, 'Gagal menyimpan tautan Google Form ke Firebase.');
  }
}
