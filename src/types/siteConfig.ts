import {
  PACKAGING_RATING_ITEMS,
  PREORDER_ITEMS,
  PRODUCT_EXPERIENCE_ITEMS,
  STEP_DEFINITIONS,
  BOARDING_PASS_STATIONS,
} from './survey';

export interface BowlComponentCopy {
  name: string;
  detail: string;
}

export interface SurveyOutlineCopy {
  step: string;
  title: string;
  desc: string;
}

export interface EditableItemCopy {
  key: string;
  label: string;
  description: string;
}

export interface EditableStepCopy {
  id: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  stopName: string;
}

export type CustomQuestionPlacement =
  | 'respondent'
  | 'product'
  | 'condition'
  | 'packaging'
  | 'pricing'
  | 'overall';

export interface CustomMcqQuestion {
  id: string;
  prompt: string;
  description?: string;
  options: string[];
  required: boolean;
  placement: CustomQuestionPlacement;
}

export interface SiteContentConfig {
  brandName: string;
  headerTagline: string;
  navCompositionLabel: string;
  navFlowLabel: string;
  navPrivacyLabel: string;
  surveyTopBarSubtitle: string;
  adminTopBarSubtitle: string;
  homeButtonLabel: string;
  portalButtonLabel: string;
  footerText: string;
  footerSubtext: string;

  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroTimeEstimate: string;
  heroPrivacyBadge: string;
  heroCtaLabel: string;
  heroCtaNote: string;
  heroImageUrl: string;
  heroImageAlt: string;

  compositionEyebrow: string;
  compositionTitle: string;
  compositionImageUrl: string;
  compositionImageAlt: string;
  bowlComponents: BowlComponentCopy[];

  flowEyebrow: string;
  flowTitle: string;
  flowDescription: string;
  surveyOutline: SurveyOutlineCopy[];

  privacyTitle: string;
  privacyDescription: string;
  privacyCtaLabel: string;

  boardingPassEyebrow: string;
  boardingPassTitle: string;
  boardingPassOrigin: string;
  boardingPassDestination: string;
  boardingPassNote: string;
  prevButtonLabel: string;
  nextButtonLabel: string;
  submitButtonLabel: string;
  reviewPrivacyTitle: string;
  reviewPrivacyBody: string;

  steps: Record<string, EditableStepCopy>;
  productItems: Record<string, EditableItemCopy>;
  packagingItems: Record<string, EditableItemCopy>;
  preorderItems: Record<string, EditableItemCopy>;

  questions: {
    hasTastedLabel: string;
    hasTastedDescription: string;
    activityLabel: string;
    hasOrderedLabel: string;
    hasOrderedDescription: string;
    productBannerNote: string;
    pickupTimeLabel: string;
    pickupTimeDescription: string;
    foodConditionOverallLabel: string;
    conditionCassavaLabel: string;
    conditionChickenLabel: string;
    conditionVegetablesLabel: string;
    conditionSauceLabel: string;
    satietyLabel: string;
    priceBannerTitle: string;
    priceBannerAmount: string;
    priceBannerNote: string;
    priceReasonableLabel: string;
    priceWorthItLabel: string;
    purchaseLikelihoodLabel: string;
    purchaseFrequencyLabel: string;
    repurchaseIntentionLabel: string;
    expressionLabel: string;
    expressionDescription: string;
    overallSatisfactionLabel: string;
    recommendScoreLabel: string;
    recommendScoreDescription: string;
    favoriteComponentsLabel: string;
    favoriteComponentsDescription: string;
    feedbackNotesLabel: string;
    feedbackNotesDescription: string;
  };

  customQuestions: CustomMcqQuestion[];

  neverTastedEyebrow: string;
  neverTastedTitle: string;
  neverTastedBody: string;
  neverTastedHomeButtonLabel: string;
  thankYouArrivalBadge: string;
  thankYouTitle: string;
  thankYouBody: string;
  thankYouHomeButtonLabel: string;
}

