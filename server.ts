import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

import {
  FirestoreRestDocument,
  decodeFirestoreDocument,
  encodeFirestoreFields,
} from './src/utils/firestoreRestCodec';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PIN = (process.env.ADMIN_PIN ?? '').trim() || 'MASHRO2026';
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto.createHash('sha256').update(`${ADMIN_PIN}:mashro-owner-portal-v1`).digest('hex');

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'mashro-store.json');
const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 hari (> 10 hari)

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as Partial<FirebaseAppletConfig>;
    if (!raw.projectId || !raw.apiKey || !raw.firestoreDatabaseId) return null;
    return {
      projectId: raw.projectId,
      apiKey: raw.apiKey,
      firestoreDatabaseId: raw.firestoreDatabaseId,
    };
  } catch {
    return null;
  }
}

const FIREBASE_CFG = loadFirebaseConfig();
const VAULT_SEED =
  process.env.MASHRO_VAULT_SECRET ||
  (FIREBASE_CFG
    ? `${FIREBASE_CFG.projectId}:${FIREBASE_CFG.firestoreDatabaseId}:mashro-firestore-vault-v1`
    : SESSION_SECRET);
const VAULT_ID = crypto
  .createHmac('sha256', VAULT_SEED)
  .update('mashro-firestore-vault-v1')
  .digest('hex')
  .slice(0, 48);

function getFirestoreDocName(collectionRelPath: string, docId: string): string {
  if (!FIREBASE_CFG) return '';
  return `projects/${FIREBASE_CFG.projectId}/databases/${FIREBASE_CFG.firestoreDatabaseId}/documents/${collectionRelPath}/${docId}`;
}

function getFirestoreDocUrl(collectionRelPath: string, docId: string): string {
  if (!FIREBASE_CFG) return '';
  return `https://firestore.googleapis.com/v1/${getFirestoreDocName(collectionRelPath, docId)}?key=${encodeURIComponent(FIREBASE_CFG.apiKey)}`;
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ status: number; data: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

interface FirestoreCommitWrite {
  update: {
    name: string;
    fields: Record<string, unknown>;
  };
  currentDocument?: { exists: boolean };
  updateTransforms?: { fieldPath: string; setToServerValue: 'REQUEST_TIME' }[];
}

async function firestoreCommit(writes: FirestoreCommitWrite[], timeoutMs = 3800): Promise<void> {
  if (!FIREBASE_CFG || writes.length === 0) return;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CFG.projectId}/databases/${FIREBASE_CFG.firestoreDatabaseId}/documents:commit?key=${encodeURIComponent(FIREBASE_CFG.apiKey)}`;
  const { status, data } = await fetchJsonWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes }),
    },
    timeoutMs
  );
  if (status < 200 || status >= 300) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(errObj?.message || `Firestore commit failed with HTTP ${status}`);
  }
}

async function firestoreGetDoc(
  collectionRelPath: string,
  docId: string,
  timeoutMs = 3200
): Promise<FirestoreRestDocument | null> {
  if (!FIREBASE_CFG) return null;
  const url = getFirestoreDocUrl(collectionRelPath, docId);
  const { status, data } = await fetchJsonWithTimeout(url, { method: 'GET' }, timeoutMs);
  if (status === 404) return null;
  if (status < 200 || status >= 300) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(errObj?.message || `Firestore get failed with HTTP ${status}`);
  }
  return data as unknown as FirestoreRestDocument;
}

async function firestoreDeleteDoc(
  collectionRelPath: string,
  docId: string,
  timeoutMs = 3200
): Promise<void> {
  if (!FIREBASE_CFG) return;
  const url = getFirestoreDocUrl(collectionRelPath, docId);
  const { status, data } = await fetchJsonWithTimeout(url, { method: 'DELETE' }, timeoutMs);
  if (status === 404) return;
  if (status < 200 || status >= 300) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(errObj?.message || `Firestore delete failed with HTTP ${status}`);
  }
}

async function firestoreListCollection(
  collectionRelPath: string,
  timeoutMs = 4500
): Promise<FirestoreRestDocument[]> {
  if (!FIREBASE_CFG) return [];

  const parts = collectionRelPath.split('/').filter(Boolean);
  const collectionId = parts.pop();
  if (!collectionId) return [];
  const parentRel = parts.join('/');
  const parentPrefix = parentRel
    ? `projects/${FIREBASE_CFG.projectId}/databases/${FIREBASE_CFG.firestoreDatabaseId}/documents/${parentRel}`
    : `projects/${FIREBASE_CFG.projectId}/databases/${FIREBASE_CFG.firestoreDatabaseId}/documents`;

  const url = `https://firestore.googleapis.com/v1/${parentPrefix}:runQuery?key=${encodeURIComponent(FIREBASE_CFG.apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'source' },
              op: 'EQUAL',
              value: { stringValue: 'web_survey' },
            },
          },
          limit: 500,
        },
      }),
    });

    if (res.status === 404) return [];
    const raw = (await res.json().catch(() => [])) as unknown;
    if (!res.ok) {
      const errObj =
        !Array.isArray(raw) && raw && typeof raw === 'object'
          ? (raw as { error?: { message?: string } }).error
          : Array.isArray(raw) && raw[0] && typeof raw[0] === 'object'
          ? (raw[0] as { error?: { message?: string } }).error
          : undefined;
      throw new Error(errObj?.message || `Firestore runQuery failed with HTTP ${res.status}`);
    }

    if (!Array.isArray(raw)) return [];
    const docs: FirestoreRestDocument[] = [];
    for (const row of raw) {
      if (row && typeof row === 'object' && 'document' in row) {
        const doc = (row as { document?: FirestoreRestDocument }).document;
        if (doc && typeof doc === 'object') {
          docs.push(doc);
        }
      }
    }
    return docs;
  } finally {
    clearTimeout(timer);
  }
}

