// Round 17 (AB2, AB3): questions typed up as plain text, read into a set (kinds told from what's
// written), errors by question and line, either format through readQuestions, and splitting a set
// into one new star-dot per question.

import { test, assertEqual } from '../runner.js';
import { readQuestions, parsePlain, isMarkdownFormat, splitSet, questionsOf, askable, createState, centralStar, placeDot, derive, planImport } from '../../shared/engine/index.js';

const TEXT = `1. Which organelle makes ATP?
A) Ribosome
B) Mitochondrion
C) Nucleus
D) None of the above
Answer: B
Explanation: Cellular respiration happens there.

2) The function that loads a data set is ____.
Answer: data; data()

Q3. What is the hazard ratio for race?
Answer: 0.7160

Question 4: Write the line that fits the Cox model.
Answer: coxph(Surv(time, status) ~ age)

5. Pick both primes.
(a) 4
(b) 3
(c) 9
(d) 5
Answer: B and D
Hint: 1 isn't one.

6. Mean, then sd: ____ and ____
Answer: 3.2; 1.1
`;

test('AB2: plain questions: numbered, choices by letter, Answer:, Explanation:, Hint:; the kind told from what’s written', () => {
  const r = parsePlain(TEXT);
  assertEqual(r.errors, []);
  const qs = questionsOf(r.set);
  assertEqual(qs.map(q => q.kind), ['choice', 'blank', 'number', 'recall', 'choice', 'blank']);
  assertEqual(qs.map(q => q.id), ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
  assertEqual([qs[0].options.map(o => o.correct), qs[0].text, qs[0].explain], [[false, true, false, false], 'Which organelle makes ATP?', 'Cellular respiration happens there.']);
  assertEqual(qs[1].blanks, [['data', 'data()']], 'one blank: each answer is accepted');
  assertEqual([qs[2].answer, qs[2].decimals], [0.716, 4], 'a number, to its written decimals');
  assertEqual(qs[3].answer, 'coxph(Surv(time, status) ~ age)');
  assertEqual([qs[4].options.map(o => o.correct), qs[4].hints], [[false, true, false, true], ["1 isn't one."]]);
  assertEqual(qs[5].blanks, [['3.2'], ['1.1']], 'two blanks: one answer each, in order');
  assertEqual(askable(r.set), true);
});

test('AB2: without numbers, questions are separated by blank lines; a marked choice (*) needs no Answer:', () => {
  const r = parsePlain('Which is right?\nA) a\n*B) b\n\nWhat is 2 + 2?\nAnswer: 4 apples\n');
  assertEqual([r.errors, questionsOf(r.set).map(q => q.kind), questionsOf(r.set)[0].options.map(o => o.correct), questionsOf(r.set)[1].units], [[], ['choice', 'number'], [false, true], 'apples']);
});

test('AB2: what’s missing is said by question and line', () => {
  const r = parsePlain('1. No answer here\nA) x\nB) y\n\n2. What?\n\n3. Two blanks ____ ____\nAnswer: one\n\n4. Pick\nA) a\nB) b\nAnswer: E\n');
  assertEqual(r.errors.map(e => [e.line, e.message.split(':')[0]]), [[1, 'Question 1'], [5, 'Question 2'], [8, 'Question 3'], [13, 'Question 4']]);
  assertEqual(parsePlain('   \n').errors.length, 1, 'nothing at all');
});

test('AB3: readQuestions tells the two formats apart', () => {
  assertEqual([isMarkdownFormat('# Set: X\n'), isMarkdownFormat('## Q a [choice]\n'), isMarkdownFormat(TEXT)], [true, true, false]);
  assertEqual([readQuestions(TEXT).plain, readQuestions(TEXT).sets.length, readQuestions('# Set: X\n\n## Q a [number]\nA?\nanswer: 2\n').plain], [true, 1, false]);
});

test('AB3: a set split into one new star-dot per question, named by its first line, under a star-dot', () => {
  const set = parsePlain(TEXT).set;
  const parts = splitSet(set, 'Biology > Unit 1');
  assertEqual(parts.length, 6);
  assertEqual(parts.map(s => s.target.split(' > ').at(-1)), ['Which organelle makes ATP?', 'The function that loads a data set is ….', 'What is the hazard ratio for race?', 'Write the line that fits the Cox model.', 'Pick both primes.', 'Mean, then sd: … and …']);
  assertEqual(parts.every(s => questionsOf(s).length === 1 && s.target.startsWith('Biology > Unit 1 > ')), true);
  const twice = splitSet({ ...set, items: [set.items[0], set.items[0]] }, 'X');
  assertEqual(twice.map(s => s.title), ['Which organelle makes ATP?', 'Which organelle makes ATP? (2)'], 'names made unique');
  // Planned under a star-dot: each a new child.
  let st = createState();
  const k = st.stars[centralStar(st).id].kites[0];
  let d; [st, d] = placeDot(st, k, 0, 'Unit 1');
  const plan = planImport(st, derive(st, { now: 0 }), splitSet(set, 'Unit 1'), []);
  assertEqual(plan.map(r => [r.problem, r.create?.parent === d]), parts.map(() => [null, true]));
});
