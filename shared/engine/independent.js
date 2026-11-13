// Star-dots: Independent. Each category (a central kite) is one ordered
// list of items, `state.lists[centralKiteId] = [dotId, …]`. Items are star-dots that sit in no kite
// slot: where each one is is **derived**, never stored, by `project()`:
//
// - the first 4 fill the central kite: Nadir, Port, Starboard, then the Zenith;
// - each of the category's **independent stars** on the map (deployed, oldest first) takes the
// next ones: a kite-less star its per-star count, inner rings first, Zeniths last
// (childSlots); a kited star (Kites in: All stars) its 24 slots, Zeniths last;
// - when the list runs out, the last star holds what's left; stars still deploy, empty.
//
// An independent star is a star record marked `independent`, with `category` (its central kite)
// and `sources: [the item that opened it]`. That item only sets where it goes: the position its
// Zenith faces. It holds the category's next items, not children. A withdrawn one takes none.
//
// project(state, options) is a state of its own for every view to read (`projected: true`): the
// central star and the independent stars, with the items in their kites' slots; each opening item's
// `branch` naming its star; every other `branch` cleared; no hierarchical stars, shelf or retired
// bank. derive() reads it whenever Independent is on, and gives star-dots no children (so no
// roll-ups and no inherited attributes). The stored hierarchy (kite slots, children, branches,
// planned and deployed stars) is never touched: it is dormant, and returns as it was when
// Hierarchical is switched back on. `segments` says where each star's items begin (MATERIALS'
// list editor).

import { ZENITH, CHILD_KITES, FILL_ORDER, KITES, centralStar, childSlots, kiteless, usableSlots, blankDot, addStar, index } from './model.js';
import { shuffled } from './qset.js';
import { derive } from './derive.js';

/** The central kite's slots in the order its items fill them: Nadir, Port, Starboard, then the Zenith. */
export const CENTRAL_FILL = FILL_ORDER;
export const independentOn = opts => opts?.stardots === 'independent';

/** A category's items, in order (the central kite's list). */
export const listOf = (st, kiteId) => (st.lists?.[kiteId] ?? []).filter(d => st.dots[d]);
/**
 * A category's items in the order they fill the field: its list's, or with GOVERN's
 * Shuffle the questions on, a new order each session (the save's seed, renewed by Start a new
 * session). The list itself, as MATERIALS shows it, keeps its order.
 */
export function fieldOrder(st, kiteId, opts) {
  const items = listOf(st, kiteId);
  return opts?.shuffleQuestions === 'on' ? shuffled(items.length, `${st.seed ?? ''}|${kiteId}`).map(i => items[i]) : items;
}
/** The central kite whose list holds an item, or null. */
export function listKiteOf(st, dotId) {
  for (const [k, items] of Object.entries(st.lists ?? {})) if (items.includes(dotId)) return k;
  return null;
}
/** Every listed item. */
export const listedItems = st => new Set(Object.values(st.lists ?? {}).flat());

/** The slots an independent star's items fill, in order. */
export function independentSlots(st, starId, opts) {
  if (kiteless(st, starId, opts)) return childSlots(st, starId, opts);
  const kites = CHILD_KITES.map(k => st.stars[starId].kites[k]);
  return [...kites.flatMap(kite => [0, 1, 3].map(slot => ({ kite, slot }))), ...kites.map(kite => ({ kite, slot: ZENITH }))];
}
/** A category's independent stars, oldest first (deployed only, unless `all`). */
export const starsOf = (st, kiteId, all = false) => Object.values(st.stars)
  .filter(s => s.independent && s.category === kiteId && !s.shelved && (all || s.deployed)).sort((a, b) => a.n - b.n);
/** The independent star an item opened (on the map or withdrawn), or null. */
export const openedBy = (st, dotId) => Object.values(st.stars).find(s => s.independent && s.sources[0] === dotId) ?? null;

const projections = new WeakMap();

