// States ▾ (Edit mode, the design version only): every save (click to open, × to delete), New from
// a blueprint…, New empty map… (on this content set or a new one), Duplicate… (a copy to experiment
// on), Download… / Upload… (a save with its content set, as one file), and Make a repo… (a play
// version of one board, under serve.py). A play version has a stand-in for this file.

import { h, when } from '../dom.js';
import { whereSaved } from '../storage.js';

// Whether the menu and its forms are open, and the new map's draft. Outside the state so they
// survive re-renders.
let menuOpen = false;
let nameOpen = false;
let mapDraft = null;   // { name, fresh (a new content set), title, categories: [{ name, color }] }
let packsOpen = false;   // New from a blueprint…'s list
let repoDraft = null;    // Make a repo…'s form: { save (the board), name (its folder), title, touched }
document.addEventListener('click', () => { menuOpen = false; nameOpen = false; mapDraft = null; packsOpen = false; repoDraft = null; });

/** The States ▾ button and its menu. */
export function statesMenu(st, a) {
  const { current, saves } = a.session();
  const stop = e => e.stopPropagation();
  const close = () => { menuOpen = false; nameOpen = false; mapDraft = null; };

  const input = h('input', { class: 'state-name', placeholder: 'Name of the copy', value: `${current} copy`, maxlength: 80 });
  const nameForm = h('form', {
    class: 'save-as',
    hidden: !nameOpen,
    onsubmit: async (e) => {
      e.preventDefault();
      close();
      if (!(await a.duplicate(input.value))) { menuOpen = true; nameOpen = true; }
    },
    onkeydown: (e) => { if (e.key === 'Escape') { nameOpen = false; nameForm.hidden = true; } },
  }, input, h('button', { class: 'text-btn small', type: 'submit' }, 'Duplicate'));
  const openName = () => {
    nameOpen = true;
    nameForm.hidden = false;
    input.focus();
    input.select();
  };

  const uploadInput = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true, class: 'upload-input',
    onchange: async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      close();
      await a.upload(await f.text(), f.name);
    },
  });
  const menu = h('div', { class: 'popover load-menu', hidden: !menuOpen, onclick: stop },
    h('div', { class: 'load-section' }, 'Saves'),
    h('ul', { class: 'load-list' }, saves.map(s => h('li', { class: 'load-row' + (s.name === current ? ' current' : '') },
      h('button', { class: 'load-name', title: s.name === current ? 'Open now' : `Open "${s.name}"`, onclick: () => { close(); if (s.name !== current) a.open(s.name); } }, s.name),
      h('span', { class: 'load-date' }, when(s.savedAt)),
      s.name !== current && h('button', { class: 'remove-btn', title: `Delete "${s.name}"`, 'aria-label': `Delete ${s.name}`, onclick: () => a.remove(s.name) }, '×')))),
    h('div', { class: 'menu-actions' },
      // The showcase packs, each a content set with a starter board.
      h('button', { class: 'menu-item', title: 'Start from one of the showcase packs: its categories, rules and a starter board', 'aria-expanded': String(packsOpen), onclick: () => { packsOpen = !packsOpen; mapDraft = null; a.refreshSaves(); } }, 'New from a blueprint…'),
      packsOpen && h('ul', { class: 'pack-list' }, (a.session().packs ?? []).map(p => h('li', { class: 'pack-row', dataset: { pack: p.id } },
        h('div', { class: 'grow' }, h('strong', {}, p.title), h('div', { class: 'note small' }, p.about)),
        h('button', { class: 'text-btn small pack-start', onclick: () => { close(); packsOpen = false; a.newFromPack(p.id); } }, 'Start')))),
      packsOpen && !(a.session().packs ?? []).length && h('p', { class: 'note small' }, 'No packs found (packs/index.json).'),
      h('button', { class: 'menu-item', title: 'A new save with only the central star', 'aria-expanded': String(!!mapDraft), onclick: () => { mapDraft = mapDraft ? null : blankDraft(st); nameOpen = false; a.refreshSaves(); } }, 'New empty map…'),
      mapDraft && newMapForm(st, a, close),
      h('button', { class: 'menu-item', title: 'A copy of this save to experiment on (it shares the content set and its rules)', onclick: () => { mapDraft = null; openName(); } }, 'Duplicate…'),
      nameForm,
      h('button', { class: 'menu-item', title: 'This save with its content set, as one file: a backup, or to open it in another browser', onclick: () => { close(); a.download(); } }, 'Download…'),
      h('button', { class: 'menu-item', title: 'Open a file made with Download… (it’s added beside your saves)', onclick: () => uploadInput.click?.() }, 'Upload…'),
      uploadInput,
      a.session().derive?.available && h('button', { class: 'menu-item', title: 'Write a play version of one board beside this folder, ready for GitHub', 'aria-expanded': String(!!repoDraft), onclick: () => { repoDraft = repoDraft ? null : blankRepo(a); mapDraft = null; a.refreshSaves(); } }, 'Make a repo…'),
      repoDraft && repoForm(a, close)),
    h('p', { class: 'load-where' }, `Every change is saved ${whereSaved()} as you make it.`));

  return h('div', { class: 'popover-wrap' },
      h('button', {
        class: 'text-btn small states-btn',
        'aria-expanded': String(menuOpen),
        onclick: (e) => {
          stop(e);
          menuOpen = !menuOpen; nameOpen = false; menu.hidden = !menuOpen; nameForm.hidden = true;
          if (menuOpen) a.refreshSaves();
        },
      }, 'States ▾'),
      menu);
}

