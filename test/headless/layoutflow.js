// Usage: node layoutflow.js <copy of the project>: P4, the star-dot screen's widgets. Five widgets
// in two columns: in Edit mode each can be dragged elsewhere or switched off, for every screen of
// the content set or (Its own layout) for one star-dot, until Reset; the checklist's strip adds an
// item with an attribute set and highlights it; Filter ▾ filters by kind or a search; Play mode
// shows the designer's arrangement, without the tools.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
{   // The player may open the Tree view here, to reach a screen in Play mode.
  const c = JSON.parse(read('content/life.json'));
  GLib.file_set_contents(`${ROOT}/content/life.json`, JSON.stringify({ ...c, player: { ...c.player, tree: true } }, null, 2));
}
const { els, doc, resize } = install(ROOT, '/app/');
let hash = '#tree';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
doc.documentElement = doc.createElement('html');
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const go = async h => { location.hash = h; await tick(100); resize(); await tick(50); };
const click = async el => { el.fire('click'); await tick(450); };
const sheet = () => app.find(n => cls(n, 'sds-sheet'));
const node = id => app.find(n => cls(n, 'tree-box') && n.dataset?.node === id);
const btn = (label, root = sheet()) => root?.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const columns = () => sheet().all(n => cls(n, 'sds-col')).map(c => c.all(n => cls(n, 'sds-widget')).map(w => w.dataset.widget));
const widget = id => sheet().find(n => cls(n, 'sds-widget') && n.dataset.widget === id);
const layout = () => JSON.parse(read('content/life.json')).layout;
const dotOf = id => JSON.parse(read('saves/outlook.json')).state.dots[id];
const drag = async (id, onto) => { widget(id).find(n => cls(n, 'sds-grip')).fire('dragstart', { dataTransfer: null }); onto.fire('drop'); await tick(450); };
const openScreen = async (kite, dot) => { await click(node(kite)); await click(node(dot).find(n => cls(n, 'tree-open'))); };
const closeSheet = () => click(app.find(n => cls(n, 'sds-sheet-close')));
const scope = id => sheet().find(n => n.tagName === 'INPUT' && n.dataset?.scope === id);
const pickScope = async id => { scope(id).fire('change'); await tick(450); };

await openScreen('k1', 'd10');
report('the screen shows five widgets in two columns: Checklist · Notes · Assessor | Attributes · Relevance Information', JSON.stringify(columns()) === JSON.stringify([['checklist', 'notes', 'assessor'], ['attributes', 'relevance']]), JSON.stringify(columns()));
report('Notes is a widget of its own, not inside the checklist', !!widget('notes') && !widget('checklist').find(n => cls(n, 'sds-notes')));
report('in Edit mode each widget has a grip and ×, and the bar says the layout is every screen’s', ['checklist', 'notes', 'assessor', 'attributes', 'relevance'].every(id => !!widget(id).find(n => cls(n, 'sds-grip')) && !!widget(id).find(n => cls(n, 'sds-widget-off')))
  && text(sheet().find(n => cls(n, 'sds-layout-bar'))).includes('Layout applies to: all star-dots this star-dot only') && scope('all').checked);

// ---- The content set's layout ----
await click(widget('notes').find(n => cls(n, 'sds-widget-off')));
report('× switches Notes off for every screen (saved with the content set)', !widget('notes') && JSON.stringify(layout()?.columns) === JSON.stringify([['checklist', 'assessor'], ['attributes', 'relevance']]), JSON.stringify(layout()?.columns));
await click(sheet().find(n => cls(n, 'sds-widget-on') && n.dataset.widget === 'notes'));
report('+ Notes switches it back on', !!widget('notes') && layout().columns.flat().includes('notes'));
await drag('assessor', widget('attributes'));
report('dragging the Assessor onto Attributes puts it there, above it', columns()[1].slice(0, 2).join() === 'assessor,attributes' && layout().columns[1][0] === 'assessor', JSON.stringify(columns()));
await drag('relevance', sheet().all(n => cls(n, 'sds-col-end'))[0]);
report('…and onto a column’s end, at the bottom of that column', columns()[0].at(-1) === 'relevance', JSON.stringify(columns()));

// ---- One star-dot's own layout ----
const shared = JSON.stringify(layout().columns);
await pickScope('own');
report('Layout applies to: this star-dot only gives it a copy (saved in the save)', JSON.stringify(dotOf('d10').layout?.columns) === shared && scope('own').checked && !scope('all').checked);
await click(widget('relevance').find(n => cls(n, 'sds-widget-off')));
report('a change now is this screen’s only: the content set keeps its layout', !widget('relevance') && JSON.stringify(layout().columns) === shared && !dotOf('d10').layout.columns.flat().includes('relevance'));
await closeSheet();
await openScreen('k1', 'd9');
report('another star-dot’s screen keeps the content set’s layout', JSON.stringify(columns()) === shared, JSON.stringify(columns()));
await closeSheet();
await openScreen('k1', 'd10');
await pickScope('all');
report('…and all star-dots puts the shared layout back on it', !dotOf('d10').layout && JSON.stringify(columns()) === shared);

