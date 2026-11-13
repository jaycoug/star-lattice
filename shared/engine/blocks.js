// Hour blocks: time planned on a star-dot in SCHEDULE's calendar, kept in the
// state's `blocks` (in start order): { id, dot, start (ms, local time), minutes }.
//
// A day's calendar runs over the content set's hours (its `day` rule, 6 a.m. to 10 p.m. by default:
// `range` { start, end } in minutes after local midnight, dayRange) and blocks start on a
// STEP-minute grid. One block can be placed at a chosen time (placeBlockAt). Placing spreads a number of 1-hour blocks as evenly as possible over the
// day's free time (equal free time before, between and after them, as near as the grid and the
// other blocks allow), keeping at least `gap` minutes between any two blocks; it places all of
// them or none. Moving a block keeps it in its day and refuses only an overlap. When a star-dot
// becomes complete, wherever that happens, its blocks after now go (clearCompleted); earlier ones
// stay as a record of time spent. SCHEDULE's list and its order (scheduleList, addressedAt) are
// here too.

import { derive } from './derive.js';
import { index, centralStar, childSlots } from './model.js';

export const DAY_START = 6 * 60;
export const DAY_END = 22 * 60;
export const DEFAULT_RANGE = Object.freeze({ start: DAY_START, end: DAY_END });
/** The calendar's hours in minutes, { start, end }, from a content set's rules (its `day`: { start, end } in hours). */
export const dayRange = rules => (rules?.day && rules.day.end > rules.day.start ? { start: rules.day.start * 60, end: rules.day.end * 60 } : DEFAULT_RANGE);
/** "6 a.m.", "noon", "10 p.m.", "midnight": an hour of the day (0–24). */
export const hourName = hr => (hr % 24 === 0 ? 'midnight' : hr === 12 ? 'noon' : `${((hr + 11) % 12) + 1} ${hr < 12 ? 'a.m.' : 'p.m.'}`);
export const BLOCK_MINUTES = 60;
export const STEP = 15;
export const GAPS = [15, 30, 60];
export const DEFAULT_GAP = 30;
const MINUTE = 60 * 1000;

/** Local midnight of the day holding `ms`. */
export const dayOf = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** The time `minutes` after local midnight of `day` (DST-safe: set in local time). */
export const atMinute = (day, minutes) => { const d = new Date(day); d.setHours(0, minutes, 0, 0); return d.getTime(); };
/** Minutes after local midnight. */
export const minuteOf = ms => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
/** A day's blocks, in start order. */
export const blocksOn = (st, day) => st.blocks.filter(b => dayOf(b.start) === dayOf(day));

/**
 * Start times (ms) for `hours` 1-hour blocks on `day`, spread over its free time with at least
 * `gap` minutes from any other block: { starts, problem } (problem when they don't all fit).
 */
export function spreadBlocks(st, day, hours, gap = DEFAULT_GAP, range = DEFAULT_RANGE) {
  const { start: DAY_START, end: DAY_END } = range;
  const n = Math.floor(hours);
  if (!(n >= 1)) return { starts: [], problem: 'Choose at least one hour.' };
  const busy = blocksOn(st, day).map(b => [minuteOf(b.start) - gap, minuteOf(b.start) + b.minutes + gap]).sort((a, b) => a[0] - b[0]);
  const fits = t => busy.every(([s, e]) => t + BLOCK_MINUTES <= s || t >= e);
  const grid = [];
  for (let t = DAY_START; t + BLOCK_MINUTES <= DAY_END; t += STEP) if (fits(t)) grid.push(t);

  // The day's free time as segments, and where each block would start if it were spread evenly over it.
  const segments = [];
  let from = DAY_START;
  for (const [s, e] of busy) {
    if (s > from) segments.push([from, Math.min(s, DAY_END)]);
    from = Math.max(from, e);
  }
  if (from < DAY_END) segments.push([from, DAY_END]);
  const total = segments.reduce((sum, [s, e]) => sum + Math.max(0, e - s), 0);
  const even = Math.max(0, total - n * BLOCK_MINUTES) / (n + 1);
  const clock = offset => {
    for (const [s, e] of segments) {
      if (offset <= e - s) return s + offset;
      offset -= e - s;
    }
    return DAY_END;
  };
  const ideal = Array.from({ length: n }, (_, i) => clock(even * (i + 1) + BLOCK_MINUTES * i));

  // The grid starts nearest the ideal ones (least squared distance), each at least an hour and the gap after the last.
  const G = grid.length;
  let cost = grid.map(t => (t - ideal[0]) ** 2);
  const back = [];
  for (let i = 1; i < n; i++) {
    const next = Array(G).fill(Infinity);
    const prev = Array(G).fill(-1);
    let best = Infinity, bestAt = -1;
    for (let j = 0, k = 0; j < G; j++) {
      // Earlier grid starts that leave room for this one: grid[k] + hour + gap <= grid[j].
      for (; k < G && grid[k] + BLOCK_MINUTES + gap <= grid[j]; k++) if (cost[k] < best) { best = cost[k]; bestAt = k; }
      if (bestAt >= 0) { next[j] = best + (grid[j] - ideal[i]) ** 2; prev[j] = bestAt; }
    }
    cost = next;
    back.push(prev);
  }
  let end = -1;
  cost.forEach((c, j) => { if (Number.isFinite(c) && (end < 0 || c < cost[end])) end = j; });
  if (end < 0) return { starts: [], problem: `${n} hour${n === 1 ? '' : 's'} don’t fit on that day with ${gap}-minute gaps.` };
  const picks = [end];
  for (let i = back.length - 1; i >= 0; i--) picks.unshift(back[i][picks[0]]);
  return { starts: picks.map(j => atMinute(dayOf(day), grid[j])), problem: null };
}

