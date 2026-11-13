// Level → color. Kite progress (0–4, shown as levels 1–5) fades a category color toward one dark
// gray, by the content set's fade rule: 'darken' (the default, round 6,
// U6): level 1 (no progress) is the full color, level 5 (every star-dot ignited) the dark gray, so
// the most complete kites read darkest (ready to retire); 'brighten' (before round 6): the other way,
// from the dark gray to the full color; 'none': the full color always. Levels between mix toward gray
// in proportion; progress shades continuously (training counts partly).
// Relevance cells use their own white tint (cellFill), unchanged.
// The state stores palette colors by name only; fading happens here, at draw time.

export const GRAY = 'oklch(0.36 0.01 260)';

export function level(value) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

export const FADES = ['darken', 'brighten', 'none'];

/**
 * The content set's other Look settings (map.js reads them, like the fade rule).
 * TWINKLES: how long one fade cycle takes (ms) for a completed category's twinkle; a goal's fade
 * takes GOAL_SLOWER times as long (5.2 s and 6.5 s at Normal; Very slow 20.8 s). LATTICES: the
 * background lattice drawn or hidden.
 */
export const TWINKLES = { veryslow: 20800, slow: 10400, normal: 5200, fast: 2600 };   // P1: each a step slower than before, and a slower Very slow
export const GOAL_SLOWER = 1.25;
export const LATTICES = ['shown', 'hidden'];

/**
 * Kite fill for a progress level 1–5, fractions included, under fade rule `fade`: 'darken'
 * (level − 1) ÷ 4 of the way to gray; 'brighten' (5 − level) ÷ 4 of the way; 'none' the color.
 */
export function kiteFill(color, value, fade = 'darken') {
  if (fade === 'none') return color;
  const v = Math.max(1, Math.min(5, value));
  const toGray = fade === 'brighten' ? (5 - v) / 4 : (v - 1) / 4;
  if (toGray <= 0) return color;
  if (toGray >= 1) return GRAY;
  return `color-mix(in oklab, ${color}, ${GRAY} ${Math.round(toGray * 1000) / 10}%)`;
}

/** Lighter tint for score cells in the table (keeps the numbers readable). */
export function cellFill(color, score) {
  if (score >= 5) return color;
  return `color-mix(in oklab, ${color} ${[10, 25, 42, 62][score - 1]}%, #ffffff)`;
}

/** The built-in palettes (from the first dashboard), one color per category in category order. */
export const DEFAULT_PALETTES = {
  fizzbolt: ['#ff4d9e', '#ff763b', '#ccb300', '#1edc2b', '#198cff', '#cc6ded'],
  coastglow: ['#7e47ff', '#e800d4', '#ff009a', '#ff5362', '#ff962f', '#ffcd05'],
  gladetrail: ['#8172e1', '#008ede', '#009aaf', '#2b9c79', '#7a965c', '#a48e64'],
  cloudblush: ['#00ff99', '#00feff', '#59dfff', '#ff9fff', '#ff8c98', '#ffc60a'],
  mothchalk: ['#c598e3', '#6ab7f4', '#48c7c6', '#93c88d', '#dbbc83', '#ffb2b2'],
};
