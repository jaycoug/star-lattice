// The engine's state: stars, kites and star-dots by ID. Plain JSON-ready data, never mutated: every
// change returns a new state. No category or star-dot names live in code; they come from the
// content set and the saves.
//
// { version, nextId, stars: { id: Star }, kites: { id: Kite }, dots: { id: Dot },
// shelf: [{ kind: 'star' | 'kite' | 'dot', id }],
// retired: [{ id: dotId, at, from: { parent, kite, slot } }], blocks: [Block], waits: { dotId: ms },
// lists: { centralKiteId: [dotId] },
// goals: { category: dotId }, complete: { category: ms } }
// an independent star also has `independent: true` and `category` (its central kite).
// Star: { id, n, sources: [dotId], kites: [kiteId × 6], notes: [text], shelved, deployed }
// Kite: { id, name, description, color, dots: [dotId | null × 4], labels: [text × 4], design: KiteDesign | null }
// Block: { id, dot: dotId, start: ms, minutes } (blocks.js)
// Dot: { id, name, description, role: 'check' | 'assess', marks: [markId], props: Props,
// notes: [text], assessment: null, trained, ignitedAt, relations: [Relation],
// history: [{ text, at }], branch: starId | null }
// Props: { environment, finance, persistence, difficulty, due }
// Relation: { dot: dotId, score: 1–5, how: text }
//
// One record type: everything a star-dot holds is a star-dot, its children, and a
// star-dot's children are exactly the star-dots in the slots of its own star (T3; its `branch`,
// planned or deployed). A star-dot's parent is the first source of the star it sits on; the
// central star's star-dots have none. A **terminal** star-dot (no children) is completed itself:
// a 'check' one (circle bullet) is clicked complete, an 'assess' one (box) by the assessor
// (`assessment` is reserved for its data); `ignitedAt` dates its completion, fresh for its Retrain
// period, and `trained` notes that it was ever completed. A star-dot with children takes its
// status from them (derive.js). `notes` are free lines, never completed or counted.
// Attributes: a star-dot's own value, else its parent's (and so on up), except Financial Influence,
// which is its own only ($0 counts as none). Attribute values: environment, persistence (Retrain)
// and difficulty hold a content-set choice ID; finance is { amount (signed: + earns, − costs),
// period: 'once' | 'week' | 'month' | 'year' }; due is a date "YYYY-MM-DD". `marks` are the content
// set's free marks (e.g. ☺); the other marks are derived from attributes (see derive.js marks()).
// Relations are one-way: this star-dot's relevance to another, with a note on how they relate.
// `history` notes where a star-dot was moved from (no effect on the rules).
//
// Positions are never stored. The central star (no sources, not shelved) sits at the origin. A
// star created by a dot sits at the position that dot's kite faces, and its kites are indexed
// relative to that direction ("turn"): kite i points along slot (i + turn) % 6, so kite BACK faces
// its source. Moving a dot or a kite therefore carries its branch along, rotated with it. `n` is
// the creation order; `sources` is one dot, or more in older saves, from the retired 'shared' ownership rule, where several
// dots share a star. A kite's color is its category (an index into the content set's
// categories). a new star's kites all take its star-dot's kite's category.
//
// The shelf holds what has no place for now: a shelved star (`shelved`, no sources) with its kites
// and branch, a kite taken out of a star, or a star-dot taken out of its slot. Shelved things keep
// all their content.
//
// `retired` lists star-dots retired from the map, newest first: out of their slots,
// with their stars and children, each remembering where it came from (for Restore, U8). A kite's
// `design` is its own kite design (U12; null: its category's, from the content set). `blocks` are
// hour blocks planned on star-dots in SCHEDULE (U16–U18, blocks.js).
//
// A star is on the map only once `deployed` (V1; the central star always is): planning a
// star (its star-dot's first child) doesn't deploy it, deployStar() does, withdrawStar() undoes it.
// Each star keeps its own flag, so a withdrawn star's branch comes back as it was when it's
// redeployed. Locks (kites opening as their star-dots ignite) are a rule (V2: `locks` 'on' | 'off').

export const STATE_VERSION = 1;
export const KITES = 6;
export const DOTS = 4;
export const DOT_NAMES = ['Nadir', 'Port', 'Zenith', 'Starboard'];
export const ZENITH = 2;               // the star-dot at the kite's tip: the one that expands
export const BACK = 3;                 // in a created star, the kite facing back at its source
/** A star's kites in the order its slots fill with children: the back kite, then outward. */
export const CHILD_KITES = [BACK, 2, 4, 1, 5, 0];
export const PROPS = ['environment', 'finance', 'persistence', 'difficulty', 'due'];
export const INHERITED = PROPS.filter(p => p !== 'finance');   // the attributes items take from their star-dot's defaults
export const ROLES = ['check', 'assess'];
export const PERIODS = ['once', 'week', 'month', 'year'];
export const SCORES = [1, 2, 3, 4, 5];
export const DAY = 24 * 60 * 60 * 1000;

