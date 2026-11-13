// Round 15 (AA1–AA9): question sets: the Markdown format and its errors, grading each kind, answering a
// set (progress, chains, waits per question, the self-grade), the save, and bulk import and export.

import { test, assertEqual } from '../runner.js';
import {
  createState, centralStar, derive, placeDot, addChild, updateDot, normalizeSave, startSession, SAVE_FORMAT, FORMAT_VERSION,
  parseQuestions, toMarkdown, setAssessment, answerItem, itemStates, questionState, setProgress, grade, tokens, matches,
  parseNumber, allowance, questionsOf, gradedOf, askable, planImport, applyImport, exportQuestions, pathOf, resolvePath, addItem,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const MIN = 60 * 1000;
const OFF = { now: NOW, locks: 'off', questions: 'off', wrong: { mode: 'retry', minutes: 5 } };
const WAIT = { ...OFF, wrong: { mode: 'wait', minutes: 10 } };

const FILE = `# A question bank
Its introduction, before any set, is ignored.

# Set: Part 1 · the model
target: Statistics > Problem set > 1.
context:
The trees data, in R.

## Chain: Load and fit
context:
\`\`\`r
library(datasets)
\`\`\`

### Q load [blank]
Complete the line that loads \`trees\`.
\`\`\`r
____
head(trees)
\`\`\`
answer: \`data(trees)\`
accept: data("trees")
explain: trees ships with R.

### Q hr [number]
Run the fit: the slope for Girth?
answer: 0.880
hint: The Estimate column.

## Q organelle [choice]
Which make ATP? Choose all that apply.
- [x] Mitochondria
- [ ] Ribosomes
  > They make proteins.
- [x] Chloroplasts
shuffle: yes

## Q fit [recall]
Fit \`tm\`.
answer:
\`\`\`
tm <- lm(Volume~Girth, data=trees)
\`\`\`
accept: /lm\\(Volume ?~/

## Q open [step]
Open RStudio and run the setup code.

---

# Set: Second
## Q two [blank]
\`SELECT ____ FROM t ____ id;\`
answer 1: *
answer 2: ORDER BY
case: ignore
`;

test('AA7: a question file holds sets, chains, five kinds, context, hints and explanations', () => {
  const { sets, errors } = parseQuestions(FILE);
  assertEqual(errors, []);
  assertEqual(sets.map(s => [s.title, s.target, questionsOf(s).length, gradedOf(s).length]), [['Part 1 · the model', 'Statistics > Problem set > 1.', 5, 4], ['Second', '', 1, 1]]);
  const [chain, organelle, fit, open] = sets[0].items;
  assertEqual([chain.type, chain.title, chain.context, chain.items.map(q => [q.id, q.kind])], ['chain', 'Load and fit', '```r\nlibrary(datasets)\n```', [['load', 'blank'], ['hr', 'number']]]);
  assertEqual(sets[0].context, 'The trees data, in R.');
  assertEqual(chain.items[0].blanks, [['`data(trees)`', 'data("trees")']]);
  assertEqual([chain.items[1].answer, chain.items[1].decimals, chain.items[1].hints], [0.88, 3, ['The Estimate column.']], 'the answer’s written decimals are kept (0.880: three)');
  assertEqual([organelle.options.map(o => o.correct), organelle.options[1].feedback, organelle.shuffle], [[true, false, true], 'They make proteins.', 'on']);
  assertEqual([fit.answer, fit.accept], ['tm <- lm(Volume~Girth, data=trees)', ['/lm\\(Volume ?~/']]);
  assertEqual([open.kind, open.text], ['step', 'Open RStudio and run the setup code.']);
  assertEqual([sets[1].items[0].blanks, sets[1].items[0].ignoreCase], [[['*'], ['ORDER BY']], true]);
  assertEqual([askable(sets[0]), askable(sets[1])], [true, true]);
});

test('AA9: Markdown out and back in is the same set', () => {
  for (const set of parseQuestions(FILE).sets) {
    const back = parseQuestions(toMarkdown(set));
    assertEqual([back.errors, back.sets.length], [[], 1]);
    assertEqual(back.sets[0], set);
  }
});

test('AA7: errors name their lines: kinds, options, blanks, answers, ids, stray keys', () => {
  const { errors } = parseQuestions([
    '## Q a [choise]', 'text',                          // 1
    '## Q b [choice]', 'hi', '- [ ] one', '- [ ] two',   // 3: no [x]
    '## Q c [blank]', 'no blanks here', 'answer: x',     // 7
    '## Q a [number]', 'x', 'answer: abc',               // 10: id twice; not a number
    '## Q d [recall]', 'type it',                        // 13: no answer
    '## Q e [step]', 'go', 'answer: no',                 // 15: answer on a step
  ].join('\n'));
  assertEqual(errors.map(e => e.line), [1, 5, 7, 10, 12, 13, 17]);
  assertEqual(errors[0].message, '“choise” isn’t a kind of question: choice, blank, number, recall, step.');
  assertEqual(errors[1].message, 'Mark the right option (or options) with [x].');
  assertEqual(errors[3].message, 'The id “a” is used twice in this set (line 1).');
  assertEqual(errors[6].message, 'answer: isn’t used by a step question.');
});

test('AA3: grading: choice (all that apply), blanks (tokens, regex, case), numbers (decimals, tolerance, units), recall', () => {
  const [s1, s2] = parseQuestions(FILE).sets;
  const [load, hr] = s1.items[0].items;
  const [, organelle, fit] = s1.items;
  assertEqual([grade(organelle, [0, 2]).correct, grade(organelle, [0]).correct, grade(organelle, [0, 1, 2]).feedback], [true, false, 'They make proteins.']);
  assertEqual([grade(load, [' data( trees ) ']).correct, grade(load, ["data('trees')"]).correct, grade(load, ['data(TREES)']).correct], [true, true, false]);
  assertEqual([grade(s2.items[0], ['*', 'order  by']).correct, grade(s2.items[0], ['*', 'GROUP BY']).blanks], [true, [true, false]]);
  assertEqual([grade(hr, '0.8804').correct, grade(hr, '.88').correct, grade(hr, '0.881').correct, grade(hr, 'n/a').invalid], [true, true, false, true]);
  assertEqual([allowance({ answer: 254, decimals: 0, tolerance: null }), allowance({ answer: 1, decimals: 2, tolerance: null }), allowance({ answer: 5, decimals: null, tolerance: 0.1 })], [0.5, 0.005, 0.1]);
  const e = parseQuestions('## Q e [number]\nx\nanswer: 1.2e-4\nunits: s').sets[0].items[0];
  assertEqual([grade(e, '0.000124').correct, grade(e, '0.00013').correct, grade(e, '1.2e-4 s').correct, parseNumber('1,234.5')], [true, false, true, 1234.5]);
  const plain = { ...fit, accept: [] };
  assertEqual([grade(plain, 'tm<-lm(Volume ~ Girth, data = trees);  # a comment').correct, grade(plain, "tm <- lm(Volume~Girth, data='trees')").correct], [true, false], 'spacing, a comment and a trailing ; don’t matter; a string isn’t a name');
  assertEqual(grade(fit, 'm <- lm(Volume ~ Height)').correct, true, 'an accepted /regular expression/');
  const wrong = grade({ ...fit, accept: [] }, 'tm <- lm(Girth~Volume, data=trees)');
  assertEqual([wrong.correct, wrong.typed[wrong.at]], [false, 'Girth'], 'where it first differs');
  assertEqual([tokens('a = "x"  ;'), matches('SELECT a', 'select A', true)], [['a', '=', '"x"'], true]);
});

/** A state with the problem set's first set on a star-dot (its role □, questions off): [state, dotId]. */
function withSet() {
  let st = createState();
  const k = centralStar(st).kites[0];
  let d;
  [st, d] = placeDot(st, k, 0, '1.');
  st = updateDot(st, d, { role: 'assess' });
  return [setAssessment(st, d, parseQuestions(FILE).sets[0]), d];
}

test('AA1, AA2: a □ star-dot’s set, questions off: each right answer is kept (in training); the last ignites it and its progress clears', () => {
  let [st, d] = withSet();
  const view = () => derive(st, OFF);
  assertEqual(questionState(st, view(), d, NOW).kind, 'open', 'no quiz mode needed');
  let r = answerItem(st, d, 'load', ['data(trees)'], OFF);
  st = r.state;
  assertEqual([r.correct, r.complete, Object.keys(st.dots[d].answered), view().effective(d).status, setProgress(st, view(), d)], [true, false, ['load'], 'training', { right: 1, total: 4 }]);
  for (const [q, a] of [['hr', '0.880'], ['organelle', [2, 0]]]) st = answerItem(st, d, q, a, OFF).state;
  r = answerItem(st, d, 'fit', 'nope', OFF);
  assertEqual([r.correct, r.state === st], [false, true], 'Retry now: a wrong answer records nothing');
  r = answerItem(st, d, 'fit', { self: true }, OFF);
  assertEqual([r.correct, r.complete, view().effective(d).status, derive(r.state, OFF).effective(d).status, r.state.dots[d].answered], [true, true, 'training', 'ignited', undefined], 'Count it as right: the self-grade');
  assertEqual(answerItem(r.state, d, 'load', ['data(trees)'], OFF).problem, 'It’s already answered.');
  assertEqual(answerItem(st, d, 'open', [], OFF).problem, 'That isn’t one of its questions.', 'a step isn’t answered');
});

test('AA5: a chain is answered in order; other questions any time', () => {
  let [st, d] = withSet();
  const kinds = () => Object.fromEntries([...itemStates(st, d, NOW, OFF)].map(([q, s]) => [q, s.kind]));
  assertEqual(kinds(), { load: 'open', hr: 'after', organelle: 'open', fit: 'open', open: 'open' });
  assertEqual(answerItem(st, d, 'hr', '0.88', OFF).problem, 'Answer the questions before it in its chain first.');
  st = answerItem(st, d, 'organelle', [0, 2], OFF).state;
  st = answerItem(st, d, 'load', ['data(trees)'], OFF).state;
  assertEqual(kinds(), { load: 'answered', hr: 'open', organelle: 'answered', fit: 'open', open: 'open' });
});

test('AA6: under Wait N minutes only the missed question waits; the star-dot waits once all that’s left does', () => {
  let [st, d] = withSet();
  st = answerItem(st, d, 'organelle', [0], WAIT).state;
  assertEqual(st.waits, { [d + '#organelle']: NOW + 10 * MIN });
  assertEqual([itemStates(st, d, NOW, WAIT).get('organelle').kind, questionState(st, derive(st, WAIT), d, NOW).kind], ['waiting', 'open'], 'the others stay open');
  assertEqual(answerItem(st, d, 'organelle', [0, 2], WAIT).problem, 'It’s waiting after a wrong answer.');
  st = answerItem(st, d, 'load', ['x'], WAIT).state;   // the chain's first: the chain waits with it
  st = answerItem(st, d, 'fit', 'x', WAIT).state;
  assertEqual(questionState(st, derive(st, WAIT), d, NOW + MIN), { kind: 'waiting', until: NOW + 10 * MIN });
  assertEqual(questionState(st, derive(st, WAIT), d, NOW + 10 * MIN).kind, 'open', 'open again once the time passes');
});

test('AA2: progress is kept in the save (on questions it has), cleared by a new session and when a question goes', () => {
  let [st, d] = withSet();
  st = answerItem(st, d, 'load', ['data(trees)'], OFF).state;
  const raw = { format: SAVE_FORMAT, version: FORMAT_VERSION, content: 'x', title: 't', state: { ...st, dots: { ...st.dots, [d]: { ...st.dots[d], answered: { ...st.dots[d].answered, ghost: NOW, hr: 'x' } } } } };
  assertEqual(normalizeSave(JSON.parse(JSON.stringify(raw))).state.dots[d].answered, { load: NOW });
  assertEqual(startSession(st).dots[d].answered, undefined);
  const set = parseQuestions(FILE).sets[0];
  const without = { ...set, items: set.items.filter(it => it.type !== 'chain') };
  assertEqual(setAssessment(st, d, without).dots[d].answered, undefined, 'load is gone, and so is its progress');
  assertEqual(setAssessment(st, d, set).dots[d].answered, { load: NOW }, 'editing keeps the progress of questions it still has');
});

/** A small hierarchy: Statistics (central) › Problem set › 1., 2. */
function tree() {
  let st = createState();
  const k = centralStar(st).kites[0];
  let surv, hw, one, two;
  [st, surv] = placeDot(st, k, 0, 'Statistics');
  ({ state: st, dot: hw } = addChild(st, surv, 'Problem set'));
  ({ state: st, dot: one } = addChild(st, hw, '1.'));
  ({ state: st, dot: two } = addChild(st, hw, '2.'));
  return { st, surv, hw, one, two };
}

test('AA8: a target path names a star-dot by its names (ignoring case and spacing), from the top or a unique name', () => {
  const { st, hw, one } = tree();
  const view = derive(st, OFF);
  assertEqual(resolvePath(st, view, 'Statistics > Problem set > 1.'), { dot: one });
  assertEqual(resolvePath(st, view, ' problem  SET >1.'), { dot: one }, 'a unique name may start it');
  assertEqual(resolvePath(st, view, 'Statistics > Problem set > 3.'), { parent: hw, name: '3.' }, 'a missing last step: created under its parent');
  assertEqual(resolvePath(st, view, 'Statistics > Set 13 > 1.').problem, 'No “Set 13” under “Statistics”.');
  assertEqual(resolvePath(st, view, 'Nothing').problem, 'No star-dot is named “Nothing”.');
  assertEqual(pathOf(st, one), ['Statistics', 'Problem set', '1.']);
});

test('AA8: import plans each set, creates what’s missing, Replace or Append, and makes its star-dots □', () => {
  let { st, hw, one } = tree();
  const view = derive(st, OFF);
  const md = ['# Set: One', 'target: Statistics > Problem set > 1.', '## Q a [choice]', 'A?', '- [x] y', '- [ ] n',
    '# Set: Three', 'target: Statistics > Problem set > 3.', '## Q a [number]', 'N?', 'answer: 3',
    '# Set: Parent', 'target: Statistics > Problem set', '## Q a [number]', 'N?', 'answer: 1',
    '# Set: Loose', '## Q a [number]', 'N?', 'answer: 2'].join('\n');
  const { sets, errors } = parseQuestions(md);
  assertEqual(errors, []);
  const plan = planImport(st, view, sets, [], { picks: {} });
  assertEqual(plan.map(r => [r.dot, r.create, r.problem]), [
    [one, null, null], [null, { parent: hw, name: '3.' }, null],
    [null, null, '“Problem set” has children: their questions decide it. Aim at one of them.'], [null, null, 'It has no target: choose its star-dot.']]);
  const r = applyImport(st, plan, sets, { options: OFF });
  st = r.state;
  const three = r.dots[1];
  assertEqual([r.problem, r.dots.length, st.dots[three].name, st.dots[one].role, st.dots[three].role, questionsOf(st.dots[three].assessment).length], [null, 2, '3.', 'assess', 'assess', 1]);
  assertEqual(derive(st, OFF).children(hw).includes(three), true, 'the new one is a child of Problem set');
  const again = applyImport(st, planImport(st, derive(st, OFF), [sets[0]], []), [sets[0]], { mode: 'append', options: OFF }).state;
  assertEqual(questionsOf(again.dots[one].assessment).map(q => q.id), ['a', 'a-2'], 'Append keeps both, ids made unique');
  assertEqual(questionsOf(applyImport(st, planImport(st, derive(st, OFF), [sets[0]], []), [sets[0]], { mode: 'replace', options: OFF }).state.dots[one].assessment).length, 1);
  // Export writes every set with its target; importing that file finds the same star-dots.
  const out = parseQuestions(exportQuestions(st, derive(st, OFF)));
  assertEqual([out.errors, out.sets.map(s => s.target)], [[], ['Statistics > Problem set > 1.', 'Statistics > Problem set > 3.']]);
  assertEqual(planImport(st, derive(st, OFF), out.sets, []).map(r => r.dot), [one, three]);
});

test('AA8: under Independent a target is “Category > Item”, created at the end of its list', () => {
  let st = createState();
  const k = centralStar(st).kites[0];
  let x;
  [st, x] = addItem(st, k, 'Existing');
  const cats = Array.from({ length: 6 }, (_, i) => ({ name: `Cat ${i}` }));
  const opts = { ...OFF, stardots: 'independent' };
  const view = derive(st, opts);
  const color = st.kites[k].color;
  const { sets } = parseQuestions(`# Set: A\ntarget: Cat ${color} > Existing\n## Q a [number]\nN?\nanswer: 1\n# Set: B\ntarget: Cat ${color} > New one\n## Q a [number]\nN?\nanswer: 2\n# Set: C\ntarget: Existing\n## Q a [number]\nN?\nanswer: 3`);
  const plan = planImport(st, view, sets, cats);
  assertEqual(plan.map(r => [r.dot, r.create, r.problem]), [[x, null, null], [null, { kite: k, name: 'New one' }, null], [x, null, null]]);
  st = applyImport(st, plan, sets, { options: opts }).state;
  assertEqual(st.lists[k].map(d => st.dots[d].name), ['Existing', 'New one']);
});
