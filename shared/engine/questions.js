// Round 9, stage 3, questions. A □ star-dot's `assessment` is a
// question set (qset.js): one question or many, of several kinds, answered in its screen's assessor
// (and, with "Every star-dot is a question: On", on PLAY's popout, every star-dot being □). The set
// is complete when every graded question is answered right; then the star-dot ignites.
//
// dot.assessment: Set (qset.js) | null
// dot.answered: { questionId: ms } the questions answered right so far (absent when none). It
// clears when the set completes, so a Retrain period or a new session asks it all again.
// state.waits: { "dotId#questionId": until (ms) }: after a wrong answer under Wrong answer: Wait N
// minutes, that question (and, in a chain, the rest of the chain) waits; the others stay open.
//
// A star-dot with children (Hierarchical) takes its status from them and isn't answered itself.

import { withDefaults, index } from './model.js';
import { listOf } from './independent.js';
import { derive } from './derive.js';
import { ignite } from './actions.js';
import { setValue, askable as setAskable, gradedOf, questionsOf, grade, GRADED } from './qset.js';

export * from './qset.js';
export const IMAGE_MAX = 800;
export const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MINUTE = 60 * 1000;

/** A clean assessment (a question set), or null. An older single multiple-choice one becomes a set of one. */
export const assessmentValue = setValue;
/** Whether a star-dot's set can be asked: a graded question, and every question written. */
export const askable = setAskable;
/** A new set with one empty choice question (four blank options, A right). */
export const blankAssessment = () => setValue({ items: [{ id: 'q1', kind: 'choice', options: [{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }] }] });

/** Set (or, with null, clear) a star-dot's assessment; progress on questions it no longer has goes. */
export function setAssessment(st, dotId, a) {
  if (!st.dots[dotId]) return st;
  const set = setValue(a);
  const ids = new Set(questionsOf(set).map(q => q.id));
  const { answered: was, ...dot } = st.dots[dotId];
  const kept = Object.fromEntries(Object.entries(was ?? {}).filter(([q]) => ids.has(q)));
  const waits = Object.fromEntries(Object.entries(st.waits ?? {}).filter(([k]) => { const [d, q] = splitKey(k); return d !== dotId || ids.has(q); }));
  return { ...st, waits, dots: { ...st.dots, [dotId]: { ...dot, assessment: set, ...(Object.keys(kept).length ? { answered: kept } : {}) } } };
}

/** The size an image is shrunk to: its long side at most `max`, never enlarged. [width, height]. */
export function fitSize(width, height, max = IMAGE_MAX) {
  const k = Math.min(1, max / Math.max(width, height, 1));
  return [Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k))];
}

// ---- Waits (per question) --------------------------------------------------------------------

export const waitKey = (dotId, qid) => `${dotId}#${qid}`;
export const splitKey = k => { const i = k.indexOf('#'); return i < 0 ? [k, null] : [k.slice(0, i), k.slice(i + 1)]; };
const waitsOn = opts => opts?.wrong?.mode === 'wait';

/** Milliseconds a question still waits after a wrong answer; without `qid`, the star-dot's soonest wait (0 when none). */
export function waitLeft(st, dotId, now, qid = null) {
  if (qid != null) return Math.max(0, (st.waits?.[waitKey(dotId, qid)] ?? 0) - now);
  const left = Object.entries(st.waits ?? {}).filter(([k]) => splitKey(k)[0] === dotId).map(([, t]) => t - now).filter(t => t > 0);
  return left.length ? Math.min(...left) : 0;
}

/** Every wait still running at `now`: [{ dot, q, until }], soonest first. */
export const waitsAt = (st, now, opts = { wrong: { mode: 'wait' } }) => !waitsOn(opts) ? [] : Object.entries(st.waits ?? {})
  .map(([k, until]) => { const [dot, q] = splitKey(k); return { dot, q, until }; })
  .filter(w => st.dots[w.dot] && w.until > now).sort((a, b) => a.until - b.until);

// ---- Where things stand ----------------------------------------------------------------------

/**
 * Each question of a star-dot's set: Map(qid → { kind, until }):
 * 'answered' answered right (this round of the set; all of them once the star-dot is ignited)
 * 'waiting' after a wrong answer, until `until`
 * 'after' in a chain, after one not yet answered right
 * 'open' it can be answered (a step: it can be read)
 * `lit`: whether the star-dot counts as complete (its effective status is ignited).
 */
