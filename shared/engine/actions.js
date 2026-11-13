// Every change to the engine state. Pure: each returns a new state (or the same state when the
// change doesn't apply). Moves return { state, problem, conflict }: problem is null, or why the
// move didn't happen (state then unchanged); conflict names a physical clash ('land': a branch
// would land on another star; 'ownBranch': a star-dot would move into its own branch). Passing
// { onConflict: 'shelve' } resolves a clash by putting the clashing star on the shelf instead.
// Stars appear only when deployed (deployStar; planning a star doesn't deploy it, and
// withdrawStar takes it off again); nothing deploys on its own.

import { coordKey } from '../lattice.js';
import {
  DOTS, KITES, ZENITH, PROPS, ROLES, PERIODS, SCORES, withDefaults, addStar, blankDot, blankKite,
  index, starOfDot, parentOf, descendants, centralStar, childSlots, maxChildren,
} from './model.js';
import { derive } from './derive.js';
import { dropBlocks } from './blocks.js';
import { normalizeDesign } from '../kiteDesign.js';
import { independentOn, listKiteOf, openedBy, dropItem, removeStars } from './independent.js';

const setDot = (st, id, patch) => ({ ...st, dots: { ...st.dots, [id]: { ...st.dots[id], ...patch } } });
const setKite = (st, id, patch) => ({ ...st, kites: { ...st.kites, [id]: { ...st.kites[id], ...patch } } });
const setStar = (st, id, patch) => ({ ...st, stars: { ...st.stars, [id]: { ...st.stars[id], ...patch } } });
const replaceAt = (list, i, v) => list.map((x, j) => (j === i ? v : x));
const newId = (st, prefix) => [prefix + st.nextId, { ...st, nextId: st.nextId + 1 }];

// ---- Dots and kites ---------------------------------------------------------------------------

/** Create a dot named `name` in an empty slot of a kite. Returns [state, dotId]. */
export function placeDot(st, kiteId, slot, name) {
  if (st.kites[kiteId].dots[slot]) return [st, null];
  const [id, next] = newId(st, 'd');
  return [setKite({ ...next, dots: { ...next.dots, [id]: blankDot(id, name) } }, kiteId, { dots: replaceAt(st.kites[kiteId].dots, slot, id) }), id];
}

/**
 * A valid value for attribute `id`, or null: finance is { amount, period } (amount a signed number:
 * + earns, − costs); due is a date "YYYY-MM-DD"; the others are a content-set choice ID.
 */
export function propValue(id, v) {
  if (v == null || v === '') return null;
  if (id === 'finance') return Number.isFinite(v.amount) && PERIODS.includes(v.period) ? { amount: v.amount, period: v.period } : null;
  if (id === 'due') return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  return typeof v === 'string' ? v : null;
}
const propsPatch = (old, props) => ({ ...old, ...Object.fromEntries(Object.entries(props ?? {}).filter(([k]) => PROPS.includes(k)).map(([k, v]) => [k, propValue(k, v)])) });

/** Change a dot's name, description, role ('check' | 'assess'), free marks or attributes (props merge; null clears one). */
export function updateDot(st, dotId, { name, description, role, marks, props }) {
  const dot = st.dots[dotId];
  return setDot(st, dotId, {
    ...(name !== undefined && { name }), ...(description !== undefined && { description }),
    ...(ROLES.includes(role) && { role }),
    ...(Array.isArray(marks) && { marks: [...new Set(marks.filter(m => typeof m === 'string'))] }),
    ...(props && { props: propsPatch(dot.props, props) }),
  });
}

/** Give a star-dot's screen its own widget layout (layout.js), or drop it (null: the content set's again). */
export function setDotLayout(st, dotId, layout) {
  if (!st.dots[dotId]) return st;
  const { layout: _, ...rest } = st.dots[dotId];
  return { ...st, dots: { ...st.dots, [dotId]: layout ? { ...rest, layout } : rest } };
}

export const updateKite = (st, kiteId, { name, description }) =>
  setKite(st, kiteId, { ...(name !== undefined && { name }), ...(description !== undefined && { description }) });

/** A kite slot's own label ('' shows the content set's slot name, Nadir, Port, …). */
export const setSlotLabel = (st, kiteId, slot, label) => (st.kites[kiteId] && slot >= 0 && slot < DOTS
  ? setKite(st, kiteId, { labels: replaceAt(st.kites[kiteId].labels, slot, String(label ?? '').trim()) }) : st);

/** A kite's own design, or null to show its category's design (from the content set). */
export const setKiteDesign = (st, kiteId, design) => (st.kites[kiteId] ? setKite(st, kiteId, { design: design == null ? null : normalizeDesign(design) }) : st);

// ---- Notes (per star) ---------------------------------------------------------------------------

export const addNote = (st, starId, text) => setStar(st, starId, { notes: [...st.stars[starId].notes, text] });
export const editNote = (st, starId, i, text) => setStar(st, starId, { notes: replaceAt(st.stars[starId].notes, i, text) });
export const removeNote = (st, starId, i) => setStar(st, starId, { notes: st.stars[starId].notes.filter((_, j) => j !== i) });

// ---- Completion and notes (a star-dot's own, round 5) ----------------------------------------------

/** Mark a star-dot complete (dated `now`) or not. Completing marks it trained for good. */
function complete(st, dotId, done, now) {
  const dot = st.dots[dotId];
  if (!dot) return st;
  return setDot(st, dotId, { ignitedAt: done ? now : null, trained: dot.trained || done });
}

