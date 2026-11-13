// Usage: gjs -m treeflow.js <copy of the project>: round 4, stages 1–2: REARRANGE's tree on the copy's
// outlook (rows, compass order, one open path, marks, empty slots, the shelf row; naming,
// picking up, swaps, the shelf, conflicts, Escape, Undo); stage 3: deploying a star from the card,
// and GOVERN's ignition share.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
// TRACE=1 prints elapsed seconds around every click, hash change and report, to find slow steps.
const T0 = Date.now();
const trace = GLib.getenv('TRACE') ? what => printerr(`[${((Date.now() - T0) / 1000).toFixed(2)}s] ${what}`) : () => {};
const { els, doc, resize } = install(ROOT, '/app/');
let hash = '#rearrange';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
let before = read('saves/outlook.json');
const E = await import(`file://${ROOT}/shared/engine/index.js`);
// What the app shows: the save as the engine reads it (round 5: upgraded to format 3 on loading).
const state = E.normalizeSave(JSON.parse(before)).state;
const childrenOf = id => E.derive(state, {}).children(id);
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
await tick(500);   // P10: a save from before writes its own copy of the design once, as it opens
print(`${JSON.parse(read('saves/outlook.json')).design ? 'ok  ' : 'FAIL'} opening a save from before writes its own copy of the design, once (P10)`);
before = read('saves/outlook.json');   // from here on, browsing writes nothing
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const btn = (label, root = app) => root.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const report = (what, ok, extra = '') => trace('report ' + what) || print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const tree = () => app.find(n => cls(n, 'tree'));
const rows = () => tree().find(n => cls(n, 'tree-section')).all(n => cls(n, 'tree-row'));   // the central star's section (round 6: the shelf sits above it)
const boxes = row => row.children.filter(n => cls(n, 'tree-box'));
const eyebrow = b => { const e = b?.find(n => cls(n, 'tree-eyebrow')); return e ? text(e) : ''; };
const name = b => text(b.find(n => cls(n, 'tree-name')));
const marks = b => b.all(n => cls(n, 'tree-mark'));
const card = () => text(app.find(n => cls(n, 'tree-card')));
const click = async el => { trace('click ' + (el?.dataset?.node ?? el?.tagName ?? el)); el.fire('click'); trace('  handled'); await tick(); trace('  ticked'); };

report('REARRANGE opens on the tree (no replica)', !!tree() && !app.find(n => cls(n, 'sl-map')));
report('one row: the central star’s six kites', rows().length === 1 && boxes(rows()[0]).length === 6);
const centralKites = Object.values(state.stars).find(s => !s.sources.length && !s.shelved).kites;
report('the six kites are the central star’s, with no structural words (no direction, “spoke” or “kite” eyebrow; P1)', boxes(rows()[0]).every(b => centralKites.includes(b.dataset.node) && !eyebrow(b)));
report('each kite box has four marks', boxes(rows()[0]).every(b => marks(b).length === 4));

// The kite holding a star-dot that grew a star (Computer Science, if present).
const dots = Object.values(state.dots);
const grower = dots.find(d => d.name === 'Computer Science' && d.branch) ?? dots.find(d => d.branch && state.stars[d.branch]?.sources[0] === d.id);
const kiteOf = d => Object.values(state.kites).find(k => k.dots.includes(d));
const kite = kiteOf(grower.id);
const central = Object.values(state.stars).find(s => !s.sources.length && !s.shelved);
const kBox = boxes(rows()[0]).find(b => name(b) === (kite.name || name(b)) && marks(b).length === 4 && eyebrow(b).includes(''));
report('the grower sits on a central kite', central.kites.includes(kite.id), grower.name);
const target = boxes(rows()[0]).find(b => name(b) === kite.name) ?? kBox;
await click(target);
const zenithKey = kite.dots[E.ZENITH] ?? `${kite.id}:${E.ZENITH}`;
report('clicking a kite opens its four star-dots, Zenith first, with no slot words (P1)', rows().length === 2 && boxes(rows()[1]).length === 4 && boxes(rows()[1])[0].dataset.node === zenithKey
  && boxes(rows()[1]).every(b => !eyebrow(b) || eyebrow(b) === kite.labels[0] || kite.labels.includes(eyebrow(b))), boxes(rows()[1]).map(b => b.dataset.node).join(' '));