interface StoredSurveyDoc {
  id: string;
  createdAtMs: number;
  source: 'web_survey';
  hasTasted: 'Sudah pernah';
  activity: string;
  activityOther?: string;
  hasOrdered: string;
  ratingCassava: number;
  ratingChicken: number;
  ratingPumpkinSauce: number;
  ratingVegetables: number;
  ratingAroma: number;
  ratingTexture: number;
  ratingVisual: number;
  ratingFlavorCombo: number;
  pickupTime: string;
  foodConditionOverall: string;
  conditionCassava: string;
  conditionChicken: string;
  conditionVegetables: string;
  conditionSauce: string;
  ratingPortion: number;
  ratingIngredientCombo: number;
  satietyLevel: string;
  ratingPackPracticality: number;
  ratingPackStrength: number;
  ratingLeakResistance: number;
  ratingEaseOfOpening: number;
  ratingEatingConvenience: number;
  priceReasonable: string;
  priceWorthIt: string;
  purchaseLikelihood: number;
  purchaseFrequency: string;
  repurchaseIntention: string;
  preOrderEase?: number;
  preOrderResponsiveness?: number;
  preOrderAccuracy?: number;
  preOrderPunctuality?: number;
  expressionMood?: string;
  overallSatisfaction: number;
  recommendScore: number;
  favoriteComponents: string[];
  feedbackNotes?: string;
  customAnswers?: Record<string, string>;
}

interface GoogleFormSavedConfig {
  formId: string;
  formTitle: string;
  responderUri: string;
  updatedAtMs?: number;
}

interface PersistedStore {
  responses: StoredSurveyDoc[];
  siteConfig: Record<string, unknown> | null;
  googleFormConfig: GoogleFormSavedConfig | null;
}

function readStore(): PersistedStore {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return { responses: [], siteConfig: null, googleFormConfig: null };
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    return {
      responses: Array.isArray(parsed.responses) ? parsed.responses : [],
      siteConfig: parsed.siteConfig && typeof parsed.siteConfig === 'object' ? parsed.siteConfig : null,
      googleFormConfig:
        parsed.googleFormConfig && typeof parsed.googleFormConfig === 'object'
          ? parsed.googleFormConfig
          : null,
    };
  } catch {
    return { responses: [], siteConfig: null, googleFormConfig: null };
  }
}

function writeStore(next: PersistedStore): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function signAdminToken(ttlMs = ADMIN_TOKEN_TTL_MS): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ role: 'owner', exp: expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt };
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'owner' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function constantTimePinMatch(input: string, target: string): boolean {
  const bufA = Buffer.from(input, 'utf8');
  const bufB = Buffer.from(target, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Sesi admin tidak valid atau telah berakhir. Silakan masukkan PIN kembali.' });
    return;
  }
  next();
}

function isIntInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max;
}