/** Check or uncheck a 'check' star-dot (circle bullet). Assessed ones can't be checked by hand. */
export const checkDot = (st, dotId, done, now) => (st.dots[dotId]?.role === 'check' ? complete(st, dotId, done, now) : st);

/** Record an 'assess' star-dot (box bullet) as assessed, or not: the assessor's result. */
export const assessDot = (st, dotId, done, now) => (st.dots[dotId]?.role === 'assess' ? complete(st, dotId, done, now) : st);

/** Ignite now (the override): complete it, dated now, whatever its role. */
export const ignite = (st, dotId, now) => complete(st, dotId, true, now);

/** Lapse by hand: undo its completion. */
export const lapse = (st, dotId) => complete(st, dotId, false, null);

/** A star-dot's notes: free lines, never completed or counted. */
export const addDotNote = (st, dotId, text) => setDot(st, dotId, { notes: [...st.dots[dotId].notes, text] });
export const editDotNote = (st, dotId, i, text) => setDot(st, dotId, { notes: replaceAt(st.dots[dotId].notes, i, text) });
export const removeDotNote = (st, dotId, i) => setDot(st, dotId, { notes: st.dots[dotId].notes.filter((_, j) => j !== i) });

// ---- Children ----------------------------------------------------------------------

/**
 * Add a child named `name` to a star-dot: into `target` ({ kite, slot }, a free slot of its own
 * star) or the next free slot in fill order (the back kite first, then outward; Nadir to Starboard
 * on each kite), planning its star first if it has none. `options` are the rule options
 * (a kite-less star offers only its per-star count, inner rings first). Returns { state, dot, problem }.
 */
export function addChild(st, dotId, name = '', { target = null, options = undefined } = {}) {
  if (!st.dots[dotId]) return { state: st, dot: null, problem: 'No such star-dot.' };
  const opts = withDefaults(options);
  const [next, starId] = planStar(st, dotId);
  const free = childSlots(next, starId, opts).filter(s => !next.kites[s.kite].dots[s.slot]);
  const at = target ? free.find(s => s.kite === target.kite && s.slot === target.slot) : free[0];
  if (!at) return { state: st, dot: null, problem: target ? 'That slot isn’t free on its star.' : `Its star is full (${maxChildren(next, starId, opts)} star-dots).` };
  const [state, id] = placeDot(next, at.kite, at.slot, name);
  return { state, dot: id, problem: null };
}

// ---- Relations ----------------------------------------------------------------------------------

const scoreOf = v => (SCORES.includes(v) ? v : 3);

/** Relate `dotId` to `otherId` (one-way): a score 1–5 (default 3) and a note on how. */
export function addRelation(st, dotId, otherId, score = 3, how = '') {
  const dot = st.dots[dotId];
  if (!st.dots[otherId] || otherId === dotId || dot.relations.some(r => r.dot === otherId)) return st;
  return setDot(st, dotId, { relations: [...dot.relations, { dot: otherId, score: scoreOf(score), how }] });
}

/** Change a relation's score or note. */
export function updateRelation(st, dotId, otherId, { score, how }) {
  return setDot(st, dotId, {
    relations: st.dots[dotId].relations.map(r => (r.dot !== otherId ? r : {
      ...r, ...(score !== undefined && { score: scoreOf(score) }), ...(how !== undefined && { how }),
    })),
  });
}
export const removeRelation = (st, dotId, otherId) => setDot(st, dotId, { relations: st.dots[dotId].relations.filter(r => r.dot !== otherId) });

/** One relation from two to the same star-dot: the higher score, both notes joined. */
function combine(a, b) {
  const how = [...new Set([a.how, b.how].map(x => x.trim()).filter(Boolean))].join(' / ');
  return { dot: a.dot, score: Math.max(a.score, b.score), how };
}
/** A relations list with duplicates combined and relations to `self` dropped. */
function combined(list, self) {
  const byDot = new Map();
  for (const r of list) {
    if (r.dot === self) continue;
    byDot.set(r.dot, byDot.has(r.dot) ? combine(byDot.get(r.dot), r) : r);
  }
  return [...byDot.values()];
}

// ---- The shelf ----------------------------------------------------------------------------------

const onShelf = (st, kind, id) => st.shelf.some(e => e.kind === kind && e.id === id);
const shelfAdd = (st, kind, id) => (onShelf(st, kind, id) ? st : { ...st, shelf: [...st.shelf, { kind, id }] });
const shelfRemove = (st, kind, id) => ({ ...st, shelf: st.shelf.filter(e => !(e.kind === kind && e.id === id)) });

/** Put a (non-central) star on the shelf: it detaches from the star-dot(s) it was deployed from, keeping its kites and branch. */
export function shelveStar(st, starId) {
  const star = st.stars[starId];
  if (!star || !star.sources.length) return st;
  for (const d of star.sources) st = setDot(st, d, { branch: null });
  return shelfAdd(setStar(st, starId, { sources: [], shelved: true }), 'star', starId);
}

/** Take a star-dot out of its slot onto the shelf (its branch stays with it, out of sight). */
export function shelveDot(st, dotId) {
  const at = index(st).dot.get(dotId);
  if (!at) return st;
  return shelfAdd(setKite(st, at.kite, { dots: replaceAt(st.kites[at.kite].dots, at.slot, null) }), 'dot', dotId);
}

