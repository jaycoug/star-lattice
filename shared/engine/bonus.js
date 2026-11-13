// The bonus ladder (P9, 9b; Design › Fun). The designer puts prizes on a ladder, in any order; in
// Play mode each is locked until the player climbs to it: every `every` star-dots ignited this
// session earns the next rung, which the player claims by clicking its prize on the Star view (an
// icon in an empty position of the map). Edit mode is never gated.
//
// A prize is one of the player's tools (a Design › Player switch that's on), or one of the extra
// prizes (PRIZES), none staged: the kite designer's Cut out kite shapes and Paint on kites (with
// each built-in palette and Your own palette, offered on every board. With a ladder in effect, the
// player has exactly the extra prizes they've claimed, whatever Player's Kite designer and Palette
// say: one not on the ladder is never theirs; the kite designer (with Kites: Solid | Designs) and the
// palette menu show once they've claimed one of theirs. Without a ladder, Design › Player decides as
// before (the whole designer, every palette).
//
// rule bonuses: { on: 'off' | 'on', every: 1–99, ladder: [prize key] } (rules.js)
// state.bonus: { count, claimed, at, spent, again, ahead, hint }: star-dots ignited this session (a
// lapse doesn't take one back), rungs claimed, the star-dot whose ignite earned the latest rung (its
// prize shows beside it); and 9c's spins: spins used, spins won by Spin again, rungs won early by
// The next prize early, hints waiting for the next question. A new session clears it.
//
// 9c, Spin the star: `spin` is a prize (as often as the designer puts it on the ladder); each one
// claimed is a spin. A spin turns a star like a pinwheel; the kite that stops at the top is one of
// the outcomes in play (rule bonuses.spin, kite i → outcomes[i mod n]).

import { derive } from './derive.js';
import { PLAYER_KEY } from './player.js';
import { DEFAULT_PALETTES } from '../color.js';

const title = s => s[0].toUpperCase() + s.slice(1);
/** The extra prizes: { key, label, needs (the Player switch they come with), kind }. */
export const PRIZES = [
  { key: 'kite:cut', label: 'Cut out kite shapes', needs: 'kiteDesign', kind: 'kite' },
  { key: 'kite:paint', label: 'Paint on kites', needs: 'kiteDesign', kind: 'kite' },
  ...Object.keys(DEFAULT_PALETTES).map(n => ({ key: `palette:${n}`, label: `Palette: ${title(n)}`, needs: 'palette', kind: 'palette', palette: n })),
  { key: 'palette:own', label: 'Your own palette', needs: 'palette', kind: 'palette' },
  { key: 'spin', label: 'A spin of the star', kind: 'spin' },
  { key: 'comet', label: 'A comet with your message', kind: 'comet' },
  { key: 'comet:write', label: 'A comet the player writes', kind: 'write' },
];
export const PRIZE = Object.fromEntries(PRIZES.map(p => [p.key, p]));
/**
 * The player's tools that can be prizes (the Star view's): the three moves. Kites:
 * Solid | Designs comes with the kite prizes; Undo is never a prize (Design › Player gives it for
 * the whole session, or not). The layer (the constellation) is never a prize: Design › Player gives
 * it, or not.
 */
export const LADDER_TOOLS = ['swap', 'rotateDots', 'rotateKites'];

/** Why a prize can't do anything under this content set's rules (so it isn't offered), or null. */
export function prizeProblem(content, k) {
  const r = content.rules ?? {};
  const moves = ['swap', 'rotateDots', 'rotateKites'].includes(k);
  if (moves && r.stardots === 'independent') return 'nothing moves under Independent (items keep their list order)';
  if ((k === 'swap' || k === 'rotateKites') && r.locks === 'on' && r.kites !== 'central') return 'nothing swaps with Kites lock on';
  if (k === 'rotateKites' && r.kites === 'central') return 'only the central star has kites to turn';
  return null;
}
/** Everything that can go on the ladder, in Add a prize…'s order. */
export const LADDER_KEYS = [...LADDER_TOOLS, ...PRIZES.map(p => p.key)];
/** A prize's name. */
export const prizeLabel = k => PRIZE[k]?.label ?? PLAYER_KEY[k]?.label ?? k;
/** Whether a prize can go on the ladder as far as Player goes: a tool only if Player gives it; the extra prizes always. */
const given = (content, k) => !!PRIZE[k] || content.player?.[k] !== false;

