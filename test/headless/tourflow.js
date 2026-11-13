// Usage: node tourflow.js <copy of the project>: P8. A fresh browser gets the tutorial's intro;
// Show me more walks the designer's tour, each step moving on when it's done (or with Next); the
// designer's welcome line opens the player's tour in Play mode, which offers only what the player
// is given; No more tutorials and Finish are remembered; ? Help is a searchable manual, the
// player's leaving out what they aren't given, and starts a tour again.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/', { tours: true });
let hash = '#star';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
doc.documentElement = doc.createElement('html');
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const go = async h => { location.hash = h; await tick(100); resize(); await tick(50); };
const click = async el => { el.fire('click'); await tick(300); };
const btn = (label, within = app) => within.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const pop = () => app.find(n => cls(n, 'tour-pop'));
const step = () => pop()?.dataset?.step;
const ringed = c => !!app.find(n => cls(n, c) && n.classList.contains('tour-target'));
const kept = () => JSON.parse(globalThis.localStorage.getItem('star-lattice:tours') ?? '{}');
const map = () => app.find(n => cls(n, 'sl-map'));
const tap = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(300); };
const content = () => JSON.parse(read('content/life.json'));

// ---- The intro ----
report('a fresh browser gets the tutorial’s intro: what to do first, Show me more, No more tutorials',
  cls(pop() ?? {}, 'tour-intro') && text(pop()).includes('Welcome to Star Lattice') && !!btn('Show me more', pop()) && !!btn('No more tutorials', pop()));
await click(btn('Show me more', pop()));
report('Show me more starts the designer’s tour, pointing at the map', step() === 'kite' && text(pop()).includes('1 of') && ringed('sl-map'), step());

// ---- Steps that wait for the action ----
await tick(700);   // the map's first animation
await tap(map().find(n => n.dataset?.hit === 'kite'));
await tick(100);
report('selecting a kite moves the tour on by itself', step() === 'open', step());
const pill = map().find(n => n.dataset?.hit === 'pill' && n.dataset.action === 'open') ?? map().find(n => n.dataset?.hit === 'dot');
await tap(pill);
if (step() === 'open') { const open = map().find(n => n.dataset?.hit === 'pill' && n.dataset.action === 'open'); if (open) await tap(open); }
await tick(100);
report('opening a star-dot’s screen moves it on, pointing at the screen', step() === 'screen' && ringed('sds-sheet'), step());
await click(app.find(n => cls(n, 'sds-sheet-close')));
await tick(100);
report('closing the screen moves it on to the Tree view', step() === 'tree' && !!app.find(n => n.dataset?.view === 'tree' && n.classList.contains('tour-target')), step());
await go('#tree'); await tick(100);
report('…opening it shows a step with Next (nothing to wait for)', step() === 'add' && !!btn('Next', pop()), step());
await click(btn('Next', pop()));
await go('#design/board'); await tick(100);
report('opening ⚙ Design moves on to Player', step() === 'player', step());
await go('#star'); await tick(100);
report('on another page, a step says where to go first', step() === 'player' && text(pop()).includes('First open ⚙ Design') && ringed('design-link'), text(pop()));
await go('#design/player'); await tick(100);
report('Player opened: the welcome line is next', step() === 'welcome' && ringed('player-welcome'), step());

// ---- The welcome line ----
const welcome = app.find(n => cls(n, 'player-welcome'));
welcome.value = 'Hello, player: good luck tonight!'; welcome.fire('change', { target: welcome }); await tick(500);
report('the welcome line is saved with the content set', content().welcome === 'Hello, player: good luck tonight!', JSON.stringify(content().welcome));
await click(btn('Next', pop()));
report('then: switch to Play', step() === 'play' && !!app.find(n => n.dataset?.mode === 'play' && n.classList.contains('tour-target')), step());

// ---- The player's tour, in Play mode ----
await go('#play'); await tick(100);
report('Play mode moves the designer’s tour on, and opens the player’s with the welcome line',
  kept().design === 'states' && cls(pop() ?? {}, 'tour-intro') && text(pop()).includes('Hello, player: good luck tonight!'), JSON.stringify(kept()));
await click(btn('Show me more', pop()));
const total = () => Number((text(app.find(n => cls(n, 'tour-count'))).match(/of (\d+)/) ?? [])[1]);
report('the player’s tour has only what they’re given: the Star view, its screens, moving, Help (no Tree, Deck or Schedule)', step() === 'p-kite' && total() === 5, `${step()} of ${total()}`);
await click(btn('No more tutorials', pop()));
report('No more tutorials closes it, and this browser remembers', !pop() && kept().player === 'off');

// ---- Back in Edit mode: the designer's last step, Finish ----
await go('#star'); await tick(100);
report('back in Edit mode the designer’s tour is at its last step, pointing at States ▾', step() === 'states' && ringed('states-btn') && !!btn('Finish', pop()), step());
await click(btn('Finish', pop()));
report('Finish ends it, remembered', !pop() && kept().design === 'done');

// ---- ? Help ----
await go('#help'); await tick(100);
const sections = () => app.all(n => cls(n, 'help-section') && !n.hidden).map(n => n.dataset.section);
report('? Help is the manual: a section per view, the screen, Design and the saves', ['start', 'star', 'tree', 'deck', 'schedule', 'screen', 'design', 'saves'].every(s => sections().includes(s)), sections().join());
const search = app.find(n => cls(n, 'help-search'));
search.value = 'repo'; search.fire('input', { target: search }); await tick(50);
const shown = app.all(n => cls(n, 'help-entry') && !n.hidden && !n.parent?.parent?.hidden).map(n => text(n.find(x => x.tagName === 'DT')));
report('searching finds a word: “repo” leaves Make a repo… only', shown.length === 1 && shown[0] === 'Make a repo…', shown.join());
search.value = 'zzzz'; search.fire('input', { target: search }); await tick(50);
report('…and says when nothing matches', !app.find(n => cls(n, 'help-none')).hidden);
search.value = ''; search.fire('input', { target: search }); await tick(50);
await click(btn('Start the tutorial again'));
report('Help starts the tutorial again from its intro', cls(pop() ?? {}, 'tour-intro') && kept().design === undefined);
await click(btn('No more tutorials', pop()));
await go('#play/help'); await tick(100);
report('the player’s manual leaves out Design, the saves and the views they aren’t given', sections().includes('star') && !['design', 'saves', 'tree', 'deck', 'schedule'].some(s => sections().includes(s)), sections().join());
report('…and starts the player’s tour again', (await click(btn('Start the tour again')), cls(pop() ?? {}, 'tour-intro') && kept().player === undefined));
