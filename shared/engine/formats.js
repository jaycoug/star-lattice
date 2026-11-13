// File formats. A **content set** (content/<id>.json) defines a kind of use: its six categories
// (name + color), the five item attributes (Environment, Financial Influence, Retrain, Difficulty,
// Due: choices for three of them, Retrain's carrying a period in days and Environment's a `travel`
// flag; Financial Influence is a signed amount, Due a date), the free item marks (e.g. ☺ involves
// others; $ ✈ ⏱ are derived from attributes, see DERIVED_MARKS), relevance level names, dot slot
// names, the starting arrangement of the central star and the rules (contested color, locks; round 8 retired the ownership rule: always first come).
// A **save** (saves/<name>.json) is one board: the engine state, naming its content set, plus
// its board rule (what the player can do on the PLAY board, see BOARD_RULES) and table order. normalizeContent() and normalizeSave() are the single gate for anything loaded:
// they fill defaults, upgrade older versions, drop unknown fields and throw on shapes the engine
// can't use.
//
// content: { format, version, id, title, categories: [{ name, color }] × 6,
// properties: [{ id, name, kind: 'choice' | 'amount' | 'date', choices?: [{ id, name, days?, travel? }] }] (one per PROPS),
// marks: [{ id, symbol, name }],
// relevanceNames: [× 5], stageNames: [× 5], dotNames: [× 4], start: { central: [category × 6] },
// rules: { locks: 'off' | 'on', fade: 'darken' | 'brighten' | 'none', twinkle: 'veryslow' | 'slow' | 'normal' | 'fast', lattice: 'shown' | 'hidden',
// kites: 'all' | 'central', stardots: 'hierarchical' | 'independent', perStar: 6 | 12 | 18 | 24,
// deploy: 'hand' | 'auto', questions: 'off' | 'on', wrong: { mode: 'retry' | 'wait', minutes },
// goalAfter: n } } (designs moved to the save; the quiz settings, Y4–Y13)
// save: { format, version, content, title, state, board: 'free' | 'fixed',
// share: 1–100 (percent of a deployed star's star-dots that ignite its source),
// gap: minutes between hour blocks (GAPS) }
//
// Version 1 → 2: checklist items move from `training` to `items` and get their own attributes (a
// copy of their star-dot's, which stay as defaults); high effort becomes Difficulty Hard; Size of
// Training Corpus / Small–Large become Difficulty Easy–Hard; Persistence / Retrain Frequency
// becomes Retrain; $ ⏱ ⌂ become derived marks; the per-dot contested-color rule becomes one rule in
// the content set; the save's notes and open questions become the central star's notes (kite
// clusters are dropped).
//
// Version 2 → 3: everything a star-dot holds becomes a star-dot, its child,
// in the slots of its own star (planned now if it has none), in order: each checklist line (its
// text, role, free marks, attributes, assessment and completion), then each "- " line of the
// description, and each heading line ending in ":" with "- " lines under it (a child holding
// them). A line's guidance becomes its children (complete, with the line's date, when the line was
// complete). A description line whose text is already the
// name of one of its children isn't added again. Converted lines leave the description; other
// text stays. Each converted star-dot notes where it came from in its history.
//
// Version 3 → 4: the content set gains category kite designs, the save its hour
// blocks' gap, and the state its retired star-dots, hour blocks and kites' own designs. None exist
// before, so nothing moves: they start empty (no designs, nothing retired, no blocks, a 30-minute gap).
//
// Version 4 → 5: stars get `deployed`, and in an older save **only the central star
// is deployed** (V1: the others wait for Deploy its star); the board rule becomes 'free' | 'fixed'
// ('rotate' → 'fixed', 'within' and 'anywhere' → 'free'); each non-central star's notes are appended
// to its source star-dot's Notes (V9: one kind of note; the central star's stay, the general notes);
// star-dots lose `urgent` and the save its table order (`ui.order`). The content set gains the
// `locks` rule, 'off' unless set.

