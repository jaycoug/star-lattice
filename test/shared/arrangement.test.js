// Attributes (inherited down the lineage), staleness, summaries and roll-ups over children; the
// schedule; per-star notes; the shelf; moves across stars with conflicts; removing and merging
// star-dots (shared/engine).

import { test, assertEqual } from '../runner.js';
import {
  createState, centralStar, derive, placeDot, updateDot, addChild, checkDot, addDotNote, ignite,
  addRelation, planStar, deployStar, swapDots, swapKites, shelveStar, shelveDot, shelveKite, placeFromShelf,
  removeDot, mergeDots, addNote, editNote, removeNote, boardMove, movesOf, canRotate, DESIGN_MOVES, retireDot, restoreDot, normalizeSave, index, childSlots,
  deleteDot, branchOf, placeBlocks, ZENITH, BACK, DAY,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const OPTS = { now: NOW, periods: { daily: 1, weekly: 7, never: null } };
const central = st => centralStar(st).id;
const kiteOf = (st, star, i) => st.stars[star].kites[i];

function lit(st, kite, slot) {
  let id;
  [st, id] = placeDot(st, kite, slot, 'task');
  return [ignite(st, id, NOW), id];
}
function deploy(st, kite) {
  [st] = lit(st, kite, ZENITH);
  st = deployStar(st, st.kites[kite].dots[ZENITH], OPTS).state;
  return [st, st.dots[st.kites[kite].dots[ZENITH]].branch];
}
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
function twoRingStars() {
  let st = createState(), a, b;
  [st, a] = deploy(st, kiteOf(st, central(st), 0));
  [st, b] = deploy(st, kiteOf(st, central(st), 1));
  return [openAll(openAll(st, a), b), a, b];
}
/** Three star-dots on central kites 0–2, slot 0. */
function three() {
  let st = createState(), p, q, r;
  [st, p] = placeDot(st, kiteOf(st, central(st), 0), 0, 'P');
  [st, q] = placeDot(st, kiteOf(st, central(st), 1), 0, 'Q');
  [st, r] = placeDot(st, kiteOf(st, central(st), 2), 0, 'R');
  return [st, p, q, r];
}
/** Add a child with attributes. Returns [state, childId]. */
function kid(st, parent, name, props = {}) {
  const { state, dot } = addChild(st, parent, name);
  return [updateDot(state, dot, { props }), dot];
}

// ---- Attributes, staleness, summaries -------------------------------------------------------------

test('each star-dot goes stale after its own Retrain, else its parent’s', () => {
  let [st, p] = three(), a, b;
  st = updateDot(st, p, { props: { persistence: 'weekly' } });
  [st, a] = kid(st, p, 'a', { persistence: 'daily' });
  [st, b] = kid(st, p, 'b');
  st = checkDot(checkDot(st, a, true, NOW), b, true, NOW);
  assertEqual(derive(st, OPTS).prop(b, 'persistence'), 'weekly', 'inherited from its parent');
  assertEqual(derive(st, OPTS).effective(p).status, 'ignited');
  const later = derive(st, { ...OPTS, now: NOW + 2 * DAY });
  assertEqual([later.fresh(a), later.fresh(b), later.effective(p).status], [false, true, 'training']);
  st = updateDot(st, a, { props: { persistence: null } });
  assertEqual(derive(st, { ...OPTS, now: NOW + 2 * DAY }).effective(p).status, 'ignited', 'cleared → inherited again');
});

test('summary: money by kind, the highest difficulty, places, the next to go stale, the nearest due date', () => {
  let [st, p] = three(), a, c;
  st = updateDot(st, p, { props: { environment: 'den', persistence: 'weekly' } });
  [st, a] = kid(st, p, 'a', { finance: { amount: -12, period: 'year' }, difficulty: 'hard', persistence: 'daily', due: '2001-01-01' });
  let b;
  [st, b] = kid(st, p, 'b', { finance: { amount: -10, period: 'week' }, difficulty: 'easy', environment: 'local', due: '2031-01-01' });
  [st, c] = kid(st, p, 'c', { finance: { amount: 400, period: 'once' }, difficulty: 'medium', due: '2030-06-01' });
  st = checkDot(checkDot(st, a, true, NOW), b, true, NOW);
  const s = derive(st, OPTS).summary(p);
  assertEqual([s.finance.monthly.toFixed(2), s.finance.once, s.finance.count], [(-1 - 10 * 52 / 12).toFixed(2), 400, 3], 'yearly ÷ 12, weekly × 52/12');
  assertEqual([s.difficulty, s.environment.counts], [{ highest: 'hard' }, { den: 2, local: 1 }]);
  assertEqual(s.persistence, { most: 'daily', nextStale: { at: NOW + DAY, dot: a, name: 'a' } });
  assertEqual(s.due, { nearest: { date: '2030-06-01', dot: c, name: 'c' }, overdue: 0 }, 'complete ones aren’t due');
  assertEqual(derive(st, { ...OPTS, now: Date.parse('2030-07-01') }).summary(p).due.overdue, 2, 'c, and a once it has gone stale');
});

test('a terminal star-dot’s summary shows its own values', () => {
  let [st, p] = three();
  st = updateDot(st, p, { props: { finance: { amount: 30, period: 'month' }, difficulty: 'medium' } });
  const s = derive(st, OPTS).summary(p);
  assertEqual([s.finance.monthly, s.difficulty.highest], [30, 'medium']);
});

test('the bullet’s Difficulty: its own while terminal, else its children’s highest, carried up every level', () => {
  let [st, p] = three(), a, b, c, d;
  [st, a] = kid(st, p, 'a', { difficulty: 'easy' });
  [st, b] = kid(st, p, 'b');
  [st, c] = kid(st, b, 'c', { difficulty: 'medium' });
  [st, d] = kid(st, b, 'd');
  const v = derive(st, OPTS);
  assertEqual([v.difficulty(a), v.difficulty(d), v.difficulty(b), v.difficulty(p)], ['easy', null, 'medium', 'medium'], 'unset ones don’t count');
  st = updateDot(st, d, { props: { difficulty: 'hard' } });
  assertEqual(derive(st, OPTS).difficulty(p), 'hard', 'a hard grandchild makes it hard');
  assertEqual(derive(st, { ...OPTS, difficultyOrder: ['hard', 'medium', 'easy'] }).difficulty(b), 'medium', 'the content set’s order decides (here medium ranks above hard)');
});

// ---- Rolling up (round 5): children at every level --------------------------------------------------

/** A deployed central Zenith star-dot with two children on its star's back kite, each with children: [state, src, a, b, syntax, plots, stats]. */
function family() {
  let st = createState(), s, a, b, syntax, plots, stats;
  [st, s] = deploy(st, kiteOf(st, central(st), 0));
  const src = st.kites[kiteOf(st, central(st), 0)].dots[ZENITH];
  st = updateDot(st, src, { props: { finance: { amount: 999, period: 'month' } } });
  const back = kiteOf(st, s, BACK);
  [st, a] = placeDot(st, back, 0, 'Python');
  [st, b] = placeDot(st, back, ZENITH, 'R');
  [st, syntax] = kid(st, a, 'syntax', { finance: { amount: -10, period: 'month' }, difficulty: 'hard', environment: 'den', persistence: 'weekly', due: '2030-06-01' });
  [st, plots] = kid(st, b, 'plots', { finance: { amount: 300, period: 'once' }, difficulty: 'easy', environment: 'local', persistence: 'daily', due: '2030-03-01' });
  [st, stats] = kid(st, b, 'stats', { difficulty: 'hard', environment: 'den', due: '2001-01-01' });
  return [st, src, a, b, syntax, plots, stats];
}

test('a star-dot’s children: the star-dots on its star, in slot order', () => {
  const [st, src, a, b, syntax] = family();
  const v = derive(st, OPTS);
  assertEqual([v.children(src), v.children(a), v.children(syntax)], [[a, b], [syntax], []]);
});

test('roll-up through every level: money sums, the highest difficulty, counts add, Retrain and Due take the soonest', () => {
  let [st, src, , , syntax] = family();
  st = checkDot(st, syntax, true, NOW);
  const s = derive(st, OPTS).summary(src);
  assertEqual([s.finance.monthly, s.finance.once, s.finance.count], [-10, 300, 2], 'its own $999 doesn’t count while it has children');
  assertEqual([s.difficulty.highest, s.environment.counts], ['hard', { den: 2, local: 1 }]);
  assertEqual([s.persistence.most, s.persistence.nextStale.dot, s.persistence.nextStale.name], ['daily', syntax, 'syntax']);
  assertEqual([s.due.nearest.date, s.due.nearest.name, s.due.overdue], ['2030-03-01', 'plots', 1], 'stats is overdue');
});

test('roll-up: relevance averages its own relations with its children’s', () => {
  let [st, src, a, b] = family();
  let other;
  [st, other] = placeDot(st, kiteOf(st, central(st), 1), 0, 'Elsewhere');
  st = addRelation(st, src, other, 5);
  st = addRelation(st, a, other, 1);
  st = addRelation(st, b, other, 3);
  assertEqual(derive(st, OPTS).relevance(src)[1], { avg: 3, count: 3 });
});

test('status comes from children at every level; the schedule lists the terminal ones', () => {
  let [st, src, a, b, syntax, plots, stats] = family();
  const status = id => derive(st, OPTS).effective(id).status;
  assertEqual(status(src), 'training', 'ignited once before: never below half');
  st = ignite(st, syntax, NOW);
  assertEqual([status(a), status(b), derive(st, OPTS).support(src)], ['ignited', 'open', { star: st.dots[src].branch, ignited: 1, total: 2, share: 100 }]);
  st = ignite(ignite(st, plots, NOW), stats, NOW);
  assertEqual(status(src), 'ignited', 'both children, through theirs');
  const dots = derive(st, OPTS).schedule(Date.parse('2031-01-01')).map(e => e.dot);
  assertEqual([src, a, b, syntax, plots, stats].map(d => dots.includes(d)), [false, false, false, true, true, true]);
});

test('Financial Influence is a star-dot’s own: never inherited, and $0 counts as none', () => {
  let [st, p] = three(), prep, meeting, sheet;
  st = updateDot(st, p, { props: { finance: { amount: 800, period: 'month' }, environment: 'den' } });
  [st, prep] = kid(st, p, 'prep');
  [st, meeting] = kid(st, p, 'meeting', { finance: { amount: 0, period: 'week' } });
  [st, sheet] = kid(st, p, 'time sheet', { finance: { amount: 200, period: 'week' } });
  const v = derive(st, OPTS);
  assertEqual([prep, meeting, sheet].map(c => v.marks(c).map(m => m.id)), [[], [], ['finance']], 'only the time sheet shows $');
  assertEqual([v.prop(prep, 'finance'), v.prop(prep, 'environment')], [null, 'den'], 'other attributes are inherited');
  assertEqual([v.summary(p).finance.monthly.toFixed(2), v.summary(p).finance.count], [(200 * 52 / 12).toFixed(2), 1]);
  const solo = updateDot(three()[0], three()[1], { props: { finance: { amount: 0, period: 'month' } } });
  assertEqual(derive(solo, OPTS).summary(three()[1]).finance.count, 0, '$0 on a terminal star-dot');
});

test('stage 4: with Kites lock on, PLAY moves nothing (kites or star-dots, any star); off, or with Central star only, Free moves', () => {
  let [st] = three();
  let s;
  [st, s] = deploy(st, kiteOf(st, central(st), 2));
  const LOCK = { ...OPTS, locks: 'on' };
  const moves = {
    'a kite swap on a deployed star': { kind: 'kites', a: { star: s, i: BACK }, b: { star: s, i: 0 } },
    'a star-dot between its kites': { kind: 'dots', a: { kite: kiteOf(st, s, BACK), slot: 0 }, b: { kite: kiteOf(st, s, 0), slot: 0 } },
    'a star-dot within one kite': { kind: 'dots', a: { kite: kiteOf(st, central(st), 2), slot: 0 }, b: { kite: kiteOf(st, central(st), 2), slot: ZENITH } },
    'a kite swap on the central star': { kind: 'kites', a: { star: central(st), i: 0 }, b: { star: central(st), i: 1 } },
  };
  for (const [what, m] of Object.entries(moves)) {
    assertEqual(/Kites lock is on/.test(boardMove(st, 'free', m, LOCK).problem), true, what);
    assertEqual(boardMove(st, 'free', m, LOCK).state, st, `${what}: unchanged`);
  }
  const swap = moves['a kite swap on a deployed star'];
  assertEqual(boardMove(st, 'free', swap, { ...OPTS, locks: 'off' }).problem, null, 'allowed with locks off');
  assertEqual(boardMove(st, 'free', moves['a kite swap on the central star'], { ...LOCK, kites: 'central' }).problem, null, 'and with Central star only (nothing locks)');
});

test('board rules (round 7, V3): Free moves anything anywhere (its own branch refused); Fixed only rotates', () => {
  let [st] = three();
  const FREE = { ...OPTS, locks: 'off' };   // Kites lock off (the engine's own default is on)
  const [k0, k1] = [kiteOf(st, central(st), 0), kiteOf(st, central(st), 1)];
  const inStar = { kind: 'dots', a: { kite: k0, slot: 0 }, b: { kite: k1, slot: 3 } };
  assertEqual(boardMove(st, 'fixed', inStar, FREE).state, st, 'fixed: nothing swaps');
  assertEqual(/only rotating/.test(boardMove(st, 'fixed', inStar, FREE).problem), true);
  const moved = boardMove(st, 'free', inStar, FREE);
  assertEqual([moved.problem, moved.state.kites[k1].dots[3]], [null, st.kites[k0].dots[0]]);
  let s;
  [st, s] = deploy(st, kiteOf(st, central(st), 2));
  const across = { kind: 'dots', a: { kite: k0, slot: 0 }, b: { kite: kiteOf(st, s, BACK), slot: 1 } };
  assertEqual(boardMove(st, 'free', across, FREE).problem, null, 'between stars too (Kites lock off)');
  const src = st.kites[kiteOf(st, central(st), 2)].dots[ZENITH];
  const loop = { kind: 'dots', a: { kite: kiteOf(st, central(st), 2), slot: ZENITH }, b: { kite: kiteOf(st, s, BACK), slot: 1 } };
  const r = boardMove(st, 'free', loop, FREE);
  assertEqual([r.state, r.conflict, /own branch. Resolve it in the Tree view/.test(r.problem)], [st, null, true], 'into its own branch: refused with PLAY’s reason, never shelved');
  assertEqual(st.dots[src].branch, s);
  const kites = { kind: 'kites', a: { star: central(st), i: 0 }, b: { star: central(st), i: 1 } };
  assertEqual(boardMove(st, 'free', kites, FREE).problem, null);
  assertEqual(/locked/.test(boardMove(st, 'bogus', kites, FREE).problem), true, 'an unknown rule allows nothing');
});

test('P3: the player’s movement switches (Swap, Rotate star-dots, Rotate kites); the designer moves freely', () => {
  let [st] = three();
  const FREE = { ...OPTS, locks: 'off' };
  const c = central(st);
  const turn = { kind: 'rotateKites', star: c };
  const swap = { kind: 'kites', a: { star: c, i: 0 }, b: { star: c, i: 1 } };
  assertEqual([movesOf('free'), movesOf('fixed'), movesOf('locked')].map(m => [m.swap, m.rotateDots, m.rotateKites]), [[true, true, false], [false, true, false], [false, false, false]], 'older board rules still read');
  assertEqual([canRotate({ rotateDots: true }), canRotate({ swap: true })], [true, false]);
  assertEqual(/locked/.test(boardMove(st, {}, swap, FREE).problem), true, 'all off: locked');
  assertEqual(boardMove(st, { swap: true }, turn, FREE).state, st, 'Swap alone doesn’t turn kites');
  assertEqual(boardMove(st, { rotateKites: true }, swap, FREE).state, st, 'Rotate kites alone doesn’t swap');
  const r = boardMove(st, { rotateKites: true }, turn, FREE);
  const before = st.stars[c].kites;
  assertEqual([r.problem, r.state.stars[c].kites], [null, before.map((_, i) => before[(i + 5) % 6])], 'each kite moves one place clockwise');
  assertEqual(r.state.kites[before[0]].dots, st.kites[before[0]].dots, 'carrying its star-dots');
  const LOCK = { ...OPTS, locks: 'on' };
  assertEqual(/Kites lock is on/.test(boardMove(st, { rotateKites: true, swap: true }, turn, LOCK).problem), true, 'Kites lock holds the player');
  assertEqual(boardMove(st, DESIGN_MOVES, swap, LOCK).problem, null, 'but not the designer');
  let s;
  [st, s] = deploy(st, kiteOf(st, central(st), 2));
  const t = boardMove(st, { rotateKites: true }, { kind: 'rotateKites', star: s }, FREE);
  assertEqual(t.problem === null || /land on another star/.test(t.problem), true, 'a deployed star turns too (or says what it would hit)');
});

test('X4: Bring to the Zenith is gone: boardMove refuses it under either rule (↻ Rotate does it)', () => {
  let [st] = three();
  const k0 = kiteOf(st, central(st), 0);
  const d = st.kites[k0].dots[0];
  for (const rule of ['fixed', 'free']) assertEqual(boardMove(st, rule, { kind: 'zenith', dot: d }, OPTS).state, st, rule);
});

test('deleting a star-dot takes its whole branch (V6): its star, every star-dot further out, their blocks and relations to them', () => {
  let st = createState(), p, a, b, g, other;
  [st, p] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Parent');
  ({ state: st, dot: a } = addChild(st, p, 'a'));
  ({ state: st, dot: b } = addChild(st, p, 'b'));
  ({ state: st, dot: g } = addChild(st, a, 'grandchild'));
  [st, other] = placeDot(st, kiteOf(st, central(st), 1), 0, 'Other');
  st = addRelation(st, other, g, 4);
  st = placeBlocks(st, a, new Date(2026, 10, 9).getTime(), 1).state;
  const stars = [st.dots[p].branch, st.dots[a].branch];
  assertEqual(branchOf(st, p).dots.sort(), [p, a, b, g].sort(), 'what the confirmation counts');
  const after = deleteDot(st, p);
  assertEqual([p, a, b, g].some(d => after.dots[d]), false, 'the star-dot and everything on its star, further out too');
  assertEqual([stars.some(s => after.stars[s]), Object.keys(after.kites).length, after.blocks.length], [false, 6, 0], 'their stars and kites, and the blocks');
  assertEqual([after.dots[other].relations, index(after).dot.has(other)], [[], true], 'others keep their place, minus relations to what went');
  assertEqual(deleteDot(st, 'nope'), st);
  const leaf = deleteDot(st, b);
  assertEqual([!!leaf.dots[b], !!leaf.dots[a], !!leaf.dots[p]], [false, true, true], 'a terminal one goes alone');
});

test('schedule: due dates on their day, retrain ones when they go stale, overdue kept, shelved branches left out', () => {
  let [st, p, q] = three();
  const day = d => new Date(d + 'T00:00:00').getTime();
  const now = day('2030-01-10') + 12 * 3600e3;
  const opts = { ...OPTS, now };
  const ids = {};
  for (const [name, props] of [['exam', { due: '2030-01-12' }], ['late', { due: '2030-01-05' }], ['far', { due: '2030-06-01' }],
    ['weekly', { persistence: 'weekly' }], ['daily, never checked', { persistence: 'daily' }], ['daily, stale', { persistence: 'daily' }], ['plain', {}]]) {
    [st, ids[name]] = kid(st, p, name, props);
  }
  st = checkDot(st, ids.weekly, true, now - DAY);
  st = checkDot(st, ids['daily, stale'], true, now - 2 * DAY);
  let shelved;
  [st, shelved] = kid(st, q, 'shelved one', { due: '2030-01-11' });
  st = shelveDot(st, q);
  const list = derive(st, opts).schedule(day('2030-02-07'));
  const brief = list.map(e => [st.dots[e.dot].name, e.kind, e.overdue, e.done]);
  assertEqual(brief, [
    ['late', 'due', true, false],
    ['daily, stale', 'retrain', true, false],
    ['daily, never checked', 'retrain', false, false],
    ['exam', 'due', false, false],
    ['weekly', 'retrain', false, true],
  ]);
  assertEqual(list.find(e => e.kind === 'retrain' && e.done).at, now - DAY + 7 * DAY, 'the weekly one goes stale a week after it was checked');
  st = checkDot(st, ids.exam, true, now);
  assertEqual(derive(st, opts).schedule(day('2030-02-07')).find(e => e.dot === ids.exam).done, true, 'a complete due one stays on its day, marked done');
  assertEqual(list.some(e => e.dot === shelved), false, 'a child of a shelved star-dot is off the map');
});

test('attribute values are checked: a due date is YYYY-MM-DD', () => {
  let [st, p] = three();
  assertEqual(updateDot(st, p, { props: { due: 'soon' } }).dots[p].props.due, null);
  assertEqual(updateDot(st, p, { props: { due: '2030-01-02', bogus: 1 } }).dots[p].props, { environment: null, finance: null, persistence: null, difficulty: null, due: '2030-01-02' });
});

// ---- Notes --------------------------------------------------------------------------------------

test('every star has its own notes', () => {
  let st = createState();
  const c = central(st);
  st = addNote(addNote(st, c, 'one'), c, 'two');
  st = removeNote(editNote(st, c, 1, 'TWO'), c, 0);
  assertEqual(st.stars[c].notes, ['TWO']);
});

// ---- Moves across stars, conflicts and the shelf --------------------------------------------------

test('a star-dot moved to another star notes where it came from; within a star it doesn’t', () => {
  let [st, a] = twoRingStars();
  let x;
  [st, x] = placeDot(st, kiteOf(st, central(st), 2), 3, 'X');
  let { state, problem } = swapDots(st, { kite: kiteOf(st, central(st), 2), slot: 3 }, { kite: kiteOf(st, a, 0), slot: 3 }, OPTS);
  assertEqual([problem, state.kites[kiteOf(st, a, 0)].dots[3], state.dots[x].history], [null, x, [{ text: 'Moved from Kite › central star', at: NOW }]]);
  state = swapDots(state, { kite: kiteOf(st, a, 0), slot: 3 }, { kite: kiteOf(st, a, 2), slot: 3 }, OPTS).state;
  assertEqual(state.dots[x].history.length, 1);
});

test('moving a star-dot into its own branch is a conflict; shelving moves it alone and shelves the branch', () => {
  const [st, a] = twoRingStars();
  const from = { kite: kiteOf(st, central(st), 0), slot: ZENITH };
  const d = st.kites[from.kite].dots[ZENITH];
  const to = { kite: kiteOf(st, a, 0), slot: 3 };
  const refused = swapDots(st, from, to, OPTS);
  assertEqual([refused.state === st, refused.conflict], [true, 'ownBranch']);
  const { state, problem } = swapDots(st, from, to, OPTS, { onConflict: 'shelve' });
  assertEqual([problem, state.stars[a].shelved, state.dots[d].branch, state.shelf], [null, true, null, [{ kind: 'star', id: a }]]);
  const view = derive(state, OPTS);
  assertEqual([view.shown(a), view.place(a), centralStar(state).id], [false, null, central(st)], 'off the map; the center stays');
});

test('a move that used to clash (a branch landing on another star) is no conflict: the star is blocked, for the app to withdraw (W2)', () => {
  let [st, , b] = twoRingStars();
  const [st1, a] = [st, st.dots[st.kites[kiteOf(st, central(st), 0)].dots[ZENITH]].branch];
  [st] = deploy(st1, kiteOf(st1, a, 1));
  let c;
  [st, c] = deploy(st, kiteOf(st, b, 0));
  const r = swapKites(st, { star: b, i: 0 }, { star: b, i: 5 }, OPTS);
  const view = derive(r.state, OPTS);
  assertEqual([r.problem, r.conflict, r.state.shelf, view.shown(c), view.blocked.map(x => x.star), view.problems().size], [null, null, [], false, [c], 0]);
});

// ---- Retiring (round 6, U7, U8) -------------------------------------------------------------------

/** A star-dot on a central kite with three children, two of them complete. */
function retireFamily() {
  let st = createState(), p, a, b, c;
  [st, p] = placeDot(st, kiteOf(st, central(st), 0), 0, 'Parent');
  ({ state: st, dot: a } = addChild(st, p, 'a'));
  ({ state: st, dot: b } = addChild(st, p, 'b'));
  ({ state: st, dot: c } = addChild(st, p, 'c'));
  st = checkDot(checkDot(st, a, true, NOW), b, true, NOW);
  return [st, p, a, b, c];
}

test('retiring: the star-dot leaves its slot with its star; its parent counts only the children left (U7)', () => {
  let [st, p, a, , c] = retireFamily();
  let g;
  ({ state: st, dot: g } = addChild(st, a, 'grandchild'));
  const slot = index(st).dot.get(a);
  assertEqual(derive(st, OPTS).support(p), { star: st.dots[p].branch, ignited: 1, total: 3, share: 100 }, 'before: b; a has an open child now');
  st = retireDot(st, a, NOW + 5);
  const view = derive(st, OPTS);
  assertEqual([st.kites[slot.kite].dots[slot.slot], st.retired], [null, [{ id: a, at: NOW + 5, from: { parent: p, kite: slot.kite, slot: slot.slot } }]], 'its slot frees up');
  assertEqual([view.support(p).ignited, view.support(p).total], [1, 2], 'b of b and c');
  assertEqual([st.dots[a].branch != null, view.place(st.dots[a].branch), index(st).dot.has(g)], [true, null, true], 'its star and child come along, off the map');
  st = checkDot(st, c, true, NOW);
  assertEqual(derive(st, OPTS).effective(p).status, 'ignited', 'the two children left are complete');
  assertEqual(retireDot(st, a, NOW), st, 'retiring twice does nothing');
  assertEqual(normalizeSave({ format: 'star-lattice-save', content: 'x', state: st }).state.retired.map(e => e.id), [a], 'kept on loading, not moved to the shelf');
  assertEqual(normalizeSave({ format: 'star-lattice-save', content: 'x', state: st }).state.shelf, []);
});

test('restoring: its old slot, else its old parent’s next free slot, else the shelf (U8)', () => {
  let [st, p, a] = retireFamily();
  const slot = index(st).dot.get(a);
  let r = restoreDot(retireDot(st, a, NOW), a, OPTS);
  assertEqual([r.where, r.state.kites[slot.kite].dots[slot.slot], r.state.retired, r.state.dots[a].history[0].text], ['slot', a, [], 'Restored from retirement']);
  // Its old slot taken: the parent's next free slot.
  let retired = retireDot(st, a, NOW), x;
  [retired, x] = placeDot(retired, slot.kite, slot.slot, 'took its place');
  r = restoreDot(retired, a, OPTS);
  const free = childSlots(retired, retired.dots[p].branch).find(s => !retired.kites[s.kite].dots[s.slot]);
  assertEqual([r.where, r.state.kites[free.kite].dots[free.slot], r.state.kites[slot.kite].dots[slot.slot]], ['parent', a, x]);
  // Its parent gone too: the shelf.
  r = restoreDot(removeDot(retired, p), a, OPTS);
  assertEqual([r.where, r.state.shelf.some(e => e.kind === 'dot' && e.id === a)], ['shelf', true]);
  assertEqual(restoreDot(st, a, OPTS).problem, 'That star-dot isn’t retired.');
  assertEqual(removeDot(retireDot(st, a, NOW), a).retired, [], 'removing a retired star-dot takes it out of the bank');
});

test('kites move between stars and keep their category; central kites stay home', () => {
  const [st, a, b] = twoRingStars();
  const ka = kiteOf(st, a, 2);
  const { state, problem } = swapKites(st, { star: a, i: 2 }, { star: b, i: 4 }, OPTS);
  assertEqual([problem, state.stars[b].kites[4], state.kites[ka].color], [null, ka, 0], 'the NW kite (category 0) now on the NE star');
  assertEqual(state.dots[st.kites[ka].dots[0]].history[0].text.endsWith('’s star'), true);
  assertEqual(swapKites(st, { star: central(st), i: 0 }, { star: a, i: 2 }, OPTS).problem, 'Central kites stay on the central star.');
});

test('the shelf: star-dots, kites and stars come off and go back', () => {
  let [st, p] = three();
  const k = kiteOf(st, central(st), 0);
  st = shelveDot(st, p);
  assertEqual([st.kites[k].dots[0], st.shelf, derive(st, OPTS).categoryOf(p)], [null, [{ kind: 'dot', id: p }], null]);
  let r = placeFromShelf(st, { kind: 'dot', id: p }, { kite: k, slot: 1 }, OPTS);
  assertEqual([r.state.kites[k].dots[1], r.state.shelf, r.state.dots[p].history[0].text], [p, [], 'Placed from the shelf']);
  st = r.state;
  let s;
  [st, s] = planStar(st, p);
  st = shelveStar(st, s);
  assertEqual([st.dots[p].branch, st.stars[s].sources, st.stars[s].shelved], [null, [], true]);
  r = placeFromShelf(st, { kind: 'star', id: s }, { dot: p }, OPTS);
  assertEqual([r.state.dots[p].branch, r.state.stars[s].sources, r.state.stars[s].shelved, r.state.shelf], [s, [p], false, []]);
  st = r.state;
  const sk = kiteOf(st, s, 1);
  st = shelveKite(st, sk);
  assertEqual([st.stars[s].kites[1] !== sk, st.kites[st.stars[s].kites[1]].color, st.shelf], [true, st.kites[sk].color, [{ kind: 'kite', id: sk }]], 'an empty kite of its color fills in');
  r = placeFromShelf(st, { kind: 'kite', id: sk }, { star: s, i: 1 }, OPTS);
  assertEqual([r.state.stars[s].kites[1], r.state.shelf], [sk, []], 'the empty stand-in isn’t shelved');
  assertEqual(shelveKite(st, kiteOf(st, central(st), 0)), st, 'central kites can’t be shelved');
});

// ---- Removing and merging ---------------------------------------------------------------

test('removing a star-dot drops relations to it and shelves its star', () => {
  let [st, p, q] = three();
  let s;
  [st, s] = planStar(st, p);
  st = addRelation(st, q, p, 4);
  st = removeDot(st, p);
  assertEqual([p in st.dots, st.dots[q].relations, st.stars[s].shelved, st.shelf], [false, [], true, [{ kind: 'star', id: s }]]);
});

test('merge: its children come along on its star, notes appended, relations combined, a note is left', () => {
  let [st, p, q, r] = three(), a;
  st = updateDot(st, p, { description: 'old one' });
  [st, a] = kid(st, p, 'a');
  st = checkDot(st, a, true, NOW);
  st = addDotNote(addDotNote(st, q, 'mine'), p, 'theirs');
  st = addRelation(addRelation(st, p, q, 2), p, r, 4, 'x');
  st = addRelation(st, q, r, 5, 'y');
  st = addRelation(st, r, p, 3, 'z');
  st = { ...st, dots: { ...st.dots, [p]: { ...st.dots[p], trained: true } } };
  const s = st.dots[p].branch;
  const { state, problem } = mergeDots(st, p, q, OPTS);
  const dot = state.dots[q];
  assertEqual([problem, p in state.dots], [null, false]);
  assertEqual([derive(state, OPTS).children(q), derive(state, OPTS).effective(q).status], [[a], 'ignited'], 'its child came along, complete');
  assertEqual(dot.notes, ['mine', 'theirs']);
  assertEqual(dot.relations, [{ dot: r, score: 5, how: 'y / x' }], 'higher score, notes joined; no relation to itself');
  assertEqual(state.dots[r].relations, [{ dot: q, score: 3, how: 'z' }], 're-pointed');
  assertEqual([dot.branch, state.stars[s].sources, dot.description, dot.trained], [s, [q], 'Merged from P: old one', true]);
  assertEqual(state.kites[kiteOf(st, central(st), 0)].dots[0], null, 'its slot empties');
});

test('merge: a target with its own star sends the source’s star to the shelf; never into its own branch', () => {
  let [st, p, q] = three();
  let s, t, x;
  [st, s] = planStar(st, p);
  [st, t] = planStar(st, q);
  let { state } = mergeDots(st, p, q, OPTS);
  assertEqual([state.dots[q].branch, state.stars[s].shelved], [t, true]);
  [st, x] = placeDot(st, kiteOf(st, s, 0), 0, 'Inside');
  assertEqual(mergeDots(st, p, x, OPTS).conflict, 'ownBranch');
});