report('it is selected and shown in the side card', cls(target, 'selected') || card().includes(kite.name), card().slice(0, 60));
report('lines join it to its four children', tree().all(n => n.tagName === 'LINE').length === 4);
const empties = kite.dots.filter(d => !d).length;
report('empty places are dashed boxes holding an active name field, never the word “Empty” (P1)', boxes(rows()[1]).filter(b => cls(b, 'tree-empty') && b.find(n => cls(n, 'tree-input'))).length === empties && !text(tree()).includes('Empty'), `${empties} empty`);
const gBox = boxes(rows()[1]).find(b => name(b) === grower.name);
report(`${grower.name}’s box has six marks (its deployed star’s kites)`, marks(gBox).length === 6);
await click(gBox);
const nextFree = E.childSlots(state, grower.branch).find(x => !state.kites[x.kite].dots[x.slot]);
report('clicking it opens the six kites of its star, and the kite with its next free slot (T5)', rows().length === 4 && boxes(rows()[2]).length === 6
  && cls(tree().find(n => cls(n, 'tree-box') && n.dataset.node === nextFree.kite), 'open'), nextFree.kite);
report('the side card shows the star-dot', card().includes(grower.name));
// The first of its kites with an empty slot (later steps drop things there; the save's kites fill up as it's authored).
const gk = boxes(rows()[2]).find(b => state.kites[b.dataset.node]?.dots.some(d => !d)) ?? boxes(rows()[2])[0];
await click(gk);
const gEmpty = state.kites[gk.dataset.node].dots.filter(d => !d).length;
report('a deployed star’s kite opens its star-dots, empties dashed', rows().length === 4 && boxes(rows()[3]).filter(b => cls(b, 'tree-empty')).length === gEmpty, `${gEmpty} empty of 4`);
// Round 6 walkthrough (note 6): a kite with nothing in it is quiet; an unnamed one shows its category's name, not named yet.
{
  const cats = JSON.parse(read('content/life.json')).categories;   // (the file's content set is read further down)
  const kitesHere = boxes(rows()[2]);
  const bare = b => { const x = state.kites[b.dataset.node]; return !!x && !x.name && !x.description && x.dots.every(d => !d); };
  const quietOnes = kitesHere.filter(bare);
  const filled = kitesHere.filter(b => state.kites[b.dataset.node]?.dots.some(Boolean));
  report('kites with nothing in them are quiet, kites with star-dots aren’t', quietOnes.length > 0 && quietOnes.every(b => cls(b, 'quiet')) && filled.length > 0 && filled.every(b => !cls(b, 'quiet')), `${quietOnes.length} quiet, ${filled.length} with star-dots`);
  const unnamedBox = kitesHere.find(b => !state.kites[b.dataset.node].name && !cls(b, 'selected'));
  const nameEl = unnamedBox?.find(n => cls(n, 'tree-name'));
  report('an unnamed kite shows no title at all (P1)', !!nameEl && cls(nameEl, 'unnamed') && text(nameEl) === '' && !!cats, nameEl && text(nameEl));
  const gkNow = kitesHere.find(b => b.dataset.node === gk.dataset.node);   // the box as redrawn after the click
  report('a quiet kite still opens when clicked, its empty slots ready to name', !bare(gk) || (cls(gkNow, 'open') && boxes(rows()[3]).filter(b => b.find(n => cls(n, 'tree-input'))).length === 4));
}
const other = boxes(rows()[0]).find(b => b !== target && !cls(b, 'open'));
await click(boxes(rows()[0]).find(b => b.dataset.node === other.dataset.node));
report('opening another kite closes the open path (one path)', rows().length === 2 && !boxes(rows()[1]).some(b => name(b) === grower.name));
// A mark goes straight to a child.
const firstKite = boxes(rows()[0])[0];
await click(marks(firstKite)[0]);
report('a kite mark opens that kite and selects its Zenith', rows().length >= 2 && cls(boxes(rows()[1])[0], 'selected'), card().slice(0, 50));
report('browsing writes nothing', read('saves/outlook.json') === before);

// One gesture moves (S15): double-click to pick up, click to travel, double-click where it goes.
const dbl = async b => { b.fire('click'); b.fire('click'); b.fire('dblclick'); await tick(400); };
const shelfDrop = () => app.find(n => cls(n, 'tree-shelf-drop'));
report('the side card has no move buttons', !['Move…', 'Shelve', 'Swap kite…', 'Place…', '↻ Rotate'].some(l => btn(l, app.find(n => cls(n, 'tree-card')))));