import { normalizeFun } from './marks.js';
import { KITES, DOTS, PROPS, ROLES, SCORES, LOCKS, DOT_NAMES, STATE_VERSION, DEFAULT_SHARE, PER_STAR, blankDot, createState, childSlots } from './model.js';
import { propValue, BOARD_RULES, DEFAULT_BOARD_RULE, planStar, placeDot, freshBoard } from './actions.js';
import { GAPS, DEFAULT_GAP, BLOCK_MINUTES } from './blocks.js';
import { FADES, TWINKLES, LATTICES } from '../color.js';
import { normalizeDesign } from '../kiteDesign.js';
import { cleanRules, engineRules } from './rules.js';   // The rules, declared once
import { cleanPlayer } from './player.js';   // What the player may do
import { cleanLayout } from './layout.js';   // The star-dot screen's widgets
import { assessmentValue, questionsOf, gradedOf, waitKey, splitKey } from './questions.js';

export const CONTENT_FORMAT = 'star-lattice-content';
export const SAVE_FORMAT = 'star-lattice-save';
export const FORMAT_VERSION = 8;   // Locked, the assessor PIN, the quiz settings; question sets

export const RELEVANCE_NAMES = ['Low', 'MedLow', 'Medium', 'MedHigh', 'High'];
/** A kite's progress stages, for progress 0–4 rounded down (4 = all four dots ignited). */
export const STAGE_NAMES = ['Nebula', 'Collapse', 'Protostar', 'Fusion', 'Main'];
/** Retrain levels, most frequent first; `days: null` never goes stale. */
export const RETRAIN_LEVELS = [
  { id: 'daily', name: 'Daily', days: 1 },
  { id: 'weekly', name: 'Weekly', days: 7 },
  { id: 'monthly', name: 'Monthly', days: 30 },
  { id: 'quarterly', name: 'Quarterly', days: 91 },
  { id: 'annually', name: 'Annually', days: 365 },
  { id: 'never', name: 'Never', days: null },
];
/** Difficulty levels, easiest first (drawn as a thin, thick and double border). */
export const DIFFICULTY_LEVELS = [{ id: 'easy', name: 'Easy' }, { id: 'medium', name: 'Medium' }, { id: 'hard', name: 'Hard' }];
const PROP_NAMES = { environment: 'Environment', finance: 'Financial Influence', persistence: 'Retrain', difficulty: 'Difficulty', due: 'Due' };
const KINDS = { finance: 'amount', due: 'date' };
/** Attribute IDs of older files: resistance became difficulty, cost (a choice) became finance (an amount). */
const OLD_PROPS = { resistance: 'difficulty', cost: 'finance' };
/** Older attribute names, replaced by today's. */
const OLD_NAMES = ['Persistence', 'Retrain Frequency', 'Size of Training Corpus', 'Resistance'];
/** Older Difficulty choice IDs. */
const OLD_DIFFICULTY = { small: 'easy', large: 'hard' };
/** Environment choices that need travel, in content sets from before the `travel` flag. */
const TRAVEL = ['local', 'distant'];
/** Marks shown from attributes: $ for Financial Influence, ✈ for an Environment that needs travel, ⏱ for a Due date. */
export const DERIVED_MARKS = [
  { id: 'finance', symbol: '$', name: 'Financial Influence' },
  { id: 'travel', symbol: '✈', name: 'Travel' },
  { id: 'due', symbol: '⏱', name: 'Due date' },
];
/** Manual marks of version-1 files that became derived ones (kept on items as reminders until the attribute is set). */
export const LEGACY_MARKS = { money: 'finance', place: 'travel', time: 'due' };
/** Free marks to start with; a content set can change them. */
export const STARTER_MARKS = [{ id: 'people', symbol: '☺', name: 'Involves others' }];

/** A file-name-safe ID from a name: "Size of Corpus" → "size-of-corpus". */
export const slug = name => String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

const text = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const list = (v, what) => {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new Error(`${what} must be a list.`);
  return v;
};
const difficultyId = v => OLD_DIFFICULTY[v] ?? v;

/**
 * A save's own design (P10): everything of its content set but the id and title (the library's), as
 * this save has it: the categories (their names and colors), the item fields, every rule, the
 * player's switches, the screen's layout, the words. Written into the save as `design`.
 */
export function designOf(content) {
  const { id: _id, title: _title, format: _f, version: _v, starter: _s, ...design } = content;
  return design;
}
/**
 * The content a save plays with: its content set (the library) with the save's own design over it.
 * A save from before (no design) takes its content set's, and keeps it from its next write.
 */
export function contentFor(library, save) {
  const design = save?.design && typeof save.design === 'object' ? save.design : null;
  return normalizeContent(design ? { ...library, ...design, format: library.format, version: library.version, id: library.id, title: library.title } : library);
}

