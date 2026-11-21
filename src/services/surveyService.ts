import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  FIRESTORE_REST_CONFIG,
  OperationType,
  db,
  handleFirestoreError,
  isSdkTransportDegraded,
  markSdkTransportDegraded,
} from '../firebase';
import { CustomMcqQuestion, SiteContentConfig, mergeSiteContent } from '../types/siteConfig';
import { StoredSurveyResponse, SurveyDraft } from '../types/survey';
import {
  FirestoreRestCommitWrite,
  FirestoreRestError,
  buildCommitDeleteWrite,
  buildCommitSetWrite,
  parseFirestoreTimestampMs,
  restCommit,
  restDeleteDoc,
  restGetDoc,
  restRunCollectionQuery,
} from '../utils/firestoreRestClient';
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
  if (error instanceof FirestoreRestError && error.code === 'permission-denied') {
    return true;
  }
  const code = (error as { code?: string } | null)?.code;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'permission-denied' ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions')
  );
}

function isQuotaExceeded(error: unknown): boolean {
  if (error instanceof FirestoreRestError && error.code === 'resource-exhausted') {
    return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return msg.toLowerCase().includes('quota exceeded') || msg.includes('RESOURCE_EXHAUSTED');
}

function isNetworkOrOfflineError(error: unknown): boolean {
  if (error instanceof FirestoreRestError && error.code === 'unavailable') {
    return true;
  }
  const code = (error as { code?: string } | null)?.code;
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return true;
  }
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('melebihi') ||
    msg.includes('timeout') ||
    msg.includes('could not reach') ||
    msg.includes('unavailable') ||
    msg.includes('failed to fetch') ||
    msg.includes('network')
  );
}

