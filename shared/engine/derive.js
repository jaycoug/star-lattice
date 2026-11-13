// Everything that isn't stored, worked out from the state: star-dot status (staleness, the training
// floor), attributes (a star-dot's own, else its parent's; Financial Influence is its own only), the
// marks those attributes show, a star-dot's attribute summary and rolled-up Difficulty, the support
// its children give it, the schedule, which kites are open, the layout (which stars are on the map,
// where, and which are blocked) and relevance by category.
// derive(state, options) returns a view with memoized queries.
//
// Status. A dot is 'empty' (no dot), 'open', 'training' or 'ignited', drawn empty, half-filled or
// filled. a star-dot's children are the star-dots on its own star (planned or
// deployed), in slot order. A **terminal** star-dot (no children) is ignited while its
// completion (`ignitedAt`) is fresh for its Retrain period; else in training if it was ever
// completed (`trained`: never lower), else open. That is its own status (own). A star-dot with
// children takes its status from them (effective): ignited once `share` percent of them are, in
// training while any is under way (or if it was ever trained), else open. Nothing caps a dot from
// above: the dots its star was deployed from don't limit it.
//
// Kites. The central star's kites are all open. In a created star only kite BACK starts open; an
// open kite with two ignited dots opens its two neighbors. only with the `locks` rule
// on; with it off, every kite is open.
//
// Layout, spreading out from the central star: an open kite's Zenith dot, ignited or not, is an
// expansion into the position its kite faces. only a **deployed** star is placed; a
// planned (undeployed) one keeps its would-be place. a star goes **only** at the
// position its kite faces, and only while that's free: no star there, not the center, not a
// reserved ring-1 position (ring 1 is for the central kites' own stars). Deployed stars are placed
// earliest first (first come: the ownership rule is retired, W3); a deployed star whose position
// is taken is **blocked** (`blocked`: the app withdraws it in the same change, W2), and a Zenith
// star-dot whose star isn't deployed is an **opening** only where its position is free. Stars that
// aren't shown keep a would-be place (from their first source; with `blocked` when it's taken), so
// the view can outline them; shelved stars, and stars deployed from them, have no place.
//
// With Kites in: Central star only, a star other than the central one is
// kite-less (`kiteless`): its six spokes are always open (there are no kites to unlock), and its
// star-dots fill the slots `usableSlots` offers. Under that rule a Zenith, on a spoke or a central
// kite, can be completed only once every other star-dot on its kite or spoke is ignited
// (`completable`; `insideFirst` says it's waiting for them).
//
// Under Star-dots: Independent, derive() reads project(state) instead
// (independent.js): the lists' items placed across the central kites and the independent stars.
// Star-dots then have no children (each is its own status, nothing rolls up) and inherit no
// attributes; `state` is the state the view read, and `segments` where each star's items begin.

import { DIRS, ORIGIN, coordKey, addCoord, latticeRing, toPixel } from '../lattice.js';
import { project, listKiteOf } from './independent.js';
import { ENGINE_RULE_KEYS } from './rules.js';
import { KITES, ZENITH, BACK, DAY, withDefaults, index, centralStar, childSlots, parentOf, kiteless as isKiteless, usableSlots } from './model.js';

const views = new WeakMap();
const KEYS = ['now', 'periods', 'defaultPeriod', 'travel', 'share', 'difficultyOrder', ...ENGINE_RULE_KEYS];   // The rules from rules.js

export function derive(st, options) {
  const opts = withDefaults(options);
  // Under Independent every query reads the lists' placement (independent.js).
  if (opts.stardots === 'independent' && !st.projected) st = project(st, opts);
  const cached = views.get(st);
  if (cached && KEYS.every(k => cached.opts[k] === opts[k])) return cached;
  const view = build(st, opts);
  views.set(st, view);
  return view;
}

function memo(fn) {
  const cache = new Map();
  return key => {
    if (!cache.has(key)) cache.set(key, fn(key));
    return cache.get(key);
  };
}

const PER_MONTH = { week: 52 / 12, month: 1, year: 1 / 12 };
/** A Financial Influence value that counts: an amount other than $0. */
const money = v => (v?.amount ? v : null);