/** Take a kite (not a central one) out of its star onto the shelf; an empty kite of its color takes its place. */
export function shelveKite(st, kiteId) {
  const at = index(st).kite.get(kiteId);
  if (!at || at.star === centralStar(st).id) return st;
  const [id, next] = newId(st, 'k');
  st = { ...next, kites: { ...next.kites, [id]: blankKite(id, st.kites[kiteId].color) } };
  st = setStar(st, at.star, { kites: replaceAt(st.stars[at.star].kites, at.i, id) });
  return shelfAdd(st, 'kite', kiteId);
}

const emptyKite = kite => !kite.name && !kite.description && kite.dots.every(d => !d);

/**
 * Place something from the shelf: a star-dot into a slot { kite, slot } (a star-dot already there
 * goes to the shelf); a kite into a kite position { star, i } of a non-central star (the kite there
 * goes to the shelf unless it's empty); a star onto a star-dot { dot } that has no star of its own.
 * Returns { state, problem, conflict } like the moves.
 */
export function placeFromShelf(st, { kind, id }, target, options, how = {}) {
  if (!onShelf(st, kind, id)) return { state: st, problem: 'That isn’t on the shelf.', conflict: null };
  let next = shelfRemove(st, kind, id);
  const opts = withDefaults(options);
  if (kind === 'dot') {
    const there = next.kites[target.kite].dots[target.slot];
    next = setKite(next, target.kite, { dots: replaceAt(next.kites[target.kite].dots, target.slot, id) });
    if (there) next = shelfAdd(next, 'dot', there);
    next = noteMove(next, id, 'Placed from the shelf', opts.now);
    return settle(st, next, opts, how, [id]);
  }
  if (kind === 'kite') {
    if (target.star === centralStar(next).id) return { state: st, problem: 'Central kites stay on the central star.', conflict: null };
    const there = next.stars[target.star].kites[target.i];
    next = setStar(next, target.star, { kites: replaceAt(next.stars[target.star].kites, target.i, id) });
    if (!emptyKite(next.kites[there])) next = shelfAdd(next, 'kite', there);
    return settle(st, next, opts, how, next.kites[id].dots.filter(Boolean));
  }
  const dot = next.dots[target.dot];
  if (!dot || (dot.branch && next.stars[dot.branch])) return { state: st, problem: 'That star-dot already has a star.', conflict: null };
  next = setDot(setStar(next, id, { sources: [target.dot], shelved: false }), target.dot, { branch: id });
  return settle(st, next, opts, how, [target.dot]);
}

// ---- Retiring ---------------------------------------------------------------------

/** A star-dot and every star-dot in its branch (the children on its star, theirs, and so on). */
function branchDots(st, dotId) {
  const out = [dotId];
  const b = st.dots[dotId]?.branch;
  if (b && st.stars[b]) for (const s of [b, ...descendants(st, b)]) for (const k of st.stars[s].kites) out.push(...st.kites[k].dots.filter(Boolean));
  return out;
}

/**
 * Retire a star-dot on the map: it leaves its slot, which frees up, with its star and
 * everything on it, and goes to the front of `retired`, remembering its parent, kite and slot and
 * when. Its parent then counts only the children still on its star. The blocks after `now` of it
 * and its branch go.
 */
export function retireDot(st, dotId, now) {
  const at = index(st).dot.get(dotId);
  if (!at) return st;
  const from = { parent: parentOf(st, dotId), kite: at.kite, slot: at.slot };
  st = setKite(st, at.kite, { dots: replaceAt(st.kites[at.kite].dots, at.slot, null) });
  st = { ...st, retired: [{ id: dotId, at: now, from }, ...st.retired] };
  return dropBlocks(st, branchDots(st, dotId), now);
}

/**
 * Bring a retired star-dot back: to its old slot if that's free (and on the map), else its
 * old parent's next free slot (planning the parent's star if needed, while the parent is on the
 * map), else the shelf. Never into its own branch. Returns { state, problem, where:
 * 'slot' | 'parent' | 'shelf' }; it notes the restore in its history.
 */
export function restoreDot(st, dotId, options) {
  const opts = withDefaults(options);
  const entry = st.retired.find(e => e.id === dotId);
  if (!entry || !st.dots[dotId]) return { state: st, problem: 'That star-dot isn’t retired.', where: null };
  let next = { ...st, retired: st.retired.filter(e => e.id !== dotId) };
  const usable = (state, { kite, slot }) => {
    const at = index(state).kite.get(kite);
    return !!at && !state.stars[at.star].shelved && !state.kites[kite].dots[slot] && !intoOwnBranch(state, dotId, at.star);
  };
  const { parent, kite, slot } = entry.from;
  let target = null;
  let where = 'shelf';
  if (next.kites[kite] && usable(next, { kite, slot })) [target, where] = [{ kite, slot }, 'slot'];
  else if (parent && index(next).dot.has(parent)) {
    const [planned, starId] = planStar(next, parent);
    const free = childSlots(planned, starId, opts).find(s => usable(planned, s));
    if (free) [next, target, where] = [planned, free, 'parent'];
  }
  next = target ? setKite(next, target.kite, { dots: replaceAt(next.kites[target.kite].dots, target.slot, dotId) }) : shelfAdd(next, 'dot', dotId);
  return { state: noteMove(next, dotId, 'Restored from retirement', opts.now), problem: null, where };
}

// ---- Moves --------------------------------------------------------------------------------------

