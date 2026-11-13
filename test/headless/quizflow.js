// Usage: node quizflow.js <copy of the project>: quiz mode, on the copy's Quiz bank save.
// Stage 0, the baseline: the app opens Quiz bank on its own content set (quiz-bank), with only the
// central star and its six categories, and browsing every tab writes nothing. Later stages add the
// quiz settings, kite-less stars, questions, Independent lists, goals and the import.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const SAVE = 'Quiz bank';
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
// These steps were built on an empty board (only the central star, empty lists, no quiz settings).
// If the save holds imported questions, its copy here is
// put back in that form first: the same central star, the lists emptied, the quiz settings cleared.
// (The imported save itself is played through by importflow.js.)
{
  const raw = JSON.parse(read(`saves/${SAVE}.json`));
  if (Object.values(raw.state.lists ?? {}).some(l => l.length)) {
    const c = JSON.parse(read(`content/${raw.content}.json`));
    for (const k of ['kites', 'stardots', 'deploy', 'questions', 'perStar', 'goalAfter', 'wrong', 'shuffleChoices', 'shuffleQuestions']) delete c.rules[k];   // round 18: the shuffles too (the developer turned them on)
    const blank = E.newSave(E.normalizeContent(c), raw.title);
    GLib.file_set_contents(`${ROOT}/content/${raw.content}.json`, JSON.stringify(c, null, 2));
    GLib.file_set_contents(`${ROOT}/saves/${SAVE}.json`, JSON.stringify({ ...blank, board: raw.board, share: raw.share, gap: raw.gap, designs: raw.designs }, null, 2));
  }
}
const rawSave = JSON.parse(read(`saves/${SAVE}.json`));
const content = E.normalizeContent(JSON.parse(read(`content/${rawSave.content}.json`)));
let before = [read(`saves/${SAVE}.json`), read(`content/${rawSave.content}.json`)];
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
await tick(500);   // P10: the save takes its own copy of the design once, as it opens
before = [read(`saves/${SAVE}.json`), read(`content/${rawSave.content}.json`)];
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const map = () => app.find(n => cls(n, 'sl-map'));

const opened = text(app.find(n => cls(n, 'state-current')) ?? { textContent: '' });
report(`the app opens the ${SAVE} save, on its content set (${rawSave.content})`, opened === SAVE && rawSave.content === 'quiz-bank', `open: ${opened}`);
const kites = map().find(n => cls(n, 'layer-stars')).all(n => cls(n, 'kite'));   // round 14: empty ones too (dashed, inert, Z14)
report('PLAY shows only the central star: six kites, one per category', kites.length === 6 && content.categories.length === 6, `${kites.length} kites`);
report('its categories are the quiz bank’s six', content.categories.map(c => c.name).join() === 'Numbers,Words,Places,Science,History,Arts', content.categories.map(c => c.name).join(' · '));
for (const tab of ['#rearrange', '#schedule', '#govern', '#play']) { location.hash = tab; await tick(100); resize(); await tick(50); }
report('every tab opens on it', !!app.find(n => cls(n, 'sl-map')) && !text(app).includes('Couldn’t'));
await tick(500);
report('browsing writes nothing (the save and its content set unchanged)', read(`saves/${SAVE}.json`) === before[0] && read(`content/${rawSave.content}.json`) === before[1]);

// ---- Stage 1: GOVERN's subtabs (Y1) ----
const go = async h => { location.hash = h; await tick(100); resize(); await tick(50); };
const btn = (label, root = app) => root?.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const press = async el => { el.fire('click', { preventDefault() {} }); await tick(450); };
const savedSave = () => JSON.parse(read(`saves/${SAVE}.json`));
const rules = () => JSON.parse(read(`content/${rawSave.content}.json`)).rules;
const radio = label => app.all(n => n.tagName === 'LABEL' && text(n).startsWith(label))[0]?.find(n => n.tagName === 'INPUT');
const pick = async label => { radio(label).fire('change'); await tick(450); };
await go('#govern');
const subtabs = () => app.all(n => cls(n, 'subtab'));
report('⚙ Design has six subtabs: Board · Stars · Questions · Look · Player · Fun, Board open first', subtabs().map(text).join() === 'Board,Stars,Questions,Look,Player,Fun' && subtabs()[0].attrs['aria-current'] === 'page', subtabs().map(text).join());
report('…Board has the PIN and sessions, with no “These belong to…” note (Movement is the player’s, P3)', !text(app).includes('belong to this save') && text(app).includes('Assessor PIN') && !!btn('Start a new session') && !text(app).includes('Movement'));
// P2: Design › Player's switches are the content set's, saved, undoable, and Play mode offers the views they allow.
await go('#design/player');
const playerBox = key => app.find(n => n.tagName === 'INPUT' && n.dataset?.player === key);
playerBox('tree').checked = true; playerBox('tree').fire('change', { target: playerBox('tree') }); await tick(450);
report('P2: ticking Player › Tree saves it in the content set', JSON.parse(read(`content/${rawSave.content}.json`)).player?.tree === true);
await go('#play/tree');
report('…and Play mode now offers Star · Tree, opening the Tree view', location.hash === '#play/tree' && app.find(n => n.attrs?.['aria-label'] === 'View')?.all(n => cls(n, 'seg')).map(text).join() === 'Star,Tree');
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
report('…undo turns it off again, and the player is back on the Star view', JSON.parse(read(`content/${rawSave.content}.json`)).player?.tree === false && location.hash === '#play', location.hash);
await go('#govern');
await go('#govern/stars');
report('Stars has Kites in, Star-dots per star, Star-dots, Deploy and Kites lock, with no “These belong to…” note', !text(app).includes('belong to the content set') && ['Kites in', 'Star-dots per star', 'Deploy', 'Kites lock'].every(s => text(app).includes(s)));
await pick('Central star only'); await pick('Independent'); await pick('Automatically');
await press(app.find(n => n.attrs?.['aria-label'] === 'Star-dots per star').all(n => n.tagName === 'BUTTON').find(n => text(n) === '12'));
report('its settings are saved in the content set', rules().kites === 'central' && rules().stardots === 'independent' && rules().deploy === 'auto' && rules().perStar === 12, JSON.stringify(rules()));
await pick('Hierarchical');   // stage 4 put Independent in effect: Hierarchical until its own steps
await go('#govern/questions');
await pick('On');
await press(btn('Wait', app.find(n => n.attrs?.['aria-label'] === 'After a wrong answer')));
const minutes = app.find(n => n.attrs?.['aria-label'] === 'Minutes to wait'); minutes.value = '10'; minutes.fire('change'); await tick(450);
const goal = app.find(n => n.attrs?.['aria-label'] === 'Correct answers before the goal'); goal.value = '14'; goal.fire('change'); await tick(450);
report('Questions: on, a 10-minute wait after a wrong answer, a goal after 14 (saved)', rules().questions === 'on' && rules().wrong.mode === 'wait' && rules().wrong.minutes === 10 && rules().goalAfter === 14, JSON.stringify(rules()));
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
report('undo takes the last one back', rules().goalAfter === 0 && rules().wrong.minutes === 10);
await pick('Off');   // stage 3 put questions in effect: off again until its own steps
await go('#govern/look');
report('Look holds the categories with the palette menu, and kite colors by progress', !!app.find(n => cls(n, 'categories-panel')) && !!app.find(n => cls(n, 'palette-btn')) && text(app).includes('Kite colors by progress'));

// ---- Stage 1: Movement Locked (Y2; P3: Design › Player › Movement, all off) ----
await go('#design/player');
for (const key of ['swap', 'rotateDots']) { playerBox(key).checked = false; playerBox(key).fire('change', { target: playerBox(key) }); await tick(450); }
const moved = JSON.parse(read(`content/${rawSave.content}.json`)).player;
report('Movement all off (locked) is saved with the content set', !moved.swap && !moved.rotateDots && !moved.rotateKites);
await go('#play');
const tapEl = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(50); };
// Round 14 (Z14): every central kite is empty here, so none can be selected yet: the Locked card is checked once one holds star-dots (stage 2).
const playCard = () => app.find(n => cls(n, 'play-card'));
const hits0 = kind => map().all(n => n.dataset?.hit === kind);

