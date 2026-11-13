// The question form, the assessor's editor: a card per question (its kind, its
// text, and what that kind needs: choices, blanks' answers, the number, the typed answer), with an
// explanation, a hint and an image for each; per question ↑ ↓, Duplicate and Delete; per set
// + Add a question and the shared context. Chains show as a group of their
// cards (made in Markdown). What a card still needs is said on it.
//
// The draft lives here (by star-dot), not in the screen's state: typing changes it without a redraw
// (so focus stays where it is), and only changes to its shape (a card or a choice added, moved or
// removed, a kind or a switch changed) ask the host to redraw (`refresh`).
//
// formDraft(target, start) the draft (started from `start`, a clean set, the first time)
// setDraft(target, set) replace it (back from Markdown, or pasted questions)
// dropDraft(target) forget it (saved or cancelled)
// draftSet(target) the draft as a clean set (qset.js setValue)
// questionForm({ target, refresh, pickImage, defaults }) its cards and set controls

import { h } from '../dom.js';
import * as E from '../engine/index.js';

const drafts = new Map();
const clone = s => JSON.parse(JSON.stringify(s));
let focusNext = null;   // a data-qf key to focus after the next draw

export const formDraft = (target, start) => { if (!drafts.has(target)) drafts.set(target, clone(start)); return drafts.get(target); };
export const setDraft = (target, set) => drafts.set(target, clone(set));
export const dropDraft = target => drafts.delete(target);
export const draftSet = target => E.setValue(drafts.get(target));

const KIND_LABEL = { choice: 'Multiple choice', blank: 'Fill in the blank', number: 'Number', recall: 'Typed answer', step: 'Step (not graded)' };

/** A new question of a kind, keeping what a question of another kind had in common. */
export function blankQuestion(id, kind = 'choice', from = null) {
  const base = { type: 'q', id, kind, text: from?.text ?? '', image: from?.image ?? null, hints: from?.hints ?? [], explain: from?.explain ?? '' };
  if (kind === 'choice') return { ...base, options: from?.options ?? [0, 1, 2, 3].map(() => ({ text: '', correct: false, feedback: '' })), shuffle: from?.shuffle ?? 'default' };
  if (kind === 'blank') return { ...base, blanks: Array.from({ length: Math.max(1, E.blankCount(base.text)) }, () => []), ignoreCase: false };
  if (kind === 'number') return { ...base, answer: null, decimals: null, tolerance: null, units: '' };
  if (kind === 'recall') return { ...base, answer: '', accept: [], ignoreCase: false };
  return base;
}

/** An id no question of the set has: q1, q2, … */
export function freshId(set) {
  const used = new Set(E.questionsOf(set).map(q => q.id));
  let n = used.size + 1;
  while (used.has(`q${n}`)) n++;
  return `q${n}`;
}

/** The list a question sits in (the set's items, or its chain's), and its index there. */
function placeOf(set, qid) {
  const i = set.items.findIndex(it => it.id === qid && it.type !== 'chain');
  if (i >= 0) return { list: set.items, i };
  for (const it of set.items) if (it.type === 'chain') { const j = it.items.findIndex(q => q.id === qid); if (j >= 0) return { list: it.items, i: j, chain: it }; }
  return null;
}

const val = (tag, props, value) => { const el = h(tag, props); el.value = value ?? ''; return el; };
const lines = v => v.split('\n').map(s => s.trim()).filter(Boolean);
const num = v => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const btn = (label, onclick, props = {}) => h('button', { type: 'button', class: 'sds-btn', onclick, ...props }, label);
const focusLater = el => { if (el.dataset.qf === focusNext) { focusNext = null; setTimeout(() => el.focus?.(), 0); } return el; };