const VALID_ACTIVITIES = new Set(['Karyawan', 'Mahasiswa', 'Dosen/Staf', 'Lainnya']);
const VALID_HAS_ORDERED = new Set(['Ya, pernah memesan', 'Tidak, hanya mencicipi']);
const VALID_SATIETY = new Set(['Tidak mengenyangkan', 'Cukup mengenyangkan', 'Sangat mengenyangkan']);
const VALID_PRICE = new Set(['Sangat wajar', 'Wajar', 'Kurang wajar', 'Tidak wajar']);
const VALID_PRICE_WORTH_IT = new Set([
  'Worth it',
  'Masih bisa lebih murah',
  'Seharusnya bisa lebih baik harganya',
]);
const VALID_FREQ = new Set([
  'Beberapa kali seminggu',
  'Sekali seminggu',
  '2–3 kali sebulan',
  'Sekali sebulan atau lebih jarang',
  'Belum berminat',
]);
const VALID_REPURCHASE = new Set([
  'Pasti akan membeli lagi',
  'Kemungkinan besar akan membeli lagi',
  'Ragu-ragu',
  'Kemungkinan tidak membeli lagi',
]);
const VALID_EXPRESSIONS = new Set([
  'Sangat Kecewa',
  'Kurang Puas',
  'Biasa Saja',
  'Senang',
  'Sangat Senang',
]);
const VALID_FAVORITES = new Set([
  'Mashed Cassava',
  'Pan-Seared Chicken',
  'Pumpkin Puree Sauce',
  'Steamed Green Beans & Carrots',
  'Semua komponen',
]);
const VALID_FOOD_OVERALL = new Set(['Masih enak', 'Mulai menurun', 'Sudah tidak enak']);
const VALID_COND_CASSAVA = new Set(['Masih enak', 'Mulai sedikit asam', 'Sudah asam']);
const VALID_COND_CHICKEN = new Set(['Masih empuk & enak', 'Sedikit kering', 'Alot']);
const VALID_COND_VEG = new Set(['Masih segar', 'Agak layu', 'Tidak segar']);
const VALID_COND_SAUCE = new Set(['Masih pas & enak', 'Mulai asin', 'Terlalu asin / berubah rasa']);

