// Usage: gjs -m qsetflow.js <copy of the project>: round 15 (AA1–AA10): question sets on the copy's
// outlook (Hierarchical, questions off). MATERIALS › Import questions… reads
// test/fixtures/problem-set.md: its errors, its preview (each set to a child of Statistics › Problem set)
// and the import (one undo step, the five children □). Then part 1 is answered on Problem set's screen:
// typed blanks, numbers, choices, a chain answered in order, a recall with Count it as right, a step;
// progress is saved and the last right answer ignites it. Edit questions shows a set as Markdown.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const SAVE = 'outlook';
const { els, doc, resize } = install(ROOT, '/app/', { save: SAVE });
let hash = '#rearrange';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
const E = await import(`file://${ROOT}/shared/engine/index.js`);
const raw0 = JSON.parse(read(`saves/${SAVE}.json`));
const content = E.normalizeContent(JSON.parse(read(`content/${raw0.content}.json`)));
// The steps below answer under Retry now (the life content set's own rule; a copy, so nothing real changes).
if (content.rules.stardots !== 'hierarchical' || content.rules.questions !== 'off') print(`note: ${raw0.content} isn't Hierarchical with questions off; the copy is set so`);
{
  const c = JSON.parse(read(`content/${raw0.content}.json`));
  c.rules = { ...c.rules, stardots: 'hierarchical', questions: 'off', wrong: { mode: 'retry', minutes: 5 } };
  GLib.file_set_contents(`${ROOT}/content/${raw0.content}.json`, JSON.stringify(c, null, 2));
}
{
  // Problem set's children as before any import (the real save may have its questions already, or progress).
  const st = E.normalizeSave(raw0).state;
  const v = E.derive(st, { ...E.optionsFrom(content), stardots: 'hierarchical', questions: 'off', now: Date.now() });
  const at = E.resolvePath(st, v, 'Statistics > Problem set').dot;
  for (const d of at ? v.children(at) : []) {
    const x = raw0.state.dots[d];
    delete x.assessment; delete x.answered; x.ignitedAt = null; x.role = 'check';
    for (const k of Object.keys(raw0.state.waits ?? {})) if (k === d || k.startsWith(d + '#')) delete raw0.state.waits[k];
  }
  GLib.file_set_contents(`${ROOT}/saves/${SAVE}.json`, JSON.stringify(raw0));
}
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const go = async h => { location.hash = h; await tick(100); resize(); await tick(50); };
const btn = (label, root = app) => root?.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const press = async el => { el.fire('click', { preventDefault() {} }); await tick(60); };
const saved = async () => { await tick(450); return E.normalizeSave(JSON.parse(read(`saves/${SAVE}.json`))).state; };
const type = async (el, v) => { el.value = v; el.fire('input', { target: el }); el.fire('change', { target: el }); await tick(30); };
const imp = () => app.find(n => cls(n, 'q-import'));
const sheet = () => app.find(n => cls(n, 'sds-sheet') && !cls(n, 'q-import'));

const st0 = await saved();
const view0 = E.derive(st0, { ...E.optionsFrom(content), stardots: 'hierarchical', questions: 'off', now: Date.now() });
const hw = E.resolvePath(st0, view0, 'Statistics > Problem set').dot;
const parts = (hw ? view0.children(hw) : []).sort((x, y) => st0.dots[x].name.localeCompare(st0.dots[y].name));   // 1.–5., whatever their places on the kite
report('the copy has Statistics › Problem set, its children 1.–5.', !!hw && parts.map(d => st0.dots[d].name).join() === '1.,2.,3.,4.,5.', parts.map(d => st0.dots[d].name).join());
const md = read('test/fixtures/problem-set.md');
const file = E.parseQuestions(md);
report('test/fixtures/problem-set.md reads without errors: five sets, every question ready (AA10)', !file.errors.length && file.sets.length === 5 && file.sets.every(E.askable), `${file.errors.length} errors`);