const bonusOf = st => st.bonus ?? { count: 0, got: [] };
/** The rungs the player has claimed (their places on the ladder), in any order: `got` (from before: the first `claimed`). */
export const gotOf = st => { const b = bonusOf(st); return b.got ?? Array.from({ length: b.claimed ?? 0 }, (_, i) => i); };
/** The ladder in effect: its rungs, only what the player is given (Design › Player). */
export function ladderOf(content) {
  const b = content.rules?.bonuses;
  if (b?.on !== 'on') return null;
  const rungs = (b.ladder ?? []).filter(k => LADDER_KEYS.includes(k) && given(content, k) && !prizeProblem(content, k));
  return rungs.length ? { every: b.every, rungs } : null;
}

/**
 * Where the player is on the ladder: { rungs, every, count, earned (rungs earned, the first so many),
 * claimed (how many claimed), ready (rungs earned and not claimed: each a prize on the field), next
 * (the first of them, or null), toGo }.
 */
export function bonusStatus(content, st) {
  const ladder = ladderOf(content);
  if (!ladder) return null;
  const { count, ahead = 0 } = bonusOf(st);
  const earned = Math.min(ladder.rungs.length, Math.floor(count / ladder.every) + ahead);   // (ahead: rungs a spin brought forward)
  const got = new Set(gotOf(st).filter(i => i < ladder.rungs.length));
  const ready = Array.from({ length: earned }, (_, i) => i).filter(i => !got.has(i));
  return { ...ladder, count, earned, claimed: got.size, ready, next: ready.length ? ladder.rungs[ready[0]] : null, toGo: earned >= ladder.rungs.length ? 0 : ladder.every - (count % ladder.every) };
}

/**
 * Whether the player has a prize (or tool). Without a ladder: what Player gives. With one: a tool
 * is given unless it's on the ladder and not yet claimed; an extra prize only once claimed.
 */
export function hasPrize(content, st, k) {
  if (!given(content, k)) return false;
  const ladder = ladderOf(content);
  if (!ladder) return true;
  if (!ladder.rungs.includes(k)) return !PRIZE[k];
  const got = gotOf(st);
  return ladder.rungs.some((x, i) => x === k && got.includes(i));
}

/** The player's switches with what isn't theirs yet turned off (tools on the ladder; the designer and the palette menu without one of their prizes). */
export function earnedPlayer(content, st) {
  const ladder = ladderOf(content);
  if (!ladder) return content.player;
  const set = Object.fromEntries(LADDER_TOOLS.filter(k => !hasPrize(content, st, k)).map(k => [k, false]));
  // The kite designer, with Kites: Solid | Designs, and the palette menu: theirs with one of their prizes, whatever Player says.
  const kite = PRIZES.some(p => p.kind === 'kite' && hasPrize(content, st, p.key));
  Object.assign(set, { kiteDesign: kite, kiteLook: kite, palette: PRIZES.some(p => p.kind === 'palette' && hasPrize(content, st, p.key)) });
  return { ...content.player, ...set };
}

/**
 * What the player's kite designer offers, from the prizes they have: { tones, modes, syms } (null:
 * everything, in Edit mode). Cut out: Ink and Clear, in Fill. Paint on: Light and Dark, Fill and
 * Lines, every symmetry; without it, symmetry stays Across ↔.
 */
export function designerAllows(content, st, edit) {
  if (edit) return null;
  const cut = hasPrize(content, st, 'kite:cut'), paint = hasPrize(content, st, 'kite:paint');
  if (cut && paint) return null;
  return {
    tones: [...(cut ? ['none', 'ink'] : []), ...(paint ? ['light', 'dark'] : [])],
    modes: paint ? ['fill', 'lines'] : ['fill'],
    syms: paint ? ['none', 'across', 'along', 'both'] : ['across'],
  };
}

/** The palettes the player may pick: built-in names they have, and 'own' once Your own palette is theirs. */
export function playerPalettes(content, st) {
  return PRIZES.filter(p => p.kind === 'palette' && hasPrize(content, st, p.key)).map(p => p.palette ?? 'own');
}

