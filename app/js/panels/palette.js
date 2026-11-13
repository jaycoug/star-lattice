// The color palette menu (in GOVERN since round 7, V9): the built-in palettes, your own
// (kept in this browser, with a "New palette…" editor) and the colors in use. Picking one recolors
// the content set's categories (undoable). Moved here from DISSECT STAR's star model.

import { h } from '../dom.js';
import { builtInPalette, paletteNameProblem, MAX_PALETTE_NAME } from '../model.js';

/**
 * The color palette menu: the built-in palettes, the user's own (✎ edit, × remove; kept in this
 * browser) and, when no palette matches the content set's colors, "current". Picking one recolors
 * the categories. New palette… opens the editor below the list.
 */
export function palettePicker(st, a) {
  const editor = paletteEditor(st, a);
  const menu = h('div', { class: 'popover palette-menu', hidden: true },
    Object.entries(st.palettes).map(([name, cols]) => h('div', { class: 'palette-row' },
      h('button', { class: 'palette-option' + (name === st.palette ? ' current' : ''), onclick: () => a.setPalette(name) },
        h('span', { class: 'palette-name' }, name),
        h('span', { class: 'swatch-row' }, cols.map(c => h('span', { class: 'swatch', style: { background: c } })))),
      !builtInPalette(name) && h('button', { type: 'button', class: 'remove-btn', title: `Edit "${name}"`, onclick: () => editor.open(name, cols) }, '✎'),
      !builtInPalette(name) && h('button', { type: 'button', class: 'remove-btn', title: `Remove "${name}"`, onclick: () => a.removePalette(name) }, '×'))),
    h('button', { type: 'button', class: 'palette-option palette-new', onclick: () => editor.open('', st.palettes[st.palette]) }, '+ New palette…'),
    editor.el);
  const button = h('button', {
    class: 'icon-btn palette-btn', title: 'Color palette: ' + st.palette,
    onclick: e => { e.stopPropagation(); menu.hidden = !menu.hidden; },
  }, st.palettes[st.palette].map(c => h('span', { style: { background: c } })));
  return h('div', { class: 'popover-wrap' }, button, menu);
}

/** Build and name a palette: a color per category (labeled by its name), starting from the given colors. */
function paletteEditor(st, a) {
  const hex = c => (/^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '#888888');
  const name = h('input', { class: 'palette-name-input', placeholder: 'Palette name', maxlength: MAX_PALETTE_NAME, 'aria-label': 'Palette name' });
  const pickers = st.content.categories.map(c => h('input', { type: 'color', 'aria-label': c.name || 'Category' }));
  const problem = h('p', { class: 'palette-problem', hidden: true });
  const el = h('form', {
    class: 'palette-editor', hidden: true,
    onsubmit: e => {
      e.preventDefault();
      const why = paletteNameProblem(name.value);
      problem.hidden = !why;
      problem.textContent = why;
      if (!why) a.savePalette(name.value, pickers.map(p => p.value));
    },
  },
    h('div', { class: 'palette-editor-title' }, 'Your palette'),
    name,
    h('div', { class: 'palette-colors' }, st.content.categories.map((c, i) => h('label', { class: 'palette-color' }, pickers[i], h('span', {}, c.name || `Category ${i + 1}`)))),
    problem,
    h('p', { class: 'palette-hint' }, 'Kept in this browser. Saving under one of your names replaces it.'),
    h('div', { class: 'btn-row' },
      h('button', { type: 'submit', class: 'text-btn small' }, 'Save and use'),
      h('button', { type: 'button', class: 'text-btn small subtle', onclick: () => { el.hidden = true; } }, 'Cancel')));
  return {
    el,
    open(n, colors) {
      name.value = n;
      pickers.forEach((p, i) => { p.value = hex(colors[i]); });
      problem.hidden = true;
      el.hidden = false;
      name.focus();
    },
  };
}