// The shelf row: set the selected star-dot (if any) aside, then look.
const zenith = boxes(rows()[1])[0];
if (!cls(zenith, 'empty')) {
  await dbl(zenith);
  await dbl(shelfDrop());
  const shelf = () => app.find(n => cls(n, 'shelf-section'));
  const sb = () => shelf().all(n => cls(n, 'shelf-item'));
  report('a shelved star-dot shows on the shelf as a circle (U13)', sb().length === state.shelf.length + 1 && sb().some(n => n.dataset.node === zenith.dataset.node) && !shelf().find(n => cls(n, 'tree-box')), text(shelf()).slice(0, 60));
  report('the shelf sits above the tree', cls(tree().children[0], 'shelf-section'));
  const shelvedId = zenith.dataset.node;   // (the save's own shelved things come first)
  const pickBanner = () => app.find(n => cls(n, 'mode-banner'));   // (banner() and save() are defined further down)
  const saved = () => JSON.parse(read('saves/outlook.json')).state;
  const mine = () => sb().find(n => n.dataset.node === shelvedId);
  const dotOf = () => mine().find(n => cls(n, 'shelf-dot'));
  report('its circle is filled by its status (its color is a style the fake DOM can’t see)', !!dotOf() && ['open', 'training', 'ignited'].some(s => cls(dotOf(), s)), dotOf()?.attrs.class);
  report('its name shows only once selected', !mine().find(n => cls(n, 'shelf-name')));
  const treeRows = rows().length;
  await click(mine());
  report('a click selects it: its name shows, its shelf card, nothing unfolds', !!mine().find(n => cls(n, 'shelf-name')) && card().includes('Shelved star-dot') && rows().length === treeRows, card().slice(0, 60));
  await dbl(mine());
  report('a double-click picks it up', cls(mine(), 'picked') && !!pickBanner());
  await dbl(mine());
  report('double-clicking it again puts it down', !cls(mine(), 'picked') && !pickBanner() && saved().shelf.some(e => e.id === shelvedId));
  await click(btn('↶ Undo')); await tick(50);
  report('undo puts it back', sb().length === state.shelf.length && !mine());
}

// ---- Stage 2: naming, picking up, moving ----
const save = () => JSON.parse(read('saves/outlook.json')).state;
const settle = () => tick(400);   // saves are written a moment after a change
const undo = async () => { await click(btn('↶ Undo')); await settle(); };
const byNode = id => tree().find(n => cls(n, 'tree-box') && n.dataset.node === id);
const pickUp = dbl;
const dropOn = dbl;
const openKite = async k => { await click(byNode(k)); };
const go = async h => { trace('go ' + h); location.hash = h; doc.fire?.('hashchange'); trace('  handled'); await tick(50); trace('  ticked'); };

// Rename: the selected box's name is a field.
await click(boxes(rows()[0])[0]);
const kBox0 = boxes(rows()[0])[0];
await click(marks(kBox0)[0]);
const zBox = boxes(rows()[1])[0];
const zId = zBox.dataset.node;
const input = () => tree().find(n => cls(n, 'tree-input'));
report('the selected box shows a name field', !!input() && input().value === state.dots[zId].name, input()?.value);
input().value = 'Renamed in the tree'; input().fire('blur'); await settle();
report('typing a name and leaving the field renames it (saved)', save().dots[zId].name === 'Renamed in the tree' && input().value === 'Renamed in the tree');
await undo();
report('undo restores the name', save().dots[zId].name === state.dots[zId].name);

// Pick up a star-dot with a double-click; boxes light or dim; navigating keeps it picked.
// A star-dot without a star of its own on another central kite (round 5: most now hold children).
const { k: leafKite, slot: leafSlot } = central.kites.filter(k => k !== kite.id).flatMap(k => [2, 0, 1, 3].map(slot => ({ k, slot })))
  .find(({ k, slot }) => state.kites[k].dots[slot] && !state.dots[state.kites[k].dots[slot]].branch);
