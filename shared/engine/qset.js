// Question sets. A □ star-dot's `assessment` is a set of questions, written and
// imported as Markdown (question-format.md) and kept in the save in the clean form below. This file
// parses and writes that Markdown, checks it (errors with line numbers) and grades answers. No DOM.
//
// Set { title, target, context, items: [Question | Chain] } (asked in the order written)
// Chain { type: 'chain', id, title, context, items: [Question] } (AA5: answered in order)
// Question { type: 'q', id, kind, text, image, hints: [text], explain, …by kind:
// choice options: [{ text, correct, feedback }] (2–8; several correct: choose all), shuffle: 'default' | 'on' | 'off'
// blank blanks: [[accepted answer]] (one list per ____ in its text), ignoreCase
// number answer (number), decimals (null or 0–10), tolerance (null or ≥ 0), units
// recall answer (text, usually code), accept: [text], ignoreCase
// step (nothing graded: instructions, code to copy)
// An accepted answer written /like this/i is a regular expression; others compare token by token
// (spacing, quote style and a trailing ; don't matter). `target` is used by import only.

export const KINDS = ['choice', 'blank', 'number', 'recall', 'step'];
export const GRADED = ['choice', 'blank', 'number', 'recall'];
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;
export const OPTION_LETTERS = 'ABCDEFGH'.split('');
export const BLANK = /_{4,}/g;
const KEYS = ['target', 'order', 'context', 'answer', 'accept', 'decimals', 'tolerance', 'units', 'explain', 'hint', 'image', 'case', 'shuffle'];
const KEY_FOR = {
  choice: ['explain', 'hint', 'image', 'shuffle'],
  blank: ['answer', 'accept', 'case', 'explain', 'hint', 'image'],
  number: ['answer', 'decimals', 'tolerance', 'units', 'explain', 'hint', 'image'],
  recall: ['answer', 'accept', 'case', 'explain', 'hint', 'image'],
  step: ['hint', 'image'],
};

const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
/** a shuffle switch, 'default' (as GOVERN says), 'on' or 'off'; round 15's true is 'on'. */
const tri = v => (v === true || v === 'on' ? 'on' : v === 'off' ? 'off' : 'default');
const isImage = v => typeof v === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,/.test(v);

// ---- The clean form --------------------------------------------------------------------------

/** Every question of a set, chains opened, in order. */
export const questionsOf = set => (set?.items ?? []).flatMap(it => (it.type === 'chain' ? it.items : [it]));
/** The graded ones (not steps). */
export const gradedOf = set => questionsOf(set).filter(q => GRADED.includes(q.kind));
/** The chain a question sits in, or null. */
export const chainOf = (set, qid) => (set?.items ?? []).find(it => it.type === 'chain' && it.items.some(q => q.id === qid)) ?? null;
/** The number of blanks in a text. */
export const blankCount = text => (str(text).match(BLANK) ?? []).length;

function questionValue(q, i) {
  const kind = KINDS.includes(q?.kind) ? q.kind : 'choice';
  const base = {
    type: 'q', id: str(q?.id).trim() || `q${i + 1}`, kind, text: str(q?.text),
    image: isImage(q?.image) ? q.image : null,
    hints: (Array.isArray(q?.hints) ? q.hints : []).map(str).filter(x => x.trim()),
    explain: str(q?.explain),
  };
  if (kind === 'choice') {
    const options = (Array.isArray(q.options) ? q.options : []).slice(0, MAX_OPTIONS)
      .map(o => ({ text: str(o?.text), correct: !!o?.correct, feedback: str(o?.feedback) }));
    return { ...base, options, shuffle: tri(q.shuffle) };
  }
  if (kind === 'blank') {
    const n = Math.max(1, blankCount(base.text));
    const given = Array.isArray(q.blanks) ? q.blanks : [];
    return { ...base, blanks: Array.from({ length: n }, (_, j) => (Array.isArray(given[j]) ? given[j] : []).map(str).filter(x => x.trim())), ignoreCase: !!q.ignoreCase };
  }
  if (kind === 'number') {
    const n = Number(q.answer);
    const dec = Number.isInteger(q.decimals) && q.decimals >= 0 && q.decimals <= 10 ? q.decimals : null;
    const tol = typeof q.tolerance === 'number' && Number.isFinite(q.tolerance) && q.tolerance >= 0 ? q.tolerance : null;
    return { ...base, answer: Number.isFinite(n) ? n : null, decimals: dec, tolerance: tol, units: str(q.units) };
  }
  if (kind === 'recall') return { ...base, answer: str(q.answer), accept: (Array.isArray(q.accept) ? q.accept : []).map(str).filter(x => x.trim()), ignoreCase: !!q.ignoreCase };
  return base;
}

