export type ConstellationPattern = 'orbital-halo';

export interface ConstellationPoint {
  value: number;
  x: number;
  y: number;
  astroLabel: string;
}

export interface ConstellationCustomPoint {
  value: number;
  x: number;
  y: number;
  astroLabel?: string;
}

export const DEFAULT_CONSTELLATION_LEVEL_LABELS: Record<number, string> = {
  1: 'Redup',
  2: 'Mulai Terlihat',
  3: 'Cukup Terang',
  4: 'Bersinar',
  5: 'Rasi Sempurna',
};

const ORBITAL_5_COORDS: Array<{ x: number; y: number }> = [
  { x: 12, y: 74 },
  { x: 31, y: 46 },
  { x: 50, y: 30 },
  { x: 69, y: 46 },
  { x: 88, y: 74 },
];

function clampCoord(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(val * 10) / 10));
}

function formatAstroLabel(value: number): string {
  const prefix = value < 10 ? `0${value}` : String(value);
  return `S-${prefix}`;
}

/**
 * Generates spacious, symmetrical percentage coordinates (x in [10..90], y in [22..80])
 * for the MASHRO Botanical Astrolabe / Horizon Comet indicator so nodes never overlap.
 */
export function getConstellationPoints(
  min: number,
  max: number,
  _pattern: ConstellationPattern = 'orbital-halo',
  customPoints?: ConstellationCustomPoint[]
): ConstellationPoint[] {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const total = safeMax - safeMin + 1;
  const customByValue = new Map<number, ConstellationCustomPoint>();

  if (customPoints) {
    for (const pt of customPoints) {
      customByValue.set(pt.value, pt);
    }
  }

  const points: ConstellationPoint[] = [];

  for (let i = 0; i < total; i++) {
    const value = safeMin + i;
    const override = customByValue.get(value);
    if (override) {
      points.push({
        value,
        x: clampCoord(override.x, 8, 92),
        y: clampCoord(override.y, 18, 82),
        astroLabel: override.astroLabel ?? formatAstroLabel(value),
      });
      continue;
    }

    if (total === 5) {
      const preset = ORBITAL_5_COORDS[i];
      points.push({
        value,
        x: preset.x,
        y: preset.y,
        astroLabel: formatAstroLabel(value),
      });
      continue;
    }

    const ratio = total <= 1 ? 0.5 : i / (total - 1);
    const x = clampCoord(10 + ratio * 80, 8, 92);
    const centered = (ratio - 0.5) * 2; // -1 .. 1
    const y = clampCoord(26 + centered * centered * 48, 18, 82);

    points.push({
      value,
      x,
      y,
      astroLabel: formatAstroLabel(value),
    });
  }

  return points;
}

/**
 * Returns how many stars from the start of the constellation should be lit.
 */
export function getLitStarCount(min: number, max: number, value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  const total = Math.max(1, max - min + 1);
  return Math.min(total, Math.max(0, value - min + 1));
}

/**
 * Builds a smooth SVG curve path string connecting the first `pointCount` points
 * in a 400x120 orbital coordinate space.
 */
export function buildConstellationSvgPath(
  points: ConstellationPoint[],
  pointCount: number = points.length,
  width = 400,
  height = 120
): string {
  const count = Math.min(points.length, Math.max(0, pointCount));
  if (count === 0) return '';
  return points
    .slice(0, count)
    .map((pt, idx) => {
      const px = Math.round(((pt.x / 100) * width) * 10) / 10;
      const py = Math.round(((pt.y / 100) * height) * 10) / 10;
      return `${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
    })
    .join(' ');
}
