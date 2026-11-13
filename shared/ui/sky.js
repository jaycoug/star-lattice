// The sky behind the lattice (P9, 9d): comets crossing the Star view, each message riding inside its
// tail: a trail of white, sparkling dust, tapering and fading away behind the head, never taller than
// the head itself. map.js places them each frame (cometNode at a screen point and angle), behind the
// lattice and the stars, so a comet passes behind any star in its way.

import { svg } from '../dom.js';

export const COMET_MS = 26000;    // a once-only message: edge to edge, slowly, as if far off
export const PARKED_MS = 6000;    // under reduce-motion: shown in place this long
const HEAD = 11;                  // the head's radius (its glow): the tail is at most 2 × HEAD tall
const TAIL_H = 18;                // the tail's height at the head, tapering to a third of it

/** How long a message's tail is (px): the words, room around them, then the dust thinning out. */
export const bannerWidth = text => 30 + [...text].length * 6.6;
const tailLength = text => bannerWidth(text) + 70;

/** A small seeded random source (a comet's dust and paths stay the same from frame to frame). */
export function seeded(key) {
  let h = 2166136261;
  for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Where a comet crosses on its n-th crossing: a height (0–1 of the map, top to bottom) and a slight tilt. */
export function lane(id, n) {
  const r = seeded(`${id}#${n}`);
  return { y: 0.06 + 0.88 * r(), angle: (r() - 0.5) * 16 };
}

/**
 * The dust's gradients, for each kind of comet: `…` bright under the words (from the head to where
 * they end), `…-fade` from there thinning out to nothing.
 */
export function skyDefs() {
  const grad = (id, color, from, to) => svg('linearGradient', { id, x1: '100%', y1: '0%', x2: '0%', y2: '0%' },
    svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': String(from) }),
    svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': String(to) }));
  return svg('defs', {}, [['comet-dust', '#ffffff'], ['comet-dust-prize', '#fff3cf'], ['comet-dust-mine', '#ffe3ea']].flatMap(([id, c]) =>
    [grad(id, c, 0.97, 0.82), grad(`${id}-fade`, c, 0.82, 0)]));
}

/**
 * A comet at screen (x, y) flying at `angle` degrees (0: left to right), its message `text` inside
 * its tail of dust. `t` (ms) twinkles the sparkles. `prize`: a prize comet (a ✦ head, gold flecks);
 * `mine`: the player's own (pink flecks).
 */
export function cometNode(text, x, y, angle, { mine = false, prize = false, t = 0 } = {}) {
  const len = tailLength(text);
  const half = at => (TAIL_H / 2) * (1 - (2 / 3) * Math.min(1, at / len));   // the tail's half-height `at` px behind the head
  const words = bannerWidth(text);   // the bright part, under the words
  const core = [[0, -half(0)], [-words, -half(words)], [-words, half(words)], [0, half(0)]];
  const fade = [[-words + 0.5, -half(words)], [-len, -half(len)], [-len, half(len)], [-words + 0.5, half(words)]];
  const dust = `comet-dust${prize ? (mine ? '-mine' : '-prize') : ''}`;
  const r = seeded(`${prize ? 'p' : ''}${mine ? 'm' : ''}${text}`);
  const fleck = prize ? '#ffd27a' : mine ? '#ff9fb6' : '#ffffff';
  const sparkles = Array.from({ length: Math.round(len / 4) }, (_, i) => {
    const at = len * r() ** 1.4;   // more of them near the head
    const sy = (r() * 2 - 1) * half(at) * 0.9;
    const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(t / 260 + i * 1.7));
    return svg('circle', { cx: -at, cy: sy, r: 0.5 + r() * 1.3, class: 'comet-spark', fill: i % 3 ? '#ffffff' : fleck, opacity: (twinkle * (1 - (0.8 * at) / len)).toFixed(2) });
  });
  return svg('g', { class: 'comet' + (mine ? ' mine' : '') + (prize ? ' prize-comet' : ''), transform: `translate(${x} ${y}) rotate(${angle})`, 'pointer-events': 'none' },
    svg('polygon', { class: 'comet-tail', points: core.map(p => p.join(',')).join(' '), fill: `url(#${dust})` }),
    svg('polygon', { class: 'comet-tail fade', points: fade.map(p => p.join(',')).join(' '), fill: `url(#${dust}-fade)` }),
    ...sparkles,
    svg('text', { x: -14 - (bannerWidth(text) - 30) / 2 - 8, y: 4, class: 'comet-text', 'text-anchor': 'middle' }, text),
    svg('circle', { cx: 0, cy: 0, r: HEAD, class: 'comet-glow' }),
    prize ? svg('text', { x: 0, y: 5.5, class: 'comet-star', 'text-anchor': 'middle' }, '✦') : svg('circle', { cx: 0, cy: 0, r: 4.5, class: 'comet-head' }));
}