// ---- Stage 1: the assessor PIN (Y3) ----
await go('#govern/board');
const pinField = c => app.find(n => cls(n, c));
const setPin = async (a1, a2) => { pinField('pin-new').value = a1; pinField('pin-again').value = a2; pinField('pin-form').fire('submit', { preventDefault() {} }); await tick(450); };
await setPin('2468', '2469');
report('setting a PIN refuses two that don’t match', !savedSave().pin && text(pinField('pin-msg')).includes('match'));
await setPin('2468', '2468');
report('a PIN is saved hashed, never as typed', /^[0-9a-f]{16}$/.test(savedSave().pin ?? '') && !read(`saves/${SAVE}.json`).includes('"2468"'), savedSave().pin);
await go('#play');
const sw = () => app.find(n => cls(n, 'seg') && n.dataset?.mode === 'edit');   // P2: Mode › Edit
const dialog = () => app.find(n => cls(n, 'pin-sheet'));
report('on PLAY with a PIN, the player has no Undo, Redo or States menu', !btn('↶ Undo') && !btn('↷ Redo') && !btn('States'));
await go('#govern');
report('while locked, an Edit mode address opens Play mode instead', location.hash === '#play' && !!map() && !app.find(n => cls(n, 'subtabs')), location.hash);
const before1 = read(`saves/${SAVE}.json`);
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
report('…and Ctrl+Z does nothing', read(`saves/${SAVE}.json`) === before1);
await press(sw());
report('Back to editing asks for the PIN', !!dialog() && location.hash === '#play');
const answer = async v => { dialog().find(n => cls(n, 'pin-input')).value = v; dialog().fire('submit', { preventDefault() {} }); await tick(100); resize(); await tick(50); };
await answer('1111');
report('a wrong PIN is refused, and PLAY stays', !!dialog() && text(dialog()).includes('the PIN') && location.hash === '#play');
await answer('2468');
report('the right PIN opens Edit mode', !dialog() && location.hash !== '#play' && !!app.find(n => cls(n, 'design-link')), location.hash);
await go('#play');
report('returning to PLAY locks it again (no Undo; editing asks for the PIN)', !btn('↶ Undo') && (await press(sw()), !!dialog()));
await answer('2468');
await go('#govern/board');
let confirmed = 0;
globalThis.confirm = () => { confirmed++; return true; };
await press(btn('Start a new session'));
report('Start a new session… asks for the PIN first', !!dialog() && confirmed === 0);
await answer('2468');
await tick(450);
report('…then to confirm, and starts it (on this bare save, saying there was nothing to clear)', confirmed === 1 && text(els.toast ?? doc).includes('Started a new session'));
await press(btn('Clear the PIN'));
await answer('2468'); await tick(450);
report('Clear the PIN asks for it, then clears it', savedSave().pin === null);
await go('#play');
const hadUndo = !!btn('↶ Undo');
await press(sw());
report('without a PIN, PLAY has Undo again and Back to editing goes straight there', hadUndo && !dialog());

// ---- Stage 2: kite-less stars (Y4, Y5), Deploy: Automatically (Y7) ----
// Stage 1 left the content set at Kites in: Central star only, 12 per star, Deploy: Automatically.
const engineState = () => E.normalizeSave(savedSave()).state;
await go('#govern/stars');
report('Stars: Kites in, Star-dots per star and Deploy are in effect (no “stage 2” marks)', !text(app).includes('in effect from stage 2') && rules().kites === 'central' && rules().perStar === 12 && rules().deploy === 'auto');
let st2 = engineState();
const ck = E.centralStar(st2).kites.find(k => st2.kites[k].dots.every(d => !d));
const tree = () => app.find(n => cls(n, 'tree'));
const byNode = key => tree().find(n => cls(n, 'tree-box') && n.dataset.node === key);
const click = async el => { el.fire('click'); await tick(450); };
await go('#rearrange');
await click(byNode(ck));
const nameSlot = async (slot, name) => {
  await click(byNode(`${ck}:${slot}`));
  const f = byNode(`${ck}:${slot}`).find(n => cls(n, 'tree-input'));
  f.value = name; f.fire('keydown', { key: 'Enter' }); await tick(450);   // P1: an empty place is a name field; Enter adds
};
report('12 per star: the central kite offers its Zenith and Port only (round 11, Z2)', ['2', '1'].every(sl => !!byNode(`${ck}:${sl}`)) && !byNode(`${ck}:0`) && !byNode(`${ck}:3`));
await nameSlot(1, 'Water'); await nameSlot(2, 'Atoms');
st2 = engineState();
const [water, atoms] = [st2.kites[ck].dots[1], st2.kites[ck].dots[2]];
report('MATERIALS names a Port (Water) and a Zenith (Atoms) on an empty central kite', !!ck && st2.dots[water]?.name === 'Water' && st2.dots[atoms]?.name === 'Atoms');
await go('#play');
await tapEl(map().all(n => n.dataset?.hit === 'kite' && n.dataset.id === ck)[0]);
report('Locked: a kite’s card in Play mode offers no ↻ Rotate, ⟳ Rotate kites, Swap… or Swap kite…', !!playCard() && !btn('↻ Rotate', playCard()) && !btn('⟳', playCard()) && !btn('Swap', playCard()), text(playCard() ?? { textContent: 'no card' }).slice(0, 200));
report('…and its pills are 🖌 only (Z12: no ↻ Rotate or Swap kite… on a Locked board)', hits0('pill').map(n => n.dataset.action).join() === 'design');
await go('#rearrange');
await click(byNode(atoms));
const ghosts = () => tree().all(n => cls(n, 'tree-kite') && cls(n, 'tree-ghost'));
report('the star a Zenith would plan shows six dashed spokes in the tree, with no words (P1)', ghosts().length === 6 && ghosts().every(b => !b.find(n => cls(n, 'tree-eyebrow'))));
await click(ghosts()[0]);
const ghostSlots = tree().all(n => cls(n, 'tree-empty') && cls(n, 'tree-ghost')).map(b => b.dataset.node.split(':').pop());
report('…each offering 12 ÷ 6 = 2 slots: its Zenith and Port (round 11, Z2)', ghostSlots.join() === '2,1', ghostSlots.join());