const otherKite = central.kites.find(k => k !== kite.id && k !== leafKite && state.kites[k].dots[1]);
await openKite(leafKite);
const aId = state.kites[leafKite].dots[leafSlot];
await pickUp(byNode(aId));
const banner = () => app.find(n => cls(n, 'mode-banner'));
report('double-click picks a star-dot up (banner, picked box)', !!banner() && cls(byNode(aId), 'picked'), banner() ? text(banner()).slice(0, 50) : '');
report('kites are dimmed as targets for a star-dot', boxes(rows()[0]).every(b => cls(b, 'refused')));
report('the other star-dots light up', boxes(rows()[1]).filter(b => b.dataset.node !== aId).every(b => cls(b, 'target')));
report('the shelf row offers a place to set it aside', cls(shelfDrop(), 'target'));
await openKite(otherKite);
report('opening another kite keeps it picked up', !!banner() && rows().length === 2);
const bId = state.kites[otherKite].dots[1];   // its Port
await dropOn(byNode(bId));
let s2 = save();
report('double-clicking another star-dot swaps them', s2.kites[leafKite].dots[leafSlot] === bId && s2.kites[otherKite].dots[1] === aId && !banner());
await undo();
s2 = save();
report('undo swaps them back', s2.kites[leafKite].dots[leafSlot] === aId && s2.kites[otherKite].dots[1] === bId);

// Kites: central kites swap with each other; a deployed star's kites are dimmed.
await pickUp(byNode(leafKite));
report('picking a central kite lights the other central kites', boxes(rows()[0]).filter(b => b.dataset.node !== leafKite).every(b => cls(b, 'target')));
await dropOn(byNode(otherKite));
s2 = save();
const ci = k => s2.stars[central.id].kites.indexOf(k);
report('double-clicking another central kite swaps them', ci(leafKite) === central.kites.indexOf(otherKite) && ci(otherKite) === central.kites.indexOf(leafKite));
await undo();

// The shelf: set a star-dot aside, then place it in an empty slot of the deployed star.
await openKite(leafKite);
await pickUp(byNode(aId));
await dbl(shelfDrop());
report('double-clicking the shelf row sets it aside', save().shelf.some(e => e.id === aId));
const shelfBoxes = () => app.find(n => cls(n, 'shelf-section')).all(n => cls(n, 'shelf-item')).filter(n => !state.shelf.some(e => e.id === n.dataset.node));   // the ones this check put there
await pickUp(shelfBoxes()[0]);
await openKite(kite.id); await click(byNode(grower.id)); await click(byNode(gk.dataset.node));
const emptyBox = boxes(rows()[3]).find(b => cls(b, 'tree-empty'));
report('a picked-up shelved star-dot lights empty slots', !!emptyBox && cls(emptyBox, 'target'));
await dropOn(emptyBox);
s2 = save();
report('double-clicking an empty slot puts it there', s2.kites[gk.dataset.node].dots.includes(aId) && s2.shelf.length === state.shelf.length);
await undo(); await undo();
report('two undos put it back where it was', save().kites[leafKite].dots[leafSlot] === aId && save().shelf.length === state.shelf.length);

// A clash opens the conflict card; Escape puts a picked thing down.
await openKite(kite.id);
const snapshot = read('saves/outlook.json');
await pickUp(byNode(grower.id));
await click(byNode(grower.id)); await click(byNode(gk.dataset.node));
const own = boxes(rows()[3]).find(b => cls(b, 'target'));
await dropOn(own);
const conflict = app.find(n => cls(n, 'conflict') || cls(n, 'conflict-card'));
report('moving a star-dot into its own branch opens the conflict card', !!conflict || text(app).includes('own branch'), conflict ? text(conflict).slice(0, 60) : '');
const cancel = conflict && btn('Cancel', conflict);
if (cancel) await click(cancel);
await settle();
report('cancelling changes nothing', !!cancel && read('saves/outlook.json') === snapshot);
await pickUp(byNode(grower.id));
doc.fire('keydown', { key: 'Escape', target: doc });
await tick(50);
report('Escape puts it down', !banner());
await pickUp(byNode(grower.id));
await dbl(byNode(grower.id));
report('double-clicking the picked-up box puts it down (nothing moves)', !banner() && read('saves/outlook.json') === snapshot);
// In a browser the first click of a double-click selects the box, so its name becomes a field and
// the double-click lands on that field: it must still pick the box up.
await click(boxes(rows()[0])[1]);
const field = input();
field.fire('dblclick'); await tick(50);
report('a double-click landing on the new name field still picks the box up', !!field && !!banner());
doc.fire('keydown', { key: 'Escape', target: doc }); await tick(50);

