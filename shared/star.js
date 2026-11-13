// Star geometry, ported from Java StarGeometry: a kite is [center, left waist, tip, right waist],
// and a regular hexagram has waist radius = tip radius / sqrt(3). Angles are in degrees with y
// pointing down (SVG); kite slot p's tip aims at lattice neighbor DIRS[p] (lattice.js).

/**
 * Screen angle of a kite slot, as in Java StarGeometry: slot 0 (NORTHWEST) at −120°,
 * then 60° clockwise per slot, so each tip aims at a lattice neighbor.
 */
export function slotAngle(slot) {
  return -120 + 60 * slot;
}

export function polar(radius, degrees) {
  const t = degrees * Math.PI / 180;
  return [radius * Math.cos(t), radius * Math.sin(t)];
}

export function kite(angle, tipRadius) {
  const waist = tipRadius / Math.sqrt(3);
  return [[0, 0], polar(waist, angle - 30), polar(tipRadius, angle), polar(waist, angle + 30)];
}

/** Scale points about a center (keeps edges parallel to the original). */
export function scaleAbout(points, [cx, cy], k) {
  return points.map(([x, y]) => [cx + k * (x - cx), cy + k * (y - cy)]);
}

/** Small 12-corner star marker centered at (cx, cy). */
export function miniStar(cx, cy, r) {
  return Array.from({ length: 12 }, (_, i) => {
    // Long points at 0°, ±60°, ±120°, 180° (east and west), the way a star's kites point.
    const [x, y] = polar(i % 2 ? r : r * Math.sqrt(3), -60 + i * 30);
    return [cx + x, cy + y];
  });
}

/** Left half of miniStar(cx, cy, r): from the bottom inner corner, around the left side, to the top one. */
export function halfStar(cx, cy, r) {
  return miniStar(cx, cy, r).slice(5);
}

/** SVG "points" attribute text. */
export function svgPoints(points) {
  return points.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
}