await go('#rearrange');
await press(btn('Import questions…'));
report('MATERIALS › Import questions… opens the import sheet', !!imp() && !!imp().find(n => cls(n, 'q-import-text')));
await type(imp().find(n => cls(n, 'q-import-text')), '# Set: Broken\ntarget: Statistics > Problem set > 1.\n\n## Q a [choice]\nA?\n- [ ] one\n- [ ] two\n');
report('a file with errors lists them by line, and nothing can be imported', text(imp()).includes('Line 6:') && text(imp()).includes('Mark the right option') && btn('Import', imp().find(n => cls(n, 'buttons') && !!n.find(x => cls(x, 'q-import-go'))))?.disabled === true);
await type(imp().find(n => cls(n, 'q-import-text')), md);
const rows = () => imp().all(n => cls(n, 'q-row'));
const total = file.sets.reduce((n, s) => n + E.questionsOf(s).length, 0);
report('the preview: five sets, each to its child of Problem set (AA8)', rows().length === 5 && rows().every((r, i) => text(r).includes(`Statistics › Problem set › ${i + 1}.`)) && !imp().find(n => cls(n, 'q-errors')),
  rows().map(r => text(r).slice(-34)).join(' | '));
const go1 = app.find(n => cls(n, 'q-import-go'));
report(`…and Import 5 sets (${total} questions)`, text(go1) === `Import 5 sets (${total} questions)` && !go1.disabled, text(go1));
await press(go1);
let st = await saved();
report('imported: each child has its set and is □ (needs assessment), the sheet closed', !imp() && parts.every((d, i) => st.dots[d].role === 'assess' && E.questionsOf(st.dots[d].assessment).length === E.questionsOf(file.sets[i]).length));
report('…no “Every star-dot is a question” needed: questions stay off', JSON.parse(read(`content/${raw0.content}.json`)).rules.questions === 'off');
doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); st = await saved();
report('the import is one undo step', parts.every(d => !st.dots[d].assessment && st.dots[d].role === 'check'));
doc.fire('keydown', { key: 'y', ctrlKey: true, target: doc }); st = await saved();
report('…and redo brings it back', parts.every(d => st.dots[d].role === 'assess' && !!st.dots[d].assessment));
await press(btn('Import questions…'));
await type(imp().find(n => cls(n, 'q-import-text')), md);
report('importing again: Replace or Append for star-dots that have questions', !!btn('Replace its questions', imp()) && !!btn('Append to them', imp()) && text(rows()[0]).includes('replaced'));
await press(btn('Cancel', imp()));

// ---- Answering part 1 on Problem set's screen ----
await go('#rearrange');
// Problem set's box, or (when the tree shows it folded under its parent) its parent's screen, then Open ›.
const boxOf = id => app.find(n => cls(n, 'tree-box') && n.dataset.node === id);
if (boxOf(hw)) await press(boxOf(hw).find(n => cls(n, 'tree-open')));
else {
  const top = E.parentOf(st, hw);
  if (!boxOf(top)) { boxOf(E.index(st).dot.get(top).kite).fire('click'); await tick(450); }   // open its kite in the tree
  await press(boxOf(top).find(n => cls(n, 'tree-open')));
  await press(btn('Open ›', sheet().find(n => cls(n, 'sds-item') && n.dataset.child === hw)));
}
report('Problem set’s screen: 1.–5. are □ bullets in its checklist', !!sheet() && parts.every(d => sheet().find(n => cls(n, 'sds-item') && n.dataset.child === d)?.find(n => cls(n, 'sds-bullet') && cls(n, 'box'))));
const row = d => sheet().find(n => cls(n, 'sds-item') && n.dataset.child === d);
const assessor = () => sheet().find(n => cls(n, 'sds-assessor'));
await press(row(parts[0]).find(n => cls(n, 'sds-bullet-btn')));
const qs = () => assessor().find(n => cls(n, 'qs'));
const cardEl = () => assessor().find(n => cls(n, 'qz-card'));
const set1 = file.sets[0];
const graded = E.gradedOf(set1);
report('clicking 1.’s bullet shows its set in the Assessor: progress, the list of questions, its first question', !!qs() && text(qs()).includes(`0 of ${graded.length} right`) && qs().all(n => cls(n, 'qs-chip')).length === E.questionsOf(set1).length && cardEl()?.dataset.q === 'load', cardEl()?.dataset.q);
report('…the set’s context and its chain’s context above it, chains grouped in the list', text(assessor()).includes('31 black cherry trees') && qs().all(n => cls(n, 'qs-chain')).length === set1.items.filter(i => i.type === 'chain').length && !!assessor().find(n => cls(n, 'qs-context')));
const blankIn = () => cardEl().all(n => cls(n, 'qs-blank'));
await type(blankIn()[0], 'load(trees)');
await press(btn('Check', cardEl()));
report('a wrong blank: Not quite, Try again (Retry now), nothing saved', text(cardEl()).includes('Not quite') && !!btn('Try again', cardEl()) && !(await saved()).dots[parts[0]].answered);
await press(btn('Try again', cardEl()));
await type(blankIn()[0], 'data( trees )');
await press(btn('Check', cardEl()));
st = await saved();
report('the right one (spacing doesn’t matter): Correct, its explanation, saved; 1. is in training', text(cardEl()).includes('Correct.') && text(cardEl()).includes('data() loads') && !!st.dots[parts[0]].answered?.load
  && E.derive(st, { ...E.optionsFrom(content), now: Date.now() }).effective(parts[0]).status === 'training', `${text(cardEl()).slice(0, 160)} | ${JSON.stringify(st.dots[parts[0]].answered)} ${E.derive(st, { ...E.optionsFrom(content), now: Date.now() }).effective(parts[0]).status}`);