export const DEFAULT_SITE_CONTENT: SiteContentConfig = {
  brandName: 'MASHRO',
  headerTagline: 'Sajian Sehat Single-Serving',
  navCompositionLabel: 'Komposisi Sajian',
  navFlowLabel: 'Alur Survei',
  navPrivacyLabel: 'Privasi Data',
  surveyTopBarSubtitle: 'Survei Pengalaman Pelanggan',
  adminTopBarSubtitle: 'Portal Manajemen Respons',
  homeButtonLabel: 'Beranda',
  portalButtonLabel: 'Portal Pemilik',
  footerText: 'MASHRO Healthy Meal Bowl · Evaluasi Pengalaman Pelanggan',
  footerSubtext: 'Data dikelola khusus untuk pengembangan produk',

  heroEyebrow: 'Sajian Sehat Single-Serving',
  heroTitle: 'MASHRO – Survei Pengalaman dan Kepuasan Pelanggan',
  heroSubtitle: 'Bantu kami menyempurnakan setiap sajian MASHRO.',
  heroDescription:
    'Survei ini ditujukan khusus bagi Anda yang telah mencicipi semangkuk sajian sehat MASHRO—perpaduan mashed cassava, pan-seared chicken, pumpkin puree sauce, serta buncis dan wortel kukus. Masukan jujur Anda membantu kami menyempurnakan rasa, porsi, kemasan, evaluasi harga Rp. 20.000, dan layanan pre-order.',
  heroTimeEstimate: 'Estimasi waktu: 3–5 menit',
  heroPrivacyBadge: 'Respon anonim untuk evaluasi produk',
  heroCtaLabel: 'Mulai Survei',
  heroCtaNote: 'Tanpa perlu membuat akun atau mengisi nomor telepon.',
  heroImageUrl: '/src/assets/images/mashro_hero_bowl_1795027773941.jpg',
  heroImageAlt:
    'Semangkuk sajian sehat MASHRO berisi mashed cassava, pan-seared chicken, saus labu kuning, buncis dan wortel kukus',

  compositionEyebrow: 'KOMPOSISI SAJIAN MASHRO',
  compositionTitle: 'Empat Komponen Utama dalam Satu Mangkuk Seimbang',
  compositionImageUrl: '/src/assets/images/mashro_botanical_ingredients_1795027774863.jpg',
  compositionImageAlt:
    'Bahan segar alami MASHRO: labu kuning, singkong, buncis, wortel, dan daun sage',
  bowlComponents: [
    {
      name: 'Mashed Cassava',
      detail: 'Singkong pilihan yang ditumbuk halus hingga lembut dan gurih alami.',
    },
    {
      name: 'Pan-Seared Chicken',
      detail: 'Dada ayam panggang bumbu rempah dengan tekstur juicy dan bernutrisi.',
    },
    {
      name: 'Pumpkin Puree Sauce',
      detail: 'Saus labu kuning lembut bercita rasa manis-gurih yang menyeimbangkan sajian.',
    },
    {
      name: 'Steamed Green Beans & Carrots',
      detail: 'Buncis dan wortel kukus segar untuk kerenyahan serta serat harian.',
    },
  ],

  flowEyebrow: 'ALUR PENGISIAN',
  flowTitle: 'Ringkas, Terstruktur, dan Adaptif',
  flowDescription:
    'Pertanyaan menyesuaikan pengalaman Anda—bagian evaluasi pre-order hanya tampil jika Anda pernah memesan langsung.',
  surveyOutline: [
    {
      step: '01',
      title: 'Profil Pengalaman Awal',
      desc: 'Konfirmasi apakah Anda sudah mencicipi MASHRO serta aktivitas harian Anda.',
    },
    {
      step: '02',
      title: 'Rasa, Jam & Ketahanan Sajian',
      desc: 'Penilaian tiap komponen sajian, jam konsumsi, serta kesegaran makanan.',
    },
    {
      step: '03',
      title: 'Harga Rp. 20.000 & Pre-Order',
      desc: 'Evaluasi harga tetap Rp. 20.000 per mangkuk (worth it atau perlu penyesuaian) dan layanan pemesanan.',
    },
  ],

  privacyTitle: 'Pemberitahuan Privasi Responden',
  privacyDescription:
    'Kami tidak meminta nama lengkap, nomor telepon, maupun alamat rumah. Seluruh jawaban disimpan secara anonim khusus untuk evaluasi dan peningkatan kualitas produk MASHRO.',
  privacyCtaLabel: 'Mulai Survei Sekarang',

  boardingPassEyebrow: 'TRANSIT PASS',
  boardingPassTitle: 'Rute Survei Pelanggan',
  boardingPassOrigin: 'PENCICIP',
  boardingPassDestination: 'EVALUASI',
  boardingPassNote: 'Jawaban Anda tersimpan sementara di tiket ini saat berpindah antar stasiun.',
  prevButtonLabel: 'Sebelumnya',
  nextButtonLabel: 'Selanjutnya',
  submitButtonLabel: 'Kirim Survei',
  reviewPrivacyTitle: 'Pemberitahuan Privasi:',
  reviewPrivacyBody:
    'Respon dikumpulkan secara anonim tanpa data pribadi sensitif (tanpa nama lengkap, nomor telepon, atau alamat rumah) semata-mata untuk evaluasi kualitas sajian dan layanan MASHRO.',

  steps: Object.fromEntries(
    Object.values(STEP_DEFINITIONS).map((step) => [
      step.id,
      {
        id: step.id,
        title: step.title,
        shortTitle: step.shortTitle,
        subtitle: step.subtitle,
        stopName: BOARDING_PASS_STATIONS[step.id].stopName,
      },
    ])
  ),

  productItems: Object.fromEntries(
    PRODUCT_EXPERIENCE_ITEMS.map((item) => [
      item.key,
      { key: item.key, label: item.label, description: item.description },
    ])
  ),

  packagingItems: Object.fromEntries(
    PACKAGING_RATING_ITEMS.map((item) => [
      item.key,
      { key: item.key, label: item.label, description: item.description },
    ])
  ),

  preorderItems: Object.fromEntries(
    PREORDER_ITEMS.map((item) => [
      item.key,
      { key: item.key, label: item.label, description: item.description },
    ])
  ),

  questions: {
    hasTastedLabel: 'Apakah Anda sudah pernah mencicipi MASHRO?',
    hasTastedDescription:
      'Survei evaluasi produk hanya dilanjutkan oleh responden yang telah mencicipi sajian MASHRO.',
    activityLabel: 'Aktivitas Anda saat ini',
    hasOrderedLabel: 'Apakah Anda pernah memesan MASHRO secara langsung (Pre-Order)?',
    hasOrderedDescription:
      'Jika pernah memesan, kami akan menanyakan evaluasi singkat mengenai layanan Pre-Order.',
    productBannerNote:
      'Gunakan skala 1 (Sangat Tidak Puas) hingga 5 (Sangat Puas) untuk menilai pengalaman Anda pada setiap aspek sajian MASHRO.',
    pickupTimeLabel: 'Jam berapa Anda mengambil atau mulai mengonsumsi pesanan MASHRO?',
    pickupTimeDescription:
      'Putar atau ketuk angka pada Jam Dinding di bawah untuk menentukan waktu pengambilan/konsumsi.',
    foodConditionOverallLabel:
      'Bagaimana kondisi makanan secara keseluruhan saat dikonsumsi pada jam tersebut?',
    conditionCassavaLabel: 'Bagaimana kondisi Mashed Cassava (Singkong) setelah jam tersebut?',
    conditionChickenLabel: 'Bagaimana kondisi Pan-Seared Chicken (Ayam) setelah jam tersebut?',
    conditionVegetablesLabel:
      'Bagaimana kondisi Sayuran (Buncis & Wortel) setelah jam tersebut?',
    conditionSauceLabel:
      'Bagaimana kondisi Pumpkin Puree Sauce setelah jam tersebut?',
    satietyLabel: 'Bagaimana tingkat rasa kenyang setelah menyantap satu porsi MASHRO?',
    priceBannerTitle: 'INFORMASI HARGA TETAP SAJIAN',
    priceBannerAmount: 'Rp. 20.000 per mangkuk',
    priceBannerNote:
      'Harga resmi sajian MASHRO ditetapkan sebesar Rp. 20.000 per mangkuk. Pendapat Anda membantu kami menilai apakah harga tersebut sudah sepadan dengan kualitas dan porsi yang Anda terima.',
    priceReasonableLabel:
      'Menurut Anda, apakah harga Rp. 20.000 tersebut wajar untuk satu sajian MASHRO?',
    priceWorthItLabel:
      'Dengan harga Rp. 20.000 per mangkuk, bagaimana penilaian Anda terhadap kesepadanan harganya?',
    purchaseLikelihoodLabel:
      'Seberapa besar kemungkinan Anda membeli MASHRO pada harga Rp. 20.000 tersebut?',
    purchaseFrequencyLabel:
      'Jika tersedia secara rutin, seberapa sering Anda berpotensi membeli MASHRO?',
    repurchaseIntentionLabel: 'Apakah Anda berkeinginan untuk membeli MASHRO kembali?',
    expressionLabel: 'Bagaimana ragam ekspresi Anda setelah menikmati sajian MASHRO?',
    expressionDescription:
      'Pilih ikon ekspresi yang paling menggambarkan perasaan dan kesan Anda secara spontan.',
    overallSatisfactionLabel: 'Secara keseluruhan, seberapa puas Anda dengan produk MASHRO?',
    recommendScoreLabel:
      'Seberapa besar kemungkinan Anda merekomendasikan MASHRO kepada teman atau rekan?',
    recommendScoreDescription:
      '0 berarti tidak mungkin sama sekali, 10 berarti sangat mungkin merekomendasikan.',
    favoriteComponentsLabel: 'Komponen produk mana yang paling Anda sukai?',
    favoriteComponentsDescription: 'Anda dapat memilih satu atau beberapa komponen favorit.',
    feedbackNotesLabel:
      'Apa saran atau masukan yang ingin kamu berikan untuk MASHRO? (Opsional)',
    feedbackNotesDescription:
      'Saran terkait rasa, porsi, kemasan, maupun variasi menu sangat kami hargai.',
  },

  customQuestions: [],

  neverTastedEyebrow: 'TERIMA KASIH ATAS KETERTARIKAN ANDA',
  neverTastedTitle: 'Survei Ini Khusus untuk Pelanggan yang Sudah Mencicipi MASHRO',
  neverTastedBody:
    'Karena pertanyaan berikutnya menilai rasa mashed cassava, pan-seared chicken, pumpkin puree sauce, sayuran kukus, serta kemasan sajian MASHRO secara langsung, Anda tidak perlu melanjutkan ke bagian penilaian produk. Kami menantikan kesempatan Anda mencoba MASHRO di waktu mendatang!',
  neverTastedHomeButtonLabel: 'Kembali ke Halaman Awal',
  thankYouArrivalBadge: 'Telah sampai di tujuan akhir, semoga perjalanan Anda menyenangkan',
  thankYouTitle: 'Masukan Anda Telah Tersimpan',
  thankYouBody:
    'Terima kasih telah meluangkan waktu untuk memberikan masukan bagi MASHRO. Setiap pendapatmu membantu kami menjadi lebih baik!',
  thankYouHomeButtonLabel: 'Kembali ke Beranda',
};