export function itemStates(st, dotId, now, options, lit = false) {
  const dot = st.dots[dotId];
  const set = dot?.assessment;
  const out = new Map();
  if (!set) return out;
  const done = q => lit || !!dot.answered?.[q.id];
  const wait = q => (waitsOn(options) ? waitLeft(st, dotId, now, q.id) : 0);
  for (const it of set.items) {
    const run = it.type === 'chain' ? it.items : [it];
    let blocked = false;
    for (const q of run) {
      if (!GRADED.includes(q.kind)) { out.set(q.id, { kind: blocked ? 'after' : 'open' }); continue; }
      if (done(q)) { out.set(q.id, { kind: 'answered' }); continue; }
      if (blocked) { out.set(q.id, { kind: 'after' }); continue; }
      const left = wait(q);
      out.set(q.id, left > 0 ? { kind: 'waiting', until: now + left } : { kind: 'open' });
      if (it.type === 'chain') blocked = true;
    }
  }
  return out;
}

/** How many of a set's graded questions are answered right: { right, total }. */
export function setProgress(st, view, dotId) {
  const dot = st.dots[dotId];
  const total = gradedOf(dot?.assessment).length;
  if (!total) return { right: 0, total: 0 };
  if (view.effective(dotId).status === 'ignited') return { right: total, total };
  return { right: gradedOf(dot.assessment).filter(q => dot.answered?.[q.id]).length, total };
}

/**
 * Where a star-dot's question set stands: { kind, until }:
 * 'none' no set yet (or one not fully written)
 * 'children' it has children, which decide it
 * 'answered' complete (ignited)
 * 'complete' its category is complete this session (Y13: a closed branch)
 * 'off' not on the map (shelved, retired)
 * 'locked' its kite is locked
 * 'inside' a Zenith waiting for the star-dots inside it
 * 'waiting' every question left waits after a wrong answer, the first until `until`
 * 'open' something can be answered
 * `view` is the derived view; `now` the exact time (waits count in seconds). Under Retry now a
 * wait left from before doesn't hold.
 */
export function questionState(st, view, dotId, now) {
  const dot = st.dots[dotId];
  if (!dot || !askable(dot.assessment)) return { kind: 'none' };
  if (view.children(dotId).length) return { kind: 'children' };
  if (view.effective(dotId).status === 'ignited') return { kind: 'answered' };
  if (st.complete?.[view.categoryOf(dotId)] != null) return { kind: 'complete' };   // A closed branch
  const at = index(view.state ?? st).dot.get(dotId);   // Where the view places it
  if (!at) return { kind: 'off' };
  if (!view.kiteOpen(at.kite)) return { kind: 'locked' };
  if (view.insideFirst(dotId)) return { kind: 'inside' };
  const graded = new Set(gradedOf(dot.assessment).map(q => q.id));
  const items = [...itemStates(st, dotId, now, view.opts)].filter(([q]) => graded.has(q)).map(([, s]) => s);
  if (!items.some(s => s.kind === 'open')) {
    const waits = items.filter(s => s.kind === 'waiting').map(s => s.until);
    if (waits.length) return { kind: 'waiting', until: Math.min(...waits) };
  }
  return { kind: 'open' };
}

const CLOSED = {
  none: 'It has no question yet.',
  children: 'Its star’s star-dots decide it.',
  answered: 'It’s already answered.',
  complete: 'Its category is complete for this session.',
  off: 'It isn’t on the map.',
  locked: 'Its kite is locked.',
  inside: 'Answer the star-dots inside it first.',
  waiting: 'It’s waiting after a wrong answer.',
};
const ITEM_CLOSED = {
  answered: 'That question is already answered.',
  waiting: 'It’s waiting after a wrong answer.',
  after: 'Answer the questions before it in its chain first.',
};

/**
 * Answer one question of a star-dot's set, at options.now (exact ms): { state, correct, problem,
 * result, complete }. `response` by kind (qset.js grade): choice [option index]; blank [typed per
 * blank]; number typed; recall typed, or { self: true } (Count it as right: the self-grade).
 * Right: it's recorded (and its wait goes); the last one ignites the star-dot. Wrong: under Wrong
 * answer: Wait N minutes the question waits N minutes; under Retry now nothing is recorded.
 */