report('…its □ bullet half-filled in the checklist', cls(row(parts[0]).find(n => cls(n, 'sds-bullet')), 'half'));
const chip = id => qs().find(n => cls(n, 'qs-chip') && n.dataset.q === id);
await press(chip('hr-race'));
report('a chain runs in order: its second question waits for its first (AA5)', text(cardEl()).includes('Answer the questions before it in this chain first') && !cardEl().find(n => cls(n, 'qs-number') && !n.disabled));
await press(chip('events'));
await type(cardEl().find(n => cls(n, 'qs-number')), '28');
await press(btn('Check', cardEl()));
report('a number read off the console (28 degrees of freedom)', text(cardEl()).includes('Correct.'));
await press(btn('Next ›', cardEl()));
report('Next › goes on to the next open question', cardEl().dataset.q === 'hr-race', cardEl().dataset.q);
await type(cardEl().find(n => cls(n, 'qs-number')), '4.7082');
await press(btn('Check', cardEl()));
report('…within its decimals (4.708 to 3 decimals takes 4.7082)', text(cardEl()).includes('Correct.'));
// refs comes after factor in its chain: factor first.
await press(chip('factor'));
await type(blankIn()[0], 'trees$size <- factor(trees$size, labels = c("Small", "Medium", "Large"))');
await press(btn('Check', cardEl()));
report('a whole line typed into a blank, spacing as you like', text(cardEl()).includes('Correct.'));
await press(chip('refs'));
const choices = () => cardEl().all(n => cls(n, 'qz-choice'));
await press(choices()[1]);
report('a wrong choice shows its feedback, not the right option', text(cardEl()).includes('Not quite') && text(cardEl()).includes('levels sort as stored') && !cardEl().find(n => cls(n, 'qz-choice') && cls(n, 'correct') && !cls(n, 'picked')));
await press(btn('Try again', cardEl()));
await press(choices()[0]);
report('…and the right one is Correct', text(cardEl()).includes('Correct.'));
await press(chip('r-csfit'));
await type(cardEl().find(n => cls(n, 'qs-recall')), 'fit <- lm(Volume ~ 0, data = trees)');
await press(btn('Check', cardEl()));
report('a recall that differs says where (“0”), with Count it as right', text(cardEl()).includes('differs from the answer at “0”') && !!btn('Count it as right', cardEl()));
await press(btn('Count it as right', cardEl()));
report('…which marks it right (the self-grade)', text(cardEl()).includes('Correct.') && !!(await saved()).dots[parts[0]].answered?.['r-csfit']);
await press(chip('setup'));
report('a step: its text and code to copy, and Done (not graded)', !!btn('Done', cardEl()) && !!cardEl().find(n => cls(n, 'rt-copy')));
await press(btn('Done', cardEl()));
report('…Done moves on', cardEl().dataset.q !== 'setup');