// ---- The strip adds an item with an attribute; Filter ▾ ----
const before = Object.keys(JSON.parse(read('saves/outlook.json')).state.dots);
const stripBtn = id => widget('checklist').find(n => cls(n, 'sds-strip-btn') && n.dataset.add === id);
const before0 = Object.keys(JSON.parse(read('saves/outlook.json')).state.dots);
await click(stripBtn('plain'));
const plainOne = Object.keys(JSON.parse(read('saves/outlook.json')).state.dots).find(d => !before0.includes(d));
report('＋ at the top of the strip adds a plain star-dot, selected', !!plainOne && !!sheet().find(n => cls(n, 'sds-item') && cls(n, 'selected') && n.dataset.child === plainOne));
before.push(plainOne);
report('in Edit mode the checklist has a strip on its left: kinds, difficulties, money, travel, due date, free marks', !!stripBtn('box') && !!stripBtn('circle') && !!stripBtn('earn') && !!stripBtn('due'));
await click(stripBtn('due'));
const made = Object.keys(JSON.parse(read('saves/outlook.json')).state.dots).find(d => !before.includes(d));
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
report('clicking ⏱ adds an item with a due date (today), as a child of this star-dot', !!made && dotOf(made).props.due === today && JSON.parse(read('saves/outlook.json')).state.stars[dotOf('d10').branch].kites.some(k => JSON.parse(read('saves/outlook.json')).state.kites[k].dots.includes(made)));
const hl = sheet().find(n => cls(n, 'sds-attr-hl'));
report('…selected, with its Due field highlighted to fill in', !!sheet().find(n => cls(n, 'sds-item') && cls(n, 'selected') && n.dataset.child === made) && !!hl && text(hl).startsWith('Due'), hl ? text(hl) : 'none');
const rows = () => widget('checklist').all(n => cls(n, 'sds-item'));
const shown = () => rows().filter(r => !r.hidden).map(r => r.dataset.child);
const before2 = Object.keys(JSON.parse(read('saves/outlook.json')).state.dots);
await click(stripBtn('earn'));
const earner = Object.keys(JSON.parse(read('saves/outlook.json')).state.dots).find(d => !before2.includes(d));
report('$ adds one that earns money (its Financial Influence highlighted)', dotOf(earner)?.props.finance?.amount > 0 && /Financ/.test(text(sheet().find(n => cls(n, 'sds-attr-hl')) ?? { textContent: '' })));
const all = shown().length;
await click(widget('checklist').find(n => cls(n, 'sds-filter-option') && n.dataset.filter === 'earn'));
report('Filter ▾ › Earns money shows only the items that do', shown().join() === earner && text(widget('checklist').find(n => cls(n, 'sds-filter-btn'))).includes('Earns money'), `${shown().length} of ${all}`);
await click(widget('checklist').find(n => cls(n, 'sds-filter-option') && n.dataset.filter === 'earn'));
const search = widget('checklist').find(n => cls(n, 'sds-filter-search'));
const name = dotOf(rows()[0].dataset.child).name;
search.value = name; search.fire('input', { target: search });
report('…and its search box hides the rows that don’t match, in place', shown().length >= 1 && shown().length < all && rows().filter(r => !r.hidden).every(r => r.dataset.name.toLowerCase().includes(name.toLowerCase())), `${shown().length} of ${all} for “${name}”`);
search.value = ''; search.fire('input', { target: search });
await pickScope('own');
await click(widget('notes').find(n => cls(n, 'sds-widget-off')));   // For Play mode: only d10 is without Notes
await closeSheet();

// ---- Play mode: the designer's arrangement, without the tools ----
const designed = JSON.parse(JSON.stringify(layout().columns));
await go('#play/tree');
await openScreen('k1', 'd10');
report('Play mode shows this star-dot’s own layout (Notes off)', !widget('notes') && JSON.stringify(columns()) === JSON.stringify(dotOf('d10').layout.columns), JSON.stringify(columns()));
report('…with no grips, ×, layout bar or adding strip', !sheet().find(n => cls(n, 'sds-grip') || cls(n, 'sds-widget-off') || cls(n, 'sds-layout-bar') || cls(n, 'sds-strip')));
report('…but with Filter ▾', !!widget('checklist').find(n => cls(n, 'sds-filter-drop')));
await closeSheet();
await openScreen('k1', 'd9');
report('…and another star-dot’s screen the shared layout', JSON.stringify(columns()) === JSON.stringify(designed) && !!widget('notes'), JSON.stringify(columns()));
