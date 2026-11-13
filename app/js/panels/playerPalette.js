// The player's palette menu (P9, 9b): 🎨 in the Star view's tools, in Play mode, with Design ›
// Player › Palette on. Designer's colors (always), the built-in palettes the player has (with a
// ladder: those claimed, and those still waiting on it greyed, with a padlock; the rest not listed) and, once Your own palette is theirs, one palette of the
// player's own (New palette… / ✎: a name and a color per category). Picking one recolors the
// player's board only, this session (actions.setPlayerPalette). Not design-only: the play version has it.

import { h } from '../dom.js';
import * as E from '../../../shared/engine/index.js';
import { DEFAULT_PALETTES } from '../../../shared/color.js';

const swatches = cols => h('span', { class: 'swatch-row' }, cols.map(c => h('span', { class: 'swatch', style: { background: c } })));
const title = s => s[0].toUpperCase() + s.slice(1);

/** Put a popover under its button, always wholly inside the window (it's fixed to the window while open). */
export function placeInView(button, menu) {
  const r = button.getBoundingClientRect?.();
  if (!r) return;
  const vw = globalThis.innerWidth ?? 0, vh = globalThis.innerHeight ?? 0;
  Object.assign(menu.style, { position: 'fixed', right: 'auto', left: '0px', top: `${r.bottom + 4}px` });
  const m = menu.getBoundingClientRect?.() ?? { width: 0, height: 0 };
  const left = Math.max(8, Math.min(r.left, vw - m.width - 8));
  const top = r.bottom + 4 + m.height > vh - 8 ? Math.max(8, r.top - 4 - m.height) : r.bottom + 4;
  Object.assign(menu.style, { left: `${left}px`, top: `${top}px` });
}

export function playerPaletteMenu(st, a) {
  const { file, save } = st;
  const state = save.state;
  const mine = E.playerPalettes(file.content, state);
  const now = state.look?.palette && mine.includes(state.look.palette) ? state.look.palette : null;
  const designer = file.content.categories.map(c => c.color);
  const own = save.playerPalette;
  const close = () => { menu.hidden = true; };
  const option = (id, name, cols, locked = false) => h('button', {
    type: 'button', class: 'palette-option' + (id === now ? ' current' : '') + (locked ? ' locked' : ''), disabled: locked,
    dataset: { palette: id ?? 'designer' }, title: locked ? 'Not yours yet: a prize on the ladder' : `Use ${name}`,
    onclick: () => { close(); a.setPlayerPalette(id); },
  }, h('span', { class: 'palette-name' }, name, locked && ' 🔒'), swatches(cols));

  // Your own palette: a name and a color per category.
  const name = h('input', { class: 'palette-name-input', placeholder: 'Palette name', maxlength: 40, 'aria-label': 'Palette name' });
  const pickers = file.content.categories.map(c => h('input', { type: 'color', 'aria-label': c.name || 'Category' }));
  const editor = h('form', {
    class: 'palette-editor', hidden: true,
    onsubmit: e => { e.preventDefault(); if (a.savePlayerPalette(name.value, pickers.map(p => p.value))) close(); },
  },
    h('div', { class: 'palette-editor-title' }, 'Your palette'),
    name,
    h('div', { class: 'palette-colors' }, file.content.categories.map((c, i) => h('label', { class: 'palette-color' }, pickers[i], h('span', {}, c.name || `Category ${i + 1}`)))),
    h('div', { class: 'btn-row' },
      h('button', { type: 'submit', class: 'text-btn small' }, 'Save and use'),
      h('button', { type: 'button', class: 'text-btn small subtle', onclick: () => { editor.hidden = true; } }, 'Cancel')));
  const edit = () => {
    name.value = own?.name ?? '';
    const from = own?.colors ?? st.content.categories.map(c => c.color);
    pickers.forEach((p, i) => { p.value = from[i]; });
    editor.hidden = false;
    name.focus?.();
  };
  const waiting = k => E.ladderOf(file.content)?.rungs.includes(`palette:${k}`) ?? false;   // on the ladder, not claimed yet
  const ownLocked = !mine.includes('own') && waiting('own');

  const menu = h('div', { class: 'popover palette-menu player-palette-menu', hidden: true },
    option(null, 'Designer’s colors', designer),
    Object.entries(DEFAULT_PALETTES).filter(([n]) => mine.includes(n) || waiting(n)).map(([n, cols]) => option(n, title(n), cols, !mine.includes(n))),
    mine.includes('own') && (own
      ? h('div', { class: 'palette-row' }, option('own', own.name, own.colors),
        h('button', { type: 'button', class: 'remove-btn', title: `Edit "${own.name}"`, onclick: edit }, '✎'))
      : h('button', { type: 'button', class: 'palette-option palette-new', onclick: edit }, '+ New palette…')),
    ownLocked && h('button', { type: 'button', class: 'palette-option locked', disabled: true, title: 'Not yours yet: a prize on the ladder' }, h('span', { class: 'palette-name' }, 'Your own palette 🔒')),
    editor);
  const button = h('button', {
    type: 'button', class: 'text-btn small player-palette-btn', title: 'Colors for your board', 'aria-label': 'Palette',
    onclick: e => { e.stopPropagation(); menu.hidden = !menu.hidden; if (!menu.hidden) placeInView(button, menu); },
  }, '🎨');
  return h('div', { class: 'popover-wrap' }, button, menu);
}
