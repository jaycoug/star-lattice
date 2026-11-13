// Progress colors (shared/color.js), reversed in round 6 (U6): no progress is the full category
// color, every star-dot ignited the dark gray, in proportion between.

import { test, assertEqual } from '../runner.js';
import { kiteFill, GRAY, level } from '../../shared/color.js';
import { miniStar, halfStar } from '../../shared/star.js';

test('progress fades a kite from its full color (none done) to the dark gray (all ignited)', () => {
  assertEqual(kiteFill('#198cff', 1), '#198cff', 'level 1: no progress');
  assertEqual(kiteFill('#198cff', 5), GRAY, 'level 5: four ignited');
  assertEqual(kiteFill('#198cff', 3), `color-mix(in oklab, #198cff, ${GRAY} 50%)`, 'halfway');
  assertEqual(kiteFill('#198cff', 2.5), `color-mix(in oklab, #198cff, ${GRAY} 37.5%)`, 'training counts partly');
  assertEqual([kiteFill('#198cff', 0), kiteFill('#198cff', 9)], ['#198cff', GRAY], 'clamped to 1–5');
  assertEqual([level(0.2), level(3.4), level(7)], [1, 3, 5]);
});

test('the fade rule (round 8): darken (the default), brighten (the other way), none (full color always)', () => {
  assertEqual([kiteFill('#198cff', 1, 'darken'), kiteFill('#198cff', 5, 'darken')], ['#198cff', GRAY], 'darken: the default');
  assertEqual([kiteFill('#198cff', 1, 'brighten'), kiteFill('#198cff', 5, 'brighten'), kiteFill('#198cff', 4, 'brighten')], [GRAY, '#198cff', `color-mix(in oklab, #198cff, ${GRAY} 25%)`], 'brighten: gray at none, full when complete');
  assertEqual([1, 2.5, 5].map(v => kiteFill('#198cff', v, 'none')), ['#198cff', '#198cff', '#198cff'], 'none');
});

test('a star-dot’s symbol points east and west, like a star’s kites (round 8); its half is the left side', () => {
  const pts = miniStar(0, 0, 1);
  const far = pts.filter(([x, y]) => Math.hypot(x, y) > 1.5);
  assertEqual(far.some(([x, y]) => Math.abs(y) < 1e-9 && x > 0) && far.some(([x, y]) => Math.abs(y) < 1e-9 && x < 0), true, 'long points at east and west');
  assertEqual(far.some(([x]) => Math.abs(x) < 1e-9), false, 'none at north or south');
  assertEqual(halfStar(0, 0, 1).every(([x]) => x <= 1e-9) && halfStar(0, 0, 1).length === 7, true, 'the half: the left side, top to bottom');
});