/**
 * A clean set, or null. An older single multiple-choice assessment ({ question, choices,
 * correct, explanation, image }) becomes a set of one choice question, `q1`.
 */
export function setValue(a) {
  if (!a || typeof a !== 'object') return null;
  if (!Array.isArray(a.items) && ['question', 'choices', 'correct', 'explanation', 'image'].some(k => k in a)) {
    const choices = Array.isArray(a.choices) ? a.choices.map(str) : [];
    const correct = Number.isInteger(a.correct) ? a.correct : 0;
    return setValue({ items: [{ id: 'q1', kind: 'choice', text: str(a.question), image: a.image, explain: str(a.explanation),
      options: choices.map((t, i) => ({ text: t, correct: i === correct })) }] });
  }
  const seen = new Set();
  const uniq = id => { let x = id, n = 2; while (seen.has(x)) x = `${id}-${n++}`; seen.add(x); return x; };
  let qi = 0;
  const items = (Array.isArray(a.items) ? a.items : []).map((it, ci) => {
    if (it?.type === 'chain') {
      return { type: 'chain', id: uniq(str(it.id).trim() || `c${ci + 1}`), title: str(it.title), context: str(it.context),
        items: (Array.isArray(it.items) ? it.items : []).map(q => { const v = questionValue(q, qi++); return { ...v, id: uniq(v.id) }; }) };
    }
    const v = questionValue(it, qi++);
    return { ...v, id: uniq(v.id) };
  });
  return { title: str(a.title), target: str(a.target), context: str(a.context), items };
}

/** Whether a question can be asked: its text, and what its kind needs, written. Steps always can. */
export function questionReady(q) {
  if (!q) return false;
  if (q.kind === 'step') return !!q.text.trim();
  if (!q.text.trim()) return false;
  if (q.kind === 'choice') return q.options.length >= MIN_OPTIONS && q.options.every(o => o.text.trim()) && q.options.some(o => o.correct);
  if (q.kind === 'blank') return blankCount(q.text) >= 1 && q.blanks.every(b => b.length);
  if (q.kind === 'number') return q.answer != null;
  if (q.kind === 'recall') return !!q.answer.trim();
  return false;
}

/** what a question still needs, in words (empty when it's ready); the form shows them on its card. */
export function questionProblems(q) {
  if (!q) return ['It’s empty.'];
  const out = [];
  if (!q.text.trim()) out.push(q.kind === 'step' ? 'Write the step.' : 'Write the question.');
  if (q.kind === 'choice') {
    if (q.options.length < MIN_OPTIONS) out.push(`Give it at least ${MIN_OPTIONS} choices.`);
    q.options.forEach((o, i) => { if (!o.text.trim()) out.push(`Choice ${OPTION_LETTERS[i]} is empty.`); });
    if (!q.options.some(o => o.correct)) out.push('Tick the right choice (or choices).');
  }
  if (q.kind === 'blank') {
    if (!blankCount(q.text)) out.push('Put a blank (____) in the text: Insert a blank.');
    else q.blanks.forEach((b, j) => { if (!b.length) out.push(q.blanks.length > 1 ? `Blank ${j + 1} has no answer.` : 'The blank has no answer.'); });
  }
  if ((q.kind === 'number' && q.answer == null) || (q.kind === 'recall' && !q.answer.trim())) out.push('Give the answer.');
  return out;
}

/** Whether a set can be asked: at least one graded question, and every question ready. */
export const askable = set => !!set && gradedOf(set).length > 0 && questionsOf(set).every(questionReady);

// ---- Grading ---------------------------------------------------------------------------------

const OPS = ['<<-', '->>', '%>%', '%in%', '<-', '->', '<=', '>=', '==', '!=', '&&', '||', '::', '|>', '**', '//', '<>'];

