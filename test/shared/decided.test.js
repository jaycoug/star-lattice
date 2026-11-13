// Stage 3: under Hierarchical with every star-dot a question and Deploy: Automatically, a Zenith
// whose children decide it can't be answered itself: answering the star-dots inside it opens it,
// and its star deploys in that change, so its children reach the map. An edit that answers nothing
// deploys nothing.

import { test, assertEqual } from '../runner.js';
import {
  createState, centralStar, placeDot, addChild, setAssessment, answerQuestion, autoDeploy, derive, questionState, ZENITH, updateDot,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const Q = { question: 'Q?', choices: ['a', 'b', 'c', 'd'], correct: 0, explanation: '' };
const OPTS = { now: NOW, locks: 'off', stardots: 'hierarchical', kites: 'central', perStar: 24, questions: 'on', deploy: 'auto', wrong: { mode: 'retry', minutes: 5 } };

/** A central kite with a question at its Nadir and a Zenith that has one child (a question too). */
function board() {
  let st = createState();
  const k = st.stars[centralStar(st).id].kites[0];
  let inner, tip;
  [st, inner] = placeDot(st, k, 0, 'inner');
  [st, tip] = placeDot(st, k, ZENITH, 'tip');
  const r = addChild(st, tip, 'child', { options: OPTS });
  st = r.state;
  for (const d of [inner, tip, r.dot]) st = setAssessment(st, d, Q);
  return { st, inner, tip, child: r.dot };
}

test('stage 3: a Zenith decided by its children deploys its star once the star-dots inside it are answered', () => {
  const { st, inner, tip, child } = board();
  const v0 = derive(st, OPTS);
  assertEqual([questionState(st, v0, tip, NOW).kind, v0.insideFirst(tip), st.stars[st.dots[tip].branch].deployed], ['children', true, false], 'decided by its child, waiting, its star planned');
  const answered = answerQuestion(st, inner, 0, OPTS).state;
  const r = autoDeploy(st, answered, OPTS);
  assertEqual([r.deployed, r.state.stars[st.dots[tip].branch].deployed], [[st.dots[tip].branch], true], 'the answer opens it, and its star deploys');
  const v1 = derive(r.state, OPTS);
  assertEqual(questionState(r.state, v1, child, NOW).kind, 'open', 'its child can be answered now');
});

test('stage 3: an edit that answers nothing deploys nothing; with Deploy: By hand, nothing either', () => {
  const { st, inner, tip } = board();
  const done = answerQuestion(st, inner, 0, { ...OPTS, deploy: 'hand' }).state;   // the Zenith is open, its star not deployed
  const edited = updateDot(done, tip, { name: 'renamed tip' });
  assertEqual(autoDeploy(done, edited, OPTS).deployed, [], 'a rename answers nothing');
  assertEqual(autoDeploy(st, answerQuestion(st, inner, 0, OPTS).state, { ...OPTS, deploy: 'hand' }).deployed, [], 'by hand');
});
