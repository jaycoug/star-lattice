// Usage: gjs -m schedflow.js <copy of the project>: round 6, stage 5: SCHEDULE's calendar on the
// copy's save (U14–U19). Five day columns of hour rows, Due dates in their columns, no retraining
// prompts; the list in the engine's order, parents included, complete ones on request; Plan time…,
// a day, hours → blocks spread over the day and saved; the gap setting; dragging a block (and a
// refused overlap); ×; a click opens its screen, where completing it drops its later blocks, in
// one undo step with the completion; ← → and Today.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/');
let hash = '#schedule';
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
const state = E.syncArrangements(loaded.state, E.optionsFrom(content));   // round 16: as the app opens it
const now = Math.floor(Date.now() / 60000) * 60000;
const ev = E.derive(state, { ...E.optionsFrom(content), share: loaded.share, now });
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const btn = (label, root = app) => root?.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const press = async el => { el.fire('click'); await tick(450); };   // past the 0.4 s autosave
const saved = () => E.normalizeSave(JSON.parse(read('saves/outlook.json')));
const cols = () => app.all(n => cls(n, 'sch-col'));
const bodyOf = col => col.find(n => cls(n, 'sch-col-body'));
const blocksIn = col => col.all(n => cls(n, 'sch-block'));
const rows = () => app.all(n => cls(n, 'sch-row'));
const rowOf = d => rows().find(r => text(r.find(n => cls(n, 'sch-name'))) === (state.dots[d].name || 'Unnamed star-dot'));
const today = E.dayOf(now);
const plus = n => { const d = new Date(today); d.setDate(d.getDate() + n); return d.getTime(); };
const ymd = day => { const d = new Date(day); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// U14: the calendar.
report('five day columns, today first', cols().length === 5 && text(cols()[0]).startsWith('Today') && cols()[0].dataset.day === String(today));
report('rows for each hour from 6 a.m. to 10 p.m.', app.all(n => cls(n, 'sch-hour')).length === 16 && text(app.all(n => cls(n, 'sch-hour'))[0]) === '6 a.m.' && text(app.all(n => cls(n, 'sch-hour'))[15]) === '9 p.m.');
const dueCount = day => [...E.index(state).dot.keys()].filter(d => state.dots[d].props.due === ymd(day)).length;
report('each day’s Due dates are marked in its column', cols().every((c, i) => c.all(n => cls(n, 'sch-due')).length === dueCount(plus(i))), cols().map(c => c.all(n => cls(n, 'sch-due')).length).join(','));
report('no retraining prompts (U19)', !/stale|not done yet|retrain/i.test(text(app.find(n => cls(n, 'schedule')))));

// U15: the list, as All (round 7: the flat list; By star-dot is the default and is checked further down).
report('the list opens By star-dot (round 7)', app.all(n => cls(n, 'sch-tree-row')).length > 0 && cls(btn('By star-dot'), 'on'));
await press(btn('All'));
const list = E.scheduleList(state, ev, { now });
report('the list has every incomplete star-dot on the map, in the engine’s order', rows().length === list.length
  && list.slice(0, 8).every((e, i) => text(rows()[i].find(n => cls(n, 'sch-name'))) === (state.dots[e.dot].name || 'Unnamed star-dot')), `${rows().length} rows`);
report('parents are listed too', list.some(e => ev.children(e.dot).length > 0));
const doneCount = E.scheduleList(state, ev, { now, showComplete: true }).length;
const showDone = app.find(n => cls(n, 'sch-show-done')).find(n => n.tagName === 'INPUT');
showDone.checked = true; showDone.fire('change'); await tick(50);
report('Show complete adds the complete ones', rows().length === doneCount, `${list.length} → ${rows().length}`);
showDone.checked = false; app.find(n => cls(n, 'sch-show-done')).find(n => n.tagName === 'INPUT').fire('change', { target: { checked: false } }); await tick(50);

// U16: Plan time… → a day → hours → Place.
const pick = list.find(e => !ev.children(e.dot).length && state.dots[e.dot].role === 'check' && ev.kiteOpen(E.index(state).dot.get(e.dot).kite))?.dot;
report('a terminal ○ star-dot to plan (for the next steps)', !!pick, state.dots[pick]?.name);
await press(btn('Plan time…', rowOf(pick)));
report('Plan time… asks for a time; the columns and their headers take a click (P5)', text(app.find(n => cls(n, 'sch-plan'))).includes('Click a time') && cols().every(c => cls(bodyOf(c), 'placing') && cls(c.find(n => cls(n, 'sch-col-head')), 'placing')));
// P5: one click on a 15-minute slot places a 1-hour block there.
{
  const day3 = plus(3);
  const col3 = () => cols().find(c => c.dataset.day === String(day3));
  const free = !saved().state.blocks.some(b => E.dayOf(b.start) === day3 && E.minuteOf(b.start) < 10 * 60 + 15 && E.minuteOf(b.start) + b.minutes > 9 * 60 + 15);
  bodyOf(col3()).fire('click', { clientY: 44 * 3.3 });   // 3.3 hours below 6 a.m.: the 9:15 slot
  await tick(450);
  const placed = saved().state.blocks.filter(b => b.dot === pick && E.dayOf(b.start) === day3);
  report('P5: then one click on the calendar places a 1-hour block at that 15-minute slot (saved), and the planner closes', !free || (placed.length === 1 && E.minuteOf(placed[0].start) === 9 * 60 + 15 && placed[0].minutes === 60 && !app.find(n => cls(n, 'sch-plan'))),
    placed.map(b => E.minuteOf(b.start)).join());
  if (placed.length) { doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450); }
  report('…undoable', saved().state.blocks.filter(b => b.dot === pick && E.dayOf(b.start) === day3).length === 0);
  await press(btn('Plan time…', rowOf(pick)));
}
const tomorrow = plus(1);
const col = () => cols().find(c => c.dataset.day === String(tomorrow));
const busy = saved().state.blocks.filter(b => E.dayOf(b.start) === tomorrow).length;
await press(col().find(n => cls(n, 'sch-col-head')));
report('a day’s header, then how many hours', text(app.find(n => cls(n, 'sch-plan'))).includes('1 hour') && cls(col(), 'chosen'));
await press(btn('+', app.find(n => cls(n, 'sch-plan'))));
await press(btn('+', app.find(n => cls(n, 'sch-plan'))));
await press(btn('Place', app.find(n => cls(n, 'sch-plan'))));
let mine = () => saved().state.blocks.filter(b => b.dot === pick && E.dayOf(b.start) === tomorrow);
const times = () => mine().map(b => E.minuteOf(b.start));
report('Place spreads three 1-hour blocks over the day (saved)', mine().length === 3 && (busy || times().join() === [555, 810, 1065].join()), times().map(m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`).join(' '));
report('they show in its column, with the star-dot’s name, and the planner closes', blocksIn(col()).length === busy + 3 && text(col()).includes(state.dots[pick].name) && !app.find(n => cls(n, 'sch-plan')));

// The gap setting.
await press(btn('60 min'));
report('the gap setting is saved with the save', saved().gap === 60 && cls(btn('60 min'), 'on'));
await press(btn('30 min'));

// U17: drag, a refused overlap, ×.
const elOf = id => blocksIn(col()).find(n => n.dataset.block === id);
const [b1, b2] = mine();
const drag = async (el, dy) => { el.fire('pointerdown', { button: 0, pointerId: 1, clientY: 100 }); el.fire('pointermove', { pointerId: 1, clientY: 100 + dy }); el.fire('pointerup', { pointerId: 1, clientY: 100 + dy }); await tick(450); };
await drag(elOf(b1.id), 44);                                      // one hour down
report('dragging a block moves it within its day, snapped (saved)', E.minuteOf(saved().state.blocks.find(b => b.id === b1.id).start) === E.minuteOf(b1.start) + 60);
await drag(elOf(b2.id), -((E.minuteOf(b2.start) - E.minuteOf(b1.start) - 60) / 60 * 44));   // onto the first
report('a drop onto another block is refused, with a reason', saved().state.blocks.find(b => b.id === b2.id).start === b2.start && /overlap/.test(text(els.toast ?? doc)));
const third = mine()[2];
await press(elOf(third.id).find(n => cls(n, 'sch-block-x')));
report('× removes a block (saved)', mine().length === 2 && !elOf(third.id));

// A click opens its screen; completing it there drops its later blocks (U18), in one undo step.
const first = elOf(mine()[0].id);
first.fire('pointerdown', { button: 0, pointerId: 1, clientY: 0 }); first.fire('pointerup', { pointerId: 1, clientY: 0 }); await tick(50);
const sheet = () => app.find(n => cls(n, 'sds-sheet'));
report('clicking a block opens its star-dot’s screen, editable', !!sheet() && text(sheet()).includes(state.dots[pick].name) && !!sheet().find(n => cls(n, 'editable')));
await press(btn('Ignite', sheet()));
report('completing it there drops its later blocks (saved)', mine().length === 0 && saved().state.dots[pick].ignitedAt != null);
await press(app.find(n => cls(n, 'sds-sheet-close')));
report('and the calendar no longer shows them', !text(col()).includes(state.dots[pick].name));
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
report('one undo brings back the completion and its blocks together', mine().length === 2 && saved().state.dots[pick].ignitedAt === state.dots[pick].ignitedAt);

// ← → and Today.
await press(btn('→'));
report('→ shows the next five days', cols()[0].dataset.day === String(plus(5)));
await press(btn('Today'));
report('Today comes back', cols()[0].dataset.day === String(today));

// Round 7 (V11): By star-dot: the central star's star-dots with their branches rolled up, ▸ one level at a time.
await press(btn('By star-dot'));
const tops = E.scheduleLevel(state, ev, null, { now });
const treeRows = () => app.all(n => cls(n, 'sch-tree-row'));
const nameOf = r => text(r.find(n => cls(n, 'sch-name')));
report('By star-dot lists the central star’s star-dots, in the engine’s order', treeRows().length === tops.length
  && tops.every((e, i) => nameOf(treeRows()[i]) === (state.dots[e.dot].name || 'Unnamed star-dot')), `${treeRows().length} rows`);
const withKids = tops.find(e => e.children > 0);
const rowFor = d => treeRows().find(r => r.dataset.dot === d);
const rolled = tops.find(e => e.due && e.dueFrom !== e.dot);
report('a parent shows its branch’s soonest own Due date, and whose it is', !rolled || text(rowFor(rolled.dot)).includes(`(${state.dots[rolled.dueFrom].name || 'unnamed'})`), rolled ? `${state.dots[rolled.dot].name}: ${rolled.due}` : 'none rolled up on this save');
await press(rowFor(withKids.dot).find(n => cls(n, 'sch-toggle')));
const level = E.scheduleLevel(state, ev, withKids.dot, { now });
const at = treeRows().findIndex(r => r.dataset.dot === withKids.dot);
report('▸ shows its children right under it, one level down, in the engine’s order', treeRows().length === tops.length + level.length
  && level.every((e, i) => treeRows()[at + 1 + i]?.dataset.dot === e.dot), `${withKids.children} children`);
report('…each with its own ▸ if it has children', level.filter(e => e.children > 0).every(e => !!rowFor(e.dot).find(n => cls(n, 'sch-toggle') && n.tagName === 'BUTTON')));
await press(rowFor(withKids.dot).find(n => cls(n, 'sch-toggle')));
report('▾ hides them again', treeRows().length === tops.length);
const inheritedChild = Object.values(state.dots).find(d => E.index(state).dot.has(d.id) && !d.props.due && ev.prop(d.id, 'due') && !ev.children(d.id).length && ev.effective(d.id).status !== 'ignited');
// Open its branch from the top, then look at its row.
if (inheritedChild) {
  const chain = [];
  for (let x = E.parentOf(state, inheritedChild.id); x; x = E.parentOf(state, x)) chain.unshift(x);
  for (const x of chain) { const toggle = rowFor(x)?.find(n => cls(n, 'sch-toggle') && n.tagName === 'BUTTON'); if (toggle && toggle.attrs['aria-expanded'] !== 'true') await press(toggle); }
}
const gray = inheritedChild && rowFor(inheritedChild.id)?.find(n => cls(n, 'sch-due-at') && cls(n, 'inherited'));
report('a child without a Due date of its own shows its parent’s in gray, marked inherited', !inheritedChild || (!!gray && text(gray).includes('inherited')), inheritedChild ? `${state.dots[inheritedChild.id].name}: ${gray ? text(gray) : 'no gray date'}` : 'none on this save');
for (const r of treeRows()) { const toggle = r.find(n => cls(n, 'sch-toggle') && n.tagName === 'BUTTON'); if (toggle?.attrs['aria-expanded'] === 'true') await press(toggle); }
await press(rowFor(withKids.dot).find(n => n.tagName === 'BUTTON' && text(n) === 'Plan time…'));
report('Plan time… works on a parent’s row too', text(app.find(n => cls(n, 'sch-plan'))).includes(state.dots[withKids.dot].name));
await press(btn('Cancel', app.find(n => cls(n, 'sch-plan'))));

// ---- P5: the day's hours (Design › Look › Schedule hours) ----
location.hash = '#design/look'; await tick(150);
const hourSel = which => app.find(n => n.tagName === 'SELECT' && n.dataset?.hour === which);
report('Design › Look has Schedule hours: from 6 a.m. to 10 p.m. by default', !!hourSel('start') && text(app).includes('Schedule hours')
  && hourSel('start').all(n => n.tagName === 'OPTION' && n.attrs.selected != null).map(text).join() === '6 a.m.' && hourSel('end').all(n => n.tagName === 'OPTION' && n.attrs.selected != null).map(text).join() === '10 p.m.');
hourSel('start').fire('change', { target: { value: '8' } }); await tick(450);
hourSel('end').fire('change', { target: { value: '18' } }); await tick(450);
report('a new range is saved with the content set', JSON.stringify(JSON.parse(read('content/life.json')).rules.day) === JSON.stringify({ start: 8, end: 18 }));
location.hash = '#schedule'; await tick(150);
const hourRows = app.all(n => cls(n, 'sch-hour')).map(text);
report('the calendar then runs 8 a.m. to 6 p.m.', hourRows.length === 10 && hourRows[0] === '8 a.m.' && hourRows[9] === '5 p.m.', hourRows.join(','));

// ---- P5: the player's access (Design › Player › Schedule) ----
const setAccess = async v => { location.hash = '#design/player'; await tick(150); await press(app.find(n => n.dataset?.player === 'schedule' && n.dataset.value === v)); };
await setAccess('view');
location.hash = '#play/schedule'; await tick(150);
const anyBlock = () => app.find(n => cls(n, 'sch-block'));
report('View only: Play mode offers the Schedule view, as a calendar alone (no list, gap or ×)', hash === '#play/schedule' && !!app.find(n => cls(n, 'sch-cal')) && !app.find(n => cls(n, 'sch-side')) && !app.find(n => cls(n, 'sch-gap')) && !app.find(n => cls(n, 'sch-block-x')));
if (anyBlock()) {
  await press(anyBlock());
  report('…where a block opens its star-dot’s screen, fixed', !!sheet() && !sheet().find(n => cls(n, 'editable')));
  await press(app.find(n => cls(n, 'sds-sheet-close')));
}
await setAccess('full');
location.hash = '#play/schedule'; await tick(150);
report('Full editing: the list, the gap and × too', !!app.find(n => cls(n, 'sch-side')) && !!app.find(n => cls(n, 'sch-gap')));
await setAccess('none');
location.hash = '#play/schedule'; await tick(150);
report('Hidden: Play mode doesn’t offer it', hash === '#play', hash);