export function normalizeContent(raw) {
  if (!raw || raw.format !== CONTENT_FORMAT) throw new Error('Not a content set.');
  const old = !(raw.version >= 2);
  const categories = list(raw.categories, 'categories').map(c => ({ name: text(c?.name), color: text(c?.color, '#888888') }));
  if (categories.length !== KITES) throw new Error(`A content set needs ${KITES} categories.`);
  const properties = PROPS.map(id => {
    const p = list(raw.properties, 'properties').find(x => (OLD_PROPS[x?.id] ?? x?.id) === id) ?? {};
    const name = !text(p.name) || OLD_NAMES.includes(p.name) || p.id === 'cost' ? PROP_NAMES[id] : p.name;
    if (KINDS[id]) return { id, name, kind: KINDS[id] };
    const seen = new Set();
    const choices = list(p.choices, `${id} choices`).flatMap(c => {
      let cid = slug(c?.id ?? c?.name);
      if (id === 'difficulty') cid = difficultyId(cid);
      if (seen.has(cid)) return [];
      seen.add(cid);
      const choice = { id: cid, name: id === 'difficulty' && old ? DIFFICULTY_LEVELS.find(x => x.id === cid)?.name ?? text(c?.name) : text(c?.name, String(c?.id ?? '')) };
      if (id === 'persistence') choice.days = Number.isFinite(c?.days) && c.days > 0 ? c.days : null;
      if (id === 'environment') choice.travel = old ? TRAVEL.includes(cid) : !!c?.travel;
      return [choice];
    });
    const fallback = { persistence: RETRAIN_LEVELS, difficulty: DIFFICULTY_LEVELS }[id] ?? [];
    return { id, name, kind: 'choice', choices: choices.length ? choices : fallback };
  });
  const markIds = new Set();
  const marks = (raw.marks === undefined ? STARTER_MARKS : list(raw.marks, 'marks')).flatMap(m => {
    const mark = { id: slug(m?.id ?? m?.name), symbol: text(m?.symbol, '•'), name: text(m?.name) };
    if (markIds.has(mark.id) || LEGACY_MARKS[mark.id] || DERIVED_MARKS.some(x => x.id === mark.id)) return [];
    markIds.add(mark.id);
    return [mark];
  });
  const central = list(raw.start?.central, 'start.central');
  const valid = central.length === KITES && new Set(central).size === KITES && central.every(c => Number.isInteger(c) && c >= 0 && c < KITES);
  const content = {
    format: CONTENT_FORMAT, version: FORMAT_VERSION,
    id: slug(raw.id ?? raw.title), title: text(raw.title, 'Untitled'),
    categories, properties, marks,
    relevanceNames: list(raw.relevanceNames, 'relevanceNames').length === 5 ? raw.relevanceNames.map(String) : RELEVANCE_NAMES,
    stageNames: list(raw.stageNames, 'stageNames').length === 5 ? raw.stageNames.map(String) : STAGE_NAMES,
    dotNames: list(raw.dotNames, 'dotNames').length === DOTS ? raw.dotNames.map(String) : DOT_NAMES,
    start: { central: valid ? central : Array.from({ length: KITES }, (_, i) => i) },
    rules: cleanRules(raw.rules),   // Every rule, cleaned by its entry in rules.js
    terms: cleanTerms(raw.terms),   // The content set's own word for a star-dot
    player: cleanPlayer(raw.player),
    layout: cleanLayout(raw.layout),
    welcome: text(raw.welcome).slice(0, 200),
    // The library (P10): its items and questions as a starter board (an engine state, progress
    // cleared), in their order and places; a new save on this content set starts from a copy.
    starter: starterOf(raw.starter),   // The designer's welcome line, opening the player's tutorial (Design › Player)   // The star-dot screen's widgets (layout.js)   // What the player may do (player.js; Design › Player)
  };
  // Designs moved to the save. An older content set's designs stay readable, but not
  // written back (non-enumerable, so JSON leaves them out): a save without designs takes them once.
  Object.defineProperty(content, 'legacyDesigns', { value: Array.isArray(raw.designs) ? Array.from({ length: KITES }, (_, i) => normalizeDesign(raw.designs[i])) : null });
  return content;
}

