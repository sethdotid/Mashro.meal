import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardAnalytics } from '../utils/surveyLogic';

type BarMetricMode = 'pilar' | 'layanan' | 'produk';
type PieMetricMode =
  | 'harga'
  | 'nilai_harga'
  | 'kondisi'
  | 'ekspresi'
  | 'kepuasan'
  | 'beli_ulang'
  | 'aktivitas';
type TrendChartMode = 'skor' | 'volume';

const MASHRO_CHART_COLORS = ['#173E2C', '#3A6B52', '#D6A23A', '#8AA67A', '#B7C9A2'];

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  dataKey?: string;
  payload?: {
    label?: string;
    average?: number;
    count?: number;
    percentage?: number;
    avgSatisfaction?: number;
    avgRecommend?: number;
    freshPct?: number;
    periodLabel?: string;
  };
}

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-[#FCF9F2] border border-[#173E2C]/20 rounded-xl px-3.5 py-2.5 shadow-md text-xs text-[#173E2C]">
      <p className="font-semibold mb-1">{item.label}</p>
      <p className="font-mono tabular-nums">
        Rata-rata: <strong>{Number(item.average ?? 0).toFixed(1)}</strong> / 5.0
      </p>
      {typeof item.count === 'number' && (
        <p className="text-[#173E2C]/65 font-mono tabular-nums">Responden: n={item.count}</p>
      )}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-[#FCF9F2] border border-[#173E2C]/20 rounded-xl px-3.5 py-2.5 shadow-md text-xs text-[#173E2C]">
      <p className="font-semibold mb-1">{item.label}</p>
      <p className="font-mono tabular-nums">
        {item.count ?? 0} respons ({item.percentage ?? 0}%)
      </p>
    </div>
  );
}

function DailyTrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-[#FCF9F2] border border-[#173E2C]/20 rounded-xl px-3.5 py-2.5 shadow-md text-xs text-[#173E2C] space-y-0.5">
      <p className="font-semibold mb-1">{item.label}</p>
      <p className="font-mono tabular-nums">
        Jumlah respons: <strong>{item.count ?? 0}</strong>
      </p>
      <p className="font-mono tabular-nums">
        Kepuasan total: <strong>{Number(item.avgSatisfaction ?? 0).toFixed(1)}</strong> / 5.0
      </p>
      <p className="font-mono tabular-nums">
        Skor rekomendasi: <strong>{Number(item.avgRecommend ?? 0).toFixed(1)}</strong> / 10
      </p>
      <p className="font-mono tabular-nums">
        Sajian masih enak: <strong>{item.freshPct ?? 0}%</strong>
      </p>
    </div>
  );
}

function PickupTrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-[#FCF9F2] border border-[#173E2C]/20 rounded-xl px-3.5 py-2.5 shadow-md text-xs text-[#173E2C] space-y-0.5">
      <p className="font-semibold mb-1">{item.periodLabel}</p>
      <p className="font-mono tabular-nums">
        Responden pada jam ini: <strong>{item.count ?? 0}</strong>
      </p>
      <p className="font-mono tabular-nums">
        Kondisi masih enak: <strong>{item.freshPct ?? 0}%</strong>
      </p>
      <p className="font-mono tabular-nums">
        Kepuasan rata-rata: <strong>{Number(item.avgSatisfaction ?? 0).toFixed(1)}</strong> / 5.0
      </p>
    </div>
  );
}

