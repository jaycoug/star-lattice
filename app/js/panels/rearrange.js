// REARRANGE: where everything can be moved, whatever the save's board rule: the tree
// (tree.js, round 4) with the side card for what's selected beside it. The starfield replica and
// its shelf strip were retired in round 4 (archive/dashboard-v1/retired-panels/).
//
// Moves have one gesture, in the tree: double-click to pick up, click to travel, double-click
// where it goes. A move that would clash (a branch landing on another star, a star-dot into its
// own branch) opens the conflict card: Shelve or Cancel. Everything is undoable. The card here only
// describes what's selected; it has no move buttons.
//
// Selecting a star-dot lists its relations and lineage in the card (model.js linkRoles); ↗ opens
// its screen. Names are typed into the selected box (a central kite's name is its category's).
//
// A kite's card edits its description and slot labels; a star-dot's card has Deploy / Withdraw
// its star; a shelved star-dot's card has Delete…. No how-to text: the tutorials explain.
// In Play mode the card is the player's (Design › Player › Side card), read-only: no adding,
// editing, Delete… or question files.

import { h, editableText } from '../dom.js';
import { route } from '../route.js';
import * as E from '../../../shared/engine/index.js';
import { linkRoles } from '../model.js';
import { tree, shelfLabel } from './tree.js';
import { lists } from './lists.js';
import { retiredBank } from './play.js';
import { questionTools } from './importQuestions.js';

let current = null;
document.addEventListener('keydown', e => {
  if (!current || route().page !== 'tree' || current.ui().sds || current.ui().conflict) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') current.rCancel();
});

/** The selection, if it still exists (an undo may have removed it). */
function liveSel(state, sel) {
  if (!sel) return null;
  if (sel.kind === 'dot') return state.dots[sel.id] && E.index(state).dot.has(sel.id) ? sel : null;
  if (sel.kind === 'kite') return E.index(state).kite.has(sel.id) ? sel : null;
  if (sel.kind === 'slot') return state.kites[sel.kite]?.dots[sel.slot] === null && E.index(state).kite.has(sel.kite) ? sel : null;
  if (sel.kind === 'shelfEntry') return state.shelf.some(e => e.id === sel.id) ? sel : null;
  return null;
}

export function rearrange(st, a) {
  current = a;
  if (E.independentOn(st.ev.opts)) return lists(st, a);   // The lists; the tree stays dormant
  const sel = liveSel(st.state, a.ui().rSel);
  const roles = sel?.kind === 'dot' ? linkRoles(st.state, sel.id) : null;
  const playing = route().mode === 'play';
  return h('div', { class: 'play rearrange' },
    h('div', { class: 'play-tools' }, h('span', { class: 'grow' }), !playing && questionTools(st, a)),
    h('div', { class: 'play-body tree-body' }, tree(st, a), a.allow('card') && h('div', { class: 'play-card r-panel tree-card' }, panel(st, a, sel, roles), retiredBank(st, a))));   // The Retired bank, as on the Star view
}

// ---- The side panel ------------------------------------------------------------------------------