/** The state as Independent places it (see above); the same object for the same state and options. */
export function project(st, opts) {
  const key = `${opts?.kites}|${opts?.perStar}|${opts?.shuffleQuestions}`;
  const hit = projections.get(st);
  if (hit?.key === key) return hit.state;
  const central = centralStar(st);
  const kites = { ...st.kites };
  const stars = { [central.id]: central };
  const empty = k => { kites[k] = { ...st.kites[k], dots: [null, null, null, null] }; };
  central.kites.forEach(empty);
  const segments = {};
  const centralSlots = usableSlots(st, central.id, opts);
  for (const k of central.kites) {
    const items = fieldOrder(st, k, opts);   // The list's order, or shuffled per session
    let i = 0;
    for (const slot of CENTRAL_FILL.filter(x => centralSlots.includes(x))) if (i < items.length) kites[k].dots[slot] = items[i++];
    const segs = [{ star: null, from: 0, to: i }];
    for (const s of starsOf(st, k, true)) {
      stars[s.id] = s;
      s.kites.forEach(empty);
      if (!s.deployed) continue;
      const from = i;
      for (const { kite, slot } of independentSlots(st, s.id, opts)) if (i < items.length) kites[kite].dots[slot] = items[i++];
      segs.push({ star: s.id, from, to: i });
    }
    segments[k] = { segments: segs, total: items.length };
  }
  const dots = {};
  for (const [id, d] of Object.entries(st.dots)) dots[id] = d.branch ? { ...d, branch: null } : d;
  for (const s of Object.values(stars)) {
    const opener = s.independent && s.sources[0];
    if (opener && dots[opener]) dots[opener] = { ...dots[opener], branch: s.id };
  }
  const state = { ...st, stars, kites, dots, shelf: [], retired: [], projected: true, segments };
  projections.set(st, { key, state });
  return state;
}

/** The state every view reads under these options: the projection under Independent, else the state itself. */
export const viewState = (st, opts) => (independentOn(opts) && !st.projected ? project(st, opts) : st);

// ---- Editing the lists (MATERIALS, Y8) -------------------------------------------------

const setList = (st, kiteId, items) => ({ ...st, lists: { ...(st.lists ?? {}), [kiteId]: items } });

/** Add an item named `name` at the end of a category's list. Returns [state, dotId]. */
export function addItem(st, kiteId, name = '') {
  if (!st.kites[kiteId] || centralStar(st).kites.indexOf(kiteId) < 0) return [st, null];
  const id = 'd' + st.nextId;
  const next = { ...st, nextId: st.nextId + 1, dots: { ...st.dots, [id]: blankDot(id, name) } };
  return [setList(next, kiteId, [...listOf(st, kiteId), id]), id];
}

/** Move a category's item from position `from` to position `to` (both in its list). */
export function moveItem(st, kiteId, from, to) {
  const items = listOf(st, kiteId);
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return st;
  const next = [...items];
  const [d] = next.splice(from, 1);
  next.splice(to, 0, d);
  return setList(st, kiteId, next);
}

/**
 * An item leaving for good (deleteDot / removeDot): out of its list, its wait gone, and the
 * independent star it opened removed with its kites (the items it held move on to the next star).
 */
export function dropItem(st, dotId) {
  const k = listKiteOf(st, dotId);
  const opened = Object.values(st.stars).filter(s => s.independent && s.sources[0] === dotId);
  const waitKeys = Object.keys(st.waits ?? {}).filter(w => w === dotId || w.startsWith(dotId + '#'));   // Per question
  if (!k && !opened.length && !waitKeys.length) return st;
  if (k) st = setList(st, k, st.lists[k].filter(d => d !== dotId));
  if (waitKeys.length) st = { ...st, waits: Object.fromEntries(Object.entries(st.waits).filter(([w]) => !waitKeys.includes(w))) };
  return removeStars(st, opened.map(s => s.id));
}

/** Remove stars (and their kites) for good. */
export function removeStars(st, ids) {
  if (!ids.length) return st;
  const gone = new Set(ids);
  const goneKites = new Set(ids.flatMap(id => st.stars[id].kites));
  return {
    ...st,
    stars: Object.fromEntries(Object.entries(st.stars).filter(([id]) => !gone.has(id))),
    kites: Object.fromEntries(Object.entries(st.kites).filter(([id]) => !goneKites.has(id))),
  };
}


// ---- one set of star-dots, two arrangements ------------------------------------------

/**
 * Each category's star-dots in the tree, in tree order: its central kite Nadir, Port, Starboard,
 * Zenith, then breadth-first through their stars, each star in its fill order. Only stars reached
 * from the central star count (not a shelved branch, nor one whose star-dot is retired).
 */
export function treeOrder(st, opts) {
  const central = centralStar(st);
  const out = new Map();
  const seen = new Set();
  const stars = new Set();
  for (const k of central.kites) {
    const order = FILL_ORDER.map(slot => st.kites[k].dots[slot]).filter(d => d && st.dots[d] && !seen.has(d));
    order.forEach(d => seen.add(d));
    for (let i = 0; i < order.length; i++) {
      const b = st.dots[order[i]].branch;
      const star = b && st.stars[b];
      if (!star || star.shelved || star.independent || stars.has(b)) continue;
      stars.add(b);
      for (const { kite, slot } of childSlots(st, b, opts)) {
        const d = st.kites[kite].dots[slot];
        if (d && st.dots[d] && !seen.has(d)) { seen.add(d); order.push(d); }
      }
    }
    out.set(k, order);
  }
  return out;
}