/** A content set's starter board, cleaned (an engine state with no progress), or null. */
function starterOf(st) {
  if (!st || typeof st !== 'object') return null;
  try { return freshBoard(normalizeState(st, FORMAT_VERSION)); } catch { return null; }
}

/** Engine options for a content set: retrain periods, travel environments and its rules, plus `extra`. */
export function optionsFrom(content, extra = {}) {
  const choices = id => content.properties.find(p => p.id === id).choices;
  const periods = Object.fromEntries(choices('persistence').map(c => [c.id, c.days ?? null]));
  const travel = choices('environment').filter(c => c.travel).map(c => c.id);
  const difficultyOrder = choices('difficulty').map(c => c.id);
  return { periods, defaultPeriod: null, travel, difficultyOrder, ...engineRules(content.rules), ...extra };   // The rules the engine reads (rules.js)
}

/** A new save for a content set: its library's items (else only the central star in its starting arrangement). */
export function newSave(content, title = 'Untitled') {
  const colors = content.start.central;
  // From the content set's library when it has one (P10): its items, in their order and places.
  const state = content.starter ?? createState({ colors, kiteNames: colors.map(c => content.categories[c].name) });
  return normalizeSave({ format: SAVE_FORMAT, version: FORMAT_VERSION, content: content.id, title, state, designs: Array(KITES).fill(null) });
}

export function normalizeSave(raw) {
  if (!raw || raw.format !== SAVE_FORMAT) throw new Error('Not a save.');
  if (typeof raw.content !== 'string' || !raw.content) throw new Error('A save must name its content set.');
  const version = Number.isInteger(raw.version) ? raw.version : 1;
  const old = version < 2;
  const state = normalizeState(raw.state, version);
  if (old) {
    // The save's notes and open questions become the central star's notes.
    const notes = raw.notes ?? {};
    const central = Object.values(state.stars).find(s => !s.sources.length && !s.shelved);
    central.notes = [text(notes.text), ...list(notes.questions, 'questions').map(q => text(q))].filter(t => t.trim());
  }
  return {
    format: SAVE_FORMAT, version: FORMAT_VERSION, content: raw.content, title: text(raw.title, 'Untitled'),
    state,
    board: BOARD_RULES.includes(raw.board) ? raw.board : OLD_BOARD_RULES[raw.board] ?? DEFAULT_BOARD_RULE,
    share: Number.isInteger(raw.share) && raw.share >= 1 && raw.share <= 100 ? raw.share : DEFAULT_SHARE,
    gap: GAPS.includes(raw.gap) ? raw.gap : DEFAULT_GAP,
    // The assessor PIN, hashed (pinHash), or null for none.
    pin: typeof raw.pin === 'string' && /^[0-9a-f]{16}$/.test(raw.pin) ? raw.pin : null,
    // The categories' kite designs belong to the save (by category); null for a save
    // from before (the app then takes its content set's, once: see legacyDesigns).
    designs: Array.isArray(raw.designs) ? Array.from({ length: KITES }, (_, i) => normalizeDesign(raw.designs[i])) : null,
    // The save's own design (P10): kept as written; contentFor() cleans it over its content set.
    ...(raw.design && typeof raw.design === 'object' && !Array.isArray(raw.design) && { design: raw.design }),
    // The player's own palette (9b, Your own palette): kept with the save, outside the session.
    ...(playerPalette(raw.playerPalette) && { playerPalette: playerPalette(raw.playerPalette) }),
  };
}

/** A player's own palette, cleaned: { name (≤ 40), colors: [#rrggbb × 6] }, or null. */
function playerPalette(p) {
  const name = typeof p?.name === 'string' ? p.name.trim().slice(0, 40) : '';
  const ok = Array.isArray(p?.colors) && p.colors.length >= KITES && p.colors.slice(0, KITES).every(c => /^#[0-9a-f]{6}$/i.test(c));
  return name && ok ? { name, colors: p.colors.slice(0, KITES).map(c => c.toLowerCase()) } : null;
}

// ---- the assessor PIN; the quiz settings are in rules.js ---------------

/** a content set's word for a star-dot, and its plural ('star-dot' / 'star-dots' unless set). */
export function cleanTerms(raw = {}) {
  const word = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 30) : '');
  const one = word(raw?.stardot) || 'star-dot';
  return { stardot: one, stardots: word(raw?.stardots) || (one === 'star-dot' ? 'star-dots' : `${one}s`) };
}

