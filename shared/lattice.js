// The triangular lattice: axial coordinates [q, r] and the six directions, ported from Java
// LatticeCoordinate, Direction and TriangularLattice. Direction p is kite slot p: slot p of a star
// points at the neighbor DIRS[p] away, at angle slotAngle(p) (star.js). y points down (SVG).
//
// Slot | Name | (dq, dr)
// 0 | NW | ( 0, -1)
// 1 | NE | (+1, -1)
// 2 | E | (+1, 0)
// 3 | SE | ( 0, +1)
// 4 | SW | (-1, +1)
// 5 | W | (-1, 0)

export const DIRS = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]];
export const DIR_NAMES = ['NW', 'NE', 'E', 'SE', 'SW', 'W'];
export const ORIGIN = [0, 0];

const SQRT3_2 = Math.sqrt(3) / 2;

export const coordKey = ([q, r]) => `${q},${r}`;
export const addCoord = ([q, r], [dq, dr]) => [q + dq, r + dr];
/** The six lattice neighbors of `c`, in slot order. */
export const neighbors = c => DIRS.map(dir => addCoord(c, dir));
/** The position that kite `slot` of the star at `c` faces (its tip points at it). */
export const facedCoord = (c, slot) => addCoord(c, DIRS[slot]);
/** The slot pointing the other way (a neighbor's kite facing back at `c` sits in this slot). */
export const opposite = slot => (slot + 3) % 6;
/** Lattice steps between two positions. */
export const distance = ([q1, r1], [q2, r2]) => latticeRing([q2 - q1, r2 - r1]);
/** Ring of a coordinate: its lattice distance from the center. */
export const latticeRing = ([q, r]) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

/** Every position with ring ≤ n (1 + 3n(n + 1) of them), q then r ascending. */
export function coordsWithin(n) {
  const out = [];
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) out.push([q, r]);
  }
  return out;
}

/** Positions at exactly ring n (6n of them for n ≥ 1). */
export const ring = n => coordsWithin(n).filter(c => latticeRing(c) === n);

/** Point of [q, r] for star-center spacing d: x = d(q + r/2), y = d(√3/2)r. The origin maps to [0, 0]. */
export function toPixel([q, r], d = 1) {
  return [d * (q + r / 2), d * SQRT3_2 * r];
}

/** Nearest position to a point (inverse of toPixel, then cube rounding). */
export function fromPixel([x, y], d = 1) {
  const r = y / (d * SQRT3_2);
  const q = x / d - r / 2;
  const s = -q - r;
  // Round all three cube coordinates, then recompute the one that moved most so q + r + s = 0.
  let [rq, rr] = [Math.round(q), Math.round(r)];
  const rs = Math.round(s);
  const [dq, dr, ds] = [Math.abs(rq - q), Math.abs(rr - r), Math.abs(rs - s)];
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq + 0, rr + 0];   // + 0 turns -0 into 0
}
