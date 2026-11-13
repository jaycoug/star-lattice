// Round 9, stage 5 (Y13, Y14): goals after N correct, completing a category, closed branches, sessions.

import { test, assertEqual } from '../runner.js';
import {
  createState, centralStar, derive, addItem, placeDot, setAssessment, answerQuestion, settleGoals, autoDeploy, deployStar, deleteDot,
  questionState, startSession, freshBoard, normalizeSave, SAVE_FORMAT, FORMAT_VERSION, categoryComplete, goalOf, index, project, ZENITH,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const Q = { question: 'Q?', choices: ['a', 'b', 'c', 'd'], correct: 0, explanation: '' };
const BASE = { now: NOW, locks: 'off', stardots: 'independent', kites: 'central', perStar: 24, questions: 'on', deploy: 'auto', wrong: { mode: 'retry', minutes: 5 } };

/** Central kite 0's category with `n` questioned items: [state, kiteId, ids, category]. */
function quiz(n) {
  let st = createState();
  const k = st.stars[centralStar(st).id].kites[0];
  const ids = [];
  for (let i = 0; i < n; i++) { let id; [st, id] = addItem(st, k, 'i' + i); st = setAssessment(st, id, Q); ids.push(id); }
  return [st, k, ids, st.kites[k].color];
}
/** Answer correctly and settle, as the app's change() does (settle, deploy automatically, settle). */
function answer(st, d, opts) {
  const before = st;
  let next = answerQuestion(st, d, 0, opts).state;
  next = settleGoals(next, opts);
  next = autoDeploy(before, next, opts).state;
  return settleGoals(next, opts);
}

test('Y13: no goal before N correct; at N, one unanswered star-dot on the map is picked at random (kept in the save)', () => {
  let [st, , ids, c] = quiz(10);
  const opts = { ...BASE, goalAfter: 2, deploy: 'hand', random: () => 0 };
  st = answer(st, ids[0], opts);
  assertEqual(goalOf(st, c), null);
  st = answer(st, ids[1], opts);
  assertEqual(goalOf(st, c), ids[2], 'random 0: the first unanswered one on the map that can be answered (round 18: the Zenith waits for the Starboard inside it, so it isn’t picked)');
  let late = quiz(10)[0];
  late = answerQuestion(late, ids[0], 0, opts).state;
  late = settleGoals(answerQuestion(late, ids[1], 0, opts).state, { ...opts, random: () => 0.99 });
  assertEqual(goalOf(late, c), ids[2], 'random 0.99: the last (only the central kite is on the map, and its Zenith is still waiting)');
  const raw = JSON.parse(JSON.stringify({ format: SAVE_FORMAT, version: FORMAT_VERSION, content: 'x', title: 't', state: { ...st, goals: { ...st.goals, 9: ids[0], 3: 'ghost' }, complete: { 1: NOW, 2: 'x' } } }));
  const back = normalizeSave(raw).state;
  assertEqual([back.goals, back.complete], [{ [c]: ids[2] }, { 1: NOW }]);
});

test('Y13: answering the goal completes the category: a closed branch, nothing answered or deployed in it any more', () => {
  let [st, , ids, c] = quiz(10);
  const opts = { ...BASE, goalAfter: 1, random: () => 0 };
  st = answer(st, ids[0], opts);
  assertEqual(goalOf(st, c), ids[1]);
  st = answer(st, ids[1], opts);
  assertEqual(categoryComplete(st, c), true);
  assertEqual(st.complete[c], NOW);
  assertEqual(questionState(st, derive(st, opts), ids[2], NOW).kind, 'complete');
  assertEqual(answerQuestion(st, ids[2], 0, opts).problem, 'Its category is complete for this session.');
  assertEqual(deployStar(st, ids[3], opts).problem, 'Its category is complete for this session: nothing more deploys.');
  assertEqual(questionState(st, derive(st, opts), ids[9], NOW).kind, 'complete', 'an item not on the map yet is closed too (its list’s category)');
});

test('Y13: without a goal, a category completes when its last item is answered (its whole list, not just the map)', () => {
  let [st, , ids, c] = quiz(5);
  const opts = { ...BASE, goalAfter: 0 };
  for (const d of ids.slice(0, 4)) st = answer(st, d, opts);
  assertEqual(categoryComplete(st, c), false, 'the fifth item is on the deployed star, unanswered');
  assertEqual(index(project(st, opts)).dot.has(ids[4]), true);
  st = answer(st, ids[4], opts);
  assertEqual(categoryComplete(st, c), true);
});

test('Y13: with none unanswered on the map, the goal is picked when one appears', () => {
  let [st, , ids, c] = quiz(10);
  const opts = { ...BASE, goalAfter: 3, deploy: 'hand', random: () => 0 };
  for (const d of ids.slice(0, 3)) st = answer(st, d, opts);
  assertEqual(goalOf(st, c), ids[3], 'the Zenith item, the only unanswered one on the map');
  // Answered another way (an override): the goal is then answered and the category completes.
  let [st2, , ids2, c2] = quiz(10);
  const hand = { ...opts, goalAfter: 4 };
  for (const d of ids2.slice(0, 4)) st2 = answer(st2, d, hand);
  assertEqual([goalOf(st2, c2), categoryComplete(st2, c2)], [null, false], 'all four on the map answered: no goal yet');
  st2 = settleGoals(deployStar(st2, ids2[3], hand).state, hand);
  assertEqual(ids2.slice(4, 10).includes(goalOf(st2, c2)), true, 'picked among the star-dots that appeared');
});

test('Y13: a goal that leaves the map (deleted) is picked again', () => {
  let [st, , ids, c] = quiz(10);
  const opts = { ...BASE, goalAfter: 1, deploy: 'hand', random: () => 0 };
  st = answer(st, ids[0], opts);
  assertEqual(goalOf(st, c), ids[1]);
  st = settleGoals(deleteDot(st, ids[1]), opts);
  assertEqual(goalOf(st, c), ids[2]);
});

test('Y13: under Hierarchical, every star-dot answered doesn’t complete a category: only its goal does', () => {
  let st = createState();
  const k = st.stars[centralStar(st).id].kites[0];
  const H = { ...BASE, stardots: 'hierarchical', goalAfter: 0 };
  const ids = [];
  for (const slot of [0, ZENITH]) { let id; [st, id] = placeDot(st, k, slot, 's' + slot); st = setAssessment(st, id, Q); ids.push(id); }
  for (const d of ids) st = answer(st, d, H);
  assertEqual(categoryComplete(st, st.kites[k].color), false);
  assertEqual(Object.values(st.stars).filter(s => s.deployed).length, 2, 'and the Zenith deployed its star');
});

test('Y13: nothing is settled with questions off', () => {
  let [st, , ids, c] = quiz(10);
  const on = { ...BASE, goalAfter: 1, deploy: 'hand', random: () => 0 };
  st = answerQuestion(st, ids[0], 0, on).state;
  assertEqual(goalOf(settleGoals(st, on), c), ids[1], 'with questions on, a goal is picked');
  assertEqual(settleGoals(st, { ...on, questions: 'off' }), st, 'with questions off, nothing');
});

test('Y14: a new session clears goals and completed categories, removes independent stars, keeps the lists and questions', () => {
  let [st, k, ids, c] = quiz(10);
  const opts = { ...BASE, goalAfter: 1, random: () => 0 };
  for (const d of [ids[0], ids[1], ids[2], ids[3]]) st = answer(st, d, opts);
  assertEqual(categoryComplete(st, c), true);
  const fresh = startSession(st);
  assertEqual([fresh.goals, fresh.complete, Object.values(fresh.stars).some(s => s.independent), fresh.lists[k].length, !!fresh.dots[ids[0]].assessment],
    [{}, {}, false, 10, true]);
  assertEqual(Object.values(fresh.dots).every(d => d.ignitedAt == null), true);
});

test('Y7 + Y13: one Zenith that can’t deploy doesn’t stop the others deploying in the same change', () => {
  let st = createState();
  const kites = st.stars[centralStar(st).id].kites;
  const opts = { ...BASE, goalAfter: 0 };
  const zen = [];
  for (const k of [kites[0], kites[1]]) {
    for (let i = 0; i < 6; i++) { let id; [st, id] = addItem(st, k, `${k}-${i}`); st = setAssessment(st, id, Q); if (i === 3) zen.push(id); }
  }
  const c0 = st.kites[kites[0]].color;
  st = { ...st, complete: { [c0]: NOW } };
  // Light both categories' first three, then both Zeniths in one change.
  let next = st;
  for (const k of [kites[0], kites[1]]) for (const d of st.lists[k].slice(0, 3)) next = { ...next, dots: { ...next.dots, [d]: { ...next.dots[d], ignitedAt: NOW, trained: true } } };
  const before = next;
  for (const d of zen) next = { ...next, dots: { ...next.dots, [d]: { ...next.dots[d], ignitedAt: NOW, trained: true } } };
  const r = autoDeploy(before, next, opts);
  assertEqual(r.deployed.length, 1, 'the complete category deploys nothing; the other one does');
  assertEqual(r.state.stars[r.deployed[0]].category, kites[1]);
});

test('P7: freshBoard is the board as a first-time player meets it: every completion, answer, wait and goal cleared; the rest kept', () => {
  let st = createState();
  const k = centralStar(st).kites[0];
  let a, b;
  [st, a] = placeDot(st, k, 0, 'Ticked');
  [st, b] = placeDot(st, k, 1, 'Answered');
  st = setAssessment(st, b, Q);
  st = { ...st, dots: { ...st.dots, [a]: { ...st.dots[a], ignitedAt: NOW }, [b]: { ...st.dots[b], ignitedAt: NOW, trained: true, answered: ['q'] } }, waits: { [b]: NOW + 1 }, goals: { 0: b }, complete: { 1: true } };
  const f = freshBoard(st);
  assertEqual([f.dots[a].ignitedAt, f.dots[b].ignitedAt, f.dots[b].trained, 'answered' in f.dots[b]], [null, null, false, false]);
  assertEqual([f.waits, f.goals, f.complete], [{}, {}, {}]);
  assertEqual([f.dots[a].name, f.dots[b].assessment, f.kites[k].dots.slice(0, 2)], ['Ticked', st.dots[b].assessment, [a, b]], 'the items and questions stay');
});
