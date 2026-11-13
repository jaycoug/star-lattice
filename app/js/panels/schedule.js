// The Schedule view: a calendar of hour blocks planned on star-dots, beside the list
// of star-dots to plan.
//
// The calendar shows five days (today and the next four; ← → move five days, Today comes back), in
// rows for each hour of the content set's day (Design › Look › Schedule hours; 6 a.m. to 10 p.m. by
// default). Star-dots due on a day (their own Due date) are marked
// in its header. A block shows its star-dot and time: drag it up or down within its day (it snaps to
// 15 minutes; an overlap is refused with a reason), × removes it, a click opens its star-dot's
// screen (editable, so its children can be ticked; completing it drops its later blocks, U18).
//
// The list: **By star-dot** (the engine's scheduleLevel): the central
// star's star-dots, each with its branch's soonest own Due date (overdue ones counted), most
// frequent Retrain and last addressed, ▸ / ▾ showing its children one level at a time; or **All**
// (scheduleList): every star-dot on the map, parents included, by Due date (own or inherited),
// then Retrain period (most frequent first), then the one addressed longest ago. Complete ones on
// request, in both. Plan time… on a row, then a click on the calendar places a 1-hour block at that
// 15-minute slot (a faint block follows the pointer); or a click on a day's header, then how many
// hours: that many 1-hour blocks spread over the day's free time, at least the save's gap apart
// (15 / 30 / 60 minutes, set here). No retraining prompts: Retrain periods only order the list.
//
// Play mode follows Design › Player › Schedule: View only shows the calendar alone (its blocks open
// their star-dot's screen; nothing is planned, moved or removed); Full editing is all of it.

import { h } from '../dom.js';
import { route } from '../route.js';
import * as E from '../../../shared/engine/index.js';
import { shortDate } from '../../../shared/ui/summaryText.js';

const DAYS = 5;
const HOUR_PX = 44;
const MAX_HOURS = 11;   // the most 1-hour blocks a day can hold with 30-minute gaps
const MINUTE = 60 * 1000;

