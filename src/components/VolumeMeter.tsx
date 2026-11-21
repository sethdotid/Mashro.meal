import React from 'react';
import { Volume2 } from 'lucide-react';
import { playToneLevel } from '../utils/soundEngine';

export interface VolumeMeterProps {
  id: string;
  label: string;
  description?: string;
  labelNode?: React.ReactNode;
  descriptionNode?: React.ReactNode;
  value: number | null;
  onChange: (val: number) => void;
  lowLabel?: string;
  highLabel?: string;
  hasError?: boolean;
}

const VOLUME_LEVEL_LABELS: Record<number, string> = {
  1: 'Sangat Tidak Puas',
  2: 'Tidak Puas',
  3: 'Cukup',
  4: 'Puas',
  5: 'Sangat Puas',
};

const EQUALIZER_DB_MARKS: Record<number, string> = {
  1: '-12dB',
  2: '-6dB',
  3: '0dB',
  4: '+3dB',
  5: '+6dB',
};

/**
 * Retro Equalizer 'Volume Meter' component using 5 radio-button styled levels (1–5)
 * for MASHRO sensory ratings (taste, texture, aroma, visual appearance, and packaging).
 */
export function VolumeMeter({
  id,
  label,
  description,
  labelNode,
  descriptionNode,
  value,
  onChange,
  lowLabel = '1 · Sangat Tidak Puas',
  highLabel = '5 · Sangat Puas',
  hasError = false,
}: VolumeMeterProps) {
  return (
    <div
      id={`field-${id}`}
      data-testid={`volume-meter-${id}`}
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
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#5C3D28]/75 tabular-nums pt-0.5">
          <Volume2 className="w-3.5 h-3.5 text-[#D96B27]" aria-hidden="true" />
          <span>
            {value !== null ? `LV 0${value} · ${VOLUME_LEVEL_LABELS[value]}` : 'EQUALIZER 1–5'}
          </span>
        </span>
      </div>

      {/* Retro Equalizer Console Bezel */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-[#F7F1E3]/85 border border-[#5C3D28]/20 shadow-inner">
        {/* Top analog gain calibration strip */}
        <div
          aria-hidden="true"
          className="grid grid-cols-5 gap-2 sm:gap-2.5 mb-2 font-mono text-[10px] text-[#5C3D28]/60 tabular-nums text-center"
        >
          {[1, 2, 3, 4, 5].map((num) => (
            <span
              key={num}
              className={
                value === num ? 'font-semibold text-[#D96B27]' : ''
              }
            >
              {EQUALIZER_DB_MARKS[num]}
            </span>
          ))}
        </div>

        <div
          role="radiogroup"
          aria-label={label}
          className="grid grid-cols-5 gap-2 sm:gap-2.5"
        >
          {[1, 2, 3, 4, 5].map((num) => {
            const isSelected = value === num;
            const isLit = value !== null && num <= value;
            return (
              <button
                key={num}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${label}: ${num} dari 5 (${VOLUME_LEVEL_LABELS[num]})`}
                onClick={() => {
                  playToneLevel(num, 5);
                  onChange(num);
                }}
                className={`min-h-[76px] rounded-xl border text-center cursor-pointer flex flex-col items-center justify-between py-2.5 px-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173E2C] ${
                  isSelected
                    ? 'bg-[#173E2C] border-[#173E2C] text-[#F7F1E3] shadow-sm'
                    : isLit
                    ? 'bg-[#E5ECD9]/80 border-[#173E2C]/35 text-[#173E2C] hover:border-[#173E2C]'
                    : hasError
                    ? 'bg-[#FCF9F2] border-red-700/35 text-[#5C3D28] hover:border-[#173E2C]'
                    : 'bg-[#FCF9F2] border-[#5C3D28]/18 text-[#5C3D28] hover:border-[#173E2C]/50 hover:bg-white'
                }`}
              >
                {/* Stepped Equalizer LED Bars */}
                <span
                  aria-hidden="true"
                  className="w-full max-w-[40px] flex flex-col-reverse gap-[3px] pt-0.5"
                >
                  {[1, 2, 3, 4, 5].map((barIdx) => {
                    const barActive = barIdx <= num;
                    let barColor = 'bg-[#5C3D28]/10';
                    if (barActive) {
                      if (isSelected) {
                        barColor =
                          barIdx === 5
                            ? 'bg-[#D96B27]'
                            : barIdx >= 3
                            ? 'bg-[#D6A23A]'
                            : 'bg-[#C9D8B5]';
                      } else if (isLit) {
                        barColor =
                          barIdx === 5
                            ? 'bg-[#D96B27]'
                            : barIdx >= 3
                            ? 'bg-[#173E2C]'
                            : 'bg-[#D6A23A]';
                      } else {
                        barColor = 'bg-[#5C3D28]/25';
                      }
                    }
                    return (
                      <span
                        key={barIdx}
                        className={`block h-[4px] w-full rounded-full ${barColor}`}
                      />
                    );
                  })}
                </span>

                {/* Radio-button styled indicator + numeric level */}
                <span className="inline-flex items-center justify-center gap-1.5 mt-2">
                  <span
                    aria-hidden="true"
                    className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      isSelected
                        ? 'border-[#D6A23A] bg-[#D96B27]'
                        : isLit
                        ? 'border-[#173E2C]/55 bg-[#FCF9F2]'
                        : 'border-[#5C3D28]/35 bg-white'
                    }`}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#FCF9F2]" />}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums leading-none">
                    {num}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-[#5C3D28]/75">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