/** Spins the player has to use: one per spin claimed, plus those Spin again gave, less those used. */
export function spinsLeft(content, st) {
  const ladder = ladderOf(content);
  if (!ladder) return 0;
  const b = bonusOf(st);
  const claimed = gotOf(st).filter(i => ladder.rungs[i] === 'spin').length;
  return Math.max(0, claimed + (b.again ?? 0) - (b.spent ?? 0));
}

/** Notes the player has been given to write: one per "Write a comet" claimed. */
export function writesClaimed(content, st) {
  const ladder = ladderOf(content);
  return ladder ? gotOf(st).filter(i => ladder.rungs[i] === 'comet:write').length : 0;
}

/** The outcome for each of a star's six kites (kite i → the outcomes in play, i mod n). */
export const spinOutcomes = content => {
  const outs = content.rules?.bonuses?.spin?.length ? content.rules.bonuses.spin : ['hint', 'prize', 'again', 'nothing'];
  return Array.from({ length: 6 }, (_, i) => outs[i % outs.length]);
};

/**
 * Use a spin landing on kite i (0–5) of the star spun: { state, outcome } ('hint', 'prize', 'again',
 * 'nothing'; 'prize' with no prize left becomes 'nothing'). Without a spin to use, nothing changes.
 */
export function spinStar(content, st, i) {
  if (spinsLeft(content, st) < 1) return { state: st, outcome: null };
  let outcome = spinOutcomes(content)[i % 6];
  const s = bonusStatus(content, st);
  if (outcome === 'prize' && s.earned >= s.rungs.length) outcome = 'nothing';
  const b = bonusOf(st);
  const bonus = { ...b, spent: (b.spent ?? 0) + 1 };
  if (outcome === 'hint') bonus.hint = (b.hint ?? 0) + 1;
  if (outcome === 'again') bonus.again = (b.again ?? 0) + 1;
  if (outcome === 'prize') bonus.ahead = (b.ahead ?? 0) + 1;
  return { state: { ...st, bonus }, outcome };
}

/** Use a waiting hint (as a question opens): the state with one fewer. */
export const useHint = st => ({ ...st, bonus: { ...bonusOf(st), hint: Math.max(0, (bonusOf(st).hint ?? 0) - 1) } });

/** After a change: count the star-dots that ignited in it (with a ladder in effect). */
export function settleBonus(content, before, st, options) {
  if (!ladderOf(content)) return st;
  const [was, now] = [derive(before, options), derive(st, options)];
  const lit = (v, d) => v.effective(d).status === 'ignited';
  const lit2 = Object.keys(st.dots).filter(d => lit(now, d) && !(before.dots[d] && lit(was, d)));
  if (!lit2.length) return st;
  const b = bonusOf(st);
  const count = b.count + lit2.length;
  const every = ladderOf(content).every;
  // Each rung this change earned remembers the star-dot that earned it (its prize appears beside it,
  // and stays there until it's claimed).
  const [from, to] = [Math.floor(b.count / every), Math.floor(count / every)].map(n => n + (b.ahead ?? 0));
  const by = { ...(b.by ?? {}) };
  for (let i = from; i < to; i++) by[i] = lit2[lit2.length - 1];
  return { ...st, bonus: { ...b, got: gotOf(st), count, ...(to > from && { at: lit2[lit2.length - 1], by }) } };
}

/** Claim rung `i` (a prize on the field), any one ready, in any order (none given: the first ready). */
export function claimBonus(content, st, i) {
  const s = bonusStatus(content, st);
  const which = i ?? s?.ready[0];
  if (!s || !s.ready.includes(which)) return st;
  return { ...st, bonus: { ...bonusOf(st), got: [...gotOf(st), which] } };
}

/** The prizes on the field: every rung earned, in ladder order, { i, key, near (its star-dot), claimed } (claimed ones keep their place, unseen, so the rest never move). */
export function fieldPrizes(content, st) {
  const s = bonusStatus(content, st);
  if (!s) return [];
  const got = new Set(gotOf(st));
  const by = bonusOf(st).by ?? {};
  return Array.from({ length: s.earned }, (_, i) => ({ i, key: s.rungs[i], near: by[i] ?? null, claimed: got.has(i) }));
}