/** "Moved from Career › Interview Prep’s star" (or "… › central star"; "Placed from the shelf"): a history note. */
function whereText(st, kiteId) {
  const at = index(st).kite.get(kiteId);
  if (!at) return 'Placed from the shelf';
  const star = st.stars[at.star];
  const starText = star.sources.length ? `${star.sources.map(d => st.dots[d].name || 'unnamed').join(' + ')}’s star` : star.shelved ? 'a shelved star' : 'central star';
  return `Moved from ${st.kites[kiteId].name || 'Kite'} › ${starText}`;
}

/** Record that a dot moved from `from` (text), if it moved to a different star. */
function noteMove(st, dotId, from, now, fromStar = undefined) {
  if (fromStar !== undefined && fromStar === starOfDot(st, dotId)) return st;
  return setDot(st, dotId, { history: [{ text: from, at: now }, ...st.dots[dotId].history] });
}

/**
 * Finish a move: if it adds a layout clash, either report it (state unchanged) or, with
 * how.onConflict 'shelve', put the branches of the moved star-dots (`moved`) on the shelf.
 */
function settle(st, next, opts, how, moved) {
  const before = derive(st, opts).problems();
  const clash = [...derive(next, opts).problems()].some(p => !before.has(p));
  if (!clash) return { state: next, problem: null, conflict: null };
  if (how.onConflict !== 'shelve') return { state: st, problem: 'A branch would land on another star.', conflict: 'land' };
  for (const d of moved) if (next.dots[d]?.branch) next = shelveStar(next, next.dots[d].branch);
  return { state: next, problem: null, conflict: null };
}

/** Turn a kite's dots one place clockwise: the dot at d moves to d + 1 (Nadir → Port → Zenith → Starboard). */
export function rotateKite(st, kiteId) {
  const dots = st.kites[kiteId].dots;
  return setKite(st, kiteId, { dots: dots.map((_, d) => dots[(d + DOTS - 1) % DOTS]) });
}

/** Whether `dot`'s branch contains `starId` (moving the dot onto that star would loop). */
const intoOwnBranch = (st, dot, starId) => !!dot && !!st.dots[dot].branch && st.stars[st.dots[dot].branch]
  && (st.dots[dot].branch === starId || descendants(st, st.dots[dot].branch).has(starId));

/**
 * Swap the contents of two dot slots, { kite, slot } each (an empty slot makes it a move), on any
 * stars. Each dot takes its branch along; a dot moved to another star notes where it came from.
 * A dot moved into its own branch is a conflict ('ownBranch'): with onConflict 'shelve' it moves
 * alone and its branch goes to the shelf.
 */
export function swapDots(st, a, b, options, how = {}) {
  const opts = withDefaults(options);
  const ix = index(st);
  let da = st.kites[a.kite].dots[a.slot];
  let db = st.kites[b.kite].dots[b.slot];
  const [starA, starB] = [ix.kite.get(a.kite).star, ix.kite.get(b.kite).star];
  let base = st;
  for (const [d, to] of [[da, starB], [db, starA]]) {
    if (!intoOwnBranch(base, d, to)) continue;
    if (how.onConflict !== 'shelve') return { state: st, problem: 'A star-dot can’t move into its own branch.', conflict: 'ownBranch' };
    base = shelveStar(base, base.dots[d].branch);
  }
  const [fromA, fromB] = [whereText(st, a.kite), whereText(st, b.kite)];
  let next = setKite(base, a.kite, { dots: replaceAt(base.kites[a.kite].dots, a.slot, db) });
  next = setKite(next, b.kite, { dots: replaceAt(next.kites[b.kite].dots, b.slot, da) });
  if (da && starA !== starB) next = noteMove(next, da, fromA, opts.now);
  if (db && starA !== starB) next = noteMove(next, db, fromB, opts.now);
  return settle(st, next, opts, how, [da, db].filter(Boolean));
}

/**
 * Swap two kites, { star, i } each (relative index), with their dots and branches, which turn
 * along. Within a star, or between two non-central stars (central kites stay on the central star).
 * A kite keeps its own category, so stars can become multicolored.
 */
export function swapKites(st, a, b, options, how = {}) {
  const opts = withDefaults(options);
  const central = centralStar(st).id;
  if (a.star !== b.star && (a.star === central || b.star === central)) {
    return { state: st, problem: 'Central kites stay on the central star.', conflict: null };
  }
  const [ka, kb] = [st.stars[a.star].kites[a.i], st.stars[b.star].kites[b.i]];
  for (const [k, to] of [[ka, b.star], [kb, a.star]]) {
    if (a.star !== b.star && st.kites[k].dots.some(d => intoOwnBranch(st, d, to))) {
      return { state: st, problem: 'A kite can’t move into the branch of one of its own star-dots.', conflict: 'ownBranch' };
    }
  }
  let next = setStar(st, a.star, { kites: replaceAt(st.stars[a.star].kites, a.i, kb) });
  next = setStar(next, b.star, { kites: replaceAt(next.stars[b.star].kites, b.i, ka) });
  if (a.star !== b.star) {
    const fromA = st.stars[a.star];
    const label = s => (s.sources.length ? `${s.sources.map(d => st.dots[d].name || 'unnamed').join(' + ')}’s star` : 'central star');
    for (const d of st.kites[ka].dots.filter(Boolean)) next = noteMove(next, d, `Moved from ${st.kites[ka].name || 'Kite'} › ${label(fromA)}`, opts.now);
    for (const d of st.kites[kb].dots.filter(Boolean)) next = noteMove(next, d, `Moved from ${st.kites[kb].name || 'Kite'} › ${label(st.stars[b.star])}`, opts.now);
  }
  return settle(st, next, opts, how, [...st.kites[ka].dots, ...st.kites[kb].dots].filter(Boolean));
}

