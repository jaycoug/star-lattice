// Usage: node apartflow.js <copy of the project>: P10, step 1–2. A save keeps its own design: a save
// from before takes a copy of its content set's the first time it opens; a Design change is written
// into the save, never the content set; another save on the same content set keeps its own.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick } from './fakedom.js';
const ROOT = System.programArgs[0];
const raw = f => new TextDecoder().decode(GLib.file_get_contents(`${ROOT}/${f}`)[1]);   // the files as they are
const json = f => JSON.parse(raw(f));
const E0 = await import(`file://${ROOT}/shared/engine/index.js`);
// A second save on the same content set, from before (no design of its own).
GLib.file_set_contents(`${ROOT}/saves/outlook copy.json`, raw('saves/outlook.json'));
const libraryBefore = raw('content/life.json');
const withoutStarter = t => { const { starter: _s, ...rest } = E0.normalizeContent(JSON.parse(t)); return JSON.stringify(rest); };   // the content set but its library
const { els, resize } = install(ROOT, '/app/');
let hash = '#design/look';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
const E = E0;
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
report('a save from before has no design of its own', !json('saves/outlook.json').design);
await import(`file://${ROOT}/app/js/main.js`);
await tick(300); resize(); await tick(600);
const app = els.app;
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const txt = n => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
const lib = json('content/life.json');
report('opened, it takes a copy of its content set’s design (written into the save)', JSON.stringify(json('saves/outlook.json').design?.rules) === JSON.stringify(E.normalizeContent(lib).rules), Object.keys(json('saves/outlook.json')).join());
report('…and the content set gains only its library (the items of the save opened on it), nothing of the design', withoutStarter(raw('content/life.json')) === withoutStarter(libraryBefore) && !!json('content/life.json').starter);
const libraryOpened = raw('content/life.json');
// A Design change: Look › Background lattice: Shown (the content set has Hidden).
const hidden = app.all(n => n.tagName === 'INPUT' && n.attrs?.name === 'lattice')[0];
hidden.checked = true; hidden.fire('change', { target: hidden }); await tick(600);
report('a Design change is written into this save', json('saves/outlook.json').design.rules.lattice === 'shown');
report('…not into the content set', raw('content/life.json') === libraryOpened && E.normalizeContent(json('content/life.json')).rules.lattice === 'hidden');
report('another save on the same content set keeps its own (here, the content set’s)', !json('saves/outlook copy.json').design && E.contentFor(json('content/life.json'), json('saves/outlook copy.json')).rules.lattice === 'hidden');
// A category's color, and a category's name, are this save's too.
const named = E.contentFor(json('content/life.json'), json('saves/outlook.json'));
report('the save plays with its own design over the content set (Shown here)', named.rules.lattice === 'shown' && named.id === 'life' && named.title === lib.title);
report('a save’s own design survives being read back (normalizeSave keeps it)', E.normalizeSave(json('saves/outlook.json')).design?.rules?.lattice === 'shown');

// ---- Step 3: the content set is the library of items; Update content set ----
const names = st => Object.values(st.dots).map(d => d.name).sort().join('|');
const savedState = () => E.normalizeSave(json('saves/outlook.json')).state;
report('the content set’s library starts as the items of the save opened on it (progress cleared)', names(E.normalizeContent(json('content/life.json')).starter) === names(savedState()) && !Object.values(E.normalizeContent(json('content/life.json')).starter.dots).some(d => d.ignitedAt != null && d.assessment));
const fresh = E.newSave(E.normalizeContent(json('content/life.json')), 'From the library');
report('a new save on the content set starts from its library: its items, in their places', names(fresh.state) === names(savedState()) && Object.keys(fresh.state.kites).length === Object.keys(savedState().kites).length);
// A second, different save pushes its items: here, the copy with one item renamed (as if edited there).
const copy = json('saves/outlook copy.json');
const someDot = Object.keys(copy.state.dots)[0];
copy.state.dots[someDot].name = 'Edited in the copy';
GLib.file_set_contents(`${ROOT}/saves/outlook copy.json`, JSON.stringify(copy));
report('editing an item in one save leaves the library and the other save as they were', E.normalizeContent(json('content/life.json')).starter.dots[someDot].name !== 'Edited in the copy' && savedState().dots[someDot].name !== 'Edited in the copy');
location.hash = '#design/board'; await tick(200);
const upd = app.find(n => cls(n, 'update-content-set'));
report('Design › Board has Update content set…', !!upd);
const rulesBefore = JSON.stringify(E.normalizeContent(json('content/life.json')).rules);
globalThis.confirm = () => true;
upd.fire('click'); await tick(600);
const libNow = E.normalizeContent(json('content/life.json'));
report('Update content set copies this save’s items (order and places) to its library', names(libNow.starter) === names(savedState()) && JSON.stringify(Object.values(libNow.starter.kites).map(k => k.dots)) === JSON.stringify(Object.values(E.freshBoard(savedState()).kites).map(k => k.dots)));
report('…with the category names; the colors and every other Design setting stay in the save', libNow.categories.every((c, i) => c.name === E.contentFor(json('content/life.json'), json('saves/outlook.json')).categories[i].name) && JSON.stringify(libNow.rules) === rulesBefore);
report('…and the other save keeps its own items', json('saves/outlook copy.json').state.dots[someDot].name === 'Edited in the copy');
globalThis.confirm = () => false;
const libText = raw('content/life.json');
upd.fire('click'); await tick(400);
report('declining the confirmation changes nothing', raw('content/life.json') === libText);
