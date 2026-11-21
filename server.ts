import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PIN = (process.env.ADMIN_PIN ?? '').trim() || 'MASHRO2026';
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto.createHash('sha256').update(`${ADMIN_PIN}:mashro-owner-portal-v1`).digest('hex');

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'mashro-store.json');

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

function signAdminToken(ttlMs = 1000 * 60 * 60 * 24 * 7): { token: string; expiresAt: number } {
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
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

  // --- Survey Submission (Fast <50ms) & Admin Responses ---
  app.post('/api/surveys', (req, res) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const validation = validateSurveySubmission(body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const store = readStore();
    store.responses.unshift(validation.doc);
    writeStore(store);
    res.status(201).json({ id: validation.doc.id, createdAtMs: validation.doc.createdAtMs });
  });

  app.get('/api/admin/responses', requireAdmin, (_req, res) => {
    const store = readStore();
    const sorted = [...store.responses].sort((a, b) => b.createdAtMs - a.createdAtMs);
    res.json({ responses: sorted });
  });

  app.delete('/api/admin/responses/:id', requireAdmin, (req, res) => {
    const targetId = String(req.params.id || '');
    const store = readStore();
    const nextResponses = store.responses.filter((r) => r.id !== targetId);
    store.responses = nextResponses;
    writeStore(store);
    res.json({ deleted: true, id: targetId });
  });

  // --- Editable Site Copy, Custom Questions & Cropped Images ---
  app.get('/api/site-config', (_req, res) => {
    const store = readStore();
    res.json({ siteConfig: store.siteConfig });
  });

  app.put('/api/admin/site-config', requireAdmin, (req, res) => {
    const nextConfig = req.body?.siteConfig;
    if (!nextConfig || typeof nextConfig !== 'object') {
      res.status(400).json({ error: 'Konfigurasi konten tidak valid.' });
      return;
    }
    const store = readStore();
    store.siteConfig = nextConfig as Record<string, unknown>;
    writeStore(store);
    res.json({ siteConfig: store.siteConfig });
  });

  app.post('/api/admin/site-config/reset', requireAdmin, (_req, res) => {
    const store = readStore();
    store.siteConfig = null;
    writeStore(store);
    res.json({ siteConfig: null });
  });

  // --- Google Form Share Link Config ---
  app.get('/api/admin/google-form', requireAdmin, (_req, res) => {
    const store = readStore();
    res.json({ config: store.googleFormConfig });
  });

  app.put('/api/admin/google-form', requireAdmin, (req, res) => {
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