// ---- Board rules ------------------------------------------------------------------------------

/**
 * What a save lets the player do on the PLAY board: 'free' (the default: the same
 * moves as MATERIALS, any star-dot or kite anywhere, minus the shelf) or 'fixed' (rotating
 * kites' star-dots and bringing one to its kite's Zenith only). A star-dot moving into its own
 * branch is refused on PLAY rather than shelved. Older saves: 'rotate' → 'fixed', 'within' and
 * 'anywhere' → 'free' (formats.js).
 */
export const BOARD_RULES = ['free', 'fixed', 'locked'];   // Locked, nothing moves on PLAY
export const DEFAULT_BOARD_RULE = 'free';

/**
 * With Kites lock on (and kites on every star), PLAY moves nothing, as on a Fixed board:
 * a swap would open or close kites without the work, or take a tip (and its star) off its place.
 * ↻ Rotate still turns a kite; MATERIALS rearranges.
 */
const locksOn = options => { const o = withDefaults(options); return o.locks === 'on' && o.kites !== 'central'; };

/**
 * What the player may move (Design › Player › Movement): { swap, rotateDots, rotateKites }, all
 * off for a locked board. A save's older board rule (a string) still reads: Free swaps and rotates
 * star-dots, Fixed rotates star-dots only, Locked nothing. `design: true` is the designer in Edit
 * mode, who moves freely (Kites lock doesn't hold them back).
 */
export function movesOf(rule) {
  if (rule && typeof rule === 'object') return { swap: !!rule.swap, rotateDots: !!rule.rotateDots, rotateKites: !!rule.rotateKites, design: !!rule.design };
  return { swap: rule === 'free', rotateDots: rule === 'free' || rule === 'fixed', rotateKites: false, design: false };
}
export const DESIGN_MOVES = { swap: true, rotateDots: true, rotateKites: true, design: true };

/** Turn a star's kites one place clockwise around it, with their star-dots and branches. */
export function rotateStarKites(st, starId, options, how = {}) {
  const star = st.stars[starId];
  if (!star) return { state: st, problem: 'That star isn’t on the map.', conflict: null };
  const kites = star.kites;
  const next = setStar(st, starId, { kites: kites.map((_, i) => kites[(i + KITES - 1) % KITES]) });
  return settle(st, next, withDefaults(options), how, kites.flatMap(k => st.kites[k]?.dots ?? []).filter(Boolean));
}

/**
 * A move on the Star view under what the player may move (movesOf): `move` is { kind: 'dots',
 * a, b } ({ kite, slot } each, as swapDots), { kind: 'kites', a, b } ({ star, i } each, as
 * swapKites) or { kind: 'rotateKites', star }. Returns { state, problem, conflict: null }.
 */
export function boardMove(st, rule, move, options) {
  const refuse = problem => ({ state: st, problem, conflict: null });
  const m = movesOf(rule);
  const rotating = move.kind === 'rotateKites';
  if (!m.swap && !m.rotateDots && !m.rotateKites) return refuse('This board is locked: nothing moves here.');
  if (rotating ? !m.rotateKites : !m.swap) return refuse(rotating ? 'Turning a star’s kites isn’t allowed here.' : 'Swapping isn’t allowed here: only rotating.');
  if (move.kind !== 'dots' && move.kind !== 'kites' && !rotating) return refuse('That isn’t a move the board knows.');
  if (independentOn(options)) return refuse('Under Independent the items keep their list order: reorder them in the Tree view.');
  if (locksOn(options) && !m.design) return refuse('Kites lock is on: star-dots and kites stay where they are (↻ Rotate still turns a kite’s star-dots).');
  const r = rotating ? rotateStarKites(st, move.star, options) : (move.kind === 'dots' ? swapDots : swapKites)(st, move.a, move.b, options);
  if (r.conflict) return refuse(r.conflict === 'land' ? 'A branch would land on another star.' : 'A star-dot can’t move into its own branch. Resolve it in the Tree view.');
  return { ...r, conflict: null };
}

// ---- Removing and merging ---------------------------------------------------------------

/**
 * Remove a star-dot for good: out of its slot (or the shelf, or the retired bank), others'
 * relations to it dropped, its hour blocks gone. A star it deployed goes to the shelf (if it was
 * that star's only source).
 */
export function removeDot(st, dotId) {
  const dot = st.dots[dotId];
  if (!dot) return st;
  st = dropItem(st, dotId);   // Out of its list, with the star it opened
  const at = index(st).dot.get(dotId);
  if (at) st = setKite(st, at.kite, { dots: replaceAt(st.kites[at.kite].dots, at.slot, null) });
  st = shelfRemove(st, 'dot', dotId);
  if (st.retired.some(e => e.id === dotId)) st = { ...st, retired: st.retired.filter(e => e.id !== dotId) };
  st = dropBlocks(st, [dotId]);
  if (dot.branch && st.stars[dot.branch]) {
    const star = st.stars[dot.branch];
    st = star.sources.length > 1 ? setStar(st, dot.branch, { sources: star.sources.filter(d => d !== dotId) }) : shelveStar(st, dot.branch);
  }
  const dots = {};
  for (const [id, d] of Object.entries(st.dots)) {
    if (id === dotId) continue;
    dots[id] = d.relations.some(r => r.dot === dotId) ? { ...d, relations: d.relations.filter(r => r.dot !== dotId) } : d;
  }
  return { ...st, dots };
}

