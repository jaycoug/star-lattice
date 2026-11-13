// Usage: node deckflow.js <copy of the project>: P6, the Deck view, on the copy's Quiz bank with
// its questions imported (Independent, Quiz mode on). Six decks; a deck's sub-decks are the map's
// stars (the central kite's four, then the rest locked until their star is on the map); a card's
// front is its name and first question, its back the star-dot screen, where answering it right
// completes it here and on the map; ← → and Space; Play mode keeps the locked sub-deck shut; Edit
// mode reorders and adds as the lists do.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const SAVE = 'Quiz bank';
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
const E = await import(`file://${ROOT}/shared/engine/index.js`);
{   // The questions, imported (as importflow does), and the player given the Deck view.
  const { importQuiz } = await import(`file://${ROOT}/tools/import_quiz.js`);
  let raw = JSON.parse(read(`saves/${SAVE}.json`));
  let c = JSON.parse(read(`content/${raw.content}.json`));
  if (!Object.values(raw.state.lists ?? {}).some(l => l.length)) ({ save: raw, content: c } = importQuiz(raw, c, read('test/fixtures/quiz-bank.md')));
  GLib.file_set_contents(`${ROOT}/saves/${SAVE}.json`, JSON.stringify(raw, null, 2));
  GLib.file_set_contents(`${ROOT}/content/${raw.content}.json`, JSON.stringify({ ...c, player: { ...c.player, deck: true } }, null, 2));
}
const { els, doc, resize } = install(ROOT, '/app/', { save: SAVE });
let hash = '#deck';
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
const go = async h => { location.hash = h; await tick(150); resize(); await tick(50); };
const click = async el => { el.fire('click'); await tick(450); };
const key = async k => { doc.fire('keydown', { key: k, target: doc }); await tick(200); };
const saved = () => E.normalizeSave(JSON.parse(read(`saves/${SAVE}.json`)));
const card = () => app.find(n => cls(n, 'deck-card'));
const subs = () => app.all(n => cls(n, 'deck-sub'));
const btn = label => app.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const st0 = saved().state;
const central = E.centralStar(st0);
const k0 = central.kites[0];
const list0 = () => E.listOf(saved().state, k0);

report('Edit mode’s Deck view: six decks, one per category, each with its count', app.all(n => cls(n, 'deck-cat')).length === 6 && text(app.find(n => cls(n, 'deck-cat'))).includes(`0/${list0().length}`));
report('the first deck’s sub-decks: the central kite’s four, then the rest, 🔒 Locked', subs().map(s => s.dataset.sub).join() === '0,rest' && text(subs()[0]).includes('0/4') && cls(subs()[1], 'locked') && text(subs()[1]).includes('Locked'), subs().map(text).join(' | '));
report('the Deck never speaks of the map', !/map/i.test(text(app.find(n => cls(n, 'deck-page')))));
const first = list0()[0];
const dot = id => saved().state.dots[id];
report('the first card’s front: its name only (no description here, so blank; the question is on the back)', card()?.dataset.card === first && text(card()).includes(dot(first).name) && !text(card()).includes(E.questionsOf(dot(first).assessment)[0].text.slice(0, 20)) && !/description/i.test(text(card())));
report('…1 of 4 · Central kite', text(app.find(n => cls(n, 'deck-pos'))).startsWith('1 of 4 · Central kite'));
await key('ArrowRight');
report('→ moves to the next card', card()?.dataset.card === list0()[1]);
await key('ArrowLeft');
await key(' ');
report('Space flips it: the back is its star-dot screen, with the Assessor', card()?.dataset.card === first && !!card().find(n => cls(n, 'sds')) && !!card().find(n => cls(n, 'sds-assessor')));
const q = dot(first).assessment.items[0];
const right = q.options.findIndex(o => o.correct);
await click(card().find(n => cls(n, 'qz-choice') && n.dataset.choice === String(right)));
report('answering it right on the back completes it (saved)', dot(first).ignitedAt != null);
report('…the deck counts it, and so does the Star view (one progress)', text(subs()[0]).includes('1/4')
  && (await go('#star'), E.derive(E.viewState(saved().state, E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${saved().content}.json`))))), E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${saved().content}.json`))))).effective(first).status === 'ignited'));
