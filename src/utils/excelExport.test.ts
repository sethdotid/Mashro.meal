import test from 'node:test';
import assert from 'node:assert/strict';
import { StoredSurveyResponse } from '../types/survey';
import { buildExcelWorkbookBytes } from './excelExport';
import { computeDashboardStats } from './surveyLogic';

function makeResponse(overrides: Partial<StoredSurveyResponse> = {}): StoredSurveyResponse {
  return {
    id: 'resp-xl-1',
    createdAtMs: 1732104000000,
    source: 'web_survey',
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
    ratingPackStrength: 5,
    ratingLeakResistance: 5,
    ratingEaseOfOpening: 4,
    ratingEatingConvenience: 5,
    priceReasonable: 'Wajar',
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
    favoriteComponents: ['Mashed Cassava', 'Pumpkin Puree Sauce'],
    feedbackNotes: 'Rasa <enak> & gurih!',
    customAnswers: { q_time: 'Makan Siang' },
    ...overrides,
  };
}

test('buildExcelWorkbookBytes emits valid PKZIP .xlsx with 3 sheets and proper XML escaping', () => {
  const responses = [makeResponse()];
  const stats = computeDashboardStats(responses);
  const bytes = buildExcelWorkbookBytes(responses, stats, [
    {
      id: 'q_time',
      prompt: 'Momen Favorit & Waktu',
      options: ['Sarapan', 'Makan Siang'],
      required: true,
      placement: 'overall',
    },
  ]);

  // Verify PKZIP local file header magic bytes ('PK\x03\x04')
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);

  // Verify End of Central Directory signature ('PK\x05\x06') near end of archive
  const eocdOffset = bytes.length - 22;
  assert.equal(bytes[eocdOffset], 0x50);
  assert.equal(bytes[eocdOffset + 1], 0x4b);
  assert.equal(bytes[eocdOffset + 2], 0x05);
  assert.equal(bytes[eocdOffset + 3], 0x06);

  const decoded = new TextDecoder('utf-8').decode(bytes);
  assert.ok(decoded.includes('Ringkasan Metrik'));
  assert.ok(decoded.includes('Data Respons'));
  assert.ok(decoded.includes('Tren &amp; Jam Sajian'));
  assert.ok(decoded.includes('Momen Favorit &amp; Waktu'));
  assert.ok(decoded.includes('Rasa &lt;enak&gt; &amp; gurih!'));
  assert.ok(decoded.includes('Makan Siang'));
});
