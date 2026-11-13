// DOM helpers for the panels. Panels build plain elements with h()/svg() (shared/dom.js) and are fully
// re-rendered on change.

import { h } from '../../shared/dom.js';

export { h, svg, editableText, removeButton, notify, setTerms, term } from '../../shared/dom.js';

/**
 * A titled panel. `action` adds a small button next to the title: { label, title, onClick }.
 * `scrollKey` names a scrolling body; main.js keeps its scroll position across re-renders.
 */
export function panel(title, { action, accent = false, className = '', scrollKey } = {}, ...body) {
  return h('section', { class: `panel ${accent ? 'accent' : ''} ${className}` },
    h('div', { class: 'panel-head' },
      h('h2', { class: 'eyebrow' }, title),
      action && h('button', { class: 'mini-btn', title: action.title ?? action.label, onclick: action.onClick }, action.label)),
    h('div', { class: 'panel-body' + (scrollKey ? ' scroll' : ''), dataset: scrollKey ? { scrollKey } : null }, body));
}

/** After adding an item: scroll its list to the end and start editing the new (last) item. */
export function editLastIn(scrollKey) {
  const list = document.querySelector(`[data-scroll-key="${scrollKey}"]`);
  if (!list) return;
  list.scrollTop = list.scrollHeight;
  const items = list.querySelectorAll('.editable');
  items[items.length - 1]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
}


/** offer `data` as a .json file to save. Returns whether the browser could start it. */
export function downloadJson(filename, data) {
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = h('a', { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Short local time: "14:32" today, otherwise "Oct 12, 14:32". */
export function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? time
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + time;
}