/**
 * Code or text as tokens, language-agnostic: spacing and line breaks don't matter, '…' and "…" are
 * the same string, numbers compare by value, a # or "-- " comment and a trailing ; are dropped.
 */
export function tokens(code, ignoreCase = false) {
  let s = str(code).trim();
  if (/^`[^`]*`$/.test(s)) s = s.slice(1, -1);   // `inline code` as written in a file
  const t = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const rest = s.slice(i);
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '#' || rest.startsWith('-- ')) { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (ch === '"' || ch === "'") {
      let j = i + 1, out = '';
      while (j < s.length && s[j] !== ch) { if (s[j] === '\\') { out += s[j]; j++; } out += s[j] ?? ''; j++; }
      t.push('"' + (ignoreCase ? out.toLowerCase() : out) + '"');
      i = j + 1;
      continue;
    }
    let m;
    if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest))) { t.push(String(parseFloat(m[0]))); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_.$][\w.$]*/.exec(rest))) { t.push(ignoreCase ? m[0].toLowerCase() : m[0]); i += m[0].length; continue; }
    const op = OPS.find(o => rest.startsWith(o));
    if (op) { t.push(op); i += op.length; continue; }
    t.push(ch);
    i++;
  }
  while (t[t.length - 1] === ';') t.pop();
  return t;
}

const regexOf = a => { const m = /^\/(.+)\/([imsu]*)$/.exec(str(a).trim()); if (!m) return null; try { return new RegExp(m[1], m[2]); } catch { return null; } };
/** Whether a typed answer matches an accepted one: a /regular expression/, else the same tokens. */
export function matches(typed, accepted, ignoreCase = false) {
  const re = regexOf(accepted);
  if (re) return re.test(str(typed).trim());
  const a = tokens(typed, ignoreCase), b = tokens(accepted, ignoreCase);
  return a.length > 0 && a.length === b.length && a.every((x, i) => x === b[i]);
}

/** A typed number: commas, spaces and the units dropped. NaN when it isn't one. */
export function parseNumber(typed, units = '') {
  let s = str(typed).trim();
  if (units && s.toLowerCase().endsWith(units.toLowerCase())) s = s.slice(0, -units.length);
  s = s.replace(/[,\s]/g, '').replace(/^\+/, '').replace(/^−/, '-');
  return /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? Number(s) : NaN;
}

/** The decimals an answer is written to ("0.879" → 3). */
export const writtenDecimals = v => { const m = /\.(\d+)(?:e|$)/i.exec(String(v)); return m ? m[1].length : 0; };

/** How far a number may be off: its tolerance, else half a unit of its decimals (stated or as written). */
export const allowance = q => (q.tolerance != null ? q.tolerance : 0.5 * 10 ** -(q.decimals ?? writtenDecimals(q.answer)));

/**
 * Grade one answer: { correct, feedback, at }. `response` by kind: choice [option index]; blank
 * [typed, one per blank]; number typed text; recall typed text. `at` is, for a wrong recall, the
 * first token that differs (index into the typed tokens), for the "differs from here" hint.
 */
export function grade(q, response) {
  if (q.kind === 'choice') {
    const picked = new Set((Array.isArray(response) ? response : [response]).filter(Number.isInteger));
    const right = q.options.every((o, i) => o.correct === picked.has(i));
    const wrongPick = [...picked].find(i => !q.options[i]?.correct);
    return { correct: right, feedback: right ? '' : str(q.options[wrongPick]?.feedback) };
  }
  if (q.kind === 'blank') {
    const typed = Array.isArray(response) ? response : [response];
    const each = q.blanks.map((acc, j) => acc.some(a => matches(typed[j], a, q.ignoreCase)));
    return { correct: each.every(Boolean), feedback: '', blanks: each };
  }
  if (q.kind === 'number') {
    const x = parseNumber(response, q.units);
    if (Number.isNaN(x)) return { correct: false, feedback: 'That isn’t a number.', invalid: true };
    return { correct: Math.abs(x - q.answer) <= allowance(q) + 1e-12, feedback: '' };
  }
  if (q.kind === 'recall') {
    const ok = [q.answer, ...q.accept].some(a => matches(response, a, q.ignoreCase));
    if (ok) return { correct: true, feedback: '' };
    const a = tokens(response, q.ignoreCase), b = tokens(q.answer, q.ignoreCase);
    let at = 0;
    while (at < a.length && at < b.length && a[at] === b[at]) at++;
    return { correct: false, feedback: '', at, typed: a };
  }
  return { correct: true, feedback: '' };
}

/** yes / no (also true, on / false, off) as a boolean, else null. */
const yesNo = v => (/^(yes|true|on)$/i.test(str(v).trim()) ? true : /^(no|false|off)$/i.test(str(v).trim()) ? false : null);

// ---- shuffling --------------------------------------------------------------

/** Whether a shuffle switch is on, given GOVERN's default. */
export const shuffleOn = (v, byDefault) => v === 'on' || (v !== 'off' && !!byDefault);
/** GOVERN's default for choice questions: { choices }. (Shuffle the questions orders the field: independent.js fieldOrder.) */
export const shuffleDefaults = opts => ({ choices: opts?.shuffleChoices === 'on' });
const PINNED = /\b(all|none|both|neither)\s+of\s+the\s+above\b/i;
const NAMES_OTHERS = /\b[A-H]\s*(?:,\s*[A-H]\s*)*(?:and|or|&)\s*[A-H]\b/;
/** Place the indexes not pinned in shuffled order, the pinned ones staying where they are. */
function shuffleAround(n, pinned, seed) {
  const free = Array.from({ length: n }, (_, i) => i).filter(i => !pinned(i));
  const perm = shuffled(free.length, seed);
  const out = Array.from({ length: n }, (_, i) => i);
  free.forEach((pos, j) => { out[pos] = free[perm[j]]; });
  return out;
}
/**
 * A choice question's options in the order shown (option indexes): shuffled when its switch (or
 * GOVERN's default) says so. "All / None / Both / Neither of the above" keep their place; a question
 * whose options name others by letter ("Both A and C") keeps its order.
 */
export function choiceOrder(q, seed, byDefault = false) {
  const n = q.options.length;
  if (!shuffleOn(q.shuffle, byDefault) || q.options.some(o => NAMES_OTHERS.test(o.text))) return Array.from({ length: n }, (_, i) => i);
  return shuffleAround(n, i => PINNED.test(q.options[i].text), seed);
}
/** The seed of a star-dot's current attempt: the save's session seed, it, and when it last ignited (so a retrain draws again). */
export const attemptSeed = (st, dotId) => `${st?.seed ?? ''}|${dotId}|${st?.dots?.[dotId]?.ignitedAt ?? ''}`;

/** A stable shuffle of 0..n-1 from a seed text (the same order every time it's drawn). */
export function shuffled(n, seed) {
  let h = 2166136261;
  for (const c of str(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- Markdown --------------------------------------------------------------------------------

const keyLine = line => { const m = /^([a-z]+)(?:\s+(\d+))?:(?:\s(.*)|$)/.exec(line); return m && KEYS.includes(m[1]) ? { key: m[1], n: m[2] ? Number(m[2]) : null, value: m[3] ?? '' } : null; };
const optionLine = line => { const m = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line); return m ? { correct: m[1] !== ' ', text: m[2] } : null; };
const trimBlock = lines => { const a = [...lines]; while (a.length && !a[0].trim()) a.shift(); while (a.length && !a[a.length - 1].trim()) a.pop(); return a.join('\n'); };

/**
 * Read a question file: { sets: [Set], errors: [{ line, message }] } (lines count from 1). A file
 * may hold many sets ("# Set: title"); text before any "# Set:" with questions in it is one set.
 * `images` ({ qid: data URL }) fill "image: attached" lines (the editor's kept images).
 */
export function parseQuestions(md, { images = {} } = {}) {
  const lines = str(md).replace(/\r\n?/g, '\n').split('\n');
  const sets = [];
  const errors = [];
  const err = (line, message) => errors.push({ line, message });
  let set = null, chain = null, q = null, field = null, fence = null;
  const newSet = (title, line) => { set = { title, target: '', order: '', shuffle: '', context: [], items: [], line }; sets.push(set); chain = null; q = null; field = { on: set, key: 'context', lines: null }; };
  const close = () => {
    if (!q) return;
    finishQuestion(q, err, images);
    q = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const n = i + 1;
    const line = raw.replace(/\s+$/, '');
    // Inside a code fence everything is text.
    const f = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      push(raw, n);
      if (f && line.trim().startsWith(fence)) fence = null;
      continue;
    }
    let m;
    if ((m = /^#\s+Set:\s*(.*)$/.exec(line))) { close(); newSet(m[1].trim(), n); continue; }
    if ((m = /^##\s+Chain\b(?:\s+([\w.-]+))?\s*:?\s*(.*)$/.exec(line))) {
      close();
      if (!set) newSet('', n);
      chain = { type: 'chain', id: m[1] ?? '', title: m[2].trim(), context: [], items: [], line: n };
      set.items.push(chain);
      field = { on: chain, key: 'context', lines: null };
      continue;
    }
    if ((m = /^(##|###)\s+Q\b\s*([^\s[\]]*)\s*(?:\[([^\]]*)\])?\s*$/.exec(line))) {
      close();
      if (!set) newSet('', n);
      if (m[1] === '##') chain = null;
      else if (!chain) err(n, 'A ### question belongs in a chain (## Chain: …); it is read as a question of its own.');
      const kind = (m[3] ?? '').trim().toLowerCase();
      if (!KINDS.includes(kind)) err(n, kind ? `“${kind}” isn’t a kind of question: ${KINDS.join(', ')}.` : `Give its kind in brackets, e.g. ## Q ${m[2] || 'q1'} [choice].`);
      q = { type: 'q', id: m[2] ?? '', kind: KINDS.includes(kind) ? kind : 'choice', bad: !KINDS.includes(kind), body: [], options: [], keys: [], line: n };
      (chain ?? set).items.push(q);
      field = { on: q, key: 'body', lines: q.body };
      continue;
    }
    if (/^#\s/.test(line)) { if (set) err(n, 'A top heading starts a set: # Set: its title.'); continue; }   // before any set: the file's own title
    if (/^---+$/.test(line.trim())) continue;   // a rule between sets or questions (in a question's text too: use a code block for one)
    if (/^\s*<!--.*-->\s*$/.test(line)) continue;    // a comment
    // Keys, options and text.
    const k = keyLine(line);
    if (k) {
      if (!set) newSet('', n);
      if (q) {
        if (!q.bad && !KEY_FOR[q.kind].includes(k.key)) err(n, `${k.key}: isn’t used by a ${q.kind} question.`);
        const entry = { key: k.key, n: k.n, lines: k.value ? [k.value] : [], line: n };
        q.keys.push(entry);
        field = { on: q, key: k.key, lines: entry.lines };
      } else {
        const on = chain ?? set;
        if (k.key === 'context') { on.context = k.value ? [k.value] : []; field = { on, key: 'context', lines: on.context }; }
        else if (!chain && (k.key === 'target' || k.key === 'order' || k.key === 'shuffle')) { set[k.key] = k.value.trim(); set.keyLine = n; field = { on: set, key: 'context', lines: null }; }
        else { err(n, `${k.key}: belongs to a question (after its ## Q heading).`); field = null; }
      }
      continue;
    }
    if (!set) continue;   // the file's introduction, before its first set
    const o = q && q.kind === 'choice' && optionLine(line);
    if (o) { q.options.push({ text: o.text, correct: o.correct, feedback: [], line: n }); field = { on: q, key: 'feedback', lines: q.options[q.options.length - 1].feedback }; continue; }
    if (field?.key === 'feedback') {
      const fb = /^\s+>\s?(.*)$/.exec(line);
      if (fb) { field.lines.push(fb[1]); continue; }
      if (!line.trim()) continue;
      err(n, 'After the options, only an indented “> feedback” line or a key (explain:, hint:…) may follow.');
      continue;
    }
    if (f) fence = f[1];
    push(raw, n);
  }
  close();
  function push(raw, n) {
    if (!field) { if (raw.trim()) err(n, 'This line isn’t part of a set or question.'); return; }
    if (field.key === 'context' && field.lines === null) { field.on.context.push(raw); return; }
    if (field.lines === null) field.lines = field.on.context;
    field.lines.push(raw);
  }
  const out = sets.map(s => {
    const items = s.items.map(it => (it.type === 'chain'
      ? { type: 'chain', id: it.id, title: it.title, context: trimBlock(it.context), items: it.items.map(x => x.value).filter(Boolean) }
      : it.value)).filter(Boolean);
    if (!items.some(it => it.type === 'chain' ? it.items.length : true)) err(s.line, `${s.title ? `“${s.title}”` : 'This set'} has no questions.`);
    for (const it of s.items) if (it.type === 'chain' && !it.items.length) err(it.line, 'This chain has no questions (### Q … under it).');
    // A set's own order: / shuffle: lines (rounds 15 and 17) still read, and are ignored: a set is asked in the order written.
    return setValue({ title: s.title, target: s.target, context: trimBlock(s.context), items });
  });
  // Ids: written ones must be unique within a set.
  sets.forEach((s, si) => {
    const seen = new Map();
    for (const it of s.items.flatMap(x => (x.type === 'chain' ? [x, ...x.items] : [x]))) {
      if (!it.id) continue;
      if (seen.has(it.id)) err(it.line, `The id “${it.id}” is used twice in this set (line ${seen.get(it.id)}).`);
      else seen.set(it.id, it.line);
    }
    void si;
  });
  errors.sort((a, b) => a.line - b.line);
  return { sets: out, errors };
}

