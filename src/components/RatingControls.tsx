import React from 'react';
import {
  Check,
  Compass,
  Flag,
  MapPin,
  Navigation,
  Radio,
} from 'lucide-react';
import { playTap, playToneLevel } from '../utils/soundEngine';
import { ConstellationIndicator } from './ConstellationIndicator';
import { VolumeMeter } from './VolumeMeter';

export { ConstellationIndicator, VolumeMeter };

interface Scale1to5Props {
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
  variant?: 'volume' | 'constellation' | 'destination';
}

/**
 * 3. CONSTELLATION INDICATOR (1–5 Orbital Star Indicator)
 */
export function ConstellationScale1to5(props: Omit<Scale1to5Props, 'variant'>) {
  return <ConstellationIndicator {...props} min={1} max={5} />;
}

const DESTINATION_STEP_LABELS: Record<number, string> = {
  1: 'Belum Berangkat',
  2: 'Singgah Sebentar',
  3: 'Menimbang Rute',
  4: 'Hampir Sampai',
  5: 'Tujuan Utama',
};

const FREQUENCIES_FM = ['88.5 MHz', '93.2 MHz', '98.4 MHz', '103.6 MHz', '107.2 MHz'];

/**
 * 5a. DESTINATION INDICATOR (Journey Scale 1–5 for purchase likelihood)
 */
