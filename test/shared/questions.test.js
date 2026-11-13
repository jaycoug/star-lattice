// Round 9, stage 3 (Y9–Y12, Y15): assessments, answering, waits, the question's state, progress by
// category, and sessions clearing waits.

import { test, assertEqual } from '../runner.js';
import {
  createState, centralStar, derive, placeDot, ignite, normalizeSave, startSession, newSave, SAVE_FORMAT, FORMAT_VERSION,
  assessmentValue, askable, setAssessment, answerQuestion, questionState, waitLeft, waitsAt, fitSize, categoryProgress, ZENITH,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const MIN = 60 * 1000;
const Q = { question: 'Which is a lipid?', choices: ['Glucose', 'Cholesterol', 'Alanine', 'Adenine'], correct: 1, explanation: 'Sterols are lipids.' };
const WAIT = { now: NOW, locks: 'off', questions: 'on', wrong: { mode: 'wait', minutes: 10 } };
const RETRY = { ...WAIT, wrong: { mode: 'retry', minutes: 10 } };

/** A state with one questioned star-dot on central kite 0's Nadir: [state, dotId, kiteId]. */
function one(slot = 0, q = Q) {
  let st = createState();
  const k = st.stars[centralStar(st).id].kites[0];
  let d;
  [st, d] = placeDot(st, k, slot, 'q');
  return [setAssessment(st, d, q), d, k];
}

// Round 15: a round 9 assessment (one multiple-choice question) loads as a set of one choice question, q1.
const first = a => a.items[0];
test('Y9, AA1: an older assessment becomes a set of one choice question; its correct index among its choices, an image only as a data:image URL', () => {
  assertEqual(assessmentValue(null), null);
  const a = assessmentValue({ question: 'Q', choices: ['a', 'b'], correct: 7, image: 'http://x/y.png', explanation: 5 });
  assertEqual(first(a), { type: 'q', id: 'q1', kind: 'choice', text: 'Q', image: null, hints: [], explain: '5',
    options: [{ text: 'a', correct: false, feedback: '' }, { text: 'b', correct: false, feedback: '' }], shuffle: 'default' }, 'a correct index out of range marks none');
  assertEqual(first(assessmentValue({ choices: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], correct: 4 })).options.length, 8, 'up to eight options');
  assertEqual(first(assessmentValue({ choices: ['1', '2', '3', '4', '5'], correct: 4 })).options.map(o => o.correct), [false, false, false, false, true]);
  assertEqual(first(assessmentValue({ image: 'data:image/jpeg;base64,AAAA' })).image, 'data:image/jpeg;base64,AAAA');
  assertEqual([askable(assessmentValue(Q)), askable(assessmentValue({ ...Q, choices: ['a', '', 'c', 'd'] })), askable(assessmentValue({ ...Q, question: ' ' }))], [true, false, false]);
});

test('Y9: assessments and waits are kept in the save, cleaned on loading', () => {
  const [st, d] = one();
  const raw = { format: SAVE_FORMAT, version: FORMAT_VERSION, content: 'x', title: 't', state: { ...st, waits: { [d]: NOW + MIN, ghost: NOW, [d + 'x']: 'soon' } } };
  const back = normalizeSave(JSON.parse(JSON.stringify(raw))).state;
  assertEqual(back.dots[d].assessment, assessmentValue(Q));
  assertEqual(back.waits, { [d + '#q1']: NOW + MIN }, 'round 15: an older wait (by star-dot) goes to its first question');
  assertEqual(newSave({ id: 'x', start: { central: [0, 1, 2, 3, 4, 5] }, categories: Array.from({ length: 6 }, (_, i) => ({ name: 'C' + i })) }).state.waits, {});
});

test('Y9: the image shrinks to 800 px on its long side, never enlarged', () => {
  assertEqual([fitSize(1600, 1200), fitSize(600, 2400), fitSize(300, 200)], [[800, 600], [200, 800], [300, 200]]);
});

test('Y10: a correct answer ignites the star-dot; a wrong one doesn’t, and nothing reveals the right choice', () => {
  const [st, d] = one();
  const right = answerQuestion(st, d, 1, WAIT);
  assertEqual([right.correct, right.problem, derive(right.state, WAIT).effective(d).status], [true, null, 'ignited']);
  const wrong = answerQuestion(st, d, 0, WAIT);
  assertEqual([wrong.correct, wrong.problem, derive(wrong.state, WAIT).effective(d).status], [false, null, 'open']);
  assertEqual(Object.keys(wrong).sort(), ['correct', 'problem', 'result', 'state']);
  assertEqual(Object.keys(wrong.result).sort(), ['correct', 'feedback'], 'the result carries no correct choice');
  assertEqual(answerQuestion(right.state, d, 1, WAIT).problem, 'It’s already answered.');
  assertEqual(answerQuestion(st, d, 9, WAIT).problem, 'Choose one of its answers.');
});

