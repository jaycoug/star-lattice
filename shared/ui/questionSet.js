// A star-dot's question set as the player answers it, in its screen's assessor
// and in PLAY's popout (quiz mode). One question shows at a time; with more than one, a list of them
// (chains grouped, each marked answered, waiting or after) and the progress sit above, with Next.
// A set of one choice question looks like round 9's question card.
//
// questionSetView({ set, dotId, states, progress, closed, until, ui, setUi, answer, now, live })
// states Map(qid → { kind, until }) (questions.js itemStates)
// progress { right, total }
// closed null, or why nothing can be answered now (the star-dot's state: locked, inside…)
// ui { cur, last } kept by the host: the question shown, and the last answer's result
// ({ qid, correct, feedback, picked, at, typed, blanks, complete, problem })
// answer (qid, response) => { correct, problem, result, complete } | null; the host saves it
// live false in a preview: "The star-dot ignites" isn't said
// seed the attempt's shuffle seed (questions.js attemptSeed); shuffle: GOVERN's
// default { choices } (qset.js shuffleDefaults). A set's questions come in the order written.
// Typed answers are kept here between redraws (by star-dot and question), so a redraw keeps them.

import { h } from '../dom.js';
import * as E from '../engine/index.js';
import { richText, inlineText } from './richText.js';
import { countdown } from './question.js';

const typed = new Map();      // `${dotId}#${qid}` → text, [text per blank] or [option index]
const stepsDone = new Set();  // `${dotId}#${qid}`
const key = (dotId, qid) => `${dotId}#${qid}`;
const KIND_ICON = { choice: '◉', blank: '▭', number: '#', recall: '⌨', step: '›' };
const KIND_NAME = { choice: 'Choice', blank: 'Fill in', number: 'Number', recall: 'Type it', step: 'Step' };

/** Forget a star-dot's typed answers (after its set is edited or completes). */
export const forgetTyped = dotId => { for (const k of [...typed.keys()]) if (k.startsWith(dotId + '#')) typed.delete(k); };

export function questionSetView({ set, dotId, states, progress, closed = null, until = null, ui = {}, setUi = () => {}, answer = () => null, now = Date.now(), live = true, seed = '', shuffle = {}, showProgress = true }) {
  const items = set.items;
  const qs = E.questionsOf({ items });
  if (!qs.length) return h('p', { class: 'sds-muted' }, 'It has no questions.');
  const single = qs.length === 1;
  const stateOf = q => states.get(q.id) ?? { kind: 'open' };
  const firstOpen = qs.find(q => E.GRADED.includes(q.kind) && stateOf(q).kind === 'open') ?? qs.find(q => stateOf(q).kind !== 'answered') ?? qs[0];
  const cur = qs.find(q => q.id === ui.cur) ?? firstOpen;
  const last = ui.last?.qid === cur.id ? ui.last : null;
  const chain = E.chainOf(set, cur.id);
  const go = qid => setUi({ cur: qid, last: null });
  const order = qs.map(q => q.id);
  const after = order.slice(order.indexOf(cur.id) + 1).concat(order.slice(0, order.indexOf(cur.id)));
  const nextId = after.find(id => { const q = qs.find(x => x.id === id); const s = stateOf(q).kind; return q.kind === 'step' ? !stepsDone.has(key(dotId, id)) && s !== 'after' : s !== 'answered'; });

  const chip = (q, n) => {
    const s = stateOf(q).kind;
    const done = q.kind === 'step' ? stepsDone.has(key(dotId, q.id)) : s === 'answered';
    return h('li', {},
      h('button', {
        type: 'button', class: `qs-chip ${q.kind} ${done ? 'answered' : s}${q.id === cur.id ? ' current' : ''}`, dataset: { q: q.id },
        title: `${KIND_NAME[q.kind]}${done ? ' · answered' : s === 'waiting' ? ' · waiting' : s === 'after' ? ' · after the one before it' : ''}`,
        'aria-current': q.id === cur.id ? 'true' : null, onclick: () => go(q.id),
      }, h('span', { class: 'qs-chip-icon' }, done ? '✓' : s === 'waiting' ? '⏳' : KIND_ICON[q.kind]), ` ${n}`));
  };
  let n = 0;
  const list = !single && h('ol', { class: 'qs-list' }, items.map(it => (it.type === 'chain'
    ? h('li', { class: 'qs-chain' }, h('span', { class: 'qs-chain-title', title: 'A chain: answered in order' }, '⛓ ', it.title || 'Chain'), h('ol', { class: 'qs-chain-items' }, it.items.map(q => chip(q, ++n))))
    : chip(it, ++n))));

  return h('div', { class: 'qs' + (single ? ' single' : ''), dataset: { dot: dotId } },
    !single && h('div', { class: 'qs-head' },
      showProgress && h('span', { class: 'qs-progress', title: 'Answered right / graded questions' }, `${progress.right} of ${progress.total} right`),
      showProgress && h('span', { class: 'qs-bar', 'aria-hidden': 'true' }, h('span', { class: 'qs-bar-fill', style: { width: `${progress.total ? (100 * progress.right) / progress.total : 0}%` } })),
      set.title && h('span', { class: 'qs-title sds-muted sds-small' }, set.title)),
    list,
    set.context.trim() && contextBox(set.context, 'Context'),
    chain?.context.trim() && contextBox(chain.context, chain.title || 'Chain'),
    card({ q: cur, dotId, s: stateOf(cur), last, closed, until, answer, setUi, now, live, single, nextId, go, progress, seed, shuffleChoices: shuffle.choices, hint: ui.hint?.q === cur.id ? ui.hint.choice : null }));
}