/** The first free slot for a new star-dot of category `k`, in tree order (null when every star there is full). */
function freeSlot(st, k, order, opts) {
  const central = centralStar(st);
  const usedC = usableSlots(st, central.id, opts);
  for (const slot of FILL_ORDER) if (usedC.includes(slot) && !st.kites[k].dots[slot]) return { kite: k, slot };
  for (const d of order) {
    const b = st.dots[d].branch;
    if (!b || !st.stars[b] || st.stars[b].shelved || st.stars[b].independent) continue;
    const used = usableSlots(st, b, opts);
    const free = childSlots(st, b, opts).find(x => used.includes(x.slot) && !st.kites[x.kite].dots[x.slot]);
    if (free) return free;
  }
  return null;
}

/** Plan a star on the first star-dot of `order` without one, a Zenith first (so it can deploy). Returns [state, starId]. */
function planFor(st, order, opts) {
  const bare = order.filter(d => !(st.dots[d].branch && st.stars[st.dots[d].branch]));
  // A Zenith whose star can deploy first (one facing the center, a reserved ring-1 position
  // or another star never can: its children would never reach the map), then one not on the map yet.
  const view = derive(st, { ...opts, stardots: 'hierarchical' });
  const zeniths = bare.filter(x => index(st).dot.get(x)?.slot === ZENITH);
  const facing = x => view.facing(x);
  const d = zeniths.find(x => { const f = facing(x); return f && !f.reserved && !f.holder; })
    ?? zeniths.find(x => !facing(x)) ?? zeniths[0] ?? bare[0];
  const color = st.kites[index(st).dot.get(d).kite].color ?? 0;
  const [next, starId] = addStar(st, [d], Array(KITES).fill(color));
  return [{ ...next, dots: { ...next.dots, [d]: { ...next.dots[d], branch: starId } } }, starId];
}

/**
 * Keep the two arrangements of one set of star-dots in step. Every star-dot in the tree
 * is in its category's list (appended in tree order when missing), and every listed one is in the
 * tree (placed in the first free slot in tree order, planning a star when none is free). A star-dot
 * off the tree (the shelf, a shelved branch, the retired bank) or gone leaves its list. Each
 * arrangement's own order is otherwise left alone. The same state back when nothing changes.
 */
export function syncArrangements(st, opts) {
  const central = centralStar(st);
  if (!central) return st;
  let order = treeOrder(st, opts);
  const catOf = new Map();
  for (const [k, ds] of order) for (const d of ds) catOf.set(d, k);
  const slotted = new Set(Object.values(st.kites).flatMap(k => k.dots.filter(Boolean)));
  const away = new Set([...st.shelf.filter(e => e.kind === 'dot').map(e => e.id), ...st.retired.map(e => e.id)]);
  // Never placed anywhere: a list item made under Independent.
  const unplaced = d => st.dots[d] && !catOf.has(d) && !slotted.has(d) && !away.has(d);
  const lists = { ...(st.lists ?? {}) };
  const claimed = new Set();
  const toPlace = [];
  for (const k of central.kites) {
    const items = [];
    for (const d of lists[k] ?? []) {
      if (claimed.has(d) || !(catOf.get(d) === k || unplaced(d))) continue;
      claimed.add(d); items.push(d);
      if (!catOf.has(d)) toPlace.push([k, d]);
    }
    for (const d of order.get(k)) if (!claimed.has(d)) { claimed.add(d); items.push(d); }
    lists[k] = items;
  }
  const same = central.kites.every(k => (st.lists?.[k] ?? []).length === lists[k].length && lists[k].every((d, i) => st.lists[k][i] === d));
  let next = same ? st : { ...st, lists };
  for (const [k, d] of toPlace) {
    const ord = treeOrder(next, opts).get(k);
    let at = freeSlot(next, k, ord, opts);
    if (!at) {
      let starId;
      [next, starId] = planFor(next, ord, opts);
      const used = usableSlots(next, starId, opts);
      at = childSlots(next, starId, opts).find(x => used.includes(x.slot) && !next.kites[x.kite].dots[x.slot]);
    }
    const kite = next.kites[at.kite];
    next = { ...next, kites: { ...next.kites, [at.kite]: { ...kite, dots: kite.dots.map((x, i) => (i === at.slot ? d : x)) } } };
  }
  return next;
}
