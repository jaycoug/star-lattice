// Questions written as plain text, the way they're usually typed up, read
// into a question set. No ids, kinds or Markdown keys to learn:
//
// 1. Which organelle makes ATP? numbered: 1. 1) Q1. Question 1:
// A) Ribosome choices on their own lines: A) A. (A) a)
// B) Mitochondrion
// Answer: B the right letter(s): B, or B and D, or B, D
// Explanation: Cellular respiration… optional (also Hint:)
//
// 2. The function that loads a data set is ____. a blank: four or more underscores
// Answer: data answers in order, separated by ;
// (with one blank, each is accepted)
// 3. What is the hazard ratio for race?
// Answer: 0.716 a number: checked to its written decimals
//
// 4. Write the line that fits the Cox model.
// Answer: coxph(Surv(time, status) ~ age) anything else: typed and compared
//
// Without numbers, questions are separated by blank lines. readQuestions() takes either this or
// the round 15 Markdown (question-format.md), which it tells apart by its # Set: / ## Q headings.

import { parseQuestions, setValue, blankCount, writtenDecimals, parseNumber, OPTION_LETTERS, MIN_OPTIONS, MAX_OPTIONS } from './qset.js';

const START = /^\s*(?:q(?:uestion)?\s*)?(\d+)\s*[.):]\s+(.*)$/i;
const CHOICE = /^\s*(\*)?\s*\(?([A-Ha-h])[).:]\s+(.+?)\s*(\*|\(correct\)|✓)?\s*$/;
const KEY = /^\s*(answer|answers|correct answer|correct|ans|explanation|explain|why|hint)\s*[:=]\s*(.*)$/i;
const FENCE = /^\s*(```|~~~)/;

/** Whether a text is the round 15 Markdown format rather than plain questions. */
export const isMarkdownFormat = text => /^\s*#\s*Set\s*:/im.test(text) || /^\s*#{2,3}\s*Q\s+\S+\s*\[/im.test(text);

/** Read plain questions: { set (or null), errors: [{ line, message }] }. */
export function parsePlain(text) {
  const rows = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const errors = [];
  // Split into blocks: by numbered starts when there are any, else by blank lines (outside code).
  const numbered = rows.some(r => START.test(r));
  const blocks = [];
  let cur = null, fence = null;
  rows.forEach((raw, i) => {
    const line = i + 1;
    if (fence) { if (raw.trim().startsWith(fence)) fence = null; cur?.lines.push([raw, line]); return; }
    const f = FENCE.exec(raw);
    if (f) { fence = f[1]; if (!cur) { cur = { line, lines: [] }; blocks.push(cur); } cur.lines.push([raw, line]); return; }
    const m = numbered && START.exec(raw);
    if (m) { cur = { line, lines: [[m[2], line]] }; blocks.push(cur); return; }
    if (!numbered && !raw.trim()) { cur = null; return; }
    if (!cur) { if (!raw.trim()) return; cur = { line, lines: [] }; blocks.push(cur); }
    cur.lines.push([raw, line]);
  });
  const items = blocks.map((b, bi) => question(b, bi, errors)).filter(Boolean);
  if (!items.length && !errors.length) errors.push({ line: 1, message: 'No questions found: number them (1. 2. …) or leave a blank line between them.' });
  return { set: items.length ? setValue({ items }) : null, errors };
}

function question(b, bi, errors) {
  const n = bi + 1;
  const err = (line, message) => errors.push({ line, message: `Question ${n}: ${message}` });
  const text = [], options = [], keys = {};
  let field = null, fence = null;
  for (const [raw, line] of b.lines) {
    if (fence) { (field ?? text).push(raw); if (raw.trim().startsWith(fence)) fence = null; continue; }
    const f = FENCE.exec(raw);
    if (f) { fence = f[1]; (field ?? text).push(raw); continue; }
    const k = KEY.exec(raw);
    if (k) {
      const name = /^(answers?|correct answer|correct|ans)$/i.test(k[1]) ? 'answer' : /^(explanation|explain|why)$/i.test(k[1]) ? 'explain' : 'hint';
      if (keys[name]) err(line, `${k[1]}: is given twice.`);
      keys[name] = { lines: k[2] ? [k[2]] : [], line };
      field = keys[name].lines;
      continue;
    }
    const c = !field && !fence && CHOICE.exec(raw);
    if (c && (options.length || text.some(t => t.trim()))) {
      const letter = c[2].toUpperCase();
      if (letter !== OPTION_LETTERS[options.length]) err(line, `choice ${letter} comes where ${OPTION_LETTERS[options.length] ?? 'none'} should.`);
      options.push({ text: c[3], correct: !!(c[1] || c[4]), line });
      continue;
    }
    if (options.length && !field && raw.trim()) { options[options.length - 1].text += ` ${raw.trim()}`; continue; }   // a choice that wraps
    (field ?? text).push(raw);
  }
  const body = trim(text);
  const answer = keys.answer ? trim(keys.answer.lines) : '';
  const base = { id: `q${n}`, text: body, explain: keys.explain ? trim(keys.explain.lines) : '', hints: keys.hint ? [trim(keys.hint.lines)] : [] };
  if (!body) err(b.line, 'it has no text.');
  if (options.length) {
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) err(options[0].line, `a multiple-choice question has ${MIN_OPTIONS}–${MAX_OPTIONS} choices; this one has ${options.length}.`);
    if (answer) {
      const letters = /^\(?[A-Ha-h]\)?(\s*(,|&|\/|and|or)\s*\(?[A-Ha-h]\)?)*\.?$/i.test(answer) ? answer.toUpperCase().match(/\b[A-H]\b/g) ?? [] : null;
      if (letters) {
        for (const o of options) o.correct = false;
        for (const l of letters) { const i = OPTION_LETTERS.indexOf(l); if (options[i]) options[i].correct = true; else err(keys.answer.line, `the answer ${l} isn’t one of its choices.`); }
      } else {
        const hit = options.findIndex(o => o.text.trim().toLowerCase() === answer.toLowerCase());
        if (hit >= 0) options.forEach((o, i) => { o.correct = i === hit; });
        else err(keys.answer.line, `Answer: is the right choice’s letter (like B, or B and D); “${answer}” isn’t one.`);
      }
    } else if (!options.some(o => o.correct)) err(b.line, 'it has no Answer: line (the right letter, like Answer: B).');
    return { ...base, kind: 'choice', options: options.map(o => ({ text: o.text, correct: o.correct, feedback: '' })) };
  }
  if (!answer) { err(b.line, 'it has no Answer: line.'); return null; }
  const blanks = blankCount(body);
  if (blanks) {
    const parts = answer.split(';').map(s => s.trim()).filter(Boolean);
    if (blanks === 1) return { ...base, kind: 'blank', blanks: [parts] };
    if (parts.length !== blanks) err(keys.answer.line, `it has ${blanks} blanks and ${parts.length} answers (give one per blank, separated by ;).`);
    return { ...base, kind: 'blank', blanks: Array.from({ length: blanks }, (_, j) => (parts[j] ? [parts[j]] : [])) };
  }
  const m = /^(\S+)\s*(.*)$/.exec(answer);
  const units = m && m[2] && !/\s/.test(m[2]) && /^[^\d\s]/.test(m[2]) ? m[2] : '';
  const value = m ? parseNumber(m[1]) : NaN;
  if (Number.isFinite(value) && (!m[2] || units)) return { ...base, kind: 'number', answer: value, decimals: writtenDecimals(m[1].replace(/[,\s]/g, '')), tolerance: null, units };
  return { ...base, kind: 'recall', answer: answer.replace(/^`([^`]*)`$/, '$1'), accept: [] };
}

const trim = lines => lines.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '');

/** Either format: { sets, errors, plain }. A plain text is one set with no title or target. */
export function readQuestions(text, opts) {
  if (isMarkdownFormat(text)) return { ...parseQuestions(text, opts), plain: false };
  const r = parsePlain(text);
  return { sets: r.set ? [r.set] : [], errors: r.errors, plain: true };
}
