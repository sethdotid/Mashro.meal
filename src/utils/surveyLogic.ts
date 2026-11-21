import { CustomMcqQuestion } from '../types/siteConfig';
import {
  CONDITION_CASSAVA_OPTIONS,
  CONDITION_CHICKEN_OPTIONS,
  CONDITION_SAUCE_OPTIONS,
  CONDITION_VEGETABLES_OPTIONS,
  EXPRESSION_MOOD_OPTIONS,
  ExpressionMoodOption,
  FOOD_CONDITION_OVERALL_OPTIONS,
  FavoriteComponentOption,
  PACKAGING_RATING_ITEMS,
  PREORDER_ITEMS,
  PRICE_REASONABLE_OPTIONS,
  PRICE_WORTH_IT_OPTIONS,
  PRODUCT_EXPERIENCE_ITEMS,
  PURCHASE_FREQUENCY_OPTIONS,
  PriceReasonableOption,
  PriceWorthItOption,
  PurchaseFrequencyOption,
  REPURCHASE_INTENTION_OPTIONS,
  RepurchaseIntentionOption,
  SATIETY_OPTIONS,
  STEP_DEFINITIONS,
  SatietyOption,
  StoredSurveyResponse,
  SurveyDraft,
  SurveyStepId,
  SurveyStepMeta,
} from '../types/survey';
import { DayPeriodId, getPeriodFromHour24, parseClock24 } from './clockUtils';

/**
 * Determines which survey steps are active based on conditional branching rules.
 */
export function getVisibleSteps(draft: SurveyDraft): SurveyStepMeta[] {
  const stepOrder: SurveyStepId[] = ['respondent', 'product', 'condition', 'packaging', 'pricing'];
  if (draft.hasOrdered === 'Ya, pernah memesan') {
    stepOrder.push('preorder');
  }
  stepOrder.push('overall', 'review');

  return stepOrder.map((id, idx) => ({
    ...STEP_DEFINITIONS[id],
    numberLabel: String(idx + 1).padStart(2, '0'),
  }));
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  missingFields: string[];
}

function isValid1to5(val: number | null): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 5;
}