function finishQuestion(q, err, images) {
  if (q.bad) err = () => {};   // its kind is already wrong: nothing more to say about it
  const text = trimBlock(q.body);
  const all = k => q.keys.filter(x => x.key === k);
  const one = k => { const xs = all(k); if (xs.length > 1) err(xs[1].line, `${k}: is given twice.`); return xs[0] ? trimBlock(xs[0].lines) : null; };
  const unfence = s => { const m = /^\s*(```|~~~)[^\n]*\n([\s\S]*?)\n\s*\1\s*$/.exec(s ?? ''); return m ? m[2] : s; };
  const v = { type: 'q', id: q.id, kind: q.kind, text, hints: all('hint').map(x => trimBlock(x.lines)), explain: one('explain') ?? '' };
  const img = one('image');
  if (img != null) {
    if (isImage(img)) v.image = img;
    else if (img === 'attached') { if (q.id && images[q.id]) v.image = images[q.id]; }
    else err(all('image')[0].line, 'image: is “attached” (added in the editor) or a data:image URL.');
  }
  if (!text) err(q.line, q.kind === 'step' ? 'This step has no text.' : 'This question has no text (write it under its heading).');
  if (q.kind === 'choice') {
    if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS) err(q.line, `A choice question has ${MIN_OPTIONS}–${MAX_OPTIONS} options (- [ ] …, the right ones - [x] …); this one has ${q.options.length}.`);
    else if (!q.options.some(o => o.correct)) err(q.options[0].line, 'Mark the right option (or options) with [x].');
    const sh = one('shuffle');
    v.options = q.options.map(o => ({ text: o.text, correct: o.correct, feedback: trimBlock(o.feedback) }));
    if (sh != null && yesNo(sh) == null) err(all('shuffle')[0].line, `shuffle: is yes or no, not “${sh}”.`);
    v.shuffle = sh == null ? 'default' : yesNo(sh) ? 'on' : 'off';
  }
  if (q.kind === 'blank') {
    const count = blankCount(text);
    if (!count) err(q.line, 'A blank question needs at least one ____ (four or more underscores) in its text.');
    const answers = all('answer'), accepts = all('accept');
    const blanks = Array.from({ length: Math.max(count, 1) }, () => []);
    for (const a of [...answers, ...accepts]) {
      const j = a.n == null ? 0 : a.n - 1;
      if (j < 0 || j >= blanks.length) { err(a.line, `${a.key} ${a.n}: there ${count === 1 ? 'is one blank' : `are ${count} blanks`}.`); continue; }
      if (a.n == null && count > 1) err(a.line, `With ${count} blanks, number its answers: answer 1:, answer 2:…`);
      const val = unfence(trimBlock(a.lines));
      if (val.trim()) blanks[j].push(val);
    }
    blanks.forEach((b, j) => { if (count && !b.length) err(q.line, count > 1 ? `Blank ${j + 1} has no answer (answer ${j + 1}: …).` : 'It has no answer: (answer: …).'); });
    v.blanks = blanks;
    v.ignoreCase = /^ignore$/i.test(one('case') ?? '');
  }
  if (q.kind === 'number') {
    const a = one('answer');
    const n = parseNumber(a ?? '');
    if (a == null) err(q.line, 'It has no answer: (answer: 0.139).');
    else if (Number.isNaN(n)) err(all('answer')[0].line, `answer: “${a}” isn’t a number.`);
    const d = one('decimals'), t = one('tolerance');
    if (d != null && !/^(10|\d)$/.test(d)) err(all('decimals')[0].line, 'decimals: is a whole number, 0–10.');
    if (t != null && !(parseNumber(t) >= 0)) err(all('tolerance')[0].line, 'tolerance: is a number, 0 or more.');
    // The written decimals of the answer are kept, so "0.880" means three.
    v.answer = n;
    v.decimals = d != null && /^(10|\d)$/.test(d) ? Number(d) : a != null && !/e/i.test(a) ? writtenDecimals(a.trim()) : null;
    v.tolerance = t != null && parseNumber(t) >= 0 ? parseNumber(t) : null;
    // 1.2e-4: half a unit of its last written digit.
    if (a != null && /e/i.test(a) && v.decimals == null && v.tolerance == null && !Number.isNaN(n)) {
      const [mant, exp] = a.trim().toLowerCase().split('e');
      v.tolerance = 0.5 * 10 ** (Number(exp) - writtenDecimals(mant));
    }
    v.units = one('units') ?? '';
  }
  if (q.kind === 'recall') {
    const a = one('answer');
    if (!a) err(q.line, 'It has no answer: (answer: the line, or a ``` block under answer:).');
    v.answer = unfence(a ?? '');
    v.accept = all('accept').map(x => unfence(trimBlock(x.lines))).filter(x => x.trim());
    v.ignoreCase = /^ignore$/i.test(one('case') ?? '');
  }
  q.value = v;
}