const VALID_PLACEMENTS = new Set<CustomQuestionPlacement>([
  'respondent',
  'product',
  'condition',
  'packaging',
  'pricing',
  'overall',
]);

export function sanitizeCustomQuestions(raw: unknown): CustomMcqQuestion[] {
  if (!Array.isArray(raw)) return [];
  const result: CustomMcqQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Partial<CustomMcqQuestion>;
    const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim().slice(0, 64) : '';
    const prompt = typeof obj.prompt === 'string' ? obj.prompt.trim().slice(0, 240) : '';
    if (!id || !prompt) continue;
    const options = Array.isArray(obj.options)
      ? obj.options
          .filter((o): o is string => typeof o === 'string')
          .map((o) => o.trim().slice(0, 120))
          .filter((o) => o.length > 0)
      : [];
    if (options.length < 2) continue;
    const placement: CustomQuestionPlacement =
      typeof obj.placement === 'string' && VALID_PLACEMENTS.has(obj.placement as CustomQuestionPlacement)
        ? (obj.placement as CustomQuestionPlacement)
        : 'overall';
    result.push({
      id,
      prompt,
      description:
        typeof obj.description === 'string' && obj.description.trim()
          ? obj.description.trim().slice(0, 240)
          : undefined,
      options: options.slice(0, 10),
      required: Boolean(obj.required),
      placement,
    });
  }
  return result.slice(0, 20);
}