function build(st, opts) {
  const ix = index(st);
  const central = centralStar(st);
  const travel = new Set(opts.travel ?? []);

  // ---- Attributes and staleness -------------------------------------------------------------------
  /** A star-dot's value of attribute p: its own, else its parent's (up the lineage); finance its own only. */
  const prop = memo(key => {
    const [dotId, p] = key.split('|');
    const dot = st.dots[dotId];
    if (!dot) return null;
    if (p === 'finance') return money(dot.props.finance);
    if (dot.props[p] != null) return dot.props[p];
    const parent = st.projected ? null : parentOf(st, dotId);   // Y6: independent items inherit nothing
    return parent ? prop(`${parent}|${p}`) : null;
  });
  const propOf = (dotId, p) => prop(`${dotId}|${p}`);
  const periodOf = choice => {
    const days = choice != null && choice in opts.periods ? opts.periods[choice] : opts.defaultPeriod;
    return days == null ? Infinity : days * DAY;
  };
  const dotPeriod = dotId => periodOf(propOf(dotId, 'persistence'));
  /** Whether a star-dot's own completion counts (completed, and not stale). */
  const fresh = dotId => {
    const at = st.dots[dotId]?.ignitedAt;
    return at != null && opts.now - at < dotPeriod(dotId);
  };

  /** A star-dot's own status, from its own completion (what it shows while it has no children). */
  const own = memo(dotId => {
    const dot = st.dots[dotId];
    if (!dot) return { status: 'empty', weight: 0 };
    if (fresh(dotId)) return { status: 'ignited', weight: 1 };
    return dot.trained ? { status: 'training', weight: 0.5 } : { status: 'open', weight: 0 };
  });

  /** The star a dot holds its children on (planned or deployed, not shelved); else null. */
  const deployedStar = dotId => {
    const star = st.stars[st.dots[dotId]?.branch];
    return star && !star.shelved ? star : null;
  };
  /** A star-dot's children: the star-dots on its star, in slot order; [] when it has none. */
  const children = memo(dotId => {
    if (st.projected) return [];   // Y6: an independent item has no children
    const star = deployedStar(dotId);
    return star ? childSlots(st, star.id, opts).map(({ kite, slot }) => st.kites[kite].dots[slot]).filter(Boolean) : [];
  });
  /** A dot's status for every rule: from its children at the save's share, else its own. */
  const effective = memo(dotId => {
    const kids = children(dotId).map(effective);
    if (!kids.length) return own(dotId);
    const lit = kids.filter(k => k.status === 'ignited').length;
    if (lit * 100 >= opts.share * kids.length) return { status: 'ignited', weight: 1 };
    if (lit || st.dots[dotId].trained || kids.some(k => k.weight > 0)) return { status: 'training', weight: 0.5 };
    return { status: 'open', weight: 0 };
  });
  const ignited = dotId => !!dotId && effective(dotId).status === 'ignited';

  const difficultyRank = v => (v == null ? -1 : opts.difficultyOrder.indexOf(v));
  const highest = list => list.reduce((a, b) => (difficultyRank(b) > difficultyRank(a) ? b : a), null);
  /**
   * The Difficulty a star-dot's bullet border shows: its own (or inherited) while it has no
   * children; else its children's highest, each child counting with its own rolled-up value. Null
   * when none is set.
   */
  const difficulty = memo(dotId => {
    const kids = children(dotId);
    return kids.length ? highest(kids.map(difficulty)) : propOf(dotId, 'difficulty');
  });

  /**
   * The marks a star-dot shows, derived from its attributes plus its free marks: [{ id, tone }]:
   * 'finance' (tone 'earn' | 'cost'), 'travel' (Environment needs travel), 'due' (tone 'due' |
   * 'overdue'), free marks (tone 'free'). A legacy manual mark whose attribute isn't set yet
   * ('money', 'place', 'time') shows its derived mark with tone 'reminder'.
   */
  const marks = dotId => {
    const dot = st.dots[dotId];
    const out = [];
    const cash = propOf(dotId, 'finance');
    if (cash) out.push({ id: 'finance', tone: cash.amount < 0 ? 'cost' : 'earn' });
    else if (dot.marks.includes('money')) out.push({ id: 'finance', tone: 'reminder' });
    if (travel.has(propOf(dotId, 'environment'))) out.push({ id: 'travel', tone: 'plain' });
    else if (dot.marks.includes('place')) out.push({ id: 'travel', tone: 'reminder' });
    const due = propOf(dotId, 'due');
    if (due) out.push({ id: 'due', tone: Date.parse(due + 'T23:59:59') < opts.now && !ignited(dotId) ? 'overdue' : 'due' });
    else if (dot.marks.includes('time')) out.push({ id: 'due', tone: 'reminder' });
    for (const m of dot.marks) if (!['money', 'place', 'time'].includes(m)) out.push({ id: m, tone: 'free' });
    return out;
  };

  /**
   * A star-dot's attribute summary: a terminal one's own values (attributes inherited), or its
   * children's rolled up:
   * finance { monthly, once, count }: recurring amounts as a monthly rate, one-time ones summed
   * difficulty { highest }: the highest Difficulty
   * environment { counts: { choice: n } }
   * persistence { most: choice (the shortest period), nextStale: { at, dot, name } | null }
   * due { nearest: { date, dot, name } | null, overdue }
   * Rolled up: money sums; Difficulty takes the highest; Environment counts add up; Retrain takes
   * the shortest period and the soonest to go stale; Due the nearest date, with overdue ones added
   * up. `dot` (and its `name`) say whose value it is.
   */
  const summary = memo(dotId => {
    const kids = children(dotId).map(summary);
    return kids.length ? rollUp(kids) : ownSummary(dotId);
  });
  const ownSummary = dotId => {
    const dot = st.dots[dotId];
    const cash = propOf(dotId, 'finance');
    const finance = { monthly: 0, once: 0, count: cash ? 1 : 0 };
    if (cash) { if (cash.period === 'once') finance.once = cash.amount; else finance.monthly = cash.amount * PER_MONTH[cash.period]; }
    const env = propOf(dotId, 'environment');
    const at = fresh(dotId) ? dot.ignitedAt + dotPeriod(dotId) : null;
    const due = propOf(dotId, 'due');
    const done = ignited(dotId);
    const overdue = !!due && !done && Date.parse(due + 'T23:59:59') < opts.now;
    return {
      finance,
      difficulty: { highest: propOf(dotId, 'difficulty') },
      environment: { counts: env != null ? { [env]: 1 } : {} },
      persistence: { most: propOf(dotId, 'persistence'), nextStale: at != null && Number.isFinite(at) ? { at, dot: dotId, name: dot.name } : null },
      due: { nearest: due && !done && !overdue ? { date: due, dot: dotId, name: dot.name } : null, overdue: overdue ? 1 : 0 },
    };
  };

  /** Summaries rolled into one (see summary). */
  const rollUp = kids => {
    const add = key => kids.reduce((c, k) => { for (const [v, n] of Object.entries(k[key].counts)) c[v] = (c[v] ?? 0) + n; return c; }, {});
    const first = (list, better) => list.filter(Boolean).reduce((a, b) => (!a || better(b, a) ? b : a), null);
    return {
      finance: kids.reduce((f, k) => ({ monthly: f.monthly + k.finance.monthly, once: f.once + k.finance.once, count: f.count + k.finance.count }), { monthly: 0, once: 0, count: 0 }),
      difficulty: { highest: highest(kids.map(k => k.difficulty.highest)) },
      environment: { counts: add('environment') },
      persistence: {
        most: first(kids.map(k => k.persistence.most), (a, b) => periodOf(a) < periodOf(b)),
        nextStale: first(kids.map(k => k.persistence.nextStale), (a, b) => a.at < b.at),
      },
      due: { nearest: first(kids.map(k => k.due.nearest), (a, b) => a.date < b.date), overdue: kids.reduce((n, k) => n + k.due.overdue, 0) },
    };
  };

  /**
   * A list of star-dots taken together, as if they were one star-dot's children (round 7, V7: the
   * central star's screen): { status, support: { ignited, total, share } | null, summary (rolled up,
   * or null), difficulty (the highest) }. Status follows the same share rule as a parent's.
   */
  const group = ids => {
    const kids = ids.map(effective);
    const lit = kids.filter(k => k.status === 'ignited').length;
    const status = !kids.length ? { status: 'empty', weight: 0 }
      : lit * 100 >= opts.share * kids.length ? { status: 'ignited', weight: 1 }
        : lit || kids.some(k => k.weight > 0) ? { status: 'training', weight: 0.5 } : { status: 'open', weight: 0 };
    return {
      status,
      support: kids.length ? { ignited: lit, total: kids.length, share: opts.share } : null,
      summary: kids.length ? rollUp(ids.map(summary)) : null,
      difficulty: highest(ids.map(difficulty)),
    };
  };

  /**
   * Where a star-dot with children stands: { star, ignited, total, share } (its complete children
   * out of all of them, and the percent needed); null for a terminal one.
   */
  const support = memo(dotId => {
    const kids = children(dotId);
    if (!kids.length) return null;
    return { star: deployedStar(dotId).id, ignited: kids.filter(ignited).length, total: kids.length, share: opts.share };
  });

  /**
   * The time-based terminal star-dots on any star, for SCHEDULE: [{ dot, kind, at, done,
   * overdue }], by date. kind 'due': one with a Due date, on that date (at = its local midnight);
   * overdue when it's past and it isn't complete. kind 'retrain': one with a Retrain period, on the
   * day it goes stale (ignitedAt + period); a stale one is overdue (at = when it went stale), and
   * one never completed is due now (at = now). `until` (ms) leaves out later entries; overdue ones
   * are always kept. A star-dot with children isn't listed; its children are. Star-dots off the
   * map (on the shelf, or in a shelved branch) are left out.
   */
  const schedule = until => {
    const out = [];
    for (const [dotId, where] of ix.dot) {
      if (children(dotId).length || !place(ix.kite.get(where.kite).star)) continue;
      const dot = st.dots[dotId];
      const done = fresh(dotId);
      const due = propOf(dotId, 'due');
      if (due) {
        const at = new Date(due + 'T00:00:00').getTime();
        const overdue = !done && Date.parse(due + 'T23:59:59') < opts.now;
        if (overdue || at <= until) out.push({ dot: dotId, kind: 'due', at, done, overdue });
      }
      const period = dotPeriod(dotId);
      if (!Number.isFinite(period)) continue;   // never stale
      const at = dot.ignitedAt != null ? dot.ignitedAt + period : opts.now;
      const overdue = !done && dot.ignitedAt != null;
      if (overdue || at <= until) out.push({ dot: dotId, kind: 'retrain', at, done, overdue });
    }
    return out.sort((a, b) => a.at - b.at);
  };

  // ---- Kites --------------------------------------------------------------------------------------
  const openKites = memo(starId => {
    const star = st.stars[starId];
    if (opts.locks === 'off' || (!star.sources.length && !star.shelved) || isKiteless(st, starId, opts)) return new Set(star.kites.map((_, i) => i));
    const open = new Set([BACK]);
    for (let changed = true; changed;) {
      changed = false;
      for (const i of [...open]) {
        if (st.kites[star.kites[i]].dots.filter(ignited).length < 2) continue;
        for (const j of [(i + 1) % KITES, (i + KITES - 1) % KITES]) {
          if (!open.has(j)) {
            open.add(j);
            changed = true;
          }
        }
      }
    }
    return open;
  });
  /** Whether a kite is open (a shelved kite isn't). */
  const kiteOpen = kiteId => {
    const at = ix.kite.get(kiteId);
    return !!at && openKites(at.star).has(at.i);
  };

  const canExpand = dotId => {
    const at = dotId && ix.dot.get(dotId);
    return !!at && at.slot === ZENITH && kiteOpen(at.kite);
  };
  /**
   * Y5: whether a Zenith star-dot is waiting for the star-dots inside it (with Kites in: Central
   * star only): some other star-dot on its kite or spoke isn't ignited yet. False for anything else.
   */
  const insideFirst = dotId => {
    const at = opts.kites === 'central' && dotId && ix.dot.get(dotId);
    return !!at && at.slot === ZENITH && st.kites[at.kite].dots.some((d, s) => s !== ZENITH && d && !ignited(d));
  };
  /** Whether a star-dot can be completed (ticked, assessed, ignited): its own kite is open (V2: by the kite it sits on), and nothing inside it waits. */
  const completable = dotId => {
    const at = dotId && ix.dot.get(dotId);
    return !!at && kiteOpen(at.kite) && !insideFirst(dotId);
  };

  // ---- Layout -----------------------------------------------------------------------------------
  const shown = new Map([[central.id, { coord: ORIGIN, turn: 0, source: null }]]);
  const shownAt = new Map([[coordKey(ORIGIN), central.id]]);
  const taken = c => shownAt.has(coordKey(c));
  /** Ring-1 positions are reserved for the central kites' own stars (kept in round 8). */
  const reserved = (coord, from) => latticeRing(coord) === 1 && latticeRing(from) !== 0;

  /** Expansions from shown stars: [{ dot, coord (the faced position), turn, from, reserved, star (its branch, or null), deployed }]. */
  const expansions = () => {
    const out = [];
    for (const [p, pp] of shown) {
      st.stars[p].kites.forEach((k, i) => {
        const d = st.kites[k].dots[ZENITH];
        if (!canExpand(d)) return;
        const turn = (i + pp.turn) % KITES;
        const coord = addCoord(pp.coord, DIRS[turn]);
        const b = st.dots[d].branch;
        const star = b && st.stars[b] ? b : null;
        out.push({ dot: d, coord, turn, from: pp.coord, reserved: reserved(coord, pp.coord), star, deployed: !!star && !!st.stars[star].deployed });
      });
    }
    return out;
  };
  // Place deployed stars at their own faced position, earliest first, while one is free (W1: no
  // outward move); placing one may open more positions from its own kites.
  const byAge = (a, b) => st.stars[a.star].n - st.stars[b.star].n;
  const free = e => !e.reserved && !taken(e.coord);
  for (;;) {
    const next = expansions().filter(e => e.deployed && !shown.has(e.star) && free(e)).sort(byAge)[0];
    if (!next) break;
    shown.set(next.star, { coord: next.coord, turn: next.turn, source: next.dot });
    shownAt.set(coordKey(next.coord), next.star);
  }
  const final = expansions();
  /** What's in a faced position's way: { reserved } or { holder } (the star there), or null when it's free. */
  const obstacle = e => (e.reserved ? { reserved: true, holder: null } : taken(e.coord) ? { reserved: false, holder: shownAt.get(coordKey(e.coord)) } : null);
  /** Zenith star-dots whose star isn't deployed (or who have none), where Deploy its star can put it: their faced position, free. */
  const openings = final.filter(e => !e.deployed && free(e)).map(({ dot, coord }) => ({ dot, coord }));
  /** W2: deployed stars at an open Zenith whose faced position is taken or reserved: [{ star, dot, coord, holder, reserved }]. */
  const blocked = final.filter(e => e.deployed && !shown.has(e.star)).map(e => ({ star: e.star, dot: e.dot, coord: e.coord, ...obstacle(e) }));
  /** Where a Zenith star-dot's star would go, and what's in the way: { coord, reserved, holder } (both empty when free), or null off an open Zenith. */
  const facing = dotId => {
    const e = final.find(x => x.dot === dotId);
    return e ? { coord: e.coord, reserved: false, holder: null, ...(e.star && shown.has(e.star) ? {} : obstacle(e)) } : null;
  };
  /**
   * Whether a star-dot can deploy a star, or has one on the map: at an open kite's
   * Zenith whose faced position is free (or holds its own star). nothing else limits it
   * (under Independent a star deploys even once its category's list has run out). The map draws these as stars
   * and every other star-dot (inner slots, blocked Zeniths) as a circle.
   */
  const deployable = memo(dotId => {
    const f = canExpand(dotId) && facing(dotId);
    return !!f && !f.reserved && !f.holder;
  });

  /**
   * Where a star is, or would be: its shown place, else the place its first source faces (with
   * `blocked` when that's taken or reserved, W1); null for a shelved star, a retired one, or one
   * deployed (directly or not) from a star-dot that is shelved or retired.
   */
  const placing = new Set();
  const place = memo(starId => {
    if (shown.has(starId)) return shown.get(starId);
    const star = st.stars[starId];
    const source = star.sources[0];
    const at = source && ix.dot.get(source);
    if (star.shelved || !at || placing.has(starId)) return null;
    placing.add(starId);
    const { star: parent, i } = ix.kite.get(at.kite);
    const pp = place(parent);
    placing.delete(starId);
    if (!pp) return null;
    const turn = (i + pp.turn) % KITES;
    const faced = addCoord(pp.coord, DIRS[turn]);
    return { coord: faced, turn, source, ...((reserved(faced, pp.coord) || taken(faced)) && { blocked: true }) };
  });

  /** Kite of star `starId` at absolute slot `slot`. */
  const kiteAtSlot = (starId, slot) => st.stars[starId].kites[(slot - (place(starId)?.turn ?? 0) + KITES) % KITES];

  const kiteProgress = kiteId => st.kites[kiteId].dots.reduce((sum, d) => sum + (d ? effective(d).weight : 0), 0);

  /**
   * Layout problems a move must not add (settle() in actions.js). Since round 8 a star whose
   * position is taken is withdrawn by the app instead, so there are none.
   */
  const problems = () => new Set();

  // ---- Relevance ---------------------------------------------------------------------------------
  /**
   * A placed dot's category (its kite's color); null for a shelved one. Under Independent, an item
   * not on the map yet has its list's category.
   */
  const categoryOf = dotId => {
    const at = ix.dot.get(dotId);
    if (at) return st.kites[at.kite].color;
    const k = st.projected ? listKiteOf(st, dotId) : null;
    return k ? st.kites[k].color : null;
  };

  /**
   * A dot's relevance to each category: [{ avg, count }] by category index, the average score of
   * its relations to dots in that category (avg null when it has none). A dot with children
   * averages its own relations together with all of theirs.
   */
  const relevance = memo(dotId => {
    const sums = Array.from({ length: KITES }, () => [0, 0]);
    for (const r of st.dots[dotId].relations) {
      const c = st.dots[r.dot] ? categoryOf(r.dot) : null;
      if (c == null) continue;
      sums[c][0] += r.score;
      sums[c][1]++;
    }
    for (const kid of children(dotId)) {
      relevance(kid).forEach(({ avg, count }, c) => { if (count) { sums[c][0] += avg * count; sums[c][1] += count; } });
    }
    return sums.map(([sum, count]) => ({ avg: count ? sum / count : null, count }));
  });

  /** Relations from other dots to this one: [{ dot, score, how }] (dot = the one relating). */
  const relevantTo = memo(dotId => Object.values(st.dots).flatMap(d =>
    d.relations.filter(r => r.dot === dotId).map(r => ({ dot: d.id, score: r.score, how: r.how }))));

  return {
    opts,
    state: st,   // the state this view reads (under Independent, its projection)
    segments: kiteId => st.segments?.[kiteId] ?? null,
    own, effective, fresh, prop: propOf, marks, difficulty, summary, support, group, schedule, children,
    relevance, relevantTo, categoryOf,
    kiteOpen, canExpand, completable, insideFirst, kiteProgress,
    kiteless: starId => isKiteless(st, starId, opts), usableSlots: starId => usableSlots(st, starId, opts), kiteLevel: kiteId => 1 + kiteProgress(kiteId),
    shown: starId => shown.has(starId), shownStars: () => [...shown.keys()],
    starAt: coord => shownAt.get(coordKey(coord)) ?? null,
    place, kiteAtSlot, openings, blocked, facing, deployable, problems,
  };
}

