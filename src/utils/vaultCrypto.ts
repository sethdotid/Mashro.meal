import { SiteContentConfig } from '../types/siteConfig';

const DEFAULT_PIN_SHA256_HEX = 'a7fbf5294777f117b6f04ea588a591007751f0c89d49d934c7d2db5e8f0f44dd';
const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 hari (> 10 hari)

const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API tidak tersedia pada lingkungan browser ini.');
  }
  return subtle;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest('SHA-256', textEncoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const key = await subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await subtle.sign('HMAC', key, textEncoder.encode(message));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Derives the exact deterministic 48-char Firestore Owner Vault ID
 * matching `HMAC-SHA256(key = "${projectId}:${firestoreDatabaseId}:mashro-firestore-vault-v1", msg = "mashro-firestore-vault-v1")`.
 */
export async function deriveMashroVaultId(
  projectId: string,
  firestoreDatabaseId: string
): Promise<string> {
  const seed = `${projectId}:${firestoreDatabaseId}:mashro-firestore-vault-v1`;
  const hex = await hmacSha256Hex(seed, 'mashro-firestore-vault-v1');
  return hex.slice(0, 48);
}

async function resolveExpectedPinHash(overridePin?: string): Promise<string> {
  const cleanedOverride = typeof overridePin === 'string' ? overridePin.trim() : '';
  if (cleanedOverride.length > 0) {
    return sha256Hex(`${cleanedOverride}:mashro-pin-v1`);
  }
  return DEFAULT_PIN_SHA256_HEX;
}

export async function verifyPinAndIssueToken(
  pin: string,
  overridePin?: string,
  nowMs = Date.now()
): Promise<{ token: string; expiresAt: number }> {
  const trimmedPin = pin.trim();
  if (!trimmedPin) {
    throw new Error('PIN Admin tidak valid.');
  }

  const [providedHash, expectedHash] = await Promise.all([
    sha256Hex(`${trimmedPin}:mashro-pin-v1`),
    resolveExpectedPinHash(overridePin),
  ]);

  if (!constantTimeEqual(providedHash, expectedHash)) {
    throw new Error('PIN Admin tidak valid.');
  }

  const expiresAt = nowMs + ADMIN_TOKEN_TTL_MS;
  const nonceBytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(nonceBytes);
  const nonce = bytesToHex(nonceBytes);

  const signingKey = await sha256Hex(`${expectedHash}:mashro-owner-portal-v1`);
  const payload = `${expiresAt}.${nonce}`;
  const sig = await hmacSha256Hex(signingKey, payload);
  return {
    token: `${payload}.${sig}`,
    expiresAt,
  };
}

export async function verifyClientAdminToken(
  token: string,
  overridePin?: string,
  nowMs = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, nonce, providedSig] = parts;
  if (!expStr || !nonce || !providedSig) return false;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) return false;

  try {
    const expectedHash = await resolveExpectedPinHash(overridePin);
    const signingKey = await sha256Hex(`${expectedHash}:mashro-owner-portal-v1`);
    const expectedSig = await hmacSha256Hex(signingKey, `${expStr}.${nonce}`);
    return constantTimeEqual(providedSig, expectedSig);
  } catch {
    return false;
  }
}

export function generateSurveyResponseId(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return `msh_${bytesToHex(bytes)}`;
}

/**
 * Recursively strips `undefined` properties (which Firestore SDK `setDoc` forbids).
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        out[key] = stripUndefinedDeep(val);
      }
    }
    return out as T;
  }
  return value;
}

export interface SplitSiteConfigDocs {
  mainContent: Record<string, unknown>;
  heroImageDoc: { schemaVersion: 1; imageUrl: string; imageAlt: string } | null;
  compositionImageDoc: { schemaVersion: 1; imageUrl: string; imageAlt: string } | null;
}

/**
 * Splits large base64 data:image URLs into separate Firestore image docs so the `main`
 * config document stays tiny and safely under Firestore 1MB & key-count limits.
 */
export function splitSiteConfigForFirestore(siteConfig: SiteContentConfig): SplitSiteConfigDocs {
  const cloned = stripUndefinedDeep(siteConfig) as unknown as Record<string, unknown>;
  delete cloned.thankYouImageUrl;

  let heroImageDoc: SplitSiteConfigDocs['heroImageDoc'] = null;
  if (typeof siteConfig.heroImageUrl === 'string' && siteConfig.heroImageUrl.startsWith('data:image/')) {
    if (siteConfig.heroImageUrl.length > 740000) {
      throw new Error('Ukuran gambar hero terlalu besar untuk disimpan di Firebase (maks 740 KB).');
    }
    heroImageDoc = {
      schemaVersion: 1,
      imageUrl: siteConfig.heroImageUrl,
      imageAlt: String(siteConfig.heroImageAlt ?? '').slice(0, 300),
    };
    cloned.heroImageUrl = '__stored_in_image_doc__';
  }

  let compositionImageDoc: SplitSiteConfigDocs['compositionImageDoc'] = null;
  if (
    typeof siteConfig.compositionImageUrl === 'string' &&
    siteConfig.compositionImageUrl.startsWith('data:image/')
  ) {
    if (siteConfig.compositionImageUrl.length > 740000) {
      throw new Error('Ukuran gambar komposisi terlalu besar untuk disimpan di Firebase (maks 740 KB).');
    }
    compositionImageDoc = {
      schemaVersion: 1,
      imageUrl: siteConfig.compositionImageUrl,
      imageAlt: String(siteConfig.compositionImageAlt ?? '').slice(0, 300),
    };
    cloned.compositionImageUrl = '__stored_in_image_doc__';
  }

  return {
    mainContent: cloned,
    heroImageDoc,
    compositionImageDoc,
  };
}

export function hydrateSiteConfigFromFirestoreDocs(
  mainDocData: Record<string, unknown> | null | undefined,
  heroImageDocData: Record<string, unknown> | null | undefined,
  compositionImageDocData: Record<string, unknown> | null | undefined
): Partial<SiteContentConfig> | null {
  const baseContent =
    mainDocData && mainDocData.content && typeof mainDocData.content === 'object'
      ? { ...(mainDocData.content as Record<string, unknown>) }
      : null;

  const hasHeroImg = typeof heroImageDocData?.imageUrl === 'string';
  const hasCompImg = typeof compositionImageDocData?.imageUrl === 'string';

  if (!baseContent && !hasHeroImg && !hasCompImg) {
    return null;
  }

  const merged: Record<string, unknown> = baseContent ? { ...baseContent } : {};
  delete merged.thankYouImageUrl;

  if (hasHeroImg) {
    merged.heroImageUrl = heroImageDocData!.imageUrl;
  } else if (merged.heroImageUrl === '__stored_in_image_doc__') {
    delete merged.heroImageUrl;
  }

  if (hasCompImg) {
    merged.compositionImageUrl = compositionImageDocData!.imageUrl;
  } else if (merged.compositionImageUrl === '__stored_in_image_doc__') {
    delete merged.compositionImageUrl;
  }

  return merged as Partial<SiteContentConfig>;
}