/**
 * The assessor PIN's stored form: a 64-bit string hash (cyrb53-style, two 32-bit halves), as
 * 16 hex digits. It keeps the PIN out of plain sight in the save; it isn't security (anyone with
 * the files can edit them, or clear the PIN).
 */
export function pinHash(pin) {
  const s = `star-lattice:${pin}`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1, h2].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/** Board rules of version-4 and older saves. */
const OLD_BOARD_RULES = { rotate: 'fixed', within: 'free', anywhere: 'free' };

const propsOf = (raw, base) => {
  const props = { ...base };
  for (const [k, v] of Object.entries(raw ?? {})) {
    const key = OLD_PROPS[k] ?? k;
    if (PROPS.includes(key)) props[key] = propValue(key, key === 'difficulty' ? difficultyId(v) : v);
  }
  return props;
};

/** A checklist line of a version 1 or 2 file, read for the upgrade to star-dots. */
function legacyItem(t, dot, old) {
  const blank = blankDot('').props;
  return {
    text: text(t?.text),
    role: ROLES.includes(t?.role) ? t.role : 'check',
    marks: list(t?.marks, 'item marks').filter(m => typeof m === 'string'),
    // Version 1: the item takes a copy of its star-dot's attributes; high effort is Difficulty Hard.
    props: old ? { ...dot.props, ...(t?.effort === 'high' && { difficulty: 'hard' }) } : propsOf(t?.props, blank),
    guidance: list(t?.guidance, 'guidance').map(g => text(g?.text)).filter(g => g.trim()),
    assessment: t?.assessment ?? null,
    done: !!t?.done, checkedAt: Number.isFinite(t?.checkedAt) ? t.checkedAt : null,
  };
}

/**
 * A description's task lists: "- " lines become children, and a heading line ending in ":"
 * with "- " lines right under it becomes a child holding them. Returns
 * { specs: [{ name, children, lines }] (lines: the source line numbers it used), rest: the remaining text }.
 */