export function questionForm({ target, refresh, pickImage, defaults = { choices: false, questions: false } }) {
  const set = drafts.get(target);
  choiceDefault = defaults.choices;
  const shape = (f, focus = null) => { f(); focusNext = focus; refresh(); };
  let n = 0;
  const card = q => {
    const at = placeOf(set, q.id);
    const num1 = ++n;
    const problems = h('ul', { class: 'qf-problems sds-small', role: 'status' });
    const showProblems = () => {
      const p = E.questionProblems(E.setValue({ items: [q] }).items[0]);
      problems.replaceChildren(...p.map(x => h('li', {}, x)));
      cardEl.setAttribute('class', `qf-card ${q.kind}${p.length ? '' : ' ready'}`);
    };
    const text = focusLater(val('textarea', {
      class: 'sds-input qf-text', rows: Math.max(2, Math.min(12, q.text.split('\n').length + 1)), dataset: { qf: `${q.id}:text` },
      placeholder: q.kind === 'step' ? 'What to do (code in ``` lines gets a Copy button)' : q.kind === 'blank' ? 'The text, with ____ where each answer goes' : 'The question',
      'aria-label': 'Its text',
      oninput: e => { q.text = e.target.value; showProblems(); },
      onchange: e => { if (q.kind === 'blank' && E.blankCount(e.target.value) !== q.blanks.length) shape(() => { q.blanks = Array.from({ length: Math.max(1, E.blankCount(q.text)) }, (_, j) => q.blanks[j] ?? []); }); },
    }, q.text));
    const kind = h('select', {
      class: 'sds-input qf-kind', 'aria-label': 'Its kind',
      onchange: e => shape(() => { at.list[at.i] = blankQuestion(q.id, e.target.value, q); }),
    }, E.KINDS.map(k => h('option', { value: k, selected: k === q.kind }, KIND_LABEL[k])));
    const tools = h('span', { class: 'qf-tools' },
      btn('↑', () => shape(() => { [at.list[at.i - 1], at.list[at.i]] = [at.list[at.i], at.list[at.i - 1]]; }), { title: 'Move it up', 'aria-label': 'Move it up', disabled: at.i === 0 }),
      btn('↓', () => shape(() => { [at.list[at.i + 1], at.list[at.i]] = [at.list[at.i], at.list[at.i + 1]]; }), { title: 'Move it down', 'aria-label': 'Move it down', disabled: at.i === at.list.length - 1 }),
      btn('Duplicate', () => { const id = freshId(set); shape(() => at.list.splice(at.i + 1, 0, { ...clone(q), id }), `${id}:text`); }),
      btn('Delete', () => shape(() => {
        at.list.splice(at.i, 1);
        if (at.chain && !at.chain.items.length) set.items.splice(set.items.indexOf(at.chain), 1);
      }), { class: 'sds-btn qf-delete' }));
    const cardEl = h('li', { class: `qf-card ${q.kind}`, dataset: { q: q.id } },
      h('div', { class: 'qf-head' }, h('span', { class: 'qf-n' }, `${num1}.`), kind, tools),
      text,
      kindFields(q, shape, showProblems),
      common(q, shape, pickImage),
      problems);
    showProblems();
    return cardEl;
  };
  const items = set.items.map(it => (it.type === 'chain'
    ? h('li', { class: 'qf-chain' },
      h('div', { class: 'qf-chain-title' }, '⛓ ', it.title || 'Chain', h('span', { class: 'sds-muted sds-small' }, ' · answered in order (chains are made in Markdown)')),
      h('ol', { class: 'qf-cards' }, it.items.map(card)))
    : card(it)));
  const graded = E.gradedOf(E.setValue(set)).length;
  return h('div', { class: 'qf' },
    h('div', { class: 'qf-set' },
      h('details', { class: 'qf-context', open: !!set.context?.trim() },
        h('summary', {}, 'Shared context (shown above every question)'),
        val('textarea', { class: 'sds-input qf-set-context', rows: 4, placeholder: 'Setup code, a data table, a scenario…', 'aria-label': 'Shared context', oninput: e => { set.context = e.target.value; } }, set.context))),
    h('ol', { class: 'qf-cards' }, items),
    !graded && h('p', { class: 'qf-problems sds-small' }, set.items.length ? 'Add a question that’s graded (steps aren’t).' : 'No questions yet: + Add a question.'),
    h('div', { class: 'sds-buttons' },
      btn('+ Add a question', () => { const id = freshId(set); shape(() => set.items.push(blankQuestion(id)), `${id}:text`); }, { class: 'sds-btn qf-add' })));
}