const plusDays = (day, n) => { const d = new Date(day); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ymd = day => { const d = new Date(day); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayLabel = day => new Date(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
/** "9:15" (a.m. and p.m. by the hour labels). */
const clock = m => { const h12 = ((Math.floor(m / 60) + 11) % 12) + 1; return `${h12}:${String(m % 60).padStart(2, '0')}`; };
const hourLabel = hr => (hr === 12 ? 'noon' : hr % 24 === 0 ? 'midnight' : `${((hr + 11) % 12) + 1} ${hr < 12 ? 'a.m.' : 'p.m.'}`);
const button = (label, onclick, props = {}) => h('button', { type: 'button', class: 'text-btn small', onclick, ...props }, label);

export function schedule(st, a) {
  const { state, ev, content, save } = st;
  const now = ev.opts.now;
  const today = E.dayOf(now);
  const s = { start: today, pick: null, day: null, hours: 1, showDone: false, mode: 'tree', open: [], ...a.ui().sch };
  const range = E.dayRange(content.rules);   // The day's hours, in minutes
  const HOURS = (range.end - range.start) / 60;
  const top = minute => `${(minute - range.start) / 60 * HOUR_PX}px`;
  // Play mode: View only is the calendar alone, to look at and open; Full editing (and Edit mode) everything.
  const full = route().mode !== 'play' || st.content.player?.schedule === 'full';
  const days = Array.from({ length: DAYS }, (_, i) => plusDays(s.start, i));
  const ix = E.index(state);
  const colorOfDot = d => {
    const at = ix.dot.get(d);
    const c = at ? state.kites[at.kite].color : null;
    return c == null ? null : content.categories[c].color;
  };
  const name = d => state.dots[d]?.name || 'Unnamed star-dot';
  /** an item's category, named where a parent would be. */
  const categoryName = d => { const at = ix.dot.get(d); const c = at ? state.kites[at.kite].color : null; return c == null ? 'Central star' : content.categories[c].name; };
  const picking = full && s.pick && state.dots[s.pick] ? s.pick : null;

  // ---- The calendar ----
  const tools = h('div', { class: 'sch-tools' },
    button('←', () => a.setSch({ start: plusDays(s.start, -DAYS), day: null }), { title: 'Five days back', 'aria-label': 'Five days back' }),
    button('Today', () => a.setSch({ start: today, day: null }), { disabled: s.start === today }),
    button('→', () => a.setSch({ start: plusDays(s.start, DAYS), day: null }), { title: 'Five days on', 'aria-label': 'Five days on' }),
    h('span', { class: 'sch-range' }, `${dayLabel(days[0])} – ${dayLabel(days[DAYS - 1])}`),
    full && h('span', { class: 'sch-gap' }, h('span', { class: 'note small' }, 'Gap between blocks'),
      h('span', { class: 'segmented', role: 'group', 'aria-label': 'Gap between blocks' }, E.GAPS.map(g => h('button', {
        type: 'button', class: 'seg' + (save.gap === g ? ' on' : ''), 'aria-pressed': String(save.gap === g), onclick: () => a.setGap(g),
      }, `${g} min`)))));

  const dueOn = day => [...ix.dot.keys()].filter(d => state.dots[d].props.due === ymd(day));
  const block = b => {
    const start = E.minuteOf(b.start);
    const done = state.dots[b.dot] && ev.effective(b.dot).status === 'ignited';
    const el = h('div', {
      class: 'sch-block' + (b.start + b.minutes * MINUTE <= now ? ' past' : '') + (done ? ' done' : ''),
      style: { top: top(start), height: `${b.minutes / 60 * HOUR_PX}px`, '--cat': colorOfDot(b.dot) },
      dataset: { block: b.id }, role: 'button', tabindex: 0,
      title: `${name(b.dot)} · ${clock(start)}–${clock(start + b.minutes)} · ${full ? 'drag to move, ' : ''}click to open`,
      onkeydown: e => { if (e.key === 'Enter') a.openScreen(b.dot); },
    },
    h('span', { class: 'sch-block-name' }, done && '✓ ', name(b.dot)),
    h('span', { class: 'sch-block-time' }, `${clock(start)}–${clock(start + b.minutes)}`),
    full && h('button', {
      type: 'button', class: 'sch-block-x', title: 'Remove this block', 'aria-label': 'Remove this block',
      onpointerdown: e => e.stopPropagation(), onclick: e => { e.stopPropagation(); a.removeBlock(b.id); },
    }, '×'));
    if (!full) { el.addEventListener('click', () => a.openScreen(b.dot)); return el; }   // View only: open it, nothing else
    // Drag within the day (live, then one move on release); a press without a drag opens it.
    let drag = null;
    el.addEventListener('pointerdown', e => {
      if (e.button) return;
      drag = { y: e.clientY, moved: false };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) el.style.top = top(start + Math.round(dy / HOUR_PX * 60 / E.STEP) * E.STEP);
    });
    el.addEventListener('pointerup', e => {
      if (!drag) return;
      const { y, moved } = drag;
      drag = null;
      if (!moved) return a.openScreen(b.dot);
      const minute = start + Math.round((e.clientY - y) / HOUR_PX * 60 / E.STEP) * E.STEP;
      if (!a.moveBlock(b.id, minute)) el.style.top = top(start);   // refused: back where it was
    });
    el.addEventListener('pointercancel', () => { drag = null; el.style.top = top(start); });
    return el;
  };
  /** Where a click or the pointer is in a day's column: the minute after midnight, on the 15-minute grid. */
  const minuteAt = e => {
    const body = e.target.closest?.('.sch-col-body') ?? e.currentTarget;
    const y = e.clientY - (body?.getBoundingClientRect?.().top ?? 0);
    return range.start + Math.max(0, Math.floor(y / HOUR_PX * 60 / E.STEP) * E.STEP);
  };
  const column = day => h('div', { class: 'sch-col' + (day === today ? ' today' : '') + (s.day === day ? ' chosen' : ''), dataset: { day: String(day) } },
    h('div', {
      class: 'sch-col-head' + (picking ? ' placing' : ''),
      title: picking ? `Spread hours of ${name(picking)} over ${dayLabel(day)}` : null,
      onclick: e => { if (picking && !e.target.closest?.('.sch-due')) a.setSch({ day }); },
    },
      h('div', { class: 'sch-col-date' }, day === today ? `Today · ${dayLabel(day)}` : dayLabel(day)),
      h('div', { class: 'sch-dues' }, dueOn(day).map(d => h('button', {
        type: 'button', class: 'sch-due', style: { '--cat': colorOfDot(d) }, title: `${name(d)} is due`, onclick: () => a.openScreen(d),
      }, '⏱ ', name(d))))),
    h('div', {
      class: 'sch-col-body' + (picking ? ' placing' : ''), style: { height: `${HOURS * HOUR_PX}px`, '--hour': `${HOUR_PX}px` },
      title: picking ? `Click a time to plan an hour of ${name(picking)} there` : null,
      // The faint block under the pointer while placing, moved in place (no redraw).
      onpointermove: e => { if (picking) e.target.closest?.('.sch-col-body')?.style.setProperty('--ghost', top(Math.min(minuteAt(e), range.end - 60))); },
      onclick: e => {
        if (!picking || e.target.closest?.('.sch-block')) return;
        if (a.placeAt(picking, day, minuteAt(e))) a.setSch({ pick: null, day: null, hours: 1 });
      },
    }, E.blocksOn(state, day).map(block)));
  const calendar = h('div', { class: 'sch-cal', dataset: { scrollKey: 'sch-cal' } },
    h('div', { class: 'sch-gutter' }, h('div', { class: 'sch-col-head' }),
      h('div', { class: 'sch-hours', style: { height: `${HOURS * HOUR_PX}px` } },
        Array.from({ length: HOURS }, (_, i) => h('div', { class: 'sch-hour', style: { top: `${i * HOUR_PX}px` } }, hourLabel(range.start / 60 + i))))),
    days.map(column));

  // ---- Planning a star-dot's time ----
  const planner = picking && h('div', { class: 'sch-plan' },
    h('div', { class: 'eyebrow' }, 'Plan time'),
    h('strong', {}, name(picking)),
    s.day == null
      ? h('p', { class: 'note small' }, 'Click a time in the calendar to plan an hour there, or a day’s header to spread hours over it.')
      : [h('p', { class: 'note small' }, `${dayLabel(s.day)}: 1-hour blocks, spread over the free time, at least ${save.gap} minutes apart.`),
        h('div', { class: 'sch-hours-pick' },
          button('−', () => a.setSch({ hours: Math.max(1, s.hours - 1) }), { 'aria-label': 'One hour less', disabled: s.hours <= 1 }),
          h('span', { class: 'sch-hours-n' }, `${s.hours} hour${s.hours === 1 ? '' : 's'}`),
          button('+', () => a.setSch({ hours: Math.min(MAX_HOURS, s.hours + 1) }), { 'aria-label': 'One hour more', disabled: s.hours >= MAX_HOURS }),
          button('Place', () => { if (a.placeTime(picking, s.day, s.hours)) a.setSch({ pick: null, day: null, hours: 1 }); }, { class: 'text-btn small primary' }))],
    button('Cancel', () => a.setSch({ pick: null, day: null, hours: 1 }), { class: 'text-btn small subtle' }));

  // ---- The list ----
  const list = E.scheduleList(state, ev, { now, showComplete: s.showDone });
  const retrainName = id => content.properties.find(p => p.id === 'persistence').choices.find(c => c.id === id)?.name;
  const day = due => shortDate(Date.parse(due + 'T00:00:00'));
  const planButton = d => button(picking === d ? 'Planning…' : 'Plan time…', () => a.setSch({ pick: picking === d ? null : d, day: null, hours: 1 }), { class: 'text-btn small' + (picking === d ? ' on' : ''), title: 'Then click a time in the calendar (or a day’s header for several hours)' });
  const bulletOf = (d, done) => {
    const status = ev.effective(d).status;
    return h('span', { class: `sch-check ${status}`, title: { ignited: 'Complete', training: 'In training', open: 'Not started', empty: '' }[status] },
      done ? '✓' : status === 'training' ? '◐' : state.dots[d].role === 'assess' ? '□' : '○');
  };
  // By star-dot: a level's rows, and under an open one its children's, indented.
  const open = new Set(s.open.filter(d => state.dots[d]));
  const toggle = d => a.setSch({ open: open.has(d) ? [...open].filter(x => x !== d) : [...open, d] });
  const treeRow = (e, depth) => {
    const dot = state.dots[e.dot];
    const late = e.due && Date.parse(e.due + 'T23:59:59') < now;
    const from = e.dueFrom && e.dueFrom !== e.dot ? ` (${state.dots[e.dueFrom].name || 'unnamed'})` : '';
    return h('li', { class: 'sch-row sch-tree-row' + (e.done ? ' done' : '') + (picking === e.dot ? ' picked' : ''), style: { '--depth': depth, borderLeftColor: colorOfDot(e.dot) }, dataset: { dot: e.dot } },
      e.children ? h('button', { type: 'button', class: 'sch-toggle', 'aria-expanded': String(open.has(e.dot)), title: open.has(e.dot) ? 'Hide its children' : `Show its ${e.children} child${e.children === 1 ? '' : 'ren'}`, onclick: () => toggle(e.dot) }, open.has(e.dot) ? '▾' : '▸')
        : h('span', { class: 'sch-toggle none' }),
      bulletOf(e.dot, e.done),
      h('span', { class: 'sch-text' },
        h('span', { class: 'sch-name' }, dot.name || 'Unnamed star-dot'),
        h('span', { class: 'sch-meta' },
          e.due ? h('span', { class: 'sch-due-at' + (late ? ' overdue' : ''), title: from ? 'The soonest Due date in its branch' : '' }, `Due ${day(e.due)}${from}`, e.overdue > 1 && ` +${e.overdue - 1} overdue`)
            : e.inherited && h('span', { class: 'sch-due-at inherited', title: 'Its parent’s Due date (it has none of its own)' }, `Due ${day(e.inherited)} (inherited)`),
          e.retrain && retrainName(e.retrain) && h('span', {}, retrainName(e.retrain)),
          e.support && h('span', {}, `${e.support.ignited} of ${e.support.total} complete`),
          h('span', {}, e.addressed != null ? `last addressed ${shortDate(e.addressed)}` : 'not addressed yet'))),
      planButton(e.dot),
      h('button', { type: 'button', class: 'mini-btn', title: 'Open its screen', onclick: () => a.openScreen(e.dot) }, '↗'));
  };
  const treeRows = (parent, depth) => E.scheduleLevel(state, ev, parent, { now, showComplete: s.showDone })
    .flatMap(e => [treeRow(e, depth), ...(open.has(e.dot) && e.children ? treeRows(e.dot, depth + 1) : [])]);
  const tops = s.mode === 'tree' ? E.scheduleLevel(state, ev, null, { now, showComplete: s.showDone }) : null;
  const row = e => {
    const dot = state.dots[e.dot];
    const parent = state.projected ? null : E.parentOf(state, e.dot);   // Items have no parents
    const overdue = e.due && !e.done && Date.parse(e.due + 'T23:59:59') < now;
    const status = ev.effective(e.dot).status;
    return h('li', { class: 'sch-row' + (e.done ? ' done' : '') + (picking === e.dot ? ' picked' : '') },
      h('span', { class: `sch-check ${status}`, title: { ignited: 'Complete', training: 'In training', open: 'Not started', empty: '' }[status] },
        e.done ? '✓' : status === 'training' ? '◐' : dot.role === 'assess' ? '□' : '○'),
      h('span', { class: 'sch-text' },
        h('span', { class: 'sch-name' }, dot.name || 'Unnamed star-dot'),
        h('span', { class: 'sch-dot', style: { borderLeftColor: colorOfDot(e.dot) } }, parent ? state.dots[parent].name || 'Unnamed star-dot' : state.projected ? categoryName(e.dot) : 'Central star'),
        h('span', { class: 'sch-meta' },
          e.due && h('span', { class: 'sch-due-at' + (overdue ? ' overdue' : '') }, `Due ${shortDate(Date.parse(e.due + 'T00:00:00'))}`),
          e.retrain && retrainName(e.retrain) && h('span', {}, retrainName(e.retrain)),
          h('span', {}, e.addressed != null ? `last addressed ${shortDate(e.addressed)}` : 'not addressed yet'))),
      planButton(e.dot),
      h('button', { type: 'button', class: 'mini-btn', title: 'Open its screen', onclick: () => a.openScreen(e.dot) }, '↗'));
  };
  if (!full) return h('div', { class: 'schedule sch-layout view-only' }, h('div', { class: 'sch-main' }, tools, calendar));
  const side = h('aside', { class: 'sch-side' },
    planner,
    h('div', { class: 'sch-list-head' },
      h('h2', { class: 'eyebrow' }, 'Star-dots', h('span', { class: 'sch-count' }, ` · ${s.mode === 'tree' ? tops.length : list.length}`)),
      h('label', { class: 'note small sch-show-done' },
        h('input', { type: 'checkbox', checked: s.showDone, onchange: e => a.setSch({ showDone: e.target.checked }) }), ' Show complete')),
    h('span', { class: 'segmented sch-modes', role: 'group', 'aria-label': 'List' },
      [['tree', 'By star-dot'], ['all', 'All']].map(([id, label]) => h('button', {
        type: 'button', class: 'seg' + (s.mode === id ? ' on' : ''), 'aria-pressed': String(s.mode === id), onclick: () => a.setSch({ mode: id }),
      }, label))),
    h('p', { class: 'note small' }, s.mode === 'tree'
      ? 'Each star-dot with its branch’s soonest Due date and how often it recurs; ▸ shows its children. Then the one addressed longest ago.'
      : 'Every star-dot by Due date, then how often it recurs, then the one addressed longest ago.'),
    s.mode === 'tree'
      ? (tops.length ? h('ul', { class: 'sch-list sch-tree', dataset: { scrollKey: 'sch-list' } }, treeRows(null, 0)) : h('p', { class: 'note' }, 'Nothing to plan.'))
      : (list.length ? h('ul', { class: 'sch-list', dataset: { scrollKey: 'sch-list' } }, list.map(row)) : h('p', { class: 'note' }, 'Nothing to plan.')));

  return h('div', { class: 'schedule sch-layout' }, h('div', { class: 'sch-main' }, tools, calendar), side);
}
