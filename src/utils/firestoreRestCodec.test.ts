import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeFirestoreDocument,
  encodeFirestoreFields,
} from './firestoreRestCodec';

test('encodeFirestoreFields and decodeFirestoreDocument preserve native types, nested maps, and arrays', () => {
  const original = {
    source: 'web_survey',
    ratingCassava: 5,
    priceWorthIt: 'Worth it',
    favoriteComponents: ['Mashed Cassava', 'Pumpkin Puree Sauce'],
    customAnswers: {
      q1: 'Pilihan A',
    },
    skipMe: undefined,
  };

  const fields = encodeFirestoreFields(original);
  assert.equal('skipMe' in fields, false);
  assert.deepEqual(fields.ratingCassava, { integerValue: '5' });
  assert.deepEqual(fields.priceWorthIt, { stringValue: 'Worth it' });

  const decoded = decodeFirestoreDocument({
    name: 'projects/p/databases/d/documents/owner_vault/v/responses/msh_123',
    fields: {
      ...fields,
      createdAt: { timestampValue: '2026-11-21T08:00:00.000Z' },
    },
  });

  assert.equal(decoded.source, 'web_survey');
  assert.equal(decoded.ratingCassava, 5);
  assert.equal(decoded.priceWorthIt, 'Worth it');
  assert.deepEqual(decoded.favoriteComponents, ['Mashed Cassava', 'Pumpkin Puree Sauce']);
  assert.deepEqual(decoded.customAnswers, { q1: 'Pilihan A' });
  assert.equal(decoded.createdAt, '2026-11-21T08:00:00.000Z');
});
