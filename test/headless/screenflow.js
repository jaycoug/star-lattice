// Usage: gjs -m screenflow.js <copy of the project>: round 7, stage 3, on the copy's save. The central
// star's screen (from the tree and from PLAY's map: its star-dots, the general notes, Add a child, no
// Delete or Merge); the Checklist · Table view and its column sets; Delete… (asks first; the branch
// goes; undo), a row's ×, the shelf card's Delete…; MATERIALS' kite card (description, slot
// labels; no ↻ Rotate, P1) and star-dot card (no Plan its star, P1; no ↥ Zenith, round 8); the tree's marks by progress;
// GOVERN's Categories (the palette menu) and the locks rule; the Retired bank's Delete….
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/');
let hash = '#rearrange';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
let answer = true;
globalThis.confirm = () => answer;   // Delete…'s confirmation
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
const E = await import(`file://${ROOT}/shared/engine/index.js`);
const content = E.normalizeContent(JSON.parse(read('content/life.json')));
const loaded = E.normalizeSave(JSON.parse(read('saves/outlook.json')));
const state = loaded.state;
const ev = E.derive(state, { ...E.optionsFrom(content), share: loaded.share, now: Math.floor(Date.now() / 60000) * 60000 });
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const btn = (label, root = app) => root?.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const press = async el => { el.fire('click'); await tick(450); };
const saved = () => JSON.parse(read('saves/outlook.json')).state;
const sheet = () => app.find(n => cls(n, 'sds-sheet'));
const closeSheet = async () => { const x = app.find(n => cls(n, 'sds-sheet-close')); if (x) await press(x); };
const undo = async () => { doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450); };
const tree = () => app.find(n => cls(n, 'tree'));
const byNode = id => tree().find(n => cls(n, 'tree-box') && n.dataset.node === id);
const card = () => app.find(n => cls(n, 'tree-card'));
const editText = async (el, value) => { el.fire('dblclick'); const input = el.parent.find(n => cls(n, 'edit-input')); input.value = value; input.fire('keydown', { key: 'Enter', preventDefault() {} }); await tick(450); };
const central = E.centralStar(state);
const centralDots = E.childSlots(state, central.id).map(({ kite, slot }) => state.kites[kite].dots[slot]).filter(Boolean);

// ---- The central star's screen, from the tree ----
const centralBtn = app.find(n => cls(n, 'tree-central'));
report('the tree has the central star’s own box, named after the content set', !!centralBtn && text(centralBtn).includes(content.title), centralBtn && text(centralBtn));
await press(centralBtn);
report('it opens a star-dot screen for the central star, with no status line (P1)', !!sheet() && text(sheet().find(n => cls(n, 'sds-header'))).includes(content.title) && !text(sheet()).includes('The central star: its'));
report('its checklist is the central star’s star-dots', sheet().all(n => cls(n, 'sds-item')).length === centralDots.length, `${sheet().all(n => cls(n, 'sds-item')).length} of ${centralDots.length}`);
report('its Notes are the general notes (the central star’s)', sheet().find(n => cls(n, 'sds-note-list'))?.children.length === central.notes.length && text(sheet()).includes('Notes · general'));
report('nothing of its own to merge, delete, retire or complete', !btn('Merge into…', sheet()) && !btn('Delete…', sheet()) && !btn('Retire', sheet()) && !btn('Ignite', sheet()));
await press(btn('Table', sheet()));
const table = () => sheet().find(n => cls(n, 'sds-table'));
report('Table shows them as rows, with the Status columns', !!table() && table().all(n => cls(n, 'sds-table-row')).length === centralDots.length && text(table()).includes('Children done'));
await press(btn('Relevance', sheet().find(n => cls(n, 'sds-table-wrap'))));
report('Relevance shows a column per category', content.categories.every(c => text(table().find(n => n.tagName === 'THEAD')).includes(c.name)));
await press(btn('Checklist', sheet()));
// Add a child… there: the central star may be full, so a row's × frees a slot first (both undone after).
let undos = 0;
if (!E.childSlots(state, central.id).some(x => !state.kites[x.kite].dots[x.slot])) {
  await press(sheet().all(n => cls(n, 'sds-item'))[0].find(n => cls(n, 'remove-btn')));
  undos++;
}
const now = saved();
const free = E.childSlots(now, central.id).find(x => !now.kites[x.kite].dots[x.slot]);
const addInput = sheet().find(n => cls(n, 'sds-add-child')).find(n => n.tagName === 'INPUT');
addInput.value = 'From the central screen'; addInput.parent.fire('submit', { preventDefault() {} }); await tick(450);
report('Add a child… there puts a new star-dot in the central star’s next free slot (saved)', saved().dots[saved().kites[free.kite].dots[free.slot]]?.name === 'From the central screen');
for (let i = 0; i <= undos; i++) await undo();
report('…undone, the central star is as it was', E.childSlots(state, central.id).every(x => saved().kites[x.kite].dots[x.slot] === state.kites[x.kite].dots[x.slot]));
await closeSheet();

