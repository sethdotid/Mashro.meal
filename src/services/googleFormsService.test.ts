import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PACKAGING_RATING_ITEMS,
  PREORDER_ITEMS,
  PRODUCT_EXPERIENCE_ITEMS,
} from '../types/survey';
import { buildMashroFormBatchRequests, parseGoogleFormInput } from './googleFormsService';

test('parseGoogleFormInput extracts master Form ID from URLs and raw IDs', () => {
  assert.deepEqual(parseGoogleFormInput('  1FAIpQLScAbc123_xyz  '), {
    formId: '1FAIpQLScAbc123_xyz',
    isPublishedResponderUrl: false,
  });

  assert.deepEqual(
    parseGoogleFormInput('https://docs.google.com/forms/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit'),
    {
      formId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
      isPublishedResponderUrl: false,
    }
  );

  assert.deepEqual(
    parseGoogleFormInput('https://docs.google.com/forms/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/viewform?usp=sf_link'),
    {
      formId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
      isPublishedResponderUrl: false,
    }
  );

  assert.deepEqual(
    parseGoogleFormInput('https://docs.google.com/forms/d/e/1FAIpQLSdTestResponderOnly/viewform'),
    {
      formId: '',
      isPublishedResponderUrl: true,
    }
  );
});

test('buildMashroFormBatchRequests creates all 6 survey sections and 32 MASHRO questions with sequential indices', () => {
  const { requests, questionCount } = buildMashroFormBatchRequests();

  // 4 (sec 1) + 8 (sec 2) + 8 (sec 3) + 4 (sec 4) + 4 (sec 5) + 4 (sec 6) = 32 questions
  assert.equal(questionCount, 32);

  // First request updates form info description
  assert.ok('updateFormInfo' in requests[0]);

  const createItems = requests.slice(1) as Array<{
    createItem: {
      item: {
        title: string;
        pageBreakItem?: Record<string, unknown>;
        questionItem?: {
          question?: {
            scaleQuestion?: { low: number; high: number };
            choiceQuestion?: { type: string; options: { value: string }[] };
            textQuestion?: { paragraph: boolean };
          };
        };
      };
      location: { index: number };
    };
  }>;

  // 32 questions + 5 section breaks (Bagian 2..6) = 37 items
  assert.equal(createItems.length, 37);

  // Check strict sequential indices 0..36
  createItems.forEach((req, i) => {
    assert.equal(req.createItem.location.index, i);
  });

  const sectionHeaders = createItems
    .filter((r) => Boolean(r.createItem.item.pageBreakItem))
    .map((r) => r.createItem.item.title);
  assert.equal(sectionHeaders.length, 5);
  assert.ok(sectionHeaders.some((t) => t.includes('Pengalaman Produk')));
  assert.ok(sectionHeaders.some((t) => t.includes('Evaluasi Produk & Kemasan')));
  assert.ok(sectionHeaders.some((t) => t.includes('Harga & Minat Pembelian')));
  assert.ok(sectionHeaders.some((t) => t.includes('Layanan Pre-Order')));
  assert.ok(sectionHeaders.some((t) => t.includes('Kepuasan Keseluruhan')));

  const titles = createItems.map((r) => r.createItem.item.title);
  for (const item of PRODUCT_EXPERIENCE_ITEMS) {
    assert.ok(titles.includes(item.label), `Missing product item: ${item.label}`);
  }
  for (const item of PACKAGING_RATING_ITEMS) {
    assert.ok(titles.includes(item.label), `Missing packaging item: ${item.label}`);
  }
  for (const item of PREORDER_ITEMS) {
    assert.ok(titles.includes(item.label), `Missing preorder item: ${item.label}`);
  }

  // Verify 0-10 NPS question and CHECKBOX favorite components exist
  const recommendItem = createItems.find((r) =>
    r.createItem.item.title.includes('merekomendasikan MASHRO')
  );
  assert.equal(recommendItem?.createItem.item.questionItem?.question?.scaleQuestion?.low, 0);
  assert.equal(recommendItem?.createItem.item.questionItem?.question?.scaleQuestion?.high, 10);

  const favItem = createItems.find((r) =>
    r.createItem.item.title.includes('Komponen apa yang paling Anda sukai')
  );
  assert.equal(favItem?.createItem.item.questionItem?.question?.choiceQuestion?.type, 'CHECKBOX');
});