/**
 * What deleting a star-dot takes with it: { dots: its branch's star-dot IDs, itself first;
 * stars: the stars in its branch } (none when its star is shared with another source: then only
 * it goes, and the star stays with the other).
 */
export function branchOf(st, dotId) {
  const b = st.dots[dotId]?.branch;
  const own = b && st.stars[b] && st.stars[b].sources.length <= 1 ? b : null;
  if (!own) return { dots: st.dots[dotId] ? [dotId] : [], stars: [] };
  const stars = [own, ...descendants(st, own)];
  const dots = [dotId, ...stars.flatMap(s => st.stars[s].kites.flatMap(k => st.kites[k].dots.filter(Boolean)))];
  return { dots: [...new Set(dots)], stars };
}

/**
 * Delete a star-dot for good with its whole branch: it, its star and every star-dot
 * and star further out on it, their kites, hour blocks and places on the shelf or in the retired
 * bank, and others' relations to any of them. (A star shared with another source stays with it.)
 */
export function deleteDot(st, dotId) {
  if (!st.dots[dotId]) return st;
  st = dropItem(st, dotId);   // Out of its list, with the star it opened
  const { dots, stars } = branchOf(st, dotId);
  const goneDots = new Set(dots);
  const goneStars = new Set(stars);
  const goneKites = new Set(stars.flatMap(s => st.stars[s].kites));
  const at = index(st).dot.get(dotId);
  if (at) st = setKite(st, at.kite, { dots: replaceAt(st.kites[at.kite].dots, at.slot, null) });
  const b = st.dots[dotId].branch;
  if (b && st.stars[b] && !goneStars.has(b)) st = setStar(st, b, { sources: st.stars[b].sources.filter(d => d !== dotId) });
  const keep = (obj, gone) => Object.fromEntries(Object.entries(obj).filter(([id]) => !gone.has(id)));
  const dotsLeft = {};
  for (const [id, d] of Object.entries(keep(st.dots, goneDots))) {
    dotsLeft[id] = d.relations.some(r => goneDots.has(r.dot)) ? { ...d, relations: d.relations.filter(r => !goneDots.has(r.dot)) } : d;
  }
  const isGone = e => (e.kind === 'dot' ? goneDots : e.kind === 'kite' ? goneKites : goneStars).has(e.id);
  return {
    ...st, dots: dotsLeft, kites: keep(st.kites, goneKites), stars: keep(st.stars, goneStars),
    shelf: st.shelf.filter(e => !isGone(e)), retired: st.retired.filter(e => !goneDots.has(e.id)),
    blocks: st.blocks.filter(x => !goneDots.has(x.dot)),
  };
}

/**
 * Merge star-dot `from` into `into`: its notes are appended; relations combine (the higher score, notes joined; others'
 * relations to `from` now point to `into`); its star moves to `into` if `into` has none (else, or
 * if it would clash, to the shelf); its name and description are appended to `into`'s
 * description; then `from` is removed. Its children come along on its star. Refused when `into` is
 * inside `from`'s own branch.
 */
export function mergeDots(st, from, into, options) {
  const opts = withDefaults(options);
  const [a, b] = [st.dots[from], st.dots[into]];
  if (!a || !b || from === into) return { state: st, problem: 'Choose another star-dot to merge into.', conflict: null };
  const target = starOfDot(st, into);
  if (a.branch && st.stars[a.branch] && target && (a.branch === target || descendants(st, a.branch).has(target))) {
    return { state: st, problem: 'A star-dot can’t be merged into its own branch.', conflict: 'ownBranch' };
  }
  const note = `Merged from ${a.name || 'an unnamed star-dot'}${a.description.trim() ? `: ${a.description.trim()}` : ''}`;
  let next = setDot(st, into, {
    notes: [...b.notes, ...a.notes],
    relations: combined([...b.relations, ...a.relations], into).filter(r => r.dot !== from),
    description: b.description.trim() ? `${b.description}\n\n${note}` : note,
    trained: b.trained || a.trained,
  });
  // Others' relations to `from` now point to `into`.
  for (const d of Object.values(next.dots)) {
    if (d.id === from || d.id === into || !d.relations.some(r => r.dot === from)) continue;
    next = setDot(next, d.id, { relations: combined(d.relations.map(r => (r.dot === from ? { ...r, dot: into } : r)), d.id) });
  }
  // Its star: to `into` if free, else the shelf.
  const star = a.branch && next.stars[a.branch] ? a.branch : null;
  let movedStar = false;
  if (star && !(next.dots[into].branch && next.stars[next.dots[into].branch])) {
    next = setStar(next, star, { sources: next.stars[star].sources.map(d => (d === from ? into : d)) });
    next = setDot(setDot(next, into, { branch: star }), from, { branch: null });
    movedStar = true;
  }
  // Its hour blocks become `into`'s.
  if (next.blocks.some(b => b.dot === from)) next = { ...next, blocks: next.blocks.map(b => (b.dot === from ? { ...b, dot: into } : b)) };
  next = removeDot(next, from);
  if (movedStar) return settle(st, next, opts, { onConflict: 'shelve' }, [into]);
  return { state: next, problem: null, conflict: null };
}