// ---- Delete… on a star-dot's screen: asks first, takes its branch, undoable ----
const parent = Object.values(state.dots).find(d => E.index(state).dot.has(d.id) && ev.children(d.id).length > 1 && E.starOfDot(state, d.id) === central.id);
const parentKite = E.index(state).dot.get(parent.id).kite;
await press(byNode(parentKite)); await press(byNode(parent.id));
await press(btn('Open ↗', card()));
report('a star-dot’s screen (editing) has Delete… beside Merge into…', !!btn('Delete…', sheet()) && !!btn('Merge into…', sheet()));
const branch = E.branchOf(state, parent.id).dots;
answer = false;
await press(btn('Delete…', sheet()));
report('Delete… asks first: declined, nothing goes', !!saved().dots[parent.id] && !!sheet());
answer = true;
await press(btn('Delete…', sheet()));
report(`accepted, it goes with its whole branch (${branch.length} star-dots), and its screen closes`, branch.every(d => !saved().dots[d]) && !sheet());
await undo();
report('one undo brings it all back', branch.every(d => saved().dots[d]));
await press(byNode(parentKite)); await press(byNode(parent.id)); await press(btn('Open ↗', card()));
const child = ev.children(parent.id)[0];
const childRow = sheet().all(n => cls(n, 'sds-item')).find(n => n.dataset.child === child);
await press(childRow.find(n => cls(n, 'remove-btn')));
report('a checklist row’s × asks and deletes that child with its branch', E.branchOf(state, child).dots.every(d => !saved().dots[d]) && !!saved().dots[parent.id]);
await undo();
await closeSheet();

// ---- MATERIALS' kite card: description, slot labels, ↻ Rotate ----
await press(byNode(parentKite));
await editText(card().find(n => cls(n, 'kite-description')).find(n => cls(n, 'editable')), 'A kite described in the tree');
report('the kite card edits its description (saved)', saved().kites[parentKite].description === 'A kite described in the tree');
await editText(card().find(n => cls(n, 'slot-label')), 'First');
report('…and its slot labels (saved)', saved().kites[parentKite].labels[0] === 'First');
report('…and has no ↻ Rotate (P1: the map does that)', !btn('↻ Rotate', card()));
await undo();   // the label; the description stays for PLAY's kite card (below)

// ---- The star-dot card: no Plan its star (P1); no ↥ Zenith ----
const bare = Object.values(state.dots).find(d => E.index(state).dot.has(d.id) && !d.branch && E.starOfDot(state, d.id) === central.id && E.index(state).dot.get(d.id).slot !== E.ZENITH);
await press(byNode(E.index(state).dot.get(bare.id).kite)); await press(byNode(bare.id));
report('a star-dot’s card has no Plan its star (P1: adding a child plans it)', !!card() && !btn('Plan its star', card()));
// Round 8 (X4): no Bring to the Zenith, on the card or on its screen (↻ Rotate does it).
await press(byNode(E.index(state).dot.get(bare.id).kite)); await press(byNode(bare.id));
report('a star-dot off the Zenith has no ↥ Zenith on its card (X4)', !!card() && !btn('↥', card()));
await press(btn('Open ↗', card()));
report('…nor on its screen', !!sheet() && !btn('↥', sheet()));
await closeSheet();

