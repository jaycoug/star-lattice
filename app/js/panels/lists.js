// MATERIALS under Star-dots: Independent: instead of the tree, a list per
// central kite (category) of its items in order. The tree, and the hierarchy it shows, stay dormant.
//
// Each item: a band on its left, its
// place (1, 2, …), its status, its name (double-click to rename), ↗ (its screen, where its question
// is written) and a small × (delete; asks first). The six lists sit side by side in order, scrolled
// a column at a time with ◀ ▶ at the top right (not wrapped).
// "Add an item…" at the end of each list. A line marks where each star's items begin: "Central
// kite" (the first four), "Star 2", "Star 3" … (the category's independent stars on the map, in the
// order they were made), and "Not on the map yet" for the rest. Everything is undoable.
// Play mode: a click on an item opens its screen; reordering, adding and deleting are the
// player's only with Design › Player › Editing the lists, renaming with Renaming.

import { h, editableText } from '../dom.js';
import { route } from '../route.js';
import * as E from '../../../shared/engine/index.js';
import { questionTools } from './importQuestions.js';

const MARK = { open: '☆', training: '◐', ignited: '★' };
const STATUS = { open: 'not started', training: 'in training', ignited: 'complete' };
const button = (label, onclick, props = {}) => h('button', { type: 'button', class: 'text-btn small', onclick, ...props }, label);

/** Drag a band onto another item to move it there; the source is kept here, so nothing re-renders mid-drag. */
let dragFrom = null;

/** Scroll the columns one column (its width and the gap) left (-1) or right (1). */
function step(listsEl, dir) {
  const col = listsEl.querySelector?.('.list-section');
  const gap = parseFloat(globalThis.getComputedStyle?.(listsEl)?.columnGap) || 20;
  listsEl.scrollBy?.({ left: dir * ((col?.offsetWidth ?? 320) + gap), behavior: 'smooth' });
}

export function lists(st, a) {
  const { state, content, ev } = st;
  const central = E.centralStar(state);
  const listsEl = h('div', { class: 'lists', dataset: { scrollKey: 'lists' } }, central.kites.map(k => categoryList(st, a, k, content)));
  const playing = route().mode === 'play';
  return h('div', { class: 'play rearrange lists-page' },
    h('div', { class: 'play-tools' }, h('span', { class: 'grow' }),
      !playing && questionTools(st, a),
      h('span', { class: 'list-scroll' },
        button('◀', () => step(listsEl, -1), { title: 'The columns to the left', 'aria-label': 'Scroll left' }),
        button('▶', () => step(listsEl, 1), { title: 'The columns to the right', 'aria-label': 'Scroll right' }))),
    listsEl);
}

/** Touch: native drag and drop doesn't start from a finger, so a band also drags by pointer. */
function touchDrag(k, i, a) {
  return e => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault?.();
    const band = e.target;
    band.setPointerCapture?.(e.pointerId);
    const rowAt = ev => document.elementFromPoint?.(ev.clientX, ev.clientY)?.closest?.('.list-item');
    let over = null;
    const move = ev => { const r = rowAt(ev); if (r !== over) { over?.classList.remove('list-drop'); over = r; over?.classList.add('list-drop'); } };
    const up = ev => {
      band.removeEventListener('pointermove', move); band.removeEventListener('pointerup', up); band.removeEventListener('pointercancel', up);
      over?.classList.remove('list-drop');
      const r = ev.type === 'pointerup' ? rowAt(ev) : null;
      const to = r && r.dataset.kite === k ? Number(r.dataset.index) : -1;
      if (to >= 0 && to !== i) a.moveItem(k, i, to);
    };
    band.addEventListener('pointermove', move); band.addEventListener('pointerup', up); band.addEventListener('pointercancel', up);
  };
}

