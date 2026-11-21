import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ConstellationPoint,
  buildConstellationSvgPath,
  getConstellationPoints,
  getLitStarCount,
} from './constellation';

test('getConstellationPoints generates spacious symmetrical coordinates for 1-5 scale without crowding', () => {
  const pts: ConstellationPoint[] = getConstellationPoints(1, 5);
  assert.equal(pts.length, 5);
  assert.deepEqual(
    pts.map((p) => p.value),
    [1, 2, 3, 4, 5]
  );

  for (let i = 0; i < pts.length; i++) {
    const opposite: ConstellationPoint = pts[pts.length - 1 - i];
    assert.ok(pts[i].x >= 10 && pts[i].x <= 90);
    assert.ok(pts[i].y >= 22 && pts[i].y <= 80);
    assert.equal(Math.round((pts[i].x + opposite.x) * 10) / 10, 100, 'x positions must mirror around 50%');
    assert.equal(pts[i].y, opposite.y, 'y positions must be bilaterally symmetrical');
    if (i > 0) {
      assert.ok(pts[i].x - pts[i - 1].x >= 18, 'stars must have >= 18% horizontal spacing');
    }
  }
  assert.ok(pts[2].y < pts[1].y && pts[1].y < pts[0].y, 'center star should be highest apex');
});

test('getConstellationPoints generates symmetrical 0-10 orbital horizon and supports custom points', () => {
  const arcPts: ConstellationPoint[] = getConstellationPoints(0, 10);
  assert.equal(arcPts.length, 11);
  for (let i = 0; i < arcPts.length; i++) {
    const opposite: ConstellationPoint = arcPts[arcPts.length - 1 - i];
    assert.equal(Math.round((arcPts[i].x + opposite.x) * 10) / 10, 100);
    assert.equal(arcPts[i].y, opposite.y);
  }

  const customPts = getConstellationPoints(1, 5, 'orbital-halo', [
    { value: 3, x: 2, y: 99, astroLabel: 'CUSTOM-3' },
  ]);
  assert.equal(customPts[2].x, 8);
  assert.equal(customPts[2].y, 82);
  assert.equal(customPts[2].astroLabel, 'CUSTOM-3');
});

test('getLitStarCount and buildConstellationSvgPath scale cleanly to 400x120 orbital canvas', () => {
  const pts = getConstellationPoints(1, 5);
  assert.equal(getLitStarCount(1, 5, null), 0);
  assert.equal(getLitStarCount(1, 5, 1), 1);
  assert.equal(getLitStarCount(1, 5, 4), 4);
  assert.equal(getLitStarCount(0, 10, 0), 1);
  assert.equal(getLitStarCount(0, 10, 10), 11);

  assert.equal(buildConstellationSvgPath(pts, 0), '');
  assert.equal(buildConstellationSvgPath(pts, 1, 100, 100), 'M 12 74');
  assert.equal(buildConstellationSvgPath(pts, 3, 100, 100), 'M 12 74 L 31 46 L 50 30');
});
