import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DEFAULT_SITE_CONTENT, mergeSiteContent } from '../types/siteConfig';
import {
  deriveMashroVaultId,
  generateSurveyResponseId,
  hydrateSiteConfigFromFirestoreDocs,
  splitSiteConfigForFirestore,
  stripUndefinedDeep,
  verifyClientAdminToken,
  verifyPinAndIssueToken,
} from './vaultCrypto';

test('deriveMashroVaultId matches server HMAC-SHA256 vault derivation bit-for-bit', async () => {
  const projectId = 'gen-lang-client-0646634032';
  const dbId = 'ai-studio-0f2efb7e-a534-496a-9d8a-3002acacff9b';
  const expected = crypto
    .createHmac('sha256', `${projectId}:${dbId}:mashro-firestore-vault-v1`)
    .update('mashro-firestore-vault-v1')
    .digest('hex')
    .slice(0, 48);

  const actual = await deriveMashroVaultId(projectId, dbId);
  assert.equal(actual, expected);
  assert.equal(actual.length, 48);
  assert.match(actual, /^[a-f0-9]{48}$/);
});

test('verifyPinAndIssueToken validates MASHRO2026 and verifyClientAdminToken accepts valid 30-day token', async () => {
  const now = 1_780_000_000_000;
  const { token, expiresAt } = await verifyPinAndIssueToken('MASHRO2026', undefined, now);
  assert.equal(expiresAt, now + 1000 * 60 * 60 * 24 * 30);

  assert.equal(await verifyClientAdminToken(token, undefined, now + 1000), true);
  assert.equal(await verifyClientAdminToken(token, undefined, expiresAt + 1), false);
  assert.equal(await verifyClientAdminToken(`${token}tampered`, undefined, now + 1000), false);
  await assert.rejects(() => verifyPinAndIssueToken('WRONGPIN', undefined, now), /PIN Admin tidak valid/);
});

test('verifyPinAndIssueToken respects optional override PIN', async () => {
  const { token } = await verifyPinAndIssueToken('CUSTOM99', 'CUSTOM99', 1_780_000_000_000);
  assert.equal(await verifyClientAdminToken(token, 'CUSTOM99', 1_780_000_001_000), true);
  assert.equal(await verifyClientAdminToken(token, undefined, 1_780_000_001_000), false);
});

test('generateSurveyResponseId produces valid Firestore IDs', () => {
  const id = generateSurveyResponseId();
  assert.match(id, /^msh_[a-f0-9]{12}$/);
});

test('stripUndefinedDeep removes nested undefined properties for Firestore compatibility', () => {
  const input = {
    a: 1,
    b: undefined,
    list: [{ id: 'q1', description: undefined, prompt: 'Halo' }],
  };
  const out = stripUndefinedDeep(input);
  assert.equal('b' in out, false);
  assert.equal('description' in out.list[0], false);
  assert.equal(out.list[0].prompt, 'Halo');
});

test('splitSiteConfigForFirestore & hydrateSiteConfigFromFirestoreDocs round-trip cropped images safely', () => {
  const fakeDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
  const custom = mergeSiteContent({
    ...DEFAULT_SITE_CONTENT,
    heroTitle: 'Judul Baru MASHRO',
    heroImageUrl: fakeDataUrl,
    customQuestions: [
      {
        id: 'cq_1',
        prompt: 'Pilih varian?',
        options: ['Original', 'Pedas'],
        required: true,
        placement: 'overall',
      },
    ],
  });

  const split = splitSiteConfigForFirestore(custom);
  assert.equal(split.mainContent.heroImageUrl, '__stored_in_image_doc__');
  assert.equal(split.heroImageDoc?.imageUrl, fakeDataUrl);
  assert.equal(split.compositionImageDoc, null);
  assert.equal('thankYouImageUrl' in split.mainContent, false);

  const hydrated = hydrateSiteConfigFromFirestoreDocs(
    { schemaVersion: 1, content: split.mainContent },
    split.heroImageDoc,
    null
  );
  assert.equal(hydrated?.heroTitle, 'Judul Baru MASHRO');
  assert.equal(hydrated?.heroImageUrl, fakeDataUrl);
  assert.equal(hydrated?.compositionImageUrl, DEFAULT_SITE_CONTENT.compositionImageUrl);
});
