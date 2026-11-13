// The program's data, on the shared engine. The working file is the open save, its content set,
// and settings kept in this browser (see storage.js):
//
// { name, content, save, palettes: { name: [color × 6] }, meta: { track }, kiteLook, theme }
//
// `name` is the save's file name (saves/<name>.json); `content` its content set (content/<id>.json).
// Every change to `save` or `content` is written back to those files.
//
// `palettes` are the built-in ones (DEFAULT_PALETTES) and the user's own (kept in this browser).
// The palette in use is the content set's category colors; resolve() names it by matching them,
// or lists them as "current" when no palette matches.
//
// The title lives in the save (save.title); notes live on the stars (the central star's are the general notes).
// The engine's normalizeSave() and normalizeContent() check anything loaded. resolve() gives the
// panels the engine state with its derived view (`ev`) and the file's settings; panels address
// star-dots, kites and stars by engine ID. under Star-dots: Independent the panels'
// `state` is the lists' placement (E.viewState, independent.js); every change still goes to the save's
// own state, whose hierarchy stays dormant.

import * as E from '../../shared/engine/index.js';


// ---- Palettes -----------------------------------------------------------------------------------

export { DEFAULT_PALETTES } from '../../shared/color.js';   // the built-in palettes (shared: the player's palette menu uses them too)
import { DEFAULT_PALETTES } from '../../shared/color.js';
import { route } from './route.js';
export const MAX_PALETTE_NAME = 40;
const HEX = /^#[0-9a-f]{6}$/i;

/** Whether `name` is a built-in palette (or "current", the unnamed colors in use). */
export const builtInPalette = name => name === 'current' || Object.hasOwn(DEFAULT_PALETTES, name);
const samePalette = (a, b) => a.length === b.length && a.every((c, i) => String(c).toLowerCase() === String(b[i]).toLowerCase());

/** Why `name` can't name one of the user's palettes, or '' when it can (an existing one of theirs is replaced). */
export function paletteNameProblem(name) {
  const n = String(name ?? '').trim();
  if (!n) return 'Give the palette a name.';
  if (n.length > MAX_PALETTE_NAME) return `Keep the name to ${MAX_PALETTE_NAME} characters.`;
  if (builtInPalette(n)) return `"${n}" is a built-in palette; choose another name.`;
  return '';
}

/** The user's own palettes among `palettes` (what this browser keeps). */
export const ownPalettes = palettes => Object.fromEntries(Object.entries(palettes).filter(([n]) => !builtInPalette(n)));

// ---- File format ------------------------------------------------------------------------------

/**
 * The working file for save `name` (with its content set), and this browser's settings `prefs`.
 * `content` is the library; the save's own design (save.design) goes over it, and from then on
 * lives in `file.content` (written back into the save, storage.js).
 */
export function openFile(name, save, content, prefs = {}) {
  content = E.contentFor(content, save);
  if (save.design) { const { design: _d, ...rest } = save; save = rest; }
  // A deployed star whose faced position is taken (stars no longer move outward) is
  // withdrawn as the save opens; it's written with the next change.
  const { state: settled } = E.withdrawBlocked(save.state, { ...E.optionsFrom(content), share: save.share ?? E.DEFAULT_SHARE, now: Math.floor(Date.now() / 60000) * 60000 });
  if (settled !== save.state) save = { ...save, state: settled };
  // One set of star-dots in both arrangements (a list-only item gets a tree place, a
  // tree-only star-dot joins its list); written with the next change.
  const synced = E.syncArrangements(save.state, E.optionsFrom(content));
  if (synced !== save.state) save = { ...save, state: synced };
  // Category designs belong to the save; a save from before takes its content set's, once.
  if (!save.designs) save = { ...save, designs: content.legacyDesigns ?? Array(E.KITES).fill(null) };
  const palettes = { ...DEFAULT_PALETTES };
  for (const [id, colors] of Object.entries(prefs.palettes ?? {})) {
    if (!paletteNameProblem(id) && Array.isArray(colors) && colors.length >= E.KITES && colors.slice(0, E.KITES).every(c => HEX.test(c))) {
      palettes[id.trim()] = colors.slice(0, E.KITES).map(c => c.toLowerCase());
    }
  }
  return {
    name, content, save, palettes,
    meta: { track: typeof prefs.track === 'string' ? prefs.track : '' },
    kiteLook: prefs.kiteLook === 'designs' ? 'designs' : 'solid',   // PLAY's unselected kites: solid or their designs
    theme: THEMES.includes(prefs.theme) ? prefs.theme : null,       // light or dark, as chosen here; null follows the system
  };
}