function validateSurveySubmission(body: Record<string, unknown>): {
  ok: true;
  doc: StoredSurveyDoc;
} | {
  ok: false;
  error: string;
} {
  if (body.hasTasted !== 'Sudah pernah') {
    return { ok: false, error: 'Hanya responden yang sudah mencicipi MASHRO yang dapat mengirim survei.' };
  }
  if (typeof body.activity !== 'string' || !VALID_ACTIVITIES.has(body.activity)) {
    return { ok: false, error: 'Aktivitas responden tidak valid.' };
  }
  if (typeof body.hasOrdered !== 'string' || !VALID_HAS_ORDERED.has(body.hasOrdered)) {
    return { ok: false, error: 'Status pemesanan Pre-Order tidak valid.' };
  }
  const required1to5 = [
    'ratingCassava',
    'ratingChicken',
    'ratingPumpkinSauce',
    'ratingVegetables',
    'ratingAroma',
    'ratingTexture',
    'ratingVisual',
    'ratingFlavorCombo',
    'ratingPortion',
    'ratingIngredientCombo',
    'ratingPackPracticality',
    'ratingPackStrength',
    'ratingLeakResistance',
    'ratingEaseOfOpening',
    'ratingEatingConvenience',
    'purchaseLikelihood',
    'overallSatisfaction',
  ];
  for (const key of required1to5) {
    if (!isIntInRange(body[key], 1, 5)) {
      return { ok: false, error: `Penilaian "${key}" wajib bernilai 1–5.` };
    }
  }
  if (typeof body.pickupTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.pickupTime)) {
    return { ok: false, error: 'Jam pengambilan/konsumsi pada Jam Dinding wajib diisi.' };
  }
  if (typeof body.foodConditionOverall !== 'string' || !VALID_FOOD_OVERALL.has(body.foodConditionOverall)) {
    return { ok: false, error: 'Kondisi makanan secara keseluruhan tidak valid.' };
  }
  if (typeof body.conditionCassava !== 'string' || !VALID_COND_CASSAVA.has(body.conditionCassava)) {
    return { ok: false, error: 'Kondisi Mashed Cassava tidak valid.' };
  }
  if (typeof body.conditionChicken !== 'string' || !VALID_COND_CHICKEN.has(body.conditionChicken)) {
    return { ok: false, error: 'Kondisi Pan-Seared Chicken tidak valid.' };
  }
  if (typeof body.conditionVegetables !== 'string' || !VALID_COND_VEG.has(body.conditionVegetables)) {
    return { ok: false, error: 'Kondisi Sayuran tidak valid.' };
  }
  if (typeof body.conditionSauce !== 'string' || !VALID_COND_SAUCE.has(body.conditionSauce)) {
    return { ok: false, error: 'Kondisi Pumpkin Puree Sauce tidak valid.' };
  }
  if (typeof body.satietyLevel !== 'string' || !VALID_SATIETY.has(body.satietyLevel)) {
    return { ok: false, error: 'Tingkat rasa kenyang tidak valid.' };
  }
  if (typeof body.priceReasonable !== 'string' || !VALID_PRICE.has(body.priceReasonable)) {
    return { ok: false, error: 'Penilaian kewajaran harga tidak valid.' };
  }
  if (typeof body.priceWorthIt !== 'string' || !VALID_PRICE_WORTH_IT.has(body.priceWorthIt)) {
    return { ok: false, error: 'Penilaian kesepadanan harga Rp. 20.000 tidak valid.' };
  }
  if (typeof body.purchaseFrequency !== 'string' || !VALID_FREQ.has(body.purchaseFrequency)) {
    return { ok: false, error: 'Frekuensi pembelian tidak valid.' };
  }
  if (typeof body.repurchaseIntention !== 'string' || !VALID_REPURCHASE.has(body.repurchaseIntention)) {
    return { ok: false, error: 'Minat beli ulang tidak valid.' };
  }
  if (typeof body.expressionMood !== 'string' || !VALID_EXPRESSIONS.has(body.expressionMood)) {
    return { ok: false, error: 'Pilihan ragam ekspresi tidak valid.' };
  }
  if (!isIntInRange(body.recommendScore, 0, 10)) {
    return { ok: false, error: 'Skor rekomendasi wajib bernilai 0–10.' };
  }
  if (
    !Array.isArray(body.favoriteComponents) ||
    body.favoriteComponents.length < 1 ||
    body.favoriteComponents.length > 5 ||
    !body.favoriteComponents.every((c) => typeof c === 'string' && VALID_FAVORITES.has(c))
  ) {
    return { ok: false, error: 'Pilih minimal 1 komponen favorit yang valid.' };
  }

  const doc: StoredSurveyDoc = {
    id: `msh_${crypto.randomBytes(6).toString('hex')}`,
    createdAtMs: Date.now(),
    source: 'web_survey',
    hasTasted: 'Sudah pernah',
    activity: body.activity,
    hasOrdered: body.hasOrdered,
    ratingCassava: body.ratingCassava as number,
    ratingChicken: body.ratingChicken as number,
    ratingPumpkinSauce: body.ratingPumpkinSauce as number,
    ratingVegetables: body.ratingVegetables as number,
    ratingAroma: body.ratingAroma as number,
    ratingTexture: body.ratingTexture as number,
    ratingVisual: body.ratingVisual as number,
    ratingFlavorCombo: body.ratingFlavorCombo as number,
    pickupTime: body.pickupTime,
    foodConditionOverall: body.foodConditionOverall,
    conditionCassava: body.conditionCassava,
    conditionChicken: body.conditionChicken,
    conditionVegetables: body.conditionVegetables,
    conditionSauce: body.conditionSauce,
    ratingPortion: body.ratingPortion as number,
    ratingIngredientCombo: body.ratingIngredientCombo as number,
    satietyLevel: body.satietyLevel,
    ratingPackPracticality: body.ratingPackPracticality as number,
    ratingPackStrength: body.ratingPackStrength as number,
    ratingLeakResistance: body.ratingLeakResistance as number,
    ratingEaseOfOpening: body.ratingEaseOfOpening as number,
    ratingEatingConvenience: body.ratingEatingConvenience as number,
    priceReasonable: body.priceReasonable,
    priceWorthIt: body.priceWorthIt,
    purchaseLikelihood: body.purchaseLikelihood as number,
    purchaseFrequency: body.purchaseFrequency,
    repurchaseIntention: body.repurchaseIntention,
    expressionMood: body.expressionMood,
    overallSatisfaction: body.overallSatisfaction as number,
    recommendScore: body.recommendScore as number,
    favoriteComponents: body.favoriteComponents as string[],
  };

  if (body.activity === 'Lainnya' && typeof body.activityOther === 'string' && body.activityOther.trim()) {
    doc.activityOther = body.activityOther.trim().slice(0, 100);
  }
  if (typeof body.feedbackNotes === 'string' && body.feedbackNotes.trim()) {
    doc.feedbackNotes = body.feedbackNotes.trim().slice(0, 1000);
  }

  if (body.hasOrdered === 'Ya, pernah memesan') {
    const preKeys = ['preOrderEase', 'preOrderResponsiveness', 'preOrderAccuracy', 'preOrderPunctuality'] as const;
    for (const pk of preKeys) {
      if (!isIntInRange(body[pk], 1, 5)) {
        return { ok: false, error: `Penilaian layanan Pre-Order "${pk}" wajib bernilai 1–5.` };
      }
      doc[pk] = body[pk] as number;
    }
  }

  if (body.customAnswers && typeof body.customAnswers === 'object' && !Array.isArray(body.customAnswers)) {
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.customAnswers as Record<string, unknown>).slice(0, 20)) {
      if (typeof v === 'string' && v.trim()) {
        sanitized[String(k).trim().slice(0, 64)] = v.trim().slice(0, 160);
      }
    }
    if (Object.keys(sanitized).length > 0) {
      doc.customAnswers = sanitized;
    }
  }

  return { ok: true, doc };
}