await go('#play');
const hits = kind => map().all(n => n.dataset?.hit === kind);
const allKites = () => map().find(n => cls(n, 'layer-stars')).all(n => cls(n, 'kite'));   // round 14: empty ones too (dashed, inert, Z14)
const dotEl = id => hits('dot').find(n => n.dataset.id === id);
const sheet = () => app.find(n => cls(n, 'sds-sheet'));
const closeSheet = async () => press(app.find(n => cls(n, 'sds-sheet-close')));
const openDot = async id => {
  await tapEl(hits('kite').find(n => n.dataset.id === ck));
  await tapEl(dotEl(id));
  return hits('pill').map(n => n.dataset.action);
};
const pillsAtoms = await openDot(atoms);
report('Deploy: Automatically: a Zenith facing a free position offers no Deploy pill on PLAY', pillsAtoms.join() === 'open', pillsAtoms.join());
await tapEl(hits('pill').find(n => n.dataset.action === 'open'));
report('a Zenith waits for the star-dots inside it: Ignite is off, and its screen says why (Y5)', !!sheet() && btn('Ignite', sheet())?.disabled === true && text(sheet()).includes('once the star-dots inside it are'));
await closeSheet();
await openDot(water);
await tapEl(hits('pill').find(n => n.dataset.action === 'open'));
await press(btn('Ignite', sheet()));
await closeSheet();
await openDot(atoms);
await tapEl(hits('pill').find(n => n.dataset.action === 'open'));
report('with Water ignited, Atoms can be completed', btn('Ignite', sheet())?.disabled === false);
const ign = btn('Ignite', sheet());
ign.fire('click', { preventDefault() {} }); await tick(40);
const unchanged = !map().all(n => cls(n, 'kiteless-star')).some(n => /scale\(/.test(n.attrs.transform ?? ''));
await tick(450);
app.find(n => cls(n, 'sds-sheet-close')).fire('click', { preventDefault() {} }); await tick(40);   // the box closes: now it animates
const grown = hits('slot').filter(n => /scale\(/.test(n.attrs.transform ?? ''));
const shapes = () => map().all(n => cls(n, 'kiteless-star'));
const shapeGrows = shapes().some(n => /scale\(/.test(n.attrs.transform ?? ''));
report('completing it deploys its star in the same change, its shape and slots growing out of the star-dot once its screen closes (Y7, Z1; nothing grows under the screen)', unchanged && grown.length > 0 && shapeGrows, `${grown.length} slots growing, shape ${shapeGrows ? 'growing' : 'not'}`);
await tick(450);
st2 = engineState();
const s2 = st2.dots[atoms].branch;
report('…saved: Atoms ignited, its star deployed', !!st2.dots[atoms].ignitedAt && !!st2.stars[s2]?.deployed);
const ofStar = (kind, s) => hits(kind).filter(n => st2.stars[s].kites.includes(n.dataset.kite ?? E.index(st2).dot.get(n.dataset.id)?.kite));
const shapeOf = s => shapes().filter(n => n.dataset.star === s);
const catColorOf = s => JSON.parse(read(`content/${rawSave.content}.json`)).categories[st2.kites[st2.stars[s].kites[0]].color].color;
report('the new star is a faint star shape in its category’s color, with no kites (still six on the map), its 12 empty slots on it at once (Y4, Z1)', allKites().length === 6 && shapeOf(s2).length === 1
  && shapeOf(s2)[0].attrs.fill === catColorOf(s2) && shapeOf(s2)[0].attrs.points.split(' ').length === 12 && ofStar('slot', s2).length === 12 && ofStar('dot', s2).length === 0,
  `${allKites().length} kites, ${shapeOf(s2).length} shape, ${ofStar('slot', s2).length} slots`);
report('…its shape doesn’t take taps (its star-dots and slots do)', shapeOf(s2)[0].attrs['pointer-events'] === 'none' && !shapeOf(s2)[0].dataset.hit);
report('…its empty slots are very small filled dots (Z13)', ofStar('slot', s2).every(n => n.children.some(c => cls(c, 'dot-slot')) && !n.children.some(c => cls(c, 'dot-empty'))));
// Round 11 (Z2, Z3): star-dots at kite positions, not along spokes; stars for those that can deploy, circles for the rest.
const xy = n => { const c = n.find(m => cls(m, 'dot-slot')); return [Number(c.attrs.cx), Number(c.attrs.cy)]; };
const pts2 = shapeOf(s2)[0].attrs.points.split(' ').map(q => q.split(',').map(Number));
const mid2 = [pts2.reduce((t, q) => t + q[0], 0) / pts2.length, pts2.reduce((t, q) => t + q[1], 0) / pts2.length];
const spoke0 = st2.stars[s2].kites[0];
const [zXY, pXY] = ['2', '1'].map(sl => xy(ofStar('slot', s2).find(n => n.dataset.kite === spoke0 && n.dataset.slot === sl)));
const cross = (zXY[0] - mid2[0]) * (pXY[1] - mid2[1]) - (zXY[1] - mid2[1]) * (pXY[0] - mid2[0]);
const reach = Math.hypot(zXY[0] - mid2[0], zXY[1] - mid2[1]);
report('the new star’s Zenith and Port sit where a kite’s would, not on one line from its center (Z2)', Math.abs(cross) > 0.05 * reach * reach, `${cross.toFixed(1)} vs ${(reach * reach).toFixed(1)}`);
await tapEl(hits('kite').find(n => n.dataset.id === ck));
const symbolOf = id => (dotEl(id)?.find(n => cls(n, 'dot-star')) ? 'star' : dotEl(id)?.find(n => cls(n, 'dot-circle')) ? 'circle' : null);
report('symbols (Z3): Atoms, a Zenith with its star on the map, is a star; Water, on a Port, a circle', symbolOf(atoms) === 'star' && symbolOf(water) === 'circle', `${symbolOf(atoms)}, ${symbolOf(water)}`);
report('…and the selected central kite shows no empty Nadir or Starboard (12 per star offers neither, Z2)', hits('slot').filter(n => n.dataset.kite === ck).length === 0, `${hits('slot').filter(n => n.dataset.kite === ck).map(n => n.dataset.slot).join()}`);
await tapEl(hits('kite').find(n => n.dataset.id === ck));
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
st2 = engineState();
report('one undo takes back both the completion and the deploy', !st2.dots[atoms].ignitedAt && !st2.stars[st2.dots[atoms].branch]?.deployed);

await go('#govern/stars');
await pick('By hand');
await go('#play');
await openDot(atoms);
await tapEl(hits('pill').find(n => n.dataset.action === 'open'));
await press(btn('Ignite', sheet()));
await closeSheet();
st2 = engineState();
const pillsHand = await openDot(atoms);
report('Deploy: By hand: completing a Zenith deploys nothing, and the Deploy pill is back', !st2.dots[atoms].branch && pillsHand.includes('deploy'), pillsHand.join());
await tapEl(hits('pill').find(n => n.dataset.action === 'deploy')); await tick(450);
st2 = engineState();
const s3 = st2.dots[atoms].branch;
report('…and Deploy puts its kite-less star on the map', !!st2.stars[s3]?.deployed && ofStar('slot', s3).length === 12);
await tapEl(dotEl(atoms));
hits('pill').find(n => n.dataset.action === 'withdraw').fire('pointerdown', { button: 0, pointerId: 1 });
hits('pill').find(n => n.dataset.action === 'withdraw').fire('pointerup', { button: 0, pointerId: 1 });
await tick(40);
const leaving = map().find(n => cls(n, 'layer-leaving'));
report('Withdraw: its shape, star-dots and slots shrink back into Atoms', !!leaving && leaving.all(n => n.dataset?.hit === 'slot').length === 12 && leaving.all(n => cls(n, 'kiteless-star')).length === 1, `${leaving?.all(n => n.dataset?.hit === 'slot').length ?? 0} slots, ${leaving?.all(n => cls(n, 'kiteless-star')).length ?? 0} shape shrinking`);
await tick(450);
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
report('…and undo puts it back', !!engineState().stars[s3]?.deployed);
await go('#rearrange');
await click(byNode(atoms));
const childField = tree().all(n => cls(n, 'tree-input') && n.attrs.placeholder === 'Add a child…').find(n => n.closest('.tree-box')?.dataset.node.endsWith(':1'));
childField.value = 'Bonds'; childField.fire('keydown', { key: 'Enter' }); await tick(450);
st2 = engineState();
const bonds = Object.values(st2.dots).find(d => d.name === 'Bonds')?.id;
const bondsAt = bonds && E.index(st2).dot.get(bonds);
report('Hierarchical: a child of Atoms goes on its star, the inner slot first (a Port at 12 per star, Y5, Z2)', !!bondsAt && st2.stars[s3].kites.includes(bondsAt.kite) && bondsAt.slot === 1, JSON.stringify(bondsAt));
await go('#play');
report('…and shows on the map among its slots', !!dotEl(bonds) && ofStar('slot', s3).length === 11);

await go('#govern/stars');
const askedBefore = confirmed;
await press(app.find(n => n.attrs?.['aria-label'] === 'Star-dots per star').all(n => n.tagName === 'BUTTON').find(n => text(n) === '6'));
await tick(450);
report('round 18: changing Star-dots per star asks, then starts a new session (its stars leave the map)', confirmed === askedBefore + 1 && rules().perStar === 6 && !engineState().stars[s3]?.deployed);
await go('#play'); await tick(700);   // the withdrawn star shrinks away first
await openDot(atoms);
await tapEl(hits('pill').find(n => n.dataset.action === 'deploy')); await tick(450);
st2 = engineState();
report('6 per star: the star shows its six Zeniths only', ofStar('slot', s3).length === 6, `${ofStar('slot', s3).length} slots`);
await go('#govern/stars');
await pick('All stars');
await go('#play');
report('Kites in: All stars: the same star is drawn with its six kites again (no star shape)', allKites().length === 12 && !shapes().length, `${allKites().length} kites`);
await go('#govern/stars');
await pick('Central star only');
await go('#play');
report('…and back to its star shape, no kites', allKites().length === 6 && ofStar('slot', s3).length === 6 && shapeOf(s3).length === 1);
// Stages 3–5 were built on central kites of four: 24 per star from here on.
await go('#govern/stars');
await press(app.find(n => n.attrs?.['aria-label'] === 'Star-dots per star').all(n => n.tagName === 'BUTTON').find(n => text(n) === '24'));
await tick(450);
report('24 per star (saved): the central kites offer all four slots again', rules().perStar === 24);

// ---- Stage 3: questions (Y9–Y12, Y15) ----
// Short waits between steps; the full 450 ms (the autosave's 400) only before reading the save.
const fast = async el => { el.fire('click', { preventDefault() {} }); await tick(40); };
const saved3 = async () => { await tick(450); return engineState(); };
// Stage 2 left: Central star only, 6 per star, Deploy by hand, Movement Locked, Wait 10 minutes; questions off.
await go('#govern/questions');
report('Questions: its settings are in effect (no “stage 3” marks)', !text(app).includes('in effect from stage 3'));
await pick('On');
report('Every star-dot is a question: On (saved)', rules().questions === 'on');
let st3 = engineState();
const ck2 = E.centralStar(st3).kites.find(k => k !== ck && st3.kites[k].dots.every(d => !d));
await go('#rearrange');
await click(byNode(ck2));
const nameIn = async (kite, slot, name) => {
  await click(byNode(`${kite}:${slot}`));
  const f = byNode(`${kite}:${slot}`).find(n => cls(n, 'tree-input'));
  f.value = name; f.fire('keydown', { key: 'Enter' }); await tick(60);   // P1: Enter adds
};
await nameIn(ck2, 0, 'Photosynthesis'); await nameIn(ck2, 2, 'Respiration');
st3 = await saved3();
const [photo, resp] = [st3.kites[ck2].dots[0], st3.kites[ck2].dots[2]];
// Edit mode's Star view keeps the editing map with questions on: a kite selects, then its star-dots show.
await go('#star'); await tick(700);   // the map's change animates first
await tapEl(map().find(n => n.dataset?.hit === 'kite' && n.dataset.id === ck2));
report('with questions on, Edit mode’s Star view still selects a kite and shows its star-dots', hits0('dot').some(n => n.dataset.id === photo) && text(playCard()).includes('Port') && !app.find(n => cls(n, 'qz-overlay')));
await tapEl(hits0('dot').find(n => n.dataset.id === photo));
report('…and a star-dot there selects it (its card), not the question', text(playCard()).includes('Photosynthesis') && !app.find(n => cls(n, 'qz-overlay')));
doc.fire('keydown', { key: 'Escape', target: doc }); await tick(40);
await go('#rearrange');
const field = (c, i = 0) => sheet().all(n => cls(n, c))[i];
const type = async (el, v) => { el.value = v; el.fire('change'); await tick(30); };
const openScreenOf = async id => { await click(byNode(id)); await press(btn('Open ↗', app.find(n => cls(n, 'tree-card')))); };
await openScreenOf(photo);
// Round 15 (AA9): questions are written as Markdown in the assessor (Edit questions), checked, previewed and saved.
// Round 17: the editor opens on the form; Edit as Markdown shows the same draft as Markdown.
const editQs = async () => { if (!field('sds-q-source')) { await press(btn('Write questions…', sheet()) ?? btn('Edit questions', sheet())); await press(btn('Edit as Markdown', sheet())); } };
const writeQs = async md => { await editQs(); await type(field('sds-q-source'), md); await press(btn('Save', sheet())); };
const PHOTO = '# Set: Photosynthesis\n\n## Q q1 [choice]\nWhere do the light reactions happen?\n- [ ] Stroma\n- [x] Thylakoid membrane\n- [ ] Cytosol\n- [ ] Matrix\nexplain: Photosystems sit in the thylakoid membrane.\n';
report('a star-dot’s screen in MATERIALS has Write questions…, its kind □ a question', !!btn('Write questions…', sheet()) && text(sheet()).includes('□ A question'));
await editQs();
report('…which opens its set as Markdown, from a template to fill in (AA9)', !!field('sds-q-source') && field('sds-q-source').value.includes('## Q q1 [choice]') && field('sds-q-source').value.includes('- [x]'));
await type(field('sds-q-source'), PHOTO.replace('[choice]', '[choise]').replace('- [x]', '- [ ]'));
await press(btn('Check', sheet()));
const checkBox = () => sheet().find(n => cls(n, 'sds-q-check'));
report('Check lists the errors by line, and Save keeps an unfinished draft unsaved', cls(checkBox(), 'bad') && text(checkBox()).includes('Line 3:') && text(checkBox()).includes('choise'), text(checkBox() ?? { textContent: '' }).slice(0, 120));
await press(btn('Save', sheet()));
report('…nothing saved while it has errors', !engineState().dots[photo].assessment && !!field('sds-q-source'));
await type(field('sds-q-source'), PHOTO);
await press(btn('Check', sheet()));
report('…and with them fixed it says so', cls(checkBox(), 'good') && text(checkBox()).includes('No errors: 1 question'));
await press(btn('Save', sheet()));
await tick(450);
const qSaved = () => engineState().dots[photo].assessment;
const qOne = () => qSaved()?.items[0];
report('the question, four options, the right one and the explanation are saved, as a set of one', qSaved()?.items.length === 1 && qOne().text === 'Where do the light reactions happen?' && qOne().options.map(o => o.text).join() === 'Stroma,Thylakoid membrane,Cytosol,Matrix'
  && qOne().options.findIndex(o => o.correct) === 1 && qOne().explain === 'Photosystems sit in the thylakoid membrane.' && !field('sds-q-source'), JSON.stringify(qOne()));
await editQs();
report('Edit questions shows the saved set as Markdown again', field('sds-q-source').value.includes('- [x] Thylakoid membrane') && field('sds-q-source').value.includes('explain: Photosystems'));
await press(btn('Preview', sheet()));
const pv = () => sheet().find(n => cls(n, 'sds-question-preview'));
report('Preview shows the popout as the player sees it', !!pv()?.find(n => cls(n, 'qz-card')) && text(pv()).includes('Thylakoid membrane'));
pv().all(n => cls(n, 'qz-choice'))[0].fire('click'); await tick(450);
report('…trying a wrong choice there says so, shows no correct one, and saves nothing', text(pv()).includes('Not quite') && !pv().find(n => cls(n, 'correct')) && !engineState().dots[photo].ignitedAt);
pv().all(n => cls(n, 'qz-choice'))[1].fire('click'); await tick(40);
report('…and that first choice is final there too', text(pv()).includes('Not quite') && !text(pv()).includes('Correct.'));
await press(btn('Cancel', sheet()));
await closeSheet();
await openScreenOf(resp);
await writeQs('## Q q1 [choice]\nWhat is the final electron acceptor?\n- [x] Oxygen\n- [ ] NAD+\n- [ ] Water\n- [ ] Pyruvate\n');
await closeSheet();

await go('#play');
const popout = () => app.find(n => cls(n, 'qz-popout'));
const choicesIn = () => popout().all(n => cls(n, 'qz-choice'));
const panel = () => app.find(n => cls(n, 'quiz-panel'));
const closePop = async () => fast(app.find(n => cls(n, 'qz-close')));
report('the player’s PLAY: Fit, − and + only, no layer or Designs switch, no Retired bank or kite cards', !!btn('Fit') && !app.find(n => n.attrs?.['aria-label'] === 'Layer') && !app.find(n => n.attrs?.['aria-label'] === 'Kites') && !app.find(n => cls(n, 'retired-bank')) && !!panel());
// The player's tools for a kite work on the quiz map too: a tap on a kite selects it, with its pills (9b).
await tapEl(hits('kite').find(n => !cls(n, 'empty')));
const kitePills = hits('pill').map(n => n.dataset.action);
report('the quiz map: a tap on a kite selects it, with the tools the player has (🖌 here)', kitePills.includes('design'), kitePills.join());
await tapEl(hits('pill').find(n => n.dataset.action === 'design'));
report('…🖌 opens the kite designer over it', !!app.find(n => cls(n, 'design-sheet')));
doc.fire('keydown', { key: 'Escape', target: doc }); await tick(100);
report('…Esc closes it', !app.find(n => cls(n, 'design-sheet')));
const catOf = (await saved3()).kites[ck2].color;
const count = () => panel().find(n => n.dataset?.category === String(catOf)).find(n => cls(n, 'quiz-score'))?.attrs?.title?.replace(' answered', '');   // its tooltip: "3 of 28 right"
report('…and each category’s correct / total', count() === '0 of 2 right', count());
report('every star-dot shows without selecting a kite, faded until answered, full color once complete (Y12)', !!dotEl(photo) && cls(dotEl(photo), 'q-faded') && cls(dotEl(water), 'q-lit'));
// Round 18 (was Z18's padlock): a Zenith waiting for the star-dots inside it isn't shown at all until it can be answered.
report('round 18: a Zenith waiting for those inside it isn’t on the map (nothing to tap); one that isn’t waiting, and inner star-dots, are', !dotEl(resp) && !!dotEl(atoms) && !!dotEl(photo) && !!dotEl(water));
await tapEl(dotEl(photo));
report('tapping a star-dot opens its popout (no pills, no screen)', !!popout() && !sheet() && !hits('pill').length && text(popout()).includes('Where do the light reactions happen?'));
await press(choicesIn()[0]);
report('a wrong answer says so, without revealing the correct choice', text(popout()).includes('Not quite') && !popout().find(n => cls(n, 'correct')) && text(popout()).includes('Photosystems sit'));
await press(choicesIn()[1]);
const afterWrong = await saved3();
report('the first choice is final: the others are disabled and nothing changes', choicesIn().every(n => n.disabled) && !afterWrong.dots[photo].ignitedAt);
const waited = afterWrong.waits?.[`${photo}#q1`];   // round 15: by question
report('Wait 10 minutes: its wait is saved', waited > Date.now() + 8.5 * 60000 && waited <= Date.now() + 10 * 60000, String(waited - Date.now()));
{ const o = app.find(n => cls(n, 'qz-overlay')); o.fire('click', { currentTarget: o }); await tick(40); }
report('a click outside closes it', !popout());
await tapEl(dotEl(photo));
const cd = () => text(popout().find(n => cls(n, 'qz-countdown')) ?? { textContent: '' });
const cd1 = cd();
report('reopened, it’s only a small pill: its name and the wait counting down, no question (round 18)', /^9:[45]\d$/.test(cd1) && cls(popout(), 'qz-pill') && !choicesIn().length && !text(popout()).includes('Where do the light reactions happen?') && text(popout()).includes(engineState().dots[photo].name), cd1);
const cdEl = popout().find(n => cls(n, 'qz-countdown'));
await tick(1100);
const cd2 = text(cdEl);
await tick(1100);
report('…which ticks (the same countdown, kept current once a second)', cd1 !== cd2 && cd2 !== text(cdEl) && /^9:[45]\d$/.test(text(cdEl)), `${cd1} → ${cd2} → ${text(cdEl)}`);
report('the player’s panel lists the wait', text(panel()).includes('Photosynthesis') && !!panel().find(n => cls(n, 'qz-countdown')));
await closePop();
await go('#govern/questions');
await press(btn('Retry now', app.find(n => n.attrs?.['aria-label'] === 'After a wrong answer')));
await go('#play');
await tapEl(dotEl(photo));
report('Retry now: it can be answered again at once', choicesIn().every(n => !n.disabled));
await press(choicesIn()[1]);
report('a correct answer: “Correct.” with the explanation', text(popout()).includes('Correct.') && text(popout()).includes('Photosystems sit'));
await closePop();
report('…it ignites (saved), drawn in full color, and its category counts it', !!(await saved3()).dots[photo].ignitedAt && cls(dotEl(photo), 'q-lit') && count() === '1 of 2 right', count());
await tapEl(dotEl(photo));
report('reopened, it says it’s answered (with its correct choice)', text(popout()).includes('Answered correctly') && choicesIn().every(n => n.disabled) && !!popout().find(n => cls(n, 'correct')));
await closePop();
await tapEl(dotEl(resp));
report('the Zenith opens once the star-dot inside it is answered', choicesIn().every(n => !n.disabled));
await closePop();

// Locked by the PIN: the player answers, and no undo reaches the save (found in this stage: a message’s Undo worked there).
await go('#govern/board');
await setPin('1357', '1357');
await go('#play');
const before3 = read(`saves/${SAVE}.json`);
await tapEl(dotEl(resp));
await press(choicesIn()[1]);
await closePop();
await tick(450);
report('locked by the PIN, the player answers (Retry now: a wrong one records nothing)', read(`saves/${SAVE}.json`) === before3);
await tapEl(dotEl(resp));
await press(choicesIn()[0]);
await closePop();
await tick(450);
const after3 = read(`saves/${SAVE}.json`);
report('…a correct one ignites it', after3 !== before3 && !!engineState().dots[resp].ignitedAt);
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
report('…and Ctrl+Z does nothing there', read(`saves/${SAVE}.json`) === after3);
await press(sw()); await answer('1357');
await go('#govern/board');
await press(btn('Clear the PIN')); await answer('1357'); await tick(450);

await press(btn('Start a new session'));
await tick(450);
const st3b = engineState();
report('a new session clears answers and waits, and keeps the questions', !st3b.dots[photo].ignitedAt && !Object.keys(st3b.waits ?? {}).length && st3b.dots[photo].assessment?.items[0].options[1].correct === true);
await go('#play');
report('…every star-dot faded again, its category back to 0 / 2', cls(dotEl(photo), 'q-faded') && count() === '0 of 2 right', count());

// The image (Y9): shrunk on upload to 800 px on its long side. The fake DOM has no FileReader,
// Image or canvas, so these stand in for the browser's: a 1600 × 1200 picture, and a canvas that
// records the size it's drawn at.
let drawn = null;
globalThis.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,BIG'; setTimeout(() => this.onload(), 0); } };
globalThis.Image = class { set src(v) { this.naturalWidth = 1600; this.naturalHeight = 1200; setTimeout(() => this.onload(), 0); } };
const makeEl = doc.createElement;
doc.createElement = t => {
  const el = makeEl(t);
  if (t === 'canvas') Object.assign(el, { getContext: () => ({ drawImage: (_, x, y, w, ht) => { drawn = [w, ht]; } }), toDataURL: type => `data:${type};base64,SMALL` });
  return el;
};
await go('#rearrange');
await openScreenOf(photo);
await editQs();
// Round 15 (AA9): images are added per question in Edit questions (its Images list), kept on Save.
await press(btn('Add an image…', sheet().find(n => cls(n, 'sds-q-images'))));
const fileIn = sheet().find(n => n.tagName === 'INPUT' && n.attrs.type === 'file' && n.attrs.accept === 'image/*');
fileIn.fire('change', { target: { files: [{ type: 'image/png' }] } });
await tick(50);
report('Add an image… shrinks it to 800 px on its long side (1600 × 1200 → 800 × 600), shown in the editor before Save', JSON.stringify(drawn) === '[800,600]' && !!sheet().find(n => cls(n, 'sds-question-image')) && !engineState().dots[photo].assessment.items[0].image);
await press(btn('Save', sheet()));
const withImage = await saved3();
report('…kept in the save with its question once saved, and listed with Remove when edited again', withImage.dots[photo].assessment.items[0].image === 'data:image/png;base64,SMALL'
  && (await editQs(), !!btn('Remove', sheet().find(n => cls(n, 'sds-q-images')))) && field('sds-q-source').value.includes('image: attached'), withImage.dots[photo].assessment.items[0].image);
await press(btn('Cancel', sheet()));
await closeSheet();

// Deploy: Automatically with questions (Y7, Y10): answering a Zenith correctly deploys its star.
await go('#govern/stars');
await pick('Automatically');
await go('#play');
await tapEl(dotEl(photo));
report('the popout shows the image beside the question', !!popout().find(n => n.tagName === 'IMG' && cls(n, 'qz-image')) && cls(popout().find(n => cls(n, 'qz-card')), 'has-image'));
await fast(choicesIn()[1]); await closePop(); await tick(700);   // stage 3: Atoms (decided by its child Bonds) opens and deploys its star: its animation first
await tapEl(dotEl(resp));
await fast(choicesIn()[0]); await closePop();
const deployedNow = await saved3();
const rs = deployedNow.dots[resp].branch;
report('Automatically: answering a Zenith correctly deploys its star, a kite-less star with its 24 slots', !!deployedNow.dots[resp].ignitedAt && !!deployedNow.stars[rs]?.deployed && hits('slot').filter(n => deployedNow.stars[rs].kites.includes(n.dataset.kite)).length === 24);

// Locked by the PIN, a message's Undo button doesn't undo either (found in this stage: it did).
await go('#govern/board');
await press(btn('Start a new session')); await tick(450);
await setPin('2468', '2468');
await go('#play');
await tapEl(dotEl(photo)); await fast(choicesIn()[1]); await closePop(); await tick(700);   // stage 3: Atoms deploys (its animation)
await tapEl(dotEl(resp)); await fast(choicesIn()[0]); await closePop();
await tick(450);
const lockedSave = read(`saves/${SAVE}.json`);
const toastUndo = (els.toast ?? doc).find(n => n.tagName === 'BUTTON' && text(n) === 'Undo');
report('locked: answering a Zenith deploys its star, and the message says so', !!toastUndo && text(els.toast ?? doc).includes('Deployed Respiration'), text(els.toast ?? doc).slice(0, 80));
toastUndo?.fire('click'); await tick(450);
report('…its Undo button does nothing while PLAY is locked', read(`saves/${SAVE}.json`) === lockedSave);
await press(sw()); await answer('2468');
await go('#govern/board');
await press(btn('Clear the PIN')); await answer('2468'); await tick(450);
report('(the PIN cleared again)', savedSave().pin === null);

// ---- Stage 4: Star-dots: Independent (Y6, Y8) ----
// Stage 3 left: Central star only, 6 per star, Deploy automatically, questions on (Retry now), Hierarchical.
const hierarchy = (s, ids = Object.keys(s.dots)) => JSON.stringify({
  stars: Object.fromEntries(Object.entries(s.stars).filter(([, x]) => !x.independent)),
  kites: Object.fromEntries(Object.entries(s.kites).filter(([k]) => Object.values(s.stars).some(x => !x.independent && x.kites.includes(k)))),
  branches: Object.fromEntries(ids.map(id => [id, s.dots[id]?.branch])),
});
await tick(450);
const oldDots = Object.keys(engineState().dots);
const hierBefore = hierarchy(engineState(), oldDots);
// Round 16: the lists hold the tree's star-dots too, so the items go to a category with an empty tree (its list starts empty).
const st4a = engineState();
const ckI = E.centralStar(st4a).kites.find(k => st4a.kites[k].dots.every(d => !d));
const whereOld = s => JSON.stringify(oldDots.map(d => [d, E.index(s).dot.get(d) ?? null, s.dots[d]?.branch ?? null]));
const whereBefore = whereOld(st4a);
await go('#govern/stars');
report('Star-dots: in effect (no “stage 4” mark)', !text(app).includes('in effect from stage 4'));
await pick('Independent');
report('Star-dots: Independent is saved', rules().stardots === 'independent');
await go('#play'); await tick(400);   // the old stars shrink away first
{
  const vs = E.viewState(engineState(), E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${rawSave.content}.json`)))));
  const shown = [...E.index(vs).dot.keys()];
  report('round 16: only the central kites show, each holding the first of its list (the tree’s own star-dots, as listed)', allKites().length === 6 && shown.length > 0 && shown.every(d => !!dotEl(d)) && hits('dot').length === shown.length, `${shown.length} shown`);
}
await go('#rearrange');
const sections = () => app.all(n => cls(n, 'list-section'));
const sectionOf = k => app.find(n => cls(n, 'list-section') && n.dataset.kite === k);
const rowsOf2 = k => (k ? sectionOf(k).all(n => cls(n, 'list-item')) : []);   // round 16: the other categories list their tree star-dots
report('MATERIALS shows a list per category instead of the tree', sections().length === 6 && !app.find(n => cls(n, 'tree')) && text(sectionOf(ckI)).includes('No items yet') && rowsOf2(E.centralStar(st4a).kites.find(k => k !== ckI && E.listOf(st4a, k).length)).length > 0);
const addTo = async (k, name) => { const i = sectionOf(k).find(n => cls(n, 'list-add-input')); i.value = name; i.fire('keydown', { key: 'Enter' }); await tick(40); };
for (let i = 1; i <= 11; i++) await addTo(ckI, `Item ${i}`);
let st4 = await saved3();
const items = () => st4.lists[ckI];
report('Add an item… adds them in order, to the category’s list, each with a tree place too (round 16)', items().length === 11 && items().map(d => st4.dots[d].name).join() === Array.from({ length: 11 }, (_, i) => `Item ${i + 1}`).join() && items().every(d => E.index(st4).dot.has(d)));
const rowsOf = k => sectionOf(k).all(n => cls(n, 'list-item'));
const breaksOf = k => sectionOf(k).all(n => cls(n, 'list-break')).map(text);
report('a line marks where the central kite’s items begin, and the ones not on the map yet', breaksOf(ckI).join() === 'Central kite,Not on the map yet' && sectionOf(ckI).children.find(n => cls(n, 'item-list')).children.findIndex(n => cls(n, 'list-break') && text(n) === 'Not on the map yet') === 5, breaksOf(ckI).join());
const [i1, i2] = items();
// Round 14 (Z16): no ↑ ↓; a band on each item's left is its drag handle; × deletes; the columns side by side, ◀ ▶.
const band = row => row.find(n => cls(n, 'list-band'));
report('MATERIALS’ lists: no ↑ ↓ buttons; a band on each item’s left, the only part that drags (Z16)', !btn('↑', sectionOf(ckI)) && !btn('↓', sectionOf(ckI))
  && rowsOf(ckI).every(r => r.children[0] === band(r) && band(r).attrs.draggable === 'true' && r.attrs.draggable == null));
report('…each item’s delete is a small ×, and ◀ ▶ at the top right scroll the columns (not wrapped)', rowsOf(ckI).every(r => r.find(n => cls(n, 'list-delete') && text(n) === '×' && n.attrs['aria-label'] === 'Delete…'))
  && !!app.find(n => n.attrs?.['aria-label'] === 'Scroll left') && !!app.find(n => n.attrs?.['aria-label'] === 'Scroll right') && /\.lists-page \.lists \{[^}]*flex-wrap: nowrap/.test(read('app/css/app.css')));
await fast(app.find(n => n.attrs?.['aria-label'] === 'Scroll right'));
report('…and pressing them changes nothing saved', items()[0] === i1);
band(rowsOf(ckI)[1]).fire('dragstart', { dataTransfer: null }); rowsOf(ckI)[0].fire('drop'); await tick(40);
st4 = await saved3();
report('dragging an item’s band onto another item moves it there (saved)', items()[0] === i2 && items()[1] === i1);
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(40);
st4 = await saved3();
report('…undoable', items()[0] === i1);
const nameEl = rowsOf(ckI)[0].find(n => cls(n, 'editable'));
nameEl.fire('dblclick');
const nameIn4 = rowsOf(ckI)[0].find(n => n.tagName === 'INPUT' && cls(n, 'edit-input'));
nameIn4.value = 'Water’s polarity'; nameIn4.fire('keydown', { key: 'Enter' }); await tick(40);
st4 = await saved3();
report('double-clicking an item’s name renames it', st4.dots[i1].name === 'Water’s polarity');
report('an item without a question says so', text(rowsOf(ckI)[0]).includes('no question'));
// Questions for items 1–10 (A is correct), written on their screens (↗).
const writeQ = async (row, n) => {
  await fast(btn('↗', row));
  await writeQs(`## Q q1 [choice]
Question ${n}?
${[0, 1, 2, 3].map(c => `- [${c ? ' ' : 'x'}] Answer ${n}${'ABCD'[c]}`).join(String.fromCharCode(10))}
`);
  await closeSheet();
};
await fast(btn('↗', rowsOf(ckI)[0]));
report('↗ opens its screen, with Write questions… and no Add a child…', !!btn('Write questions…', sheet()) && !sheet().find(n => cls(n, 'sds-add-child')) && text(sheet()).includes('stands alone'));
await closeSheet();
for (let n = 1; n <= 10; n++) await writeQ(rowsOf(ckI)[n - 1], n);
st4 = await saved3();
report('their questions are saved', items().slice(0, 10).every(d => E.askable(st4.dots[d].assessment)) && !st4.dots[items()[10]].assessment);
const last = items()[10];
await fast(rowsOf(ckI)[10].find(n => cls(n, 'list-delete')));
st4 = await saved3();
report('× asks, then takes the item out of its list', items().length === 10 && !st4.dots[last]);
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(40);
st4 = await saved3();
report('…undoable', items().length === 11 && items()[10] === last);

await go('#play');
const itemAt = n => items()[n - 1];
report('PLAY: the first four items fill the central kite (Nadir, Port, Starboard, Zenith: the Zenith hidden until the three are answered, round 18); the rest aren’t on the map yet', [1, 2, 3].every(n => !!dotEl(itemAt(n))) && !dotEl(itemAt(4)) && !dotEl(itemAt(5))
  && E.index(E.viewState(st4, E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${rawSave.content}.json`)))))).dot.get(itemAt(4))?.slot === E.ZENITH);
