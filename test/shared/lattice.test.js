// Ported from Java TriangularLatticeTest: the Phase 1 checkpoints of the original plan (archive/plan-v1.md).

import { test, assertEqual, assertClose, dist } from '../runner.js';
import { DIRS, DIR_NAMES, ORIGIN, coordKey, facedCoord, distance, coordsWithin, ring, toPixel, fromPixel } from '../../shared/lattice.js';

const D = 50;

for (const n of [0, 1, 2, 3, 4]) {
  test(`positions within ${n}: 1 + 3n(n + 1), no duplicates`, () => {
    const cs = coordsWithin(n);
    assertEqual(cs.length, 1 + 3 * n * (n + 1));
    assertEqual(new Set(cs.map(coordKey)).size, cs.length, 'no duplicates');
  });
}

for (const n of [1, 2, 3, 4]) {
  test(`ring ${n} has 6n positions, all at distance n`, () => {
    const cs = ring(n);
    assertEqual(cs.length, 6 * n);
    for (const c of cs) assertEqual(distance(c, ORIGIN), n, coordKey(c));
  });
}

test('ring 0 is just the origin', () => {
  assertEqual(ring(0), [ORIGIN]);
});

test('origin maps to pixel origin', () => {
  const [x, y] = toPixel(ORIGIN, D);
  assertClose(x, 0);
  assertClose(y, 0);
});

test('every neighbor is distance d away', () => {
  for (const c of coordsWithin(3)) {
    DIRS.forEach((_, i) => {
      const n = facedCoord(c, i);
      assertEqual(distance(c, n), 1, `lattice distance to ${DIR_NAMES[i]}`);
      assertClose(dist(toPixel(c, D), toPixel(n, D)), D, `pixel distance from ${coordKey(c)} toward ${DIR_NAMES[i]}`);
    });
  }
});

test('adjacent neighbors form equilateral triangles', () => {
  for (const c of coordsWithin(2)) {
    const center = toPixel(c, D);
    for (let i = 0; i < 6; i++) {
      const a = toPixel(facedCoord(c, i), D);
      const b = toPixel(facedCoord(c, (i + 1) % 6), D);
      assertClose(dist(center, a), D);
      assertClose(dist(center, b), D);
      assertClose(dist(a, b), D, `cell ${DIR_NAMES[i]}/${DIR_NAMES[(i + 1) % 6]}`);
    }
  }
});

// With y pointing down, clockwise on screen = increasing atan2 angle: NW at −120°, then +60° per slot.
test('neighbors form a regular hexagon clockwise from NW', () => {
  for (let i = 0; i < 6; i++) {
    const [x, y] = toPixel(facedCoord(ORIGIN, i), D);
    assertClose(Math.atan2(y, x) * 180 / Math.PI, -120 + 60 * i, `${DIR_NAMES[i]} angle`);
  }
});

test('fromPixel round-trips', () => {
  for (const c of coordsWithin(4)) assertEqual(fromPixel(toPixel(c, D), D), c);
});

// Points nudged less than d/2 toward any neighbor still snap back.
test('fromPixel snaps nearby points to the nearest position', () => {
  const nudge = 0.4 * D;
  for (const c of coordsWithin(2)) {
    const [px, py] = toPixel(c, D);
    DIRS.forEach((_, i) => {
      const [nx, ny] = toPixel(facedCoord(c, i), D);
      const p = [px + (nx - px) / D * nudge, py + (ny - py) / D * nudge];
      assertEqual(fromPixel(p, D), c, `${coordKey(c)} nudged toward ${DIR_NAMES[i]}`);
    });
  }
});