/**
 * Safely deep-merges partial SiteContentConfig with defaults so missing keys never break UI rendering.
 */
export function mergeSiteContent(partial?: Partial<SiteContentConfig> | null): SiteContentConfig {
  if (!partial) return DEFAULT_SITE_CONTENT;
  const cleanedPartial = { ...(partial as Record<string, unknown>) };
  delete cleanedPartial.thankYouImageUrl;
  const typedPartial = cleanedPartial as Partial<SiteContentConfig>;

  return {
    ...DEFAULT_SITE_CONTENT,
    ...typedPartial,
    bowlComponents:
      Array.isArray(typedPartial.bowlComponents) && typedPartial.bowlComponents.length === 4
        ? typedPartial.bowlComponents.map((c, idx) => ({
            ...DEFAULT_SITE_CONTENT.bowlComponents[idx],
            ...c,
          }))
        : DEFAULT_SITE_CONTENT.bowlComponents,
    surveyOutline:
      Array.isArray(typedPartial.surveyOutline) && typedPartial.surveyOutline.length === 3
        ? typedPartial.surveyOutline.map((o, idx) => ({
            ...DEFAULT_SITE_CONTENT.surveyOutline[idx],
            ...o,
          }))
        : DEFAULT_SITE_CONTENT.surveyOutline,
    steps: {
      ...DEFAULT_SITE_CONTENT.steps,
      ...(typedPartial.steps ?? {}),
    },
    productItems: {
      ...DEFAULT_SITE_CONTENT.productItems,
      ...(typedPartial.productItems ?? {}),
    },
    packagingItems: {
      ...DEFAULT_SITE_CONTENT.packagingItems,
      ...(typedPartial.packagingItems ?? {}),
    },
    preorderItems: {
      ...DEFAULT_SITE_CONTENT.preorderItems,
      ...(typedPartial.preorderItems ?? {}),
    },
    questions: {
      ...DEFAULT_SITE_CONTENT.questions,
      ...(typedPartial.questions ?? {}),
    },
    customQuestions: sanitizeCustomQuestions(typedPartial.customQuestions),
  };
}
