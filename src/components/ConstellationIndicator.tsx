import React from 'react';
import { Compass, Sparkles } from 'lucide-react';
import {
  buildConstellationSvgPath,
  ConstellationCustomPoint,
  DEFAULT_CONSTELLATION_LEVEL_LABELS,
  getConstellationPoints,
  getLitStarCount,
} from '../utils/constellation';
import { playToneLevel } from '../utils/soundEngine';

export interface ConstellationIndicatorProps {
  id: string;
  label: string;
  description?: string;
  labelNode?: React.ReactNode;
  descriptionNode?: React.ReactNode;
  value: number | null;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  customPoints?: ConstellationCustomPoint[];
  levelLabels?: Record<number, string>;
  lowLabel?: string;
  highLabel?: string;
  hasError?: boolean;
}

function StarGlyph({ filled, className = 'w-5 h-5' }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1.4 : 1.7}
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2.2L14.7 8.4L21.4 9.1L16.3 13.6L17.8 20.2L12 16.7L6.2 20.2L7.7 13.6L2.6 9.1L9.3 8.4L12 2.2Z" />
    </svg>
  );
}

/**
 * Unique MASHRO Botanical Astrolabe & Horizon Comet Dial:
 * - For 1–5: Spacious 5-star orbital arc above 5 non-overlapping medallion controls.
 * - For 0–10: Clean 3-beacon Celestial Horizon Comet Gauge with gliding comet + crisp 11-tile dial.
 */