function buildVaultResponseFirestoreFields(doc: StoredSurveyDoc): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    source: doc.source,
    hasTasted: doc.hasTasted,
    activity: doc.activity,
    hasOrdered: doc.hasOrdered,
    ratingCassava: doc.ratingCassava,
    ratingChicken: doc.ratingChicken,
    ratingPumpkinSauce: doc.ratingPumpkinSauce,
    ratingVegetables: doc.ratingVegetables,
    ratingAroma: doc.ratingAroma,
    ratingTexture: doc.ratingTexture,
    ratingVisual: doc.ratingVisual,
    ratingFlavorCombo: doc.ratingFlavorCombo,
    pickupTime: doc.pickupTime,
    foodConditionOverall: doc.foodConditionOverall,
    conditionCassava: doc.conditionCassava,
    conditionChicken: doc.conditionChicken,
    conditionVegetables: doc.conditionVegetables,
    conditionSauce: doc.conditionSauce,
    ratingPortion: doc.ratingPortion,
    ratingIngredientCombo: doc.ratingIngredientCombo,
    satietyLevel: doc.satietyLevel,
    ratingPackPracticality: doc.ratingPackPracticality,
    ratingPackStrength: doc.ratingPackStrength,
    ratingLeakResistance: doc.ratingLeakResistance,
    ratingEaseOfOpening: doc.ratingEaseOfOpening,
    ratingEatingConvenience: doc.ratingEatingConvenience,
    priceReasonable: doc.priceReasonable,
    priceWorthIt: doc.priceWorthIt,
    purchaseLikelihood: doc.purchaseLikelihood,
    purchaseFrequency: doc.purchaseFrequency,
    repurchaseIntention: doc.repurchaseIntention,
    overallSatisfaction: doc.overallSatisfaction,
    recommendScore: doc.recommendScore,
    favoriteComponents: doc.favoriteComponents,
  };

  if (doc.activity === 'Lainnya' && doc.activityOther) {
    payload.activityOther = doc.activityOther;
  }
  if (doc.hasOrdered === 'Ya, pernah memesan') {
    payload.preOrderEase = doc.preOrderEase;
    payload.preOrderResponsiveness = doc.preOrderResponsiveness;
    payload.preOrderAccuracy = doc.preOrderAccuracy;
    payload.preOrderPunctuality = doc.preOrderPunctuality;
  }
  if (doc.expressionMood) {
    payload.expressionMood = doc.expressionMood;
  }
  if (doc.feedbackNotes) {
    payload.feedbackNotes = doc.feedbackNotes;
  }
  if (doc.customAnswers && Object.keys(doc.customAnswers).length > 0) {
    payload.customAnswers = doc.customAnswers;
  }

  return encodeFirestoreFields(payload);
}