/**
 * Rule options, set by the content set (and GOVERN's rules).
 * now current time (ms), for staleness and due dates
 * periods { retrainChoice: days | null }: how long a completed item stays fresh (null = never stale)
 * defaultPeriod days (or null) for items whose Retrain isn't in `periods`
 * random () => [0, 1), for weighted colors
 * share percent of a star-dot's children that must be ignited to ignite it (the save's)
 * difficultyOrder Difficulty choice IDs, easiest first (a rolled-up Difficulty is the highest)
 * locks 'on': kites open as their star-dots ignite (a locked kite's star-dots can't be completed or
 * deploy); 'off': every kite is open (the content set's rule, off for the life organizer)
 * kites 'all' | 'central': with 'central', every star but the central one is kite-less
 * perStar 6 | 12 | 18 | 24: the star-dots a kite-less star holds
 * deploy 'hand' | 'auto': with 'auto', completing a Zenith star-dot facing a free position deploys its star
 */
export const DEFAULT_SHARE = 100;
export const DEFAULT_DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];
export const LOCKS = ['off', 'on'];
export const DEFAULT_OPTIONS = {
  now: 0, periods: {}, defaultPeriod: null, random: Math.random, share: DEFAULT_SHARE, difficultyOrder: DEFAULT_DIFFICULTY_ORDER, locks: 'on',
  kites: 'all', perStar: 24, deploy: 'hand',   // The content set's Stars settings
  questions: 'off', wrong: { mode: 'retry', minutes: 5 },   // Its Questions settings
  goalAfter: 0,                                             // A goal after N correct (goals.js)
  shuffleChoices: 'off', shuffleQuestions: 'off',           // GOVERN's shuffle defaults
  stardots: 'hierarchical',                                 // 'independent' places the lists' items (independent.js)
};
export const withDefaults = opts => ({ ...DEFAULT_OPTIONS, ...opts });

const blankProps = () => Object.fromEntries(PROPS.map(p => [p, null]));

/** A state holding only the central star; its kite i has category colors[i] (default i). */
export function createState({ colors = Array.from({ length: KITES }, (_, i) => i), kiteNames = [] } = {}) {
  let st = { version: STATE_VERSION, nextId: 0, stars: {}, kites: {}, dots: {}, shelf: [], retired: [], blocks: [], waits: {}, lists: {}, goals: {}, complete: {}, seed: '' };
  let id;
  [st, id] = addStar(st, [], colors, kiteNames);
  return { ...st, stars: { ...st.stars, [id]: { ...st.stars[id], deployed: true } } };   // the central star is always on the map
}

/** A kite with a color and no star-dots. */
export const blankKite = (id, color, name = '') => ({ id, name, description: '', color, dots: Array(DOTS).fill(null), labels: Array(DOTS).fill(''), design: null });

/** Add a star with kite colors (and names) by relative index. Returns [state, starId]. */
export function addStar(st, sources, colors, names = []) {
  let next = st.nextId;
  const id = 's' + next++;
  const kites = { ...st.kites };
  const kiteIds = colors.map((color, i) => {
    const k = 'k' + next++;
    kites[k] = blankKite(k, color, names[i] ?? '');
    return k;
  });
  const star = { id, n: st.nextId, sources, kites: kiteIds, notes: [], shelved: false, deployed: false };
  return [{ ...st, nextId: next, kites, stars: { ...st.stars, [id]: star } }, id];
}

export function blankDot(id, name = '') {
  return {
    id, name, description: '', role: 'check', marks: [], props: blankProps(), notes: [],
    assessment: null, trained: false, ignitedAt: null, relations: [], history: [], branch: null,
  };
}

export const MAX_CHILDREN = KITES * DOTS;

// With Kites in: Central star only (the content set's `kites` rule 'central'),
// every star but the central one is **kite-less**: six hidden kites ("spokes": kite records that
// aren't drawn), whose star-dots sit where a kite's would. A spoke's
// Zenith deploys toward the neighbor in its direction, as a kite's does. The per-star count
// (`perStar` 6 · 12 · 18 · 24) is how many slots each kite uses, **the central star's included**
//: slots come into use in the order Zenith, Port, Starboard, Nadir (SPOKE_SLOTS: 6 is
// the Zeniths only, 12 adds the Ports …), and fill the other way, Nadir, Port, Starboard, then the
// Zenith (FILL_ORDER, among those in use). A star-dot already in a slot outside the count keeps it
// and still counts (nothing is hidden); the count limits the empty slots offered. Nothing about a
// star is stored for this: switching the rule switches how stars are read and drawn.
export const SPOKE_SLOTS = [ZENITH, 1, 3, 0];
export const FILL_ORDER = [0, 1, 3, ZENITH];
export const PER_STAR = [6, 12, 18, 24];
/** Whether a star is kite-less under these options: Kites in: Central star only, and not the central star. */
export const kiteless = (st, starId, opts) => opts?.kites === 'central' && !!st.stars[starId]
  && (st.stars[starId].sources.length > 0 || !!st.stars[starId].shelved);