export function ConstellationIndicator({
  id,
  label,
  description,
  labelNode,
  descriptionNode,
  value,
  onChange,
  min = 1,
  max = 5,
  customPoints,
  levelLabels,
  lowLabel,
  highLabel,
  hasError = false,
}: ConstellationIndicatorProps) {
  const resolvedLowLabel =
    lowLabel ?? (min === 0 && max === 10 ? '0 · Tidak Mungkin Sama Sekali' : `${min} · Sangat Tidak Puas`);
  const resolvedHighLabel =
    highLabel ?? (min === 0 && max === 10 ? '10 · Sangat Mungkin' : `${max} · Sangat Puas`);

  const points = getConstellationPoints(min, max, 'orbital-halo', customPoints);
  const totalLevels = points.length;
  const isFiveStarMode = totalLevels <= 6;
  const litCount = getLitStarCount(min, max, value);

  const svgW = 400;
  const svgH = 120;
  const fullPath = buildConstellationSvgPath(points, points.length, svgW, svgH);
  const litPath = buildConstellationSvgPath(points, litCount, svgW, svgH);

  const selectedPoint = value !== null ? points.find((p) => p.value === value) ?? null : null;

  const activeLevelText = (() => {
    if (value === null) {
      return isFiveStarMode ? `ASTROLAB ${min}–${max}` : `HORIZON ${min}–${max}`;
    }
    const customLabel = levelLabels?.[value];
    if (customLabel) return `${value}/${max} · ${customLabel}`;
    if (min === 1 && max === 5 && DEFAULT_CONSTELLATION_LEVEL_LABELS[value]) {
      return `${value}/5 · ${DEFAULT_CONSTELLATION_LEVEL_LABELS[value]}`;
    }
    return `SKOR ${value}/${max}`;
  })();

  const getOptionAriaLabel = (num: number) => {
    const customLabel = levelLabels?.[num];
    if (customLabel) return `${label}: ${num} dari ${max} (${customLabel})`;
    if (min === 1 && max === 5 && DEFAULT_CONSTELLATION_LEVEL_LABELS[num]) {
      return `${label}: ${num} bintang dari ${max} (${DEFAULT_CONSTELLATION_LEVEL_LABELS[num]})`;
    }
    return `${label}: ${num} dari ${max}`;
  };

  const handleSelect = (num: number) => {
    playToneLevel(num - min + 1, totalLevels);
    onChange(num);
  };

  // For 0–10 horizon mode, show only 3 spacious landmark beacons (min, mid, max) plus active comet
  const horizonLandmarks = isFiveStarMode
    ? points
    : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]].filter(Boolean);

  return (
    <div
      id={`field-${id}`}
      data-testid={`constellation-indicator-${id}`}
      className={`py-5 border-b border-[#5C3D28]/12 last:border-b-0 ${
        hasError ? 'bg-[#D96B27]/[0.06] -mx-4 px-4 rounded-2xl' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 mb-3.5">
        <div className="flex-1 min-w-[240px]">
          <p className="text-base font-semibold text-[#173E2C]">
            {labelNode ?? label}
            <span className="text-[#D96B27] whitespace-nowrap" aria-hidden="true">
              &nbsp;*
            </span>
          </p>
          {(descriptionNode || description) && (
            <p className="text-sm text-[#5C3D28]/80 mt-0.5 leading-relaxed">
              {descriptionNode ?? description}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#5C3D28]/80 tabular-nums pt-0.5">
          {isFiveStarMode ? (
            <Sparkles className="w-3.5 h-3.5 text-[#D6A23A]" aria-hidden="true" />
          ) : (
            <Compass className="w-3.5 h-3.5 text-[#D96B27]" aria-hidden="true" />
          )}
          <span>{activeLevelText}</span>
        </span>
      </div>

      {/* Botanical Astrolabe Observatory Deck */}
      <div className="p-3.5 sm:p-5 rounded-3xl bg-[#173E2C] border border-[#0F2B1E] text-[#F7F1E3] shadow-inner space-y-3.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#F7F1E3]/12">
          <span className="font-mono text-[11px] tracking-wide text-[#C9D8B5] tabular-nums">
            {isFiveStarMode ? 'ORBIT RASI KEPUASAN' : 'KOMPAS KOMET REKOMENDASI'}
          </span>
          <span className="font-mono text-[11px] text-[#D6A23A] tabular-nums">
            {value !== null
              ? isFiveStarMode
                ? `${litCount}/${totalLevels} Lentera Bintang`
                : `Azimut Skor ${value}/10`
              : `Skala ${min}–${max}`}
          </span>
        </div>

        {/* Clean Spacious SVG Astrolabe / Horizon Canvas */}
        <div
          className={`relative w-full rounded-2xl bg-[#0F2B1E]/95 border ${
            hasError ? 'border-[#D96B27]/75' : 'border-[#D6A23A]/25'
          } overflow-hidden h-28 sm:h-32`}
        >
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            className="w-full h-full"
          >
            {/* Concentric astrolabe rings */}
            <circle
              cx="200"
              cy="132"
              r="116"
              fill="none"
              stroke="rgba(201, 216, 181, 0.1)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <circle
              cx="200"
              cy="132"
              r="80"
              fill="none"
              stroke="rgba(214, 162, 58, 0.14)"
              strokeWidth="1"
            />
            <line
              x1="200"
              y1="8"
              x2="200"
              y2="112"
              stroke="rgba(201, 216, 181, 0.12)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />

            {/* Unlit orbit track */}
            {fullPath && (
              <path
                d={fullPath}
                fill="none"
                stroke="rgba(201, 216, 181, 0.25)"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            )}

            {/* Lit orbit trail */}
            {litCount > 1 && litPath && (
              <path
                d={litPath}
                fill="none"
                stroke="#D6A23A"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Landmark Star Beacons (max 5 in 1–5 mode, 3 spaced beacons in 0–10 mode) */}
            {horizonLandmarks.map((pt) => {
              const cx = (pt.x / 100) * svgW;
              const cy = (pt.y / 100) * svgH;
              const isLit = value !== null && pt.value <= value;
              const isExact = value === pt.value;
              return (
                <g key={pt.value}>
                  {isExact && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="16"
                      fill="rgba(217, 107, 39, 0.24)"
                      stroke="rgba(214, 162, 58, 0.6)"
                      strokeWidth="1"
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isExact ? 10 : isLit ? 8 : 6.5}
                    fill={isExact ? '#D96B27' : isLit ? '#D6A23A' : '#173E2C'}
                    stroke={isExact ? '#FCF9F2' : isLit ? '#FCF9F2' : 'rgba(201, 216, 181, 0.45)'}
                    strokeWidth="1.5"
                  />
                  <text
                    x={cx}
                    y={cy + 21}
                    textAnchor="middle"
                    fill={isLit ? '#F7F1E3' : 'rgba(201, 216, 181, 0.55)'}
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {pt.value}
                  </text>
                </g>
              );
            })}

            {/* Gliding Active Comet Indicator for 0–10 mode */}
            {!isFiveStarMode && selectedPoint && (
              <g>
                <circle
                  cx={(selectedPoint.x / 100) * svgW}
                  cy={(selectedPoint.y / 100) * svgH}
                  r="15"
                  fill="rgba(217, 107, 39, 0.28)"
                />
                <circle
                  cx={(selectedPoint.x / 100) * svgW}
                  cy={(selectedPoint.y / 100) * svgH}
                  r="9"
                  fill="#D96B27"
                  stroke="#FCF9F2"
                  strokeWidth="2"
                />
                <text
                  x={(selectedPoint.x / 100) * svgW}
                  y={(selectedPoint.y / 100) * svgH - 14}
                  textAnchor="middle"
                  fill="#D6A23A"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {selectedPoint.value}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Non-overlapping Spacious Touch Medallions */}
        {isFiveStarMode ? (
          <div
            role="radiogroup"
            aria-label={label}
            className="grid grid-cols-5 gap-2 sm:gap-3"
          >
            {points.map((pt) => {
              const isSelected = value === pt.value;
              const isLit = value !== null && pt.value <= value;
              const shortText =
                levelLabels?.[pt.value] ??
                (min === 1 && max === 5 ? DEFAULT_CONSTELLATION_LEVEL_LABELS[pt.value] : undefined);
              return (
                <button
                  key={pt.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={getOptionAriaLabel(pt.value)}
                  onClick={() => handleSelect(pt.value)}
                  className={`min-h-[62px] px-1.5 py-2 rounded-2xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FCF9F2] ${
                    isSelected
                      ? 'bg-[#D96B27] border-[#FCF9F2] text-[#FCF9F2] shadow-sm ring-2 ring-[#D6A23A]/60'
                      : isLit
                      ? 'bg-[#23533C] border-[#D6A23A] text-[#D6A23A]'
                      : hasError
                      ? 'bg-[#0F2B1E] border-[#D96B27]/60 text-[#F7F1E3]/80 hover:border-[#D6A23A]'
                      : 'bg-[#0F2B1E] border-[#C9D8B5]/25 text-[#F7F1E3]/80 hover:border-[#D6A23A] hover:text-[#D6A23A]'
                  }`}
                >
                  <StarGlyph filled={isLit} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <span className="font-mono text-xs font-bold tabular-nums leading-none">
                    {pt.value}
                  </span>
                  {shortText && (
                    <span className="hidden sm:block text-[10px] leading-tight text-center opacity-85 truncate max-w-full">
                      {shortText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label={label}
            className="grid grid-cols-6 sm:grid-cols-11 gap-2"
          >
            {points.map((pt) => {
              const active = value === pt.value;
              const lit = value !== null && pt.value <= value;
              return (
                <button
                  key={pt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={getOptionAriaLabel(pt.value)}
                  onClick={() => handleSelect(pt.value)}
                  className={`min-h-[46px] rounded-xl border font-mono text-sm font-semibold tabular-nums cursor-pointer flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D6A23A] ${
                    active
                      ? 'bg-[#D96B27] border-[#FCF9F2] text-[#FCF9F2] shadow-sm ring-2 ring-[#D6A23A]/50'
                      : lit
                      ? 'bg-[#23533C] border-[#D6A23A] text-[#FCF9F2]'
                      : hasError
                      ? 'bg-[#0F2B1E] border-[#D96B27]/60 text-[#F7F1E3] hover:border-[#D6A23A]'
                      : 'bg-[#0F2B1E] border-[#C9D8B5]/25 text-[#F7F1E3]/85 hover:border-[#D6A23A] hover:bg-[#23533C]/60'
                  }`}
                >
                  {pt.value}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#C9D8B5]/85 tabular-nums pt-0.5">
          <span>
            {value !== null
              ? isFiveStarMode
                ? `${litCount} dari ${totalLevels} lentera bintang menyala`
                : `Komet menunjuk skor ${value} dari 10`
              : `Pilih skala ${min}–${max} pada panel di atas`}
          </span>
          {value !== null && (
            <span className="text-[#D6A23A] font-semibold">
              {isFiveStarMode && DEFAULT_CONSTELLATION_LEVEL_LABELS[value]
                ? DEFAULT_CONSTELLATION_LEVEL_LABELS[value]
                : value >= 9
                ? 'Promotor MASHRO'
                : value >= 7
                ? 'Netral Positif'
                : 'Masukan Perbaikan'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-[#5C3D28]/75">
        <span>{resolvedLowLabel}</span>
        <span>{resolvedHighLabel}</span>
      </div>
    </div>
  );
}
