// Usage: gjs -m palettes.js <copy of the project>: the palette menu in GOVERN's Categories. The built-in
// palettes are there in every browser; picking one recolors the categories (undoable); New palette…
// builds and names one of your own (kept in this browser, not the files), ✎ edits it, × removes it.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/');
let hash = '#govern/look';   // the palette menu is in GOVERN › Look's Categories panel (round 7; subtab, round 9)
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = () => {};
const read = f => JSON.parse(readFile(ROOT, f));   // a content set as the open save plays it (P10)
const BUILT_IN = ['fizzbolt', 'coastglow', 'gladetrail', 'cloudblush', 'mothchalk'];
const PREFS = 'star-lattice:prefs';
localStorage.setItem(PREFS, JSON.stringify({ last: 'outlook', palettes: { current: ['#000000'], broken: ['red'], 'Old one': ['#010101', '#020202', '#030303', '#040404', '#050505', '#060606'] } }));
const original = read('content/life.json').categories.map(c => c.color);
// The palette the content set uses now (the developer recolors it): a built-in one by its colors, else "current".
const { DEFAULT_PALETTES } = await import(`file://${ROOT}/app/js/model.js`);
const inUse = Object.keys(DEFAULT_PALETTES).find(n => DEFAULT_PALETTES[n].join() === original.map(c => c.toLowerCase()).join()) ?? 'current';
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const options = () => app.all(n => cls(n, 'palette-option') && !cls(n, 'palette-new'));
const names = () => options().map(o => text(o.find(n => cls(n, 'palette-name'))));
const active = () => options().filter(o => cls(o, 'current')).map(o => text(o.find(n => cls(n, 'palette-name'))));
const option = name => options().find(o => text(o.find(n => cls(n, 'palette-name'))) === name);
const rowOf = name => option(name)?.parent;
const colors = () => read('content/life.json').categories.map(c => c.color);
const prefs = () => JSON.parse(localStorage.getItem(PREFS) ?? '{}');
const editor = () => app.find(n => cls(n, 'palette-editor'));
const fill = async (name, first) => {
  editor().find(n => cls(n, 'palette-name-input')).value = name;
  if (first) editor().find(n => n.tagName === 'INPUT' && n.attrs.type === 'color').value = first;
  editor().fire('submit');
  await tick(500);   // past the 0.4 s autosave
};

report('the menu lists the built-in palettes and a kept one of yours', BUILT_IN.every(n => names().includes(n)) && names().includes('Old one'), names().join(', '));
report('kept junk is dropped ("current", a palette that isn\'t six colors)', !names().includes('broken') && names().filter(n => n === 'current').length === 0);
report('the colors in use are named by the palette they match', active().join() === inUse, active().join());

option('coastglow').fire('click');
await tick(500);
report('picking a palette recolors the categories (written to the content set)', colors().join() === ['#7e47ff', '#e800d4', '#ff009a', '#ff5362', '#ff962f', '#ffcd05'].join(), colors().join());
report('…and marks it in the menu', active().join() === 'coastglow', active().join());
doc.fire('keydown', { key: 'z', ctrlKey: true });
await tick(500);
report('undo brings the colors back, and the menu follows them', colors().join() === original.join() && active().join() === inUse, active().join());

app.find(n => cls(n, 'palette-new')).fire('click');
const pickers = () => editor().all(n => n.tagName === 'INPUT' && n.attrs.type === 'color');
report('New palette… opens the editor, one color per category, starting from the colors in use',
  editor().hidden === false && pickers().length === 6 && pickers().map(p => p.value).join() === original.join(), pickers().map(p => p.value).join());
report('…labeled by the categories', read('content/life.json').categories.every(c => text(editor()).includes(c.name)));
await fill('', null);
report('a palette needs a name', !names().includes('') && /name/i.test(text(editor().find(n => cls(n, 'palette-problem')))), text(editor().find(n => cls(n, 'palette-problem'))));
await fill('mothchalk', null);
report('a built-in name is refused', /built-in/.test(text(editor().find(n => cls(n, 'palette-problem')))) && prefs().palettes.mothchalk === undefined);

app.find(n => cls(n, 'palette-new')).fire('click');
await fill('  Midnight  ', '#123456');
report('saving keeps it, trimmed, and uses it', names().includes('Midnight') && active().join() === 'Midnight' && colors()[0] === '#123456', active().join());
report('this browser keeps only your own palettes', Object.keys(prefs().palettes).sort().join() === 'Midnight,Old one' && prefs().palette === undefined, Object.keys(prefs().palettes).join());
report('built-in palettes have no edit or remove buttons', !rowOf('fizzbolt').find(n => cls(n, 'remove-btn')) && rowOf('Midnight').all(n => cls(n, 'remove-btn')).length === 2);

rowOf('Midnight').find(n => cls(n, 'remove-btn') && text(n) === '✎').fire('click');
report('✎ opens it in the editor', editor().find(n => cls(n, 'palette-name-input')).value === 'Midnight' && pickers()[0].value === '#123456');
await fill('Midnight', '#abcdef');
report('saving under the same name replaces it', names().filter(n => n === 'Midnight').length === 1 && prefs().palettes.Midnight[0] === '#abcdef' && colors()[0] === '#abcdef');

rowOf('Midnight').find(n => cls(n, 'remove-btn') && text(n) === '×').fire('click');
await tick(500);
report('× removes it from the menu and this browser; its colors stay in use, listed as "current"',
  !names().includes('Midnight') && !prefs().palettes.Midnight && colors()[0] === '#abcdef' && active().join() === 'current', active().join());
