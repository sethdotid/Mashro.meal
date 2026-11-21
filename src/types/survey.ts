export type HasTastedOption = 'Sudah pernah' | 'Belum pernah';
export type ActivityOption = 'Karyawan' | 'Mahasiswa' | 'Dosen/Staf' | 'Lainnya';
export type HasOrderedOption = 'Ya, pernah memesan' | 'Tidak, hanya mencicipi';
export type SatietyOption = 'Tidak mengenyangkan' | 'Cukup mengenyangkan' | 'Sangat mengenyangkan';
export type PriceReasonableOption = 'Sangat wajar' | 'Wajar' | 'Kurang wajar' | 'Tidak wajar';
export type PurchaseFrequencyOption =
  | 'Beberapa kali seminggu'
  | 'Sekali seminggu'
  | '2–3 kali sebulan'
  | 'Sekali sebulan atau lebih jarang'
  | 'Belum berminat';
export type RepurchaseIntentionOption =
  | 'Pasti akan membeli lagi'
  | 'Kemungkinan besar akan membeli lagi'
  | 'Ragu-ragu'
  | 'Kemungkinan tidak membeli lagi';

export type FavoriteComponentOption =
  | 'Mashed Cassava'
  | 'Pan-Seared Chicken'
  | 'Pumpkin Puree Sauce'
  | 'Steamed Green Beans & Carrots'
  | 'Semua komponen';

export type ExpressionMoodOption =
  | 'Sangat Kecewa'
  | 'Kurang Puas'
  | 'Biasa Saja'
  | 'Senang'
  | 'Sangat Senang';

export type FoodConditionOverallOption =
  | 'Masih enak'
  | 'Mulai menurun'
  | 'Sudah tidak enak';

export type ConditionCassavaOption =
  | 'Masih enak'
  | 'Mulai sedikit asam'
  | 'Sudah asam';

export type ConditionChickenOption =
  | 'Masih empuk & enak'
  | 'Sedikit kering'
  | 'Alot';

export type ConditionVegetablesOption =
  | 'Masih segar'
  | 'Agak layu'
  | 'Tidak segar';

export type ConditionSauceOption =
  | 'Masih pas & enak'
  | 'Mulai asin'
  | 'Terlalu asin / berubah rasa';

export interface SurveyDraft {
  hasTasted: HasTastedOption | null;
  activity: ActivityOption | null;
  activityOther: string;
  hasOrdered: HasOrderedOption | null;

  // Section 2: Pengalaman Produk (1-5)
  ratingCassava: number | null;
  ratingChicken: number | null;
  ratingPumpkinSauce: number | null;
  ratingVegetables: number | null;
  ratingAroma: number | null;
  ratingTexture: number | null;
  ratingVisual: number | null;
  ratingFlavorCombo: number | null;

  // Section 3: Waktu Pengambilan & Kondisi Makanan Setelah Dikonsumsi
  pickupTime: string | null; // Format "HH:MM" (24-jam)
  foodConditionOverall: FoodConditionOverallOption | null;
  conditionCassava: ConditionCassavaOption | null;
  conditionChicken: ConditionChickenOption | null;
  conditionVegetables: ConditionVegetablesOption | null;
  conditionSauce: ConditionSauceOption | null;

  // Section 4: Evaluasi Produk dan Kemasan
  ratingPortion: number | null;
  ratingIngredientCombo: number | null;
  satietyLevel: SatietyOption | null;
  ratingPackPracticality: number | null;
  ratingPackStrength: number | null;
  ratingLeakResistance: number | null;
  ratingEaseOfOpening: number | null;
  ratingEatingConvenience: number | null;

  // Section 5: Harga dan Minat Pembelian
  priceReasonable: PriceReasonableOption | null;
  purchaseLikelihood: number | null;
  purchaseFrequency: PurchaseFrequencyOption | null;
  repurchaseIntention: RepurchaseIntentionOption | null;

  // Section 6: Evaluasi Layanan Pre-Order (Conditional)
  preOrderEase: number | null;
  preOrderResponsiveness: number | null;
  preOrderAccuracy: number | null;
  preOrderPunctuality: number | null;

  // Section 7: Kepuasan Keseluruhan
  expressionMood: ExpressionMoodOption | null;
  overallSatisfaction: number | null;
  recommendScore: number | null;
  favoriteComponents: FavoriteComponentOption[];
  feedbackNotes: string;

  // Jawaban Pertanyaan Pilihan Ganda Tambahan dari Pemilik
  customAnswers: Record<string, string>;
}

