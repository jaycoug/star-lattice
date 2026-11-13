// Entry point: open the last save (or the first one, or a new one when there are none), build the
// store, render on every change, and write changes back to the files.

import { h, notify, setTerms } from './dom.js';
import { openFile, prefsOf, resolve, themeOf } from './model.js';
import { createStore } from '../../shared/store.js';
import { createActions } from './actions.js';
import { createHistory } from './history.js';
import * as storage from './storage.js';
import { tabBar, activePage } from './tabs.js';
import { tourPopup, initTour, checkTour, placeTour } from './tour.js';
import { route } from './route.js';
import { pinDialog } from './panels/pin.js';
import { stateBar } from './panels/stateBar.js';
import { conflictCard } from './panels/conflict.js';
import { importSheet } from './panels/importQuestions.js';
import { CENTRAL } from '../../shared/ui/starDotScreen.js';
import { screenFor } from './screen.js';
import { index, normalizeSave, normalizeContent, newSave, listKiteOf, freshBoard } from '../../shared/engine/index.js';

/**
 * The page: the tab bar and save bar, then the active tab. A star-dot's screen opens on top of it
 *: a panel over most of the window, the page still showing, dimmed, around its edges;
 * clicking that edge, × or Esc closes it (Esc and ← Back step back through screens opened from it first).
 */
