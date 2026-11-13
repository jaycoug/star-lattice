// Round 15 (AA7): check a question file (question-format.md) from the command line, the way MATERIALS ›
// Import questions… does: every error with its line number, then each set (its target, questions, kinds).
// Usage: node tools/check_questions.mjs <file.md> [more.md …]   (exit code 1 when a file has errors)
// Round 17: a file of plain typed-up questions (numbered, A) B) …, Answer:) is checked too.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// qset.js is a plain ES module with no imports, so Node loads it as data (the project has no package.json).
const src = readFileSync(join(here, '..', 'shared', 'engine', 'qset.js'), 'utf8');
const qsetUrl = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
// Round 17: plain.js (plain typed-up questions) imports qset.js: pointed at the same module.
const plain = readFileSync(join(here, '..', 'shared', 'engine', 'plain.js'), 'utf8').replace("from './qset.js'", `from '${qsetUrl}'`);
const Q = { ...(await import(qsetUrl)), ...(await import('data:text/javascript;base64,' + Buffer.from(plain).toString('base64'))) };

const files = process.argv.slice(2);
if (!files.length) { console.log('Usage: node tools/check_questions.mjs <file.md> [more.md …]'); process.exit(2); }
let bad = false;
for (const f of files) {
  const { sets, errors } = Q.readQuestions(readFileSync(f, 'utf8'));   // round 17: plain questions too
  console.log(`${f}: ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}, ${sets.reduce((n, s) => n + Q.questionsOf(s).length, 0)} questions, ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`);
  for (const e of errors) console.log(`  line ${e.line}: ${e.message}`);
  for (const s of sets) {
    const kinds = Q.questionsOf(s).reduce((m, q) => ({ ...m, [q.kind]: (m[q.kind] ?? 0) + 1 }), {});
    console.log(`  · ${s.title || '(untitled)'} → ${s.target || '(no target: picked when imported)'} · ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}${s.items.some(i => i.type === 'chain') ? ` · ${s.items.filter(i => i.type === 'chain').length} chains` : ''}`);
  }
  if (errors.length) bad = true;
}
process.exit(bad ? 1 : 0);
