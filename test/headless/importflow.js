// Usage: node importflow.js <copy of the project>: a question bank's import and a play-through under
// the quiz settings, on the copy's Quiz bank save. If the copy's save isn't imported yet, the import
// (tools/import_quiz.js) runs on it first, from test/fixtures/quiz-bank.md; if it is, it's checked as it stands. Either way every question must match the file and its
// answer key. Then: the quiz settings, the player's PLAY, the lists, answering from the key, a
// whole category played through to complete, and a new session.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const SAVE = 'Quiz bank';
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const E = await import(`file://${ROOT}/shared/engine/index.js`);
const { parseQuiz, importQuiz } = await import(`file://${ROOT}/tools/import_quiz.js`);
const MD = 'test/fixtures/quiz-bank.md';
const cats = parseQuiz(read(MD));
// The answer key read straight from the file, apart from the tool's parser, so a misread key can't agree with itself.
const keyText = read(MD).slice(read(MD).indexOf('## Answer key'));
const KEY = new Map([...keyText.matchAll(/(Q\d{3}) \*\*([A-D])\*\*/g)].map(m => [m[1], 'ABCD'.indexOf(m[2])]));
let raw = JSON.parse(read(`saves/${SAVE}.json`));
const already = Object.values(raw.state.lists ?? {}).some(l => l.length);
if (!already) {
  const { save, content } = importQuiz(raw, JSON.parse(read(`content/${raw.content}.json`)), read(MD));
  GLib.file_set_contents(`${ROOT}/saves/${SAVE}.json`, JSON.stringify(save, null, 2));
  GLib.file_set_contents(`${ROOT}/content/${raw.content}.json`, JSON.stringify(content, null, 2));
  raw = save;
}
report(`the copy’s ${SAVE} ${already ? 'is already imported (checked as it stands)' : 'was imported here, from the questions file'}`, true);
let content = E.normalizeContent(JSON.parse(read(`content/${raw.content}.json`)));
const st0 = E.normalizeSave(raw).state;
const central = E.centralStar(st0);
const listOfCat = i => E.listOf(st0, central.kites.find(k => st0.kites[k].color === i));
report('six lists of 28, in the file’s order: Q001–Q028 in its first category … Q141–Q168 in its sixth', [0, 1, 2, 3, 4, 5].every(i => listOfCat(i).length === 28
  && listOfCat(i).map(d => st0.dots[d].name).join() === cats[i].questions.map(x => x.id).join()));
const mismatch = cats.flatMap((c, i) => c.questions.filter((x, j) => {
  const set = st0.dots[listOfCat(i)[j]].assessment;   // round 15: a set of one choice question
  const a = set?.items.length === 1 && set.items[0].kind === 'choice' ? set.items[0] : null;
  return !a || a.text !== x.question || a.options.map(o => o.text).join('|') !== x.choices.join('|') || a.options.findIndex(o => o.correct) !== KEY.get(x.id) || a.options.filter(o => o.correct).length !== 1 || a.explain !== '' || a.image !== null;
}).map(x => x.id));
report('every item’s question, four choices and correct letter match the file and its key (168 key entries); no explanations or images', KEY.size === 168 && mismatch.length === 0, mismatch.slice(0, 5).join(', '));
// The real save is in use (answers, stars, goals): the play-through starts its copy on a fresh
// session, as Start a new session… would (the questions and lists stay; the real save is untouched).
{
  const st = E.normalizeSave(raw).state;
  const progress = Object.values(st.dots).filter(d => d.ignitedAt != null || d.trained).length;
  const stars = Object.values(st.stars).filter(x => x.independent).length;
  if (progress || stars || Object.keys(st.goals ?? {}).length || Object.keys(st.complete ?? {}).length || Object.keys(st.waits ?? {}).length) {
    raw = { ...raw, state: E.startSession(st) };
    GLib.file_set_contents(`${ROOT}/saves/${SAVE}.json`, JSON.stringify(raw, null, 2));
  }
  report('the copy starts on a fresh session', true, progress || stars ? `the save in use had ${progress} answered and ${stars} independent star${stars === 1 ? '' : 's'}: cleared on the copy` : 'it had no progress');
}
// The play-through below follows the import's own settings (24 per star, no goal); the content set
// in use may have others (the developer's choice): its copy is set back to the import's first.
{
  const c = JSON.parse(read(`content/${raw.content}.json`));
  const was = `${c.rules.stardots ?? 'independent'}, ${c.rules.perStar ?? 24} per star, goal after ${c.rules.goalAfter ?? 0}, wrong answers ${c.rules.wrong?.mode ?? 'retry'}`;
  c.rules = { ...c.rules, stardots: 'independent', perStar: 24, goalAfter: 0, wrong: { mode: 'retry', minutes: c.rules.wrong?.minutes ?? 5 }, shuffleChoices: 'off', shuffleQuestions: 'off' };   // round 17: the developer set Wait 1 minute   // round 16: the developer tried Hierarchical on it
  GLib.file_set_contents(`${ROOT}/content/${raw.content}.json`, JSON.stringify(c, null, 2));
  report('the copy plays with the import’s settings: 24 per star, no goal', true, `the content set in use has ${was}`);
}
content = E.normalizeContent(JSON.parse(read(`content/${raw.content}.json`)));
report('the content set has the quiz settings: Central star only, Independent, Automatically, questions on', content.rules.kites === 'central' && content.rules.stardots === 'independent' && content.rules.deploy === 'auto' && content.rules.questions === 'on', JSON.stringify(content.rules));