export function descriptionLists(description) {
  const lines = description.split('\n');
  const bullet = l => /^\s*-\s+\S/.test(l);
  const name = l => l.replace(/^\s*-\s+/, '').trim();
  const specs = [];
  const rest = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (bullet(l)) { specs.push({ name: name(l), children: [], lines: [i] }); continue; }
    if (/:\s*$/.test(l) && l.trim().length > 1 && bullet(lines[i + 1] ?? '')) {
      const spec = { name: l.trim().replace(/:\s*$/, '').trim(), children: [], lines: [i] };
      while (bullet(lines[i + 1] ?? '')) { i++; spec.children.push({ name: name(lines[i]), children: [] }); spec.lines.push(i); }
      specs.push(spec);
      continue;
    }
    rest.push(l);
  }
  return { specs, rest: rest.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

/** Fill defaults on every star, kite and dot (so older saves keep loading), upgrade version 1, check references. */
function normalizeState(st, version) {
  const old = version < 2;
  const legacy = version < 3;
  const lines = {};   // version < 3: each dot's checklist lines, converted below
  if (!st || st.version !== STATE_VERSION || typeof st.stars !== 'object') throw new Error('Unreadable board.');
  const dots = {};
  for (const [id, d] of Object.entries(st.dots ?? {})) {
    const blank = blankDot(id);
    const props = propsOf(d.props, blank.props);
    const related = new Set();
    dots[id] = {
      ...blank, id,
      name: text(d.name), description: text(d.description),
      role: ROLES.includes(d.role) ? d.role : 'check',
      marks: list(d.marks, 'marks').filter(m => typeof m === 'string'),
      notes: list(d.notes, 'notes').map(x => text(x)),
      assessment: assessmentValue(d.assessment),   // Cleaned (questions.js); a question set (qset.js)
      trained: !!d.trained, ignitedAt: Number.isFinite(d.ignitedAt) ? d.ignitedAt : null,
      props,
      relations: list(d.relations, 'relations').flatMap(r => {
        if (!st.dots[r?.dot] || r.dot === id || related.has(r.dot)) return [];
        related.add(r.dot);
        return [{ dot: r.dot, score: SCORES.includes(r.score) ? r.score : 3, how: text(r.how) }];
      }),
      history: list(d.history, 'history').map(x => ({ text: text(x?.text), at: Number.isFinite(x?.at) ? x.at : null })),
      branch: typeof d.branch === 'string' ? d.branch : null,
      ...(d.layout && { layout: cleanLayout(d.layout) }),   // Its screen's own layout (layout.js), when it has one
    };
    if (legacy) lines[id] = list(old ? d.training : d.items, 'checklist').map(t => legacyItem(t, { props }, old));
  }
  const kites = {};
  for (const [id, k] of Object.entries(st.kites ?? {})) {
    const slots = list(k.dots, 'kite dots');
    if (slots.length !== DOTS) throw new Error('A kite needs four star-dot slots.');
    kites[id] = {
      id, name: text(k.name), description: text(k.description), color: Number.isInteger(k.color) ? k.color : null,
      dots: slots.map(d => (d && dots[d] ? d : null)),
      labels: Array.from({ length: DOTS }, (_, i) => text(k.labels?.[i])),
      design: normalizeDesign(k.design),
    };
  }
  const stars = {};
  for (const [id, s] of Object.entries(st.stars)) {
    if (list(s.kites, 'star kites').length !== KITES || !s.kites.every(k => kites[k])) throw new Error('A star needs six kites.');
    stars[id] = {
      id, n: Number(s.n) || 0, sources: list(s.sources, 'sources').filter(d => dots[d]), kites: [...s.kites],
      notes: list(s.notes, 'star notes').map(x => text(x)), shelved: !!s.shelved,
      // Before version 5 no star was deployed but the central one (set below).
      deployed: version >= 5 && !!s.deployed,
      // An independent star, holding its category's next items.
      ...(s.independent && kites[s.category] && { independent: true, category: s.category }),
    };
    if (stars[id].sources.length) stars[id].shelved = false;
  }
  if (Object.values(stars).filter(s => !s.sources.length && !s.shelved).length !== 1) throw new Error('A board needs exactly one central star.');
  Object.values(stars).find(s => !s.sources.length && !s.shelved).deployed = true;   // the central star is always on the map
  // Version 4 → 5: a non-central star's notes join its source star-dot's Notes.
  if (version < 5) {
    for (const s of Object.values(stars)) {
      const notes = s.notes.filter(n => n.trim());
      const src = s.sources[0] && dots[s.sources[0]];
      if (!src || !notes.length) continue;
      src.notes = [...src.notes, ...notes];
      s.notes = [];
    }
  }
  for (const d of Object.values(dots)) if (d.branch && !stars[d.branch]?.sources.includes(d.id)) d.branch = null;
  // Retired star-dots: listed once, only those not in a slot.
  const placedKites = new Set(Object.values(stars).flatMap(s => s.kites));
  const inKites = new Set(Object.values(kites).flatMap(k => k.dots.filter(Boolean)));
  const retired = [];
  for (const e of list(st.retired, 'retired')) {
    if (!dots[e?.id] || inKites.has(e.id) || retired.some(r => r.id === e.id)) continue;
    const from = e.from ?? {};
    retired.push({
      id: e.id, at: Number.isFinite(e.at) ? e.at : null,
      from: {
        parent: dots[from.parent] ? from.parent : null, kite: kites[from.kite] ? from.kite : null,
        slot: Number.isInteger(from.slot) && from.slot >= 0 && from.slot < DOTS ? from.slot : 0,
      },
    });
  }
  const isRetired = new Set(retired.map(e => e.id));
  // The shelf: everything that has no place, listed once (anything left without a place joins it, except retired star-dots).
  // The lists' items, each listed once, on central kites; not on the shelf.
  // A listed star-dot is also in the tree (syncArrangements), so a slot no longer drops it.
  const centralKites = new Set(Object.values(stars).filter(s => !s.sources.length && !s.shelved).flatMap(s => s.kites));
  const listed = new Set();
  const lists = {};
  for (const [k, items] of Object.entries(st.lists && typeof st.lists === 'object' ? st.lists : {})) {
    if (!centralKites.has(k)) continue;
    lists[k] = list(items, 'list').filter(d => dots[d] && !isRetired.has(d) && !listed.has(d) && listed.add(d));
  }
  const has = { star: id => stars[id]?.shelved, kite: id => kites[id] && !placedKites.has(id), dot: id => dots[id] && !inKites.has(id) && !isRetired.has(id) && !listed.has(id) };
  const shelf = [];
  const add = (kind, id) => !shelf.some(e => e.kind === kind && e.id === id) && shelf.push({ kind, id });
  for (const e of list(st.shelf, 'shelf')) if (has[e?.kind]?.(e.id)) add(e.kind, e.id);
  for (const s of Object.values(stars)) if (s.shelved) add('star', s.id);
  for (const k of Object.keys(kites)) if (has.kite(k)) add('kite', k);
  for (const d of Object.keys(dots)) if (has.dot(d)) add('dot', d);
  // Hour blocks: on star-dots that exist, with a time and a positive length, in start order, ids once.
  const blockIds = new Set();
  const blocks = list(st.blocks, 'blocks').flatMap(b => {
    if (typeof b?.id !== 'string' || blockIds.has(b.id) || !dots[b.dot] || !Number.isFinite(b.start)) return [];
    blockIds.add(b.id);
    return [{ id: b.id, dot: b.dot, start: b.start, minutes: Number.isInteger(b.minutes) && b.minutes > 0 ? b.minutes : BLOCK_MINUTES }];
  }).sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
  // Each star-dot's progress through its set, on questions it has (absent when none).
  for (const [id, d] of Object.entries(st.dots ?? {})) {
    const ids = new Set(gradedOf(dots[id].assessment).map(q => q.id));
    const answered = Object.fromEntries(Object.entries(d.answered && typeof d.answered === 'object' ? d.answered : {}).filter(([q, t]) => ids.has(q) && Number.isFinite(t)));
    if (Object.keys(answered).length && dots[id].ignitedAt == null) dots[id] = { ...dots[id], answered };
  }
  // Waits after wrong answers, on star-dots that exist; per question,
  // "dotId#questionId" (an older wait, by star-dot only, goes to its first question).
  const waits = Object.fromEntries(Object.entries(st.waits && typeof st.waits === 'object' ? st.waits : {}).flatMap(([k, t]) => {
    const [d, q] = splitKey(k);
    if (!dots[d] || !Number.isFinite(t)) return [];
    const qs = questionsOf(dots[d].assessment).map(x => x.id);
    if (q == null) return qs.length ? [[waitKey(d, gradedOf(dots[d].assessment)[0]?.id ?? qs[0]), t]] : [];
    return qs.includes(q) ? [[k, t]] : [];
  }));
  // Goals (on star-dots that exist) and completed categories, by category index.
  const byCategory = (obj, ok) => Object.fromEntries(Object.entries(obj && typeof obj === 'object' ? obj : {}).filter(([c, v]) => /^[0-5]$/.test(c) && ok(v)));
  const goals = byCategory(st.goals, d => typeof d === 'string' && !!dots[d]);
  const complete = byCategory(st.complete, Number.isFinite);
  const seed = typeof st.seed === 'string' ? st.seed.slice(0, 64) : '';   // The session's shuffle seed
  const count = n => (Number.isInteger(n) && n >= 0 ? n : 0);
  const bonus = st.bonus && typeof st.bonus === 'object' ? {
    count: count(st.bonus.count),
    // The rungs claimed, in any order (from before: the first `claimed`); who earned each (its prize's place).
    got: Array.isArray(st.bonus.got) ? [...new Set(st.bonus.got.filter(i => Number.isInteger(i) && i >= 0 && i < 40))] : Array.from({ length: Math.min(40, count(st.bonus.claimed)) }, (_, i) => i),
    ...(typeof st.bonus.at === 'string' && dots[st.bonus.at] && { at: st.bonus.at }),
    ...(st.bonus.by && typeof st.bonus.by === 'object' && { by: Object.fromEntries(Object.entries(st.bonus.by).filter(([i, d]) => /^\d+$/.test(i) && typeof d === 'string' && dots[d])) }),
    ...Object.fromEntries(['spent', 'again', 'ahead', 'hint'].filter(k => count(st.bonus[k])).map(k => [k, count(st.bonus[k])])),   // 9c's spins
  } : null;   // the bonus ladder (bonus.js)
  // 9d's comets this session: ignites counted, messages waiting and flown, notes written.
  const ids = a => (Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && x.length <= 40))].slice(0, 200) : []);
  const active = (Array.isArray(st.comets?.active) ? st.comets.active : []).filter(a => typeof a?.id === 'string' && typeof a.text === 'string' && a.text.trim()).slice(0, 40).map(a => ({ id: a.id.slice(0, 40), text: a.text.trim().slice(0, 140), mine: !!a.mine }));
  const comets = st.comets && typeof st.comets === 'object' ? { lit: count(st.comets.lit), due: ids(st.comets.due), flown: ids(st.comets.flown), written: count(st.comets.written), active } : null;
  // The player's look this session (9b): their palette, and the kite designs they painted (by
  // category; over the designer's, until a new session).
  const lookPalette = typeof st.look?.palette === 'string' && st.look.palette.length <= 40 ? st.look.palette : null;
  const lookDesigns = Array.isArray(st.look?.designs) ? Array.from({ length: KITES }, (_, i) => normalizeDesign(st.look.designs[i])) : null;
  const look = lookPalette || lookDesigns?.some(Boolean) ? { ...(lookPalette && { palette: lookPalette }), ...(lookDesigns?.some(Boolean) && { designs: lookDesigns }) } : null;
  const fun = normalizeFun(st.fun);   // 9e's streak and marks this session
  const state = { version: STATE_VERSION, nextId: Number(st.nextId) || 0, stars, kites, dots, shelf, retired, blocks, waits, lists, goals, complete, seed, ...(fun && { fun }), ...(bonus && (bonus.count || bonus.got.length) && { bonus }), ...(look && { look }), ...(comets && (comets.lit || comets.due.length || comets.flown.length || comets.written || comets.active.length) && { comets }) };
  return legacy ? childrenFromLines(state, lines) : state;
}