// ---- Stage 3: deploy a star at an open Zenith; GOVERN's share ----
const backKite = state.stars[grower.branch].kites[3];   // BACK: open, but its Zenith faces the center
await openKite(kite.id); await click(byNode(grower.id));
// Round 7 (V1): nothing is on the map until deployed; a planned star's card offers Deploy its star, and then Withdraw.
{
  const card2 = () => app.find(n => cls(n, 'tree-card'));
  const wasOn = !!save().stars[grower.branch].deployed;
  if (!wasOn) await click(btn('Deploy its star', card2())); await settle();
  report(`${grower.name}’s planned star is offered Deploy its star, which puts it on the map (saved)`, wasOn || save().stars[grower.branch].deployed === true);
  report('a deployed star’s card offers Withdraw its star instead', !!btn('Withdraw its star', card2()) && !btn('Deploy its star', card2()));
}
await click(byNode(backKite));
// Its Zenith may hold a child already (round 5's upgrade fills slots); else name one there.
const named = !state.kites[backKite].dots[2];
if (named) {
  await click(byNode(`${backKite}:2`));
  // Under a star-dot an empty slot is an Add a child… field: Enter adds (T5; leaving it adds nothing).
  const field = byNode(`${backKite}:2`).find(n => cls(n, 'tree-input'));
  field.value = 'Faces the center'; field.fire('keydown', { key: 'Enter' }); await settle();
}
const inward = save().kites[backKite].dots[2];
await click(byNode(inward));
const growBtn = () => btn('Deploy its star', app.find(n => cls(n, 'tree-card')));
// Round 8 (W1): stars no longer move outward: facing the center, it can't deploy, and its card says why.
report('a Zenith facing the center isn’t offered Deploy its star, with no explanation on the card (W1; P1)', !!inward && !growBtn()
  && !text(app.find(n => cls(n, 'tree-card'))).includes('faces the central star'), text(app.find(n => cls(n, 'tree-card'))).slice(-90));
if (named) await undo();
// A central Zenith star-dot with no star. After round 5's upgrade there may be none: then swap
// the star-less star-dot found above into its kite's Zenith first (undone at the end).
let bare = central.kites.find(k => state.kites[k].dots[2] && !state.dots[state.kites[k].dots[2]].branch);
const swapped = !bare && leafSlot !== 2;
if (swapped) {
  bare = leafKite;
  await openKite(bare);
  await pickUp(byNode(aId)); await dropOn(byNode(state.kites[bare].dots[2]));
}
const newDot = save().kites[bare].dots[2];
await openKite(bare); await click(byNode(newDot));
report(`${state.dots[newDot].name} (central Zenith, no star) is offered Deploy its star`, !!growBtn(), state.dots[newDot].name);
await click(growBtn()); await settle();
const grownId = save().dots[newDot].branch;
report('Deploy its star deploys its star (saved)', !!grownId && save().stars[grownId].sources[0] === newDot);
report('its box now has six marks for its star’s kites', marks(byNode(newDot)).length === 6 && !growBtn());
await openKite(kite.id); await click(byNode(grower.id));
report(`${grower.name}’s card: its progress comes from its star-dots, with no status words (P1)`, /\d+ of \d+ done/.test(card()) && !card().includes('not started') && !card().includes('deployed'), card().slice(0, 90));
await undo();
report('undo removes the star', !save().stars[grownId] && !save().dots[newDot].branch);
// The star-dot screen offers the same.
await openKite(bare); await click(byNode(newDot));
await click(btn('Open ↗', app.find(n => cls(n, 'tree-card'))));
const sdsGrow = () => app.find(n => n.tagName === 'BUTTON' && text(n) === 'Deploy its star');
report('its star-dot screen offers Deploy its star, with no “At the Zenith…” text (P1)', !!sdsGrow() && !text(app).includes('At the Zenith'));
await click(sdsGrow()); await settle();
report('deploying there deploys it too, and the button turns to Withdraw its star', !!save().dots[newDot].branch && !!app.find(n => n.tagName === 'BUTTON' && text(n) === 'Withdraw its star'));
await undo();
const overlay = () => app.find(n => cls(n, 'sds-overlay'));
report('the star-dot screen opens on top of the tree, which stays behind it (round 6)', !!overlay() && !!tree());
await click(app.find(n => cls(n, 'sds-sheet-close')));
report('× closes the screen, back to the tree', !overlay() && !!tree());
if (swapped) await undo();
await go('#govern');
const share = () => app.find(n => cls(n, 'share-input'));
report('GOVERN shows the ignition share, 100%', !!share() && String(share().value) === '100');
share().value = '50'; share().fire('change'); await settle();
report('changing it saves it with the save', JSON.parse(read('saves/outlook.json')).share === 50);
await undo();
report('undo restores 100%', JSON.parse(read('saves/outlook.json')).share === 100 && String(share().value) === '100');

