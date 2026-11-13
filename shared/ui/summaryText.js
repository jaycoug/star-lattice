// A star-dot's attribute summary as text, from derive.js summary(): one line per attribute,
// shared by the star-dot screen's Attributes widget and DISSECT STAR's star-dot table.
//
// attributeSummary(view, content, dot) → { finance, difficulty, environment, persistence, due }
// finance "−$40/mo · +$400 one-time"
// difficulty "Hard": the highest level (no counts)
// environment "Office ×3 · Kitchen · ✈ Distant": most common first
// persistence "Weekly · next stale Nov 2"
// due "Nov 5 (Final exam) · 1 overdue"
// '—' where nothing is set. A star-dot that rolls up its children names whose value it is:
// "(Final exam)". `items: false` leaves those notes out, for narrow cells.

import { DERIVED_MARKS } from '../engine/index.js';

const TRAVEL = DERIVED_MARKS.find(m => m.id === 'travel').symbol;

export const shortDate = d => new Date(typeof d === 'string' ? d + 'T00:00:00' : d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const dollars = (v, unit = '') => `${v > 0 ? '+' : v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`;

export function attributeSummary(view, content, dot, { items = true } = {}) {
  const s = view.summary(dot.id);
  const itemText = x => (!items || x.dot === dot.id ? '' : ` (${x.name || 'unnamed'})`);
  const choices = id => content.properties.find(p => p.id === id)?.choices ?? [];
  const counted = (id, counts) => choices(id).filter(c => counts[c.id]).map(c => [c, counts[c.id]]);
  const join = parts => parts.filter(Boolean).join(' · ') || '—';
  return {
    finance: join([s.finance.monthly && dollars(s.finance.monthly, '/mo'), s.finance.once && dollars(s.finance.once, ' one-time')]),
    difficulty: choices('difficulty').find(c => c.id === s.difficulty.highest)?.name ?? '—',
    environment: join(counted('environment', s.environment.counts).sort((a, b) => b[1] - a[1])
      .map(([c, k]) => `${c.travel ? TRAVEL + ' ' : ''}${c.name}${k > 1 ? ` ×${k}` : ''}`)),
    persistence: join([choices('persistence').find(c => c.id === s.persistence.most)?.name ?? '—',
      s.persistence.nextStale && `next stale ${shortDate(s.persistence.nextStale.at)}${itemText(s.persistence.nextStale)}`]),
    due: join([s.due.nearest && `${shortDate(s.due.nearest.date)}${itemText(s.due.nearest)}`, s.due.overdue && `${s.due.overdue} overdue`]),
  };
}
