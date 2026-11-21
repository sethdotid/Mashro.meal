import {
  FirestoreRestDocument,
  decodeFirestoreDocument,
  encodeFirestoreFields,
  encodeFirestoreValue,
} from './firestoreRestCodec';

export interface FirestoreRestConfig {
  projectId: string;
  databaseId: string;
  apiKey: string;
}

export type FirestoreRestErrorCode =
  | 'permission-denied'
  | 'not-found'
  | 'resource-exhausted'
  | 'unavailable'
  | 'invalid-argument'
  | 'unknown';

export class FirestoreRestError extends Error {
  public readonly status: number;
  public readonly code: FirestoreRestErrorCode;

  constructor(message: string, status: number, code: FirestoreRestErrorCode) {
    super(message);
    this.name = 'FirestoreRestError';
    this.status = status;
    this.code = code;
  }
}

export interface FirestoreRestCommitWrite {
  update?: {
    name: string;
    fields: ReturnType<typeof encodeFirestoreFields>;
  };
  delete?: string;
  updateTransforms?: Array<{
    fieldPath: string;
    setToServerValue: 'REQUEST_TIME';
  }>;
  currentDocument?: {
    exists: boolean;
  };
}

function normalizeDocPath(docPath: string): string {
  return docPath.replace(/^\/+|\/+$/g, '');
}

export function buildFirestoreDocResourceName(
  config: Pick<FirestoreRestConfig, 'projectId' | 'databaseId'>,
  docPath: string
): string {
  const cleanPath = normalizeDocPath(docPath);
  return `projects/${config.projectId}/databases/${config.databaseId}/documents/${cleanPath}`;
}

export function buildFirestoreDocumentUrl(config: FirestoreRestConfig, docPath: string): string {
  const resourceName = buildFirestoreDocResourceName(config, docPath);
  return `https://firestore.googleapis.com/v1/${resourceName}?key=${encodeURIComponent(config.apiKey)}`;
}

export function buildFirestoreCommitUrl(config: FirestoreRestConfig): string {
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.databaseId}/documents:commit?key=${encodeURIComponent(config.apiKey)}`;
}

export function buildFirestoreRunQueryUrl(
  config: FirestoreRestConfig,
  parentDocPath?: string
): string {
  const cleanParent = parentDocPath ? normalizeDocPath(parentDocPath) : '';
  const suffix = cleanParent ? `/${cleanParent}` : '';
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.databaseId}/documents${suffix}:runQuery?key=${encodeURIComponent(config.apiKey)}`;
}

export function buildCommitSetWrite(
  config: Pick<FirestoreRestConfig, 'projectId' | 'databaseId'>,
  options: {
    docPath: string;
    fields: Record<string, unknown>;
    serverTimestampFields?: string[];
    exists?: boolean;
  }
): FirestoreRestCommitWrite {
  const write: FirestoreRestCommitWrite = {
    update: {
      name: buildFirestoreDocResourceName(config, options.docPath),
      fields: encodeFirestoreFields(options.fields),
    },
  };

  if (options.serverTimestampFields && options.serverTimestampFields.length > 0) {
    write.updateTransforms = options.serverTimestampFields.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    }));
  }

  if (typeof options.exists === 'boolean') {
    write.currentDocument = { exists: options.exists };
  }

  return write;
}

export function buildCommitDeleteWrite(
  config: Pick<FirestoreRestConfig, 'projectId' | 'databaseId'>,
  docPath: string
): FirestoreRestCommitWrite {
  return {
    delete: buildFirestoreDocResourceName(config, docPath),
  };
}

export function extractDocIdFromResourceName(name?: string): string {
  if (!name) return '';
  const parts = name.split('/');
  return parts[parts.length - 1] ?? '';
}

export function parseFirestoreTimestampMs(val: unknown, fallbackMs = Date.now()): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    const parsed = Date.parse(val);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallbackMs;
}

