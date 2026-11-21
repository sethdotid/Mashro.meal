import test from 'node:test';
import assert from 'node:assert/strict';
import { CustomMcqQuestion } from '../types/siteConfig';
import {
  BOARDING_PASS_STATIONS,
  INITIAL_SURVEY_DRAFT,
  StoredSurveyResponse,
  SurveyDraft,
} from '../types/survey';
import {
  buildCsvContent,
  buildFirestorePayload,
  computeDashboardStats,
  getVisibleSteps,
  validateStep,
} from './surveyLogic';

function makeCompleteDraft(overrides: Partial<SurveyDraft> = {}): SurveyDraft {
  return {
    ...INITIAL_SURVEY_DRAFT,
    hasTasted: 'Sudah pernah',
    activity: 'Karyawan',
    hasOrdered: 'Ya, pernah memesan',
    ratingCassava: 5,
    ratingChicken: 5,
    ratingPumpkinSauce: 4,
    ratingVegetables: 4,
    ratingAroma: 5,
    ratingTexture: 5,
    ratingVisual: 5,
    ratingFlavorCombo: 5,
    pickupTime: '13:30',
    foodConditionOverall: 'Masih enak',
    conditionCassava: 'Masih enak',
    conditionChicken: 'Masih empuk & enak',
    conditionVegetables: 'Masih segar',
    conditionSauce: 'Masih pas & enak',
    ratingPortion: 4,
    ratingIngredientCombo: 5,
    satietyLevel: 'Cukup mengenyangkan',
    ratingPackPracticality: 5,
    ratingPackStrength: 4,
    ratingLeakResistance: 5,
    ratingEaseOfOpening: 4,
    ratingEatingConvenience: 5,
    priceReasonable: 'Wajar',
    priceWorthIt: 'Worth it',
    purchaseLikelihood: 4,
    purchaseFrequency: 'Sekali seminggu',
    repurchaseIntention: 'Kemungkinan besar akan membeli lagi',
    preOrderEase: 5,
    preOrderResponsiveness: 5,
    preOrderAccuracy: 5,
    preOrderPunctuality: 4,
    expressionMood: 'Sangat Senang',
    overallSatisfaction: 5,
    recommendScore: 9,
    favoriteComponents: ['Mashed Cassava', 'Pumpkin Puree Sauce'],
    feedbackNotes: 'Saus labu sangat lembut dan porsinya pas.',
    customAnswers: {},
    ...overrides,
  };
}

test('getVisibleSteps includes condition & conditional preorder steps mapped to Boarding Pass stations', () => {
  const orderedSteps = getVisibleSteps(makeCompleteDraft({ hasOrdered: 'Ya, pernah memesan' }));
  assert.equal(orderedSteps.some((s) => s.id === 'condition'), true);
  assert.equal(orderedSteps.some((s) => s.id === 'preorder'), true);
  assert.equal(orderedSteps.length, 8);

  for (const step of orderedSteps) {
    const station = BOARDING_PASS_STATIONS[step.id];
    assert.ok(station?.stationCode.startsWith('ST-'), `Missing stationCode for ${step.id}`);
    assert.ok(station?.stopName.length > 0, `Missing stopName for ${step.id}`);
  }

  const tasterOnlySteps = getVisibleSteps(makeCompleteDraft({ hasOrdered: 'Tidak, hanya mencicipi' }));
  assert.equal(tasterOnlySteps.some((s) => s.id === 'preorder'), false);
  assert.equal(tasterOnlySteps.length, 7);
});

test('validateStep enforces condition clock, 5 food conditions, and custom MCQ questions', () => {
  const emptyCheck = validateStep('respondent', INITIAL_SURVEY_DRAFT);
  assert.equal(emptyCheck.valid, false);
  assert.ok(emptyCheck.missingFields.includes('hasTasted'));
  assert.ok(emptyCheck.missingFields.includes('activity'));

  const missingCondition = validateStep(
    'condition',
    makeCompleteDraft({ pickupTime: null, conditionSauce: null })
  );
  assert.equal(missingCondition.valid, false);
  assert.ok(missingCondition.missingFields.includes('pickupTime'));
  assert.ok(missingCondition.missingFields.includes('conditionSauce'));

  const customQs: CustomMcqQuestion[] = [
    {
      id: 'q_custom_1',
      prompt: 'Kapan waktu favorit Anda makan MASHRO?',
      options: ['Pagi', 'Siang', 'Sore'],
      required: true,
      placement: 'overall',
    },
  ];
  const missingCustom = validateStep('overall', makeCompleteDraft(), customQs);
  assert.equal(missingCustom.valid, false);
  assert.ok(missingCustom.missingFields.includes('custom:q_custom_1'));

  const missingPricing = validateStep('pricing', makeCompleteDraft({ priceWorthIt: null }));
  assert.equal(missingPricing.valid, false);
  assert.ok(missingPricing.missingFields.includes('priceWorthIt'));

  const validCustom = validateStep(
    'overall',
    makeCompleteDraft({ customAnswers: { q_custom_1: 'Siang' } }),
    customQs
  );
  assert.equal(validCustom.valid, true);
});