export function DashboardSummaryCharts({ stats }: { stats: DashboardAnalytics }) {
  const [barMode, setBarMode] = useState<BarMetricMode>('pilar');
  const [pieMode, setPieMode] = useState<PieMetricMode>('harga');
  const [trendMode, setTrendMode] = useState<TrendChartMode>('skor');

  const barData = useMemo(() => {
    if (barMode === 'pilar') {
      return stats.categoryAverages.map((c) => ({
        label: c.label,
        average: c.average,
        count: c.count,
      }));
    }
    if (barMode === 'layanan') {
      return stats.attributeAverages
        .filter((a) => a.category === 'Layanan Pre-Order')
        .map((a) => ({
          label: a.label
            .replace('Kecepatan Respons Penjual', 'Respons Penjual')
            .replace('Kemudahan Pemesanan', 'Kemudahan Pesan'),
          average: a.average,
          count: a.count,
        }));
    }
    return stats.attributeAverages
      .filter((a) => a.category === 'Produk')
      .map((a) => ({
        label: a.label
          .replace('Rasa ', '')
          .replace('Perpaduan Rasa Keseluruhan', 'Perpaduan Rasa'),
        average: a.average,
        count: a.count,
      }));
  }, [barMode, stats]);

  const pieData = useMemo(() => {
    const source =
      pieMode === 'ekspresi'
        ? stats.expressionDistribution
        : pieMode === 'harga'
        ? stats.priceDistribution
        : pieMode === 'nilai_harga'
        ? stats.priceWorthItDistribution
        : pieMode === 'kondisi'
        ? stats.foodConditionOverallDistribution
        : pieMode === 'kepuasan'
        ? stats.overallSatisfactionDistribution
        : pieMode === 'beli_ulang'
        ? stats.repurchaseDistribution
        : stats.activityDistribution;
    return source.filter((item) => item.count > 0);
  }, [pieMode, stats]);

  return (
    <div className="space-y-6">
      {/* Row 1: Bar Chart + Donut Chart */}
      <section
        aria-label="Ringkasan Visual Metrik Utama"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Bar Chart Card (7 cols) */}
        <div className="lg:col-span-7 bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-1">
                GRAFIK BATANG METRIK UTAMA
              </p>
              <h2 className="font-editorial text-2xl font-semibold text-[#173E2C]">
                Skor Kualitas Produk & Layanan
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Pilih kelompok metrik grafik batang"
              className="flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-[#F7F1E3] rounded-xl border border-[#173E2C]/10 shrink-0"
            >
              {(
                [
                  { id: 'pilar', label: 'Pilar Utama' },
                  { id: 'layanan', label: 'Kualitas Layanan' },
                  { id: 'produk', label: 'Produk' },
                ] as { id: BarMetricMode; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={barMode === tab.id}
                  onClick={() => setBarMode(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    barMode === tab.id
                      ? 'bg-[#173E2C] text-[#F7F1E3]'
                      : 'text-[#173E2C]/75 hover:text-[#173E2C]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {barData.length === 0 ? (
            <div className="flex-1 min-h-[260px] flex items-center justify-center text-center px-4 text-sm text-[#173E2C]/65 bg-white/60 rounded-2xl border border-[#173E2C]/10">
              Belum ada responden yang menilai layanan Pre-Order pada kategori ini.
            </div>
          ) : (
            <div className="w-full h-[280px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(23, 62, 44, 0.1)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#173E2C', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(23, 62, 44, 0.2)' }}
                    tickLine={false}
                    interval={0}
                    angle={barData.length > 5 ? -18 : 0}
                    textAnchor={barData.length > 5 ? 'end' : 'middle'}
                    height={barData.length > 5 ? 56 : 32}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    tick={{ fill: '#173E2C', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(201, 216, 181, 0.25)' }} />
                  <Bar dataKey="average" radius={[8, 8, 0, 0]} maxBarSize={52} isAnimationActive={false}>
                    {barData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={idx % 3 === 2 ? '#D6A23A' : idx % 2 === 1 ? '#3A6B52' : '#173E2C'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Pie / Donut Chart Card (5 cols) */}
        <div className="lg:col-span-5 bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 flex flex-col">
          <div className="mb-4">
            <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-1">
              DIAGRAM LINGKARAN DISTRIBUSI
            </p>
            <h2 className="font-editorial text-2xl font-semibold text-[#173E2C] mb-3">
              Proporsi Responden
            </h2>

            <div
              role="tablist"
              aria-label="Pilih distribusi diagram lingkaran"
              className="flex flex-wrap items-center gap-1 p-1 bg-[#F7F1E3] rounded-xl border border-[#173E2C]/10"
            >
              {(
                [
                  { id: 'harga', label: 'Harga' },
                  { id: 'nilai_harga', label: 'Worth It (Rp20rb)' },
                  { id: 'kondisi', label: 'Kondisi Sajian' },
                  { id: 'ekspresi', label: 'Ekspresi' },
                  { id: 'kepuasan', label: 'Kepuasan' },
                  { id: 'beli_ulang', label: 'Beli Ulang' },
                  { id: 'aktivitas', label: 'Aktivitas' },
                ] as { id: PieMetricMode; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={pieMode === tab.id}
                  onClick={() => setPieMode(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    pieMode === tab.id
                      ? 'bg-[#173E2C] text-[#F7F1E3]'
                      : 'text-[#173E2C]/75 hover:text-[#173E2C]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full h-[200px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={pieData.length > 1 ? 3 : 0}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {pieData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={MASHRO_CHART_COLORS[idx % MASHRO_CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Clean Tabular Legend */}
          <ul className="mt-3 pt-3 border-t border-[#173E2C]/10 space-y-1.5 text-xs">
            {pieData.map((entry, idx) => (
              <li key={entry.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{
                      backgroundColor: MASHRO_CHART_COLORS[idx % MASHRO_CHART_COLORS.length],
                    }}
                  />
                  <span className="text-[#173E2C]/85 truncate">{entry.label}</span>
                </span>
                <span className="font-mono font-semibold text-[#173E2C] tabular-nums shrink-0">
                  {entry.count} ({entry.percentage}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Row 2: Daily Trend Chart + Pickup-Hour Freshness Trend Chart */}
      <section
        aria-label="Grafik Tren Waktu dan Jam Konsumsi"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Card 1: Daily Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-1">
                GRAFIK TREN HARIAN
              </p>
              <h2 className="font-editorial text-2xl font-semibold text-[#173E2C]">
                Perkembangan Survei per Hari
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Pilih metrik grafik tren harian"
              className="flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-[#F7F1E3] rounded-xl border border-[#173E2C]/10 shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={trendMode === 'skor'}
                onClick={() => setTrendMode('skor')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  trendMode === 'skor'
                    ? 'bg-[#173E2C] text-[#F7F1E3]'
                    : 'text-[#173E2C]/75 hover:text-[#173E2C]'
                }`}
              >
                Kepuasan & Rekomendasi
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={trendMode === 'volume'}
                onClick={() => setTrendMode('volume')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  trendMode === 'volume'
                    ? 'bg-[#173E2C] text-[#F7F1E3]'
                    : 'text-[#173E2C]/75 hover:text-[#173E2C]'
                }`}
              >
                Volume & Kesegaran
              </button>
            </div>
          </div>

          <div className="w-full h-[240px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              {trendMode === 'skor' ? (
                <AreaChart
                  data={stats.dailyTrend}
                  margin={{ top: 10, right: 12, left: -16, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(23, 62, 44, 0.1)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#173E2C', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(23, 62, 44, 0.2)' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fill: '#173E2C', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    tick={{ fill: '#D96B27', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DailyTrendTooltip />} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgSatisfaction"
                    name="Kepuasan Total (1–5)"
                    stroke="#173E2C"
                    strokeWidth={2.5}
                    fill="#C9D8B5"
                    fillOpacity={0.35}
                    dot={{ r: 5, fill: '#173E2C', stroke: '#FCF9F2', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgRecommend"
                    name="Rekomendasi (0–10)"
                    stroke="#D96B27"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#D96B27', stroke: '#FCF9F2', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <ComposedChart
                  data={stats.dailyTrend}
                  margin={{ top: 10, right: 12, left: -16, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(23, 62, 44, 0.1)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#173E2C', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(23, 62, 44, 0.2)' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    tick={{ fill: '#173E2C', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fill: '#D96B27', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DailyTrendTooltip />} />
                  <Bar
                    yAxisId="left"
                    dataKey="count"
                    name="Jumlah Respons"
                    fill="#173E2C"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="freshPct"
                    name="Masih Enak (%)"
                    stroke="#D6A23A"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#D6A23A', stroke: '#173E2C', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-[#173E2C]/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#173E2C]/75">
            <div className="flex flex-wrap items-center gap-4">
              {trendMode === 'skor' ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#173E2C]" aria-hidden="true" />
                    <span>Kepuasan Total (kiri · 1–5)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D96B27]" aria-hidden="true" />
                    <span>Skor Rekomendasi (kanan · 0–10)</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#173E2C]" aria-hidden="true" />
                    <span>Jumlah Respons (kiri)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D6A23A]" aria-hidden="true" />
                    <span>Kondisi Masih Enak % (kanan)</span>
                  </span>
                </>
              )}
            </div>
            <span className="font-mono tabular-nums text-[11px] text-[#5C3D28]/75">
              Menampilkan {stats.dailyTrend.length} hari pengumpulan data
            </span>
          </div>
        </div>

        {/* Card 2: Pickup-Hour Freshness Trend Chart (5 cols) */}
        <div className="lg:col-span-5 bg-[#FCF9F2] border border-[#173E2C]/12 rounded-3xl p-6 flex flex-col">
          <div className="mb-4">
            <p className="text-xs font-semibold tracking-wider text-[#D6A23A] mb-1">
              TREN JAM PENGAMBILAN & KETAHANAN
            </p>
            <h2 className="font-editorial text-2xl font-semibold text-[#173E2C]">
              Kesegaran Sajian per Waktu Hari
            </h2>
          </div>

          {stats.pickupPeriodTrend.length === 0 ? (
            <div className="flex-1 min-h-[240px] flex items-center justify-center text-center px-4 text-sm text-[#173E2C]/65 bg-white/60 rounded-2xl border border-[#173E2C]/10">
              Belum ada responden dengan catatan Jam Pengambilan (WIB) untuk dipetakan.
            </div>
          ) : (
            <>
              <div className="w-full h-[240px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={stats.pickupPeriodTrend}
                    margin={{ top: 10, right: 8, left: -16, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(23, 62, 44, 0.1)"
                    />
                    <XAxis
                      dataKey="periodLabel"
                      tick={{ fill: '#173E2C', fontSize: 10.5 }}
                      axisLine={{ stroke: 'rgba(23, 62, 44, 0.2)' }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      tick={{ fill: '#173E2C', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: '#D96B27', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<PickupTrendTooltip />} />
                    <Bar
                      yAxisId="left"
                      dataKey="count"
                      name="Responden"
                      fill="#3A6B52"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={42}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="freshPct"
                      name="Masih Enak (%)"
                      stroke="#D96B27"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: '#D96B27', stroke: '#FCF9F2', strokeWidth: 1.5 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-3 border-t border-[#173E2C]/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#173E2C]/75">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#3A6B52]" aria-hidden="true" />
                  <span>Jumlah Respons</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D96B27]" aria-hidden="true" />
                  <span>% Sajian Masih Enak</span>
                </span>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