// Every other question, answered right from the file itself.
const fillRight = async q => {
  await press(chip(q.id));
  if (q.kind === 'choice') return press(choices()[q.options.findIndex(o => o.correct)]);
  if (q.kind === 'blank') { for (const [i, el] of blankIn().entries()) await type(el, q.blanks[i][0]); }
  if (q.kind === 'number') await type(cardEl().find(n => cls(n, 'qs-number')), String(q.answer));
  if (q.kind === 'recall') await type(cardEl().find(n => cls(n, 'qs-recall')), q.answer);
  await press(btn('Check', cardEl()));
};
st = await saved();
for (const q of graded.filter(x => !st.dots[parts[0]].answered?.[x.id])) {
  if (st.dots[parts[0]].ignitedAt) break;
  await fillRight(q);
}
st = await saved();
const ev = E.derive(st, { ...E.optionsFrom(content), now: Date.now() });
report('the last right answer ignites 1. (AA2): its progress clears, The star-dot ignites', ev.effective(parts[0]).status === 'ignited' && !st.dots[parts[0]].answered && text(cardEl()).includes('The star-dot ignites'), ev.effective(parts[0]).status);
report('…and Problem set counts it (1 of 5)', ev.support(hw)?.ignited === 1 && ev.support(hw)?.total === 5, JSON.stringify(ev.support(hw)));
await press(chip('load'));
report('…its questions now show as answered', text(cardEl()).includes('Answered correctly'));

// Edit questions: the set as Markdown, checked.
await press(row(parts[1]).find(n => cls(n, 'sds-bullet-btn')));
await press(btn('Edit questions', assessor()));
await press(btn('Edit as Markdown', assessor()));   // round 17: the editor opens on the form
const src = () => assessor().find(n => cls(n, 'sds-q-source'));
report('Edit questions shows 2.’s set as Markdown (AA9)', !!src() && src().value.includes('## Chain: The model without height') && src().value.includes('### Q mod2 [blank]'));
await press(btn('Check', assessor()));
report('…Check: no errors', text(assessor().find(n => cls(n, 'sds-q-check'))).startsWith('No errors: 9 questions, 8 graded'), text(assessor().find(n => cls(n, 'sds-q-check'))));
await press(btn('Cancel', assessor()));

// Round 17 (AB1): the form. Part 4 is two chains: they show as groups of cards; a new question is
// a card that says what it needs; Save waits until it's done; ↑ moves it;
// Edit as Markdown and back keep the draft.
await press(row(parts[3]).find(n => cls(n, 'sds-bullet-btn')));
await press(btn('Edit questions', assessor()));
const cards = () => assessor().all(n => cls(n, 'qf-card'));
const set4 = file.sets[3];
report('AB1: Edit questions opens the form: a card per question, chains as groups, no Markdown box', cards().length === E.questionsOf(set4).length && assessor().all(n => cls(n, 'qf-chain')).length === 2 && !src(), `${cards().length} cards`);
report('…every card of a finished set reads as ready', cards().every(c => cls(c, 'ready')));
await press(btn('+ Add a question', assessor()));
const newCard = () => cards().at(-1);
const problemsOf = c => text(c.find(n => cls(n, 'qf-problems')));
report('+ Add a question adds a multiple-choice card that says what it needs', cards().length === E.questionsOf(set4).length + 1 && newCard().all(n => cls(n, 'qf-choice')).length === 4
  && ['Write the question.', 'Choice A is empty.', 'Tick the right choice'].every(t => problemsOf(newCard()).includes(t)), problemsOf(newCard()));
