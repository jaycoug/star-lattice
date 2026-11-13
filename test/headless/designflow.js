// Usage: gjs -m designflow.js <copy of the project>: kite designs on PLAY (U9–U12) on the copy's save.
// Design… on a kite's card opens the shared editor over PLAY; a stroke paints its category's design
// (saved in the save, round 8, X2; one undo step); Designs in the toolbar paints every kite of that
// category with it; Lines paint segments in the Paint tones (X3: Clear cuts a gap); This kite only
// gives one kite its own design, and Use the category's design drops it; Import… takes the Kite
// Designer's file; Esc closes.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/');
let hash = '#star';   // Edit mode: the designer's whole kite designer (Play mode's is the category's only, 9b)
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
const E = await import(`file://${ROOT}/shared/engine/index.js`);
const content = E.normalizeContent(JSON.parse(read('content/life.json')));
const loaded = E.normalizeSave(JSON.parse(read('saves/outlook.json')));
const state = loaded.state;
const ev = E.derive(state, { ...E.optionsFrom(content), share: loaded.share, now: Math.floor(Date.now() / 60000) * 60000 });
// The developer's own designs may cover every category: on this throwaway copy, clear the chosen
// kite's category design before the app loads, so the steps start from nothing (in the save, or, for
// a save from before round 8, in its content set, which the save takes them from once).
const pickKite = E.centralStar(state).kites.find(x => ev.kiteOpen(x) && state.kites[x].color != null && !state.kites[x].design && state.kites[x].dots.some(Boolean));   // round 14: an empty kite can't be selected (Z14)
{
  const c0 = state.kites[pickKite].color;
  const rawContent = JSON.parse(read('content/life.json'));
  if (Array.isArray(rawContent.designs) && rawContent.designs[c0]) {
    rawContent.designs[c0] = null;
    content.legacyDesigns[c0] = null;
    GLib.file_set_contents(`${ROOT}/content/life.json`, JSON.stringify(rawContent, null, 2));
  }
  const rawSave = JSON.parse(read('saves/outlook.json'));
  if (Array.isArray(rawSave.designs) && rawSave.designs[c0]) {
    rawSave.designs[c0] = null;
    loaded.designs[c0] = null;
    GLib.file_set_contents(`${ROOT}/saves/outlook.json`, JSON.stringify(rawSave, null, 2));
  }
}
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const map = () => app.find(n => cls(n, 'sl-map'));
const btn = (label, root = app) => root?.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const tap = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(50); };
const press = async el => { el.fire('click'); await tick(450); };   // past the 0.4 s autosave
const sheet = () => app.find(n => cls(n, 'design-sheet'));
const designs = () => JSON.parse(read('saves/outlook.json')).designs ?? [];   // X2: the save's
const kiteOf = k => JSON.parse(read('saves/outlook.json')).state.kites[k];
const groups = () => map().all(n => cls(n, 'kite-design'));
const stroke = async (el) => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(450); };
const region = id => sheet().find(n => cls(n, 'kd-region') && n.dataset.region === String(id));

// An open central kite, and the other open kites of its category on the map.
const central = E.centralStar(state);
// A central kite whose category starts with no design (cleared on the copy above if it had one).
const k = pickKite;
const ci = state.kites[k].color;
const cat = content.categories[ci];
const sameCat = ev.shownStars().flatMap(s => state.stars[s].kites).filter(x => ev.kiteOpen(x) && state.kites[x].color === ci && state.kites[x].dots.some(Boolean));   // an empty kite is an outline, no design (Z14)

const shownKites = ev.shownStars().flatMap(s => state.stars[s].kites).filter(x => ev.kiteOpen(x) && state.kites[x].color != null && state.kites[x].dots.some(Boolean));   // round 14: empty kites are outlines (Z14)
const catDesigns = loaded.designs ?? content.legacyDesigns ?? [];
const designedAlready = shownKites.filter(x => state.kites[x].design || catDesigns[state.kites[x].color]).length;
await press(btn('Designs'));
report('Designs on: only the kites that have a design are painted (an empty kite stays an outline)', groups().length === designedAlready, `${designedAlready} already designed`);
await tap(map().all(n => n.dataset?.hit === 'kite').find(n => n.dataset.id === k));
await press(app.find(n => cls(n, 'play-card')).find(n => n.tagName === 'BUTTON' && n.attrs['aria-label'] === 'Design…'));
report('🖌 (Design…) on a kite’s card opens the editor over PLAY, on its category’s design', !!sheet() && text(sheet()).includes(`${cat.name}’s design`) && sheet().all(n => cls(n, 'kd-region')).length === 64);
// A drag across two regions: pointerdown on one, a move onto another, pointerup (one editor throughout).
{
  const [a, b] = [region(0), region(2)];
  const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 };
  a.fire('pointerdown', e); b.fire('pointermove', e); b.fire('pointerup', e); await tick(450);
}
const d1 = designs()[ci];
report('a stroke paints its category’s design (saved in the save, X2), with the symmetry', !!d1 && d1.fills['0'] === 'dark' && d1.fills['2'] === 'dark', JSON.stringify(d1?.fills));
report(`with Designs on, every open ${cat.name} kite shows it (${sameCat.length})`, groups().length === designedAlready + sameCat.length);
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
report('one stroke (a drag across regions) is one undo step', designs()[ci] === null && groups().length === designedAlready);
doc.fire('keydown', { key: 'y', ctrlKey: true, target: doc }); await tick(450);
report('redo brings it back', designs()[ci]?.fills['0'] === 'dark' && groups().length === designedAlready + sameCat.length);

