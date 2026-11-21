import { CustomMcqQuestion } from '../types/siteConfig';
import { StoredSurveyResponse } from '../types/survey';
import { DashboardAnalytics } from './surveyLogic';

// Precompute standard IEEE 802.3 CRC-32 lookup table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntryInput {
  name: string;
  content: string;
}

/**
 * Packages UTF-8 XML entries into a valid uncompressed (STORE) PKZIP container (.xlsx).
 */
export function buildZipBytes(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    const crc = crc32(dataBytes);

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression method: 0 (STORE)
    lv.setUint16(10, 0, true); // File last mod time
    lv.setUint16(12, 0x5421, true); // File last mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // Compression: STORE
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const part of centralParts) centralDirSize += part.length;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true);

  const totalSize = centralDirOffset + centralDirSize + eocd.length;
  const result = new Uint8Array(new ArrayBuffer(totalSize));
  let cursor = 0;
  for (const p of localParts) {
    result.set(p, cursor);
    cursor += p.length;
  }
  for (const p of centralParts) {
    result.set(p, cursor);
    cursor += p.length;
  }
  result.set(eocd, cursor);
  return result;
}

function escapeXml(value: string): string {
  // Strip invalid XML 1.0 control characters while preserving tabs/newlines
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colIndexToLetter(colIdxZeroBased: number): string {
  let n = colIdxZeroBased + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

type CellValue = string | number | null | undefined;

function buildWorksheetXml(rows: CellValue[][], colWidths?: number[]): string {
  const colsXml =
    colWidths && colWidths.length > 0
      ? `<cols>${colWidths
          .map(
            (w, idx) =>
              `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`
          )
          .join('')}</cols>`
      : '';

  const rowsXml = rows
    .map((row, rIdx) => {
      const rowNum = rIdx + 1;
      const isHeader = rIdx === 0;
      const styleAttr = isHeader ? ' s="1"' : '';
      const cellsXml = row
        .map((val, cIdx) => {
          const ref = `${colIndexToLetter(cIdx)}${rowNum}`;
          if (typeof val === 'number' && Number.isFinite(val)) {
            return `<c r="${ref}"${styleAttr}><v>${val}</v></c>`;
          }
          const strVal = val === null || val === undefined ? '' : String(val);
          return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${escapeXml(strVal)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNum}">${cellsXml}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

/**
 * Builds a genuine multi-sheet Excel (.xlsx) workbook buffer from MASHRO survey responses.
 */
export function buildExcelWorkbookBytes(
  responses: StoredSurveyResponse[],
  stats: DashboardAnalytics,
  customQuestions: CustomMcqQuestion[] = []
): Uint8Array {
  // Sheet 1: Ringkasan & Tren
  const summaryRows: CellValue[][] = [
    ['Metrik Evaluasi MASHRO', 'Nilai', 'Keterangan'],
    ['Total Respons Asli', stats.totalResponses, 'Jumlah responden terkumpul'],
    ['Responden via Pre-Order', stats.preOrderCount, 'Pernah memesan langsung'],
    ['Rata-rata Kepuasan Total (1–5)', stats.avgOverallSatisfaction ?? '-', 'Skala kepuasan 1.0 – 5.0'],
    ['Rata-rata Skor Rekomendasi (0–10)', stats.avgRecommendScore ?? '-', 'Skala rekomendasi 0.0 – 10.0'],
    ['NPS Bersih', stats.npsNetScore ?? '-', 'Promotor minus Detraktor (%)'],
    ['Penerimaan Harga (Rp. 20.000)', `${stats.priceAcceptancePct ?? 0}%`, 'Wajar / Sangat wajar'],
    ['Menilai Harga Rp. 20.000 Worth It', `${stats.priceWorthItPct ?? 0}%`, 'Sepadan dengan kualitas & porsi'],
    ['Minat Beli Ulang Positif', `${stats.positiveRepurchasePct ?? 0}%`, 'Pasti / Kemungkinan besar'],
    ['', '', ''],
    ['Atribut Penilaian', 'Rata-rata (1–5)', 'Jumlah Penilai (n)'],
    ...stats.attributeAverages.map((attr) => [attr.label, attr.average, attr.count]),
  ];

  // Sheet 2: Data Lengkap Respons Pelanggan
  const baseHeaders: CellValue[] = [
    'ID Respons',
    'Waktu Kirim',
    'Aktivitas',
    'Aktivitas Lainnya',
    'Pernah Pre-Order',
    'Rasa Mashed Cassava',
    'Rasa Pan-Seared Chicken',
    'Rasa Pumpkin Puree Sauce',
    'Rasa Sayuran',
    'Aroma',
    'Tekstur',
    'Tampilan Visual',
    'Perpaduan Rasa',
    'Jam Konsumsi (WIB)',
    'Kondisi Umum',
    'Kondisi Singkong',
    'Kondisi Ayam',
    'Kondisi Sayuran',
    'Kondisi Saus Labu',
    'Ukuran Porsi',
    'Komposisi Bahan',
    'Tingkat Kenyang',
    'Kepraktisan Kemasan',
    'Kekuatan Kemasan',
    'Ketahanan Bocor',
    'Kemudahan Buka',
    'Kenyamanan Makan',
    'Kewajaran Harga (Rp. 20.000)',
    'Nilai Harga Rp. 20.000 (Worth It)',
    'Minat Beli (1-5)',
    'Frekuensi Pembelian',
    'Minat Beli Ulang',
    'PO: Kemudahan',
    'PO: Respons Penjual',
    'PO: Ketepatan Pesanan',
    'PO: Ketepatan Waktu',
    'Ragam Ekspresi',
    'Kepuasan Total (1-5)',
    'Skor Rekomendasi (0-10)',
    'Komponen Favorit',
    'Saran & Masukan',
    ...customQuestions.map((cq) => cq.prompt),
  ];

  const responseRows: CellValue[][] = [
    baseHeaders,
    ...responses.map((r) => [
      r.id,
      new Date(r.createdAtMs).toLocaleString('id-ID'),
      r.activity,
      r.activityOther ?? '',
      r.hasOrdered,
      r.ratingCassava,
      r.ratingChicken,
      r.ratingPumpkinSauce,
      r.ratingVegetables,
      r.ratingAroma,
      r.ratingTexture,
      r.ratingVisual,
      r.ratingFlavorCombo,
      r.pickupTime ?? '',
      r.foodConditionOverall ?? '',
      r.conditionCassava ?? '',
      r.conditionChicken ?? '',
      r.conditionVegetables ?? '',
      r.conditionSauce ?? '',
      r.ratingPortion,
      r.ratingIngredientCombo,
      r.satietyLevel,
      r.ratingPackPracticality,
      r.ratingPackStrength,
      r.ratingLeakResistance,
      r.ratingEaseOfOpening,
      r.ratingEatingConvenience,
      r.priceReasonable,
      r.priceWorthIt ?? '',
      r.purchaseLikelihood,
      r.purchaseFrequency,
      r.repurchaseIntention,
      r.preOrderEase ?? '',
      r.preOrderResponsiveness ?? '',
      r.preOrderAccuracy ?? '',
      r.preOrderPunctuality ?? '',
      r.expressionMood ?? '',
      r.overallSatisfaction,
      r.recommendScore,
      r.favoriteComponents.join('; '),
      r.feedbackNotes ?? '',
      ...customQuestions.map((cq) => r.customAnswers?.[cq.id] ?? ''),
    ]),
  ];

  // Sheet 3: Ketahanan & Tren Harian
  const trendRows: CellValue[][] = [
    ['Tanggal', 'Jumlah Respons', 'Rata-rata Kepuasan', 'Rata-rata Rekomendasi', 'Makanan Masih Enak (%)'],
    ...stats.dailyTrend.map((d) => [
      d.label,
      d.count,
      d.avgSatisfaction,
      d.avgRecommend,
      d.freshPct,
    ]),
    ['', '', '', '', ''],
    ['Periode Jam Konsumsi', 'Jumlah Respons', 'Makanan Masih Enak (%)', 'Rata-rata Kepuasan', ''],
    ...stats.pickupPeriodTrend.map((p) => [
      p.periodLabel,
      p.count,
      p.freshPct,
      p.avgSatisfaction,
      '',
    ]),
  ];

  const sheet1Xml = buildWorksheetXml(summaryRows, [36, 18, 34]);
  const sheet2Xml = buildWorksheetXml(
    responseRows,
    baseHeaders.map((_, idx) => (idx === 40 ? 36 : idx === 1 ? 22 : 18))
  );
  const sheet3Xml = buildWorksheetXml(trendRows, [24, 18, 22, 24, 24]);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Ringkasan Metrik" sheetId="1" r:id="rId1"/>
    <sheet name="Data Respons" sheetId="2" r:id="rId2"/>
    <sheet name="Tren &amp; Jam Sajian" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Style s="0" normal, s="1" bold white text on MASHRO forest green header (#173E2C)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFF7F1E3"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF173E2C"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

  return buildZipBytes([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
    { name: 'xl/worksheets/sheet2.xml', content: sheet2Xml },
    { name: 'xl/worksheets/sheet3.xml', content: sheet3Xml },
  ]);
}