// ---- Stage 4, rebuilt in round 5 (T1): every checklist row is a child star-dot ----
await go('#rearrange');
await openKite(kite.id); await click(byNode(grower.id));
await click(btn('Open ↗', app.find(n => cls(n, 'tree-card'))));
const kidsOf = childrenOf(grower.id);
const checklistText = () => text(app.find(n => cls(n, 'sds-checklist')));
const at = kidsOf.map(d => checklistText().indexOf(state.dots[d].name));
report(`${grower.name}’s checklist lists its children, in slot order`, at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1])), kidsOf.map(d => state.dots[d].name).join(', '));
report('its progress counts them all', checklistText().includes(`of ${kidsOf.length} complete`), checklistText().match(/\d+ of \d+ complete[^.]*/)?.[0]);
report('no Ignite / Lapse (its children decide)', !app.find(n => n.tagName === 'BUTTON' && ['Ignite', 'Lapse'].includes(text(n))));
report('no Activate (everything is a star-dot)', !btn('Activate…'));
report('its attributes roll up its children', text(app).includes(`Rolled up from ${kidsOf.length} children`));
const addForm = app.find(n => n.tagName === 'FORM' && cls(n, 'sds-add'));
addForm.find(n => n.tagName === 'INPUT').value = 'A new child';
addForm.fire('submit'); await settle();
const after = save();
const kidsNow = E.derive(E.normalizeSave(JSON.parse(read('saves/outlook.json'))).state, {}).children(grower.id);
// The next free slot in fill order (back kite first): not always the last child, once a save has gaps.
const freeSlot = E.childSlots(state, grower.branch).find(x => !state.kites[x.kite].dots[x.slot]);
report('Add a child… puts a new star-dot in its star’s next free slot', kidsNow.length === kidsOf.length + 1 && after.dots[after.kites[freeSlot.kite].dots[freeSlot.slot]]?.name === 'A new child'
  && checklistText().includes('A new child'), `${kidsNow.length} children; slot ${freeSlot.kite}:${freeSlot.slot}`);
await undo();
report('undo removes it', !Object.values(save().dots).some(d => d.name === 'A new child'));
await click(app.find(n => n.tagName === 'BUTTON' && cls(n, 'sds-child')));
report('a child opens its own screen (with ← Back to its parent)', text(app).includes(state.dots[kidsOf[0]].name) && !!btn('← Back'));
await go('#schedule');
await click(btn('All'));   // round 7: the list is By star-dot by default; All lists every star-dot
const leaves = kidsOf.filter(d => !childrenOf(d).length);
report('SCHEDULE lists its terminal children', leaves.some(d => text(app).includes(state.dots[d].name)), leaves.map(d => state.dots[d].name).join(', '));

// ---- Stage 5: progress where a star-dot's children decide ----
await go('#rearrange');
await openKite(kite.id); await click(byNode(grower.id));
const total = kidsOf.length;
report('its tree box shows its progress (n/total)', text(byNode(grower.id)).includes(`/${total}`), text(byNode(grower.id)).slice(0, 70));
report('its card shows “n of total done”', card().includes(`of ${total} done`));
let leafBox = null;
for (const k of central.kites) {
  await openKite(k);
  leafBox = boxes(rows()[1]).find(b => !cls(b, 'tree-empty') && !childrenOf(b.dataset.node).length);
  if (leafBox) break;
}
report('a terminal star-dot’s box shows no count', !!leafBox && !/\d+\/\d+/.test(text(leafBox)), leafBox && text(leafBox));
await go('#play');
report('PLAY still renders its overview', text(app).includes('ignited'));

