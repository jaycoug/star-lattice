// 9e, Streaks and marks (Design › Fun › Streaks and marks, off by default). In Play mode, right
// answers in a row are a streak (a wrong one ends it); the board's lit star-dots twinkle brighter
// with it. Marks are achievements, each earned once a session and kept with it: the first star-dot
// ignited, five right in a row, a whole star (or a category complete), halfway, every star-dot lit.
//
// State (session only; a new session clears it): st.fun = { streak, best, marks: [ids, in the order earned] }.

import { derive } from './derive.js';

/** The marks, in the order they're listed: { id, icon, name, about }. */
export const MARKS = [
  { id: 'first', icon: '✧', name: 'First light', about: 'the first star-dot ignited' },
  { id: 'streak5', icon: '✦', name: 'Five in a row', about: 'five right answers in a row' },
  { id: 'star', icon: '✺', name: 'A whole star', about: 'every star-dot of a star ignited, or a category complete' },
  { id: 'half', icon: '◐', name: 'Halfway', about: 'half of the star-dots ignited' },
  { id: 'all', icon: '★', name: 'Every star lit', about: 'every star-dot ignited' },
];
export const MARK = Object.fromEntries(MARKS.map(m => [m.id, m]));
/** The streak that starts the twinkle, and the one that earns its mark. */
export const STREAK_SHOWN = 3, STREAK_MARK = 5;

export const streaksOn = content => content?.rules?.streaks === 'on';
export const funOf = st => st.fun ?? { streak: 0, best: 0, marks: [] };

/** An answer recorded: right adds to the streak (and the best this session), wrong ends it. */
export function recordAnswer(content, st, correct) {
  if (!streaksOn(content)) return st;
  const f = funOf(st);
  const streak = correct ? f.streak + 1 : 0;
  return { ...st, fun: { ...f, streak, best: Math.max(f.best, streak) } };
}

/** The marks this state has earned (whatever was earned before). */
export function marksMet(st, options) {
  const view = derive(st, options);
  const lit = d => view.effective(d).status === 'ignited';
  const all = Object.keys(st.dots);
  const n = all.filter(lit).length;
  const wholeStar = Object.values(st.stars).some(s => {
    const ds = s.kites.flatMap(k => st.kites[k]?.dots ?? []).filter(Boolean);
    return ds.length > 0 && ds.every(lit);
  });
  return [
    n > 0 && 'first',
    funOf(st).best >= STREAK_MARK && 'streak5',
    (wholeStar || Object.keys(st.complete ?? {}).length > 0) && 'star',
    all.length > 1 && n * 2 >= all.length && 'half',
    all.length > 0 && n === all.length && 'all',
  ].filter(Boolean);
}

/** After a change: any mark newly met is added (in MARKS' order). */
export function settleMarks(content, st, options) {
  if (!streaksOn(content)) return st;
  const f = funOf(st);
  const fresh = marksMet(st, options).filter(m => !f.marks.includes(m));
  return fresh.length ? { ...st, fun: { ...f, marks: [...f.marks, ...fresh] } } : st;
}

/** Marks earned between two states (for the message). */
export const newMarks = (before, st) => funOf(st).marks.filter(m => !funOf(before).marks.includes(m)).map(m => MARK[m]);

/** A save's st.fun, cleaned (null when there's nothing). */
export function normalizeFun(fun) {
  if (!fun || typeof fun !== 'object') return null;
  const count = n => (Number.isInteger(n) && n >= 0 ? n : 0);
  const marks = Array.isArray(fun.marks) ? [...new Set(fun.marks.filter(m => MARK[m]))] : [];
  const out = { streak: count(fun.streak), best: Math.max(count(fun.best), count(fun.streak)), marks };
  return out.streak || out.best || marks.length ? out : null;
}
