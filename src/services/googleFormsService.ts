import {
  ACTIVITY_OPTIONS,
  FAVORITE_COMPONENT_OPTIONS,
  PACKAGING_RATING_ITEMS,
  PREORDER_ITEMS,
  PRICE_REASONABLE_OPTIONS,
  PRODUCT_EXPERIENCE_ITEMS,
  PURCHASE_FREQUENCY_OPTIONS,
  REPURCHASE_INTENTION_OPTIONS,
  SATIETY_OPTIONS,
} from '../types/survey';

export interface GoogleFormMetadata {
  formId: string;
  title: string;
  responderUri: string;
  questionCount: number;
}

export interface GoogleFormResponseEntry {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answersCount: number;
  summaryAnswers: { questionId: string; value: string }[];
}

export interface ParsedGoogleFormInput {
  formId: string;
  isPublishedResponderUrl: boolean;
}

/**
 * Extracts a Google Form ID from either a raw Form ID or a full Google Forms URL.
 * Note: Google Forms API requires the master Form ID (`/forms/d/<ID>/...`), not the
 * `/forms/d/e/<publishedId>/viewform` responder URL.
 */
export function parseGoogleFormInput(rawInput: string): ParsedGoogleFormInput {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { formId: '', isPublishedResponderUrl: false };
  }

  if (trimmed.includes('/forms/d/e/')) {
    return { formId: '', isPublishedResponderUrl: true };
  }

  const urlMatch = trimmed.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) {
    return { formId: urlMatch[1], isPublishedResponderUrl: false };
  }

  return { formId: trimmed, isPublishedResponderUrl: false };
}

function makeChoiceItem(
  title: string,
  type: 'RADIO' | 'CHECKBOX',
  options: string[],
  required: boolean,
  index: number,
  description?: string
): Record<string, unknown> {
  return {
    createItem: {
      item: {
        title,
        ...(description ? { description } : {}),
        questionItem: {
          question: {
            required,
            choiceQuestion: {
              type,
              options: options.map((value) => ({ value })),
            },
          },
        },
      },
      location: { index },
    },
  };
}

function makeScaleItem(
  title: string,
  low: number,
  high: number,
  lowLabel: string,
  highLabel: string,
  required: boolean,
  index: number,
  description?: string
): Record<string, unknown> {
  return {
    createItem: {
      item: {
        title,
        ...(description ? { description } : {}),
        questionItem: {
          question: {
            required,
            scaleQuestion: {
              low,
              high,
              lowLabel,
              highLabel,
            },
          },
        },
      },
      location: { index },
    },
  };
}

function makeTextItem(
  title: string,
  paragraph: boolean,
  required: boolean,
  index: number,
  description?: string
): Record<string, unknown> {
  return {
    createItem: {
      item: {
        title,
        ...(description ? { description } : {}),
        questionItem: {
          question: {
            required,
            textQuestion: { paragraph },
          },
        },
      },
      location: { index },
    },
  };
}

function makeSectionBreakItem(
  title: string,
  description: string,
  index: number
): Record<string, unknown> {
  return {
    createItem: {
      item: {
        title,
        description,
        pageBreakItem: {},
      },
      location: { index },
    },
  };
}

/**
 * Builds the complete 6-section MASHRO customer satisfaction survey payload
 * for the Google Forms API v1 `:batchUpdate` endpoint.
 */