export function DestinationScale1to5({
  id,
  label,
  description,
  labelNode,
  descriptionNode,
  value,
  onChange,
  lowLabel = '1 · Sangat Tidak Mungkin',
  highLabel = '5 · Sangat Mungkin',
  hasError = false,
}: Omit<Scale1to5Props, 'variant'>) {
  const progressWidth = value !== null ? ((value - 1) / 4) * 100 : 0;

  return (
    <div
      id={`field-${id}`}
      className={`py-5 border-b border-[#5C3D28]/12 last:border-b-0 transition-colors ${
        hasError ? 'bg-[#D96B27]/[0.06] -mx-4 px-4 rounded-2xl' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3.5">
        <div className="flex-1 min-w-[200px]">
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
          <Compass className="w-3.5 h-3.5 text-[#D96B27]" aria-hidden="true" />
          <span>{value !== null ? DESTINATION_STEP_LABELS[value] : 'RUTE KEPUTUSAN'}</span>
        </span>
      </div>

      <div className="p-3 sm:p-4 rounded-2xl bg-[#F7F1E3]/70 border border-[#5C3D28]/15">
        {/* Route track */}
        <div className="relative h-2 rounded-full bg-[#5C3D28]/12 mb-3 mx-4 hidden sm:block">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#D96B27] transition-all duration-200 motion-reduce:transition-none"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2 sm:gap-2.5">
          {[1, 2, 3, 4, 5].map((num) => {
            const isSelected = value === num;
            const isPassed = value !== null && num <= value;
            return (
              <button
                key={num}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${label}: ${num} dari 5 (${DESTINATION_STEP_LABELS[num]})`}
                onClick={() => {
                  playToneLevel(num, 5);
                  onChange(num);
                }}
                className={`min-h-[56px] rounded-xl border cursor-pointer flex flex-col items-center justify-center gap-1 py-2 px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173E2C] ${
                  isSelected
                    ? 'bg-[#173E2C] border-[#173E2C] text-[#F7F1E3] shadow-sm'
                    : isPassed
                    ? 'bg-[#E5ECD9]/80 border-[#173E2C]/35 text-[#173E2C]'
                    : hasError
                    ? 'bg-[#FCF9F2] border-red-700/35 text-[#5C3D28] hover:border-[#173E2C]'
                    : 'bg-[#FCF9F2] border-[#5C3D28]/15 text-[#5C3D28] hover:border-[#173E2C]/45 hover:bg-white'
                }`}
              >
                {num === 5 ? (
                  <Flag
                    className={`w-3.5 h-3.5 ${
                      isSelected ? 'text-[#D96B27]' : isPassed ? 'text-[#173E2C]' : 'text-[#5C3D28]/55'
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <MapPin
                    className={`w-3.5 h-3.5 ${
                      isSelected ? 'text-[#D96B27]' : isPassed ? 'text-[#173E2C]' : 'text-[#5C3D28]/55'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <span className="font-mono text-sm font-semibold tabular-nums leading-none">
                  {num}
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

export function Scale1to5(props: Scale1to5Props) {
  if (props.variant === 'constellation') {
    return <ConstellationScale1to5 {...props} />;
  }
  if (props.variant === 'destination') {
    return <DestinationScale1to5 {...props} />;
  }
  return <VolumeMeter {...props} />;
}

interface Scale0to10Props {
  id: string;
  label: string;
  description?: string;
  labelNode?: React.ReactNode;
  descriptionNode?: React.ReactNode;
  value: number | null;
  onChange: (val: number) => void;
  hasError?: boolean;
}

/**
 * 3b. CONSTELLATION INDICATOR (0–10 Horizon Comet Dial for NPS / Recommendation)
 */
export function Scale0to10(props: Scale0to10Props) {
  return <ConstellationIndicator {...props} min={0} max={10} />;
}

interface RadioOptionGroupProps<T extends string> {
  id: string;
  label: string;
  description?: string;
  labelNode?: React.ReactNode;
  descriptionNode?: React.ReactNode;
  options: { value: T; label: string; detail?: string; badge?: string }[];
  value: T | null;
  onChange: (val: T) => void;
  columns?: 1 | 2;
  hasError?: boolean;
  required?: boolean;
  variant?: 'radio-frequency' | 'destination';
}

/**
 * 2 & 5b. RADIO FREQUENCY TUNER & DESTINATION OPTION GROUP
 */
export function RadioOptionGroup<T extends string>({
  id,
  label,
  description,
  labelNode,
  descriptionNode,
  options,
  value,
  onChange,
  columns = 1,
  hasError = false,
  required = true,
  variant = 'radio-frequency',
}: RadioOptionGroupProps<T>) {
  const selectedIndex = options.findIndex((o) => o.value === value);
  const needlePct =
    selectedIndex >= 0 && options.length > 1
      ? 8 + (selectedIndex / (options.length - 1)) * 84
      : selectedIndex === 0
      ? 50
      : 8;

  const destinationIcons = [Flag, Navigation, Compass, MapPin, Compass];

  return (
    <div
      id={`field-${id}`}
      className={`py-5 border-b border-[#5C3D28]/12 last:border-b-0 ${
        hasError ? 'bg-[#D96B27]/[0.06] -mx-4 px-4 rounded-2xl' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3.5">
        <div className="flex-1 min-w-[200px]">
          <p className="text-base font-semibold text-[#173E2C]">
            {labelNode ?? label}
            {required && (
              <span className="text-[#D96B27] whitespace-nowrap" aria-hidden="true">
                &nbsp;*
              </span>
            )}
          </p>
          {(descriptionNode || description) && (
            <p className="text-sm text-[#5C3D28]/80 mt-0.5 leading-relaxed">
              {descriptionNode ?? description}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#5C3D28]/70 tabular-nums pt-0.5">
          {variant === 'destination' ? (
            <>
              <Compass className="w-3.5 h-3.5 text-[#D96B27]" aria-hidden="true" />
              <span>INDIKATOR TUJUAN</span>
            </>
          ) : (
            <>
              <Radio className="w-3.5 h-3.5 text-[#D96B27]" aria-hidden="true" />
              <span>
                {selectedIndex >= 0
                  ? FREQUENCIES_FM[selectedIndex % FREQUENCIES_FM.length]
                  : 'PILIH KANAL'}
              </span>
            </>
          )}
        </span>
      </div>

      {/* Analog Radio Frequency Dial Scale */}
      {variant === 'radio-frequency' && (
        <div
          aria-hidden="true"
          className="mb-3 px-3 py-2 rounded-xl bg-[#F7F1E3]/80 border border-[#5C3D28]/15"
        >
          <div className="relative h-5 flex items-center justify-between font-mono text-[10px] text-[#5C3D28]/60 tabular-nums">
            <span>88.5</span>
            <span>93.2</span>
            <span>98.4</span>
            <span>103.6</span>
            <span>107.2 MHz</span>
            {/* Sliding Pumpkin Orange tuner needle */}
            <div
              className="absolute top-0 bottom-0 w-[3px] rounded-full bg-[#D96B27] transition-all duration-200 motion-reduce:transition-none"
              style={{
                left: `${needlePct}%`,
                opacity: selectedIndex >= 0 ? 1 : 0.3,
              }}
            />
          </div>
          <div className="h-[2px] w-full bg-[repeating-linear-gradient(90deg,rgba(92,61,40,0.35)_0,rgba(92,61,40,0.35)_1px,transparent_1px,transparent_8px)]" />
        </div>
      )}

      <div
        role="radiogroup"
        aria-label={label}
        className={`grid gap-2.5 ${columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}
      >
        {options.map((opt, idx) => {
          const active = value === opt.value;
          const freqLabel = opt.badge ?? FREQUENCIES_FM[idx % FREQUENCIES_FM.length];
          const DestIcon = destinationIcons[idx % destinationIcons.length];

          return (
            <button
              key={`${opt.value}-${idx}`}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                playTap();
                onChange(opt.value);
              }}
              className={`min-h-[52px] w-full text-left px-4 py-3 rounded-xl border cursor-pointer flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173E2C] ${
                active
                  ? 'bg-[#173E2C] border-[#173E2C] text-[#F7F1E3] shadow-sm'
                  : hasError
                  ? 'bg-white border-red-700/35 text-[#173E2C] hover:border-[#173E2C]'
                  : 'bg-white border-[#5C3D28]/18 text-[#173E2C] hover:border-[#173E2C]/50 hover:bg-[#FCF9F2]'
              }`}
            >
              {variant === 'destination' ? (
                <span
                  aria-hidden="true"
                  className={`w-8 h-8 rounded-lg border shrink-0 flex items-center justify-center ${
                    active
                      ? 'border-[#D96B27] bg-[#D96B27] text-[#FCF9F2]'
                      : 'border-[#5C3D28]/20 bg-[#F7F1E3]/70 text-[#5C3D28]'
                  }`}
                >
                  <DestIcon className="w-4 h-4" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    active ? 'border-[#D6A23A] bg-[#D96B27]' : 'border-[#5C3D28]/35 bg-[#F7F1E3]/60'
                  }`}
                >
                  {active && <span className="w-2 h-2 rounded-full bg-[#FCF9F2]" />}
                </span>
              )}

              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{opt.label}</span>
                {opt.detail && (
                  <span
                    className={`block text-xs mt-0.5 ${
                      active ? 'text-[#F7F1E3]/90' : 'text-[#5C3D28]/75'
                    }`}
                  >
                    {opt.detail}
                  </span>
                )}
              </span>

              <span
                aria-hidden="true"
                className={`font-mono text-[11px] tabular-nums shrink-0 ${
                  active ? 'text-[#D6A23A]' : 'text-[#5C3D28]/55'
                }`}
              >
                {variant === 'destination' ? `RUTE 0${idx + 1}` : freqLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CheckboxOptionGroupProps<T extends string> {
  id: string;
  label: string;
  description?: string;
  labelNode?: React.ReactNode;
  descriptionNode?: React.ReactNode;
  options: { value: T; label: string; detail?: string }[];
  values: T[];
  onChange: (nextValues: T[]) => void;
  hasError?: boolean;
}

export function CheckboxOptionGroup<T extends string>({
  id,
  label,
  description,
  labelNode,
  descriptionNode,
  options,
  values,
  onChange,
  hasError = false,
}: CheckboxOptionGroupProps<T>) {
  const toggle = (val: T) => {
    playTap();
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  return (
    <div
      id={`field-${id}`}
      className={`py-5 border-b border-[#5C3D28]/12 last:border-b-0 ${
        hasError ? 'bg-[#D96B27]/[0.06] -mx-4 px-4 rounded-2xl' : ''
      }`}
    >
      <div className="mb-3.5">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {options.map((opt) => {
          const checked = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggle(opt.value)}
              className={`min-h-[52px] w-full text-left px-4 py-3 rounded-xl border cursor-pointer flex items-start gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173E2C] ${
                checked
                  ? 'bg-[#173E2C] border-[#173E2C] text-[#F7F1E3] shadow-sm'
                  : hasError
                  ? 'bg-white border-red-700/35 text-[#173E2C] hover:border-[#173E2C]'
                  : 'bg-white border-[#5C3D28]/18 text-[#173E2C] hover:border-[#173E2C]/45 hover:bg-[#FCF9F2]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 w-5 h-5 rounded-md border shrink-0 flex items-center justify-center ${
                  checked
                    ? 'border-[#D6A23A] bg-[#D96B27] text-[#FCF9F2]'
                    : 'border-[#5C3D28]/35 bg-[#F7F1E3]/60'
                }`}
              >
                {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">{opt.label}</span>
                {opt.detail && (
                  <span
                    className={`block text-xs mt-0.5 ${
                      checked ? 'text-[#F7F1E3]/85' : 'text-[#5C3D28]/75'
                    }`}
                  >
                    {opt.detail}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
