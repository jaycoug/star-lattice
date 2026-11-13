// Round 9, stage 6 (Y16): tools/import_quiz.js: reading the questions file and importing it into a
// save's lists, on a small file of the same shape (the real one is imported by importflow.js).

import { test, assertEqual } from '../runner.js';
import { parseQuiz, importQuiz, QUIZ_RULES } from '../../tools/import_quiz.js';
import { createState, centralStar, listOf, SAVE_FORMAT, CONTENT_FORMAT, FORMAT_VERSION, project, index, optionsFrom, ZENITH } from '../../shared/engine/index.js';

const q = (n, letter = 'A', extra = '') => `**Q${String(n).padStart(3, '0')}.** Question ${n}?${extra}\n\nA. a${n}  \nB. b${n}  \nC. c${n}  \nD. d${n}\n`;
/** A file with `cats` categories of `per` questions, the key giving B for each (or `letters`). */
function file(cats = 6, per = 2, letters = null) {
  let md = '# Title\n\n**Structure:** intro text.\n\n---\n\n';
  const key = [];
  let n = 1;
  for (let c = 1; c <= cats; c++) {
    md += `## Category ${c} — Topic ${c} (Q001–Q028)\n\n### Subset ${c}.0 — Sub (Q001–Q004)\n**Definition:** ignored.\n\n`;
    for (let i = 0; i < per; i++, n++) { md += q(n) + '\n'; key.push(`Q${String(n).padStart(3, '0')} **${letters?.[n - 1] ?? 'B'}**`); }
  }
  return md + `## Answer key\n\nThe key.\n\n| Subset | Questions |\n|:--|:--|\n| 1.0 — Sub | ${key.join(', ')} |\n`;
}
const content = (rules = {}) => ({
  format: CONTENT_FORMAT, version: FORMAT_VERSION, id: 'quiz-bank', title: 'Quiz', start: { central: [0, 4, 2, 1, 3, 5] },
  categories: Array.from({ length: 6 }, (_, i) => ({ name: 'C' + i, color: '#00000' + i })), rules,
});
const save = () => {
  const colors = [0, 4, 2, 1, 3, 5];
  return { format: SAVE_FORMAT, version: 5, content: 'quiz-bank', title: 'Quiz bank', state: createState({ colors }) };
};

test('Y16: the file’s categories in order, its questions with their choices and the key’s letter; subsets, definitions and the introduction ignored', () => {
  const cats = parseQuiz(file(6, 2, ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']));
  assertEqual(cats.map(c => [c.n, c.title, c.questions.length]), [1, 2, 3, 4, 5, 6].map(n => [n, `Topic ${n}`, 2]));
  assertEqual(cats[0].questions[0], { id: 'Q001', question: 'Question 1?', choices: ['a1', 'b1', 'c1', 'd1'], correct: 0 });
  assertEqual(cats.flatMap(c => c.questions.map(x => x.correct)), [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
});

test('Y16: a question running onto more lines keeps them; CRLF line ends are read the same', () => {
  const md = file(1, 1).replace('Question 1?', 'Question 1?\nA second line.');
  assertEqual(parseQuiz(md)[0].questions[0].question, 'Question 1?\nA second line.');
  assertEqual(parseQuiz(file(1, 1).replace(/\n/g, '\r\n'))[0].questions[0].choices, ['a1', 'b1', 'c1', 'd1']);
});

test('Y16: anything incomplete is refused: a missing key entry, choices out of order or too few, a key naming no question', () => {
  const refused = md => { try { parseQuiz(md); return null; } catch (e) { return e.message; } };
  assertEqual(refused(file(1, 2).replace('Q002 **B**', '')), 'The answer key has no entry for Q002.');
  assertEqual(refused(file(1, 1).replace('B. b1', 'C. b1')), 'Q001: choice C is out of order.');
  assertEqual(refused(file(1, 1).replace(/D\. d1\n/, '').replace(/C\. c1  \n/, '')), 'Q001 has 2 choices (4 or 5 needed).');
  assertEqual(refused(file(1, 1).replace('Q001 **B**', 'Q001 **B**, Q099 **A**')), 'The answer key names Q099, which isn’t in the questions.');
});

test('Y16: importing puts each category’s questions in its central kite’s list, in order, named by number, with no explanation or image', () => {
  const { save: out, content: c, log } = importQuiz(save(), content(), file(6, 5));
  const st = out.state;
  const central = centralStar(st);
  const listOfCat = i => listOf(st, central.kites.find(k => st.kites[k].color === i));
  assertEqual([0, 1, 2, 3, 4, 5].map(i => listOfCat(i).map(d => st.dots[d].name)), [0, 1, 2, 3, 4, 5].map(i => [1, 2, 3, 4, 5].map(n => `Q${String(i * 5 + n).padStart(3, '0')}`)));
  const first = st.dots[listOfCat(0)[0]];
  assertEqual(first.assessment.items, [{ type: 'q', id: 'q1', kind: 'choice', text: 'Question 1?', image: null, hints: [], explain: '',
    options: ['a1', 'b1', 'c1', 'd1'].map((t, i) => ({ text: t, correct: i === 1, feedback: '' })), shuffle: 'default' }], 'round 15: a set of one choice question');
  assertEqual([out.version, out.content, Object.values(st.dots).every(d => !index(st).dot.has(d.id))], [FORMAT_VERSION, 'quiz-bank', true], 'in no kite slot');
  assertEqual(log.length, 7);
  assertEqual(QUIZ_RULES, { kites: 'central', stardots: 'independent', deploy: 'auto', questions: 'on' });
  assertEqual([c.rules.kites, c.rules.stardots, c.rules.deploy, c.rules.questions], ['central', 'independent', 'auto', 'on']);
});

test('Y16: the per-star count, the goal and the wrong-answer rule stay as the assessor chose them', () => {
  const { content: c } = importQuiz(save(), content({ perStar: 6, goalAfter: 7, wrong: { mode: 'wait', minutes: 3 }, locks: 'off' }), file(6, 1));
  assertEqual([c.rules.perStar, c.rules.goalAfter, c.rules.wrong, c.rules.locks], [6, 7, { mode: 'wait', minutes: 3 }, 'off']);
});

test('Y16: under the quiz settings the first four items fill each central kite, the Zenith fourth', () => {
  const { save: out, content: c } = importQuiz(save(), content(), file(6, 28));
  const st = out.state;
  const k = centralStar(st).kites.find(x => st.kites[x].color === 0);
  const placed = project(st, optionsFrom(c)).kites[k].dots.map(d => st.dots[d].name);
  assertEqual(placed, ['Q001', 'Q002', 'Q004', 'Q003']);
  assertEqual(project(st, optionsFrom(c)).kites[k].dots[ZENITH], listOf(st, k)[3]);
});

test('Y16: it runs once: a save whose lists hold items, on another content set, or with other categories is refused', () => {
  const refused = (...a) => { try { importQuiz(...a); return null; } catch (e) { return e.message; } };
  const once = importQuiz(save(), content(), file(6, 1)).save;
  assertEqual(refused(once, content(), file(6, 1)), 'The save’s lists already hold items: the import runs once, on empty lists.');
  assertEqual(refused({ ...save(), content: 'life' }, content(), file(6, 1)), 'The save is on the content set “life”, not “quiz-bank”.');
  assertEqual(refused(save(), content(), file(5, 1)), 'The file has 5 categories; the content set has 6.');
});
