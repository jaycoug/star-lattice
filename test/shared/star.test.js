// Ported from Java StarGeometryTest. kite(angle, tipRadius) is centered on the origin, so the
// off-origin Java center is applied by translating the points.

import { test, assertClose, assertSamePoint, dist } from '../runner.js';
import { slotAngle, kite } from '../../shared/star.js';
import { ORIGIN, facedCoord, toPixel } from '../../shared/lattice.js';

const CENTER = [3, -2];   // off-origin on purpose
const at = ([cx, cy], pts) => pts.map(([x, y]) => [cx + x, cy + y]);
const kites = (center, tip = 0.5) => [0, 1, 2, 3, 4, 5].map(i => at(center, kite(slotAngle(i), tip)));
// A kite is [center, left waist, tip, right waist].
const [C, L, T, R] = [0, 1, 2, 3];

test('adjacent kites share waists and meet at the center', () => {
  const ks = kites(CENTER);
  for (let i = 0; i < 6; i++) {
    assertSamePoint(ks[i][C], CENTER, `kite ${i} center`);
    assertSamePoint(ks[i][R], ks[(i + 1) % 6][L], `kite ${i}/${(i + 1) % 6} waist`);
  }
});

test('all kites are congruent', () => {
  const ks = kites(CENTER);
  const sides = k => [dist(k[C], k[L]), dist(k[L], k[T]), dist(k[C], k[T]), dist(k[L], k[R])];
  const first = sides(ks[0]);
  for (const k of ks) sides(k).forEach((s, j) => assertClose(s, first[j]));
});

// With tip radius 0.5 on a unit lattice, each tip lands halfway to neighbor i.
test('tips point at lattice neighbors', () => {
  kites(ORIGIN).forEach((k, i) => {
    const [x, y] = toPixel(facedCoord(ORIGIN, i));
    assertSamePoint(k[T], [x / 2, y / 2], `slot ${i} tip`);
  });
});

// Twice the signed area of triangle (a, b, p); zero when p lies on the line ab.
const cross = ([ax, ay], [bx, by], [px, py]) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

// Regular hexagram: kite i's waists lie on the line between tips i−1 and i+1.
test('regular star outline is two triangles', () => {
  const ks = kites(CENTER);
  for (let i = 0; i < 6; i++) {
    const [a, b] = [ks[(i + 5) % 6][T], ks[(i + 1) % 6][T]];
    assertClose(cross(a, b, ks[i][L]), 0, `kite ${i} left waist`);
    assertClose(cross(a, b, ks[i][R]), 0, `kite ${i} right waist`);
  }
});

test('scaling keeps proportions', () => {
  const [small, large] = [kites(ORIGIN, 0.5), kites(ORIGIN, 2)];   // 4× the test star
  small.forEach((k, i) => k.forEach(([x, y], v) => assertSamePoint(large[i][v], [4 * x, 4 * y], `slot ${i} vertex ${v}`)));
});