function parseVaultResponseDoc(restDoc: FirestoreRestDocument): StoredSurveyDoc | null {
  const name = typeof restDoc.name === 'string' ? restDoc.name : '';
  const id = name.split('/').pop() ?? '';
  if (!id) return null;
  const decoded = decodeFirestoreDocument(restDoc);
  const tsStr =
    typeof decoded.createdAt === 'string'
      ? decoded.createdAt
      : typeof restDoc.createTime === 'string'
      ? restDoc.createTime
      : '';
  const parsedMs = tsStr ? Date.parse(tsStr) : NaN;
  const createdAtMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();

  return {
    ...(decoded as unknown as Omit<StoredSurveyDoc, 'id' | 'createdAtMs'>),
    id,
    createdAtMs,
  };
}

let siteConfigHydratedFromCloud = false;

async function hydrateSiteConfigFromVault(): Promise<Record<string, unknown> | null> {
  const store = readStore();
  if (!FIREBASE_CFG) {
    siteConfigHydratedFromCloud = true;
    return store.siteConfig;
  }

  try {
    const basePath = `owner_vault/${VAULT_ID}/site_config`;
    const [mainDoc, heroImgDoc, compImgDoc] = await Promise.all([
      firestoreGetDoc(basePath, 'main', 3200),
      firestoreGetDoc(basePath, 'hero_image', 3200),
      firestoreGetDoc(basePath, 'composition_image', 3200),
    ]);

    siteConfigHydratedFromCloud = true;

    if (!mainDoc) {
      return store.siteConfig;
    }

    const decodedMain = decodeFirestoreDocument(mainDoc);
    const content =
      decodedMain.content && typeof decodedMain.content === 'object'
        ? ({ ...(decodedMain.content as Record<string, unknown>) } as Record<string, unknown>)
        : null;

    if (!content) {
      return store.siteConfig;
    }

    if (heroImgDoc) {
      const heroDecoded = decodeFirestoreDocument(heroImgDoc);
      if (typeof heroDecoded.imageUrl === 'string' && heroDecoded.imageUrl.length > 0) {
        content.heroImageUrl = heroDecoded.imageUrl;
      }
      if (typeof heroDecoded.imageAlt === 'string' && heroDecoded.imageAlt.length > 0) {
        content.heroImageAlt = heroDecoded.imageAlt;
      }
    } else if (content.heroImageUrl === '__stored_in_image_doc__') {
      delete content.heroImageUrl;
    }

    if (compImgDoc) {
      const compDecoded = decodeFirestoreDocument(compImgDoc);
      if (typeof compDecoded.imageUrl === 'string' && compDecoded.imageUrl.length > 0) {
        content.compositionImageUrl = compDecoded.imageUrl;
      }
      if (typeof compDecoded.imageAlt === 'string' && compDecoded.imageAlt.length > 0) {
        content.compositionImageAlt = compDecoded.imageAlt;
      }
    } else if (content.compositionImageUrl === '__stored_in_image_doc__') {
      delete content.compositionImageUrl;
    }

    store.siteConfig = content;
    writeStore(store);
    return content;
  } catch (err) {
    console.warn('Gagal mengambil konfigurasi situs dari Firestore:', err instanceof Error ? err.message : err);
    return store.siteConfig;
  }
}

