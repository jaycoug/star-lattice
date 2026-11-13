// A one-time import of a numbered multiple-choice question bank with an answer key (the format of
// test/fixtures/quiz-bank.md) into a save's category lists.
//
// parseQuiz(markdown) reads the file: its "## Category n — …" sections in order, each question
// "**Q001.** …" with its choices "A. …" to "D. …" (up to E), and the answer key's "Q001 **B**"
// entries. Subsets ("### Subset …") and definitions are ignored. It refuses anything incomplete: a
// question without 4–5 choices in order, or without a key entry.
//
// importQuiz(rawSave, rawContent, markdown) returns { save, content, log }:
//   - category n of the file goes to the content set's category n − 1, the central kite of that color;
//   - each question becomes an item at the end of its list, named by its number ("Q001"), with its
//     question, choices and the key's correct letter (no explanation or image: the assessor adds those);
//   - the content set's Stars and Questions settings become the quiz's: Kites in: Central star only,
//     Star-dots: Independent, Deploy: Automatically, Every star-dot is a question: On. The per-star
//     count, the goal and the wrong-answer rule stay as the assessor chose them.
// It refuses (returns nothing) when the save's lists already hold items (a second run), when the
// save isn't on that content set, or when the file's categories don't match the content set's.
//
// It writes nothing itself: test/headless/importflow.js calls it on its copy.

import { normalizeSave, normalizeContent, centralStar, addItem, setAssessment, FORMAT_VERSION, CHOICE_LETTERS } from '../shared/engine/index.js';

export const QUIZ_RULES = { kites: 'central', stardots: 'independent', deploy: 'auto', questions: 'on' };

/** The file's categories: [{ n, title, questions: [{ id, question, choices, correct }] }]. Throws on anything incomplete. */
export function parseQuiz(md) {
  const cats = [];
  const key = new Map();
  let q = null;
  let inKey = false;
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if (/^##\s+Answer key/i.test(line)) { inKey = true; q = null; continue; }
    if (inKey) {
      for (const k of line.matchAll(/\b(Q\d{3})\s+\*\*([A-E])\*\*/g)) {
        if (key.has(k[1])) throw new Error(`The answer key gives ${k[1]} twice.`);
        key.set(k[1], k[2]);
      }
      continue;
    }
    if ((m = /^##\s+Category\s+(\d+)\s*[—–-]\s*(.+?)\s*(\(Q\d{3}\s*[–-]\s*Q\d{3}\))?$/.exec(line))) {
      cats.push({ n: Number(m[1]), title: m[2], questions: [] });
      q = null;
      continue;
    }
    if (line.startsWith('#')) { q = null; continue; }   // a subset heading (ignored)
    if ((m = /^\*\*(Q\d{3})\.\*\*\s*(.*)$/.exec(line))) {
      if (!cats.length) throw new Error(`${m[1]} comes before any category.`);
      q = { id: m[1], question: m[2], choices: [], correct: null };
      cats[cats.length - 1].questions.push(q);
      continue;
    }
    if (!q) continue;   // a definition, the introduction, a rule
    if ((m = /^([A-E])\.\s+(.*)$/.exec(line))) {
      if (CHOICE_LETTERS[q.choices.length] !== m[1]) throw new Error(`${q.id}: choice ${m[1]} is out of order.`);
      q.choices.push(m[2]);
      continue;
    }
    if (line && !q.choices.length) q.question += '\n' + line;   // a question running onto more lines
  }
  const seen = new Set();
  for (const c of cats) {
    for (const x of c.questions) {
      if (seen.has(x.id)) throw new Error(`${x.id} appears twice.`);
      seen.add(x.id);
      if (!x.question.trim()) throw new Error(`${x.id} has no question.`);
      if (x.choices.length < 4 || x.choices.length > 5) throw new Error(`${x.id} has ${x.choices.length} choices (4 or 5 needed).`);
      const letter = key.get(x.id);
      if (!letter) throw new Error(`The answer key has no entry for ${x.id}.`);
      x.correct = CHOICE_LETTERS.indexOf(letter);
      if (x.correct >= x.choices.length) throw new Error(`${x.id}: the key says ${letter}, but it has ${x.choices.length} choices.`);
    }
  }
  for (const k of key.keys()) if (!seen.has(k)) throw new Error(`The answer key names ${k}, which isn’t in the questions.`);
  return cats;
}

export function importQuiz(rawSave, rawContent, md) {
  const save = normalizeSave(rawSave);
  const content = normalizeContent(rawContent);
  if (save.content !== content.id) throw new Error(`The save is on the content set “${save.content}”, not “${content.id}”.`);
  if (Object.values(save.state.lists ?? {}).some(l => l.length)) throw new Error('The save’s lists already hold items: the import runs once, on empty lists.');
  const cats = parseQuiz(md);
  if (cats.length !== content.categories.length) throw new Error(`The file has ${cats.length} categories; the content set has ${content.categories.length}.`);
  let st = save.state;
  const central = centralStar(st);
  const log = [];
  cats.forEach((cat, i) => {
    const kite = central.kites.find(k => st.kites[k].color === i);
    if (!kite) throw new Error(`No central kite has the color of “${content.categories[i].name}”.`);
    for (const x of cat.questions) {
      let id;
      [st, id] = addItem(st, kite, x.id);
      st = setAssessment(st, id, { question: x.question, choices: x.choices, correct: x.correct, explanation: '', image: null });
    }
    log.push(`Category ${cat.n} (${cat.title}) → ${content.categories[i].name}: ${cat.questions.length} items, ${cat.questions[0]?.id}–${cat.questions[cat.questions.length - 1]?.id}`);
  });
  const rules = { ...content.rules, ...QUIZ_RULES };
  log.push(`Settings: ${Object.entries(QUIZ_RULES).map(([k, v]) => `${k} ${v}`).join(', ')}; kept: perStar ${rules.perStar}, goalAfter ${rules.goalAfter}, wrong ${rules.wrong.mode}`);
  return {
    save: normalizeSave({ ...save, version: FORMAT_VERSION, state: st }),
    content: normalizeContent({ ...content, rules }),
    log,
  };
}