export interface StoredSurveyResponse {
  id: string;
  createdAtMs: number;
  source: 'web_survey';
  hasTasted: 'Sudah pernah';
  activity: ActivityOption;
  activityOther?: string;
  hasOrdered: HasOrderedOption;
  ratingCassava: number;
  ratingChicken: number;
  ratingPumpkinSauce: number;
  ratingVegetables: number;
  ratingAroma: number;
  ratingTexture: number;
  ratingVisual: number;
  ratingFlavorCombo: number;
  pickupTime?: string;
  foodConditionOverall?: FoodConditionOverallOption;
  conditionCassava?: ConditionCassavaOption;
  conditionChicken?: ConditionChickenOption;
  conditionVegetables?: ConditionVegetablesOption;
  conditionSauce?: ConditionSauceOption;
  ratingPortion: number;
  ratingIngredientCombo: number;
  satietyLevel: SatietyOption;
  ratingPackPracticality: number;
  ratingPackStrength: number;
  ratingLeakResistance: number;
  ratingEaseOfOpening: number;
  ratingEatingConvenience: number;
  priceReasonable: PriceReasonableOption;
  purchaseLikelihood: number;
  purchaseFrequency: PurchaseFrequencyOption;
  repurchaseIntention: RepurchaseIntentionOption;
  preOrderEase?: number;
  preOrderResponsiveness?: number;
  preOrderAccuracy?: number;
  preOrderPunctuality?: number;
  expressionMood?: ExpressionMoodOption;
  overallSatisfaction: number;
  recommendScore: number;
  favoriteComponents: FavoriteComponentOption[];
  feedbackNotes?: string;
  customAnswers?: Record<string, string>;
}

export type SurveyStepId =
  | 'respondent'
  | 'product'
  | 'condition'
  | 'packaging'
  | 'pricing'
  | 'preorder'
  | 'overall'
  | 'review';

export interface SurveyStepMeta {
  id: SurveyStepId;
  numberLabel: string;
  title: string;
  shortTitle: string;
  subtitle: string;
}

export const INITIAL_SURVEY_DRAFT: SurveyDraft = {
  hasTasted: null,
  activity: null,
  activityOther: '',
  hasOrdered: null,
  ratingCassava: null,
  ratingChicken: null,
  ratingPumpkinSauce: null,
  ratingVegetables: null,
  ratingAroma: null,
  ratingTexture: null,
  ratingVisual: null,
  ratingFlavorCombo: null,
  pickupTime: null,
  foodConditionOverall: null,
  conditionCassava: null,
  conditionChicken: null,
  conditionVegetables: null,
  conditionSauce: null,
  ratingPortion: null,
  ratingIngredientCombo: null,
  satietyLevel: null,
  ratingPackPracticality: null,
  ratingPackStrength: null,
  ratingLeakResistance: null,
  ratingEaseOfOpening: null,
  ratingEatingConvenience: null,
  priceReasonable: null,
  purchaseLikelihood: null,
  purchaseFrequency: null,
  repurchaseIntention: null,
  preOrderEase: null,
  preOrderResponsiveness: null,
  preOrderAccuracy: null,
  preOrderPunctuality: null,
  expressionMood: null,
  overallSatisfaction: null,
  recommendScore: null,
  favoriteComponents: [],
  feedbackNotes: '',
  customAnswers: {},
};

export const FOOD_CONDITION_OVERALL_OPTIONS: {
  value: FoodConditionOverallOption;
  label: string;
  detail: string;
}[] = [
  { value: 'Masih enak', label: 'Masih enak', detail: 'Cita rasa dan kesegaran sajian tetap terjaga' },
  { value: 'Mulai menurun', label: 'Mulai menurun', detail: 'Sedikit berkurang dari kondisi hangat awal' },
  { value: 'Sudah tidak enak', label: 'Sudah tidak enak', detail: 'Rasa atau kualitas berubah signifikan' },
];

export const CONDITION_CASSAVA_OPTIONS: {
  value: ConditionCassavaOption;
  label: string;
  detail: string;
}[] = [
  { value: 'Masih enak', label: 'Masih enak', detail: 'Lembut, gurih alami, dan tidak asam' },
  { value: 'Mulai sedikit asam', label: 'Mulai sedikit asam', detail: 'Terasa sedikit perubahan rasa asam ringan' },
  { value: 'Sudah asam', label: 'Sudah asam', detail: 'Singkong sudah terasa asam atau kurang layak santap' },
];