export function answerItem(st, dotId, qid, response, options) {
  const opts = withDefaults(options);
  const view = derive(st, opts);
  const q0 = questionState(st, view, dotId, opts.now);
  if (q0.kind !== 'open' && q0.kind !== 'waiting') return { state: st, correct: false, problem: CLOSED[q0.kind] };
  const dot = st.dots[dotId];
  const q = questionsOf(dot.assessment).find(x => x.id === qid);
  if (!q || !GRADED.includes(q.kind)) return { state: st, correct: false, problem: 'That isn’t one of its questions.' };
  const s = itemStates(st, dotId, opts.now, opts).get(qid);
  if (s.kind !== 'open') return { state: st, correct: false, problem: ITEM_CLOSED[s.kind] };
  const picks = Array.isArray(response) ? response : [response];
  if (q.kind === 'choice' && (!picks.length || picks.some(i => !Number.isInteger(i) || i < 0 || i >= q.options.length))) {
    return { state: st, correct: false, problem: 'Choose one of its answers.' };
  }
  const self = q.kind === 'recall' && response?.self === true;
  const result = self ? { correct: true, feedback: '' } : grade(q, response);
  if (result.invalid) return { state: st, correct: false, problem: result.feedback, result };
  const key = waitKey(dotId, qid);
  const { [key]: _, ...others } = st.waits ?? {};
  if (result.correct) {
    const answered = { ...dot.answered, [qid]: opts.now };
    const complete = gradedOf(dot.assessment).every(x => answered[x.id]);
    let next;
    if (complete) {
      const { answered: __, ...rest } = dot;
      next = ignite({ ...st, dots: { ...st.dots, [dotId]: rest } }, dotId, opts.now);
    } else next = { ...st, dots: { ...st.dots, [dotId]: { ...dot, answered, trained: true } } };
    const left = Object.fromEntries(Object.entries(others).filter(([k]) => !complete || splitKey(k)[0] !== dotId));
    return { state: { ...next, waits: left }, correct: true, problem: null, result, complete };
  }
  if (opts.wrong?.mode !== 'wait') return { state: st, correct: false, problem: null, result };
  return { state: { ...st, waits: { ...others, [key]: opts.now + (opts.wrong.minutes ?? 5) * MINUTE } }, correct: false, problem: null, result };
}

/**
 * Round 9's call, kept: answer a star-dot's first open choice question with choice `choice` (an
 * index). { state, correct, problem }.
 */
export function answerQuestion(st, dotId, choice, options) {
  const opts = withDefaults(options);
  const dot = st.dots[dotId];
  const graded = gradedOf(dot?.assessment);
  const states = itemStates(st, dotId, opts.now, opts);
  const q = graded.find(x => states.get(x.id)?.kind === 'open') ?? graded.find(x => states.get(x.id)?.kind === 'waiting') ?? graded[0];
  const r = answerItem(st, dotId, q?.id ?? '', [choice], opts);
  return r;
}

/**
 * Y15: each category's progress among the star-dots on the map: [{ correct, total }] by category
 * (a star-dot's category is its kite's). Only star-dots answered as questions count: terminal ones.
 * Under Independent: every item of the category's list.
 */
export function categoryProgress(st, view, categories) {
  const out = Array.from({ length: categories }, () => ({ correct: 0, total: 0 }));
  const vs = view.state ?? st;
  if (vs.projected) {
    // Under Independent, a category is its whole list, on the map or not yet.
    for (const k of Object.values(vs.stars).find(s => !s.sources.length && !s.shelved).kites) {
      const c = vs.kites[k].color;
      if (c == null || !out[c]) continue;
      for (const d of listOf(vs, k)) { out[c].total++; if (view.effective(d).status === 'ignited') out[c].correct++; }
    }
    return out;
  }
  for (const d of index(vs).dot.keys()) {
    const c = view.categoryOf(d);
    if (c == null || !out[c] || view.children(d).length) continue;
    out[c].total++;
    if (view.effective(d).status === 'ignited') out[c].correct++;
  }
  return out;
}