async function persistSiteConfigToVault(nextConfig: Record<string, unknown>): Promise<void> {
  if (!FIREBASE_CFG) return;

  const heroImageUrl =
    typeof nextConfig.heroImageUrl === 'string' && nextConfig.heroImageUrl.trim()
      ? nextConfig.heroImageUrl
      : '/src/assets/images/mashro_hero_bowl_1795027773941.jpg';
  const heroImageAlt =
    typeof nextConfig.heroImageAlt === 'string' ? nextConfig.heroImageAlt.slice(0, 300) : 'Hero MASHRO';

  const compImageUrl =
    typeof nextConfig.compositionImageUrl === 'string' && nextConfig.compositionImageUrl.trim()
      ? nextConfig.compositionImageUrl
      : '/src/assets/images/mashro_botanical_ingredients_1795027774863.jpg';
  const compImageAlt =
    typeof nextConfig.compositionImageAlt === 'string'
      ? nextConfig.compositionImageAlt.slice(0, 300)
      : 'Komposisi Bahan MASHRO';

  if (heroImageUrl.length > 745000 || compImageUrl.length > 745000) {
    throw new Error('Ukuran gambar hasil crop melebihi batas penyimpanan cloud (745 KB). Pilih gambar atau zoom lebih kecil.');
  }

  const mainContentCopy: Record<string, unknown> = {
    ...nextConfig,
    heroImageUrl: heroImageUrl.startsWith('data:image/') ? '__stored_in_image_doc__' : heroImageUrl,
    compositionImageUrl: compImageUrl.startsWith('data:image/') ? '__stored_in_image_doc__' : compImageUrl,
  };

  const basePath = `owner_vault/${VAULT_ID}/site_config`;
  const writes: FirestoreCommitWrite[] = [
    {
      update: {
        name: getFirestoreDocName(basePath, 'main'),
        fields: encodeFirestoreFields({
          schemaVersion: 1,
          content: mainContentCopy,
        }),
      },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    },
    {
      update: {
        name: getFirestoreDocName(basePath, 'hero_image'),
        fields: encodeFirestoreFields({
          schemaVersion: 1,
          imageUrl: heroImageUrl,
          imageAlt: heroImageAlt,
        }),
      },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    },
    {
      update: {
        name: getFirestoreDocName(basePath, 'composition_image'),
        fields: encodeFirestoreFields({
          schemaVersion: 1,
          imageUrl: compImageUrl,
          imageAlt: compImageAlt,
        }),
      },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    },
  ];

  await firestoreCommit(writes, 5500);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, firestoreVaultEnabled: Boolean(FIREBASE_CFG) });
  });

  // --- Admin PIN Auth Routes ---
  app.post('/api/admin/login', (req, res) => {
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!pin) {
      res.status(400).json({ error: 'Masukkan Password / PIN Admin terlebih dahulu.' });
      return;
    }
    if (!constantTimePinMatch(pin, ADMIN_PIN)) {
      res.status(401).json({ error: 'PIN Admin tidak sesuai. Periksa kembali PIN Anda.' });
      return;
    }
    const session = signAdminToken();
    res.json(session);
  });

  app.get('/api/admin/session', (req, res) => {
    const valid = verifyAdminToken(extractBearer(req));
    res.json({ authenticated: valid });
  });

  // --- Survey Submission (Fast <5s) & Durable Cloud Sync ---
  app.post('/api/surveys', async (req, res) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const validation = validateSurveySubmission(body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const store = readStore();
    store.responses.unshift(validation.doc);
    writeStore(store);

    if (FIREBASE_CFG) {
      try {
        await firestoreCommit(
          [
            {
              update: {
                name: getFirestoreDocName(`owner_vault/${VAULT_ID}/responses`, validation.doc.id),
                fields: buildVaultResponseFirestoreFields(validation.doc),
              },
              currentDocument: { exists: false },
              updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
            },
          ],
          3200
        );
      } catch (err) {
        console.warn(
          'Peringatan sinkronisasi respons ke Firestore vault:',
          err instanceof Error ? err.message : err
        );
      }
    }

    res.status(201).json({ id: validation.doc.id, createdAtMs: validation.doc.createdAtMs });
  });

  app.get('/api/admin/responses', requireAdmin, async (_req, res) => {
    const store = readStore();
    const mergedById = new Map<string, StoredSurveyDoc>();

    for (const localDoc of store.responses) {
      if (localDoc?.id) {
        mergedById.set(localDoc.id, localDoc);
      }
    }

    if (FIREBASE_CFG) {
      try {
        const cloudDocs = await firestoreListCollection(`owner_vault/${VAULT_ID}/responses`, 4200);
        for (const cDoc of cloudDocs) {
          const parsed = parseVaultResponseDoc(cDoc);
          if (parsed?.id) {
            mergedById.set(parsed.id, parsed);
          }
        }
        store.responses = Array.from(mergedById.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
        writeStore(store);
      } catch (err) {
        console.warn(
          'Gagal memuat respons dari Firestore vault (pakai cache lokal):',
          err instanceof Error ? err.message : err
        );
      }
    }

    const sorted = Array.from(mergedById.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
    res.json({ responses: sorted });
  });

  app.delete('/api/admin/responses/:id', requireAdmin, async (req, res) => {
    const targetId = String(req.params.id || '');
    const store = readStore();
    store.responses = store.responses.filter((r) => r.id !== targetId);
    writeStore(store);

    if (FIREBASE_CFG && targetId) {
      try {
        await firestoreDeleteDoc(`owner_vault/${VAULT_ID}/responses`, targetId, 3200);
      } catch (err) {
        console.warn(
          'Gagal menghapus respons di Firestore vault:',
          err instanceof Error ? err.message : err
        );
      }
    }

    res.json({ deleted: true, id: targetId });
  });

  // --- Editable Site Copy, Custom Questions & Cropped Images ---
  app.get('/api/site-config', async (_req, res) => {
    const store = readStore();
    if (!siteConfigHydratedFromCloud || !store.siteConfig) {
      const hydrated = await hydrateSiteConfigFromVault();
      res.json({ siteConfig: hydrated });
      return;
    }
    res.json({ siteConfig: store.siteConfig });
  });

  app.put('/api/admin/site-config', requireAdmin, async (req, res) => {
    const nextConfig = req.body?.siteConfig;
    if (!nextConfig || typeof nextConfig !== 'object' || Array.isArray(nextConfig)) {
      res.status(400).json({ error: 'Konfigurasi konten tidak valid.' });
      return;
    }

    const configObj = nextConfig as Record<string, unknown>;
    try {
      await persistSiteConfigToVault(configObj);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan perubahan ke database cloud. Silakan coba lagi.';
      const statusCode = msg.includes('Ukuran gambar') ? 400 : 502;
      res.status(statusCode).json({ error: msg });
      return;
    }

    const store = readStore();
    store.siteConfig = configObj;
    siteConfigHydratedFromCloud = true;
    writeStore(store);
    res.json({ siteConfig: store.siteConfig });
  });

  app.post('/api/admin/site-config/reset', requireAdmin, async (_req, res) => {
    if (FIREBASE_CFG) {
      const basePath = `owner_vault/${VAULT_ID}/site_config`;
      await Promise.allSettled([
        firestoreDeleteDoc(basePath, 'main', 3200),
        firestoreDeleteDoc(basePath, 'hero_image', 3200),
        firestoreDeleteDoc(basePath, 'composition_image', 3200),
      ]);
    }
    const store = readStore();
    store.siteConfig = null;
    siteConfigHydratedFromCloud = true;
    writeStore(store);
    res.json({ siteConfig: null });
  });

  // --- Google Form Share Link Config ---
  app.get('/api/admin/google-form', requireAdmin, async (_req, res) => {
    const store = readStore();
    if (!store.googleFormConfig && FIREBASE_CFG) {
      try {
        const gDoc = await firestoreGetDoc(`owner_vault/${VAULT_ID}/site_config`, 'google_form', 3000);
        if (gDoc) {
          const decoded = decodeFirestoreDocument(gDoc);
          store.googleFormConfig = {
            formId: String(decoded.formId ?? ''),
            formTitle: String(decoded.formTitle ?? 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan'),
            responderUri: String(decoded.responderUri ?? ''),
            updatedAtMs: Date.now(),
          };
          writeStore(store);
        }
      } catch {
        // fallback to local null
      }
    }
    res.json({ config: store.googleFormConfig });
  });

  app.put('/api/admin/google-form', requireAdmin, async (req, res) => {
    const body = req.body?.config;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Konfigurasi link Google Form tidak valid.' });
      return;
    }
    const config: GoogleFormSavedConfig = {
      formId: String(body.formId ?? '').trim().slice(0, 128),
      formTitle: String(body.formTitle ?? 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan').trim().slice(0, 200),
      responderUri: String(body.responderUri ?? '').trim().slice(0, 400),
      updatedAtMs: Date.now(),
    };

    if (FIREBASE_CFG) {
      try {
        await firestoreCommit(
          [
            {
              update: {
                name: getFirestoreDocName(`owner_vault/${VAULT_ID}/site_config`, 'google_form'),
                fields: encodeFirestoreFields({
                  schemaVersion: 1,
                  formId: config.formId,
                  formTitle: config.formTitle,
                  responderUri: config.responderUri,
                }),
              },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            },
          ],
          3500
        );
      } catch (err) {
        res.status(502).json({
          error:
            err instanceof Error
              ? err.message
              : 'Gagal menyimpan tautan Google Form ke penyimpanan cloud.',
        });
        return;
      }
    }

    const store = readStore();
    store.googleFormConfig = config;
    writeStore(store);
    res.json({ config });
  });

  // --- Frontend Serving (Vite Dev Middleware vs Production Dist) ---
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MASHRO server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
