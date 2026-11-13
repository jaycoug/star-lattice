// The conflict card: a move that would land a branch on another star, or put a star-dot (or
// kite) inside its own branch, asks before doing anything. Shelve makes the move and puts the
// clashing branch on the shelf (a star-dot moved into its own branch sits in that branch, so it
// goes to the shelf with it); Cancel leaves the board as it was. Shown over any tab (ui.conflict).

import { h } from '../dom.js';

const TEXT = {
  land: {
    title: 'A branch would land on another star',
    why: 'Where it’s going, a star deployed from it (or from what it carries) would sit where another star already is.',
    shelve: 'The moving star-dots’ stars go to the shelf, with their branches; the move happens.',
  },
  ownBranch: {
    title: 'That’s inside its own branch',
    why: 'A star-dot can’t sit on a star deployed from it while that star is on the board.',
    shelve: 'Its branch goes to the shelf, and it goes along, in the slot you chose on that branch; what was in that slot takes its old place.',
  },
};

export function conflictCard(conflict, a) {
  const t = TEXT[conflict.kind] ?? { title: 'This move clashes', why: conflict.problem, shelve: 'The clashing branch goes to the shelf; the move happens.' };
  return h('div', { class: 'modal-back', onclick: e => { if (e.target === e.currentTarget) a.cancelConflict(); } },
    h('div', { class: 'conflict-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.title },
      h('div', { class: 'eyebrow' }, conflict.message),
      h('h2', {}, t.title),
      h('p', {}, t.why),
      h('div', { class: 'conflict-choices' },
        h('button', { class: 'text-btn conflict-shelve', onclick: a.shelveConflict }, h('strong', {}, 'Shelve'), h('span', { class: 'note' }, t.shelve)),
        h('button', { class: 'text-btn', onclick: a.cancelConflict }, h('strong', {}, 'Cancel'), h('span', { class: 'note' }, 'Nothing moves.'))),
      h('p', { class: 'note small' }, 'Shelved things keep all their content; place them again from the shelf. Undo also reverts a shelve.')));
}