const sorted = blocks => [...blocks].sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));

/** Place `hours` 1-hour blocks of a star-dot on `day` (spreadBlocks): { state, problem, blocks: [id] }. */
export function placeBlocks(st, dotId, day, hours, gap = DEFAULT_GAP, range = DEFAULT_RANGE) {
  if (!st.dots[dotId]) return { state: st, problem: 'No such star-dot.', blocks: [] };
  const { starts, problem } = spreadBlocks(st, day, hours, gap, range);
  if (problem) return { state: st, problem, blocks: [] };
  let next = st.nextId;
  const added = starts.map(start => ({ id: 'b' + next++, dot: dotId, start, minutes: BLOCK_MINUTES }));
  return { state: { ...st, nextId: next, blocks: sorted([...st.blocks, ...added]) }, problem: null, blocks: added.map(b => b.id) };
}

const outside = range => `Blocks stay between ${hourName(range.start / 60)} and ${hourName(range.end / 60)}`.replace(/\.?$/, '.');

/**
 * One 1-hour block of a star-dot at `minute` (after midnight) of `day`, snapped down to the grid,
 * within the day's hours and overlapping no other block: { state, problem, blocks: [id] }.
 */
export function placeBlockAt(st, dotId, day, minute, range = DEFAULT_RANGE) {
  if (!st.dots[dotId]) return { state: st, problem: 'No such star-dot.', blocks: [] };
  const m = Math.min(Math.floor(minute / STEP) * STEP, range.end - BLOCK_MINUTES);
  if (m < range.start) return { state: st, problem: outside(range), blocks: [] };
  const start = atMinute(dayOf(day), m);
  const end = start + BLOCK_MINUTES * MINUTE;
  if (st.blocks.some(o => o.start < end && start < o.start + o.minutes * MINUTE)) return { state: st, problem: 'That would overlap another block.', blocks: [] };
  const id = 'b' + st.nextId;
  return { state: { ...st, nextId: st.nextId + 1, blocks: sorted([...st.blocks, { id, dot: dotId, start, minutes: BLOCK_MINUTES }]) }, problem: null, blocks: [id] };
}

/** Move a block to `minute` (after midnight) of its own day, snapped to the grid: { state, problem }. */
export function moveBlock(st, id, minute, range = DEFAULT_RANGE) {
  const b = st.blocks.find(x => x.id === id);
  if (!b) return { state: st, problem: 'That block is gone.' };
  const m = Math.round(minute / STEP) * STEP;
  if (m < range.start || m + b.minutes > range.end) return { state: st, problem: outside(range) };
  const start = atMinute(dayOf(b.start), m);
  const end = start + b.minutes * MINUTE;
  if (st.blocks.some(o => o.id !== id && o.start < end && start < o.start + o.minutes * MINUTE)) return { state: st, problem: 'That would overlap another block.' };
  if (start === b.start) return { state: st, problem: null };
  return { state: { ...st, blocks: sorted(st.blocks.map(x => (x.id === id ? { ...x, start } : x))) }, problem: null };
}

export const removeBlock = (st, id) => (st.blocks.some(b => b.id === id) ? { ...st, blocks: st.blocks.filter(b => b.id !== id) } : st);

/** Drop the blocks of these star-dots that start after `now` (every one of theirs when `now` is null). */
export function dropBlocks(st, dotIds, now = null) {
  const ids = new Set(dotIds);
  const blocks = st.blocks.filter(b => !ids.has(b.dot) || (now != null && b.start <= now));
  return blocks.length === st.blocks.length ? st : { ...st, blocks };
}

/**
 * U15: when a star-dot was last addressed: the later of its last completion (its own, or any
 * descendant's) and the end of its last block that has passed by `now`; null if never.
 */
export function addressedAt(st, view, dotId, now) {
  let at = null;
  const later = t => { if (Number.isFinite(t) && (at == null || t > at)) at = t; };
  const visit = d => { later(st.dots[d]?.ignitedAt); for (const c of view.children(d)) visit(c); };
  visit(dotId);
  for (const b of st.blocks) if (b.dot === dotId && b.start + b.minutes * MINUTE <= now) later(b.start + b.minutes * MINUTE);
  return at;
}