export function buildMashroFormBatchRequests(): {
  requests: Record<string, unknown>[];
  questionCount: number;
} {
  const requests: Record<string, unknown>[] = [
    {
      updateFormInfo: {
        info: {
          description:
            'Bantu kami menyempurnakan setiap sajian MASHRO (mashed cassava, pan-seared chicken, pumpkin puree sauce, dan buncis-wortel kukus). Survei ini ditujukan bagi responden yang telah mencicipi MASHRO (estimasi waktu 3–5 menit). Kami tidak mengumpulkan nama lengkap, nomor telepon, atau alamat rumah Anda.',
        },
        updateMask: 'description',
      },
    },
  ];

  let idx = 0;
  let questionCount = 0;

  // Bagian 1: Tentang Responden
  requests.push(
    makeChoiceItem(
      'Apakah Anda sudah pernah mencicipi MASHRO?',
      'RADIO',
      ['Sudah pernah', 'Belum pernah'],
      true,
      idx++,
      'Jika Anda memilih "Belum pernah", Anda tidak perlu mengisi bagian evaluasi produk di halaman berikutnya dan dapat langsung mengirim formulir.'
    )
  );
  questionCount++;

  requests.push(
    makeChoiceItem('Aktivitas Anda saat ini', 'RADIO', ACTIVITY_OPTIONS, true, idx++)
  );
  questionCount++;

  requests.push(
    makeTextItem(
      'Jika memilih "Lainnya", tuliskan aktivitas Anda saat ini (Opsional)',
      false,
      false,
      idx++
    )
  );
  questionCount++;

  requests.push(
    makeChoiceItem(
      'Apakah Anda pernah memesan MASHRO sebelumnya?',
      'RADIO',
      ['Ya, pernah memesan', 'Tidak, hanya mencicipi'],
      true,
      idx++
    )
  );
  questionCount++;

  // Bagian 2: Pengalaman Produk
  requests.push(
    makeSectionBreakItem(
      'Bagian 2: Pengalaman Produk',
      'Khusus bagi responden yang sudah pernah mencicipi MASHRO. Nilai setiap aspek pada skala 1 (Sangat Tidak Puas) hingga 5 (Sangat Puas).',
      idx++
    )
  );

  for (const item of PRODUCT_EXPERIENCE_ITEMS) {
    requests.push(
      makeScaleItem(
        item.label,
        1,
        5,
        'Sangat Tidak Puas',
        'Sangat Puas',
        false,
        idx++,
        item.description
      )
    );
    questionCount++;
  }

  // Bagian 3: Evaluasi Produk & Kemasan
  requests.push(
    makeSectionBreakItem(
      'Bagian 3: Evaluasi Produk & Kemasan',
      'Bantu kami menilai ukuran porsi, tingkat rasa kenyang, serta fungsionalitas kemasan MASHRO.',
      idx++
    )
  );

  const productEvalItems = PACKAGING_RATING_ITEMS.filter((i) => i.group === 'product');
  for (const item of productEvalItems) {
    requests.push(
      makeScaleItem(
        item.label,
        1,
        5,
        'Sangat Tidak Puas',
        'Sangat Puas',
        false,
        idx++,
        item.description
      )
    );
    questionCount++;
  }

  requests.push(
    makeChoiceItem(
      'Seberapa mengenyangkan satu porsi MASHRO bagi Anda?',
      'RADIO',
      SATIETY_OPTIONS,
      false,
      idx++
    )
  );
  questionCount++;

  const packEvalItems = PACKAGING_RATING_ITEMS.filter((i) => i.group === 'packaging');
  for (const item of packEvalItems) {
    requests.push(
      makeScaleItem(
        item.label,
        1,
        5,
        'Sangat Tidak Puas',
        'Sangat Puas',
        false,
        idx++,
        item.description
      )
    );
    questionCount++;
  }

  // Bagian 4: Harga & Minat Pembelian
  requests.push(
    makeSectionBreakItem(
      'Bagian 4: Harga & Minat Pembelian',
      'Harga resmi untuk satu mangkuk sajian MASHRO ditetapkan sebesar Rp. 20.000 per mangkuk.',
      idx++
    )
  );

  requests.push(
    makeChoiceItem(
      'Menurut Anda, apakah harga Rp. 20.000 tersebut wajar untuk satu sajian MASHRO?',
      'RADIO',
      PRICE_REASONABLE_OPTIONS,
      false,
      idx++
    )
  );
  questionCount++;

  requests.push(
    makeScaleItem(
      'Seberapa besar kemungkinan Anda membeli MASHRO pada harga Rp. 20.000 tersebut?',
      1,
      5,
      'Sangat Tidak Berminat',
      'Sangat Berminat',
      false,
      idx++
    )
  );
  questionCount++;

  requests.push(
    makeChoiceItem(
      'Jika tersedia secara rutin, seberapa sering Anda berpotensi membeli MASHRO?',
      'RADIO',
      PURCHASE_FREQUENCY_OPTIONS,
      false,
      idx++
    )
  );
  questionCount++;

  requests.push(
    makeChoiceItem(
      'Apakah Anda bersedia membeli MASHRO kembali di masa mendatang?',
      'RADIO',
      REPURCHASE_INTENTION_OPTIONS,
      false,
      idx++
    )
  );
  questionCount++;

  // Bagian 5: Evaluasi Layanan Pre-Order (Conditional)
  requests.push(
    makeSectionBreakItem(
      'Bagian 5: Evaluasi Layanan Pre-Order (Khusus yang Pernah Memesan)',
      'Isi bagian ini hanya jika Anda memilih "Ya, pernah memesan". Jika hanya mencicipi, silakan langsung lanjut ke Bagian 6.',
      idx++
    )
  );

  for (const item of PREORDER_ITEMS) {
    requests.push(
      makeScaleItem(
        item.label,
        1,
        5,
        'Sangat Tidak Puas',
        'Sangat Puas',
        false,
        idx++,
        item.description
      )
    );
    questionCount++;
  }

  // Bagian 6: Kepuasan Keseluruhan
  requests.push(
    makeSectionBreakItem(
      'Bagian 6: Kepuasan Keseluruhan',
      'Kesan akhir, rekomendasi, komponen favorit, serta masukan Anda untuk menyempurnakan MASHRO.',
      idx++
    )
  );

  requests.push(
    makeScaleItem(
      'Kepuasan keseluruhan Anda terhadap sajian MASHRO',
      1,
      5,
      'Sangat Tidak Puas',
      'Sangat Puas',
      false,
      idx++
    )
  );
  questionCount++;

  requests.push(
    makeScaleItem(
      'Seberapa besar kemungkinan Anda merekomendasikan MASHRO kepada teman atau kolega? (0–10)',
      0,
      10,
      'Tidak Mungkin',
      'Sangat Mungkin',
      false,
      idx++
    )
  );
  questionCount++;

  requests.push(
    makeChoiceItem(
      'Komponen apa yang paling Anda sukai dari MASHRO? (Boleh pilih lebih dari satu)',
      'CHECKBOX',
      FAVORITE_COMPONENT_OPTIONS.map((c) => c.label),
      false,
      idx++
    )
  );
  questionCount++;

  requests.push(
    makeTextItem(
      'Apa saran atau masukan yang ingin kamu berikan untuk MASHRO? (Opsional)',
      true,
      false,
      idx++
    )
  );
  questionCount++;

  return { requests, questionCount };
}