// ---- Planned stars ------------------------------------------------------------------------------

/**
 * Plan the star a dot holds its children on: created now, in the category of the dot's kite
 * (the first category for a star-dot on the shelf). Any of its slots can take children; it shows
 * on the map while the dot sits at an open kite's Zenith. Returns [state, starId]; a dot that
 * already has its star returns it unchanged.
 */
export function planStar(st, dotId) {
  const dot = st.dots[dotId];
  if (dot.branch && st.stars[dot.branch]) return [st, dot.branch];
  const at = index(st).dot.get(dotId);
  const color = at ? st.kites[at.kite].color ?? 0 : 0;
  const [next, starId] = addStar(st, [dotId], Array(KITES).fill(color));
  return [setDot(next, dotId, { branch: starId }), starId];
}

// ---- Expansion ----------------------------------------------------------------------------------

/** Why a Zenith star-dot can't deploy at the position its kite faces, from view.facing(). */
function blockedText(st, f) {
  if (f.reserved) return 'The position its kite faces is in ring 1, kept for a central kite’s own star.';
  const src = st.stars[f.holder]?.sources[0];
  return src ? `The position its kite faces is taken by ${st.dots[src].name || 'an unnamed star-dot'}’s star.` : 'Its kite faces the central star.';
}

/**
 * Deploy the star of a star-dot at an open kite's Zenith, ignited or not, only where the
 * position its kite faces is free: returns { state, star, problem }. A planned star
 * deploys as it is; otherwise a new star is made, all six kites in the category of the kite its
 * star-dot sits on.
 */
export function deployStar(st, dotId, options) {
  const opts = withDefaults(options);
  if (independentOn(opts)) return deployIndependent(st, dotId, opts);
  const dot = st.dots[dotId];
  const own = dot?.branch && st.stars[dot.branch] ? dot.branch : null;
  if (own && st.stars[own].deployed) return { state: st, star: own, problem: null };
  const view = derive(st, opts);
  if (st.complete?.[view.categoryOf(dotId)] != null) return { state: st, star: null, problem: 'Its category is complete for this session: nothing more deploys.' };   // Y13
  const opening = view.openings.find(o => o.dot === dotId);
  if (!opening) {
    const f = view.canExpand(dotId) && view.facing(dotId);
    return { state: st, star: null, problem: f && (f.reserved || f.holder) ? blockedText(st, f) : 'Only a star-dot at an open kite’s Zenith can deploy its star.' };
  }
  // A planned star is deployed as it is (with everything on it).
  if (own) return { state: setStar(st, own, { deployed: true }), star: own, problem: null };
  const next = expansion(st, dotId);
  return { state: next, star: next.dots[dotId].branch, problem: null };
}

/**
 * Under Independent, an item at an open Zenith facing a free position deploys an
 * independent star of its category (or redeploys the one it opened), which takes the category's
 * next items. The item's own `branch` (the dormant
 * hierarchy) is untouched.
 */
function deployIndependent(st, dotId, opts) {
  const k = listKiteOf(st, dotId);
  if (!k) return { state: st, star: null, problem: 'Under Independent only a category’s items deploy stars.' };
  const own = openedBy(st, dotId);
  if (own?.deployed) return { state: st, star: own.id, problem: null };
  const view = derive(st, opts);
  if (st.complete?.[view.categoryOf(dotId)] != null) return { state: st, star: null, problem: 'Its category is complete for this session: nothing more deploys.' };   // Y13
  if (!view.openings.some(o => o.dot === dotId)) {
    const f = view.canExpand(dotId) && view.facing(dotId);
    return { state: st, star: null, problem: f && (f.reserved || f.holder) ? blockedText(view.state, f) : 'Only a star-dot at an open kite’s Zenith can deploy its star.' };
  }
  if (own) return { state: setStar(st, own.id, { deployed: true }), star: own.id, problem: null };
  const [next, starId] = addStar(st, [dotId], Array(KITES).fill(st.kites[k].color ?? 0));
  return { state: setStar(next, starId, { deployed: true, independent: true, category: k }), star: starId, problem: null };
}

function expansion(st, dot) {
  const color = st.kites[index(st).dot.get(dot).kite].color ?? 0;
  const [next, starId] = addStar(st, [dot], Array(KITES).fill(color));
  return setDot(setStar(next, starId, { deployed: true }), dot, { branch: starId });
}

/**
 * After a change from `before` to `st`, deploy the star of every
 * Zenith star-dot the change completed (newly ignited), or whose children decide it and that
 * just opened, whose faced position is free, in the same
 * change, the way Deploy would (a planned star as it is, else a new one). Stars it deploys may
 * open more. With Deploy: By hand nothing happens. Returns { state, deployed: [starId] }.
 */
