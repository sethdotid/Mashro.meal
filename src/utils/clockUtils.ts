export type DayPeriodId = 'pagi' | 'siang' | 'sore' | 'malam';

export interface ClockState {
  hour24: number; // 0..23
  minute: number; // 0..59
}

export const DAY_PERIOD_OPTIONS: {
  id: DayPeriodId;
  label: string;
  rangeLabel: string;
  defaultHour24: number;
}[] = [
  { id: 'pagi', label: 'Pagi', rangeLabel: '06–11', defaultHour24: 9 },
  { id: 'siang', label: 'Siang', rangeLabel: '12–14', defaultHour24: 12 },
  { id: 'sore', label: 'Sore', rangeLabel: '15–17', defaultHour24: 16 },
  { id: 'malam', label: 'Malam', rangeLabel: '18–23', defaultHour24: 19 },
];

export function formatClock24(hour24: number, minute: number): string {
  const safeH = ((Math.round(hour24) % 24) + 24) % 24;
  const safeM = ((Math.round(minute) % 60) + 60) % 60;
  return `${String(safeH).padStart(2, '0')}:${String(safeM).padStart(2, '0')}`;
}

export function parseClock24(value: string | null): ClockState {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return { hour24: 12, minute: 0 };
  }
  const [hStr, mStr] = value.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return { hour24: 12, minute: 0 };
  }
  return { hour24: h, minute: m };
}

export function getPeriodFromHour24(hour24: number): DayPeriodId {
  if (hour24 >= 5 && hour24 <= 11) return 'pagi';
  if (hour24 >= 12 && hour24 <= 14) return 'siang';
  if (hour24 >= 15 && hour24 <= 17) return 'sore';
  return 'malam';
}

export function getPeriodLabel(hour24: number): string {
  const id = getPeriodFromHour24(hour24);
  if (id === 'pagi') return 'Pagi';
  if (id === 'siang') return 'Siang';
  if (id === 'sore') return 'Sore';
  return 'Malam';
}

/**
 * Maps a 1–12 clock-face numeral + selected Indonesian day period into an unambiguous 0–23 hour.
 */
export function hour12AndPeriodTo24(hour12: number, period: DayPeriodId): number {
  const normalized = ((Math.round(hour12) - 1) % 12 + 12) % 12 + 1; // 1..12
  if (period === 'pagi') {
    return normalized === 12 ? 0 : normalized; // 1..11 -> 01..11, 12 -> 00
  }
  if (period === 'siang') {
    if (normalized === 12) return 12;
    return normalized <= 3 ? normalized + 12 : normalized; // 12, 13, 14, or morning overlap
  }
  if (period === 'sore') {
    return normalized === 12 ? 12 : normalized + 12; // 3->15, 4->16, 5->17
  }
  // malam: 18..23 or 12->00
  return normalized === 12 ? 0 : normalized + 12;
}

export function hour24ToHour12(hour24: number): number {
  const mod = ((Math.round(hour24) % 12) + 12) % 12;
  return mod === 0 ? 12 : mod;
}

/**
 * Converts pointer coordinates relative to clock center (dx, dy) into clock angle [0..360)
 * where 0 deg is 12 o'clock and increases clockwise.
 */
export function pointToClockAngle(dx: number, dy: number): number {
  const rad = Math.atan2(dx, -dy);
  const deg = (rad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function angleToHour12(angleDeg: number): number {
  const step = Math.round(angleDeg / 30) % 12;
  return step === 0 ? 12 : step;
}

export function angleToMinute(angleDeg: number, snapStep = 5): number {
  const raw = Math.round(angleDeg / 6) % 60;
  const snapped = Math.round(raw / snapStep) * snapStep;
  return snapped % 60;
}

export function getHandAngles(hour24: number, minute: number): { hourDeg: number; minuteDeg: number } {
  const h12 = hour24 % 12;
  const minuteDeg = (minute % 60) * 6;
  const hourDeg = h12 * 30 + (minute / 60) * 30;
  return {
    hourDeg: Math.round(hourDeg * 10) / 10,
    minuteDeg: Math.round(minuteDeg * 10) / 10,
  };
}