test('buildFirestorePayload preserves pickupTime, conditions, priceWorthIt, and customAnswers while stripping empty optionals', () => {
  const draft = makeCompleteDraft({
    hasOrdered: 'Tidak, hanya mencicipi',
    preOrderEase: 5,
    feedbackNotes: '   ',
    customAnswers: { q_fav_time: 'Makan Siang' },
  });
  const payload = buildFirestorePayload(draft);
  assert.equal('preOrderEase' in payload, false);
  assert.equal('feedbackNotes' in payload, false);
  assert.equal(payload.pickupTime, '13:30');
  assert.equal(payload.priceWorthIt, 'Worth it');
  assert.equal(payload.conditionCassava, 'Masih enak');
  assert.deepEqual(payload.customAnswers, { q_fav_time: 'Makan Siang' });
});

test('computeDashboardStats aggregates food conditions and builds CSV columns cleanly', () => {
  const r1: StoredSurveyResponse = {
    id: 'resp-1',
    createdAtMs: 1700000000000,
    source: 'web_survey',
    hasTasted: 'Sudah pernah',
    activity: 'Karyawan',
    hasOrdered: 'Ya, pernah memesan',
    ratingCassava: 5,
    ratingChicken: 4,
    ratingPumpkinSauce: 5,
    ratingVegetables: 4,
    ratingAroma: 5,
    ratingTexture: 5,
    ratingVisual: 5,
    ratingFlavorCombo: 5,
    pickupTime: '13:30',
    foodConditionOverall: 'Masih enak',
    conditionCassava: 'Masih enak',
    conditionChicken: 'Masih empuk & enak',
    conditionVegetables: 'Masih segar',
    conditionSauce: 'Mulai asin',
    ratingPortion: 4,
    ratingIngredientCombo: 5,
    satietyLevel: 'Cukup mengenyangkan',
    ratingPackPracticality: 5,
    ratingPackStrength: 5,
    ratingLeakResistance: 5,
    ratingEaseOfOpening: 4,
    ratingEatingConvenience: 5,
    priceReasonable: 'Sangat wajar',
    priceWorthIt: 'Worth it',
    purchaseLikelihood: 5,
    purchaseFrequency: 'Sekali seminggu',
    repurchaseIntention: 'Pasti akan membeli lagi',
    preOrderEase: 5,
    preOrderResponsiveness: 5,
    preOrderAccuracy: 5,
    preOrderPunctuality: 5,
    expressionMood: 'Sangat Senang',
    overallSatisfaction: 5,
    recommendScore: 10,
    favoriteComponents: ['Mashed Cassava'],
    feedbackNotes: 'Enak, gurih, "mantap"',
    customAnswers: { q_custom_1: 'Siang' },
  };

  const stats = computeDashboardStats([r1]);
  assert.equal(stats.totalResponses, 1);
  assert.equal(stats.priceWorthItPct, 100);
  assert.equal(
    stats.priceWorthItDistribution.find((d) => d.label === 'Worth it')?.count,
    1
  );
  assert.equal(
    stats.conditionSauceDistribution.find((d) => d.label === 'Mulai asin')?.count,
    1
  );
  assert.equal(stats.dailyTrend.length, 1);
  assert.equal(stats.dailyTrend[0]?.count, 1);
  assert.equal(stats.dailyTrend[0]?.freshPct, 100);

  const siangBucket = stats.pickupPeriodTrend.find((p) => p.periodId === 'siang');
  assert.equal(siangBucket?.count, 1);
  assert.equal(siangBucket?.freshPct, 100);

  const r2: StoredSurveyResponse = {
    ...r1,
    id: 'resp-2',
    createdAtMs: r1.createdAtMs + 86_400_000,
    pickupTime: '19:30',
    foodConditionOverall: 'Mulai menurun',
    priceWorthIt: 'Masih bisa lebih murah',
    overallSatisfaction: 3,
    recommendScore: 7,
  };
  const multiStats = computeDashboardStats([r2, r1]);
  assert.equal(multiStats.dailyTrend.length, 2);
  assert.equal(multiStats.priceWorthItPct, 50);
  assert.ok(multiStats.dailyTrend[0].dateKey < multiStats.dailyTrend[1].dateKey);
  assert.equal(multiStats.pickupPeriodTrend.find((p) => p.periodId === 'malam')?.freshPct, 0);

  const csv = buildCsvContent([r1], [
    {
      id: 'q_custom_1',
      prompt: 'Waktu Favorit',
      options: ['Pagi', 'Siang'],
      required: true,
      placement: 'overall',
    },
  ]);
  assert.ok(csv.includes('Jam Konsumsi (WIB)'));
  assert.ok(csv.includes('Kewajaran Harga (Rp. 20.000)'));
  assert.ok(csv.includes('Nilai Harga Rp. 20.000 (Worth It)'));
  assert.ok(csv.includes('Worth it'));
  assert.ok(csv.includes('Waktu Favorit'));
  assert.ok(csv.includes('13:30'));
  assert.ok(csv.includes('Siang'));
  assert.ok(csv.includes('"Enak, gurih, ""mantap"""'));
});