/** The switch for shuffling: As GOVERN says (and what that is), Shuffle, Don't shuffle. */
function switchSelect(value, byDefault, onPick, label) {
  return h('select', { class: 'sds-input qf-shuffle', 'aria-label': label, onchange: e => onPick(e.target.value) },
    [['default', `As GOVERN says (${byDefault ? 'shuffle' : 'don’t'})`], ['on', 'Shuffle'], ['off', 'Don’t shuffle']].map(([v, l]) => h('option', { value: v, selected: (value ?? 'default') === v }, l)));
}

function kindFields(q, shape, showProblems) {
  if (q.kind === 'choice') {
    const rows = q.options.map((o, i) => h('li', { class: 'qf-choice' },
      h('span', { class: 'qf-letter' }, E.OPTION_LETTERS[i]),
      focusLater(val('input', { class: 'sds-input qf-choice-text', placeholder: `Choice ${E.OPTION_LETTERS[i]}`, 'aria-label': `Choice ${E.OPTION_LETTERS[i]}`, dataset: { qf: `${q.id}:o${i}` }, oninput: e => { o.text = e.target.value; showProblems(); } }, o.text)),
      h('label', { class: 'qf-correct' }, h('input', { type: 'checkbox', checked: o.correct, onchange: e => { o.correct = e.target.checked; showProblems(); } }), ' Right'),
      val('input', { class: 'sds-input qf-feedback sds-small', placeholder: 'Feedback if picked (optional)', 'aria-label': `Feedback for ${E.OPTION_LETTERS[i]}`, oninput: e => { o.feedback = e.target.value; } }, o.feedback),
      q.options.length > E.MIN_OPTIONS && btn('×', () => shape(() => q.options.splice(i, 1)), { class: 'sds-btn qf-remove-choice', title: 'Remove this choice', 'aria-label': `Remove choice ${E.OPTION_LETTERS[i]}` })));
    return h('div', { class: 'qf-fields' },
      h('ol', { class: 'qf-choices' }, rows),
      h('div', { class: 'qf-row' },
        q.options.length < E.MAX_OPTIONS && btn('+ Add a choice', () => shape(() => q.options.push({ text: '', correct: false, feedback: '' }), `${q.id}:o${q.options.length}`), { class: 'sds-btn qf-add-choice' }),
        h('label', { class: 'qf-switch' }, 'Shuffle choices ', switchSelect(q.shuffle, choiceDefault, v => shape(() => { q.shuffle = v; }), 'Shuffle choices'))),
      h('p', { class: 'sds-muted sds-small' }, 'Tick every right choice: with more than one, the player chooses all of them. “All of the above” and the like keep their place when shuffled.'));
  }
  if (q.kind === 'blank') {
    return h('div', { class: 'qf-fields' },
      h('div', { class: 'qf-row' },
        btn('Insert a blank', () => shape(() => { q.text = q.text.replace(/\s*$/, '') + (q.text.trim() ? ' ____' : '____'); q.blanks = Array.from({ length: E.blankCount(q.text) }, (_, j) => q.blanks[j] ?? []); }, `${q.id}:b${E.blankCount(q.text)}`), { class: 'sds-btn qf-insert-blank', title: 'Adds ____ at the end of the text (or type four underscores where it goes)' }),
        h('label', { class: 'qf-check' }, h('input', { type: 'checkbox', checked: q.ignoreCase, onchange: e => { q.ignoreCase = e.target.checked; } }), ' Ignore case')),
      h('ol', { class: 'qf-blanks' }, q.blanks.map((b, j) => h('li', {},
        h('span', { class: 'sds-small' }, q.blanks.length > 1 ? `Blank ${j + 1}: accepted answers, one per line` : 'Accepted answers, one per line'),
        focusLater(val('textarea', { class: 'sds-input qf-blank-answers', rows: Math.max(1, b.length), dataset: { qf: `${q.id}:b${j}` }, 'aria-label': `Answers for blank ${j + 1}`, oninput: e => { q.blanks[j] = lines(e.target.value); showProblems(); } }, b.join('\n')))))),
      h('p', { class: 'sds-muted sds-small' }, 'Spacing, quote style and a trailing ; don’t matter. /like this/ is a pattern.'));
  }
  if (q.kind === 'number') {
    return h('div', { class: 'qf-fields qf-row' },
      h('label', {}, 'Answer ', val('input', { class: 'sds-input qf-number', inputmode: 'decimal', 'aria-label': 'The answer', oninput: e => { q.answer = num(e.target.value); showProblems(); } }, q.answer ?? '')),
      h('label', {}, 'Decimals ', val('input', { class: 'sds-input qf-decimals', type: 'number', min: 0, max: 10, placeholder: 'as written', 'aria-label': 'Decimals to check', oninput: e => { const d = num(e.target.value); q.decimals = Number.isInteger(d) && d >= 0 && d <= 10 ? d : null; } }, q.decimals ?? '')),
      h('label', {}, '± ', val('input', { class: 'sds-input qf-tolerance', inputmode: 'decimal', placeholder: 'none', 'aria-label': 'Tolerance', oninput: e => { const t = num(e.target.value); q.tolerance = t != null && t >= 0 ? t : null; } }, q.tolerance ?? '')),
      h('label', {}, 'Units ', val('input', { class: 'sds-input qf-units', 'aria-label': 'Units', oninput: e => { q.units = e.target.value; } }, q.units)));
  }
  if (q.kind === 'recall') {
    return h('div', { class: 'qf-fields' },
      h('span', { class: 'sds-small' }, 'The answer'),
      val('textarea', { class: 'sds-input qf-recall', rows: 2, spellcheck: 'false', 'aria-label': 'The answer', oninput: e => { q.answer = e.target.value; showProblems(); } }, q.answer),
      h('span', { class: 'sds-small' }, 'Also accept, one per line'),
      val('textarea', { class: 'sds-input qf-accept', rows: 1, spellcheck: 'false', 'aria-label': 'Also accept', oninput: e => { q.accept = lines(e.target.value); } }, q.accept.join('\n')),
      h('label', { class: 'qf-check' }, h('input', { type: 'checkbox', checked: q.ignoreCase, onchange: e => { q.ignoreCase = e.target.checked; } }), ' Ignore case'));
  }
  return null;
}