export const CONDITION_CHICKEN_OPTIONS: {
  value: ConditionChickenOption;
  label: string;
  detail: string;
}[] = [
  { value: 'Masih empuk & enak', label: 'Masih empuk & enak', detail: 'Daging ayam tetap juicy dan mudah dikunyah' },
  { value: 'Sedikit kering', label: 'Sedikit kering', detail: 'Tekstur agak kering namun masih nyaman disantap' },
  { value: 'Alot', label: 'Alot', detail: 'Daging ayam menjadi keras atau alot saat dikunyah' },
];

export const CONDITION_VEGETABLES_OPTIONS: {
  value: ConditionVegetablesOption;
  label: string;
  detail: string;
}[] = [
  { value: 'Masih segar', label: 'Masih segar', detail: 'Warna buncis & wortel cerah dan masih renyah' },
  { value: 'Agak layu', label: 'Agak layu', detail: 'Mulai melunak namun masih layak dikonsumsi' },
  { value: 'Tidak segar', label: 'Tidak segar', detail: 'Sayuran layu, berair, atau berubah aroma' },
];

export const CONDITION_SAUCE_OPTIONS: {
  value: ConditionSauceOption;
  label: string;
  detail: string;
}[] = [
  { value: 'Masih pas & enak', label: 'Masih pas & enak', detail: 'Saus labu lembut dengan manis-gurih seimbang' },
  { value: 'Mulai asin', label: 'Mulai asin', detail: 'Saus terasa mulai asin atau mengental' },
  { value: 'Terlalu asin / berubah rasa', label: 'Terlalu asin / berubah rasa', detail: 'Rasa asin berlebihan atau konsistensi pecah' },
];

export const EXPRESSION_MOOD_OPTIONS: {
  value: ExpressionMoodOption;
  label: string;
  detail: string;
  level: 1 | 2 | 3 | 4 | 5;
}[] = [
  {
    value: 'Sangat Kecewa',
    label: 'Sangat Kecewa',
    detail: 'Jauh di bawah ekspektasi',
    level: 1,
  },
  {
    value: 'Kurang Puas',
    label: 'Kurang Puas',
    detail: 'Masih ada yang perlu dibenahi',
    level: 2,
  },
  {
    value: 'Biasa Saja',
    label: 'Biasa Saja',
    detail: 'Cukup standar dan netral',
    level: 3,
  },
  {
    value: 'Senang',
    label: 'Senang',
    detail: 'Sajian terasa memuaskan',
    level: 4,
  },
  {
    value: 'Sangat Senang',
    label: 'Sangat Senang',
    detail: 'Pengalaman luar biasa nikmat',
    level: 5,
  },
];

export const ACTIVITY_OPTIONS: ActivityOption[] = [
  'Karyawan',
  'Mahasiswa',
  'Dosen/Staf',
  'Lainnya',
];

export const SATIETY_OPTIONS: SatietyOption[] = [
  'Tidak mengenyangkan',
  'Cukup mengenyangkan',
  'Sangat mengenyangkan',
];

export const PRICE_REASONABLE_OPTIONS: PriceReasonableOption[] = [
  'Sangat wajar',
  'Wajar',
  'Kurang wajar',
  'Tidak wajar',
];

export const PURCHASE_FREQUENCY_OPTIONS: PurchaseFrequencyOption[] = [
  'Beberapa kali seminggu',
  'Sekali seminggu',
  '2–3 kali sebulan',
  'Sekali sebulan atau lebih jarang',
  'Belum berminat',
];

export const REPURCHASE_INTENTION_OPTIONS: RepurchaseIntentionOption[] = [
  'Pasti akan membeli lagi',
  'Kemungkinan besar akan membeli lagi',
  'Ragu-ragu',
  'Kemungkinan tidak membeli lagi',
];

export const FAVORITE_COMPONENT_OPTIONS: { value: FavoriteComponentOption; label: string; detail: string }[] = [
  {
    value: 'Mashed Cassava',
    label: 'Mashed Cassava',
    detail: 'Singkong tumbuk lembut bergizi',
  },
  {
    value: 'Pan-Seared Chicken',
    label: 'Pan-Seared Chicken',
    detail: 'Ayam panggang bumbu rempah',
  },
  {
    value: 'Pumpkin Puree Sauce',
    label: 'Pumpkin Puree Sauce',
    detail: 'Saus labu kuning lembut',
  },
  {
    value: 'Steamed Green Beans & Carrots',
    label: 'Steamed Green Beans & Carrots',
    detail: 'Buncis dan wortel kukus segar',
  },
  {
    value: 'Semua komponen',
    label: 'Semua komponen',
    detail: 'Perpaduan keseluruhan sajian dalam satu mangkuk',
  },
];

