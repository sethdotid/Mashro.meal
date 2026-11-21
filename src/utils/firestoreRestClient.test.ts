import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommitDeleteWrite,
  buildCommitSetWrite,
  buildFirestoreCommitUrl,
  buildFirestoreDocResourceName,
  buildFirestoreDocumentUrl,
  buildFirestoreRunQueryUrl,
  buildRunQueryPayload,
  extractDocIdFromResourceName,
  parseFirestoreTimestampMs,
} from './firestoreRestClient';

const SAMPLE_CONFIG = {
  projectId: 'gen-lang-client-0646634032',
  databaseId: 'ai-studio-0f2efb7e-a534-496a-9d8a-3002acacff9b',
  apiKey: 'AIzaTestKey123',
};

test('Firestore REST URL builders construct accurate project & named database paths', () => {
  assert.equal(
    buildFirestoreDocResourceName(SAMPLE_CONFIG, '/owner_vault/abc/site_config/main/'),
    'projects/gen-lang-client-0646634032/databases/ai-studio-0f2efb7e-a534-496a-9d8a-3002acacff9b/documents/owner_vault/abc/site_config/main'
  );

  assert.equal(
    buildFirestoreDocumentUrl(SAMPLE_CONFIG, 'test/connection'),
    'https://firestore.googleapis.com/v1/projects/gen-lang-client-0646634032/databases/ai-studio-0f2efb7e-a534-496a-9d8a-3002acacff9b/documents/test/connection?key=AIzaTestKey123'
  );

  assert.equal(
    buildFirestoreCommitUrl(SAMPLE_CONFIG),
    'https://firestore.googleapis.com/v1/projects/gen-lang-client-0646634032/databases/ai-studio-0f2efb7e-a534-496a-9d8a-3002acacff9b/documents:commit?key=AIzaTestKey123'
  );

  assert.equal(
    buildFirestoreRunQueryUrl(SAMPLE_CONFIG, 'owner_vault/vault123'),
    'https://firestore.googleapis.com/v1/projects/gen-lang-client-0646634032/databases/ai-studio-0f2efb7e-a534-496a-9d8a-3002acacff9b/documents/owner_vault/vault123:runQuery?key=AIzaTestKey123'
  );
});

test('buildCommitSetWrite encodes fields and sets REQUEST_TIME updateTransforms', () => {
  const write = buildCommitSetWrite(SAMPLE_CONFIG, {
    docPath: 'owner_vault/vault123/responses/msh_001',
    fields: {
      source: 'web_survey',
      ratingCassava: 5,
      favoriteComponents: ['Mashed Cassava'],
    },
    serverTimestampFields: ['createdAt'],
    exists: false,
  });

  assert.equal(
    write.update?.name,
    'projects/gen-lang-client-0646634032/databases/ai-studio-0f2efb7e-a534-496a-9d8a-3002acacff9b/documents/owner_vault/vault123/responses/msh_001'
  );
  assert.deepEqual(write.update?.fields.source, { stringValue: 'web_survey' });
  assert.deepEqual(write.update?.fields.ratingCassava, { integerValue: '5' });
  assert.deepEqual(write.updateTransforms, [
    { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
  ]);
  assert.deepEqual(write.currentDocument, { exists: false });
});

test('buildCommitDeleteWrite and buildRunQueryPayload format structured queries cleanly', () => {
  const del = buildCommitDeleteWrite(SAMPLE_CONFIG, 'owner_vault/vault123/site_config/hero_image');
  assert.equal(
    del.delete,
    'projects/gen-lang-client-0646634032/databases/ai-studio-0f2efb7e-a534-496a-9d8a-3002acacff9b/documents/owner_vault/vault123/site_config/hero_image'
  );

  const queryPayload = buildRunQueryPayload({
    parentDocPath: 'owner_vault/vault123',
    collectionId: 'responses',
    whereField: 'source',
    whereOp: 'EQUAL',
    whereValue: 'web_survey',
    limit: 500,
  });

  assert.deepEqual(queryPayload, {
    structuredQuery: {
      from: [{ collectionId: 'responses' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'source' },
          op: 'EQUAL',
          value: { stringValue: 'web_survey' },
        },
      },
      limit: 500,
    },
  });
});

test('extractDocIdFromResourceName and parseFirestoreTimestampMs parse REST documents accurately', () => {
  assert.equal(
    extractDocIdFromResourceName(
      'projects/p/databases/d/documents/owner_vault/v/responses/msh_abcdef12'
    ),
    'msh_abcdef12'
  );
  assert.equal(parseFirestoreTimestampMs('2026-11-21T09:48:07.967Z', 0), 1795254487967);
  assert.equal(parseFirestoreTimestampMs(1234567890, 0), 1234567890);
  assert.equal(parseFirestoreTimestampMs('invalid-date', 42), 42);
});