await go('#deck');
await click(subs()[1]);
await key(' ');
report('a locked card’s back (Edit mode) says so in the Deck’s words, not the map’s', text(card().find(n => cls(n, 'sds-assessor'))).includes('This card is locked') && !/on the map|place it/i.test(text(card())), text(card().find(n => cls(n, 'sds-assessor')) ?? { textContent: '' }).slice(0, 140));
await click(subs()[0]);

// ---- Play mode: the locked sub-deck stays shut ----
const fieldOrder = () => E.fieldOrder(saved().state, k0, E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${saved().content}.json`)))));
await go('#play/deck');
report('Play mode offers the Deck (given in Design › Player)', hash === '#play/deck' && !!card());
const rest = subs().at(-1);
report('…its locked sub-deck (not on the map yet) can’t be opened', rest.dataset.sub === 'rest' && (rest.disabled === true || rest.attrs.disabled != null));
for (let i = 0; i < 8; i++) await key('ArrowRight');
report('…→ stops at the central kite’s fourth card', card()?.dataset.card === fieldOrder()[3] && text(app.find(n => cls(n, 'deck-pos'))).startsWith('4 of 4'), text(app.find(n => cls(n, 'deck-pos')) ?? { textContent: '' }));
report('…and no Move or Add (Editing the lists is off for the player)', !btn('← Move earlier') && !app.find(n => cls(n, 'deck-add-input')));

// ---- Walking the central kite's four opens the next sub-deck (its star deploys) ----
await go('#deck');
for (const id of fieldOrder().slice(0, 4)) {
  if (dot(id).ignitedAt != null) continue;
  while (card()?.dataset.card !== id) await key(fieldOrder().indexOf(card().dataset.card) < fieldOrder().indexOf(id) ? 'ArrowRight' : 'ArrowLeft');
  if (!card().find(n => cls(n, 'sds'))) await key(' ');
  const qq = dot(id).assessment.items[0];
  const choice = card().find(n => cls(n, 'qz-choice') && n.dataset.choice === String(qq.options.findIndex(o => o.correct)));
  if (choice) await click(choice);
}
report('the central kite’s four answered on their cards (saved)', fieldOrder().slice(0, 4).every(id => dot(id).ignitedAt != null), fieldOrder().slice(0, 4).map(id => dot(id).ignitedAt != null).join());
const deployBtn = card().find(n => n.tagName === 'BUTTON' && text(n).startsWith('Deploy'));
if (deployBtn) await click(deployBtn);   // Deploy: by hand (automatically, it already has)
report('its star on the map opens the next sub-deck: Star 2, holding the cards that were locked (a kited star takes 24)', subs().map(s => s.dataset.sub).join() === '0,1' && !cls(subs()[1], 'locked') && text(subs()[1]).includes('Star 2') && text(subs()[1]).includes('/24'), subs().map(text).join(' | '));
await go('#play/deck');
report('…and in Play mode it opens too', !subs()[1].disabled && subs()[1].attrs.disabled == null && text(subs()[1]).includes('Star 2'));

// ---- Edit mode edits the same items ----
await go('#deck');
await click(subs()[0]);
const before = list0();
const at = before.indexOf(card().dataset.card);
await click(btn('Move later →'));
report('Move later → swaps it with the next item in the list (saved)', at >= 0 && list0()[at + 1] === before[at] && list0()[at] === before[at + 1]);
const input = app.find(n => cls(n, 'deck-add-input'));
input.value = 'A new card';
input.fire('keydown', { key: 'Enter' }); await tick(450);
report('Add a card… adds it to the end of its category’s deck, and shows it', list0().length === before.length + 1 && dot(list0().at(-1)).name === 'A new card' && card()?.dataset.card === list0().at(-1));
await key(' ');
report('…its back never speaks of the map', !!card().find(n => cls(n, 'sds')) && !/on the map|place it/i.test(text(card())), text(card().find(n => cls(n, 'sds-assessor')) ?? { textContent: '' }).slice(0, 120));
await click(app.all(n => cls(n, 'deck-cat'))[2]);
report('another deck opens on its own first card', card()?.dataset.card === E.listOf(saved().state, central.kites[2])[0]);