// ---- The tree's marks under a star-dot's box: its kites by progress ----
await press(byNode(parentKite));
const marks = byNode(parent.id).all(n => cls(n, 'tree-mark'));
report('the marks under a star-dot’s box are its star’s kites, filled by progress (not open / locked)', marks.length === 6 && marks.every(m => ['faint', 'open', 'training', 'ignited'].some(c => cls(m, c))) && !marks.some(m => cls(m, 'unlocked') || cls(m, 'locked')),
  marks.map(m => (m.attrs.class ?? '').replace('tree-mark ', '')).join(','));

// ---- Round 14: ↗ on a star-dot's box (Z19); Retire on its screen and the Retired bank on MATERIALS (Z20) ----
const opener = byNode(parent.id).find(n => cls(n, 'tree-open'));
report('a star-dot’s box has a small ↗ at its bottom right (Z19); kite boxes don’t', !!opener && text(opener) === '↗' && !byNode(parentKite).find(n => cls(n, 'tree-open')));
await press(opener);
report('…which opens its screen, without picking the box up', !!sheet() && text(sheet()).includes(parent.name) && !cls(byNode(parent.id), 'picked'));
const at0 = E.index(state).dot.get(parent.id);
const R0 = saved().retired.length;
report('its screen has Retire (Z20)', !!btn('Retire', sheet()));
await press(btn('Retire', sheet()));
report('Retire takes it off the map into the Retired bank (saved), with no Retire on its screen now', saved().retired[0]?.id === parent.id && saved().kites[at0.kite].dots[at0.slot] === null
  && !!sheet() && !btn('Retire', sheet()));
await closeSheet();
const bank = () => app.find(n => cls(n, 'tree-card'))?.find(n => cls(n, 'retired-bank'));
report('MATERIALS’ side card has the Retired bank, as on PLAY, with its dot first (Z20)', !!bank() && text(bank()).includes(`Retired · ${R0 + 1}`) && bank().all(n => cls(n, 'retired-dot'))[0]?.dataset.id === parent.id);
await press(bank().all(n => cls(n, 'retired-dot'))[0]);
await press(btn('Restore', bank().find(n => cls(n, 'retired-detail'))));
report('…and Restore there puts it back in its old slot (saved)', saved().kites[at0.kite].dots[at0.slot] === parent.id && saved().retired.length === R0);

// ---- The shelf card's Delete… ----
const shelved = state.shelf.find(e => e.kind === 'dot');
if (shelved) {
  await press(app.find(n => cls(n, 'shelf-item') && n.dataset.node === shelved.id));
  await press(btn('Delete…', card()));
  report('a shelved star-dot’s card has Delete…, which deletes it (saved)', !saved().dots[shelved.id] && !saved().shelf.some(e => e.id === shelved.id));
  await undo();
} else report('a shelved star-dot’s card has Delete… (nothing shelved on this save)', true, 'skipped');