const button = (label, onclick, props = {}) => h('button', { type: 'button', class: 'text-btn small', onclick, ...props }, label);
const swatch = color => h('span', { class: 'swatch', style: { background: color ?? 'transparent' } });
const close = a => h('button', { type: 'button', class: 'card-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => a.rSelect(null) }, '×');

function panel(st, a, sel, roles) {
  const playing = route().mode === 'play';
  const body = sel?.kind === 'dot' ? dotPanel(st, a, sel.id, roles)
    : sel?.kind === 'kite' ? kitePanel(st, a, sel.id, playing)
    : sel?.kind === 'slot' ? (playing ? null : slotPanel(st, a, sel))
    : sel?.kind === 'shelfEntry' ? shelfPanel(st, a, sel.entry)
    : hint();
  return [modeBanner(st, a), body];
}

function modeBanner(st, a) {
  const mode = a.ui().rMode;
  if (!mode) return null;
  const what = mode.kind === 'swapDot' ? st.state.dots[st.state.kites[mode.from.kite].dots[mode.from.slot]]?.name || 'the star-dot'
    : mode.kind === 'swapKite' ? st.state.kites[mode.kite].name || 'the kite' : shelfLabel(st, mode.entry);
  const text = `Moving ${what}`;
  return h('div', { class: 'mode-banner' }, text, button('Cancel', () => a.setRMode(null)));
}

const hint = () => null;   // Nothing selected: the card shows only the Retired bank

/** A kite's category: its swatch and name. */
function kiteWhere(st, k) {
  const kite = st.state.kites[k];
  const cat = kite.color == null ? null : st.content.categories[kite.color];
  return cat ? h('span', {}, swatch(cat.color), ` ${cat.name}`) : '';
}

function dotPanel(st, a, d, roles) {
  const { state, ev } = st;
  const dot = state.dots[d];
  const at = E.index(state).dot.get(d);
  const n = (...rs) => [...roles.values()].filter(r => rs.includes(r)).length;
  const chip = (other, score, how, dir) => h('li', {},
    h('span', { class: 'note' }, dir),
    button(state.dots[other].name || 'unnamed', () => a.rSelect({ kind: 'dot', id: other }), { class: 'text-btn small dot-btn', title: how || 'No note on how they relate' }),
    h('span', { class: 'tag' }, String(score)));
  const out = dot.relations.filter(r => state.dots[r.dot] && E.index(state).dot.has(r.dot));
  const inn = ev.relevantTo(d).filter(r => E.index(state).dot.has(r.dot));
  const deployed = dot.branch && state.stars[dot.branch];
  // At an open Zenith whose faced position isn't free, why it can't deploy.
  const refused = !(deployed && deployed.deployed) && ev.canExpand(d) ? E.deployStar(state, d, ev.opts).problem : null;
  return h('div', {},
    h('header', { class: 'card-head' }, close(a),
      h('div', { class: 'eyebrow' }, kiteWhere(st, at.kite)),
      h('h2', {}, dot.name || 'Unnamed star-dot'),
      ev.support(d) && h('div', { class: 'note' }, `${ev.support(d).ignited} of ${ev.support(d).total} done`)),
    h('div', { class: 'card-section r-legend' },
      h('span', { class: 'r-key up' }, `→ relevant to ${n('up')}${n('up-far') ? ` (+${n('up-far')} further)` : ''}`),
      h('span', { class: 'r-key down' }, `← relevant to it ${n('down')}${n('down-far') ? ` (+${n('down-far')} further)` : ''}`),
),
    (out.length || inn.length)
      ? h('ul', { class: 'card-dots' }, out.map(r => chip(r.dot, r.score, r.how, '→')), inn.map(r => chip(r.dot, r.score, r.how, '←')))
      : h('p', { class: 'note small' }, 'No relations yet (add them on its screen ↗).'),
    h('div', { class: 'buttons' },
      button('Open ↗', () => a.openScreen(d), { title: 'Open its screen' }),
      // A planned star is deployed by hand too; a deployed one can be withdrawn.
      !(deployed && deployed.deployed) && ev.canExpand(d) && !refused && button('Deploy its star', () => a.act((s, o) => E.deployStar(s, d, o), E.independentOn(ev.opts) ? null : `Deployed ${dot.name || 'the star-dot'}’s star`), { title: 'Put its star on the map' }),
      deployed && deployed.deployed && button('Withdraw its star', () => a.act(s => E.withdrawStar(s, d), E.independentOn(ev.opts) ? null : `Withdrew ${dot.name || 'the star-dot'}’s star`), { title: 'Take it off the map: it stays planned, with everything on it' })));
}

function kitePanel(st, a, k, playing) {
  const { state, ev, content } = st;
  const kite = state.kites[k];
  return h('div', {},
    h('header', { class: 'card-head' }, close(a),
      h('div', { class: 'eyebrow' }, kiteWhere(st, k)),
      kite.name && h('h2', {}, kite.name),
      !ev.kiteOpen(k) && h('div', { class: 'note' }, '🔒 Locked')),
    playing ? kite.description && h('p', { class: 'note kite-description' }, kite.description) : h('div', { class: 'card-section kite-description' },
      editableText({ value: kite.description, multiline: true, placeholder: 'Double-click to describe this kite', className: 'note', onCommit: v => a.change(s => E.updateKite(s, k, { description: v })) })),
    h('ul', { class: 'card-dots' }, kite.dots.map((d, slot) => h('li', {},
      h('span', { class: 'slot-name' }, playing ? kite.labels[slot] || content.dotNames[slot] : editableText({ value: kite.labels[slot], placeholder: content.dotNames[slot], className: 'slot-label', onCommit: v => a.change(s => E.setSlotLabel(s, k, slot, v)) })),
      d ? button(state.dots[d].name || 'unnamed', () => (playing ? a.openScreen(d) : a.rSelect({ kind: 'dot', id: d })), { class: 'text-btn small dot-btn' })
        : playing ? h('span', { class: 'note grow' }, '') : button('＋', () => a.rSelect({ kind: 'slot', kite: k, slot }), { class: 'text-btn small dot-btn subtle', title: 'Add one here', 'aria-label': 'Add one here' })))));
}

function slotPanel(st, a, { kite: k, slot }) {
  const { state } = st;
  return h('div', {},
    h('header', { class: 'card-head' }, close(a),
      h('div', { class: 'eyebrow' }, kiteWhere(st, k), state.kites[k].labels[slot] ? ` · ${state.kites[k].labels[slot]}` : '')),
    h('p', {}, slotField(a, k, slot)));
}

/** An active name box: Enter makes a star-dot here (the tree's own field does the same for a child). */
function slotField(a, k, slot) {
  const input = h('input', { class: 'tree-input', placeholder: 'Name…', 'aria-label': 'Name a new one here',
    onkeydown: e => { if (e.key === 'Enter' && input.value.trim()) { a.nameSlot(k, slot, input.value); input.value = ''; } if (e.key === 'Escape') input.value = ''; } });
  setTimeout(() => input.focus?.(), 0);
  return input;
}

function shelfPanel(st, a, entry) {
  const kind = entry.kind === 'dot' ? 'star-dot' : entry.kind;
  return h('div', {},
    h('header', { class: 'card-head' }, close(a), h('div', { class: 'eyebrow' }, `Shelved ${kind}`), h('h2', {}, shelfLabel(st, entry))),
    entry.kind === 'dot' && h('div', { class: 'buttons' },
      button('Open ↗', () => a.openScreen(entry.id), { title: 'Open its screen' }),
      route().mode !== 'play' && button('Delete…', () => a.deleteStarDot(entry.id), { class: 'text-btn small danger', title: 'Delete it for good, with its star and everything on it (asks first; undoable)' })));
}