// ---- Round 5, stage 2: the star-dot screen's children, slots, dragging and notes ----
const content = E.normalizeContent(JSON.parse(read('content/life.json')));
const live = () => E.normalizeSave(JSON.parse(read('saves/outlook.json'))).state;
const liveView = () => E.derive(live(), E.optionsFrom(content, { now: Date.now(), share: 100 }));
await go('#rearrange');
await openKite(kite.id); await click(byNode(grower.id));
await click(btn('Open ↗', app.find(n => cls(n, 'tree-card'))));
const rowOf = d => app.find(n => n.tagName === 'LI' && n.dataset.child === d);
const bulletOf = d => rowOf(d)?.find(n => cls(n, 'sds-bullet'));
const FILLS = { ignited: 'done', training: 'half', open: null };
const BORDER = { easy: null, medium: 'thick', hard: 'double' };
const grand = kidsOf.filter(d => childrenOf(d).length);
const v2 = liveView();
report('a child with children shows their progress and their highest Difficulty in its bullet', grand.length > 0 && grand.every(d => {
  const b = bulletOf(d);
  const fill = FILLS[v2.effective(d).status];
  const diff = v2.difficulty(d);
  return b && (fill ? cls(b, fill) : !cls(b, 'done') && !cls(b, 'half')) && (diff == null ? cls(b, 'unset') : BORDER[diff] ? cls(b, BORDER[diff]) : true);
}), grand.map(d => `${state.dots[d].name}: ${v2.effective(d).status}, ${v2.difficulty(d)}`).join('; '));
// Add a child into a chosen slot: the last free one in fill order.
await click(btn('Choose a slot…'));
const freeSlots = () => app.find(n => cls(n, 'sds-slot-picker')).all(n => n.tagName === 'BUTTON' && cls(n, 'sds-slot') && !n.disabled);
const lastFree = E.childSlots(live(), live().dots[grower.id].branch).filter(x => !live().kites[x.kite].dots[x.slot]).pop();
const picks = freeSlots();
await click(picks[picks.length - 1]);
report('Choose a slot… names where the new child goes', text(app).includes('Goes to ') && !app.find(n => cls(n, 'sds-slot-picker')));
let form = app.find(n => n.tagName === 'FORM' && cls(n, 'sds-add') && n.find(x => x.tagName === 'INPUT' && x.attrs.placeholder === 'Add a child…'));
form.find(n => n.tagName === 'INPUT').value = 'In a chosen slot';
form.fire('submit'); await settle();
const placed = Object.values(save().dots).find(d => d.name === 'In a chosen slot');
report('Add a child… puts it in the chosen slot', !!placed && save().kites[lastFree.kite].dots[lastFree.slot] === placed.id);
await undo();
// Move a child to a slot from its attributes.
const mover = kidsOf[kidsOf.length - 1];
await click(rowOf(mover).find(n => cls(n, 'sds-item-text')));
await click(btn('Move to a slot…'));
const movePicks = freeSlots().filter(b => !b.attrs.class.includes('taken'));
await click(movePicks[movePicks.length - 1]); await settle();
report('Move to a slot… moves the selected child to a free slot', save().kites[lastFree.kite].dots[lastFree.slot] === mover);
await undo();
// Drag a row onto another: they swap slots, and so places in the checklist.
const [first, second] = kidsOf;
const slotOfLive = d => E.index(live()).dot.get(d);
const [s1, s2b] = [slotOfLive(first), slotOfLive(second)];
rowOf(first).fire('dragstart', { dataTransfer: { setData() {} } });
rowOf(second).fire('dragover');
rowOf(second).fire('drop'); await settle();
report('dragging a row onto another swaps their slots', save().kites[s1.kite].dots[s1.slot] === second && save().kites[s2b.kite].dots[s2b.slot] === first);
report('…and their places in the checklist', checklistText().indexOf(state.dots[second].name) < checklistText().indexOf(state.dots[first].name));
await undo();
// Notes under the checklist.
const notesBox = () => app.find(n => cls(n, 'sds-notes'));
report('a Notes widget sits under the checklist (its own widget, P4)', !!notesBox() && (() => { const col = app.find(n => cls(n, 'sds-col')).all(n => cls(n, 'sds-widget')).map(w => w.dataset.widget); return col.indexOf('notes') === col.indexOf('checklist') + 1; })());
form = notesBox().find(n => n.tagName === 'FORM');
form.find(n => n.tagName === 'INPUT').value = 'Remember the syllabus';
form.fire('submit'); await settle();
report('Add a note… keeps it on the star-dot (saved), not as a child', save().dots[grower.id].notes.includes('Remember the syllabus') && liveView().children(grower.id).length === kidsOf.length);
await click(notesBox().find(n => n.tagName === 'BUTTON' && cls(n, 'remove-btn')) ?? notesBox().all(n => n.tagName === 'BUTTON').find(b => /Remove/.test(b.attrs.title ?? b.attrs['aria-label'] ?? '')));
await settle();
report('a note can be removed', !save().dots[grower.id].notes.includes('Remember the syllabus'));
await go('#play');

