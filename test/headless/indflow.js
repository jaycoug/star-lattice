// Usage: gjs -m indflow.js <copy of the project>: round 9, stage 4 (Y6, Y8): Star-dots: Independent
// on the copy's outlook, a full hierarchy (49 stars, 132 star-dots). Under Independent
// every tab opens and reads the lists' placement only (the audit of every view that asks where a
// star-dot is or what its children are), an item works on PLAY, MATERIALS and SCHEDULE,
// and switching back to Hierarchical leaves every star-dot where it was (round 16: the lists hold the tree’s star-dots, and a new item gets a tree place too).
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const SAVE = 'outlook';
const { els, doc, resize } = install(ROOT, '/app/', { save: SAVE });
let hash = '#play';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
const E = await import(`file://${ROOT}/shared/engine/index.js`);
// The save in use may already have lists (the developer tried Independent on it, 2026-11-07): the
// steps below start from none, so the copy's lists and independent stars are cleared first.
const listsWere = (() => {
  const raw = JSON.parse(read(`saves/${SAVE}.json`));
  const items = Object.values(raw.state.lists ?? {}).reduce((n, l) => n + l.length, 0);
  const ind = Object.values(raw.state.stars).filter(s => s.independent).map(s => s.id);
  if (!items && !ind.length) return '';
  // Round 16: the lists hold the tree's star-dots too; only items with no kite slot are list-only (the sync re-lists the rest).
  const slotted = new Set(Object.values(raw.state.kites).flatMap(k => k.dots.filter(Boolean)));
  const listed = new Set(Object.values(raw.state.lists ?? {}).flat().filter(d => !slotted.has(d)));
  let s = E.removeStars(raw.state, ind);
  s = { ...s, lists: {}, dots: Object.fromEntries(Object.entries(s.dots).filter(([id]) => !listed.has(id))) };
  GLib.file_set_contents(`${ROOT}/saves/${SAVE}.json`, JSON.stringify({ ...raw, state: s }, null, 2));
  return `the save in use has ${items} listed items and ${ind.length} independent stars: cleared on the copy`;
})();
const rawSave = JSON.parse(read(`saves/${SAVE}.json`));
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const map = () => app.find(n => cls(n, 'sl-map'));
const hits = kind => map().all(n => n.dataset?.hit === kind);
const go = async h => { location.hash = h; await tick(100); resize(); await tick(50); };
const btn = (label, root = app) => root?.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const press = async el => { el.fire('click', { preventDefault() {} }); await tick(60); };
const saved = async () => { await tick(450); return E.normalizeSave(JSON.parse(read(`saves/${SAVE}.json`))).state; };
const rules = () => JSON.parse(read(`content/${rawSave.content}.json`)).rules;
const pick = async label => { app.all(n => n.tagName === 'LABEL' && text(n).startsWith(label))[0].find(n => n.tagName === 'INPUT').fire('change'); await tick(60); };
const tapEl = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(60); };
const sheet = () => app.find(n => cls(n, 'sds-sheet'));
const broken = () => /Couldn’t|TypeError|undefined/.test(text(app));

const before = await saved();


const kitesBefore = hits('kite').length;
report(`${SAVE} opens Hierarchical, its stars on the map`, rules().stardots !== 'independent' && kitesBefore > 6, [`${kitesBefore} kites`, listsWere].filter(Boolean).join('; '));

await go('#govern/stars');
await pick('Independent'); await tick(450);
report('Star-dots: Independent (saved in its content set)', rules().stardots === 'independent');
await go('#play'); await tick(400);
// Round 16: one set of star-dots, two arrangements. Each list holds its category's tree star-dots,
// in tree order (the central kite's own first), so the central star shows the same four per kite.
const opts = () => E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${rawSave.content}.json`))));
let st = E.syncArrangements(await saved(), opts());   // as the app opened it (written with the next change)
const central = E.centralStar(st);
const trees = E.treeOrder(st, opts());
report('round 16: under Independent each category’s list is its tree star-dots, in tree order', central.kites.every(k => JSON.stringify(E.listOf(st, k)) === JSON.stringify(trees.get(k))),
  central.kites.map(k => E.listOf(st, k).length).join(','));
const centralDots = central.kites.flatMap(k => before.kites[k].dots.filter(Boolean));
report('PLAY: the central star’s kites hold the same star-dots as under Hierarchical, nothing beyond it', centralDots.every(d => hits('dot').some(n => n.dataset.id === d) || !map().all(n => n.dataset?.id === d).length) && !broken(),
  `${centralDots.length} central star-dots`);
for (const tab of ['#rearrange', '#schedule', '#govern/board', '#govern/questions', '#govern/look', '#play']) {
  await go(tab);
  if (broken()) report(`${tab} opens without errors`, false, text(app).slice(0, 120));
}
report('every tab opens under Independent', !broken());
await go('#rearrange');
const sections = app.all(n => cls(n, 'list-section'));
report('MATERIALS: a list per category, no tree or shelf', sections.length === 6 && !app.find(n => cls(n, 'tree')) && !app.find(n => cls(n, 'shelf-section')));
const k0 = sections[0].dataset.kite;
const n0 = E.listOf(st, k0).length;
const add = async name => { const i = app.find(n => cls(n, 'list-section') && n.dataset.kite === k0).find(n => cls(n, 'list-add-input')); i.value = name; i.fire('keydown', { key: 'Enter' }); await tick(60); };
await add('Walk 10k steps'); await add('Stretch'); await add('Sleep by 11'); await add('Plan the week'); await add('Cook twice');
st = await saved();
const items = E.listOf(st, k0).slice(n0);
report('five items added at the end of the first category’s list', items.length === 5 && items.map(d => st.dots[d].name).join() === 'Walk 10k steps,Stretch,Sleep by 11,Plan the week,Cook twice', `${n0} → ${E.listOf(st, k0).length}`);
const treeNow = new Set(E.treeOrder(st, opts()).get(k0));
report('…each also has a place in its category’s tree (round 16)', items.every(d => treeNow.has(d)));
const row0 = () => app.find(n => cls(n, 'list-item') && n.dataset.item === items[0]);
await press(btn('↗', row0()));
report('an item’s screen opens: no children, no Add a child…, nothing inherited, no Retire (Z20)', !!sheet() && text(sheet()).includes('stands alone') && !sheet().find(n => cls(n, 'sds-add-child')) && !btn('Retire', sheet()));
await press(btn('Ignite', sheet()));
await press(app.find(n => cls(n, 'sds-sheet-close')));
st = await saved();
report('Ignite completes it (saved)', !!st.dots[items[0]].ignitedAt);
await go('#schedule');
report('SCHEDULE opens, without the new items (not on the map yet)', !broken() && app.all(n => cls(n, 'sch-row')).every(r => !items.some(d => text(r).includes(st.dots[d].name))));

await go('#govern/stars');
await pick('Hierarchical');
await go('#play'); await tick(400);
st = await saved();
const where = s => JSON.stringify(Object.keys(before.dots).map(d => [d, E.index(s).dot.get(d) ?? null]));
report('back to Hierarchical: every star-dot where it was', where(st) === where(before) && hits('kite').length >= kitesBefore, `${hits('kite').length} kites`);
report('…and the five new items in the tree, in the first category', items.every(d => new Set(E.treeOrder(st, opts()).get(k0)).has(d)));
await go('#rearrange');
report('…MATERIALS shows the tree again', !!app.find(n => cls(n, 'tree')));
for (const tab of ['#schedule', '#govern', '#play']) await go(tab);
report('…and every tab still opens', !broken());