const { els, doc, resize } = install(ROOT, '/app/', { save: SAVE });
let hash = '#play';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const map = () => app.find(n => cls(n, 'sl-map'));
const hits = kind => map().all(n => n.dataset?.hit === kind);
const dotEl = id => hits('dot').find(n => n.dataset.id === id);
const go = async h => { location.hash = h; await tick(100); resize(); await tick(50); };
const tapEl = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(60); };
const fast = async el => { el.fire('click', { preventDefault() {} }); await tick(40); };
const popout = () => app.find(n => cls(n, 'qz-popout'));
const choicesIn = () => popout().all(n => cls(n, 'qz-choice'));
const closePop = async () => fast(app.find(n => cls(n, 'qz-close')));
const panel = () => app.find(n => cls(n, 'quiz-panel'));
const count = i => panel().find(n => n.dataset?.category === String(i)).find(n => cls(n, 'quiz-score'))?.attrs?.title?.replace(' answered', '');   // its tooltip: "3 of 28 right"
const saved = async () => { await tick(450); return E.normalizeSave(JSON.parse(read(`saves/${SAVE}.json`))).state; };
const keyOf = id => KEY.get(id);
const nameOf = d => st0.dots[d].name;

report('PLAY is the player’s: each category’s first three items on its central kite, faded (its Zenith, the fourth, hidden until they’re answered); the panel counts 0 of 28 right each', hits('dot').length === 18 && hits('dot').every(n => cls(n, 'q-faded'))
  && [0, 1, 2, 3, 4, 5].every(i => count(i) === '0 of 28 right') && !app.find(n => n.attrs?.['aria-label'] === 'Layer'), `${hits('dot').length} star-dots`);
await go('#rearrange');
const sections = app.all(n => cls(n, 'list-section'));
report('MATERIALS: six lists of 28, each marking its central kite’s four and the rest not on the map yet', sections.length === 6
  && sections.every(x => x.all(n => cls(n, 'list-item')).length === 28 && x.all(n => cls(n, 'list-break')).map(text).join() === 'Central kite,Not on the map yet'));