export function autoDeploy(before, st, options) {
  const opts = withDefaults(options);
  if (opts.deploy !== 'auto' || before === st) return { state: st, deployed: [] };
  const was = derive(before, opts);
  const wasLit = d => !!before.dots[d] && was.effective(d).status === 'ignited';
  const deployed = [];
  const refused = new Set();   // One that can't deploy (its category complete) doesn't stop the others
  // Deploying a decided Zenith follows an answer (something newly ignited in this change), not any edit.
  const answered = Object.keys(st.dots).some(d => st.dots[d].ignitedAt != null && st.dots[d].ignitedAt !== before.dots[d]?.ignitedAt);
  for (let guard = Object.keys(st.dots).length + 1; guard > 0; guard--) {
    const view = derive(st, opts);
    // With every star-dot a question (Hierarchical), a Zenith whose children decide it can't
    // be answered itself: its star deploys once it opens (the star-dots inside it answered), so
    // its children reach the map.
    const decidedOpen = o => answered && opts.questions === 'on' && view.children(o.dot).length > 0 && !view.insideFirst(o.dot);
    const next = view.openings.find(o => !refused.has(o.dot) && ((view.effective(o.dot).status === 'ignited' && !wasLit(o.dot)) || decidedOpen(o)));
    if (!next) break;
    const r = deployStar(st, next.dot, opts);
    if (r.problem) { refused.add(next.dot); continue; }
    st = r.state;
    deployed.push(r.star);
  }
  return { state: st, deployed };
}

/**
 * Withdraw every deployed star that can't show because the position its kite faces is
 * taken or reserved (after a rotate, swap or move brought its star-dot to such a Zenith). When two
 * want one position, the star that was there in `before` keeps it; else the earlier star (the
 * layout's first come). Returns { state, withdrawn: [starId] } (state unchanged when none).
 */
export function withdrawBlocked(st, options, before = null) {
  const opts = withDefaults(options);
  const was = before && derive(before, opts);
  const at = (v, s, coord) => v.shown(s) && coordKey(v.place(s).coord) === coordKey(coord);
  const withdrawn = [];
  for (let guard = Object.keys(st.stars).length; guard > 0; guard--) {
    const b = derive(st, opts).blocked[0];
    if (!b) break;
    const victim = was && b.holder && at(was, b.star, b.coord) && !at(was, b.holder, b.coord) ? b.holder : b.star;
    st = setStar(st, victim, { deployed: false });
    withdrawn.push(victim);
  }
  return { state: st, withdrawn };
}

/**
 * Take a star-dot's deployed star off the map: it stays planned, with everything on it, and its
 * branch goes with it (each star keeps its own flag, so redeploying brings the branch back as it
 * was). Returns { state, problem }.
 */
export function withdrawStar(st, dotId, options) {
  if (independentOn(options)) {   // The independent star it opened
    const own = openedBy(st, dotId);
    if (!own) return { state: st, problem: 'It has no star.' };
    if (!own.deployed) return { state: st, problem: 'Its star isn’t on the map.' };
    return { state: setStar(st, own.id, { deployed: false }), problem: null };
  }
  const b = st.dots[dotId]?.branch;
  if (!b || !st.stars[b]) return { state: st, problem: 'It has no star.' };
  if (!st.stars[b].deployed) return { state: st, problem: 'Its star isn’t on the map.' };
  return { state: setStar(st, b, { deployed: false }), problem: null };
}

/** Whether the player may rotate a kite's star-dots (movesOf; an older Free or Fixed board). */
export const canRotate = rule => movesOf(rule).rotateDots;

/**
 * A board as a first-time player meets it (Make a repo…'s play version): a new session, and every
 * completion cleared too (ticked items as well as answered questions), with no waits, goals or
 * completed categories. What the designer made stays: the items, questions, lists, relations, notes,
 * attributes, planned stars and the schedule's blocks.
 */
export function freshBoard(st) {
  const s = startSession(st);
  const dots = Object.fromEntries(Object.entries(s.dots).map(([id, d]) => {
    if (d.ignitedAt == null && !d.trained && !d.answered) return [id, d];
    const { answered: _, ...rest } = d;
    return [id, { ...rest, ignitedAt: null, trained: false }];
  }));
  return { ...s, dots, waits: {}, goals: {}, complete: {} };
}

/**
 * Start a new session. Every star but the central one leaves the map (withdrawn,
 * still planned), and every question's progress is cleared: the completion of each star-dot that
 * carries an assessment, and every wait after a wrong answer. The questions themselves
 * stay, and so do the lists; goals and completed categories are cleared, and independent stars removed.
 */
export function startSession(st, seed = String(Date.now())) {   // A new shuffle seed
  const central = centralStar(st).id;
  const independent = Object.values(st.stars).filter(s => s.independent).map(s => s.id);   // Removed
  if (independent.length) st = removeStars(st, independent);
  const stars = Object.fromEntries(Object.entries(st.stars).map(([id, s]) => [id, id === central || !s.deployed ? s : { ...s, deployed: false }]));
  const dots = Object.fromEntries(Object.entries(st.dots).map(([id, d]) => {
    if (!d.assessment || (d.ignitedAt == null && !d.trained && !d.answered)) return [id, d];
    const { answered: _, ...rest } = d;   // And its progress through its set
    return [id, { ...rest, ignitedAt: null, trained: false }];
  }));
  const changed = Object.keys(st.goals ?? {}).length || Object.keys(st.complete ?? {}).length || independent.length || Object.keys(stars).some(id => stars[id] !== st.stars[id]) || Object.keys(dots).some(id => dots[id] !== st.dots[id]) || Object.keys(st.waits ?? {}).length;
  const { bonus: _b, look: _l, comets: _c, fun: _f, ...rest } = st;   // the bonus ladder starts over too (and 9e's streak and marks), and the player's palette goes back to the designer's
  return changed ? { ...rest, stars, dots, waits: {}, goals: {}, complete: {}, seed } : { ...rest, seed };   // Goals and completions go too // waits go too
}
