// Comets and messages (P9, 9d; Design › Fun › Comets). A comet crosses the Star view (Play mode)
// trailing one message as its tail: the designer's, each with a trigger, or the player's own.
//
// rule comets: { on: 'off' | 'on', messages: [{ id, text (≤ 140), when, n, category }] } (rules.js)
//   when 'ignites': once the player has ignited `n` star-dots this session;
//        'category': once category `category` is complete this session;
//        'random':   now and then while they play (the app draws these, every few minutes);
//        'ladder':   when the player claims "A comet" on the bonus ladder (the next in the list).
// state.comets: { lit, due: [id], flown: [id], written, active: [{ id, text, mine }] }: star-dots
//   ignited this session (a lapse doesn't take one back), messages waiting to cross once (in order),
//   those that have (each crosses once a session), notes the player has written this session, and the
//   prize comets: won on the ladder ("A comet": your next 'ladder' message; "Write a comet": the
//   player's own note, as soon as it's written), each cycling across the Star view for the rest of
//   the session. A new session clears it.

import { derive } from './derive.js';

export const COMET_WHEN = ['ignites', 'category', 'random', 'ladder'];
const MAX_TEXT = 140;
const cometsOf = st => ({ lit: 0, due: [], flown: [], written: 0, active: [], ...st.comets });
const rule = content => (content.rules?.comets?.on === 'on' ? content.rules.comets : null);

/** One message, cleaned (null when it says nothing). */
export function cleanMessage(m, i) {
  const text = typeof m?.text === 'string' ? m.text.trim().slice(0, MAX_TEXT) : '';
  const when = COMET_WHEN.includes(m?.when) ? m.when : 'random';
  const n = Number(m?.n), category = Number(m?.category);
  const id = typeof m?.id === 'string' && /^m\d+$/.test(m.id) ? m.id : `m${i + 1}`;
  return { id, text, when, n: Number.isInteger(n) && n >= 1 && n <= 999 ? n : 5, category: Number.isInteger(category) && category >= 0 && category < 6 ? category : 0 };
}

/** The prize comets' messages ("A comet with your message", in ladder order): written on the ladder, whether or not Comets is on. */
export const ladderMessages = content => (content.rules?.comets?.messages ?? []).filter(m => m.when === 'ladder');

/** The messages in play (on, with something to say). */
export const cometMessages = content => (rule(content)?.messages ?? []).filter(m => m.text);

/**
 * After a change: messages whose trigger it met join the queue (ignites counted; categories newly
 * complete). Each is due once a session.
 */
export function settleComets(content, before, st, options) {
  const r = rule(content);
  if (!r) return st;
  const c = cometsOf(st);
  let lit = c.lit;
  const [was, now] = [derive(before, options), derive(st, options)];
  const on = (v, d) => v.effective(d).status === 'ignited';
  lit += Object.keys(st.dots).filter(d => on(now, d) && !(before.dots[d] && on(was, d))).length;
  const known = new Set([...c.due, ...c.flown]);
  const due = cometMessages(content).filter(m => !known.has(m.id) && (
    (m.when === 'ignites' && lit >= m.n) || (m.when === 'category' && st.complete?.[m.category] != null))).map(m => m.id);
  if (lit === c.lit && !due.length) return st;
  return { ...st, comets: { ...c, lit, due: [...c.due, ...due] } };
}

/** Queue a “now and then” message to cross once (one at random not yet sent, `pick` 0–1). */
export function queueComet(content, st, kind = 'random', pick = Math.random()) {
  const c = cometsOf(st);
  const known = new Set([...c.due, ...c.flown]);
  const open = cometMessages(content).filter(m => m.when === kind && !known.has(m.id));
  const m = kind === 'random' ? open[Math.floor(pick * open.length)] : open[0];
  return m ? { ...st, comets: { ...c, due: [...c.due, m.id] } } : st;
}

/** A prize comet won ("A comet"): your next 'ladder' message not yet cycling joins those that cycle all session. */
export function winComet(content, st) {
  const c = cometsOf(st);
  const m = ladderMessages(content).find(x => x.text && !c.active.some(a => a.id === x.id));
  return m ? { ...st, comets: { ...c, active: [...c.active, { id: m.id, text: m.text, mine: false }] } } : st;
}

/** The prize comets cycling this session. */
export const activeComets = st => cometsOf(st).active;

/** The comet to cross once next ({ id, text }), or null: your messages, in the order their triggers came. */
export function nextComet(content, st) {
  if (!rule(content)) return null;
  const c = cometsOf(st);
  const msgs = new Map(cometMessages(content).map(m => [m.id, m]));
  const id = c.due.find(x => msgs.has(x) && !c.flown.includes(x));
  return id ? { id, text: msgs.get(id).text } : null;
}

/** A comet has crossed: done for this session. */
export function cometFlown(st, id) {
  const c = cometsOf(st);
  return { ...st, comets: { ...c, due: c.due.filter(x => x !== id), flown: c.flown.includes(id) ? c.flown : [...c.flown, id] } };
}

/** Notes the player may still write this session: one per "Write a comet" claimed, less those written. */
export const notesLeft = (claimedWrites, st) => Math.max(0, claimedWrites - (cometsOf(st).written ?? 0));
/** The player wrote a note: it cycles from now on, this session, as a prize comet of their own. */
export function writeNote(st, text, id) {
  const t = typeof text === 'string' ? text.trim().slice(0, MAX_TEXT) : '';
  if (!t) return st;
  const c = cometsOf(st);
  return { ...st, comets: { ...c, written: (c.written ?? 0) + 1, active: [...c.active, { id: `p:${id}`, text: t, mine: true }] } };
}