// ---- GOVERN: Categories with the palette menu; the locks rule ----
location.hash = '#govern/look'; await tick(100);   // round 9: GOVERN's subtabs
const cats = app.find(n => cls(n, 'categories-panel'));
report('GOVERN has a Categories panel with the palette menu', !!cats && !!cats.find(n => cls(n, 'palette-btn')) && content.categories.every(c => text(cats).includes(c.name)));
location.hash = '#govern/stars'; await tick(100);
const lockRadio = v => app.all(n => n.tagName === 'INPUT' && n.attrs.name === 'locks')[v === 'on' ? 1 : 0];   // stage 3: Kites lock is under Stars › Advanced
const lockOn = lockRadio('on');
lockOn.fire('change'); await tick(450);
report('the locks rule is GOVERN’s, saved in the content set', JSON.parse(read('content/life.json')).rules.locks === 'on');
lockRadio('off').fire('change'); await tick(450);
report('…and back off', JSON.parse(read('content/life.json')).rules.locks === 'off');
// Round 8: the fade rule, in GOVERN › Rules; PLAY's kites follow it.
{
  const { GRAY } = await import(`file://${ROOT}/shared/color.js`);
  const fadeLabel = l => app.all(n => n.tagName === 'LABEL' && text(n).startsWith(l))[0];
  const choose = async l => { location.hash = '#govern/look'; await tick(100); fadeLabel(l).find(n => n.tagName === 'INPUT').fire('change'); await tick(450); };
  const fills = async () => { location.hash = '#play'; await tick(100); resize(); await tick(50);
    return app.find(n => cls(n, 'sl-map')).all(n => n.dataset?.hit === 'kite').map(n => n.attrs.fill).filter(f => f && f !== 'transparent'); };
  const fade = () => JSON.parse(read('content/life.json')).rules.fade;
  const onLabel = { darken: 'Darken as they complete', brighten: 'Brighten as they complete', none: 'No fade' }[content.rules.fade];
  location.hash = '#govern/look'; await tick(100);
  report(`GOVERN has the fade rule: Darken · Brighten · No fade, the content set’s (${content.rules.fade}) on`,
    ['Darken as they complete', 'Brighten as they complete', 'No fade'].every(l => !!fadeLabel(l)) && fadeLabel(onLabel).find(n => n.tagName === 'INPUT').checked);
  await choose('No fade');
  const plain = await fills();
  report('No fade (saved in the content set): every kite on PLAY in its plain category color', fade() === 'none' && plain.length > 0 && plain.every(f => content.categories.some(c => c.color === f)), `${plain.length} kites`);
  await choose('Brighten as they complete');
  const bright = await fills();
  report('Brighten: a kite with nothing done is the dark gray', fade() === 'brighten' && bright.includes(GRAY));
  await choose('Darken as they complete');
  const dark = await fills();
  report('Darken (back to the default): a kite with nothing done is its full color, none gray unless complete', fade() === 'darken' && dark.some(f => content.categories.some(c => c.color === f)));
  location.hash = '#govern/look'; await tick(100);
}

// ---- PLAY: the central star's dot; the Retired bank's Delete… ----
location.hash = '#play'; await tick(100); resize(); await tick(50);
const map = () => app.find(n => cls(n, 'sl-map'));
const tap = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(50); };
const dotEl = map().find(n => n.dataset?.hit === 'central');
report('PLAY’s map has the central star’s dot', !!dotEl);
await tap(dotEl);
report('tapping it opens the central star’s screen, fixed (nothing to edit)', !!sheet() && text(sheet()).includes(content.title) && !sheet().find(n => cls(n, 'editable')) && !sheet().find(n => cls(n, 'sds-add-child')));
await closeSheet();
await tap(map().all(n => n.dataset?.hit === 'kite').find(n => n.dataset.id === parentKite));
report('PLAY’s kite card shows the description written in the tree (read-only)', text(app.find(n => cls(n, 'play-card'))).includes('A kite described in the tree') && !app.find(n => cls(n, 'play-card')).find(n => cls(n, 'editable')));
const victim = centralDots[0];
await tap(map().all(n => n.dataset?.hit === 'kite').find(n => n.dataset.id === E.index(state).dot.get(victim).kite));
await tap(map().all(n => n.dataset?.hit === 'dot').find(n => n.dataset.id === victim));
await press(btn('Retire', app.find(n => cls(n, 'play-card'))));
report('P3: in Play mode the Retired bank offers no Delete…', (await press(app.all(n => cls(n, 'retired-dot')).find(n => n.dataset.id === victim)), !btn('Delete…', app.find(n => cls(n, 'retired-detail')))));
location.hash = '#star'; await tick(150);   // Edit mode's Star view (its details still open): Delete… is the designer's
await press(btn('Delete…', app.find(n => cls(n, 'retired-detail'))));
report('the Retired bank’s Delete… deletes a retired star-dot for good (saved)', !saved().dots[victim] && !saved().retired.some(e => e.id === victim));

