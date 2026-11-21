import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Static & payload-contract verification tests for MASHRO Firestore Security Rules.
 */
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');

test('firestore.rules exists and enforces rules_version 2 + global deny', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  assert.ok(rules.includes("rules_version = '2';"));
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));
});

test('survey_responses forbids public read/list/update and validates priceWorthIt + wall clock + food condition + customAnswers', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  assert.ok(rules.includes('match /survey_responses/{responseId}'));
  assert.ok(rules.includes('allow create: if isValidId(responseId) && isValidSurveyResponse(incoming());'));
  assert.ok(rules.includes('allow update: if false;'));
  assert.ok(rules.includes('allow list: if isVerifiedOwnerEmail();'));
  assert.ok(rules.includes('data.createdAt == request.time'));
  assert.ok(rules.includes("'priceWorthIt'"));
  assert.ok(rules.includes("'Worth it'"));
  assert.ok(rules.includes("'Masih bisa lebih murah'"));
  assert.ok(rules.includes("'Seharusnya bisa lebih baik harganya'"));
  assert.ok(rules.includes("'pickupTime'"));
  assert.ok(rules.includes("'foodConditionOverall'"));
  assert.ok(rules.includes("'conditionCassava'"));
  assert.ok(rules.includes("'conditionChicken'"));
  assert.ok(rules.includes("'conditionVegetables'"));
  assert.ok(rules.includes("'conditionSauce'"));
  assert.ok(rules.includes("'customAnswers'"));
  assert.ok(rules.includes("'expressionMood'"));
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
});

test('owner_vault secures durable responses and site_config with strict vaultId, schema, and image bounds', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  assert.ok(rules.includes('match /owner_vault/{vaultId}'));
  assert.ok(rules.includes('isValidVaultId(vaultId)'));
  assert.ok(rules.includes('match /responses/{responseId}'));
  assert.ok(rules.includes('match /site_config/{configId}'));
  assert.ok(rules.includes("configId in ['main', 'hero_image', 'composition_image', 'google_form']"));
  assert.ok(rules.includes('data.imageUrl.size() <= 750000'));
  assert.ok(rules.includes('data.updatedAt == request.time'));
  assert.ok(rules.includes("allow delete: if isValidVaultId(vaultId) && isValidId(responseId) && (resource == null || existing().source == 'web_survey');"));
  assert.ok(rules.includes('allow delete: if isValidVaultId(vaultId) && isValidVaultConfigId(configId) && (resource == null || existing().schemaVersion == 1);'));
});