test('Y11: Wait N minutes closes that star-dot until its time passes; the others stay open; Retry now records nothing', () => {
  let [st, d, k] = one();
  let other;
  [st, other] = placeDot(st, k, 1, 'other');
  st = setAssessment(st, other, Q);
  const w = answerQuestion(st, d, 0, WAIT).state;
  assertEqual(waitLeft(w, d, NOW), 10 * MIN);
  assertEqual(questionState(w, derive(w, WAIT), d, NOW + MIN), { kind: 'waiting', until: NOW + 10 * MIN });
  assertEqual(answerQuestion(w, d, 1, { ...WAIT, now: NOW + MIN }).problem, 'It’s waiting after a wrong answer.');
  assertEqual(questionState(w, derive(w, WAIT), other, NOW).kind, 'open', 'the others stay open');
  assertEqual(questionState(w, derive(w, WAIT), d, NOW + 10 * MIN).kind, 'open', 'open again once its time passes');
  assertEqual(waitsAt(w, NOW, WAIT), [{ dot: d, q: 'q1', until: NOW + 10 * MIN }], 'round 15: by question');
  const done = answerQuestion(w, d, 1, { ...WAIT, now: NOW + 10 * MIN }).state;
  assertEqual(done.waits, {}, 'a correct answer clears its wait');
  assertEqual(answerQuestion(st, d, 0, RETRY).state, st, 'Retry now: nothing recorded');
  assertEqual([questionState(w, derive(w, RETRY), d, NOW).kind, waitsAt(w, NOW, RETRY)], ['open', []], 'under Retry now, an old wait doesn’t hold');
});

test('Y10: why a star-dot can’t be answered: no question, inside first (Y5), its kite locked, children decide it', () => {
  let [st, d, k] = one(ZENITH);
  assertEqual(questionState(st, derive(st, WAIT), d, NOW).kind, 'open');
  let inner;
  [st, inner] = placeDot(st, k, 0, 'inner');
  const central = { ...WAIT, kites: 'central' };
  assertEqual(questionState(st, derive(st, central), d, NOW).kind, 'inside');
  assertEqual(questionState(st, derive(st, central), inner, NOW).kind, 'none', 'no question yet');
  st = setAssessment(st, inner, Q);
  st = answerQuestion(st, inner, 1, central).state;
  assertEqual(questionState(st, derive(st, central), d, NOW).kind, 'open', 'open once the star-dot inside it is answered');
  assertEqual(questionState(st, derive(st, central), inner, NOW).kind, 'answered');
});

test('Y15: each category’s correct / total among the star-dots on the map', () => {
  let [st, d, k] = one();
  let e;
  [st, e] = placeDot(st, k, 1, 'e');
  st = setAssessment(st, e, Q);
  st = answerQuestion(st, d, 1, WAIT).state;
  const p = categoryProgress(st, derive(st, WAIT), 6);
  assertEqual(p[st.kites[k].color], { correct: 1, total: 2 });
  assertEqual(p.filter(x => x.total).length, 1);
});

test('Y14: a new session clears answers and waits; with nothing to clear only its shuffle seed changes (round 17)', () => {
  let [st, d, k] = one();
  let e;
  [st, e] = placeDot(st, k, 1, 'e');
  st = setAssessment(st, e, Q);
  st = answerQuestion(st, d, 1, WAIT).state;
  st = answerQuestion(st, e, 0, WAIT).state;
  const fresh = startSession(st);
  assertEqual([fresh.dots[d].ignitedAt, fresh.dots[d].trained, fresh.waits], [null, false, {}]);
  assertEqual(fresh.dots[d].assessment, assessmentValue(Q), 'the questions stay');
  assertEqual(startSession(fresh, 'next'), { ...fresh, seed: 'next' });
  const plain = ignite(createState(), 'none', NOW);
  assertEqual(startSession(plain, 'next'), { ...plain, seed: 'next' });
  assertEqual(startSession(plain).seed !== plain.seed, true, 'a new seed by default');
});