const blankDraft = st => ({ name: '', fresh: false, title: '', categories: st.content.categories.map(c => ({ name: '', color: c.color })) });

/** New empty map…: its name, and either this content set or a new one (named, with six categories). */
function newMapForm(st, a, close) {
  const d = mapDraft;
  const rerender = () => a.refreshSaves();
  const choice = (fresh, label, note) => h('label', { class: 'new-map-choice' },
    h('input', { type: 'radio', name: 'new-map-content', checked: d.fresh === fresh, onchange: () => { d.fresh = fresh; rerender(); } }),
    h('span', {}, label, h('span', { class: 'new-map-note' }, note)));
  return h('form', {
    class: 'new-map',
    onsubmit: async (e) => {
      e.preventDefault();
      const ok = await a.newMap(d.name, d.fresh ? { title: d.title, categories: d.categories } : null);
      if (ok) close();
    },
    onkeydown: (e) => { if (e.key === 'Escape') { mapDraft = null; rerender(); } },
  },
    h('input', { class: 'state-name', placeholder: 'Name of the map', value: d.name, maxlength: 80, oninput: e => { d.name = e.target.value; } }),
    choice(false, `Keep this content set`, ` “${st.content.title}”: its categories, attributes and rules`),
    choice(true, 'Start a new content set', ': its name and six categories; attributes and rules copied from this one, then edited in GOVERN'),
    d.fresh && h('div', { class: 'new-map-content' },
      h('input', { class: 'state-name', placeholder: 'Name of the content set', value: d.title, maxlength: 80, oninput: e => { d.title = e.target.value; } }),
      d.categories.map((c, i) => h('div', { class: 'new-map-cat' },
        h('input', { type: 'color', value: c.color, 'aria-label': `Category ${i + 1} color`, oninput: e => { c.color = e.target.value; } }),
        h('input', { class: 'state-name', placeholder: `Category ${i + 1}`, value: c.name, maxlength: 40, oninput: e => { c.name = e.target.value; } })))),
    h('div', { class: 'btn-row' },
      h('button', { class: 'text-btn small', type: 'submit' }, 'Start the map'),
      h('button', { class: 'text-btn small subtle', type: 'button', onclick: () => { mapDraft = null; rerender(); } }, 'Cancel')));
}

/** A folder name from a board's name: "Trivia night" → "trivia-night". */
const slug = name => String(name).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 64) || 'my-board';

/** Make a repo…'s first draft: the open board, under the last derivation's folder if it shipped it. */
function blankRepo(a) {
  const { current } = a.session();
  const last = (a.session().derive?.previous ?? []).find(m => m.board === current);
  return { save: current, name: last?.name ?? slug(current), title: last?.title ?? current, touched: !!last };
}

/** Make a repo…: the board to ship, its folder and title; then Write. */
function repoForm(a, close) {
  const d = repoDraft;
  const rerender = () => a.refreshSaves();
  const where = a.session().derive?.parent ?? '..';
  const saves = a.session().saves ?? [];
  return h('form', {
    class: 'new-map repo-form',
    onsubmit: async e => {
      e.preventDefault();
      if (await a.makeRepo({ name: d.name.trim(), title: d.title, save: d.save })) { repoDraft = null; close(); }
    },
    onkeydown: e => { if (e.key === 'Escape') { repoDraft = null; rerender(); } },
  },
    h('label', { class: 'new-map-note' }, 'The board to ship'),
    h('select', {
      class: 'state-name repo-board', 'aria-label': 'The board to ship',
      onchange: e => {
        const was = d.save;
        d.save = e.target.value;
        if (!d.touched || d.name === slug(was)) d.name = slug(d.save);   // The folder and title follow the board, until typed over
        if (!d.touched || d.title === was) d.title = d.save;
        rerender();
      },
    }, saves.map(s => h('option', { value: s.name, selected: s.name === d.save }, s.name))),
    h('label', { class: 'new-map-note' }, 'Folder (beside this one)'),
    h('input', { class: 'state-name repo-name', value: d.name, maxlength: 64, oninput: e => { d.name = e.target.value; d.touched = true; } }),
    h('label', { class: 'new-map-note' }, 'Its title'),
    h('input', { class: 'state-name repo-title', value: d.title, maxlength: 80, oninput: e => { d.title = e.target.value; d.touched = true; } }),
    h('p', { class: 'note small' }, `Writes ${where}${where.includes('\\') ? '\\' : '/'}${d.name || '…'}: a play version of “${d.save}”, opening straight into it as a first-time player (its progress cleared), with the views and permissions set in ⚙ Design › Player. No Edit mode, Design or States menu in it, and none of your other saves. Writing again to the same folder updates it.`),
    h('div', { class: 'btn-row' },
      h('button', { class: 'text-btn small repo-write', type: 'submit', disabled: !d.save }, 'Write it'),
      h('button', { class: 'text-btn small subtle', type: 'button', onclick: () => { repoDraft = null; rerender(); } }, 'Cancel')));
}