await press(btn('Lines', sheet()));
const KD = await import(`file://${ROOT}/shared/kiteDesign.js`);
report('Lines mode has Fill’s Paint choices (X3)', ['Ink', 'Light', 'Dark', 'Clear'].every(l => !!btn(l, sheet())));
const edges = sheet().all(n => cls(n, 'kd-hit'));
const [edge, edge2] = [edges[0], edges.find(n => n.dataset.edge !== edges[0].dataset.edge && !KD.mirrors('edge', edges[0].dataset.edge, 'across').includes(n.dataset.edge))];
const edgeEl = e => sheet().find(n => cls(n, 'kd-hit') && n.dataset.edge === e.dataset.edge);   // the editor redraws after each stroke
await stroke(edgeEl(edge));
report('a line takes the Paint tone (Dark, saved)', designs()[ci]?.lines[edge.dataset.edge] === 'dark', JSON.stringify(designs()[ci]?.lines));
const lineStroke = map().find(n => cls(n, 'kite-design'))?.find(n => n.tagName === 'PATH' && n.attrs.stroke);
report('…drawn on the map in that tone of the kite’s (progress) color', /^color-mix\(in oklab, .*#000000 55%\)$/.test(lineStroke?.attrs.stroke ?? ''), lineStroke?.attrs.stroke);
await press(btn('Clear', sheet()));
await stroke(edgeEl(edge2));
report('a Clear line cuts a gap through the design (a mask on the map)', designs()[ci]?.lines[edge2.dataset.edge] === 'none' && !!map().find(n => cls(n, 'kite-design'))?.find(n => n.tagName === 'MASK'));
await stroke(edgeEl(edge2));
report('stroking a line again in its own tone takes it away', designs()[ci]?.lines[edge2.dataset.edge] === undefined && designs()[ci]?.lines[edge.dataset.edge] === 'dark');
await press(btn('Dark', sheet()));

await press(btn('This kite only', sheet()));
await press(btn('Fill', sheet()));
await press(btn('Light', sheet()));
await stroke(region(20));
report('This kite only: painting gives this kite its own design (saved in the save), from the category’s', kiteOf(k).design?.fills['20'] === 'light' && kiteOf(k).design?.fills['0'] === 'dark');
report('the category’s design is unchanged', !designs()[ci].fills['20']);
const tonesOf = x => groups().find(g => g.dataset.kite === x)?.all(n => n.tagName === 'PATH' && n.attrs.fill && n.attrs.fill !== 'none').length;
report('the map paints its own design on it (three tones), the category’s on the others (two)', tonesOf(k) === 3 && sameCat.filter(x => x !== k).every(x => tonesOf(x) === 2), `${tonesOf(k)} vs ${sameCat.filter(x => x !== k).map(tonesOf)}`);
const others = sameCat.filter(x => x !== k);
report('other kites of the category keep the category’s design', others.every(x => !kiteOf(x).design));
await press(btn('Use the category’s design', sheet()));
report('Use the category’s design drops its own', kiteOf(k).design === null);

// Import: the Kite Designer's Export file, matched by category name.
const next = content.categories[(ci + 1) % 6];
const exported = { format: 'star-lattice-kite-designs', version: 1, grid: 'halves-1', designs: [{ category: next.name, design: { format: 'star-lattice-kite-design', version: 1, grid: 'halves-1', fills: { 3: 'light' }, lines: [] } }] };
const input = sheet().find(n => n.tagName === 'INPUT' && n.attrs.type === 'file');
input.fire('change', { target: { files: [{ text: async () => JSON.stringify(exported) }] } });
// The file is read asynchronously, then autosaved 0.4 s later: wait for the write (up to 2 s; one
// run in round 9's stage 1 read the save just before it landed).
for (let i = 0; i < 10 && designs()[(ci + 1) % 6]?.fills['3'] !== 'light'; i++) await tick(200);
report('Import… puts the Kite Designer’s designs on the categories of the same name', designs()[(ci + 1) % 6]?.fills['3'] === 'light');

doc.fire('keydown', { key: 'Escape', target: doc }); await tick(50);
report('Esc closes the designer', !sheet());
await press(btn('Solid'));
report('Solid: kites drawn in their color only, designs or not', groups().length === 0);

// Round 8 (X5): PLAY outlines no star that isn't on the map.
report('PLAY outlines no star that isn’t on the map', map().all(n => n.dataset?.hit === 'star').length === 0);