// ---- Round 5, stage 3 (T5, T14): adding children in the tree ----
await go('#rearrange');
const starless = central.kites.flatMap(k => state.kites[k].dots).find(d => d && !(state.dots[d].branch && state.stars[state.dots[d].branch]));
const sk = kiteOf(starless);
const savedBefore = read('saves/outlook.json');
await openKite(sk.id); await click(byNode(starless));
const ghostKites = () => boxes(rows()[2]).filter(b => cls(b, 'tree-ghost') && cls(b, 'tree-kite'));
const fields = () => boxes(rows()[3] ?? { children: [] }).map(b => b.find(n => cls(n, 'tree-input'))).filter(Boolean);
const SLOT_OF = { Nadir: 0, Port: 1, Zenith: 2, Starboard: 3 };
const fieldAt = where => boxes(rows()[3]).find(b => b.dataset.node.endsWith(`:${SLOT_OF[where]}`))?.find(n => cls(n, 'tree-input'));
report(`${state.dots[starless].name} (no star) shows the six kites of the star it would plan, dashed`, ghostKites().length === 6, `${ghostKites().length} dashed`);
report('its back kite opens with it, four empty slots ready to type in (“Add a child…”)', rows().length === 4 && fields().length === 4 && fields().every(f => f.attrs.placeholder === 'Add a child…'));
report('looking creates nothing', read('saves/outlook.json') === savedBefore);
const typeIn = async (f, v, key) => { f.value = v; f.fire('keydown', { key }); await settle(); };
await typeIn(fieldAt('Nadir'), 'First child', 'Enter');
let sv = save();
const planned = sv.dots[starless].branch;
const back = planned && sv.stars[planned].kites[E.BACK];
report('Enter plans its star and adds the child in that slot', !!planned && sv.stars[planned].sources[0] === starless && sv.dots[sv.kites[back].dots[0]]?.name === 'First child');
report('the real back kite stays open, the next slots ready', cls(byNode(back), 'open') && fields().length === 3);
await typeIn(fieldAt('Port'), 'Second child', 'Enter');   // where the cursor goes: the next free slot
sv = save();
report('Enter again adds the next child in the next free slot', sv.dots[sv.kites[back].dots[1]]?.name === 'Second child');
const f3 = fields()[0];
f3.value = 'Not added'; f3.fire('blur'); await settle();
report('leaving a field adds nothing', !Object.values(save().dots).some(d => d.name === 'Not added'));
await typeIn(fields()[0], 'Not added either', 'Escape');
report('Escape adds nothing', !Object.values(save().dots).some(d => d.name === 'Not added either'));
await undo(); await undo();
sv = save();
report('undo takes them back off, and its star with them', !sv.dots[starless].branch && !Object.values(sv.dots).some(d => d.name === 'First child'));
// T14: a dashed kite other than the back one opens its slots with a click.
await openKite(sk.id); await click(byNode(starless));
const otherGhost = ghostKites().find(b => !cls(b, 'open'));
await click(otherGhost);
report('another dashed kite opens its four slots with a click (T14)', cls(otherGhost, 'open') || cls(byNode(otherGhost.dataset.node), 'open') && fields().length === 4);
report('still nothing created', !save().dots[starless].branch);

// ---- CSS guard: the fake DOM has no styles, so check that no class on a tree box has a bare global
// rule (like app.css's `.dot { width: 7px }`, which once shrank star-dot boxes to pills in a browser).
await go('#rearrange');
await openKite(kite.id);
const css = ['app/css/app.css', 'shared/ui/starDotScreen.css', 'shared/ui/map.css'].map(read).join('\n');
const used = new Set(tree().all(n => cls(n, 'tree-box') || cls(n, 'tree-mark')).flatMap(n => (n.attrs.class ?? '').split(' ')).filter(c => c && !c.startsWith('tree-')));
const collide = [...used].filter(c => new RegExp(`(^|[},])\\s*\\.${c}\\s*[{,]`, 'm').test(css));
report('no tree box class has a bare global CSS rule', collide.length === 0, collide.join(', ') || [...used].join(' '));
