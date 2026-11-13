// Round 17 (AB4): shuffling a question's choices: GOVERN's default, each question's own switch,
// what keeps its place, and when a new order is drawn. Round 18: Shuffle the questions orders the
// field (Independent): each category's items fill it in a new order each session, the lists keep
// theirs; a set's own questions are asked in the order written.

import { test, assertEqual } from '../runner.js';
import {
  setValue, parseQuestions, toMarkdown, choiceOrder, attemptSeed, shuffleOn, shuffleDefaults, quizRules, optionsFrom,
  createState, centralStar, addItem, listOf, fieldOrder, project, index, startSession,
} from '../../shared/engine/index.js';

const choice = (texts, shuffle = 'default') => setValue({ items: [{ id: 'q', kind: 'choice', text: 'Q?', shuffle, options: texts.map((t, i) => ({ text: t, correct: !i })) }] }).items[0];
const ID = n => Array.from({ length: n }, (_, i) => i);
const isPerm = (o, n) => [...o].sort((a, b) => a - b).join() === ID(n).join();
/** Seeds 0..39: whether any draws an order other than the written one, and every order a permutation. */
const draws = (f, n) => { const all = Array.from({ length: 40 }, (_, i) => f(`s${i}`)); return { moved: all.some(o => o.join() !== ID(n).join()), perms: all.every(o => isPerm(o, n)), all }; };

test('AB4: a choice question’s switch is As GOVERN says, On or Off; round 15’s true reads as On', () => {
  assertEqual([shuffleOn('default', false), shuffleOn('default', true), shuffleOn('on', false), shuffleOn('off', true)], [false, true, true, false]);
  assertEqual([choice(['a', 'b'], true).shuffle, choice(['a', 'b'], false).shuffle, choice(['a', 'b'], 'off').shuffle], ['on', 'default', 'off']);
  assertEqual(shuffleDefaults(optionsFrom({ properties: [{ id: 'persistence', choices: [] }, { id: 'environment', choices: [] }, { id: 'difficulty', choices: [] }], rules: { shuffleChoices: 'on' } })), { choices: true });
  assertEqual([quizRules({}).shuffleChoices, quizRules({ shuffleQuestions: 'on' }).shuffleQuestions, quizRules({ shuffleChoices: 'maybe' }).shuffleChoices], ['off', 'on', 'off']);
});

test('AB4: choices shuffle when the question or GOVERN says so, the same order for the same seed', () => {
  const q = choice(['a', 'b', 'c', 'd', 'e']);
  assertEqual(choiceOrder(q, 'x', false), ID(5), 'off by default');
  const d = draws(s => choiceOrder(q, s, true), 5);
  assertEqual([d.moved, d.perms], [true, true], 'GOVERN on: shuffled, every choice once');
  assertEqual(choiceOrder(q, 's3', true), choiceOrder(q, 's3', true), 'stable for a seed');
  assertEqual(draws(s => choiceOrder(choice(['a', 'b', 'c', 'd'], 'off'), s, true), 4).moved, false, 'the question’s Off wins');
  assertEqual(draws(s => choiceOrder(choice(['a', 'b', 'c', 'd'], 'on'), s, false), 4).moved, true, 'the question’s On wins');
});

test('AB4: “All / None / Both / Neither of the above” keep their place; choices naming others by letter keep the order', () => {
  const q = choice(['a', 'b', 'c', 'None of the above'], 'on');
  const d = draws(s => choiceOrder(q, s, false), 4);
  assertEqual([d.moved, d.all.every(o => o[3] === 3)], [true, true]);
  const both = choice(['all of the above', 'x', 'y', 'Both of the above'], 'on');
  assertEqual(draws(s => choiceOrder(both, s, false), 4).all.every(o => o[0] === 0 && o[3] === 3), true);
  assertEqual(draws(s => choiceOrder(choice(['red', 'blue', 'green', 'Both A and C'], 'on'), s, false), 4).moved, false);
  assertEqual(draws(s => choiceOrder(choice(['red', 'blue', 'A, B and C', 'green'], 'on'), s, false), 4).moved, false);
});

