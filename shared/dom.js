// Element helpers: h() builds an HTML element, svg() an SVG one, from (tag, props, ...children).
// Props: class, style (object), dataset, on<Event> handlers, booleans as bare attributes, the rest as attributes.
// Also: editableText() (double-click to edit; classes editable / edit-input / placeholder),
// removeButton() (class remove-btn) and notify() (writes into the page's #toast element).

// A content set's own word for a star-dot ("task", "question"…). Every text the app writes
// passes through h(), svg() and notify(), which say it with that word: "star-dot(s)", "Star-dot(s)",
// and "a star-dot" → "an item" before a vowel. setTerms(null) (or "star-dot") turns it off.
let say = null;
export function setTerms(terms) {
  const one = terms?.stardot?.trim();
  if (!one || one === 'star-dot') { say = null; return; }
  const many = terms.stardots?.trim() || `${one}s`;
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
  const vowel = /^[aeiou]/i.test(one);
  say = text => (text.includes('tar-dot') ? text
    .replace(/\b(a|A|an|An) star-dot\b(?!s)/g, (_, art) => `${art[0]}${vowel ? 'n' : ''} ${one}`)
    .replace(/\bStar-dots\b/g, cap(many)).replace(/\bstar-dots\b/g, many)
    .replace(/\bStar-dot\b/g, cap(one)).replace(/\bstar-dot\b/g, one) : text);
}
/** A text in this content set's words. */
export const term = text => (say && typeof text === 'string' ? say(text) : text);
const WORDED = ['title', 'placeholder', 'aria-label'];

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag, props = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

function applyProps(el, props) {
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'style' && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (v != null) el.style.setProperty(k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), v);
      }
    } else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, say && WORDED.includes(key) ? term(String(value)) : value);
  }
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : term(String(child)));
  }
}

/** Text that turns into an input on double-click (or Enter). Enter/blur commits, Escape cancels. */
export function editableText({ value, onCommit, multiline = false, className = '', placeholder = 'Double-click to edit' }) {
  const view = h('span', {
    class: 'editable ' + className + (value ? '' : ' placeholder'),
    title: 'Double-click to edit',
    tabindex: 0,
  }, value || placeholder);

  const start = (event) => {
    event?.stopPropagation();
    const input = multiline
      ? h('textarea', { class: 'edit-input ' + className, rows: 3 })
      : h('input', { class: 'edit-input ' + className });
    input.value = value;
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      if (commit && input.value !== value) onCommit(input.value);
      else if (input.isConnected) input.replaceWith(view);
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') finish(false);
      else if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
        e.preventDefault();
        finish(true);
      }
    });
    view.replaceWith(input);
    input.focus();
    input.select();
  };

  view.addEventListener('dblclick', start);
  view.addEventListener('keydown', e => { if (e.key === 'Enter') start(e); });
  return view;
}

export function removeButton(onClick, title) {
  return h('button', { class: 'remove-btn', title, 'aria-label': title, onclick: onClick }, '×');
}

let toastTimer;
/**
 * Brief status message at the bottom of the window. `action` ({ label, onClick }) adds a button
 * (e.g. Undo) and keeps the message up longer.
 */
export function notify(message, kind = 'info', action = null) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.replaceChildren(term(message), action ? h('button', {
    class: 'toast-action',
    onclick: () => { el.hidden = true; action.onClick(); },
  }, action.label) : '');
  el.dataset.kind = kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 8000 : kind === 'error' ? 6000 : 2500);
}