function categoryList(st, a, k, content) {
  const { state, ev } = st;
  const items = E.listOf(state, k);
  const color = state.kites[k].color;
  const cat = color == null ? null : content.categories[color];
  const { segments } = ev.segments(k) ?? { segments: [] };
  // Where each star's items begin: "Central kite", "Star 2", …; then the rest, not on the map yet.
  // With Shuffle the questions the field takes them in another order, so no breaks: a note instead.
  const shuffledField = ev.opts.shuffleQuestions === 'on';
  const breaks = new Map();
  if (!shuffledField) segments.forEach((s, i) => { if (s.to > s.from || i === 0) breaks.set(s.from, i === 0 ? 'Central kite' : `Star ${i + 1}`); });
  const placed = segments.length ? segments[segments.length - 1].to : 0;
  if (!shuffledField && placed < items.length) breaks.set(placed, 'Not on the map yet');
  const questions = ev.opts.questions === 'on';
  const playing = route().mode === 'play';
  const editing = a.allow('lists');   // Reorder, add, delete
  const row = (d, i) => {
    const dot = state.dots[d];
    const status = ev.effective(d).status;
    const noQuestion = questions && !E.askable(dot.assessment);
    return h('li', {
      class: 'list-item', dataset: { item: d, kite: k, index: String(i) },
      ondragover: e => { if (editing && dragFrom?.k === k && dragFrom.i !== i) e.preventDefault(); },
      ondrop: e => { e.preventDefault(); const from = dragFrom; dragFrom = null; if (from?.k === k && from.i !== i) a.moveItem(k, from.i, i); },
    },
    h('span', editing ? {
      class: 'list-band', draggable: 'true', title: 'Drag onto another item to move it there', 'aria-hidden': 'true', style: { '--cat': cat?.color },
      ondragstart: e => { dragFrom = { k, i }; e.dataTransfer?.setData?.('text/plain', d); e.dataTransfer?.setDragImage?.(e.target.closest?.('.list-item') ?? e.target, 0, 0); },
      ondragend: () => { dragFrom = null; },
      onpointerdown: touchDrag(k, i, a),
    } : { class: 'list-band fixed', 'aria-hidden': 'true', style: { '--cat': cat?.color } }),
    h('span', { class: 'list-n' }, String(i + 1)),
    h('span', { class: `dot-mark ${status}`, title: STATUS[status] }, MARK[status] ?? '·'),
    h('span', { class: 'grow list-name' }, a.allow('rename') ? editableText({ value: dot.name, placeholder: 'Unnamed item', onCommit: v => a.renameDot(d, v) })
      : h('span', { class: playing ? 'list-open' : '', onclick: playing ? () => a.openScreen(d) : null, title: playing ? 'Open its screen' : null }, dot.name || 'Unnamed item')),
    noQuestion && !playing && h('span', { class: 'tag list-noq', title: 'Write its question on its screen (↗)' }, 'no question'),
    button('↗', () => a.openScreen(d), { title: questions ? 'Its screen: its question' : 'Its screen', 'aria-label': 'Open' }),
    editing && button('×', () => a.deleteStarDot(d), { class: 'list-delete', title: 'Delete it for good (asks first; undoable)', 'aria-label': 'Delete…' }));
  };
  const input = h('input', {
    class: 'list-add-input', placeholder: 'Add an item…', 'aria-label': `Add an item to ${cat?.name ?? 'this category'}`,
    onkeydown: e => { if (e.key === 'Enter' && input.value.trim()) { const v = input.value; input.value = ''; a.addItem(k, v); } },
  });
  return h('section', { class: 'list-section', style: { '--cat': cat?.color }, dataset: { kite: k } },
    h('h2', { class: 'eyebrow list-head' }, h('span', { class: 'swatch', style: { background: cat?.color ?? 'transparent' } }), ' ', state.kites[k].name || cat?.name || 'Category',
      h('span', { class: 'note' }, ` · ${items.length} item${items.length === 1 ? '' : 's'}`)),
    shuffledField && !playing && items.length > 0 && h('p', { class: 'note small list-shuffled' }, `Shuffled on the field this session (${placed} of ${items.length} there).`),
    h('ol', { class: 'item-list' }, items.flatMap((d, i) => [breaks.has(i) && h('li', { class: 'list-break', 'aria-hidden': 'true' }, breaks.get(i)), row(d, i)])),
    !items.length && h('p', { class: 'note small' }, 'No items yet: the first four fill the central kite.'),
    editing && h('div', { class: 'list-add' }, input, button('Add', () => { if (input.value.trim()) { const v = input.value; input.value = ''; a.addItem(k, v); } })));
}
