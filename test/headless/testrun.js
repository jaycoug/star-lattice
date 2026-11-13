// Usage: node testrun.js <copy of the project>: P3. In the design version Play mode is a test run
// as a first-time player (a fresh session on a copy: nothing done there is saved, and Edit mode
// gets the board and its undo history back), and Play mode shows only what Design › Player gives.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/', { realPlay: false });
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
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const go = async h => { location.hash = h; await tick(100); resize(); await tick(50); };
const click = async el => { el.fire('click'); await tick(500); };
const btn = label => app.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const saved = () => read('saves/outlook.json');
const content = () => JSON.parse(read('content/life.json'));
const sw = key => app.find(n => n.dataset?.player === key);
const toggle = async key => { const c = sw(key); c.checked = !c.checked; c.fire('change', { target: c }); await tick(500); };
const sheet = () => app.find(n => cls(n, 'sds-sheet'));
const node = id => app.find(n => cls(n, 'tree-box') && n.dataset?.node === id);

// ---- Design › Player: Tree for the player, Layer and Relevance Information off ----
await go('#design/player');
report('Design › Player has a Movement group: Swap, Rotate star-dots, Rotate kites', ['swap', 'rotateDots', 'rotateKites'].every(k => !!sw(k)) && text(app).includes('Movement'));
report('Design › Board no longer has Movement', (await go('#design/board'), !text(app).includes('Movement')));
await go('#design/player');
await toggle('tree');
await toggle('layer');
await toggle('relevance');
const p = content().player;
report('the switches are saved with the content set', p.tree === true && p.layer === false && p.relevance === false, JSON.stringify([p.tree, p.layer, p.relevance]));
const designed = saved();

// ---- Edit mode keeps everything ----
await go('#star');
const layerSwitch = () => app.find(n => n.attrs?.['aria-label'] === 'Layer');
report('Edit mode’s Star view keeps the Layer switch', !!layerSwitch());

// ---- P4: one star-dot (Applications) with its own layout: Notes off on its screen only ----
await go('#tree');
await click(node('k1'));
await click(node('d10').find(n => cls(n, 'tree-open')));
sheet().find(n => n.tagName === 'INPUT' && n.dataset?.scope === 'own').fire('change'); await tick(500);
await click(sheet().find(n => cls(n, 'sds-widget') && n.dataset.widget === 'notes').find(n => cls(n, 'sds-widget-off')));
report('P4: Layout applies to: this star-dot only, then Notes off, is saved on Applications only', JSON.parse(saved()).state.dots.d10.layout?.columns.flat().includes('notes') === false && !content().layout.columns.flat().includes('notes') === false);
await click(app.find(n => cls(n, 'sds-sheet-close')));
const designed2 = saved();

// ---- Play mode: a test run ----
await go('#play');
report('Play mode is a test run: the bar says nothing is saved, and offers Restart the test', !!app.find(n => cls(n, 'test-run')) && !!btn('↺ Restart the test'));
report('…without States ▾, and with Undo (Player › Undo is on)', !btn('States') && !!btn('↶ Undo'));
report('Layer off: the Star view has no Layer switch in Play mode', !layerSwitch());
await go('#play/tree');
report('the Tree view in Play mode: no shelf and no name fields to add with (Moving items is off)', hash === '#play/tree' && !app.find(n => cls(n, 'shelf-section')) && !app.find(n => n.tagName === 'INPUT' && cls(n, 'tree-input')));
await click(node('k1'));
await click(node('d10'));
report('a click on a star-dot opens its screen', !!sheet() && text(sheet()).includes('Applications'));
report('P4: the test run shows this star-dot’s own layout (Notes off here only)', !sheet().find(n => cls(n, 'sds-notes')));
report('Relevance Information off: its screen has none in Play mode', !sheet().find(n => cls(n, 'sds-relevance')));
const done = () => sheet().all(n => cls(n, 'sds-bullet-btn') && n.attrs?.title === 'Mark not complete').length;
const doneBefore = done();
await click(sheet().find(n => cls(n, 'sds-bullet-btn') && n.attrs?.title === 'Mark complete' && !n.attrs?.disabled));
report('completing a child in the test run changes the board on screen…', done() === doneBefore + 1, `${doneBefore} → ${done()}`);
await tick(600);
report('…but nothing is written', saved() === designed2);
await click(btn('↺ Restart the test'));
report('Restart the test starts it over (the screen closes)', !sheet() && !!app.find(n => cls(n, 'test-run')));

// ---- Back to Edit mode: the board and its history as they were ----
await go('#tree');
report('Edit mode ends the test: the bar shows the save again', !app.find(n => cls(n, 'test-run')) && !!btn('States'));
await click(node('k1'));
await click(node('d10').find(n => cls(n, 'tree-open')));
report('Edit mode shows the board as designed (the child isn’t complete)', !!sheet() && done() === doneBefore && saved() === designed2, `${done()} complete`);
report('Edit mode’s star-dot screen keeps Relevance Information', !!sheet().find(n => cls(n, 'sds-relevance')));
await click(app.find(n => cls(n, 'sds-sheet-close')));
await click(btn('↶ Undo'));
await tick(500);
report('Edit mode’s undo history survives the test run (Undo turns Applications’ Notes back on)', JSON.parse(saved()).state.dots.d10.layout?.columns.flat().includes('notes') === true);
