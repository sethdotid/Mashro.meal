import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  isSoundEnabled,
  subscribeSoundPreference,
  toggleSoundEnabled,
} from '../utils/soundEngine';

/**
 * Unique MASHRO retro-analog acoustic toggle switch with animated equalizer bars.
 */
export function SoundToggle({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState<boolean>(() => isSoundEnabled());

  useEffect(() => {
    return subscribeSoundPreference(() => {
      setEnabled(isSoundEnabled());
    });
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? 'Matikan efek suara analog' : 'Aktifkan efek suara analog'}
      onClick={() => setEnabled(toggleSoundEnabled())}
      data-testid="mashro-sound-toggle"
      className={`group min-h-[44px] px-3 py-1.5 rounded-2xl border inline-flex items-center gap-2.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173E2C] ${
        enabled
          ? 'bg-[#173E2C] border-[#173E2C] text-[#F7F1E3] hover:bg-[#0F2B1E]'
          : 'bg-[#FCF9F2] border-[#5C3D28]/25 text-[#5C3D28] hover:border-[#173E2C]/40'
      }`}
    >
      {/* Mini Analog VU / Soundwave Equalizer */}
      <span
        aria-hidden="true"
        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
          enabled ? 'bg-[#23533C] text-[#D6A23A]' : 'bg-[#F7F1E3] text-[#5C3D28]/60'
        }`}
      >
        {enabled ? (
          <Volume2 className="w-4 h-4" />
        ) : (
          <VolumeX className="w-4 h-4" />
        )}
      </span>

      {/* Animated Equalizer Bars */}
      <span aria-hidden="true" className="flex items-end gap-[2.5px] h-4 w-4 justify-center">
        <span
          className={`w-[3px] rounded-full transition-all duration-200 ${
            enabled
              ? 'bg-[#D96B27] h-3 animate-pulse'
              : 'bg-[#5C3D28]/30 h-1'
          }`}
        />
        <span
          className={`w-[3px] rounded-full transition-all duration-200 ${
            enabled
              ? 'bg-[#D6A23A] h-4 animate-pulse'
              : 'bg-[#5C3D28]/30 h-1'
          }`}
          style={enabled ? { animationDelay: '120ms' } : undefined}
        />
        <span
          className={`w-[3px] rounded-full transition-all duration-200 ${
            enabled
              ? 'bg-[#C9D8B5] h-2.5 animate-pulse'
              : 'bg-[#5C3D28]/30 h-1'
          }`}
          style={enabled ? { animationDelay: '240ms' } : undefined}
        />
      </span>

      {!compact && (
        <span className="font-mono text-[11px] font-semibold tracking-wide tabular-nums">
          {enabled ? 'Suara Aktif' : 'Hening'}
        </span>
      )}

      {/* Brass Dial Switch Pill */}
      <span
        aria-hidden="true"
        className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
          enabled ? 'bg-[#D96B27]' : 'bg-[#5C3D28]/25'
        }`}
      >
        <span
          className={`w-3 h-3 rounded-full bg-[#FCF9F2] shadow-xs transition-transform duration-150 ${
            enabled ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}
