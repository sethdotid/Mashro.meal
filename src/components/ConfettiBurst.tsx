import React from 'react';

interface ConfettiPiece {
  id: number;
  leftPct: number;
  tx: number;
  ty: number;
  rot: number;
  delayMs: number;
  durationMs: number;
  color: string;
  shape: 'ribbon' | 'circle' | 'star';
  size: number;
}

const CONFETTI_PALETTE = ['#173E2C', '#D6A23A', '#D96B27', '#8AA67A', '#C9D8B5'];

const PIECES: ConfettiPiece[] = Array.from({ length: 34 }, (_, idx) => {
  const spread = (idx / 33) * 2 - 1; // -1 .. 1
  const leftPct = 50 + spread * 42;
  const tx = Math.round(spread * 190 + ((idx % 5) - 2) * 24);
  const ty = Math.round(240 + (idx % 6) * 58);
  const rot = Math.round((idx % 2 === 0 ? 1 : -1) * (240 + (idx % 7) * 75));
  const delayMs = (idx % 8) * 90;
  const durationMs = 2400 + (idx % 5) * 320;
  const shapes: ('ribbon' | 'circle' | 'star')[] = ['ribbon', 'star', 'circle'];
  return {
    id: idx,
    leftPct,
    tx,
    ty,
    rot,
    delayMs,
    durationMs,
    color: CONFETTI_PALETTE[idx % CONFETTI_PALETTE.length],
    shape: shapes[idx % shapes.length],
    size: idx % 3 === 0 ? 10 : 8,
  };
});

/**
 * Pure GPU-composited CSS confetti celebration for survey completion.
 * Automatically honors prefers-reduced-motion via .mashro-confetti-piece in index.css.
 */
export function ConfettiBurst() {
  return (
    <div
      aria-hidden="true"
      data-testid="thank-you-confetti"
      className="pointer-events-none fixed inset-x-0 top-0 h-[420px] overflow-hidden z-40"
    >
      {PIECES.map((piece) => (
        <span
          key={piece.id}
          className="mashro-confetti-piece absolute top-0 block"
          style={
            {
              left: `${piece.leftPct}%`,
              width: `${piece.size}px`,
              height: piece.shape === 'ribbon' ? `${piece.size * 1.5}px` : `${piece.size}px`,
              backgroundColor: piece.shape === 'star' ? 'transparent' : piece.color,
              borderRadius: piece.shape === 'circle' ? '9999px' : '2px',
              '--tx': `${piece.tx}px`,
              '--ty': `${piece.ty}px`,
              '--rot': `${piece.rot}deg`,
              animationDelay: `${piece.delayMs}ms`,
              animationDuration: `${piece.durationMs}ms`,
            } as React.CSSProperties
          }
        >
          {piece.shape === 'star' && (
            <svg viewBox="0 0 24 24" fill={piece.color} className="w-full h-full">
              <path d="M12 1.5L14.4 9.6L22.5 12L14.4 14.4L12 22.5L9.6 14.4L1.5 12L9.6 9.6L12 1.5Z" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}