// ---- Stage 3: GOVERN from the rules' declarations; the content set's word for a star-dot ----
location.hash = '#govern/stars'; await tick(150);
const ruleEl = key => app.find(n => cls(n, 'rule') && n.dataset?.rule === key);
const drop = key => ruleEl(key)?.find(n => n.tagName === 'DETAILS' && cls(n, 'help-drop'));
report('P1: GOVERN › Stars shows each rule with a help icon, its dropdown closed', ['kites', 'stardots', 'perStar', 'deploy', 'locks'].every(k => !!drop(k)?.find(n => cls(n, 'rule-help-btn')) && drop(k).attrs.open == null));
report('…the dropdown says what the rule and each choice does, verb first', text(drop('stardots').find(n => cls(n, 'help-drop-body'))).startsWith('Sets how star-dots relate')
  && text(drop('stardots')).includes('Independent: Lines each category up as one ordered list'));
report('…Kites lock sits with the other rules: no Advanced fold on Stars (P1)', !app.find(n => n.tagName === 'DETAILS' && cls(n, 'rules-advanced')) && !!ruleEl('locks'));
location.hash = '#govern/questions'; await tick(150);
report('P1 renames: Questions has QUIZ MODE and SCHEDULE DEFINITIONS (no “Every star-dot is a question”, no “Retraining”)', text(app).includes('Quiz mode') && text(app).includes('Schedule definitions') && !text(app).includes('Every star-dot is a question') && !text(app).includes('Retraining'));
location.hash = '#govern/look'; await tick(150);
report('…Look has ITEM NAME CONVENTION (no “Words”), its explanation behind a help icon', text(app).includes('Item name convention') && !app.find(n => cls(n, 'panel-head') && text(n) === 'Words')
  && !!app.find(n => cls(n, 'help-drop-body') && text(n).includes('Empty brings “star-dot” back.')) && !app.find(n => cls(n, 'note') && text(n).includes('Empty brings “star-dot” back.')));
location.hash = '#govern/stars'; await tick(150);
report('…Star-dots per star, which doesn’t apply under Kites in: All stars, is greyed out and says why', cls(ruleEl('perStar'), 'disabled') && text(ruleEl('perStar')).includes('Only for stars without kites')
  && ruleEl('perStar').all(n => n.tagName === 'BUTTON' && cls(n, 'seg')).every(b => b.attrs.disabled != null));

location.hash = '#govern/questions'; await tick(150);
report('…under Hierarchical, Shuffle the questions is greyed out (its radios disabled) and says why', cls(ruleEl('shuffleQuestions'), 'disabled') && ruleEl('shuffleQuestions').all(n => n.tagName === 'INPUT').every(n => n.attrs.disabled != null)
  && text(ruleEl('shuffleQuestions')).includes('Only under Star-dots: Independent'));
location.hash = '#govern/look'; await tick(150);
const termIn = key => app.find(n => n.tagName === 'INPUT' && n.dataset?.term === key);
termIn('stardot').value = 'task'; termIn('stardot').fire('change'); await tick(450);
report('stage 3: Look › Words: a star-dot is called “task” (saved in the content set, plural “tasks”)', JSON.stringify(JSON.parse(read('content/life.json')).terms) === '{"stardot":"task","stardots":"tasks"}');
location.hash = '#govern/stars'; await tick(150);
report('…the app says “task” where it said “star-dot”: GOVERN’s Stars', text(app).includes('Tasks per star') && !/star-dot/i.test(text(app)), text(app).match(/.{0,30}star-dot.{0,30}/i)?.[0] ?? '');
location.hash = '#rearrange'; await tick(150);
const userNames = Object.values(saved().dots).map(d => d.name).filter(n => /star-dot/i.test(n));
{ let t = text(app); for (const n of userNames) t = t.split(n).join('');
  report('…and MATERIALS (names you wrote are left as written)', !/star-dot/i.test(t), t.match(/.{0,30}star-dot.{0,30}/i)?.[0] ?? ''); }
location.hash = '#govern/look'; await tick(150);
termIn('stardot').value = ''; termIn('stardot').fire('change'); await tick(450);
location.hash = '#govern/stars'; await tick(150);
report('…an empty word brings “star-dot” back', JSON.parse(read('content/life.json')).terms.stardot === 'star-dot' && text(app).includes('Star-dots per star'));