function mapHttpStatusToErrorCode(status: number, bodyText: string): FirestoreRestErrorCode {
  const lower = bodyText.toLowerCase();
  if (status === 403 || lower.includes('permission_denied') || lower.includes('missing or insufficient permissions')) {
    return 'permission-denied';
  }
  if (status === 404 || lower.includes('not_found')) {
    return 'not-found';
  }
  if (status === 429 || lower.includes('quota exceeded') || lower.includes('resource_exhausted')) {
    return 'resource-exhausted';
  }
  if (status === 400 || lower.includes('invalid_argument')) {
    return 'invalid-argument';
  }
  if (status >= 500 || status === 408 || lower.includes('unavailable')) {
    return 'unavailable';
  }
  return 'unknown';
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FirestoreRestError(
        'Waktu koneksi ke Firebase Firestore melebihi batas.',
        408,
        'unavailable'
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new FirestoreRestError(msg, 0, 'unavailable');
  } finally {
    clearTimeout(timer);
  }
}

async function parseErrorResponse(res: Response): Promise<FirestoreRestError> {
  let rawText = '';
  let message = `Firebase REST error (${res.status})`;
  try {
    rawText = await res.text();
    const parsed = JSON.parse(rawText) as {
      error?: { message?: string; status?: string };
    };
    if (parsed?.error?.message) {
      message = parsed.error.message;
    } else if (Array.isArray(parsed) && parsed[0]?.error?.message) {
      message = String(parsed[0].error.message);
    }
  } catch {
    if (rawText) {
      message = rawText.slice(0, 240);
    }
  }
  const code = mapHttpStatusToErrorCode(res.status, `${message} ${rawText}`);
  return new FirestoreRestError(message, res.status, code);
}

export async function restGetDoc(
  config: FirestoreRestConfig,
  docPath: string,
  timeoutMs = 3500
): Promise<Record<string, unknown> | null> {
  const url = buildFirestoreDocumentUrl(config, docPath);
  const res = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    timeoutMs
  );

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const doc = (await res.json()) as FirestoreRestDocument;
  return decodeFirestoreDocument(doc);
}

export async function restCommit(
  config: FirestoreRestConfig,
  writes: FirestoreRestCommitWrite[],
  timeoutMs = 4000
): Promise<void> {
  if (writes.length === 0) return;
  const url = buildFirestoreCommitUrl(config);
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ writes }),
    },
    timeoutMs
  );

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
}

export async function restDeleteDoc(
  config: FirestoreRestConfig,
  docPath: string,
  timeoutMs = 3500
): Promise<void> {
  const url = buildFirestoreDocumentUrl(config, docPath);
  const res = await fetchWithTimeout(
    url,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    },
    timeoutMs
  );

  if (res.status === 404) {
    return;
  }
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
}

export interface RestRunQueryOptions {
  parentDocPath?: string;
  collectionId: string;
  whereField?: string;
  whereOp?: 'EQUAL';
  whereValue?: string | number | boolean;
  limit?: number;
}

export interface RestQueryRow {
  id: string;
  data: Record<string, unknown>;
  createTime?: string;
}

export function buildRunQueryPayload(options: RestRunQueryOptions): Record<string, unknown> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: options.collectionId }],
  };

  if (options.whereField !== undefined && options.whereValue !== undefined) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: options.whereField },
        op: options.whereOp ?? 'EQUAL',
        value: encodeFirestoreValue(options.whereValue),
      },
    };
  }

  if (typeof options.limit === 'number' && options.limit > 0) {
    structuredQuery.limit = options.limit;
  }

  return { structuredQuery };
}

export async function restRunCollectionQuery(
  config: FirestoreRestConfig,
  options: RestRunQueryOptions,
  timeoutMs = 4500
): Promise<RestQueryRow[]> {
  const url = buildFirestoreRunQueryUrl(config, options.parentDocPath);
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(buildRunQueryPayload(options)),
    },
    timeoutMs
  );

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const rows = (await res.json()) as Array<{ document?: FirestoreRestDocument }>;
  if (!Array.isArray(rows)) {
    return [];
  }

  const out: RestQueryRow[] = [];
  for (const row of rows) {
    if (!row?.document) continue;
    out.push({
      id: extractDocIdFromResourceName(row.document.name),
      data: decodeFirestoreDocument(row.document),
      createTime: row.document.createTime,
    });
  }
  return out;
}

/**
 * Lightweight stateless reachability probe to Firestore REST v1.
 * Any HTTP response < 500 (200, 403, 404) confirms Firebase backend connectivity works.
 */
export async function restProbeConnection(
  config: FirestoreRestConfig,
  timeoutMs = 2500
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      buildFirestoreDocumentUrl(config, 'test/connection'),
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      timeoutMs
    );
    return res.status < 500;
  } catch {
    return false;
  }
}
