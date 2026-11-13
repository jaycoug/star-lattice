// Stage 5: builds the click-throughs' boards in test/fixtures/ with the app's own engine, from
// scratch (invented content, nothing from anyone's saves). The checks run on these, never on a
// real save: test/headless/run-node.sh copies them in as saves/ and content/.
//
//   saves/outlook.json + content/life.json      a life organizer, Hierarchical: six central kites,
//       planned and deployed stars two rings out, every status (open, in training, ignited, due
//       again), due dates, hours planned, relations, marks, the shelf, retired star-dots, notes.
//       Statistics › Problem set (children 1.–5.) is where qsetflow imports problem-set.md;
//       Computer Science is treeflow's star-dot that grew a star.
//   saves/Quiz bank.json + content/quiz-bank.json   an empty board on a six-category content set
//       (quizflow builds on it; importflow imports quiz-bank.md into it).
//   quiz-bank.md   168 generated questions with a key, for tools/import_quiz.js.
//
// Usage (from the project folder):  node tools/build_fixtures.mjs
// Dates are relative to the day it runs; the checks compute theirs from the board, so a rebuild is
// only needed when the fixtures change.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../shared/engine/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'test', 'fixtures');
const BASE = JSON.parse(readFileSync(join(ROOT, 'tools', 'pack-base.json'), 'utf8'));
const DAY = 24 * 60 * 60 * 1000;
const TODAY = new Date(new Date().toDateString()).getTime();
const NOW = Date.now();
const ago = days => NOW - days * DAY;
const date = days => new Date(TODAY + days * DAY).toISOString().slice(0, 10);
const write = (f, v) => { mkdirSync(dirname(join(OUT, f)), { recursive: true }); writeFileSync(join(OUT, f), typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n'); };

// ---- The organizer ---------------------------------------------------------------------------
// Per category: its central kite's four star-dots (Nadir, Port, Starboard, Zenith). A node:
//   name; props { difficulty, persistence, environment, finance, due }; marks; desc;
//   done: days ago it was completed; lapsed: completed once, not now (in training);
//   kids: its children (they fill its star); deploy: deploy its star; kite: its kite's name.
const d = (name, more = {}) => ({ name, ...more });
const LIFE = {
  id: 'life', title: 'Life organizer (test fixture)',
  categories: ['Work', 'Skills', 'Home', 'School', 'Health', 'Fun'],
  colors: ['#7e47ff', '#e800d4', '#ff009a', '#ff5362', '#ff962f', '#ffcd05'],
  marks: [{ id: 'people', symbol: '☺', name: 'Involves others' }, { id: 'money', symbol: '$', name: 'Costs money' }, { id: 'place', symbol: '⌂', name: 'Somewhere else' }],
  kites: ['Job search', 'Practice', 'Chores', 'Courses', 'Routines', 'Weekends'],
  tree: [
    [d('Update the résumé', { props: { difficulty: 'easy', environment: 'office' }, done: 3 }),
      d('Ask for two references', { marks: ['people'], props: { due: date(4) } }),
      d('Research five companies', { props: { difficulty: 'medium' }, lapsed: true }),
      d('Applications', { deploy: true, props: { difficulty: 'hard', due: date(12) }, kids: [
        d('Write a cover letter', { done: 2 }), d('Apply to the first company', { props: { due: date(1) } }),
        d('Apply to the second company'), d('Follow up after a week', { props: { due: date(9) } }),
        d('Interview practice', { kids: [d('Common questions'), d('A mock interview', { marks: ['people'] }), d('Questions to ask them')] }),
        d('Track every application', { props: { persistence: 'weekly' }, done: 10 })] })],
    [d('Touch typing', { props: { persistence: 'daily', difficulty: 'easy' }, done: 3 }),
      d('Spreadsheet formulas', { props: { difficulty: 'medium' }, done: 1 }),
      d('Public speaking', { marks: ['people'], props: { difficulty: 'hard' }, lapsed: true }),
      d('Computer Science', { deploy: true, kids: [
        d('Variables and types', { done: 5 }), d('Loops', { done: 4 }), d('Functions', { lapsed: true }), d('Recursion'),
        d('Data structures', { kids: [d('Lists'), d('Trees'), d('Hash tables')] }),
        d('Algorithms'), d('Sorting'), d('Searching'),
        d('A small project', { kids: [d('Pick the idea'), d('Build it'), d('Show someone', { marks: ['people'] })] }),
        d('Version control'), d('Testing')] })],
    [d('Laundry', { props: { persistence: 'weekly', environment: 'den' }, done: 9 }),
      d('Groceries', { props: { persistence: 'weekly', finance: { amount: -80, period: 'week' }, environment: 'local' }, marks: ['money', 'place'], done: 2 }),
      d('Pay rent', { props: { persistence: 'monthly', finance: { amount: -1200, period: 'month' }, due: date(-1) }, marks: ['money'] }),
      d('Kitchen', { kids: [d('Clean the fridge', { props: { environment: 'kitchen' } }), d('Sharpen the knives'), d('Restock the spices', { done: 6 })] })],
    [d('Read chapter one', { props: { difficulty: 'easy' }, done: 12 }),
      d('Study group', { marks: ['people'], props: { persistence: 'weekly' }, done: 8 }),
      d('Coursework', { kids: [
        d('Essay outline', { done: 7 }), d('Essay draft', { props: { due: date(5) } }), d('Lab report', { lapsed: true }),
        d('Final exam', { props: { due: date(30), difficulty: 'hard' } })] }),
      d('Statistics', { deploy: true, kids: [
        d('Lecture notes', { done: 4 }), d('Office hours', { marks: ['people'], props: { due: date(2) } }),
        d('Midterm review', { props: { due: date(14), difficulty: 'hard' } }),
        d('Problem set', { at: [0, E.ZENITH], deploy: true, kids: [d('1.'), d('2.'), d('3.'), d('4.'), d('5.')] })] })],
    [d('Morning walk', { props: { persistence: 'daily', environment: 'local' }, done: 0 }),
      d('Drink water', { props: { persistence: 'daily' }, done: 2 }),
      d('Dentist appointment', { props: { due: date(-3), finance: { amount: -60, period: 'once' } }, marks: ['place', 'money'] }),
      d('Fitness', { deploy: true, kids: [
        d('Stretching', { props: { persistence: 'daily' }, done: 1 }), d('Run two miles', { props: { difficulty: 'medium' }, done: 3 }),
        d('Strength training', { props: { persistence: 'weekly' }, lapsed: true }), d('Sign up for a race', { props: { due: date(20) }, marks: ['money'] })] })],
    [d('Call a friend', { marks: ['people'], props: { persistence: 'weekly' }, done: 4 }),
      d('Read a novel', { done: 20 }),
      d('Learn a song', { props: { difficulty: 'medium' } }),
      d('Trip planning', { deploy: true, kids: [
        d('Pick a weekend', { done: 1 }), d('Book a place to stay', { props: { finance: { amount: -150, period: 'once' } }, marks: ['money'] }),
        d('Pack a bag'), d('Plan the route', { props: { environment: 'distant' } })] })],
  ],
  relations: [['Update the résumé', 'Applications', 5, 'The résumé goes with every application.'], ['Public speaking', 'A mock interview', 4, ''],
    ['Statistics', 'Spreadsheet formulas', 3, 'Both use the same formulas.'], ['Groceries', 'Kitchen', 3, ''], ['Morning walk', 'Run two miles', 2, ''], ['Study group', 'Office hours', 3, '']],
  blocks: [['Write a cover letter', 1, 1], ['Essay draft', 1, 2], ['Morning walk', 2, 1], ['Midterm review', 3, 2], ['Pack a bag', 4, 1], ['Recursion', 2, 1]],
  shelve: ['Learn a song'],
  retire: ['Read a novel', 'Restock the spices'],
  dotNotes: [['Statistics', 'Ask about the grading scale.']],
  starNotes: [['Computer Science', 'Work through these in order.']],
  generalNotes: ['Review the week every Sunday.', 'Due dates first, then the rest.'],
  descriptions: [['Applications', 'Every job application, from the letter to the follow-up.'], ['Fitness', 'Training for a first race.']],
};

function contentOf(p) {
  return E.normalizeContent({
    ...BASE, id: p.id, title: p.title,
    categories: p.categories.map((name, i) => ({ name, color: p.colors[i] })),
    marks: p.marks ?? [], start: { central: [0, 1, 2, 3, 4, 5] }, rules: { ...BASE.rules, ...(p.rules ?? {}) },
  });
}

function organizer(p, content) {
  const opts = { ...E.optionsFrom(content), now: NOW };
  const save = E.newSave(content, 'outlook');
  let st = save.state;
  const central = E.centralStar(st).kites;
  const byName = new Map();
  const toDeploy = [];
  const dress = (id, node) => {
    st = E.updateDot(st, id, { props: node.props ?? {}, marks: node.marks ?? [] });
    if (node.done != null) st = E.ignite(st, id, ago(node.done));
    if (node.lapsed) st = E.lapse(E.ignite(st, id, ago(15)), id);
    if (byName.has(node.name)) throw new Error(`two star-dots are named ${node.name}`);
    byName.set(node.name, id);
    if (node.deploy) toDeploy.push(id);   // parents first: a star deploys from a deployed one
    for (const kid of node.kids ?? []) {
      const r = E.addChild(st, id, kid.name, { options: opts });
      if (r.problem) throw new Error(`${node.name} › ${kid.name}: ${r.problem}`);
      st = r.state;
      if (kid.at) {   // a chosen place on its star: [kite index, slot]
        const to = { kite: st.stars[st.dots[id].branch].kites[kid.at[0]], slot: kid.at[1] };
        st = E.swapDots(st, { ...E.index(st).dot.get(r.dot) }, to, opts).state;
      }
      dress(r.dot, kid);
    }
  };
  p.tree.forEach((nodes, i) => {
    st = E.updateKite(st, central[i], { name: p.kites[i] });
    nodes.forEach((node, j) => {
      let id;
      [st, id] = E.placeDot(st, central[i], [0, 1, 3, 2][j], node.name);
      dress(id, node);
    });
  });
  const at = name => { if (!byName.has(name)) throw new Error(`no star-dot ${name}`); return byName.get(name); };
  for (const [a, b, score, how] of p.relations) st = E.addRelation(st, at(a), at(b), score, how);
  for (const [name, text] of p.descriptions) st = E.updateDot(st, at(name), { description: text });
  for (const [name, text] of p.dotNotes) st = E.addDotNote(st, at(name), text);
  for (const id of toDeploy) {
    const r = E.deployStar(st, id, opts);
    if (r.problem) throw new Error(`deploying ${st.dots[id].name}: ${r.problem}`);
    st = r.state;
  }
  for (const [name, text] of p.starNotes) st = E.addNote(st, st.dots[at(name)].branch, text);
  for (const text of p.generalNotes) st = E.addNote(st, E.centralStar(st).id, text);
  for (const [name, day, hours] of p.blocks) st = E.placeBlocks(st, at(name), TODAY + day * DAY, hours).state;
  for (const name of p.retire) st = E.retireDot(st, at(name), ago(1));
  for (const name of p.shelve) st = E.shelveDot(st, at(name));
  return E.normalizeSave({ ...save, state: st });
}

const life = contentOf(LIFE);
const outlook = organizer(LIFE, life);
write('content/life.json', life);
write('saves/outlook.json', outlook);

// ---- The quiz bank ----------------------------------------------------------------------------
const QUIZ = {
  id: 'quiz-bank', title: 'Quiz bank (test fixture)',
  categories: ['Numbers', 'Words', 'Places', 'Science', 'History', 'Arts'],
  colors: ['#8172e1', '#008ede', '#009aaf', '#2b9c79', '#7a965c', '#a48e64'],
};
const quiz = contentOf(QUIZ);
write('content/quiz-bank.json', quiz);
write('saves/Quiz bank.json', E.newSave(quiz, 'Quiz bank'));
const WORDS = ['first', 'second', 'third', 'fourth'];
let md = '# Quiz bank: 168 fixture questions\n\nA test fixture for the click-throughs (test/headless/importflow.js), read by tools/import_quiz.js. Each question has one right choice, given in the key.\n\n';
const key = [];
QUIZ.categories.forEach((cat, i) => {
  md += `## Category ${i + 1} — ${cat} (Q${String(i * 28 + 1).padStart(3, '0')}–Q${String(i * 28 + 28).padStart(3, '0')})\n\n`;
  for (let j = 0; j < 28; j++) {
    const n = i * 28 + j + 1, id = `Q${String(n).padStart(3, '0')}`;
    md += `**${id}.** Fixture question ${n}, on ${cat.toLowerCase()}: which of these four statements is the one marked right in the key?\n\n`;
    md += WORDS.map((w, k) => `${'ABCD'[k]}. The ${w} statement for question ${n}`).join('  \n') + '\n\n';
    key.push(`${id} **${'ABCD'[(n * 3) % 4]}**`);
  }
});
write('quiz-bank.md', md + '## Answer key\n\n' + key.join(' · ') + '\n');

const v = E.derive(outlook.state, { ...E.optionsFrom(life), now: NOW });
const dots = Object.values(outlook.state.dots);
const by = dots.reduce((m, x) => ({ ...m, [v.effective(x.id)?.status ?? 'off the board']: (m[v.effective(x.id)?.status ?? 'off the board'] ?? 0) + 1 }), {});
console.log(`outlook: ${dots.length} star-dots, ${Object.keys(outlook.state.stars).length} stars (${Object.values(outlook.state.stars).filter(s => s.deployed).length} deployed), ${JSON.stringify(by)}`);
console.log('quiz bank: an empty board on six categories, and quiz-bank.md');