const block = (key, text) => (text.includes('\n') || /^\s*(```|~~~)/.test(text) ? `${key}:\n${text}` : `${key}: ${text}`);
const fenced = text => (text.includes('\n') ? '```\n' + text + '\n```' : text);

/** Write a set as Markdown (the format parseQuestions reads; images as "image: attached"). */
export function toMarkdown(set, { target = set?.target ?? '' } = {}) {
  if (!set) return '';
  const out = [`# Set: ${set.title}`];
  if (target) out.push(`target: ${target}`);
  if (set.context.trim()) out.push(block('context', set.context));
  const question = (q, level) => {
    const lines = ['', `${level} Q ${q.id} [${q.kind}]`, q.text];
    if (q.kind === 'choice') {
      for (const o of q.options) { lines.push(`- [${o.correct ? 'x' : ' '}] ${o.text}`); if (o.feedback.trim()) lines.push(...o.feedback.split('\n').map(l => `  > ${l}`)); }
      if (q.shuffle !== 'default') lines.push(`shuffle: ${q.shuffle === 'on' ? 'yes' : 'no'}`);
    }
    if (q.kind === 'blank') {
      const many = q.blanks.length > 1;
      q.blanks.forEach((b, j) => b.forEach((a, k) => lines.push(`${k ? 'accept' : 'answer'}${many ? ` ${j + 1}` : ''}: ${a}`)));
      if (q.ignoreCase) lines.push('case: ignore');
    }
    if (q.kind === 'number') {
      lines.push(`answer: ${q.answer == null ? '' : q.decimals != null ? q.answer.toFixed(q.decimals) : q.answer}`);
      if (q.tolerance != null) lines.push(`tolerance: ${q.tolerance}`);
      if (q.units) lines.push(`units: ${q.units}`);
    }
    if (q.kind === 'recall') {
      lines.push(block('answer', fenced(q.answer)));
      for (const a of q.accept) lines.push(block('accept', fenced(a)));
      if (q.ignoreCase) lines.push('case: ignore');
    }
    for (const h of q.hints) lines.push(block('hint', h));
    if (q.explain.trim()) lines.push(block('explain', q.explain));
    if (q.image) lines.push('image: attached');
    return lines;
  };
  for (const it of set.items) {
    if (it.type === 'chain') {
      out.push('', `## Chain: ${it.title}`);
      if (it.context.trim()) out.push(block('context', it.context));
      for (const q of it.items) out.push(...question(q, '###'));
    } else out.push(...question(it, '##'));
  }
  return out.join('\n') + '\n';
}

/** The images of a set by question id (kept when its Markdown is edited). */
export const imagesOf = set => Object.fromEntries(questionsOf(set).filter(q => q.image).map(q => [q.id, q.image]));