let choiceDefault = false;   // GOVERN's Shuffle choices, for the choice cards' switch label (set by questionForm)

function common(q, shape, pickImage) {
  return h('details', { class: 'qf-more', open: !!(q.explain.trim() || q.hints.length || q.image) },
    h('summary', { class: 'sds-small' }, 'Explanation, hint, image'),
    q.kind !== 'step' && val('textarea', { class: 'sds-input qf-explain', rows: 2, placeholder: 'Explanation, shown after an answer (right or wrong)', 'aria-label': 'Explanation', oninput: e => { q.explain = e.target.value; } }, q.explain),
    val('textarea', { class: 'sds-input qf-hint', rows: 1, placeholder: 'A hint, shown on request (one per line)', 'aria-label': 'Hints', oninput: e => { q.hints = lines(e.target.value); } }, q.hints.join('\n')),
    h('div', { class: 'qf-row' },
      q.image && h('img', { class: 'sds-question-image', src: q.image, alt: '' }),
      btn(q.image ? 'Replace the image…' : 'Add an image…', () => pickImage(url => shape(() => { q.image = url; })), { title: `Shrunk to ${E.IMAGE_MAX} px on its long side, kept in the save` }),
      q.image && btn('Remove the image', () => shape(() => { q.image = null; }))));
}

/** add pasted sets' questions (and chains) at the end of the draft, each with an id of its own. Returns how many. */
export function appendQuestions(target, sets) {
  const set = drafts.get(target);
  let n = 0;
  const own = q => { if (E.questionsOf(set).some(x => x.id === q.id)) q.id = freshId(set); n++; return q; };
  for (const s of sets) {
    for (const it of clone(s.items)) {
      if (it.type !== 'chain') { set.items.push(own(it)); continue; }
      const chain = { ...it, items: [] };
      set.items.push(chain);
      for (const q of it.items) chain.items.push(own(q));
    }
  }
  return n;
}
