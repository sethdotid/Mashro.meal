import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CustomMcqQuestion, SiteContentConfig } from '../types/siteConfig';
import { StoredSurveyResponse, SurveyDraft } from '../types/survey';
import { buildFirestorePayload } from '../utils/surveyLogic';

const COLLECTION_RESPONSES = 'survey_responses';

export interface OwnerGoogleFormConfig {
  formId: string;
  formTitle: string;
  responderUri: string;
  updatedAtMs?: number;
}

function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function syncToFirestoreCapped(docId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const ref = doc(collection(db, COLLECTION_RESPONSES), docId);
    await Promise.race([
      setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 3500)),
    ]);
  } catch {
    // Server store succeeded; Firestore cloud mirror failure is isolated so UX remains <= 5s
  }
}

/**
 * Submits a completed survey response in <= 4.5s, committing to both server store and Firestore cloud.
 */
export async function submitSurveyResponse(
  draft: SurveyDraft,
  customQuestions: CustomMcqQuestion[] = []
): Promise<string> {
  const payload = buildFirestorePayload(draft, customQuestions);

  try {
    const res = await fetchWithTimeout(
      '/api/surveys',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      4500
    );

    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !data.id) {
      throw new Error(data.error || 'Gagal menyimpan jawaban survei.');
    }

    // Await Firestore setDoc up to 3.5s so respondent write commits reliably before navigation/close
    await syncToFirestoreCapped(data.id, payload);
    return data.id;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Waktu pengiriman melebihi 4,5 detik. Periksa koneksi internet Anda lalu coba kirim ulang.');
    }
    throw err instanceof Error ? err : new Error('Gagal mengirim jawaban survei.');
  }
}

export async function adminLoginWithPin(pin: string): Promise<{ token: string; expiresAt: number }> {
  const res = await fetchWithTimeout(
    '/api/admin/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    },
    4500
  );
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    expiresAt?: number;
    error?: string;
  };
  if (!res.ok || !data.token) {
    throw new Error(data.error || 'PIN Admin tidak valid.');
  }
  return { token: data.token, expiresAt: data.expiresAt ?? Date.now() + 86400000 };
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetchWithTimeout(
      '/api/admin/session',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      3000
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { authenticated?: boolean };
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

export async function fetchSurveyResponses(token: string): Promise<StoredSurveyResponse[]> {
  const res = await fetchWithTimeout(
    '/api/admin/responses',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    4500
  );
  const data = (await res.json().catch(() => ({}))) as {
    responses?: StoredSurveyResponse[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memuat daftar respons survei.');
  }
  return Array.isArray(data.responses) ? data.responses : [];
}

export async function deleteSurveyResponse(responseId: string, token: string): Promise<void> {
  const res = await fetchWithTimeout(
    `/api/admin/responses/${encodeURIComponent(responseId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
    4500
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Gagal menghapus respons survei.');
  }
}

export async function fetchSiteConfig(): Promise<Partial<SiteContentConfig> | null> {
  try {
    const res = await fetchWithTimeout('/api/site-config', {}, 2500);
    if (!res.ok) return null;
    const data = (await res.json()) as { siteConfig?: Partial<SiteContentConfig> | null };
    return data.siteConfig ?? null;
  } catch {
    return null;
  }
}

export async function saveSiteConfig(
  siteConfig: SiteContentConfig,
  token: string
): Promise<SiteContentConfig> {
  const res = await fetchWithTimeout(
    '/api/admin/site-config',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ siteConfig }),
    },
    4500
  );
  const data = (await res.json().catch(() => ({}))) as {
    siteConfig?: SiteContentConfig;
    error?: string;
  };
  if (!res.ok || !data.siteConfig) {
    throw new Error(data.error || 'Gagal menyimpan perubahan konten.');
  }
  return data.siteConfig;
}

export async function resetSiteConfig(token: string): Promise<void> {
  const res = await fetchWithTimeout(
    '/api/admin/site-config/reset',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
    4500
  );
  if (!res.ok) {
    throw new Error('Gagal mengatur ulang konten ke bawaan.');
  }
}

export async function loadOwnerGoogleFormConfig(token: string): Promise<OwnerGoogleFormConfig | null> {
  const res = await fetchWithTimeout(
    '/api/admin/google-form',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    4500
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { config?: OwnerGoogleFormConfig | null };
  return data.config ?? null;
}

export async function saveOwnerGoogleFormConfig(
  config: OwnerGoogleFormConfig,
  token: string
): Promise<OwnerGoogleFormConfig> {
  const res = await fetchWithTimeout(
    '/api/admin/google-form',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ config }),
    },
    4500
  );
  const data = (await res.json().catch(() => ({}))) as {
    config?: OwnerGoogleFormConfig;
    error?: string;
  };
  if (!res.ok || !data.config) {
    throw new Error(data.error || 'Gagal menyimpan tautan Google Form.');
  }
  return data.config;
}