export const THEMES = ['light', 'dark'];
/** The theme in effect: the one chosen in this browser, else the system's preference. */
export const themeOf = file => file.theme ?? (globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light');

/** The settings of a working file that are kept in this browser. */
export const prefsOf = file => ({
  last: file.name, palettes: ownPalettes(file.palettes), track: file.meta.track,
  kiteLook: file.kiteLook, theme: file.theme,
});

/**
 * The design a kite shows: its own, else its category's: in Play mode the player's from this session
 * (state.look.designs) if they painted one, else the save's (the designer's); null for none (solid).
 */
export function designOf(save, kiteId, playing = false) {
  const kite = save.state.kites[kiteId];
  if (!kite) return null;
  if (kite.design) return kite.design;
  if (kite.color == null) return null;
  return (playing && save.state.look?.designs?.[kite.color]) || save.designs?.[kite.color] || null;
}

const baseOptions = new WeakMap();
/** Engine options for a file: its content set's rules and retrain periods, its save's ignition share, at the current minute. */
export function options(file) {
  if (!baseOptions.has(file.content)) baseOptions.set(file.content, E.optionsFrom(file.content));
  return { ...baseOptions.get(file.content), share: file.save.share ?? E.DEFAULT_SHARE, now: Math.floor(Date.now() / 60000) * 60000 };
}

// ---- The panels' view ---------------------------------------------------------------------------

const resolved = new WeakMap();   // file → { edit, play }

/** The player's palette in effect (9b), or null: in Play mode, one they've picked and still have. */
export function playerColors(file) {
  const { content, save } = file;
  const name = save.state.look?.palette;
  if (!name || route().mode !== 'play' || E.earnedPlayer(content, save.state).palette === false || !E.playerPalettes(content, save.state).includes(name)) return null;
  return name === 'own' ? save.playerPalette?.colors ?? null : DEFAULT_PALETTES[name] ?? null;
}

export function resolve(file) {
  const mode = route().mode === 'play' ? 'play' : 'edit';
  const cached = resolved.get(file)?.[mode];
  if (cached) return cached;
  const { save } = file;
  // In Play mode the player's palette recolors their board (never the content set itself).
  const colors = playerColors(file);
  const content = colors ? { ...file.content, categories: file.content.categories.map((c, i) => ({ ...c, color: colors[i] })) } : file.content;
  const st = E.viewState(save.state, options(file));   // Independent's placement, else the state itself
  const inUse = file.content.categories.map(c => c.color);
  const palette = Object.keys(file.palettes).find(n => samePalette(file.palettes[n], inUse)) ?? 'current';
  const view = {
    file, content, save, state: st, ev: E.derive(st, options(file)),
    meta: { title: save.title, track: file.meta.track },
    palettes: palette === 'current' ? { current: inUse, ...file.palettes } : file.palettes, palette,
    kiteLook: file.kiteLook ?? 'solid',
    player: E.earnedPlayer(file.content, save.state),   // Design › Player, less the bonus ladder's locked rungs
    theme: themeOf(file),
  };
  resolved.set(file, { ...resolved.get(file), [mode]: view });
  return view;
}

// ---- Lookups ------------------------------------------------------------------------------------

/** The trail to a star: the star-dots it was deployed from, from the central star down (first sources). */
export function trailTo(state, starId) {
  const trail = [];
  for (let s = starId; s && state.stars[s]?.sources.length && trail.length < 64;) {
    const d = state.stars[s].sources[0];
    trail.unshift(d);
    s = E.starOfDot(state, d);
  }
  return trail;
}

/**
 * How every star-dot relates to the focused one, for highlighting: 'focus' (itself), 'up' (it
 * relates to this directly), 'up-far' (through others), 'implicit' (a star-dot its star was deployed from),
 * 'down' (this relates to it directly), 'down-far' (through others). Empty when nothing is focused.
 */
export function linkRoles(state, focus) {
  const roles = new Map();
  if (!focus || !state.dots[focus] || !E.index(state).dot.has(focus)) return roles;
  const out = d => state.dots[d].relations.map(r => r.dot).filter(x => state.dots[x]);
  const into = d => Object.values(state.dots).filter(x => x.relations.some(r => r.dot === d)).map(x => x.id);
  const walk = (next, near, far) => {
    const seen = new Set([focus]);
    for (let frontier = next(focus), depth = 1; frontier.length; depth++) {
      const following = [];
      for (const d of frontier) {
        if (seen.has(d)) continue;
        seen.add(d);
        if (!roles.has(d)) roles.set(d, depth === 1 ? near : far);
        following.push(...next(d));
      }
      frontier = following;
    }
  };
  walk(out, 'up', 'up-far');
  walk(into, 'down', 'down-far');
  for (const d of trailTo(state, E.starOfDot(state, focus))) if (!roles.has(d)) roles.set(d, 'implicit');
  roles.set(focus, 'focus');
  return roles;
}