await press(btn('Save', assessor()));
report('…Save keeps it unsaved while something is missing, and says so', !!assessor().find(n => cls(n, 'qf-not-saved')) && E.questionsOf((await saved()).dots[parts[3]].assessment).length === E.questionsOf(set4).length);
newCard().find(n => cls(n, 'qf-kind')).fire('change', { target: { value: 'number' } }); await tick(60);
report('changing its kind to Number shows the answer, decimals, ± and units', !!newCard().find(n => cls(n, 'qf-number')) && !!newCard().find(n => cls(n, 'qf-tolerance')) && !newCard().find(n => cls(n, 'qf-choice')));
await type(newCard().find(n => cls(n, 'qf-text')), 'How many events are there?');
await type(newCard().find(n => cls(n, 'qf-number')), '347');
report('…filled in, the card reads as ready', cls(newCard(), 'ready') && !problemsOf(newCard()), problemsOf(newCard()));
await press(btn('↑', newCard()));
const topIds = () => assessor().find(n => cls(n, 'qf-cards')).children.map(c => cls(c, 'qf-chain') ? 'chain' : c.dataset.q);
report('↑ moves it above the second chain', topIds().join() === 'chain,q10,chain', topIds().join());
await press(btn('Edit as Markdown', assessor()));
report('Edit as Markdown shows the same draft: the new question', !!src() && src().value.includes('## Q q10 [number]') && src().value.includes('answer: 347'));
await press(btn('Back to the form', assessor()));
report('…and Back to the form brings the cards back', cards().length === E.questionsOf(set4).length + 1 && !src());
await press(btn('Save', assessor()));
{
  const s4 = (await saved()).dots[parts[3]].assessment;
  report('Save keeps it: the new number question second', E.questionsOf(s4).length === E.questionsOf(set4).length + 1 && s4.items[1].id === 'q10' && s4.items[1].answer === 347 && !cards().length,
    `${E.questionsOf(s4).length} questions, ${s4.items.map(i => i.id).join()}`);
}
// Round 17 (AB2): Paste questions… in the form: plain text becomes cards, errors by line first.
await press(btn('Edit questions', assessor()));
const n4 = cards().length;
await press(btn('Paste questions…', assessor()));
const pasteIn = () => assessor().find(n => cls(n, 'qf-paste-text'));
await type(pasteIn(), '1. Which test compares two survival curves?\nA) t-test\nB) Log-rank\n\n2. How many deaths?\nAnswer: 12\n');
await press(btn('Add them', assessor()));
report('AB2: Paste questions… says what’s missing by line, adding nothing', text(assessor()).includes('Line 1:') && text(assessor()).includes('no Answer: line') && cards().length === n4);
await type(pasteIn(), '1. Which test compares two survival curves?\nA) t-test\nB) Log-rank\nAnswer: B\n\n2. How many deaths?\nAnswer: 12\n');
await press(btn('Add them', assessor()));
report('…fixed, its questions are cards at the end, ready, with new ids', cards().length === n4 + 2 && cards().slice(-2).every(c => cls(c, 'ready')) && cls(cards().at(-2), 'choice') && cls(cards().at(-1), 'number')
  && new Set(cards().map(c => c.dataset.q)).size === cards().length && text(assessor()).includes('Added 2 questions'), cards().slice(-2).map(c => c.dataset.q).join());
await press(btn('Save', assessor()));
report('…and Save keeps them', E.questionsOf((await saved()).dots[parts[3]].assessment).length === n4 + 2);
report('nothing on the screen reads as broken', !/TypeError|undefined|NaN/.test(text(sheet())));

// PLAY (questions off): a selected □ star-dot with questions has Answer, which opens the popout with
// only its questions (no screen, no editing); an answer there is saved.
await go('#play');
const pmap = () => app.find(n => cls(n, 'sl-map'));
const hits = kind => pmap().all(n => n.dataset?.hit === kind);
const tap = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(60); };
const p2 = parts[1];
await tap(hits('kite').find(n => n.dataset.id === E.index(st).dot.get(p2).kite));
await tap(hits('dot').find(n => n.dataset.id === p2));
const answerPill = () => hits('pill').find(n => n.dataset.action === 'answer');
report('PLAY: selecting 2. shows an Answer pill beside ↗, and Answer on its card', !!answerPill() && !!hits('pill').find(n => n.dataset.action === 'open') && !!btn('Answer', app.find(n => cls(n, 'play-card'))));
await tap(answerPill());
const pop = () => app.find(n => cls(n, 'qz-popout'));
report('…Answer opens the popout: 2.’s questions only, no screen, no Edit questions', !!pop()?.find(n => cls(n, 'qs')) && !sheet() && !btn('Edit questions', pop()) && text(pop()).includes('2.'), text(pop()).slice(0, 120));
const pcard = () => pop().find(n => cls(n, 'qz-card'));
const q2 = E.gradedOf(file.sets[1]).find(q => q.id === pcard().dataset.q);   // the question it opens on (first in its chain)
if (q2.kind === 'choice') await press(pcard().all(n => cls(n, 'qz-choice'))[q2.options.findIndex(o => o.correct)]);
else {
  if (q2.kind === 'blank') for (const [i, el] of pcard().all(n => cls(n, 'qs-blank')).entries()) await type(el, q2.blanks[i][0]);
  if (q2.kind === 'number') await type(pcard().find(n => cls(n, 'qs-number')), String(q2.answer));
  if (q2.kind === 'recall') await type(pcard().find(n => cls(n, 'qs-recall')), q2.answer);
  await press(btn('Check', pcard()));
}
report('…a right answer in the popout is Correct and saved', text(pcard()).includes('Correct.') && !!(await saved()).dots[p2].answered?.[q2.id], `${q2.id} (${q2.kind})`);
await press(pop().find(n => cls(n, 'qz-close')));
report('…× closes it, back on PLAY', !pop() && !sheet());