/** The slots each kite of a star offers under these options: all four, or (Kites in: Central star only) the first perStar / 6 of SPOKE_SLOTS. */
export const createdSlots = opts => (opts?.kites !== 'central' ? [0, 1, 2, 3]
  : SPOKE_SLOTS.slice(0, PER_STAR.includes(opts.perStar) ? opts.perStar / KITES : DOTS));
/** The slots a kite of star `starId` offers: all four, or under Central star only the per-star count's, on every star (the central one too). */
export const usableSlots = (st, starId, opts) => (st.stars[starId] ? createdSlots(opts) : [0, 1, 2, 3]);
/** a star-dot in a slot beyond the per-star count (it keeps its place and still counts; it's marked). */
export function overCount(st, dotId, opts) {
  const at = index(st).dot.get(dotId);
  const star = at && index(st).kite.get(at.kite)?.star;
  return !!star && !usableSlots(st, star, opts).includes(at.slot);
}
/** How many children a star can hold: 24, or the per-star count. */
export const maxChildren = (st, starId, opts) => usableSlots(st, starId, opts).length * KITES;

/**
 * A star's slots in the order they fill with children: [{ kite, slot }], Nadir to
 * Starboard on each kite, the back kite first, among the slots in use. On a kite-less star:
 * slot by slot in FILL_ORDER (Nadir, Port, Starboard, Zenith), each around the kites from the back
 * one, so the Zeniths come last. Then any star-dots sitting in slots outside the count (so they
 * still count as its children).
 */
export function childSlots(st, starId, opts) {
  const kites = CHILD_KITES.map(k => st.stars[starId].kites[k]);
  const used = usableSlots(st, starId, opts);
  const outside = kites.flatMap(kite => [0, 1, 2, 3].filter(s => !used.includes(s) && st.kites[kite].dots[s]).map(slot => ({ kite, slot })));
  if (!kiteless(st, starId, opts)) return [...kites.flatMap(kite => [0, 1, 2, 3].filter(s => used.includes(s)).map(slot => ({ kite, slot }))), ...outside];
  return [...FILL_ORDER.filter(s => used.includes(s)).flatMap(slot => kites.map(kite => ({ kite, slot }))), ...outside];
}

export const centralStar = st => Object.values(st.stars).find(s => !s.sources.length && !s.shelved);

const indexes = new WeakMap();

/** Reverse lookups: dot → { kite, slot }, kite → { star, i }. Shelved star-dots and kites have none. */
export function index(st) {
  let ix = indexes.get(st);
  if (ix) return ix;
  ix = { dot: new Map(), kite: new Map() };
  for (const star of Object.values(st.stars)) {
    star.kites.forEach((k, i) => {
      ix.kite.set(k, { star: star.id, i });
      st.kites[k].dots.forEach((d, slot) => d && ix.dot.set(d, { kite: k, slot }));
    });
  }
  indexes.set(st, ix);
  return ix;
}

/** The star a dot sits on, or null for a shelved one. */
export function starOfDot(st, dotId) {
  const at = index(st).dot.get(dotId);
  return at ? index(st).kite.get(at.kite)?.star ?? null : null;
}

/** A star-dot's parent: the first source of the star it sits on (null on the central star, the shelf or a shelved star). */
export function parentOf(st, dotId) {
  const star = st.stars[starOfDot(st, dotId)];
  return star?.sources[0] ?? null;
}

/** A star itself and every star it was deployed from, back to the center (or to a shelved star). */
export function ancestors(st, starId) {
  const out = new Set();
  const visit = id => {
    if (!id || out.has(id)) return;
    out.add(id);
    for (const d of st.stars[id].sources) visit(starOfDot(st, d));
  };
  visit(starId);
  return out;
}

/** Stars deployed from `starId` (its whole branch, not including itself). */
export function descendants(st, starId) {
  const out = new Set();
  const visit = id => {
    for (const k of st.stars[id].kites) {
      for (const d of st.kites[k].dots) {
        const b = d && st.dots[d].branch;
        if (b && !out.has(b) && b !== starId) {
          out.add(b);
          visit(b);
        }
      }
    }
  };
  visit(starId);
  return out;
}