function contextBox(md, label) {
  return h('details', { class: 'qs-context', open: true }, h('summary', {}, label), richText(md, { copy: true }));
}

function card({ q, dotId, s, last, closed, until, answer, setUi, now, live, single, nextId, go, seed = '', shuffleChoices = false, hint = null }) {
  const k = key(dotId, q.id);
  const locked = !!closed || s.kind === 'waiting' || s.kind === 'after';
  const answered = s.kind === 'answered' && !last;
  const final = !!last && !last.problem;
  const submit = response => {
    const r = answer(q.id, response);
    if (!r) return;
    // The question just answered stays shown (with its result) until Next › or another is picked.
    if (r.problem) return void setUi({ cur: q.id, last: { qid: q.id, problem: r.problem } });
    setUi({ cur: q.id, last: { qid: q.id, correct: r.correct, feedback: r.result?.feedback ?? '', picked: q.kind === 'choice' ? response : null, at: r.result?.at ?? null, typed: r.result?.typed ?? null, blanks: r.result?.blanks ?? null, complete: !!r.complete } });
    if (r.correct || r.complete) typed.delete(k);
  };
  const disabled = locked || answered || final;
  let body, controls = null;
  if (q.kind === 'choice') {
    const multi = q.options.filter(o => o.correct).length > 1;
    const order = E.choiceOrder(q, `${seed}|${q.id}`, shuffleChoices);
    const picked = new Set(final ? last.picked : typed.get(k) ?? []);
    const cls = i => 'qz-choice' + (i === hint && !answered && !final ? ' crossed' : '') + (final && picked.has(i) ? (last.correct ? ' picked correct' : ' picked wrong') : '') + (answered && q.options[i].correct ? ' correct' : '') + (multi && !final && picked.has(i) ? ' checked' : '');
    body = h('ol', { class: 'qz-choices' + (multi ? ' multi' : '') }, order.map((i, pos) => h('li', {},
      h('button', {
        type: 'button', class: cls(i), disabled: disabled || (i === hint && !answered && !final), dataset: { choice: String(i) }, title: i === hint && !answered && !final ? 'Crossed out by a hint: not this one' : null, 'aria-pressed': multi ? String(picked.has(i)) : null,
        onclick: () => {
          if (disabled) return;
          if (!multi) return submit([i]);
          const now2 = new Set(typed.get(k) ?? []);
          now2.has(i) ? now2.delete(i) : now2.add(i);
          typed.set(k, [...now2]);
          setUi({});
        },
      }, h('span', { class: 'qz-letter' }, E.CHOICE_LETTERS[pos]), h('span', { class: 'qz-choice-text' }, ...inlineText(q.options[i].text))))));
    if (multi) controls = [h('p', { class: 'sds-muted sds-small' }, 'Choose all that apply.'), !disabled && button('Check', () => submit(typed.get(k) ?? []), { class: 'sds-btn qs-check', disabled: !(typed.get(k) ?? []).length })];
  } else if (q.kind === 'blank') {
    const vals = typed.get(k) ?? [];
    const inputs = [];
    const blank = i => {
      const el = h('input', {
        type: 'text', class: 'qs-blank' + (final && last.blanks ? (last.blanks[i] ? ' right' : ' wrong') : ''), 'aria-label': `Blank ${i + 1}`, disabled, spellcheck: 'false', autocomplete: 'off',
        oninput: e => { const v = [...(typed.get(k) ?? [])]; v[i] = e.target.value; typed.set(k, v); },
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault?.(); submit(inputs.map(x => x.value)); } },
      });
      el.value = vals[i] ?? '';
      inputs.push(el);
      return el;
    };
    body = richText(q.text, { blank });
    controls = !disabled && button('Check', () => submit(inputs.map(x => x.value)), { class: 'sds-btn qs-check' });
  } else if (q.kind === 'number' || q.kind === 'recall') {
    const isNum = q.kind === 'number';
    const el = h(isNum ? 'input' : 'textarea', {
      class: isNum ? 'qs-number' : 'qs-recall', type: isNum ? 'text' : null, inputmode: isNum ? 'decimal' : null, 'aria-label': isNum ? 'Your number' : 'Your answer', disabled, spellcheck: 'false', autocomplete: 'off',
      rows: isNum ? null : Math.min(8, Math.max(2, q.answer.split('\n').length + 1)),
      oninput: e => typed.set(k, e.target.value),
      onkeydown: e => { if (e.key === 'Enter' && (isNum || e.ctrlKey || e.metaKey)) { e.preventDefault?.(); submit(el.value); } },
    });
    el.value = typed.get(k) ?? '';
    body = h('div', { class: 'qs-answer-row' }, el, isNum && q.units && h('span', { class: 'qs-units' }, q.units));
    controls = !disabled && [button('Check', () => submit(el.value), { class: 'sds-btn qs-check' }), !isNum && h('span', { class: 'sds-muted sds-small' }, ' Spacing and quote style don’t matter. Ctrl+Enter checks.')];
  } else {
    const done = stepsDone.has(k);
    controls = !locked && button(done ? 'Done ✓' : 'Done', () => { stepsDone.add(k); nextId ? go(nextId) : setUi({}); }, { class: 'sds-btn qs-done', 'aria-pressed': String(done) });
  }
  const hintsShown = Math.min(q.hints.length, Number(typed.get(k + '#hints') ?? 0));
  const hints = q.hints.length > 0 && !answered && [
    hintsShown > 0 && h('ul', { class: 'qs-hints' }, q.hints.slice(0, hintsShown).map(x => h('li', {}, richText(x)))),
    hintsShown < q.hints.length && !final && button(hintsShown ? `Another hint (${hintsShown + 1} of ${q.hints.length})` : `Show a hint${q.hints.length > 1 ? ` (1 of ${q.hints.length})` : ''}`, () => { typed.set(k + '#hints', hintsShown + 1); setUi({}); }, { class: 'sds-btn qs-hint' })];
  const explain = q.explain.trim() && h('div', { class: 'qz-explanation' }, richText(q.explain));
  const result = last?.problem ? h('div', { class: 'qz-result closed', role: 'status' }, last.problem)
    : final ? h('div', { class: 'qz-result ' + (last.correct ? 'right' : 'wrong'), role: 'status' },
      h('strong', {}, last.correct ? 'Correct.' : 'Not quite.'),
      last.correct ? (last.complete ? (live ? ' The star-dot ignites.' : ' That completes the set.') : '') : last.feedback ? '' : q.kind === 'recall' && last.typed ? ` It differs from the answer at “${last.typed[last.at] ?? '(the end)'}”.` : ' That isn’t the answer.',
      !last.correct && last.feedback && h('div', { class: 'qs-feedback' }, richText(last.feedback)),
      explain,   // After a wrong answer too (the right choice is never shown)
      !last.correct && q.kind === 'recall' && s.kind === 'open' && live && button('Count it as right', () => submit({ self: true }), { class: 'sds-btn qs-self', title: 'Your answer means the same: mark it right yourself' }),
      !last.correct && s.kind === 'open' && button('Try again', () => setUi({ last: null }), { class: 'sds-btn qs-retry' }),
      !last.correct && s.kind === 'waiting' && [' ', 'It opens again in ', countdown(s.until, now), '.'])
      : answered ? h('div', { class: 'qz-result right', role: 'status' }, h('strong', {}, 'Answered correctly.'), explain)
        : closed ? h('div', { class: 'qz-result closed', role: 'status' }, closed, until != null && [' ', countdown(until, now)])
          : s.kind === 'waiting' ? h('div', { class: 'qz-result closed', role: 'status' }, 'Not yet: after a wrong answer it opens again in ', countdown(s.until, now), '.')
            : s.kind === 'after' ? h('div', { class: 'qz-result closed', role: 'status' }, 'Answer the questions before it in this chain first.')
              : null;
  return h('div', { class: 'qz-card' + (q.image ? ' has-image' : ''), dataset: { q: q.id, kind: q.kind } },
    h('div', { class: 'qz-text' },
      !single && h('div', { class: 'qs-kind sds-muted sds-small' }, KIND_NAME[q.kind]),
      h('div', { class: 'qz-question' }, q.kind === 'blank' ? body : richText(q.text, { copy: q.kind === 'step' })),
      q.kind !== 'blank' && body,
      hints,
      controls && h('div', { class: 'sds-buttons qs-controls' }, controls),
      result,
      !single && nextId && (final || answered || q.kind === 'step' || s.kind !== 'open') && button('Next ›', () => go(nextId), { class: 'sds-btn qs-next' })),
    q.image && h('img', { class: 'qz-image', src: q.image, alt: '' }));
}

const button = (label, onclick, props = {}) => h('button', { type: 'button', onclick, ...props }, label);