test('AB4: an attempt’s seed holds while it’s answered and changes when it comes back for retraining, or in a new session', () => {
  const st = { seed: 'a', dots: { d: { ignitedAt: null } } };
  const again = { ...st, dots: { d: { ignitedAt: 5 } } };
  assertEqual([attemptSeed(st, 'd') === attemptSeed({ ...st }, 'd'), attemptSeed(st, 'd') === attemptSeed(again, 'd'), attemptSeed(st, 'd') === attemptSeed({ ...st, seed: 'b' }, 'd')], [true, false, false]);
});

test('round 18: a set’s questions come in the order written; its old order: / shuffle: lines still read, and are ignored', () => {
  const md = '# Set: S\nshuffle: yes\n\n## Q a [choice]\nA?\n- [x] one\n- [ ] two\nshuffle: no\n\n## Q b [number]\nB?\nanswer: 2\n';
  const r = parseQuestions(md);
  assertEqual([r.errors, 'shuffle' in r.sets[0], r.sets[0].items.map(q => q.id), r.sets[0].items[0].shuffle], [[], false, ['a', 'b'], 'off']);
  assertEqual(parseQuestions(toMarkdown(r.sets[0])).sets[0], r.sets[0], 'written and read back');
  assertEqual(toMarkdown(r.sets[0]).includes('\nshuffle: yes'), false, 'no set-level line is written');
  assertEqual([parseQuestions(md.replace('shuffle: yes', 'order: shuffle')).errors, 'shuffle' in setValue({ order: 'shuffle', shuffle: 'on', items: [] })], [[], false]);
  assertEqual(parseQuestions(md.replace('shuffle: no', 'shuffle: sometimes')).errors.map(e => e.line), [8], 'a choice question’s bad value still says so');
});

/** A state whose central kite 0 lists n items (Independent): [state, kite, ids]. */
function listed(n) {
  let st = createState();
  const k = st.stars[centralStar(st).id].kites[0];
  const ids = [];
  for (let i = 0; i < n; i++) { let id; [st, id] = addItem(st, k, 'i' + i); ids.push(id); }
  return [st, k, ids];
}
const IND = { now: 1e12, locks: 'off', stardots: 'independent', kites: 'central', perStar: 24 };
const SHUF = { ...IND, shuffleQuestions: 'on' };

test('round 18: Shuffle the questions fills the field in a new order per session; the list keeps its order', () => {
  const [st, k, ids] = listed(12);
  assertEqual(fieldOrder(st, k, IND), ids, 'off: the list’s order');
  const seeded = s => ({ ...st, seed: s });
  const orders = Array.from({ length: 20 }, (_, i) => fieldOrder(seeded(`s${i}`), k, SHUF));
  assertEqual(orders.every(o => [...o].sort().join() === [...ids].sort().join()), true, 'every item once');
  assertEqual(orders.some(o => o.join() !== ids.join()), true, 'a different order for some seed');
  assertEqual(fieldOrder(seeded('s3'), k, SHUF), fieldOrder(seeded('s3'), k, SHUF), 'the same within a session');
  assertEqual(listOf(seeded('s3'), k), ids, 'the list as MATERIALS shows it is untouched');
  // The central kite takes the field order's first four (Nadir, Port, Starboard, Zenith).
  const s = seeded('s3');
  const first4 = fieldOrder(s, k, SHUF).slice(0, 4);
  const onKite = project(s, SHUF).kites[k].dots.filter(Boolean);
  assertEqual([...onKite].sort().join(), [...first4].sort().join());
  assertEqual(index(project(s, IND)).dot.has(ids[0]) && project(s, IND) !== project(s, SHUF), true, 'the switch is part of the placement’s key');
  assertEqual(startSession(s, 'next').seed, 'next', 'a new session draws a new order');
});