function layout(file, a) {
  const st = resolve(file);
  const tab = activePage(st, a);
  const { sds, sdsUi } = a.ui();
  // On the map, retired (opened from PLAY's Retired bank, round 6), or the central star's screen.
  // A list's item opens too, on the map or not yet (its question is written there).
  const dot = sds && (sds.dot === CENTRAL || (st.state.dots[sds.dot] && (index(st.state).dot.has(sds.dot) || st.state.retired.some(e => e.id === sds.dot) || listKiteOf(st.state, sds.dot)))) ? sds.dot : null;
  const dotName = dot === CENTRAL ? (st.content.title || 'Central star') : dot && (st.state.dots[dot].name || 'Star-dot');
  document.title = `${dot ? dotName : tab.label} · Star Lattice`;
  document.documentElement?.classList.toggle('sds-open', !!dot);   // the page behind doesn't scroll
  if (document.documentElement) document.documentElement.dataset.theme = themeOf(file);   // light or dark (app.css); read live, so the system's change shows
  return h('div', { class: 'app' },
    h('div', { class: 'topbar' }, h('div', { class: 'topbar-inner' }, tabBar(st, tab, a), stateBar(st, a, { playing: tab.mode === 'play', locked: tab.mode === 'play' && a.locked() }))),
    tab.render(st, a),
    dot && h('div', { class: 'sds-overlay', onclick: e => { if (e.target === e.currentTarget) a.closeScreen(); } },
      h('div', { class: 'sds-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': dotName },
        h('button', { type: 'button', class: 'sds-sheet-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => a.closeScreen() }, '×'),
        screenFor(st, a, dot, { edit: tab.edit, back: sds.trail.length ? a.back : null }))),
    a.ui().conflict && conflictCard(a.ui().conflict, a),
    a.ui().qImport && importSheet(st, a),
    a.ui().pinAsk && pinDialog(a.ui().pinAsk, a),
    tourPopup(st, a, tab));   // The tutorial's popup (tour.js), on top
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Close open popovers (palette menu, …) when clicking elsewhere.
document.addEventListener('click', (e) => {
  for (const pop of document.querySelectorAll('.popover:not([hidden])')) {
    if (!pop.parentElement.contains(e.target)) pop.hidden = true;
  }
});

function bootError(root, title, message) {
  root.replaceChildren(h('div', { class: 'boot-error' },
    h('h1', {}, title), h('p', {}, message),
    h('p', {}, 'Star Lattice keeps its saves in this browser, or as files when its local server runs (the Start Star Lattice icon, or):'),
    h('pre', {}, 'cd star-lattice\npython serve.py --open')));
}

/** The save to open first: the last one opened here, else the newest; a new one when there are none. */
async function firstFile(prefs) {
  const list = await storage.saves.list();
  const name = list.some(s => s.name === prefs.last) ? prefs.last : list[0]?.name;
  if (name) {
    const save = normalizeSave(await storage.saves.load(name));
    const library = normalizeContent(await storage.contentSets.load(save.content));
    if (!library.starter) storage.contentSets.save(library.id, { ...library, starter: freshBoard(save.state) }).catch(() => {});   // its library starts as this save's items (P10)
    const f = openFile(name, save, library, prefs);
    if (!save.design) Object.defineProperty(f, 'designMoved', { value: true });   // written once opened (P10)
    return f;
  }
  const sets = await storage.contentSets.list();
  if (!sets.length) throw new Error(storage.mode === 'browser' ? 'There are no content sets in this browser yet.' : 'There are no saves in saves/ and no content sets in content/.');
  const content = normalizeContent(await storage.contentSets.load(sets.some(s => s.name === 'life') ? 'life' : sets[0].name));
  return openFile('untitled', newSave(content, 'Untitled'), content, prefs);
}

async function boot() {
  const root = document.getElementById('app');
  // Serve.py's files when it answers, else this browser's own store (filled from the packs the first time).
  try {
    await storage.init();
  } catch (e) {
    return bootError(root, 'Couldn’t reach the saves', e.message);
  }
  if (globalThis.navigator && 'serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});   // installable; opens offline
  let initial;
  try {
    initial = await firstFile(storage.loadPrefs());
  } catch (e) {
    return bootError(root, 'Couldn’t open a save', e.message);
  }
  storage.markWritten(initial.designMoved ? { ...initial, content: null } : initial);   // (one from before: its design still to write, P10)
  const store = createStore(initial);
  const history = createHistory(store);
  // View-only selection: open kite skeleton, selected star-dot, widget tab, REARRANGE's map
  // selection and pick mode, its tree's open path, PLAY's selection, pick mode, relations layer, shelf strip
  // the open star-dot screen and its trail. Never saved.
  const ui = createStore({
    kite: -1, dot: -1, tab: 'details',
    rSel: null, rMode: null, tPath: [],
    playSel: null, playMode: null, layer: 'off',
    conflict: null, sds: null, sdsUi: {}, quiz: null, spin: null,
    unlocked: false, pinAsk: null,   // The assessor PIN entered since PLAY opened; the PIN dialog
  });
  const actions = createActions(store, ui, history);
  // Full re-render on every change, keeping the scroll position of scrolling lists.
  const render = () => {
    setTerms(store.get().content.terms);   // This content set's word for a star-dot, everywhere
    const scrolls = new Map([...root.querySelectorAll('[data-scroll-key]')]
      .map(el => [el.dataset.scrollKey, [el.scrollTop, el.scrollLeft]]));
    root.replaceChildren(layout(store.get(), actions));
    for (const el of root.querySelectorAll('[data-scroll-key]')) {
      const [top, left] = scrolls.get(el.dataset.scrollKey) ?? [0, 0];
      el.scrollTop = top;
      el.scrollLeft = left ?? 0;   // MATERIALS' side-scrolling columns
    }
    placeTour(root);
    checkTour();   // a tutorial step whose action was just done moves on
  };
  initTour(render);
  store.subscribe(actions.pending);   // before rendering, so the bar shows "Saving…"
  store.subscribe(render);
  ui.subscribe(render);
  store.subscribe(debounce(() => actions.persist(), 400));
  // Until a theme is chosen here, follow the system's light or dark setting as it changes.
  globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => { if (!store.get().theme) render(); });
  // Also write on reload/close, so a change made within the debounce delay isn't lost.
  window.addEventListener('pagehide', () => actions.persist({ keepalive: true }));
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    // Escape cancels a conflict card, else steps back out of a star-dot's screen.
    if (e.key === 'Escape' && ui.get().pinAsk) return actions.cancelPin();
    if (e.key === 'Escape' && ui.get().conflict) return actions.cancelConflict();
    if (e.key === 'Escape' && ui.get().qImport) return actions.closeImport();
    if (e.key === 'Escape' && ui.get().sds && !typing) return actions.back();
    // Ctrl+Z undoes, Ctrl+Shift+Z or Ctrl+Y redoes (Cmd on a Mac); typing keeps the browser's own.
    const key = e.key.toLowerCase();
    if (!(e.ctrlKey || e.metaKey) || typing || !['z', 'y'].includes(key)) return;
    if (route().mode === 'play' && (actions.locked() || !actions.allow('undo'))) return;   // No undo for the player, unless given
    e.preventDefault();
    if (key === 'y' || e.shiftKey) actions.redo();
    else actions.undo();
  });
  let shownMode = route().mode;
  window.addEventListener('hashchange', () => {
    if (ui.get().sds) ui.set({ sds: null, sdsUi: {} });   // switching tabs closes a star-dot's screen
    // Play mode locks again, and (without a PIN) is a test run on a copy; Edit mode ends the test.
    if (route().mode === 'play') { actions.relock(); actions.startTest(); } else actions.endTest();
    // Switching mode starts with nothing selected on the map (a test run is a first-time player's).
    if (route().mode !== shownMode) { shownMode = route().mode; if (ui.get().playSel || ui.get().playMode) ui.set({ playSel: null, playMode: null }); }
    render();
    window.scrollTo(0, 0);
  });
  if (initial.save.pin) history.replaceState(null, '', '#play');   // With a PIN, the app opens in Play mode
  render();
  if (route().mode === 'play') actions.startTest();   // Opened at Play mode: a test run too
  if (initial.name === 'untitled' || initial.designMoved) actions.persist();   // a new save, or one from before taking its own copy of the design (P10)
  storage.savePrefs(prefsOf(store.get()));
  await actions.refreshSaves();
}

boot();