function isValidClock24(val: string | null): val is string {
  if (!val || !/^\d{2}:\d{2}$/.test(val)) return false;
  const [h, m] = val.split(':').map(Number);
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * Validates required fields for a given step, including custom multiple-choice questions,
 * returning clear Bahasa Indonesia messages.
 */
export function validateStep(
  stepId: SurveyStepId,
  draft: SurveyDraft,
  customQuestions: CustomMcqQuestion[] = []
): ValidationResult {
  const errors: string[] = [];
  const missingFields: string[] = [];

  if (stepId === 'respondent') {
    if (!draft.hasTasted) {
      missingFields.push('hasTasted');
      errors.push('Pilih apakah Anda sudah pernah mencicipi MASHRO.');
    }
    if (!draft.activity) {
      missingFields.push('activity');
      errors.push('Pilih aktivitas Anda saat ini.');
    }
    if (draft.hasTasted === 'Sudah pernah' && !draft.hasOrdered) {
      missingFields.push('hasOrdered');
      errors.push('Pilih apakah Anda pernah memesan MASHRO melalui Pre-Order.');
    }
  }

  if (stepId === 'product') {
    for (const item of PRODUCT_EXPERIENCE_ITEMS) {
      if (!isValid1to5(draft[item.key])) {
        missingFields.push(item.key);
        errors.push(`Berikan penilaian 1–5 untuk "${item.label}".`);
      }
    }
  }

  if (stepId === 'condition') {
    if (!isValidClock24(draft.pickupTime)) {
      missingFields.push('pickupTime');
      errors.push('Tentukan jam pengambilan/konsumsi pesanan pada Jam Dinding.');
    }
    if (!draft.foodConditionOverall) {
      missingFields.push('foodConditionOverall');
      errors.push('Pilih kondisi makanan secara keseluruhan setelah jam tersebut.');
    }
    if (!draft.conditionCassava) {
      missingFields.push('conditionCassava');
      errors.push('Pilih kondisi Mashed Cassava (Singkong) setelah jam tersebut.');
    }
    if (!draft.conditionChicken) {
      missingFields.push('conditionChicken');
      errors.push('Pilih kondisi Pan-Seared Chicken (Ayam) setelah jam tersebut.');
    }
    if (!draft.conditionVegetables) {
      missingFields.push('conditionVegetables');
      errors.push('Pilih kondisi Sayuran (Buncis & Wortel) setelah jam tersebut.');
    }
    if (!draft.conditionSauce) {
      missingFields.push('conditionSauce');
      errors.push('Pilih kondisi Pumpkin Puree Sauce setelah jam tersebut.');
    }
  }

  if (stepId === 'packaging') {
    for (const item of PACKAGING_RATING_ITEMS) {
      if (!isValid1to5(draft[item.key])) {
        missingFields.push(item.key);
        errors.push(`Berikan penilaian 1–5 untuk "${item.label}".`);
      }
    }
    if (!draft.satietyLevel) {
      missingFields.push('satietyLevel');
      errors.push('Pilih tingkat rasa kenyang setelah menyantap MASHRO.');
    }
  }

  if (stepId === 'pricing') {
    if (!draft.priceReasonable) {
      missingFields.push('priceReasonable');
      errors.push('Pilih pendapat Anda mengenai kewajaran harga Rp. 20.000.');
    }
    if (!draft.priceWorthIt) {
      missingFields.push('priceWorthIt');
      errors.push('Pilih penilaian kesepadanan harga Rp. 20.000 (Worth it atau perlu penyesuaian).');
    }
    if (!isValid1to5(draft.purchaseLikelihood)) {
      missingFields.push('purchaseLikelihood');
      errors.push('Berikan skala kemungkinan pembelian (1–5).');
    }
    if (!draft.purchaseFrequency) {
      missingFields.push('purchaseFrequency');
      errors.push('Pilih perkiraan frekuensi pembelian Anda.');
    }
    if (!draft.repurchaseIntention) {
      missingFields.push('repurchaseIntention');
      errors.push('Pilih minat Anda untuk membeli MASHRO kembali.');
    }
  }

  if (stepId === 'preorder' && draft.hasOrdered === 'Ya, pernah memesan') {
    for (const item of PREORDER_ITEMS) {
      if (!isValid1to5(draft[item.key])) {
        missingFields.push(item.key);
        errors.push(`Berikan penilaian 1–5 untuk "${item.label}".`);
      }
    }
  }

  if (stepId === 'overall') {
    if (!draft.expressionMood) {
      missingFields.push('expressionMood');
      errors.push('Pilih ragam ekspresi pengalaman Anda setelah menikmati MASHRO.');
    }
    if (!isValid1to5(draft.overallSatisfaction)) {
      missingFields.push('overallSatisfaction');
      errors.push('Berikan penilaian kepuasan keseluruhan (1–5).');
    }
    if (
      typeof draft.recommendScore !== 'number' ||
      !Number.isInteger(draft.recommendScore) ||
      draft.recommendScore < 0 ||
      draft.recommendScore > 10
    ) {
      missingFields.push('recommendScore');
      errors.push('Pilih skor rekomendasi (0–10).');
    }
    if (draft.favoriteComponents.length === 0) {
      missingFields.push('favoriteComponents');
      errors.push('Pilih minimal satu komponen produk favorit Anda.');
    }
  }

  // Validate custom MCQ questions placed on this step
  for (const cq of customQuestions) {
    if (cq.placement !== stepId) continue;
    if (cq.required) {
      const answer = draft.customAnswers?.[cq.id];
      if (!answer || !cq.options.includes(answer)) {
        missingFields.push(`custom:${cq.id}`);
        errors.push(`Pilih jawaban untuk "${cq.prompt}".`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    missingFields,
  };
}

/**
 * Sanitizes and builds a strict Firestore-compliant payload matching firebase-blueprint.json.
 */
export function buildFirestorePayload(
  draft: SurveyDraft,
  customQuestions: CustomMcqQuestion[] = []
): Record<string, unknown> {
  if (draft.hasTasted !== 'Sudah pernah') {
    throw new Error('Hanya responden yang sudah pernah mencicipi MASHRO yang dapat mengirim survei.');
  }

  const visibleSteps = getVisibleSteps(draft);
  for (const step of visibleSteps) {
    if (step.id !== 'review') {
      const check = validateStep(step.id, draft, customQuestions);
      if (!check.valid) {
        throw new Error(check.errors[0] || 'Data survei belum lengkap.');
      }
    }
  }

  const trimmedOther = draft.activityOther.trim().slice(0, 100);
  const trimmedFeedback = draft.feedbackNotes.trim().slice(0, 1000);

  const payload: Record<string, unknown> = {
    source: 'web_survey',
    hasTasted: 'Sudah pernah',
    activity: draft.activity!,
    hasOrdered: draft.hasOrdered!,
    ratingCassava: draft.ratingCassava!,
    ratingChicken: draft.ratingChicken!,
    ratingPumpkinSauce: draft.ratingPumpkinSauce!,
    ratingVegetables: draft.ratingVegetables!,
    ratingAroma: draft.ratingAroma!,
    ratingTexture: draft.ratingTexture!,
    ratingVisual: draft.ratingVisual!,
    ratingFlavorCombo: draft.ratingFlavorCombo!,
    pickupTime: draft.pickupTime!,
    foodConditionOverall: draft.foodConditionOverall!,
    conditionCassava: draft.conditionCassava!,
    conditionChicken: draft.conditionChicken!,
    conditionVegetables: draft.conditionVegetables!,
    conditionSauce: draft.conditionSauce!,
    ratingPortion: draft.ratingPortion!,
    ratingIngredientCombo: draft.ratingIngredientCombo!,
    satietyLevel: draft.satietyLevel!,
    ratingPackPracticality: draft.ratingPackPracticality!,
    ratingPackStrength: draft.ratingPackStrength!,
    ratingLeakResistance: draft.ratingLeakResistance!,
    ratingEaseOfOpening: draft.ratingEaseOfOpening!,
    ratingEatingConvenience: draft.ratingEatingConvenience!,
    priceReasonable: draft.priceReasonable!,
    priceWorthIt: draft.priceWorthIt!,
    purchaseLikelihood: draft.purchaseLikelihood!,
    purchaseFrequency: draft.purchaseFrequency!,
    repurchaseIntention: draft.repurchaseIntention!,
    expressionMood: draft.expressionMood!,
    overallSatisfaction: draft.overallSatisfaction!,
    recommendScore: draft.recommendScore!,
    favoriteComponents: draft.favoriteComponents.slice(0, 5),
  };

  if (draft.activity === 'Lainnya' && trimmedOther.length > 0) {
    payload.activityOther = trimmedOther;
  }

  if (draft.hasOrdered === 'Ya, pernah memesan') {
    payload.preOrderEase = draft.preOrderEase!;
    payload.preOrderResponsiveness = draft.preOrderResponsiveness!;
    payload.preOrderAccuracy = draft.preOrderAccuracy!;
    payload.preOrderPunctuality = draft.preOrderPunctuality!;
  }

  if (trimmedFeedback.length > 0) {
    payload.feedbackNotes = trimmedFeedback;
  }

  // Include non-empty sanitized custom multiple-choice answers
  const cleanedCustom: Record<string, string> = {};
  for (const [qId, ans] of Object.entries(draft.customAnswers ?? {})) {
    const safeKey = qId.trim().slice(0, 64);
    const safeVal = typeof ans === 'string' ? ans.trim().slice(0, 160) : '';
    if (safeKey && safeVal) {
      cleanedCustom[safeKey] = safeVal;
    }
  }
  if (Object.keys(cleanedCustom).length > 0) {
    payload.customAnswers = cleanedCustom;
  }

  return payload;
}

export interface AttributeAverage {
  key: string;
  label: string;
  category: 'Produk' | 'Kemasan & Porsi' | 'Layanan Pre-Order';
  average: number;
  count: number;
}

export interface DistributionItem {
  label: string;
  count: number;
  percentage: number;
}

export interface CategoryScoreSummary {
  key: string;
  label: string;
  average: number;
  count: number;
}

export interface DailyTrendPoint {
  dateKey: string;
  label: string;
  count: number;
  avgSatisfaction: number;
  avgRecommend: number;
  freshPct: number;
}

export interface PickupPeriodTrendPoint {
  periodId: DayPeriodId;
  periodLabel: string;
  count: number;
  freshPct: number;
  avgSatisfaction: number;
}

export interface DashboardAnalytics {
  totalResponses: number;
  preOrderCount: number;
  avgOverallSatisfaction: number | null;
  avgRecommendScore: number | null;
  npsNetScore: number | null;
  priceAcceptancePct: number | null;
  priceWorthItPct: number | null;
  avgPurchaseLikelihood: number | null;
  positiveRepurchasePct: number | null;
  categoryAverages: CategoryScoreSummary[];
  overallSatisfactionDistribution: DistributionItem[];
  attributeAverages: AttributeAverage[];
  priceDistribution: DistributionItem[];
  priceWorthItDistribution: DistributionItem[];
  repurchaseDistribution: DistributionItem[];
  frequencyDistribution: DistributionItem[];
  satietyDistribution: DistributionItem[];
  favoriteDistribution: DistributionItem[];
  activityDistribution: DistributionItem[];
  expressionDistribution: DistributionItem[];
  foodConditionOverallDistribution: DistributionItem[];
  conditionCassavaDistribution: DistributionItem[];
  conditionChickenDistribution: DistributionItem[];
  conditionVegetablesDistribution: DistributionItem[];
  conditionSauceDistribution: DistributionItem[];
  dailyTrend: DailyTrendPoint[];
  pickupPeriodTrend: PickupPeriodTrendPoint[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function avgOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return round1(sum / values.length);
}

function buildDistribution(counts: Map<string, number>, orderedKeys: string[], total: number): DistributionItem[] {
  return orderedKeys.map((key) => {
    const count = counts.get(key) ?? 0;
    return {
      label: key,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}

/**
 * Computes pure analytics from genuine submitted survey responses.
 * Returns null/0 metrics when responses is empty—never fabricates statistics.
 */
export function computeDashboardStats(responses: StoredSurveyResponse[]): DashboardAnalytics {
  const total = responses.length;

  if (total === 0) {
    return {
      totalResponses: 0,
      preOrderCount: 0,
      avgOverallSatisfaction: null,
      avgRecommendScore: null,
      npsNetScore: null,
      priceAcceptancePct: null,
      priceWorthItPct: null,
      avgPurchaseLikelihood: null,
      positiveRepurchasePct: null,
      categoryAverages: [],
      overallSatisfactionDistribution: [],
      attributeAverages: [],
      priceDistribution: [],
      priceWorthItDistribution: [],
      repurchaseDistribution: [],
      frequencyDistribution: [],
      satietyDistribution: [],
      favoriteDistribution: [],
      activityDistribution: [],
      expressionDistribution: [],
      foodConditionOverallDistribution: [],
      conditionCassavaDistribution: [],
      conditionChickenDistribution: [],
      conditionVegetablesDistribution: [],
      conditionSauceDistribution: [],
      dailyTrend: [],
      pickupPeriodTrend: [],
    };
  }

  const preOrders = responses.filter((r) => r.hasOrdered === 'Ya, pernah memesan');

  const avgOverallSatisfaction = avgOf(responses.map((r) => r.overallSatisfaction));
  const avgRecommendScore = avgOf(responses.map((r) => r.recommendScore));
  const avgPurchaseLikelihood = avgOf(responses.map((r) => r.purchaseLikelihood));

  const promoters = responses.filter((r) => r.recommendScore >= 9).length;
  const detractors = responses.filter((r) => r.recommendScore <= 6).length;
  const npsNetScore = Math.round(((promoters - detractors) / total) * 100);

  const reasonableCount = responses.filter(
    (r) => r.priceReasonable === 'Sangat wajar' || r.priceReasonable === 'Wajar'
  ).length;
  const priceAcceptancePct = Math.round((reasonableCount / total) * 100);

  const withWorthIt = responses.filter((r) => Boolean(r.priceWorthIt));
  const worthItCount = withWorthIt.filter((r) => r.priceWorthIt === 'Worth it').length;
  const priceWorthItPct =
    withWorthIt.length > 0 ? Math.round((worthItCount / withWorthIt.length) * 100) : null;

  const positiveRepurchaseCount = responses.filter(
    (r) =>
      r.repurchaseIntention === 'Pasti akan membeli lagi' ||
      r.repurchaseIntention === 'Kemungkinan besar akan membeli lagi'
  ).length;
  const positiveRepurchasePct = Math.round((positiveRepurchaseCount / total) * 100);

  const attributeDefs: {
    key: keyof StoredSurveyResponse;
    label: string;
    category: AttributeAverage['category'];
    subset?: StoredSurveyResponse[];
  }[] = [
    { key: 'ratingCassava', label: 'Rasa Mashed Cassava', category: 'Produk' },
    { key: 'ratingChicken', label: 'Rasa Pan-Seared Chicken', category: 'Produk' },
    { key: 'ratingPumpkinSauce', label: 'Rasa Pumpkin Puree Sauce', category: 'Produk' },
    { key: 'ratingVegetables', label: 'Rasa Sayuran Kukus', category: 'Produk' },
    { key: 'ratingAroma', label: 'Aroma Sajian', category: 'Produk' },
    { key: 'ratingTexture', label: 'Tekstur Makanan', category: 'Produk' },
    { key: 'ratingVisual', label: 'Tampilan Visual', category: 'Produk' },
    { key: 'ratingFlavorCombo', label: 'Perpaduan Rasa Keseluruhan', category: 'Produk' },
    { key: 'ratingPortion', label: 'Ukuran Porsi', category: 'Kemasan & Porsi' },
    { key: 'ratingIngredientCombo', label: 'Komposisi Bahan', category: 'Kemasan & Porsi' },
    { key: 'ratingPackPracticality', label: 'Kepraktisan Kemasan', category: 'Kemasan & Porsi' },
    { key: 'ratingPackStrength', label: 'Kekuatan Kemasan', category: 'Kemasan & Porsi' },
    { key: 'ratingLeakResistance', label: 'Ketahanan Kebocoran', category: 'Kemasan & Porsi' },
    { key: 'ratingEaseOfOpening', label: 'Kemudahan Membuka', category: 'Kemasan & Porsi' },
    { key: 'ratingEatingConvenience', label: 'Kenyamanan Menyantap', category: 'Kemasan & Porsi' },
    { key: 'preOrderEase', label: 'Kemudahan Pemesanan', category: 'Layanan Pre-Order', subset: preOrders },
    { key: 'preOrderResponsiveness', label: 'Kecepatan Respons Penjual', category: 'Layanan Pre-Order', subset: preOrders },
    { key: 'preOrderAccuracy', label: 'Ketepatan Pesanan', category: 'Layanan Pre-Order', subset: preOrders },
    { key: 'preOrderPunctuality', label: 'Ketepatan Waktu', category: 'Layanan Pre-Order', subset: preOrders },
  ];

  const attributeAverages: AttributeAverage[] = [];
  for (const def of attributeDefs) {
    const sourceList = def.subset ?? responses;
    const nums = sourceList
      .map((item) => item[def.key])
      .filter((val): val is number => typeof val === 'number');
    if (nums.length > 0) {
      attributeAverages.push({
        key: String(def.key),
        label: def.label,
        category: def.category,
        average: avgOf(nums) ?? 0,
        count: nums.length,
      });
    }
  }

  const priceCounts = new Map<string, number>();
  const priceWorthItCounts = new Map<string, number>();
  const repurchaseCounts = new Map<string, number>();
  const frequencyCounts = new Map<string, number>();
  const satietyCounts = new Map<string, number>();
  const favoriteCounts = new Map<string, number>();
  const activityCounts = new Map<string, number>();
  const expressionCounts = new Map<string, number>();
  const condOverallCounts = new Map<string, number>();
  const condCassavaCounts = new Map<string, number>();
  const condChickenCounts = new Map<string, number>();
  const condVegCounts = new Map<string, number>();
  const condSauceCounts = new Map<string, number>();

  for (const r of responses) {
    priceCounts.set(r.priceReasonable, (priceCounts.get(r.priceReasonable) ?? 0) + 1);
    if (r.priceWorthIt) {
      priceWorthItCounts.set(r.priceWorthIt, (priceWorthItCounts.get(r.priceWorthIt) ?? 0) + 1);
    }
    repurchaseCounts.set(r.repurchaseIntention, (repurchaseCounts.get(r.repurchaseIntention) ?? 0) + 1);
    frequencyCounts.set(r.purchaseFrequency, (frequencyCounts.get(r.purchaseFrequency) ?? 0) + 1);
    satietyCounts.set(r.satietyLevel, (satietyCounts.get(r.satietyLevel) ?? 0) + 1);
    activityCounts.set(r.activity, (activityCounts.get(r.activity) ?? 0) + 1);
    if (r.expressionMood) {
      expressionCounts.set(r.expressionMood, (expressionCounts.get(r.expressionMood) ?? 0) + 1);
    }
    if (r.foodConditionOverall) {
      condOverallCounts.set(
        r.foodConditionOverall,
        (condOverallCounts.get(r.foodConditionOverall) ?? 0) + 1
      );
    }
    if (r.conditionCassava) {
      condCassavaCounts.set(r.conditionCassava, (condCassavaCounts.get(r.conditionCassava) ?? 0) + 1);
    }
    if (r.conditionChicken) {
      condChickenCounts.set(r.conditionChicken, (condChickenCounts.get(r.conditionChicken) ?? 0) + 1);
    }
    if (r.conditionVegetables) {
      condVegCounts.set(
        r.conditionVegetables,
        (condVegCounts.get(r.conditionVegetables) ?? 0) + 1
      );
    }
    if (r.conditionSauce) {
      condSauceCounts.set(r.conditionSauce, (condSauceCounts.get(r.conditionSauce) ?? 0) + 1);
    }
    for (const fav of r.favoriteComponents) {
      favoriteCounts.set(fav, (favoriteCounts.get(fav) ?? 0) + 1);
    }
  }

  const favoriteKeys: FavoriteComponentOption[] = [
    'Mashed Cassava',
    'Pan-Seared Chicken',
    'Pumpkin Puree Sauce',
    'Steamed Green Beans & Carrots',
    'Semua komponen',
  ];

  const productAttrs = attributeAverages.filter((a) => a.category === 'Produk');
  const packAttrs = attributeAverages.filter((a) => a.category === 'Kemasan & Porsi');
  const preOrderAttrs = attributeAverages.filter((a) => a.category === 'Layanan Pre-Order');

  const categoryAverages: CategoryScoreSummary[] = [];
  if (productAttrs.length > 0) {
    categoryAverages.push({
      key: 'produk',
      label: 'Kualitas Produk',
      average: avgOf(productAttrs.map((a) => a.average)) ?? 0,
      count: total,
    });
  }
  if (packAttrs.length > 0) {
    categoryAverages.push({
      key: 'kemasan',
      label: 'Porsi & Kemasan',
      average: avgOf(packAttrs.map((a) => a.average)) ?? 0,
      count: total,
    });
  }
  if (preOrderAttrs.length > 0) {
    categoryAverages.push({
      key: 'layanan',
      label: 'Layanan Pre-Order',
      average: avgOf(preOrderAttrs.map((a) => a.average)) ?? 0,
      count: preOrders.length,
    });
  }
  if (avgOverallSatisfaction !== null) {
    categoryAverages.push({
      key: 'keseluruhan',
      label: 'Kepuasan Total',
      average: avgOverallSatisfaction,
      count: total,
    });
  }

  const satisfactionCounts = new Map<string, number>();
  for (const r of responses) {
    const label = `Skor ${r.overallSatisfaction}`;
    satisfactionCounts.set(label, (satisfactionCounts.get(label) ?? 0) + 1);
  }
  const overallSatisfactionDistribution = buildDistribution(
    satisfactionCounts,
    ['Skor 5', 'Skor 4', 'Skor 3', 'Skor 2', 'Skor 1'],
    total
  );

  const condTotal = responses.filter((r) => Boolean(r.foodConditionOverall)).length;

  return {
    totalResponses: total,
    preOrderCount: preOrders.length,
    avgOverallSatisfaction,
    avgRecommendScore,
    npsNetScore,
    priceAcceptancePct,
    priceWorthItPct,
    avgPurchaseLikelihood,
    positiveRepurchasePct,
    categoryAverages,
    overallSatisfactionDistribution,
    attributeAverages,
    priceDistribution: buildDistribution(priceCounts, PRICE_REASONABLE_OPTIONS as PriceReasonableOption[], total),
    priceWorthItDistribution: buildDistribution(
      priceWorthItCounts,
      PRICE_WORTH_IT_OPTIONS.map((o) => o.value) as PriceWorthItOption[],
      withWorthIt.length
    ),
    repurchaseDistribution: buildDistribution(
      repurchaseCounts,
      REPURCHASE_INTENTION_OPTIONS as RepurchaseIntentionOption[],
      total
    ),
    frequencyDistribution: buildDistribution(
      frequencyCounts,
      PURCHASE_FREQUENCY_OPTIONS as PurchaseFrequencyOption[],
      total
    ),
    satietyDistribution: buildDistribution(satietyCounts, SATIETY_OPTIONS as SatietyOption[], total),
    favoriteDistribution: buildDistribution(favoriteCounts, favoriteKeys, total),
    activityDistribution: buildDistribution(
      activityCounts,
      ['Karyawan', 'Mahasiswa', 'Dosen/Staf', 'Lainnya'],
      total
    ),
    expressionDistribution: buildDistribution(
      expressionCounts,
      EXPRESSION_MOOD_OPTIONS.map((o) => o.value) as ExpressionMoodOption[],
      responses.filter((r) => Boolean(r.expressionMood)).length
    ),
    foodConditionOverallDistribution: buildDistribution(
      condOverallCounts,
      FOOD_CONDITION_OVERALL_OPTIONS.map((o) => o.value),
      condTotal
    ),
    conditionCassavaDistribution: buildDistribution(
      condCassavaCounts,
      CONDITION_CASSAVA_OPTIONS.map((o) => o.value),
      condTotal
    ),
    conditionChickenDistribution: buildDistribution(
      condChickenCounts,
      CONDITION_CHICKEN_OPTIONS.map((o) => o.value),
      condTotal
    ),
    conditionVegetablesDistribution: buildDistribution(
      condVegCounts,
      CONDITION_VEGETABLES_OPTIONS.map((o) => o.value),
      condTotal
    ),
    conditionSauceDistribution: buildDistribution(
      condSauceCounts,
      CONDITION_SAUCE_OPTIONS.map((o) => o.value),
      condTotal
    ),
    dailyTrend: buildDailyTrend(responses),
    pickupPeriodTrend: buildPickupPeriodTrend(responses),
  };
}

function toLocalDateKey(ms: number): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTrendDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function buildDailyTrend(responses: StoredSurveyResponse[]): DailyTrendPoint[] {
  const byDay = new Map<string, StoredSurveyResponse[]>();
  for (const r of responses) {
    const key = toLocalDateKey(r.createdAtMs);
    const list = byDay.get(key) ?? [];
    list.push(r);
    byDay.set(key, list);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, items]) => {
      const withCond = items.filter((i) => Boolean(i.foodConditionOverall));
      const freshCount = withCond.filter((i) => i.foodConditionOverall === 'Masih enak').length;
      return {
        dateKey,
        label: formatTrendDateLabel(dateKey),
        count: items.length,
        avgSatisfaction: avgOf(items.map((i) => i.overallSatisfaction)) ?? 0,
        avgRecommend: avgOf(items.map((i) => i.recommendScore)) ?? 0,
        freshPct: withCond.length > 0 ? Math.round((freshCount / withCond.length) * 100) : 0,
      };
    });
}

function buildPickupPeriodTrend(responses: StoredSurveyResponse[]): PickupPeriodTrendPoint[] {
  const withPickup = responses.filter((r) => isValidClock24(r.pickupTime ?? null));
  if (withPickup.length === 0) return [];

  const defs: { id: DayPeriodId; label: string }[] = [
    { id: 'pagi', label: 'Pagi (05–11)' },
    { id: 'siang', label: 'Siang (12–14)' },
    { id: 'sore', label: 'Sore (15–17)' },
    { id: 'malam', label: 'Malam (18–04)' },
  ];

  const buckets = new Map<DayPeriodId, StoredSurveyResponse[]>();
  for (const def of defs) buckets.set(def.id, []);

  for (const r of withPickup) {
    const { hour24 } = parseClock24(r.pickupTime ?? null);
    const pid = getPeriodFromHour24(hour24);
    buckets.get(pid)?.push(r);
  }

  return defs.map((def) => {
    const items = buckets.get(def.id) ?? [];
    const withCond = items.filter((i) => Boolean(i.foodConditionOverall));
    const freshCount = withCond.filter((i) => i.foodConditionOverall === 'Masih enak').length;
    return {
      periodId: def.id,
      periodLabel: def.label,
      count: items.length,
      freshPct: withCond.length > 0 ? Math.round((freshCount / withCond.length) * 100) : 0,
      avgSatisfaction: items.length > 0 ? avgOf(items.map((i) => i.overallSatisfaction)) ?? 0 : 0,
    };
  });
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates UTF-8 CSV content (with BOM) from genuine survey responses.
 */
export function buildCsvContent(
  responses: StoredSurveyResponse[],
  customQuestions: CustomMcqQuestion[] = []
): string {
  const baseHeaders = [
    'ID Respons',
    'Waktu Kirim',
    'Aktivitas',
    'Aktivitas Lainnya',
    'Pernah Pre-Order',
    'Rasa Mashed Cassava',
    'Rasa Pan-Seared Chicken',
    'Rasa Pumpkin Puree Sauce',
    'Rasa Sayuran',
    'Aroma',
    'Tekstur',
    'Tampilan Visual',
    'Perpaduan Rasa',
    'Jam Konsumsi (WIB)',
    'Kondisi Umum Setelah Jam Tersebut',
    'Kondisi Singkong (Cassava)',
    'Kondisi Ayam (Chicken)',
    'Kondisi Sayuran',
    'Kondisi Pumpkin Puree Sauce',
    'Ukuran Porsi',
    'Komposisi Bahan',
    'Tingkat Kenyang',
    'Kepraktisan Kemasan',
    'Kekuatan Kemasan',
    'Ketahanan Bocor',
    'Kemudahan Buka',
    'Kenyamanan Makan',
    'Kewajaran Harga (Rp. 20.000)',
    'Nilai Harga Rp. 20.000 (Worth It)',
    'Minat Beli (1-5)',
    'Frekuensi Pembelian',
    'Minat Beli Ulang',
    'Pre-Order: Kemudahan',
    'Pre-Order: Respons Penjual',
    'Pre-Order: Ketepatan Pesanan',
    'Pre-Order: Ketepatan Waktu',
    'Ragam Ekspresi',
    'Kepuasan Keseluruhan (1-5)',
    'Skor Rekomendasi (0-10)',
    'Komponen Favorit',
    'Saran & Masukan',
  ];

  const customHeaders = customQuestions.map((cq) => cq.prompt);
  const headers = [...baseHeaders, ...customHeaders];

  const rows = responses.map((r) => [
    r.id,
    new Date(r.createdAtMs).toISOString(),
    r.activity,
    r.activityOther ?? '',
    r.hasOrdered,
    r.ratingCassava,
    r.ratingChicken,
    r.ratingPumpkinSauce,
    r.ratingVegetables,
    r.ratingAroma,
    r.ratingTexture,
    r.ratingVisual,
    r.ratingFlavorCombo,
    r.pickupTime ?? '',
    r.foodConditionOverall ?? '',
    r.conditionCassava ?? '',
    r.conditionChicken ?? '',
    r.conditionVegetables ?? '',
    r.conditionSauce ?? '',
    r.ratingPortion,
    r.ratingIngredientCombo,
    r.satietyLevel,
    r.ratingPackPracticality,
    r.ratingPackStrength,
    r.ratingLeakResistance,
    r.ratingEaseOfOpening,
    r.ratingEatingConvenience,
    r.priceReasonable,
    r.priceWorthIt ?? '',
    r.purchaseLikelihood,
    r.purchaseFrequency,
    r.repurchaseIntention,
    r.preOrderEase ?? '',
    r.preOrderResponsiveness ?? '',
    r.preOrderAccuracy ?? '',
    r.preOrderPunctuality ?? '',
    r.expressionMood ?? '',
    r.overallSatisfaction,
    r.recommendScore,
    r.favoriteComponents.join('; '),
    r.feedbackNotes ?? '',
    ...customQuestions.map((cq) => r.customAnswers?.[cq.id] ?? ''),
  ]);

  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  return '\uFEFF' + csvLines.join('\r\n');
}