export async function createMashroGoogleForm(accessToken: string): Promise<GoogleFormMetadata> {
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan',
        documentTitle: 'MASHRO – Survei Pelanggan',
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Gagal membuat Google Form (${createRes.status}): ${errText}`);
  }

  const created = await createRes.json();
  const rawFormId = String(created.formId ?? '').trim();
  const safeFormId = encodeURIComponent(rawFormId);

  const { requests, questionCount } = buildMashroFormBatchRequests();

  const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`Formulir dibuat, namun gagal menambahkan pertanyaan (${updateRes.status}): ${errText}`);
  }

  return {
    formId: rawFormId,
    title: String(created.info?.title ?? 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan'),
    responderUri: String(created.responderUri ?? `https://docs.google.com/forms/d/${safeFormId}/viewform`),
    questionCount,
  };
}

export async function getGoogleFormInfo(
  formId: string,
  accessToken: string
): Promise<GoogleFormMetadata> {
  const safeFormId = encodeURIComponent(formId.trim());
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal memuat Google Form (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    formId: String(data.formId ?? formId.trim()),
    title: String(data.info?.title ?? 'Formulir Tanpa Judul'),
    responderUri: String(data.responderUri ?? ''),
    questionCount: Array.isArray(data.items) ? data.items.length : 0,
  };
}

export async function listGoogleFormResponses(
  formId: string,
  accessToken: string
): Promise<GoogleFormResponseEntry[]> {
  const safeFormId = encodeURIComponent(formId.trim());
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}/responses`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal membaca respons Google Form (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawResponses = Array.isArray(data.responses) ? data.responses : [];

  return rawResponses.map((item: Record<string, unknown>) => {
    const answersObj = (item.answers as Record<string, { textAnswers?: { answers?: { value?: string }[] } }>) ?? {};
    const summaryAnswers = Object.entries(answersObj).map(([questionId, ans]) => {
      const vals = ans?.textAnswers?.answers?.map((a) => a.value ?? '').filter(Boolean) ?? [];
      return {
        questionId,
        value: vals.join(', '),
      };
    });

    return {
      responseId: String(item.responseId ?? ''),
      createTime: String(item.createTime ?? ''),
      lastSubmittedTime: String(item.lastSubmittedTime ?? ''),
      answersCount: summaryAnswers.length,
      summaryAnswers,
    };
  });
}
