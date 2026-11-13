// Round 9, stage 4 (Y6, Y8): Star-dots: Independent: category lists, their derived placement
// across the central kite and the category's independent stars, deploying the next items,
// statuses without roll-ups, the dormant hierarchy and switching back, sessions, deleting.

import { test, assertEqual } from '../runner.js';
import { DIRS, coordKey, addCoord } from '../../shared/lattice.js';
import {
  createState, centralStar, derive, placeDot, addChild, ignite, deployStar, withdrawStar, autoDeploy, startSession, deleteDot,
  normalizeSave, SAVE_FORMAT, FORMAT_VERSION, boardMove, updateDot, setAssessment, answerQuestion, categoryProgress, index,
  addItem, moveItem, listOf, project, openedBy, ZENITH, BACK,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const IND = { now: NOW, locks: 'off', stardots: 'independent', kites: 'central', perStar: 24 };
const SIX = { ...IND, perStar: 6 };
const HIER = { ...IND, stardots: 'hierarchical' };
const Q = { question: 'Q?', choices: ['a', 'b', 'c', 'd'], correct: 0, explanation: '' };

/** A state whose central kite 0 lists `n` items i0, i1, …: [state, kiteId, [ids]]. */
function listed(n, st = createState()) {
  const k = st.stars[centralStar(st).id].kites[0];
  const ids = [];
  for (let i = 0; i < n; i++) { let id; [st, id] = addItem(st, k, 'i' + i); ids.push(id); }
  return [st, k, ids];
}
const where = (st, opts, d) => { const at = index(project(st, opts)).dot.get(d); return at ? at.slot : null; };

test('Y6: a category’s first four items fill its central kite: Nadir, Port, Starboard, then the Zenith; the rest wait', () => {
  const [st, k, ids] = listed(6);
  assertEqual(ids.map(d => where(st, IND, d)), [0, 1, 3, ZENITH, null, null]);
  assertEqual(project(st, IND).kites[k].dots, [ids[0], ids[1], ids[3], ids[2]]);
  assertEqual(st.kites[k].dots, [null, null, null, null], 'nothing is stored in the slots');
  assertEqual(derive(st, IND).segments(k), { segments: [{ star: null, from: 0, to: 4 }], total: 6 });
});

test('Y6: the Zenith item deploys an independent star of its category, which takes the next items (24 per star: the Nadirs first)', () => {
  let [st, k, ids] = listed(12);
  st = ignite(st, ids[3], NOW);
  const r = deployStar(st, ids[3], IND);
  assertEqual(r.problem, null);
  const s = r.state.stars[r.star];
  assertEqual([s.independent, s.category, s.sources, s.deployed], [true, k, [ids[3]], true]);
  assertEqual(r.state.dots[ids[3]].branch, null, 'its own branch (the dormant hierarchy) is untouched');
  const view = derive(r.state, IND);
  assertEqual(view.shown(r.star), true);
  assertEqual(ids.slice(4, 10).map(d => index(view.state).dot.get(d)?.slot), Array(6).fill(0), 'the Nadirs first');
  assertEqual(ids.slice(10).map(d => where(r.state, IND, d)), [1, 1], 'then the Ports');
  assertEqual(index(view.state).dot.get(ids[4]).kite !== index(view.state).dot.get(ids[3]).kite, true, 'on the new star');
  const { coord } = view.place(r.star);
  const c = centralStar(st);
  assertEqual(coordKey(coord), coordKey(addCoord([0, 0], DIRS[c.kites.indexOf(k)])), 'where the Zenith item faces');
});

test('Y6, Z2: 12 per star: the central kite holds 2 (Port, then the Zenith), a kite-less star 12 (the Ports, then the Zeniths); with kites, 24 with the Zeniths last', () => {
  let [st, , ids] = listed(4 + 24);
  const TWELVE = { ...IND, perStar: 12 };
  assertEqual([where(st, TWELVE, ids[0]), where(st, TWELVE, ids[1]), where(st, TWELVE, ids[2])], [1, ZENITH, null]);
  const r = deployStar(st, ids[1], TWELVE);
  const v = derive(r.state, TWELVE);
  assertEqual(ids.slice(2, 14).map(d => index(v.state).dot.get(d)?.slot), [...Array(6).fill(1), ...Array(6).fill(ZENITH)]);
  const ALL = { ...IND, kites: 'all' };
  const r2 = deployStar(st, ids[3], ALL);
  const v2 = derive(r2.state, ALL);
  const slots = ids.slice(4).map(d => index(v2.state).dot.get(d)?.slot);
  assertEqual([slots.slice(0, 18).every(s => s !== ZENITH), slots.slice(18).every(s => s === ZENITH), slots.length], [true, true, 24]);
});

test('Y6: when the list runs out the last star holds what’s left; round 12: a free Zenith still deploys, an empty star (6 per star: the central kite holds only its Zenith)', () => {
  let [st, k, ids] = listed(5);
  assertEqual(where(st, SIX, ids[0]), ZENITH);
  st = deployStar(st, ids[0], SIX).state;
  const v = derive(st, SIX);
  assertEqual(v.segments(k).segments.map(x => [x.from, x.to]), [[0, 1], [1, 5]]);
  // A Zenith of the new star facing a free position (the ones facing ring 1 or the center can't anyway).
  const tip = ids.slice(1).find(d => { const f = v.facing(d); return f && !f.reserved && !f.holder; });
  assertEqual(!!tip, true);
  assertEqual(v.deployable(tip), true, 'round 12: no limit but a blocked position');
  const r = deployStar(st, tip, SIX);
  assertEqual([r.problem, !!r.state.stars[r.star]?.deployed], [null, true]);
  const seg = derive(r.state, SIX).segments(k).segments;
  assertEqual([seg.length, seg[2].from, seg[2].to], [3, 5, 5], 'it holds no items');
});

test('Y6: each item is its own status: no children, no roll-ups, nothing inherited', () => {
  let [st, , ids] = listed(10);
  st = updateDot(st, ids[3], { props: { difficulty: 'hard' } });
  st = deployStar(st, ids[3], IND).state;
  const v = derive(st, IND);
  assertEqual([v.children(ids[3]), v.support(ids[3]), v.effective(ids[3]).status], [[], null, 'open']);
  assertEqual(v.prop(ids[5], 'difficulty'), null, 'an item on its star inherits nothing from the item that opened it');
  st = ignite(st, ids[5], NOW);
  assertEqual([derive(st, IND).effective(ids[5]).status, derive(st, IND).effective(ids[3]).status], ['ignited', 'open']);
});

test('Y6: the hierarchy stays dormant under Independent, and returns as it was when Hierarchical is back', () => {
  let st = createState();
  const k = st.stars[centralStar(st).id].kites[0];
  let z;
  [st, z] = placeDot(st, k, ZENITH, 'old zenith');
  st = addChild(st, z, 'old child', { options: HIER }).state;
  st = deployStar(st, z, HIER).state;
  const hierStar = st.dots[z].branch;
  let ids;
  [st, , ids] = listed(5, st);
  const v = derive(st, IND);
  assertEqual([index(v.state).dot.has(z), v.shown(hierStar), index(v.state).dot.has(ids[0])], [false, false, true], 'the old star-dots and star are off the map');
  st = deployStar(st, ids[3], IND).state;
  st = ignite(st, ids[4], NOW);
  const back = derive(st, HIER);
  assertEqual([back.shown(hierStar), back.children(z).length, index(st).dot.has(ids[0])], [true, 1, false], 'switched back: the hierarchy as it was, the items off the map');
});

test('Y6: withdrawing an independent star takes its items off; redeploying brings them back; a new session removes it', () => {
  let [st, k, ids] = listed(10);
  const r = deployStar(st, ids[3], IND);
  st = withdrawStar(r.state, ids[3], IND).state;
  assertEqual([st.stars[r.star].deployed, where(st, IND, ids[4])], [false, null]);
  st = deployStar(st, ids[3], IND).state;
  assertEqual([st.stars[r.star].deployed, where(st, IND, ids[4])], [true, 0]);
  st = startSession(st);
  assertEqual([!!st.stars[r.star], listOf(st, k).length], [false, 10], 'removed; the items stay');
});

test('Y8: reordering the list moves the items’ places; deleting an item takes it out, with the star it opened', () => {
  let [st, k, ids] = listed(10);
  st = moveItem(st, k, 0, 4);
  assertEqual([where(st, IND, ids[1]), where(st, IND, ids[0])], [0, null]);
  st = moveItem(st, k, 4, 0);
  st = deployStar(st, ids[3], IND).state;
  const star = openedBy(st, ids[3]).id;
  st = deleteDot(st, ids[3]);
  assertEqual([listOf(st, k).length, !!st.stars[star], where(st, IND, ids[4])], [9, false, ZENITH], 'the next item moves up to the Zenith');
});

test('Y6: lists and independent stars are kept in the save; listed items aren’t on the shelf', () => {
  let [st, k, ids] = listed(6);
  st = deployStar(st, ids[3], IND).state;
  const raw = JSON.parse(JSON.stringify({ format: SAVE_FORMAT, version: FORMAT_VERSION, content: 'x', title: 't', state: { ...st, lists: { ...st.lists, [k]: [...st.lists[k], ids[0], 'ghost'], nope: [ids[1]] } } }));
  const back = normalizeSave(raw).state;
  assertEqual(back.lists, { [k]: ids });
  assertEqual(back.shelf, []);
  const s = Object.values(back.stars).find(x => x.independent);
  assertEqual([s.category, s.sources], [k, [ids[3]]]);
});

test('Y6: nothing moves on PLAY under Independent (the list order places items)', () => {
  const [st, k] = listed(4);
  const r = boardMove(st, 'free', { kind: 'dots', a: { kite: k, slot: 0 }, b: { kite: k, slot: 1 } }, IND);
  assertEqual(r.problem, 'Under Independent the items keep their list order: reorder them in the Tree view.');
});

test('Y6 with questions: a category counts its whole list; answering the Zenith item deploys automatically', () => {
  let [st, , ids] = listed(10);
  for (const d of ids) st = setAssessment(st, d, Q);
  const opts = { ...IND, questions: 'on', deploy: 'auto' };
  const c = st.kites[st.stars[centralStar(st).id].kites[0]].color;
  assertEqual(categoryProgress(st, derive(st, opts), 6)[c], { correct: 0, total: 10 });
  assertEqual(answerQuestion(st, ids[6], 0, opts).problem, 'It isn’t on the map.');
  for (const d of [ids[0], ids[1], ids[2]]) st = answerQuestion(st, d, 0, opts).state;
  const before = st;
  st = answerQuestion(st, ids[3], 0, opts).state;
  const r = autoDeploy(before, st, opts);
  assertEqual(r.deployed.length, 1);
  assertEqual(categoryProgress(r.state, derive(r.state, opts), 6)[c], { correct: 4, total: 10 });
  assertEqual(answerQuestion(r.state, ids[6], 0, opts).problem, null, 'the next items can now be answered');
});
