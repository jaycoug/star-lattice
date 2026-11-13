// The save bar, at the right end of the top bar on every view: ↶ Undo and ↷ Redo (Ctrl+Z,
// Ctrl+Shift+Z or Ctrl+Y), light or dark, the open save's name, whether it's saved, and (Edit mode)
// States ▾ (statesMenu.js, the design version's). Changes are written to the open save as they're
// made, so there's no Save button: the indicator says "Saving…", then "Saved 16:23", or "Not saved —
// retry". In Play mode the States menu is gone and Undo shows only when the player has it (Design ›
// Player); during a test run the indicator says nothing is saved.

import { h, when } from '../dom.js';
import { whereSaved } from '../storage.js';
import { statesMenu } from './statesMenu.js';

let indicator = null;  // the saved indicator on the page, redrawn alone when the status changes

export function stateBar(st, a, { playing = false, locked = false } = {}) {
  a.onSaving(() => { if (playing && a.testing()) return; const next = savedIndicator(a); indicator?.replaceWith(next); indicator = next; });
  indicator = savedIndicator(a);
  const { current, canUndo, canRedo } = a.session();
  const stop = e => e.stopPropagation();
  const undo = !locked && a.allow('undo');
  if (playing && a.testing()) indicator = h('span', { class: 'save-status test-run', role: 'status', title: 'Play mode is a test run as a first-time player: nothing done here is saved, and Edit puts the board back as it was' }, 'Test run · not saved');
  return h('div', { class: 'state-bar' + (locked ? ' locked' : '') },
    // While PLAY is locked, the player gets no Undo, Redo or States menu; in Play mode, Undo only if given.
    undo && h('button', { class: 'text-btn small', title: 'Undo (Ctrl+Z)', disabled: !canUndo, onclick: e => { stop(e); a.undo(); } }, '↶ Undo'),
    undo && h('button', { class: 'text-btn small', title: 'Redo (Ctrl+Shift+Z)', disabled: !canRedo, onclick: e => { stop(e); a.redo(); } }, '↷ Redo'),
    h('button', {
      class: 'text-btn small theme-btn', 'aria-pressed': String(st.theme === 'dark'),
      title: st.theme === 'dark' ? 'Light mode (kept in this browser)' : 'Dark mode (kept in this browser)',
      onclick: e => { stop(e); a.toggleTheme(); },
    }, st.theme === 'dark' ? '☀ Light' : '☾ Dark'),
    h('span', { class: 'state-current', title: whereSaved() === 'in this browser' ? 'Kept in this browser (Download… for a copy)' : `saves/${current}.json` }, current),
    indicator,
    !playing && statesMenu(st, a));
}

/** "Saving…", "Saved 16:23" (this session's last write, else the file's time) or "Not saved — retry". */
function savedIndicator(a) {
  const { saving, savedAt, error, saves, current } = a.session();
  if (saving === 'failed') {
    return h('button', { class: 'save-status failed', title: `Couldn’t save: ${error}. Click to try again.`, onclick: e => { e.stopPropagation(); a.persist(); } }, 'Not saved — retry');
  }
  if (saving === 'saving') return h('span', { class: 'save-status saving', role: 'status' }, 'Saving…');
  const at = savedAt ?? saves.find(s => s.name === current)?.savedAt;
  return h('span', { class: 'save-status', role: 'status', title: `Every change is saved ${whereSaved()} as you make it` }, at ? `Saved ${when(at)}` : 'Saved');
}
