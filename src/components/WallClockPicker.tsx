import React, { useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import {
  angleToHour12,
  angleToMinute,
  formatClock24,
  getHandAngles,
  getPeriodLabel,
  hour24ToHour12,
  parseClock24,
  pointToClockAngle,
} from '../utils/clockUtils';
import { playTick } from '../utils/soundEngine';

export interface WallClockPickerProps {
  id: string;
  label: string;
  description?: string;
  labelNode?: React.ReactNode;
  descriptionNode?: React.ReactNode;
  value: string | null;
  onChange: (val: string) => void;
  hasError?: boolean;
}

type DialMode = 'hour' | 'minute';

function toHour24WithMeridiem(hour12: number, isPm: boolean): number {
  const normalized = ((Math.round(hour12) - 1) % 12 + 12) % 12 + 1; // 1..12
  if (isPm) {
    return normalized === 12 ? 12 : normalized + 12; // 12 -> 12, 1..11 -> 13..23
  }
  return normalized === 12 ? 0 : normalized; // 12 -> 00, 1..11 -> 01..11
}

/**
 * Pure Analog Wall Clock ("Jam Dinding") with integrated face controls:
 * zero external buttons below or beside the clock.
 */
export function WallClockPicker({
  id,
  label,
  description,
  labelNode,
  descriptionNode,
  value,
  onChange,
  hasError = false,
}: WallClockPickerProps) {
  const parsed = parseClock24(value);
  const [dialMode, setDialMode] = useState<DialMode>('hour');
  const [isPm, setIsPm] = useState<boolean>(() =>
    value ? parsed.hour24 >= 12 : true
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);

  const activeHour24 = value ? parsed.hour24 : isPm ? 12 : 9;
  const activeMinute = value ? parsed.minute : 0;
  const activeHour12 = hour24ToHour12(activeHour24);
  const { hourDeg, minuteDeg } = getHandAngles(activeHour24, activeMinute);

  const commitTime = (nextH24: number, nextMin: number) => {
    const formatted = formatClock24(nextH24, nextMin);
    if (formatted !== value) {
      playTick();
    }
    setIsPm(nextH24 >= 12);
    onChange(formatted);
  };

  const applyPointerToDial = (clientX: number, clientY: number, isFinal = false) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const angle = pointToClockAngle(dx, dy);

    if (dialMode === 'hour') {
      const h12 = angleToHour12(angle);
      const nextH24 = toHour24WithMeridiem(h12, isPm);
      commitTime(nextH24, activeMinute);
      if (isFinal) {
        setDialMode('minute');
      }
    } else {
      const nextMin = angleToMinute(angle, 5);
      commitTime(activeHour24, nextMin);
    }
  };

  const handleSelectHourNum = (num: number) => {
    const nextH24 = toHour24WithMeridiem(num, isPm);
    commitTime(nextH24, activeMinute);
    setDialMode('minute');
  };

  const handleSelectMinuteNum = (min: number) => {
    commitTime(activeHour24, min);
  };

  const handleMeridiemToggle = (nextPm: boolean) => {
    setIsPm(nextPm);
    const nextH24 = toHour24WithMeridiem(activeHour12, nextPm);
    commitTime(nextH24, activeMinute);
  };

  const displayHourStr = value
    ? String(activeHour24).padStart(2, '0')
    : '--';
  const displayMinStr = value
    ? String(activeMinute).padStart(2, '0')
    : '--';

  return (
    <div
      id={`field-${id}`}
      data-testid={`wall-clock-picker-${id}`}
      className={`py-5 border-b border-[#5C3D28]/12 last:border-b-0 ${
        hasError ? 'bg-[#D96B27]/[0.06] -mx-4 px-4 rounded-2xl' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div className="flex-1 min-w-[220px]">
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
        <span
          data-testid="wall-clock-readout"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#173E2C] tabular-nums pt-0.5"
        >
          <Clock className="w-3.5 h-3.5 text-[#D96B27]" aria-hidden="true" />
          <span>
            {value ? `${value} WIB · ${getPeriodLabel(activeHour24)}` : 'PILIH PADA JAM DINDING'}
          </span>
        </span>
      </div>

      {/* Centered Analog Wall Clock Only — No Buttons Below the Clock */}
      <div className="py-6 px-4 rounded-3xl bg-[#F7F1E3]/80 border border-[#5C3D28]/18 flex flex-col items-center justify-center">
        <div className="relative w-[290px] h-[290px] sm:w-[316px] sm:h-[316px] select-none touch-none">
          <svg
            ref={svgRef}
            viewBox="0 0 260 260"
            role="img"
            aria-label={`Jam Dinding Analog Interaktif, saat ini menunjukkan pukul ${value ?? 'belum dipilih'} WIB`}
            onPointerDown={(e) => {
              draggingRef.current = true;
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              applyPointerToDial(e.clientX, e.clientY, false);
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current) return;
              applyPointerToDial(e.clientX, e.clientY, false);
            }}
            onPointerUp={(e) => {
              if (!draggingRef.current) return;
              draggingRef.current = false;
              applyPointerToDial(e.clientX, e.clientY, true);
            }}
            className="w-full h-full cursor-pointer drop-shadow-sm"
          >
            {/* Outer Wooden & Forest Green Wall Clock Frame */}
            <circle
              cx="130"
              cy="130"
              r="124"
              fill="#173E2C"
              stroke="#5C3D28"
              strokeWidth="4.5"
            />
            {/* Brass Bezel Ring */}
            <circle
              cx="130"
              cy="130"
              r="114"
              fill="#FCF9F2"
              stroke="#D6A23A"
              strokeWidth="2.5"
            />
            {/* Subtle Inner Vintage Track */}
            <circle
              cx="130"
              cy="130"
              r="95"
              fill="none"
              stroke="rgba(92, 61, 40, 0.14)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />

            {/* 60 Minute Tick Marks */}
            {Array.from({ length: 60 }).map((_, idx) => {
              const rad = ((idx * 6 - 90) * Math.PI) / 180;
              const isMajor = idx % 5 === 0;
              const r1 = isMajor ? 102 : 106;
              const r2 = 110;
              return (
                <line
                  key={idx}
                  x1={130 + r1 * Math.cos(rad)}
                  y1={130 + r1 * Math.sin(rad)}
                  x2={130 + r2 * Math.cos(rad)}
                  y2={130 + r2 * Math.sin(rad)}
                  stroke={isMajor ? '#173E2C' : 'rgba(92, 61, 40, 0.35)'}
                  strokeWidth={isMajor ? 2 : 1}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Dial Brand Mark */}
            <text
              x="130"
              y="72"
              textAnchor="middle"
              fill="#5C3D28"
              fontSize="7.5"
              fontWeight="700"
              letterSpacing="2"
              opacity="0.65"
            >
              MASHRO WIB
            </text>

            {/* Hour Hand (Forest Green) */}
            <g transform={`rotate(${hourDeg} 130 130)`}>
              <line
                x1="130"
                y1="142"
                x2="130"
                y2="74"
                stroke="#173E2C"
                strokeWidth={dialMode === 'hour' ? '6.5' : '4.8'}
                strokeLinecap="round"
              />
              {dialMode === 'hour' && <circle cx="130" cy="74" r="5" fill="#D6A23A" />}
            </g>

            {/* Minute Hand (Pumpkin Orange) */}
            <g transform={`rotate(${minuteDeg} 130 130)`}>
              <line
                x1="130"
                y1="144"
                x2="130"
                y2="52"
                stroke="#D96B27"
                strokeWidth={dialMode === 'minute' ? '4.5' : '3'}
                strokeLinecap="round"
              />
              {dialMode === 'minute' && (
                <circle
                  cx="130"
                  cy="52"
                  r="4.5"
                  fill="#D96B27"
                  stroke="#FCF9F2"
                  strokeWidth="1.5"
                />
              )}
            </g>

            {/* Center Brass Pin */}
            <circle cx="130" cy="130" r="7" fill="#D6A23A" stroke="#173E2C" strokeWidth="2" />
          </svg>

          {/* Integrated Upper Dial Switch: AM (Pagi) / PM (Siang–Malam) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-1/2 top-[32%] -translate-x-1/2 -translate-y-1/2 z-10 inline-flex items-center p-0.5 rounded-full bg-[#E5ECD9]/95 border border-[#173E2C]/20 shadow-xs"
            role="group"
            aria-label="Pilih waktu Pagi (AM) atau Siang–Malam (PM)"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleMeridiemToggle(false);
              }}
              aria-pressed={!isPm}
              aria-label="Pagi 00 sampai 11 WIB (AM)"
              className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold cursor-pointer transition-colors ${
                !isPm
                  ? 'bg-[#173E2C] text-[#FCF9F2]'
                  : 'text-[#5C3D28] hover:text-[#173E2C]'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleMeridiemToggle(true);
              }}
              aria-pressed={isPm}
              aria-label="Siang sampai Malam 12 sampai 23 WIB (PM)"
              className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold cursor-pointer transition-colors ${
                isPm
                  ? 'bg-[#D96B27] text-[#FCF9F2]'
                  : 'text-[#5C3D28] hover:text-[#173E2C]'
              }`}
            >
              PM
            </button>
          </div>

          {/* Integrated Lower Dial Aperture Window: Tap HH (Hour hand) or MM (Minute hand) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-1/2 top-[67%] -translate-x-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-[#173E2C] border border-[#D6A23A]/70 shadow-xs"
            role="group"
            aria-label="Jendela jam dan menit di dalam dial"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDialMode('hour');
              }}
              aria-label="Atur jarum jam"
              className={`px-1.5 py-0.5 rounded font-mono text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                dialMode === 'hour'
                  ? 'bg-[#D6A23A] text-[#0F2B1E]'
                  : 'text-[#FCF9F2]/85 hover:text-white'
              }`}
            >
              {displayHourStr}
            </button>
            <span className="font-mono text-xs font-bold text-[#D6A23A]" aria-hidden="true">
              :
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDialMode('minute');
              }}
              aria-label="Atur jarum menit"
              className={`px-1.5 py-0.5 rounded font-mono text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                dialMode === 'minute'
                  ? 'bg-[#D96B27] text-[#FCF9F2]'
                  : 'text-[#FCF9F2]/85 hover:text-white'
              }`}
            >
              {displayMinStr}
            </button>
          </div>

          {/* Clickable Hour (1–12) or Minute (00–55) Numerals on the Analog Face */}
          {dialMode === 'hour'
            ? Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
                const rad = ((num * 30 - 90) * Math.PI) / 180;
                const pctX = 50 + 34 * Math.cos(rad);
                const pctY = 50 + 34 * Math.sin(rad);
                const isActive = activeHour12 === num && value !== null;
                return (
                  <button
                    key={num}
                    type="button"
                    aria-label={`Pilih jam ${num}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectHourNum(num);
                    }}
                    style={{ left: `${pctX}%`, top: `${pctY}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full font-mono text-xs font-bold tabular-nums flex items-center justify-center cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#173E2C] text-[#FCF9F2] ring-2 ring-[#D6A23A]'
                        : 'text-[#173E2C] hover:bg-[#E5ECD9]'
                    }`}
                  >
                    {num}
                  </button>
                );
              })
            : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minVal) => {
                const rad = ((minVal * 6 - 90) * Math.PI) / 180;
                const pctX = 50 + 34 * Math.cos(rad);
                const pctY = 50 + 34 * Math.sin(rad);
                const isActive = activeMinute === minVal && value !== null;
                return (
                  <button
                    key={minVal}
                    type="button"
                    aria-label={`Pilih menit ${String(minVal).padStart(2, '0')}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectMinuteNum(minVal);
                    }}
                    style={{ left: `${pctX}%`, top: `${pctY}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full font-mono text-[11px] font-bold tabular-nums flex items-center justify-center cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#D96B27] text-[#FCF9F2] ring-2 ring-[#173E2C]'
                        : 'text-[#5C3D28] hover:bg-[#E5ECD9]'
                    }`}
                  >
                    {String(minVal).padStart(2, '0')}
                  </button>
                );
              })}
        </div>

        <p className="mt-3 text-xs text-[#5C3D28]/80 text-center">
          {dialMode === 'hour'
            ? 'Putar atau ketuk angka jam (1–12) & AM/PM langsung di jam dinding.'
            : 'Putar atau ketuk posisi menit (00–55) pada jam dinding.'}
        </p>
      </div>
    </div>
  );
}