export const PRODUCT_EXPERIENCE_ITEMS: {
  key: keyof Pick<
    SurveyDraft,
    | 'ratingCassava'
    | 'ratingChicken'
    | 'ratingPumpkinSauce'
    | 'ratingVegetables'
    | 'ratingAroma'
    | 'ratingTexture'
    | 'ratingVisual'
    | 'ratingFlavorCombo'
  >;
  label: string;
  description: string;
}[] = [
  {
    key: 'ratingCassava',
    label: 'Rasa Mashed Cassava',
    description: 'Kelezatan, tingkat gurih, dan kelembutan singkong tumbuk.',
  },
  {
    key: 'ratingChicken',
    label: 'Rasa Pan-Seared Chicken',
    description: 'Cita rasa bumbu, kematangan, dan keempukan daging ayam.',
  },
  {
    key: 'ratingPumpkinSauce',
    label: 'Rasa Pumpkin Puree Sauce',
    description: 'Keseimbangan rasa manis-gurih dan kekayaan rasa saus labu kuning.',
  },
  {
    key: 'ratingVegetables',
    label: 'Rasa Sayuran (Buncis & Wortel Kukus)',
    description: 'Kesegaran serta rasa alami buncis dan wortel kukus.',
  },
  {
    key: 'ratingAroma',
    label: 'Aroma Sajian',
    description: 'Keharuman sajian secara keseluruhan saat pertama kali dibuka.',
  },
  {
    key: 'ratingTexture',
    label: 'Tekstur Makanan',
    description: 'Perpaduan tekstur lembut mashed cassava, juicy ayam, dan renyah sayuran.',
  },
  {
    key: 'ratingVisual',
    label: 'Tampilan Visual Sajian',
    description: 'Penataan warna dan daya tarik visual makanan dalam mangkuk.',
  },
  {
    key: 'ratingFlavorCombo',
    label: 'Perpaduan Rasa Keseluruhan',
    description: 'Harmoni seluruh komponen saat disantap bersama.',
  },
];

export const PACKAGING_RATING_ITEMS: {
  key: keyof Pick<
    SurveyDraft,
    | 'ratingPortion'
    | 'ratingIngredientCombo'
    | 'ratingPackPracticality'
    | 'ratingPackStrength'
    | 'ratingLeakResistance'
    | 'ratingEaseOfOpening'
    | 'ratingEatingConvenience'
  >;
  label: string;
  description: string;
  group: 'product' | 'packaging';
}[] = [
  {
    key: 'ratingPortion',
    label: 'Ukuran Porsi Sajian',
    description: 'Kesesuaian porsi satu mangkuk untuk kebutuhan makan Anda.',
    group: 'product',
  },
  {
    key: 'ratingIngredientCombo',
    label: 'Komposisi Bahan dalam Mangkuk',
    description: 'Proporsi antara karbohidrat, protein, saus, dan sayuran.',
    group: 'product',
  },
  {
    key: 'ratingPackPracticality',
    label: 'Kepraktisan Kemasan',
    description: 'Kemudahan dibawa maupun disimpan sebelum disantap.',
    group: 'packaging',
  },
  {
    key: 'ratingPackStrength',
    label: 'Kekuatan & Ketahanan Kemasan',
    description: 'Kekokohan wadah saat digenggam dan membawa makanan hangat.',
    group: 'packaging',
  },
  {
    key: 'ratingLeakResistance',
    label: 'Ketahanan Terhadap Kebocoran',
    description: 'Keamanan penutup dan wadah agar saus tidak tumpah.',
    group: 'packaging',
  },
  {
    key: 'ratingEaseOfOpening',
    label: 'Kemudahan Membuka Kemasan',
    description: 'Kemudahan melepas tutup atau segel tanpa tumpah.',
    group: 'packaging',
  },
  {
    key: 'ratingEatingConvenience',
    label: 'Kenyamanan Saat Menyantap',
    description: 'Kenyamanan makan langsung dari mangkuk kemasan MASHRO.',
    group: 'packaging',
  },
];