const ckCount = () => panel().find(n => n.dataset?.category === String(st4.kites[ckI].color)).find(n => cls(n, 'quiz-score'))?.attrs?.title?.replace(' answered', '');   // its tooltip: "3 of 28 right"
report('the player’s panel counts the category’s whole list', ckCount() === '0 of 11 right', ckCount());
report('Independent too: the Zenith item isn’t on the map until the three inside it are answered (round 18)', !dotEl(itemAt(4)) && [1, 2, 3].every(n => !!dotEl(itemAt(n))));
for (const n of [1, 2, 3, 4]) { await tapEl(dotEl(itemAt(n))); await fast(choicesIn()[0]); await closePop(); }
st4 = await saved3();
const ind = Object.values(st4.stars).find(s => s.independent);
report('answering the Zenith item deploys an independent star of its category (automatically)', !!ind && ind.deployed && ind.category === ckI && ind.sources[0] === itemAt(4) && st4.dots[itemAt(4)].branch !== ind.id);   // round 16: its branch, if any, is its tree star
report('…without a “Deployed X’s star” message: under Independent the star isn’t the item’s', !text(els.toast ?? doc).includes(`Deployed ${st4.dots[itemAt(4)].name}`), text(els.toast ?? doc).slice(0, 80));
const vs4 = () => E.viewState(st4, E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${rawSave.content}.json`)))));
report('…holding the rest (items 5–11), the Nadirs first, faded until answered', [5, 6, 7, 8, 9, 10, 11].every(n => !!dotEl(itemAt(n)) && cls(dotEl(itemAt(n)), 'q-faded'))
  && [5, 6, 7, 8, 9, 10].every(n => E.index(vs4()).dot.get(itemAt(n))?.slot === 0));
report('…and the panel counts 4 / 11', ckCount() === '4 of 11 right', ckCount());
const free5 = [5, 6, 7, 8, 9, 10].find(n => true);
await tapEl(dotEl(itemAt(free5))); await fast(choicesIn()[0]); await closePop();
st4 = await saved3();
report('an item on the new star is answered on its own (nothing rolls up)', !!st4.dots[itemAt(free5)].ignitedAt && !st4.dots[itemAt(4)].trained === false && ckCount() === '5 of 11 right', ckCount());
await go('#rearrange');
report('the lists mark where Star 2’s items begin (all on the map now)', breaksOf(ckI).join() === 'Central kite,Star 2', breaksOf(ckI).join());
await go('#schedule');
const schedNames4 = app.all(n => cls(n, 'sch-row')).map(r => text(r.find(n => cls(n, 'sch-name'))));
const onStar2 = [5, 6, 7, 8, 9, 10].filter(n => n !== free5).map(n => `Item ${n}`);
report('SCHEDULE (By star-dot): the items on Star 2 at the top, as items of their own, none with children', onStar2.every(n => schedNames4.includes(n)) && !app.find(n => cls(n, 'sch-toggle') && !cls(n, 'none')), schedNames4.join(', '));

await go('#govern/stars');
await pick('Hierarchical');
await go('#play'); await tick(400);
st4 = await saved3();
// Round 16: Photosynthesis’s category lists its tree star-dots now; both answered, it completed under Independent, so they’re hidden this session.
const catPhoto = st4.kites[E.index(st4).dot.get(photo).kite].color;
report('back to Hierarchical: the old star-dots return (Photosynthesis’s category complete: its list was all answered); the items stay in the tree (round 16)', !!dotEl(water) && (E.categoryComplete(st4, catPhoto) ? !dotEl(photo) && !dotEl(resp) : !!dotEl(photo) && !!dotEl(resp)) && items().every(d => E.index(st4).dot.has(d)), [!!dotEl(photo), !!dotEl(water), !!dotEl(resp), E.categoryComplete(st4, catPhoto)].join());
report('…every old star-dot where it was before Independent, with its branch', whereOld(await saved3()) === whereBefore);
await go('#rearrange');
report('…and MATERIALS shows the tree again', !!app.find(n => cls(n, 'tree')) && !sections().length);
await go('#govern/stars');
await pick('Independent');
await go('#play');
report('Independent again: the items and their star are back as they were', !!dotEl(itemAt(1)) && !!dotEl(itemAt(10)) && cls(dotEl(itemAt(free5)), 'q-lit'));

await go('#govern/board');
await press(btn('Start a new session')); await tick(450);
st4 = engineState();
report('a new session removes the independent stars and clears the answers; the lists and questions stay', !Object.values(st4.stars).some(s => s.independent) && items().length === 11 && !st4.dots[itemAt(1)].ignitedAt && E.askable(st4.dots[itemAt(1)].assessment));

// ---- Stage 5: goals, completing a category, sessions (Y13, Y14) ----
// Stage 4 left: Independent, Central only, 6 per star, Deploy automatically, questions on, a fresh
// session; the first category's list has 11 items, 10 with questions.
await go('#govern/questions');
report('Goal question: in effect (no “stage 5” mark)', !text(app).includes('in effect from stage 5'));
const goalIn = app.find(n => n.attrs?.['aria-label'] === 'Correct answers before the goal');
goalIn.value = '4'; goalIn.fire('change'); await tick(450);
report('Goal after 4 correct (saved)', rules().goalAfter === 4);
await go('#play'); await tick(400);   // the last session's star shrinks away first
const catCk = engineState().kites[ckI].color;
const catRow = () => panel().find(n => n.dataset?.category === String(catCk));
for (const n of [1, 2, 3]) { await tapEl(dotEl(itemAt(n))); await fast(choicesIn()[0]); await closePop(); }
let st5 = await saved3();
report('three correct: no goal yet (it comes after 4)', !st5.goals?.[catCk] && !text(catRow()).includes('Goal'));
await tapEl(dotEl(itemAt(4))); await fast(choicesIn()[0]); await closePop();
st5 = await saved3();
const goalDot = st5.goals?.[catCk];
// None unanswered was on the map until the Zenith deployed the next star: the goal comes from its star-dots, in the same change.
report('the category’s new star is a faint star shape with its star-dots on it', map().all(n => cls(n, 'kiteless-star')).length === 1);
report('four correct (the Zenith): its star deploys and the goal is picked among the star-dots it just brought, saved', Object.values(st5.stars).some(s => s.independent) && !!goalDot && [5, 6, 7, 8, 9, 10].map(itemAt).includes(goalDot), goalDot);
report('…its fill fades in and out on the map (q-goal), with no ring around it (Z4); the others don’t', cls(dotEl(goalDot), 'q-goal') && !dotEl(goalDot).find(n => cls(n, 'dot-ring')) && [5, 6, 7, 8, 9, 10].map(itemAt).filter(d => d !== goalDot).every(d => !cls(dotEl(d), 'q-goal')));
report('…and the panel says “Goal: find the twinkling star-dot”', text(catRow()).includes('Goal: find the twinkling star-dot'));
const other = [5, 6, 7, 8, 9, 10].map(itemAt).find(d => d !== goalDot);
await tapEl(dotEl(other)); await fast(choicesIn()[0]); await closePop();
st5 = await saved3();
report('answering another one doesn’t complete it; the goal stays', st5.goals[catCk] === goalDot && !st5.complete?.[catCk]);
await tapEl(dotEl(goalDot)); await fast(choicesIn()[0]);
report('answering the goal: “Correct.”', text(popout()).includes('Correct.'));
await closePop();
st5 = await saved3();
report('…completes the category for the session (saved)', Number.isFinite(st5.complete?.[catCk]));
report('…the panel’s bar says Done (P1)', text(catRow()).includes('Done') && !text(catRow()).includes('Goal'));
const indStar = Object.values(st5.stars).find(s => s.independent);
const doneKites = () => hits('kite').filter(n => cls(n, 'complete'));
report('…its central kite and its star are drawn filled (the star as a filled star shape), with no star-dots', doneKites().length === 7
  && doneKites().some(n => n.dataset.id === ckI) && indStar.kites.every(k => doneKites().some(n => n.dataset.id === k))
  && st5.lists[ckI].every(d => !dotEl(d)) && !map().all(n => cls(n, 'kiteless-star')).some(n => n.dataset.star === indStar.id), `${doneKites().length} filled`);
const fillOf = n => n.attrs.fill;
const catColor = JSON.parse(read(`content/${rawSave.content}.json`)).categories[catCk].color;
report('…in the category’s own color', doneKites().every(n => fillOf(n) === catColor), fillOf(doneKites()[0]));
const phases = () => new Set(doneKites().map(n => n.dataset.phase));
report('…each twinkling with its own phase (the central kite’s differs from its star’s)', phases().size === 2, [...phases()].join(' | '));
const css = read('shared/ui/map.css');
const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'), css.indexOf('@keyframes sl-goal'));
const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g, '');   // every block that runs only without reduce-motion
report('…and the twinkle (color to clear, round 12) and the goal’s fading (its fill) only run without the reduce-motion setting', /\.kite\.complete \{ animation: sl-twinkle/.test(motion) && /q-goal \.dot-circle \{ animation: sl-goal/.test(motion)
  && /@keyframes sl-twinkle \{[^@]*50% \{ fill-opacity: 0; \}/.test(css) && /@keyframes sl-goal \{[^@]*fill: var\(--dot\)/.test(css) && !/animation:/.test(outside.replace(/@keyframes[^\n]*/g, '')));
// Round 13: GOVERN › Look › The map: Twinkle speed and Background lattice (the content set's).
// The content set in use may have its own (the developer's choice): the copy starts at Normal and Shown.
const speed = label => app.find(n => n.attrs?.['aria-label'] === 'Twinkle speed').all(n => n.tagName === 'BUTTON').find(n => text(n) === label);
const was13 = `${rules().twinkle ?? 'normal'}, lattice ${rules().lattice ?? 'shown'}`;
await go('#govern/look');
if (!cls(speed('Normal'), 'on')) await press(speed('Normal'));
if (rules().lattice === 'hidden') await pick('Shown');
await go('#play'); await tick(400);
report('round 13: the twinkle and the goal’s fade take their period from the map (--twinkle-period, --goal-period; Normal 5.2 s, P1)',
  /sl-twinkle var\(--twinkle-period/.test(motion) && /sl-goal var\(--goal-period/.test(motion) && map().dataset.twinkle === '5200' && [...phases()].every(p => ['0ms', '-1733ms', '-3466ms'].includes(p)),
  `${[...phases()].join(' | ')}; the content set in use has ${was13}`);
const normalPhases = [...phases()].sort();
// A phase's index (0, 1, 2) from its Normal delay, and what it is at another period (map.js: −index × round(period / 3)).
const phasesAt = period => normalPhases.map(p => `${-Math.round(-parseInt(p) / 1733) * Math.round(period / 3) || 0}ms`).sort().join();
await go('#govern/look');
await press(speed('Fast'));
report('Twinkle speed: Fast (saved in the content set)', rules().twinkle === 'fast' && cls(speed('Fast'), 'on'));
await pick('Hidden');
report('Background lattice: Hidden (saved in the content set)', rules().lattice === 'hidden');
await go('#play'); await tick(400);
report('…PLAY twinkles at 2.6 s a cycle (Fast, P1), the phases a third of that apart', map().dataset.twinkle === '2600' && [...phases()].sort().join() === phasesAt(2600) && phases().size === 2, [...phases()].join(' | '));
report('…and draws no lattice lines, its positions still there (clickable, drawn on hover or when selected)', !map().all(n => cls(n, 'lattice') || cls(n, 'lattice-star')).length
  && hits('pos').length > 0 && hits('pos').every(n => cls(n, 'quiet')) && map().classList.contains('no-lattice'));
await go('#govern/look');
await press(speed('Very slow'));
await go('#play'); await tick(400);
report('Very slow (saved): PLAY twinkles at 20.8 s a cycle (P1), its phases a third of that apart', rules().twinkle === 'veryslow' && map().dataset.twinkle === '20800'
  && [...phases()].sort().join() === phasesAt(20800), [...phases()].join(' | '));
await go('#govern/look');
await press(speed('Normal')); await pick('Shown');
await go('#play'); await tick(400);
report('…back to Normal and Shown: the lattice lines return', rules().twinkle === 'normal' && rules().lattice === 'shown' && map().dataset.twinkle === '5200'
  && map().all(n => cls(n, 'lattice')).length > 0 && !hits('pos').some(n => cls(n, 'quiet')));
report('the other categories are untouched (no goal, not complete)', Object.keys(st5.complete).join() === String(catCk) && Object.keys(st5.goals).join() === String(catCk));
await go('#rearrange');
await fast(btn('↗', rowsOf(ckI)[10]));
await writeQs(`## Q q1 [choice]
Question 11?
- [x] Answer 11A
- [ ] Answer 11B
- [ ] Answer 11C
- [ ] Answer 11D
`);
await closeSheet();
await tick(450);
const closed = E.questionState(engineState(), E.derive(engineState(), { ...E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${rawSave.content}.json`)))), now: Date.now() }), itemAt(11), Date.now());
report('a closed branch: nothing in the category can be answered (questionState “complete”)', closed.kind === 'complete', closed.kind);

await go('#govern/board');
await press(btn('Start a new session')); await tick(450);
st5 = engineState();
report('a new session clears goals and completed categories, removes the independent star, keeps the lists and questions', !Object.keys(st5.goals ?? {}).length && !Object.keys(st5.complete ?? {}).length
  && !Object.values(st5.stars).some(s => s.independent) && st5.lists[ckI].length === 11 && E.askable(st5.dots[itemAt(11)].assessment));
await go('#play'); await tick(400);
report('…and PLAY shows the category’s kite again, its items faded (the Zenith hidden again), nothing filled', !doneKites().length && [1, 2, 3].every(n => cls(dotEl(itemAt(n)), 'q-faded')) && !dotEl(itemAt(4)) && ckCount() === '0 of 11 right' && text(catRow()).includes('0%'));