/** Version 2 → 3: every star-dot's checklist lines, their guidance and its description lists become its children. */
function childrenFromLines(st, lines) {
  const ids = Object.keys(st.dots);
  for (const id of ids) {
    const dot = st.dots[id];
    const specs = (lines[id] ?? []).map(t => ({
      name: t.text, from: `Was a checklist line of ${dot.name || 'a star-dot'}`,
      // A line done without a date counted as fresh for good; as a star-dot it's dated 0 (fresh only under Retrain Never).
      fields: { role: t.role, marks: t.marks, props: t.props, assessment: t.assessment, trained: t.done, ignitedAt: t.done ? t.checkedAt ?? 0 : null },
      children: t.guidance.map(g => ({
        name: g, from: `Was guidance under ${t.text || 'a checklist line'}`, children: [],
        ...(t.done && { fields: { trained: true, ignitedAt: t.checkedAt ?? 0 } }),
      })),
    }));
    const { specs: listed, rest } = descriptionLists(dot.description);
    const star = dot.branch && st.stars[dot.branch];
    const taken = new Set([
      ...(star ? star.kites.flatMap(k => st.kites[k].dots.filter(Boolean).map(d => st.dots[d].name.trim())) : []),
      ...specs.map(x => x.name.trim()),
    ]);
    for (const x of listed) {
      if (taken.has(x.name)) continue;
      taken.add(x.name);
      const from = `Was a line in ${dot.name || 'a star-dot'}’s description`;
      specs.push({ name: x.name, from, children: x.children.map(c => ({ ...c, from: `Was a line under ${x.name} in ${dot.name || 'a star-dot'}’s description` })) });
    }
    if (listed.length) st = { ...st, dots: { ...st.dots, [id]: { ...st.dots[id], description: rest } } };
    st = addChildren(st, id, specs);
  }
  return st;
}

/** Place converted children (and theirs) on a star-dot's star, in fill order; any beyond its 24 slots go to the shelf. */
function addChildren(st, dotId, specs) {
  if (!specs.length) return st;
  let starId;
  [st, starId] = planStar(st, dotId);
  for (const spec of specs) {
    const slot = childSlots(st, starId).find(s => !st.kites[s.kite].dots[s.slot]);
    let id;
    if (slot) [st, id] = placeDot(st, slot.kite, slot.slot, spec.name);
    else {
      // No free slot: it waits on the shelf.
      id = 'd' + st.nextId;
      st = { ...st, nextId: st.nextId + 1, dots: { ...st.dots, [id]: blankDot(id, spec.name) }, shelf: [...st.shelf, { kind: 'dot', id }] };
    }
    const dot = st.dots[id];
    st = { ...st, dots: { ...st.dots, [id]: { ...dot, ...spec.fields, props: { ...dot.props, ...spec.fields?.props }, history: [{ text: spec.from, at: null }] } } };
    st = addChildren(st, id, spec.children);
  }
  return st;
}
