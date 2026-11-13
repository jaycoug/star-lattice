// The engine (shared/engine): status and staleness, children, status from a star-dot's star, kite
// opening, deploying and the layout, contested positions and colors, moves, relations, planned stars.

import { test, assertEqual } from '../runner.js';
import { DIRS, coordKey, latticeRing, distance } from '../../shared/lattice.js';
import {
  createState, centralStar, derive, placeDot, updateDot, addChild, checkDot, assessDot, addDotNote, removeDotNote, childSlots,
  ignite, lapse, addRelation, updateRelation, removeRelation, planStar, updateKite,
  rotateKite, swapDots, swapKites, deployStar, withdrawStar, withdrawBlocked, normalizeSave, ZENITH, BACK, DAY,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const OPTS = { now: NOW };
const central = st => centralStar(st).id;
const kiteOf = (st, star, i) => st.stars[star].kites[i];
const branchOf = (st, kite) => st.dots[st.kites[kite].dots[ZENITH]].branch;

/** Place and ignite a dot. Returns [state, dotId]. */
function lit(st, kite, slot) {
  let id;
  [st, id] = placeDot(st, kite, slot, 'task');
  return [ignite(st, id, NOW), id];
}

/** Place and ignite the Zenith dot of a kite, deploy its star, and return [state, the star it created]. */
function deploy(st, kite, opts = OPTS) {
  [st] = lit(st, kite, ZENITH);
  st = deployStar(st, st.kites[kite].dots[ZENITH], opts).state;
  return [st, branchOf(st, kite)];
}

/** Open every kite of a star by igniting two non-Zenith dots on each open kite. */
function openAll(st, star) {
  for (let pass = 0; pass < 6; pass++) {
    const view = derive(st, OPTS);
    for (const k of st.stars[star].kites) {
      if (!view.kiteOpen(k) || st.kites[k].dots[0]) continue;
      [st] = lit(st, k, 0);
      [st] = lit(st, k, 1);
    }
  }
  return st;
}

/** Ring-1 stars at NW (central kite 0) and NE (central kite 1), fully open. */
function twoRingStars(opts = OPTS) {
  let st = createState(), a, b;
  [st, a] = deploy(st, kiteOf(st, central(st), 0), opts);
  [st, b] = deploy(st, kiteOf(st, central(st), 1), opts);
  return [openAll(openAll(st, a), b), a, b];
}

// ---- State and status ---------------------------------------------------------------------------

test('a new state holds only the central star, kites colored 0–5, all open', () => {
  const st = createState({ kiteNames: ['A', 'B'] });
  const view = derive(st, OPTS);
  assertEqual(Object.keys(st.stars).length, 1);
  assertEqual(centralStar(st).kites.map(k => st.kites[k].color), [0, 1, 2, 3, 4, 5]);
  assertEqual(st.kites[kiteOf(st, central(st), 1)].name, 'B');
  assertEqual(centralStar(st).kites.every(view.kiteOpen), true);
  assertEqual(view.place(central(st)).coord, [0, 0]);
});

test('status: children decide: open → half (from the first) → ignited; never back below half', () => {
  let st = createState(), d, a, b;
  [st, d] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Learn');
  ({ state: st, dot: a } = addChild(st, d, 'a'));
  ({ state: st, dot: b } = addChild(st, d, 'b'));
  assertEqual(derive(st, OPTS).effective(d), { status: 'open', weight: 0 }, 'children, nothing done yet');
  st = checkDot(st, a, true, NOW);
  assertEqual(derive(st, OPTS).effective(d), { status: 'training', weight: 0.5 });
  st = checkDot(st, b, true, NOW);
  assertEqual(derive(st, OPTS).effective(d).status, 'ignited');
  st = { ...st, dots: { ...st.dots, [d]: { ...st.dots[d], trained: true } } };
  st = checkDot(checkDot(st, a, false, NOW), b, false, NOW);
  assertEqual(derive(st, OPTS).effective(d), { status: 'training', weight: 0.5 }, 'floor once trained');
  assertEqual(derive(st, OPTS).own(a), { status: 'training', weight: 0.5 }, 'a child once completed keeps the floor too');
});

test('staleness: a completed star-dot goes stale after its Retrain period, inherited from its parent', () => {
  let st = createState(), d, a;
  [st, d] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Learn');
  ({ state: st, dot: a } = addChild(st, d, 'a'));
  st = checkDot(updateDot(st, d, { props: { persistence: 'low' } }), a, true, NOW);
  const opts = { periods: { low: 30, high: null } };
  assertEqual(derive(st, { ...opts, now: NOW + 29 * DAY }).own(a).status, 'ignited');
  assertEqual(derive(st, { ...opts, now: NOW + 31 * DAY }).own(a).status, 'training', 'stale → back to half');
  st = updateDot(st, a, { props: { persistence: 'high' } });
  assertEqual(derive(st, { ...opts, now: NOW + 3650 * DAY }).own(a).status, 'ignited', 'its own value wins: never stale');
});

test('a dot without a checklist is ignited while its ignitedAt is fresh', () => {
  let st = createState(), d;
  [st, d] = lit(st, kiteOf(st, central(st), 0), 0);
  assertEqual(derive(st, { now: NOW + 99 * DAY, defaultPeriod: 90 }).own(d).status, 'training');
  assertEqual(derive(lapse(st, d), OPTS).own(d).status, 'training', 'lapse keeps the floor');
});

// ---- Expansion and layout -----------------------------------------------------------------------

test('a central kite’s Zenith dot deploys its ring-1 star, in its color', () => {
  let st = createState(), s;
  [st, s] = deploy(st, kiteOf(st, central(st), 2));
  const view = derive(st, OPTS);
  assertEqual(view.shown(s), true);
  assertEqual(view.place(s).coord, DIRS[2]);
  assertEqual(st.stars[s].kites.map(k => st.kites[k].color), Array(6).fill(2));
  assertEqual(st.stars[s].kites.map(view.kiteOpen), [false, false, false, true, false, false], 'only the back kite');
  assertEqual(view.kiteAtSlot(s, 5), kiteOf(st, s, BACK), 'the back kite faces the center');
});

test('stars deploy only when asked: at an open Zenith, ignited or not (S2)', () => {
  let st = createState(), p, d, r;
  const k = kiteOf(st, central(st), 0);
  [st, p] = lit(st, k, 1);
  r = deployStar(st, p, OPTS);
  assertEqual([r.state, r.problem], [st, 'Only a star-dot at an open kite’s Zenith can deploy its star.'], 'Port dot');
  [st, d] = placeDot(st, k, ZENITH, 'task');
  assertEqual(Object.keys(ignite(st, d, NOW).stars).length, 1, 'igniting deploys nothing');
  r = deployStar(st, d, OPTS);
  assertEqual([r.problem, Object.keys(r.state.stars).length, derive(r.state, OPTS).shown(r.star)], [null, 2, true], 'an unstarted Zenith dot deploys');
  assertEqual(deployStar(r.state, d, OPTS).star, r.star, 'deploying twice returns the same star');
  const locked = kiteOf(r.state, r.star, 0);
  let q;
  [st, q] = placeDot(r.state, locked, ZENITH, 'locked');
  assertEqual(deployStar(st, q, OPTS).problem, 'Only a star-dot at an open kite’s Zenith can deploy its star.', 'a locked kite');
});

test('rotating the source dot away hides its star; rotating back restores it', () => {
  let st = createState(), s;
  const k = kiteOf(st, central(st), 0);
  [st, s] = deploy(st, k);
  st = rotateKite(st, k);
  assertEqual(derive(st, OPTS).shown(s), false);
  assertEqual(derive(st, OPTS).place(s).coord, DIRS[0], 'kept in place, drawn as an outline');
  for (let i = 0; i < 3; i++) st = rotateKite(st, k);
  assertEqual(derive(st, OPTS).shown(s), true);
  assertEqual(Object.keys(st.stars).length, 2, 'no new star');
});

test('each dot owns its own star at the faced position', () => {
  let st = createState(), a, b;
  const k = kiteOf(st, central(st), 0);
  [st, a] = deploy(st, k);
  [st] = lit(st, k, 1);
  st = rotateKite(st, k);   // the Port dot reaches the Zenith
  ({ state: st, star: b } = deployStar(st, st.kites[k].dots[ZENITH], OPTS));
  const view = derive(st, OPTS);
  assertEqual(a !== b && !!b, true, 'a second star');
  assertEqual([view.shown(a), view.shown(b)], [false, true]);
  assertEqual(view.place(b).coord, DIRS[0]);
});

test('a star-dot’s status comes from its star’s star-dots, at the save’s share (S3)', () => {
  let st = createState(), s, d1, d2;
  const k = kiteOf(st, central(st), 0);
  [st, s] = deploy(st, k);
  const src = st.kites[k].dots[ZENITH];
  const back = kiteOf(st, s, BACK);
  assertEqual(derive(st, OPTS).effective(src).status, 'ignited', 'its star has no star-dots yet: its own status stands');
  [st, d1] = lit(st, back, 0);
  [st, d2] = placeDot(st, back, 1, 'not yet');
  let view = derive(st, OPTS);
  assertEqual([view.effective(src).status, view.support(src)], ['training', { star: s, ignited: 1, total: 2, share: 100 }], '1 of 2 at 100%');
  assertEqual(derive(st, { ...OPTS, share: 50 }).effective(src).status, 'ignited', '1 of 2 at 50%');
  st = ignite(st, d2, NOW);
  assertEqual(derive(st, OPTS).effective(src).status, 'ignited', '2 of 2');
  st = lapse(st, src);
  view = derive(st, OPTS);
  assertEqual([view.effective(src).status, view.shown(s)], ['ignited', true], 'its own lapse changes nothing');
  assertEqual(view.support(d1), null, 'no star of its own');
});

test('status rolls up through every ring', () => {
  let st = createState(), s, t, x;
  const k = kiteOf(st, central(st), 0);
  [st, s] = deploy(st, k);
  st = openAll(st, s);   // every kite open, two ignited star-dots on each
  const outward = st.stars[s].kites.find(kk => !st.kites[kk].dots[ZENITH] && deployStar(lit(st, kk, ZENITH)[0], lit(st, kk, ZENITH)[1], OPTS).star);
  [st, t] = deploy(st, outward);
  const mid = st.kites[outward].dots[ZENITH];
  [st, x] = placeDot(st, kiteOf(st, t, BACK), 0, 'leaf');
  const src = st.kites[k].dots[ZENITH];
  assertEqual([derive(st, OPTS).effective(mid).status, derive(st, OPTS).effective(src).status], ['training', 'training'], 'one unstarted leaf (both were ignited once: never below half)');
  st = ignite(st, x, NOW);
  assertEqual([derive(st, OPTS).effective(mid).status, derive(st, OPTS).effective(src).status], ['ignited', 'ignited'], 'the leaf ignites both rings');
});

test('the save’s share: 1–100, else 100', () => {
  const save = share => normalizeSave({ format: 'star-lattice-save', version: 2, content: 'x', state: createState(), share }).share;
  assertEqual([save(50), save(undefined), save(0), save(101), save(2.5)], [50, 100, 100, 100, 100]);
});

test('kite opening: two ignited dots open the neighbors', () => {
  let st = createState(), s;
  [st, s] = deploy(st, kiteOf(st, central(st), 0));
  const back = kiteOf(st, s, BACK);
  [st] = lit(st, back, 0);
  assertEqual(st.stars[s].kites.filter(derive(st, OPTS).kiteOpen).length, 1);
  [st] = lit(st, back, 1);
  assertEqual(st.stars[s].kites.map(derive(st, OPTS).kiteOpen), [false, false, true, true, true, false]);
});

test('a deployed star stays shown and open whatever its source’s own status', () => {
  let st = createState(), s;
  const k = kiteOf(st, central(st), 0);
  [st, s] = deploy(st, k);
  st = openAll(st, s);
  st = lapse(st, st.kites[k].dots[ZENITH]);
  const view = derive(st, OPTS);
  assertEqual([view.shown(s), st.stars[s].kites.every(view.kiteOpen)], [true, true]);
});

test('W1: a star deploys only where its kite faces a free position: never a reserved ring-1 one, nor the center', () => {
  let [st, a] = twoRingStars();
  const problems = [];
  for (const k of st.stars[a].kites) {
    if (!st.kites[k].dots[ZENITH]) [st] = lit(st, k, ZENITH);
    const r = deployStar(st, st.kites[k].dots[ZENITH], OPTS);
    if (r.problem) problems.push(r.problem); else st = r.state;
  }
  const view = derive(st, OPTS);
  const placed = view.shownStars().map(view.place);
  assertEqual(placed.filter(p => latticeRing(p.coord) === 1).length, 2, 'ring 1: only the central kites’ stars');
  assertEqual(placed.filter(p => latticeRing(p.coord) === 2).length, 3, 'NW star: its three kites facing ring 2 deploy');
  assertEqual(problems.length, 3, 'the other three are refused');
  assertEqual([problems.filter(x => x.includes('ring 1')).length, problems.filter(x => x.includes('central star')).length], [2, 1], 'two face ring 1, one the center; each says so');
  assertEqual(view.place(central(st)).coord, [0, 0], 'the central star keeps the origin');
});

test('W1: a back kite faces its own source: its Zenith star-dot can’t deploy, and no star moves outward', () => {
  let st = createState(), s, d;
  [st, s] = deploy(st, kiteOf(st, central(st), 0));   // the NW star, at (0,-1)
  [st, d] = lit(st, kiteOf(st, s, BACK), ZENITH);      // its back kite faces the center
  const before = Object.keys(st.stars).length;
  const r = deployStar(st, d, OPTS);
  assertEqual([r.state === st, r.problem, Object.keys(st.stars).length], [true, 'Its kite faces the central star.', before]);
  const f = derive(st, OPTS).facing(d);
  assertEqual([f.coord, f.holder], [[0, 0], central(st)]);
  assertEqual(derive(st, OPTS).openings.some(o => o.dot === d), false, 'not an opening');
});

test('W1: a planned star whose position is taken keeps that place, marked blocked (nothing is outlined further out)', () => {
  let st = createState(), s, d, c;
  [st, s] = deploy(st, kiteOf(st, central(st), 0));
  [st, d] = placeDot(st, kiteOf(st, s, BACK), 0, 'not at the Zenith');
  [st, c] = planStar(st, d);
  const view = derive(st, OPTS);
  assertEqual([view.shown(c), view.place(c).coord, view.place(c).blocked], [false, [0, 0], true]);
});

// ---- Positions and colors -----------------------------------------------------------------------
// (1,-2) borders both the NW star (its kite at slot NE = relative 1) and the NE star (slot NW = relative 5).

const CORNER = [1, -2];

test('X1: a new star always takes its star-dot’s kite’s category, wherever it borders other colors', () => {
  for (const r of [0, 0.99]) {
    let [st, a] = twoRingStars();
    let c;
    [st, c] = deploy(st, kiteOf(st, a, 1), { ...OPTS, random: () => r });   // (1,-2) borders the NW (0) and NE (1) stars
    assertEqual(derive(st, OPTS).place(c).coord, CORNER);
    assertEqual(st.stars[c].kites.map(k => st.kites[k].color), Array(6).fill(st.kites[kiteOf(st, a, 1)].color), `random ${r}: the NW star’s kite’s category, never rolled`);
    assertEqual('bank' in st.stars[c], false, 'nothing waits for a color');
  }
});

test('first come (W3): the earlier star holds a position; a later star-dot facing it can’t deploy', () => {
  let [st, a, b] = twoRingStars();
  let c, d;
  [st, c] = deploy(st, kiteOf(st, a, 1));
  [st, d] = lit(st, kiteOf(st, b, 5), ZENITH);
  const r = deployStar(st, d, OPTS);
  const view = derive(st, OPTS);
  assertEqual(view.starAt(CORNER), c);
  assertEqual([r.state === st, /taken by .*’s star/.test(r.problem), view.facing(d).holder, view.openings.some(o => o.dot === d)], [true, true, c, false]);
  assertEqual(view.blocked, [], 'nothing deployed is blocked');
});

// ---- Moves --------------------------------------------------------------------------------------

test('swapping dots carries the branch to the new kite’s direction', () => {
  let st = createState(), s, problem;
  const [k0, k3] = [kiteOf(st, central(st), 0), kiteOf(st, central(st), 3)];
  [st, s] = deploy(st, k0);
  ({ state: st, problem } = swapDots(st, { kite: k0, slot: ZENITH }, { kite: k3, slot: ZENITH }, OPTS));
  const view = derive(st, OPTS);
  assertEqual(problem, null);
  assertEqual([view.shown(s), view.place(s).coord, view.place(s).turn], [true, DIRS[3], 3]);
});

test('a dot can’t move into its own branch', () => {
  let st = createState(), s;
  const k = kiteOf(st, central(st), 0);
  [st, s] = deploy(st, k);
  const { state, problem } = swapDots(st, { kite: k, slot: ZENITH }, { kite: kiteOf(st, s, BACK), slot: 0 }, OPTS);
  assertEqual([state === st, typeof problem], [true, 'string']);
});

test('swapping central kites turns their branches around the center', () => {
  let [st, a] = twoRingStars();
  let c, problem;
  [st, c] = deploy(st, kiteOf(st, a, 1));
  ({ state: st, problem } = swapKites(st, { star: central(st), i: 0 }, { star: central(st), i: 2 }, OPTS));
  const view = derive(st, OPTS);
  assertEqual(problem, null);
  assertEqual(view.place(a).coord, DIRS[2]);
  assertEqual(view.place(c).coord, [1, 1], '(1,-2) turned 120° clockwise');
  assertEqual(st.kites[kiteOf(st, central(st), 2)].color, 0, 'the kite keeps its category');
});

test('W2: a kite swap that turns a deployed star toward a taken position blocks it; withdrawBlocked withdraws it', () => {
  let [st, a, b] = twoRingStars();
  let c, e;
  [st, c] = deploy(st, kiteOf(st, a, 1));    // NW star → (1,-2)
  [st, e] = deploy(st, kiteOf(st, b, 0));    // NE star → (1,-2)'s neighbor
  const { state, problem, conflict } = swapKites(st, { star: b, i: 0 }, { star: b, i: 5 }, OPTS);   // turns e's kite to face (1,-2)
  const view = derive(state, OPTS);
  assertEqual([problem, conflict, view.starAt(CORNER), view.shown(e)], [null, null, c, false], 'the move happens; e can’t show');
  assertEqual(view.blocked.map(x => [x.star, x.holder]), [[e, c]]);
  const w = withdrawBlocked(state, OPTS, st);
  assertEqual([w.withdrawn, w.state.stars[e].deployed, w.state.stars[c].deployed, derive(w.state, OPTS).blocked], [[e], false, true, []], 'e is withdrawn (still planned); c keeps its place');
  assertEqual(withdrawBlocked(st, OPTS).state, st, 'nothing blocked: the state is unchanged');
});

test('W2: of two deployed stars wanting one position, the one already there keeps it; without a before, the older one', () => {
  let [st, a, b] = twoRingStars();
  let c, e;
  [st, e] = deploy(st, kiteOf(st, b, 0));    // e first (older), beside (1,-2)
  [st, c] = deploy(st, kiteOf(st, a, 1));    // c at (1,-2)
  const { state } = swapKites(st, { star: b, i: 0 }, { star: b, i: 5 }, OPTS);   // e's kite now faces (1,-2) too
  assertEqual(derive(state, OPTS).starAt(CORNER), e, 'the layout alone: first come, the older e');
  const kept = withdrawBlocked(state, OPTS, st);
  assertEqual([kept.withdrawn, derive(kept.state, OPTS).starAt(CORNER)], [[e], c], 'c was there before: e is withdrawn');
  const loaded = withdrawBlocked(state, OPTS);
  assertEqual([loaded.withdrawn, derive(loaded.state, OPTS).starAt(CORNER)], [[c], e], 'no before (loading a save): the older e keeps it');
});

test('W2: a kite swap that turns a branch onto the center blocks it, and it is withdrawn', () => {
  let [st, a] = twoRingStars();
  let c;
  [st, c] = deploy(st, kiteOf(st, a, 1));
  const { state, problem } = swapKites(st, { star: a, i: 1 }, { star: a, i: BACK }, OPTS);      // the back kite faces the center
  const w = withdrawBlocked(state, OPTS, st);
  assertEqual([problem, derive(state, OPTS).shown(c), w.withdrawn, derive(w.state, OPTS).starAt([0, 0])], [null, false, [c], central(st)]);
});

test('a star can be deployed sideways into any open position', () => {
  let [st, a] = twoRingStars();
  let c, w;
  [st, c] = deploy(st, kiteOf(st, a, 1));                     // (1,-2)
  st = openAll(st, c);
  [st, w] = deploy(st, derive(st, OPTS).kiteAtSlot(c, 5));   // its W kite faces (0,-2), also ring 2
  assertEqual(derive(st, OPTS).place(w).coord, [0, -2]);
  assertEqual(derive(st, OPTS).shown(w), true);
});

// ---- Checklist, attributes, relations, planned stars --------------------------------------------

test('roles: circles are clicked complete, boxes only assessed', () => {
  let st = createState(), d, read, hw;
  [st, d] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Learn');
  ({ state: st, dot: read } = addChild(st, d, 'Read notes'));               // circle (check)
  ({ state: st, dot: hw } = addChild(st, d, 'HW9'));
  st = updateDot(st, hw, { role: 'assess', marks: ['people', 'people'], props: { difficulty: 'hard' } });
  assertEqual([st.dots[hw].role, st.dots[hw].marks, st.dots[hw].props.difficulty], ['assess', ['people'], 'hard']);
  assertEqual(updateDot(st, hw, { role: 'nonsense' }).dots[hw].role, 'assess', 'unknown role ignored');
  assertEqual(checkDot(st, hw, true, NOW), st, 'a box can’t be checked by hand');
  assertEqual(assessDot(st, read, true, NOW), st, 'a circle isn’t assessed');
  st = checkDot(st, read, true, NOW);
  assertEqual(derive(st, OPTS).effective(d).status, 'training', 'half once anything is complete');
  st = assessDot(st, hw, true, NOW);
  assertEqual(derive(st, OPTS).effective(d).status, 'ignited', 'every child complete');
});

test('children: added in slot order on its star, planned on the first', () => {
  let st = createState(), d;
  [st, d] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Learn');
  const names = ['a', 'b', 'c', 'd', 'e'];
  for (const n of names) st = addChild(st, d, n).state;
  const star = st.dots[d].branch;
  assertEqual(!!star && st.stars[star].sources, [d], 'the first child planned its star');
  const view = derive(st, OPTS);
  assertEqual(view.children(d).map(c => st.dots[c].name), names, 'checklist order is slot order');
  const slots = childSlots(st, star);
  assertEqual(slots[0].kite, kiteOf(st, star, BACK), 'the back kite fills first');
  assertEqual(st.kites[slots[4].kite].dots[0], view.children(d)[4], 'then the next kite, from Nadir');
  const target = slots[10];
  const r = addChild(st, d, 'there', { target });
  assertEqual(r.state.kites[target.kite].dots[target.slot], r.dot, 'into a chosen free slot');
  assertEqual(addChild(r.state, d, 'again', { target }).problem, 'That slot isn’t free on its star.');
  let full = st;
  for (let i = names.length; i < 24; i++) full = addChild(full, d, 'x').state;
  assertEqual(addChild(full, d, 'one more').problem, 'Its star is full (24 star-dots).');
});

test('ignite and lapse: a star-dot’s own completion, whatever its role', () => {
  let st = createState(), d;
  [st, d] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Learn');
  st = ignite(updateDot(st, d, { role: 'assess' }), d, NOW);
  assertEqual([st.dots[d].ignitedAt, st.dots[d].trained], [NOW, true]);
  assertEqual(lapse(st, d).dots[d].ignitedAt, null);
});

test('notes: free lines on a star-dot, never counted', () => {
  let st = createState(), d;
  [st, d] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Learn');
  st = addDotNote(addDotNote(st, d, 'one'), d, 'two');
  assertEqual(st.dots[d].notes, ['one', 'two']);
  assertEqual(removeDotNote(st, d, 0).dots[d].notes, ['two']);
  assertEqual(derive(st, OPTS).own(d).status, 'open');
});

test('financial influence: a signed amount with a period, or nothing', () => {
  let st = createState(), d;
  [st, d] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Gig');
  st = updateDot(st, d, { props: { finance: { amount: 400, period: 'once' }, difficulty: 'high' } });
  assertEqual([st.dots[d].props.finance, st.dots[d].props.difficulty], [{ amount: 400, period: 'once' }, 'high']);
  assertEqual(updateDot(st, d, { props: { finance: { amount: -15, period: 'month' } } }).dots[d].props.finance, { amount: -15, period: 'month' });
  assertEqual(updateDot(st, d, { props: { finance: { amount: 5, period: 'daily' } } }).dots[d].props.finance, null, 'unknown period');
  assertEqual(updateDot(st, d, { props: { finance: 'medium' } }).dots[d].props.finance, null, 'old choice values aren’t amounts');
});

test('relations: one-way, scored 1–5, averaged by the related dots’ categories', () => {
  let st = createState(), a, b, c, e;
  const [k0, k1, k3] = [0, 1, 3].map(i => kiteOf(st, central(st), i));
  [st, a] = placeDot(st, k0, 0, 'A');
  [st, b] = placeDot(st, k1, 0, 'B');        // category 1
  [st, c] = placeDot(st, k1, 1, 'C');        // category 1
  [st, e] = placeDot(st, k3, 0, 'E');        // category 3
  st = addRelation(addRelation(addRelation(st, a, b, 5, 'practice'), a, c, 2), a, e);
  assertEqual(st.dots[a].relations, [{ dot: b, score: 5, how: 'practice' }, { dot: c, score: 2, how: '' }, { dot: e, score: 3, how: '' }]);
  assertEqual(addRelation(st, a, b), st, 'no duplicates');
  assertEqual(addRelation(st, a, a), st, 'not to itself');
  const rel = derive(st, OPTS).relevance(a);
  assertEqual([rel[1], rel[3], rel[0]], [{ avg: 3.5, count: 2 }, { avg: 3, count: 1 }, { avg: null, count: 0 }]);
  assertEqual(derive(st, OPTS).relevance(b).every(r => r.count === 0), true, 'one-way');
  assertEqual(derive(st, OPTS).relevantTo(b), [{ dot: a, score: 5, how: 'practice' }]);
  st = updateRelation(st, a, c, { score: 9, how: 'stats' });
  assertEqual(st.dots[a].relations[1], { dot: c, score: 3, how: 'stats' }, 'an out-of-range score falls back to 3');
  assertEqual(removeRelation(st, a, c).dots[a].relations.length, 2);
});

test('relations change no status, kite color or deployment', () => {
  let st = createState(), a, b;
  [st, a] = lit(st, kiteOf(st, central(st), 0), 0);
  [st, b] = placeDot(st, kiteOf(st, central(st), 1), 0, 'B');
  const k = kiteOf(st, central(st), 0);
  const [before, after] = [derive(st, OPTS), derive(addRelation(st, a, b, 5), OPTS)];
  assertEqual([after.effective(a), after.kiteProgress(k)], [before.effective(a), before.kiteProgress(k)]);
});

test('a planned star waits, stored, until deployed at an open Zenith; then it appears as authored (round 7, V1)', () => {
  let st = createState(), d, s, x;
  const k = kiteOf(st, central(st), 4);
  [st, d] = placeDot(st, k, ZENITH, 'Plan me');
  [st, s] = planStar(st, d);
  assertEqual([st.dots[d].branch, planStar(st, d)[1]], [s, s], 'planning twice returns the same star');
  st = updateKite(st, kiteOf(st, s, 0), { name: 'Theme' });
  [st, x] = placeDot(st, kiteOf(st, s, 0), 1, 'Authored task');      // a locked kite can be authored
  st = rotateKite(st, k);
  let view = derive(st, OPTS);
  assertEqual([view.shown(s), view.place(s).coord], [false, DIRS[4]], 'stored while its dot is off the Zenith');
  for (let i = 0; i < 3; i++) st = rotateKite(st, k);
  view = derive(st, OPTS);
  assertEqual(view.shown(s), false, 'back at the Zenith, still only planned: nothing deploys by itself');
  assertEqual(view.openings.some(o => o.dot === d), true, 'it can be deployed there');
  const r = deployStar(st, d, OPTS);
  st = r.state;
  view = derive(st, OPTS);
  assertEqual([r.star, view.shown(s), Object.keys(st.stars).length], [s, true, 2], 'Deploy its star puts the planned star on the map, not a new one');
  assertEqual([st.kites[kiteOf(st, s, 0)].name, st.dots[x].name, st.kites[kiteOf(st, s, 0)].color], ['Theme', 'Authored task', 4]);
  assertEqual(view.kiteOpen(kiteOf(st, s, 0)), false, 'authored kites still open by play');
  st = rotateKite(st, k);
  assertEqual(derive(st, OPTS).shown(s), false, 'rotated away: stored');
  for (let i = 0; i < 3; i++) st = rotateKite(st, k);
  assertEqual(derive(st, OPTS).shown(s), true, 'back: shown again, still deployed');
});

test('withdrawing takes a star off the map with its branch; redeploying brings the branch back as it was (V1)', () => {
  let [st, a] = twoRingStars();
  let c;
  [st, c] = deploy(st, kiteOf(st, a, 1));                         // a ring-2 star on the NW star
  const src = st.stars[a].sources[0];
  let r = withdrawStar(st, src);
  assertEqual([r.problem, derive(r.state, OPTS).shown(a), derive(r.state, OPTS).shown(c), r.state.stars[c].deployed], [null, false, false, true], 'its branch leaves with it, keeping its own flag');
  assertEqual([withdrawStar(r.state, src).problem, withdrawStar(createState(), 'nope').problem], ['Its star isn’t on the map.', 'It has no star.']);
  r = deployStar(r.state, src, OPTS);
  assertEqual([derive(r.state, OPTS).shown(a), derive(r.state, OPTS).shown(c)], [true, true], 'redeployed: the branch is back');
  assertEqual(createState().stars[central(createState())].deployed, true, 'the central star is always deployed');
});

test('locks off (V2): every kite is open, so nothing blocks completing or deploying', () => {
  let st = createState(), s;
  [st, s] = deploy(st, kiteOf(st, central(st), 0));
  const on = derive(st, OPTS), off = derive(st, { ...OPTS, locks: 'off' });
  assertEqual([st.stars[s].kites.filter(on.kiteOpen).length, st.stars[s].kites.filter(off.kiteOpen).length], [1, 6]);
  let d;
  [st, d] = placeDot(st, kiteOf(st, s, 0), 0, 'on a side kite');
  assertEqual([derive(st, OPTS).completable(d), derive(st, { ...OPTS, locks: 'off' }).completable(d)], [false, true], 'a star-dot is locked by the kite it sits on');
  [st, d] = placeDot(st, kiteOf(st, s, 0), ZENITH, 'Zenith of a side kite');
  assertEqual([deployStar(st, d, OPTS).problem != null, deployStar(st, d, { ...OPTS, locks: 'off' }).problem], [true, null], 'deploying from it needs it open');
});

test('planned stars nest: a planned star’s dot can have its own plan, placed through the chain', () => {
  let st = createState(), d, s1, d2, s2;
  [st, d] = placeDot(st, kiteOf(st, central(st), 0), ZENITH, 'Root');
  [st, s1] = planStar(st, d);
  [st, d2] = placeDot(st, kiteOf(st, s1, 1), ZENITH, 'Deeper');
  [st, s2] = planStar(st, d2);
  assertEqual(derive(st, OPTS).place(s2).coord, [1, -2], 'NW star, then its relative kite 1 (NE)');
});

// ---- Data ---------------------------------------------------------------------------------------

test('the state is plain JSON and never mutated', () => {
  const [st] = twoRingStars();
  const before = JSON.stringify(st);
  swapKites(st, { star: central(st), i: 0 }, { star: central(st), i: 3 }, OPTS);
  deployStar(st, st.kites[kiteOf(st, central(st), 2)].dots[ZENITH] ?? 'none', OPTS);
  assertEqual(JSON.stringify(st), before);
  assertEqual(JSON.parse(before), st);
});