function toUserFriendlyFirestoreError(error: unknown, fallback: string): Error {
  if (isQuotaExceeded(error)) {
    return new Error(
      'Kuota harian gratis Firebase Firestore telah tercapai. Kuota akan otomatis reset besok.'
    );
  }
  if (isNetworkOrOfflineError(error)) {
    return new Error(
      'Koneksi ke Firebase Firestore sedang lambat atau terputus. Periksa internet Anda lalu coba kembali.'
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
  return parseFirestoreTimestampMs(val);
}

async function assertValidAdminToken(token: string): Promise<void> {
  const ok = await verifyClientAdminToken(token, ADMIN_PIN_OVERRIDE);
  if (!ok) {
    throw new Error('Sesi admin tidak valid atau telah berakhir. Silakan login kembali.');
  }
}

/**
 * Submits a completed survey response directly to Firebase Firestore in <= 4.5s
 * with zero backend/Google Cloud dependency, falling back seamlessly to stateless
 * Firestore REST v1 if WebChannel is blocked or slow.
 */
export async function submitSurveyResponse(
  draft: SurveyDraft,
  customQuestions: CustomMcqQuestion[] = []
): Promise<string> {
  const payload = stripUndefinedDeep(buildFirestorePayload(draft, customQuestions));
  const vaultId = await getVaultId();
  const docId = generateSurveyResponseId();
  const vaultPath = `owner_vault/${vaultId}/responses/${docId}`;
  const mirrorPath = `${COLLECTION_RESPONSES}/${docId}`;
  const vaultRef = doc(db, 'owner_vault', vaultId, 'responses', docId);
  const mirrorRef = doc(db, COLLECTION_RESPONSES, docId);

  const firestoreDoc = {
    ...payload,
    createdAt: serverTimestamp(),
  };

  let usedRestFallback = isSdkTransportDegraded();

  if (!usedRestFallback) {
    try {
      await withTimeout(
        setDoc(vaultRef, firestoreDoc),
        2200,
        'Waktu pengiriman WebChannel melebihi batas.'
      );
    } catch (err) {
      if (isPermissionDenied(err)) {
        handleFirestoreError(err, OperationType.CREATE, vaultPath);
      }
      if (isQuotaExceeded(err)) {
        throw toUserFriendlyFirestoreError(err, 'Gagal mengirim jawaban survei ke Firebase Firestore.');
      }
      if (!isNetworkOrOfflineError(err)) {
        throw toUserFriendlyFirestoreError(err, 'Gagal mengirim jawaban survei ke Firebase Firestore.');
      }
      markSdkTransportDegraded();
      usedRestFallback = true;
    }
  }

  if (usedRestFallback) {
    try {
      const write = buildCommitSetWrite(FIRESTORE_REST_CONFIG, {
        docPath: vaultPath,
        fields: payload as Record<string, unknown>,
        serverTimestampFields: ['createdAt'],
        exists: false,
      });
      await restCommit(FIRESTORE_REST_CONFIG, [write], 2200);
    } catch (restErr) {
      if (isPermissionDenied(restErr)) {
        handleFirestoreError(restErr, OperationType.CREATE, vaultPath);
      }
      throw toUserFriendlyFirestoreError(restErr, 'Gagal mengirim jawaban survei ke Firebase Firestore.');
    }
  }

  // Secondary collection mirror runs non-blockingly so UI remains <= 4.5s
  if (usedRestFallback) {
    const mirrorWrite = buildCommitSetWrite(FIRESTORE_REST_CONFIG, {
      docPath: mirrorPath,
      fields: payload as Record<string, unknown>,
      serverTimestampFields: ['createdAt'],
      exists: false,
    });
    void restCommit(FIRESTORE_REST_CONFIG, [mirrorWrite], 2500).catch(() => {
      // Primary durable record is already saved in owner_vault
    });
  } else {
    void withTimeout(setDoc(mirrorRef, firestoreDoc), 2500, 'Mirror timeout').catch(() => {
      // Primary durable record is already saved in owner_vault
    });
  }

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

  if (!isSdkTransportDegraded()) {
    try {
      const snap = await withTimeout(
        getDocsFromServer(responsesQuery),
        3200,
        'Waktu muat data WebChannel melebihi batas.'
      );

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
      if (!isNetworkOrOfflineError(err)) {
        throw toUserFriendlyFirestoreError(err, 'Gagal memuat daftar respons survei dari Firebase.');
      }
      markSdkTransportDegraded();
    }
  }

  try {
    const rows = await restRunCollectionQuery(
      FIRESTORE_REST_CONFIG,
      {
        parentDocPath: `owner_vault/${vaultId}`,
        collectionId: 'responses',
        whereField: 'source',
        whereOp: 'EQUAL',
        whereValue: 'web_survey',
        limit: 500,
      },
      4500
    );

    const items: StoredSurveyResponse[] = rows.map((row) => ({
      ...(row.data as Omit<StoredSurveyResponse, 'id' | 'createdAtMs'>),
      id: row.id,
      createdAtMs: parseFirestoreTimestampMs(row.data.createdAt ?? row.createTime),
    }));

    items.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return items;
  } catch (restErr) {
    if (isPermissionDenied(restErr)) {
      handleFirestoreError(restErr, OperationType.LIST, collPath);
    }
    throw toUserFriendlyFirestoreError(restErr, 'Gagal memuat daftar respons survei dari Firebase.');
  }
}

export async function deleteSurveyResponse(responseId: string, token: string): Promise<void> {
  await assertValidAdminToken(token);
  const vaultId = await getVaultId();
  const docPath = `owner_vault/${vaultId}/responses/${responseId}`;

  if (!isSdkTransportDegraded()) {
    try {
      await withTimeout(
        deleteDoc(doc(db, 'owner_vault', vaultId, 'responses', responseId)),
        2500,
        'Waktu penghapusan WebChannel melebihi batas.'
      );
      return;
    } catch (err) {
      if (isPermissionDenied(err)) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
      if (!isNetworkOrOfflineError(err)) {
        throw toUserFriendlyFirestoreError(err, 'Gagal menghapus respons survei dari Firebase.');
      }
      markSdkTransportDegraded();
    }
  }

  try {
    await restDeleteDoc(FIRESTORE_REST_CONFIG, docPath, 3500);
  } catch (restErr) {
    if (isPermissionDenied(restErr)) {
      handleFirestoreError(restErr, OperationType.DELETE, docPath);
    }
    throw toUserFriendlyFirestoreError(restErr, 'Gagal menghapus respons survei dari Firebase.');
  }
}

async function safeGetSiteConfigDoc(
  vaultId: string,
  configId: 'main' | 'hero_image' | 'composition_image' | 'google_form'
): Promise<Record<string, unknown> | null> {
  const docPath = `owner_vault/${vaultId}/site_config/${configId}`;
  const docRef = doc(db, 'owner_vault', vaultId, 'site_config', configId);

  if (!isSdkTransportDegraded()) {
    try {
      const snap = await withTimeout(
        getDocFromServer(docRef),
        2500,
        'Waktu muat konfigurasi WebChannel melebihi batas.'
      );
      return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
    } catch (err) {
      if (isPermissionDenied(err)) {
        handleFirestoreError(err, OperationType.GET, docPath);
      }
      if (!isNetworkOrOfflineError(err)) {
        return null;
      }
      markSdkTransportDegraded();
    }
  }

  try {
    return await restGetDoc(FIRESTORE_REST_CONFIG, docPath, 2800);
  } catch (restErr) {
    if (isPermissionDenied(restErr)) {
      handleFirestoreError(restErr, OperationType.GET, docPath);
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

  const mainPath = `owner_vault/${vaultId}/site_config/main`;
  const heroPath = `owner_vault/${vaultId}/site_config/hero_image`;
  const compPath = `owner_vault/${vaultId}/site_config/composition_image`;

  const mainRef = doc(db, 'owner_vault', vaultId, 'site_config', 'main');
  const heroRef = doc(db, 'owner_vault', vaultId, 'site_config', 'hero_image');
  const compRef = doc(db, 'owner_vault', vaultId, 'site_config', 'composition_image');

  if (!isSdkTransportDegraded()) {
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
        const heroSnap = await withTimeout(getDoc(heroRef), 1500, 'Timeout').catch(() => null);
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
        const compSnap = await withTimeout(getDoc(compRef), 1500, 'Timeout').catch(() => null);
        if (compSnap?.exists()) {
          batch.delete(compRef);
        }
      }

      await withTimeout(
        batch.commit(),
        4000,
        'Waktu penyimpanan konten WebChannel melebihi batas.'
      );
      return mergeSiteContent(siteConfig);
    } catch (err) {
      if (isPermissionDenied(err)) {
        handleFirestoreError(err, OperationType.WRITE, mainPath);
      }
      if (!isNetworkOrOfflineError(err)) {
        throw toUserFriendlyFirestoreError(err, 'Gagal menyimpan perubahan konten ke Firebase Firestore.');
      }
      markSdkTransportDegraded();
    }
  }

  try {
    const writes: FirestoreRestCommitWrite[] = [
      buildCommitSetWrite(FIRESTORE_REST_CONFIG, {
        docPath: mainPath,
        fields: {
          schemaVersion: 1,
          content: split.mainContent,
        },
        serverTimestampFields: ['updatedAt'],
      }),
      split.heroImageDoc
        ? buildCommitSetWrite(FIRESTORE_REST_CONFIG, {
            docPath: heroPath,
            fields: { ...split.heroImageDoc },
            serverTimestampFields: ['updatedAt'],
          })
        : buildCommitDeleteWrite(FIRESTORE_REST_CONFIG, heroPath),
      split.compositionImageDoc
        ? buildCommitSetWrite(FIRESTORE_REST_CONFIG, {
            docPath: compPath,
            fields: { ...split.compositionImageDoc },
            serverTimestampFields: ['updatedAt'],
          })
        : buildCommitDeleteWrite(FIRESTORE_REST_CONFIG, compPath),
    ];

    await restCommit(FIRESTORE_REST_CONFIG, writes, 5000);
    return mergeSiteContent(siteConfig);
  } catch (restErr) {
    if (isPermissionDenied(restErr)) {
      handleFirestoreError(restErr, OperationType.WRITE, mainPath);
    }
    throw toUserFriendlyFirestoreError(restErr, 'Gagal menyimpan perubahan konten ke Firebase Firestore.');
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
  const mainPath = `owner_vault/${vaultId}/site_config/main`;

  if (!isSdkTransportDegraded()) {
    try {
      const refs = ids.map((id) => doc(db, 'owner_vault', vaultId, 'site_config', id));
      const snaps = await Promise.all(
        refs.map((ref) => withTimeout(getDoc(ref), 1500, 'Timeout').catch(() => null))
      );
      const batch = writeBatch(db);
      let hasDeletes = false;
      snaps.forEach((snap, idx) => {
        if (snap?.exists()) {
          batch.delete(refs[idx]);
          hasDeletes = true;
        }
      });
      if (hasDeletes) {
        await withTimeout(batch.commit(), 3500, 'Waktu reset konten melebihi batas.');
      }
      return;
    } catch (err) {
      if (isPermissionDenied(err)) {
        handleFirestoreError(err, OperationType.DELETE, mainPath);
      }
      if (!isNetworkOrOfflineError(err)) {
        throw toUserFriendlyFirestoreError(err, 'Gagal mengatur ulang konten ke bawaan.');
      }
      markSdkTransportDegraded();
    }
  }

  try {
    const writes = ids.map((id) =>
      buildCommitDeleteWrite(FIRESTORE_REST_CONFIG, `owner_vault/${vaultId}/site_config/${id}`)
    );
    await restCommit(FIRESTORE_REST_CONFIG, writes, 4000);
  } catch (restErr) {
    if (isPermissionDenied(restErr)) {
      handleFirestoreError(restErr, OperationType.DELETE, mainPath);
    }
    throw toUserFriendlyFirestoreError(restErr, 'Gagal mengatur ulang konten ke bawaan.');
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

  const fieldsPayload = {
    schemaVersion: 1,
    formId: String(config.formId || 'manual-form').trim().slice(0, 128),
    formTitle: String(config.formTitle || 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan')
      .trim()
      .slice(0, 200),
    responderUri: String(config.responderUri || '').trim().slice(0, 400),
  };

  if (!isSdkTransportDegraded()) {
    try {
      await withTimeout(
        setDoc(docRef, {
          ...fieldsPayload,
          updatedAt: serverTimestamp(),
        }),
        3000,
        'Waktu penyimpanan tautan Google Form WebChannel melebihi batas.'
      );
      return {
        formId: fieldsPayload.formId,
        formTitle: fieldsPayload.formTitle,
        responderUri: fieldsPayload.responderUri,
        updatedAtMs: Date.now(),
      };
    } catch (err) {
      if (isPermissionDenied(err)) {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }
      if (!isNetworkOrOfflineError(err)) {
        throw toUserFriendlyFirestoreError(err, 'Gagal menyimpan tautan Google Form ke Firebase.');
      }
      markSdkTransportDegraded();
    }
  }

  try {
    const write = buildCommitSetWrite(FIRESTORE_REST_CONFIG, {
      docPath,
      fields: fieldsPayload,
      serverTimestampFields: ['updatedAt'],
    });
    await restCommit(FIRESTORE_REST_CONFIG, [write], 3500);
    return {
      formId: fieldsPayload.formId,
      formTitle: fieldsPayload.formTitle,
      responderUri: fieldsPayload.responderUri,
      updatedAtMs: Date.now(),
    };
  } catch (restErr) {
    if (isPermissionDenied(restErr)) {
      handleFirestoreError(restErr, OperationType.WRITE, docPath);
    }
    throw toUserFriendlyFirestoreError(restErr, 'Gagal menyimpan tautan Google Form ke Firebase.');
  }
}
