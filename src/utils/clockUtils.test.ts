import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angleToHour12,
  angleToMinute,
  formatClock24,
  getHandAngles,
  getPeriodFromHour24,
  hour12AndPeriodTo24,
  hour24ToHour12,
  parseClock24,
  pointToClockAngle,
} from './clockUtils';

test('pointToClockAngle maps 12, 3, 6, 9 oclock correctly', () => {
  assert.equal(pointToClockAngle(0, -100), 0);
  assert.equal(pointToClockAngle(100, 0), 90);
  assert.equal(pointToClockAngle(0, 100), 180);
  assert.equal(pointToClockAngle(-100, 0), 270);
});

test('angleToHour12 and angleToMinute snap accurately', () => {
  assert.equal(angleToHour12(0), 12);
  assert.equal(angleToHour12(90), 3);
  assert.equal(angleToHour12(180), 6);
  assert.equal(angleToHour12(270), 9);

  assert.equal(angleToMinute(0), 0);
  assert.equal(angleToMinute(90), 15);
  assert.equal(angleToMinute(180), 30);
  assert.equal(angleToMinute(270), 45);
});

test('hour12AndPeriodTo24 maps Indonesian day periods accurately', () => {
  assert.equal(hour12AndPeriodTo24(9, 'pagi'), 9);
  assert.equal(hour12AndPeriodTo24(12, 'siang'), 12);
  assert.equal(hour12AndPeriodTo24(1, 'siang'), 13);
  assert.equal(hour12AndPeriodTo24(4, 'sore'), 16);
  assert.equal(hour12AndPeriodTo24(7, 'malam'), 19);
  assert.equal(hour24ToHour12(13), 1);
  assert.equal(hour24ToHour12(0), 12);
  assert.equal(getPeriodFromHour24(13), 'siang');
});

test('formatClock24, parseClock24, and getHandAngles roundtrip cleanly', () => {
  assert.equal(formatClock24(13, 30), '13:30');
  assert.deepEqual(parseClock24('13:30'), { hour24: 13, minute: 30 });
  const { hourDeg, minuteDeg } = getHandAngles(15, 30);
  assert.equal(minuteDeg, 180);
  assert.equal(hourDeg, 105);
});
