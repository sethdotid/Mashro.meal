import React from 'react';
import { EXPRESSION_MOOD_OPTIONS, ExpressionMoodOption } from '../types/survey';
import { playToneLevel } from '../utils/soundEngine';

export interface ExpressionIndicatorProps {
  id: string;
  label: string;
  description?: string;
  labelNode?: React.ReactNode;
  descriptionNode?: React.ReactNode;
  value: ExpressionMoodOption | null;
  onChange: (val: ExpressionMoodOption) => void;
  hasError?: boolean;
}

function ExpressionFaceSvg({
  level,
  active,
}: {
  level: 1 | 2 | 3 | 4 | 5;
  active: boolean;
}) {
  const strokeColor = active ? '#FCF9F2' : '#173E2C';
  const accentColor = active ? '#D6A23A' : '#D96B27';

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="w-10 h-10 shrink-0"
    >
      <circle
        cx="20"
        cy="20"
        r="17"
        fill={active ? 'rgba(214, 162, 58, 0.22)' : 'rgba(201, 216, 181, 0.35)'}
        stroke={active ? '#D6A23A' : '#5C3D28'}
        strokeOpacity={active ? 1 : 0.35}
        strokeWidth="1.6"
      />

      {/* Eyes */}
      {level === 5 ? (
        <>
          <path
            d="M12.5 16.5C13.3 14.8 15.2 14.8 16 16.5"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M24 16.5C24.8 14.8 26.7 14.8 27.5 16.5"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : level === 1 ? (
        <>
          <path
            d="M12.5 14.5L16 16.5M16 14.5L12.5 16.5"
            stroke={strokeColor}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M24 14.5L27.5 16.5M27.5 14.5L24 16.5"
            stroke={strokeColor}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="14.5" cy="16" r="1.7" fill={strokeColor} />
          <circle cx="25.5" cy="16" r="1.7" fill={strokeColor} />
        </>
      )}

      {/* Mouth / Expression */}
      {level === 1 && (
        <path
          d="M13 27.5C15.2 23.8 24.8 23.8 27 27.5"
          stroke={accentColor}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      )}
      {level === 2 && (
        <path
          d="M13.5 26C16 24.2 24 24.2 26.5 26"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      {level === 3 && (
        <line
          x1="14"
          y1="25"
          x2="26"
          y2="25"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      {level === 4 && (
        <path
          d="M13.5 23.5C15.8 27.2 24.2 27.2 26.5 23.5"
          stroke={strokeColor}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      )}
      {level === 5 && (
        <>
          <path
            d="M12.5 22.5C15 28.5 25 28.5 27.5 22.5Z"
            fill={accentColor}
            stroke={strokeColor}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="10.5" cy="20.5" r="1.5" fill={accentColor} fillOpacity="0.55" />
          <circle cx="29.5" cy="20.5" r="1.5" fill={accentColor} fillOpacity="0.55" />
        </>
      )}
    </svg>
  );
}

/**
 * 'Ragam Ekspresi' interactive mood selector using 5 custom vector facial expressions.
 */
export function ExpressionIndicator({
  id,
  label,
  description,
  labelNode,
  descriptionNode,
  value,
  onChange,
  hasError = false,
}: ExpressionIndicatorProps) {
  return (
    <div
      id={`field-${id}`}
      data-testid={`expression-indicator-${id}`}
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
        <span className="font-mono text-[11px] font-semibold text-[#5C3D28]/75 tabular-nums pt-0.5">
          {value ? `EKSPRESI: ${value.toUpperCase()}` : 'RAGAM EKSPRESI'}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 sm:grid-cols-5 gap-2.5"
      >
        {EXPRESSION_MOOD_OPTIONS.map((opt, idx) => {
          const active = value === opt.value;
          const isLastOnMobile = idx === EXPRESSION_MOOD_OPTIONS.length - 1;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${label}: ${opt.label} (${opt.detail})`}
              onClick={() => {
                playToneLevel(opt.level, 5);
                onChange(opt.value);
              }}
              className={`min-h-[112px] p-3 rounded-2xl border text-center cursor-pointer flex flex-col items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173E2C] ${
                isLastOnMobile ? 'col-span-2 sm:col-span-1' : ''
              } ${
                active
                  ? 'bg-[#173E2C] border-[#D96B27] text-[#F7F1E3] shadow-sm ring-2 ring-[#D6A23A]/45'
                  : hasError
                  ? 'bg-white border-red-700/35 text-[#173E2C] hover:border-[#173E2C]'
                  : 'bg-white border-[#5C3D28]/18 text-[#173E2C] hover:border-[#173E2C]/50 hover:bg-[#FCF9F2]'
              }`}
            >
              <ExpressionFaceSvg level={opt.level} active={active} />
              <div>
                <span className="block text-xs sm:text-[13px] font-semibold leading-snug">
                  {opt.label}
                </span>
                <span
                  className={`block text-[11px] mt-0.5 leading-tight ${
                    active ? 'text-[#C9D8B5]' : 'text-[#5C3D28]/70'
                  }`}
                >
                  {opt.detail}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