/**
 * U15: SCHEDULE's list: every star-dot on the map (on a star with a place, at any level; not on
 * the shelf, in a shelved branch or retired), complete ones only with `showComplete`, in order:
 * Due date (its own or inherited; soonest first, none last), then recommended frequency (its
 * Retrain period, most frequent first; none or Never last), then oldest addressed first (never
 * addressed first), then name. [{ dot, due, days, retrain, addressed, done }].
 */
export function scheduleList(st, view, { now = view.opts.now, showComplete = false } = {}) {
  const ix = index(st);
  const periods = view.opts.periods ?? {};
  const out = [];
  for (const [dot, at] of ix.dot) {
    if (!view.place(ix.kite.get(at.kite).star)) continue;
    const done = view.effective(dot).status === 'ignited';
    if (done && !showComplete) continue;
    const retrain = view.prop(dot, 'persistence');
    const days = retrain != null && periods[retrain] != null ? periods[retrain] : null;
    out.push({ dot, due: view.prop(dot, 'due'), days, retrain, addressed: addressedAt(st, view, dot, now), done });
  }
  const last = (a, b) => (a == null) - (b == null);   // nulls after values
  return out.sort((a, b) => last(a.due, b.due) || (a.due && b.due && a.due.localeCompare(b.due))
    || last(a.days, b.days) || (a.days != null && b.days != null && a.days - b.days)
    || (b.addressed == null) - (a.addressed == null) || (a.addressed != null && b.addressed != null && a.addressed - b.addressed)
    || (st.dots[a.dot].name || '').localeCompare(st.dots[b.dot].name || ''));
}

/**
 * One level of SCHEDULE's list **by star-dot**: the central star's star-dots (`parent`
 * null), or a star-dot's children. Each entry rolls up its branch: `due` the soonest **own** Due
 * date among it and its incomplete descendants (overdue ones included; `overdue` counts those past
 * `now`; `dueFrom` names whose it is), `inherited` its parent's Due when it has none of its own
 * (shown gray, never counted), `days` / `retrain` the most frequent Retrain period in its branch
 * (own or inherited values), `addressed` (addressedAt), `support` (n of m complete), `done`,
 * `children` (how many of its children would be listed). Complete star-dots (and so their
 * branches) are left out unless `showComplete`. Ordered like scheduleList, on the rolled-up values.
 */
export function scheduleLevel(st, view, parent = null, { now = view.opts.now, showComplete = false } = {}) {
  const periods = view.opts.periods ?? {};
  const daysOf = choice => (choice != null && periods[choice] != null ? periods[choice] : null);
  // Under Independent (a projected state) every item on the map is at the top, none has children.
  const ids = parent == null
    ? (st.projected ? [...index(st).dot.keys()]
      : (() => { const c = centralStar(st); return childSlots(st, c.id).map(({ kite, slot }) => st.kites[kite].dots[slot]).filter(Boolean); })())
    : view.children(parent);
  const done = d => view.effective(d).status === 'ignited';
  const shown = list => list.filter(d => showComplete || !done(d));
  const overdue = due => Date.parse(due + 'T23:59:59') < now;
  const entry = d => {
    let due = null, dueFrom = null, late = 0, days = null, retrain = null;
    const visit = x => {
      const own = st.dots[x].props.due;
      if (own && !done(x)) {
        if (!due || own < due) { due = own; dueFrom = x; }
        if (overdue(own)) late++;
      }
      const r = view.prop(x, 'persistence');
      const n = daysOf(r);
      if (n != null && (days == null || n < days)) { days = n; retrain = r; }
      for (const c of view.children(x)) visit(c);
    };
    visit(d);
    const inherited = !st.dots[d].props.due ? view.prop(d, 'due') : null;
    return {
      dot: d, due, dueFrom, overdue: late, inherited, days, retrain,
      addressed: addressedAt(st, view, d, now), support: view.support(d), done: done(d), children: shown(view.children(d)).length,
    };
  };
  const last = (a, b) => (a == null) - (b == null);
  return shown(ids).map(entry).sort((a, b) => last(a.due, b.due) || (a.due && b.due && a.due.localeCompare(b.due))
    || last(a.days, b.days) || (a.days != null && b.days != null && a.days - b.days)
    || (b.addressed == null) - (a.addressed == null) || (a.addressed != null && b.addressed != null && a.addressed - b.addressed)
    || (st.dots[a.dot].name || '').localeCompare(st.dots[b.dot].name || ''));
}

/**
 * U18: after a change from `before` to `after`, the blocks after now of every star-dot that became
 * complete (ignited, by its own completion or its children's) are dropped. Returns `after`, or a
 * copy without them.
 */
export function clearCompleted(before, after, options) {
  const now = options?.now ?? 0;
  const later = [...new Set(after.blocks.filter(b => b.start > now).map(b => b.dot))];
  if (!later.length) return after;
  const [was, is] = [derive(before, options), derive(after, options)];
  const lit = (view, st, d) => !!st.dots[d] && view.effective(d).status === 'ignited';
  const done = later.filter(d => lit(is, after, d) && !lit(was, before, d));
  return done.length ? dropBlocks(after, done, now) : after;
}