await go('#play');
const c0 = listOfCat(0);
await tapEl(dotEl(c0[0]));
report('Q001’s popout shows its question from the file and its four choices', !!popout() && text(popout()).includes(cats[0].questions[0].question.slice(0, 60)) && choicesIn().length === 4);
const wrongOf = d => (keyOf(nameOf(d)) + 1) % 4;
await fast(choicesIn()[wrongOf(c0[0])]);
report('a choice that isn’t the key’s is wrong', text(popout()).includes('Not quite'));
await closePop();
await tapEl(dotEl(c0[0]));
await fast(choicesIn()[keyOf('Q001')]);
report('the key’s letter is correct (Retry now: at once)', text(popout()).includes('Correct.'));
await closePop();
report('Q004, the Zenith, isn’t on the map while Q002 and Q003 inside it wait (round 18)', !dotEl(c0[3]));
// Play the first category through, in list order (inner rings come before their Zeniths).
const answerAll = async ids => {
  const missing = [];
  for (const d of ids) {
    const el = dotEl(d);
    if (!el) { missing.push(nameOf(d)); continue; }
    await tapEl(el);
    // Round 12: a Zenith answered may deploy a star (empty, once the list has run out); the map holds taps while it animates.
    if (!popout()) { await tick(400); await tapEl(dotEl(d)); }
    if (!popout()) { missing.push(`${nameOf(d)} (no popout)`); continue; }
    await fast(choicesIn()[keyOf(nameOf(d))]); await closePop();
  }
  return missing;
};
const m1 = await answerAll(c0.slice(1, 4));
let st = await saved();
const star = Object.values(st.stars).find(s => s.independent);
// Round 18: its Zeniths are hidden until those inside them are answered.
const evOf = s => { const o = { ...E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${raw.content}.json`)))), now: Date.now() }; return E.derive(E.viewState(s, o), o); };
report('answering Q002–Q004 deploys the category’s star (24 per star), holding Q005–Q028 (its Zeniths hidden until they can be answered)', !m1.length && !!star && c0.slice(4).every(d => (evOf(st).insideFirst(d) ? !dotEl(d) : !!dotEl(d))) && c0.slice(4).some(d => evOf(st).insideFirst(d)), m1.join());
const m2 = await answerAll(c0.slice(4, 27));
st = await saved();
// Round 12: the list has run out on the first star, yet its Zeniths facing a free position still
// deploy (empty stars); a star-dot's symbol is drawn only where an item is (no empty slots).
const empties = Object.values(st.stars).filter(s => s.independent && s.id !== star.id && s.deployed);
report('round 12: answered Zeniths facing a free position deploy stars after the list has run out, empty: no star-dot symbols, no empty slots',
  empties.length >= 1 && hits('slot').length === 0 && empties.every(s => !hits('dot').some(n => s.kites.includes(n.dataset.kite))) && map().all(n => cls(n, 'kiteless-star')).length === 1 + empties.length,
  `${empties.length} empty stars, ${hits('slot').length} empty slots`);
const zen = c0.slice(4).filter(d => E.index(E.viewState(st, E.optionsFrom(content))).dot.get(d)?.slot === E.ZENITH);
const freeZen = zen.filter(d => { const f = E.derive(st, E.optionsFrom(content)).facing(d); return f && !f.reserved && !f.holder; });
report('round 12: every Zenith facing a free position is drawn as a star (deployable), with no limit past the list', freeZen.length > 0 && freeZen.every(d => cls(dotEl(d), 'deployable')), `${freeZen.length} free of ${zen.length}`);
const m3 = await answerAll(c0.slice(27));
st = await saved();
report('all 28 answered from the key, in order', !m2.length && !m3.length && c0.every(d => !!st.dots[d].ignitedAt), [...m2, ...m3].slice(0, 5).join());
const catColor = content.categories[0].color;
const filled = hits('kite').filter(n => cls(n, 'complete'));
const catStars = Object.values(st.stars).filter(s => s.independent && s.category === star.category && s.deployed).length;
report('without a goal, the last answer completes the category: its central kite and stars (empty ones too) filled, the panel’s bar “Done”, 28 / 28',
  Number.isFinite(st.complete?.[0]) && filled.length === 1 + 6 * catStars && filled.every(n => n.attrs.fill === catColor) && count(0) === '28 of 28 right' && text(panel().find(n => n.dataset?.category === '0')).includes('Done'), `${filled.length} filled`);
report('the other five categories are untouched', [1, 2, 3, 4, 5].every(i => count(i) === '0 of 28 right') && Object.keys(st.complete).join() === '0');

globalThis.confirm = () => true;
await go('#govern/board');
await fast(app.find(n => n.tagName === 'BUTTON' && text(n).startsWith('Start a new session')));
st = await saved();
report('a new session: answers and the completion cleared, the star removed, the 168 questions kept', !Object.keys(st.complete).length && !Object.values(st.stars).some(s => s.independent)
  && Object.values(st.dots).every(d => d.ignitedAt == null) && Object.values(st.lists).reduce((n, l) => n + l.length, 0) === 168);
await go('#play'); await tick(400);
report('…PLAY back to the start: 18 faded star-dots (the Zeniths hidden), 0 of 28 right each', hits('dot').length === 18 && [0, 1, 2, 3, 4, 5].every(i => count(i) === '0 of 28 right'));

// Round 18: GOVERN › Questions › Shuffle the questions (Independent): asks, starts a new session,
// and the field fills in a new order; MATERIALS keeps the list's order and says it's shuffled.
const optsNow = () => E.optionsFrom(E.normalizeContent(JSON.parse(read(`content/${raw.content}.json`))));
await go('#govern/questions');
const shuffleQ = () => app.all(n => n.tagName === 'INPUT' && n.attrs.name === 'shuffleQuestions');
report('round 18: Shuffle the questions is offered under Independent', shuffleQ().length === 2 && shuffleQ().every(n => n.attrs.disabled == null));
let asked = '';
const seedBefore = (await saved()).seed;
globalThis.confirm = m => { asked = m; return true; };
shuffleQ()[1].fire('change'); await tick(450);
st = await saved();
const c0k = E.centralStar(st).kites.find(k => st.kites[k].color === 0);
const firstFour = E.fieldOrder(st, c0k, optsNow()).slice(0, 4);
report('…turning it on asks first, says a new session starts, saves it, and starts one (a new seed)', asked.includes('starts a new session') && optsNow().shuffleQuestions === 'on' && st.seed !== seedBefore);
await go('#play'); await tick(400);
report('…the first category’s central kite shows the shuffled order’s first three, its fourth (the Zenith) hidden until they’re answered, not the list’s', firstFour.slice(0, 3).every(d => !!dotEl(d)) && !dotEl(firstFour[3]) && firstFour.join() !== E.listOf(st, c0k).slice(0, 4).join(),
  firstFour.map(d => st.dots[d].name).join(','));
await go('#rearrange');
const sec0 = () => app.find(n => cls(n, 'list-section') && n.dataset.kite === c0k);
report('…MATERIALS keeps the list’s order, with a note instead of the Central kite / Star 2 lines', sec0().all(n => cls(n, 'list-item')).map(n => n.dataset.item).join() === E.listOf(st, c0k).join()
  && !!sec0().find(n => cls(n, 'list-shuffled')) && !sec0().find(n => cls(n, 'list-break')));
globalThis.confirm = () => true;