// Round 17 (AB3): Import questions… reads plain text; without targets, A new star-dot per question
// under a picked star-dot makes each question a new □ child, named by its first line.
await go('#rearrange');
await press(btn('Import questions…'));
const PLAIN = '1. What does a Cox-Snell plot check?\nA) Overall fit\nB) Outliers\nAnswer: A\n\n2. Martingale residuals check the ____ of a covariate.\nAnswer: functional form; form\n\n3. How many deviance residuals exceed 2?\nAnswer: 3\n';
await type(imp().find(n => cls(n, 'q-import-text')), PLAIN);
report('AB3: plain text reads: Where they go, Into one star-dot by default, its star-dot to choose', !!imp().find(n => cls(n, 'q-where')) && rows().length === 1 && !!imp().find(n => cls(n, 'q-pick')) && text(rows()[0]).includes('The questions'));
await press(btn('A new star-dot per question', imp()));
const under = imp().find(n => cls(n, 'q-under'));
under.fire('change', { target: { value: hw } }); await tick(60);
report('…A new star-dot per question under Problem set: three new children, named by their first lines', rows().length === 3 && rows().every(r => text(r).includes('New:')) && text(rows()[1]).includes('Martingale residuals check the … of a covariate.'), rows().map(r => text(r).slice(0, 60)).join(' | '));
await press(app.find(n => cls(n, 'q-import-go')));
{
  const s = await saved();
  const v = E.derive(s, { ...E.optionsFrom(content), now: Date.now() });
  const kids = v.children(hw).map(d => s.dots[d]).filter(d => !['1.', '2.', '3.', '4.', '5.'].includes(d.name));
  report('…imported: each is a □ child of Problem set with its one question', kids.length === 3 && kids.every(d => d.role === 'assess' && E.questionsOf(d.assessment).length === 1) && kids.map(d => d.assessment.items[0].kind).join() === 'choice,blank,number', kids.map(d => d.name).join(' | '));
}


// Round 17 (AB4): GOVERN › Questions › Shuffle choices On: PLAY's popout shows a choice question's
// options in its attempt's order (the same when reopened), and Off in the written order.
const p3 = parts[2];
const q3 = E.gradedOf(file.sets[2]).find(q => q.kind === 'choice' && q.options.length >= 3 && !q.options.some(o => /\b[A-H]\s*(and|or|,)\s*[A-H]\b/.test(o.text)));
const shownOrder = async () => {
  await go('#play');
  const pm = () => app.find(n => cls(n, 'sl-map'));
  const ph = kind => pm().all(n => n.dataset?.hit === kind);
  const tapIt = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(60); };
  const s = await saved();
  await tapIt(ph('kite').find(n => n.dataset.id === E.index(s).dot.get(p3).kite));
  await tapIt(ph('dot').find(n => n.dataset.id === p3));
  await tapIt(ph('pill').find(n => n.dataset.action === 'answer'));
  const popEl = () => app.find(n => cls(n, 'qz-popout'));
  await press(popEl().find(n => cls(n, 'qs-chip') && n.dataset.q === q3.id));
  const order = popEl().all(n => cls(n, 'qz-choice')).map(n => Number(n.dataset.choice));
  await press(popEl().find(n => cls(n, 'qz-close')));
  return { order, st: s };
};
const before = await shownOrder();
report('AB4: with Shuffle choices Off, a choice question shows its options as written', before.order.join() === q3.options.map((_, i) => i).join(), before.order.join());
await go('#govern/questions');
app.all(n => n.tagName === 'INPUT' && n.attrs.name === 'shuffleChoices')[1].fire('change'); await tick(450);
report('…GOVERN › Questions › Shuffle choices: On is saved in the content set', JSON.parse(read(`content/${raw0.content}.json`)).rules.shuffleChoices === 'on');
const on1 = await shownOrder();
const want = E.choiceOrder(q3, `${E.attemptSeed(on1.st, p3)}|${q3.id}`, true);
report('…then its options show in this attempt’s shuffled order, every option once', on1.order.join() === want.join() && [...on1.order].sort().join() === q3.options.map((_, i) => i).join(), `${on1.order.join()} (wanted ${want.join()})`);
const on2 = await shownOrder();
report('…and the same order when it’s opened again (the attempt keeps it)', on2.order.join() === on1.order.join());