export const PREORDER_ITEMS: {
  key: keyof Pick<
    SurveyDraft,
    | 'preOrderEase'
    | 'preOrderResponsiveness'
    | 'preOrderAccuracy'
    | 'preOrderPunctuality'
  >;
  label: string;
  description: string;
}[] = [
  {
    key: 'preOrderEase',
    label: 'Kemudahan Proses Pemesanan',
    description: 'Kejelasan alur pemesanan dan kemudahan mengisi detail pesanan.',
  },
  {
    key: 'preOrderResponsiveness',
    label: 'Kecepatan Respons Penjual',
    description: 'Kecepatan dan keramahan tim MASHRO dalam merespons pesan.',
  },
  {
    key: 'preOrderAccuracy',
    label: 'Ketepatan & Kesesuaian Pesanan',
    description: 'Kelengkapan serta kesesuaian item yang diterima dengan pesanan.',
  },
  {
    key: 'preOrderPunctuality',
    label: 'Ketepatan Waktu Pengambilan / Pengantaran',
    description: 'Kesesuaian jadwal pengambilan atau pengiriman dengan waktu yang dijanjikan.',
  },
];

export const STEP_DEFINITIONS: Record<SurveyStepId, Omit<SurveyStepMeta, 'numberLabel'>> = {
  respondent: {
    id: 'respondent',
    title: 'Tentang Responden',
    shortTitle: 'Profil',
    subtitle: 'Informasi singkat mengenai pengalaman awal dan aktivitas Anda.',
  },
  product: {
    id: 'product',
    title: 'Pengalaman Produk',
    shortTitle: 'Rasa & Visual',
    subtitle: 'Nilai cita rasa setiap komponen, aroma, tekstur, dan tampilan sajian MASHRO.',
  },
  condition: {
    id: 'condition',
    title: 'Jam Konsumsi & Kondisi Sajian',
    shortTitle: 'Jam & Kesegaran',
    subtitle: 'Atur jam pengambilan/konsumsi pada jam dinding dan nilai ketahanan tiap komponen.',
  },
  packaging: {
    id: 'packaging',
    title: 'Evaluasi Produk & Kemasan',
    shortTitle: 'Porsi & Kemasan',
    subtitle: 'Bantu kami menilai porsi, rasa kenyang, serta fungsionalitas kemasan.',
  },
  pricing: {
    id: 'pricing',
    title: 'Harga & Minat Pembelian',
    shortTitle: 'Harga & Minat',
    subtitle: 'Evaluasi kisaran harga usulan Rp20.000–Rp25.000 dan minat pembelian Anda.',
  },
  preorder: {
    id: 'preorder',
    title: 'Evaluasi Layanan Pre-Order',
    shortTitle: 'Pre-Order',
    subtitle: 'Penilaian terhadap proses pemesanan dan pengiriman MASHRO.',
  },
  overall: {
    id: 'overall',
    title: 'Kepuasan Keseluruhan',
    shortTitle: 'Kepuasan Akhir',
    subtitle: 'Kesan akhir, rekomendasi, komponen favorit, dan saran Anda untuk MASHRO.',
  },
  review: {
    id: 'review',
    title: 'Tinjauan & Kirim Survei',
    shortTitle: 'Tinjauan',
    subtitle: 'Periksa kembali jawaban Anda sebelum mengirim masukan.',
  },
};

export interface BoardingStationMeta {
  stationCode: string;
  stopName: string;
  gateTag: string;
}

export const BOARDING_PASS_STATIONS: Record<SurveyStepId, BoardingStationMeta> = {
  respondent: {
    stationCode: 'ST-01',
    stopName: 'Peron Awal',
    gateTag: 'Validasi Pengalaman',
  },
  product: {
    stationCode: 'ST-02',
    stopName: 'Paviliun Rasa',
    gateTag: 'Rasa · Aroma · Tekstur',
  },
  condition: {
    stationCode: 'ST-03',
    stopName: 'Menara Jam & Segar',
    gateTag: 'Jam Dinding & Ketahanan',
  },
  packaging: {
    stationCode: 'ST-04',
    stopName: 'Bengkel Kemasan',
    gateTag: 'Porsi & Ketahanan Wadah',
  },
  pricing: {
    stationCode: 'ST-05',
    stopName: 'Loket Nilai',
    gateTag: 'Harga & Minat Kembali',
  },
  preorder: {
    stationCode: 'ST-06',
    stopName: 'Jalur Pesan',
    gateTag: 'Layanan Pre-Order',
  },
  overall: {
    stationCode: 'ST-07',
    stopName: 'Observatorium Langit',
    gateTag: 'Kepuasan & Rekomendasi',
  },
  review: {
    stationCode: 'ST-08',
    stopName: 'Gerbang Akhir',
    gateTag: 'Periksa & Kirim Tiket',
  },
};
