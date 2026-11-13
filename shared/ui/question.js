// A star-dot's multiple-choice question as the player sees it: the question,
// its image to the right of the text, and its choices; after a choice, right or wrong with the
// explanation. A wrong answer never shows which choice was correct. Used by PLAY's popout and by
// the assessor's preview (shared/ui/starDotScreen.js).
//
// questionCard({ assessment, picked, correct, answered, closed, until, onPick })
// picked null, or the index chosen (final: the choices are then disabled)
// correct whether `picked` was right
// answered already answered correctly (before this popout): its correct choice is shown, with the explanation
// closed null, or why it can't be answered now (its choices are disabled)
// until with `closed`, the time (ms) a wait ends: a countdown (class qz-countdown, data-until)
// onPick (index) => void

import { h } from '../dom.js';
import { CHOICE_LETTERS } from '../engine/index.js';

/** "4:05" or "1:02:05": the time left until `until`. */
export function leftText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const [hh, mm, ss] = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60];
  const two = n => String(n).padStart(2, '0');
  return hh ? `${hh}:${two(mm)}:${two(ss)}` : `${mm}:${two(ss)}`;
}

/** A countdown to `until` (ms), kept current by its host (updateCountdowns). */
export const countdown = (until, now = Date.now()) => h('span', { class: 'qz-countdown', dataset: { until: String(until) } }, leftText(until - now));

/** Set every countdown under `root` to the time left; returns whether any has run out. */
export function updateCountdowns(root, now = Date.now()) {
  let out = false;
  for (const el of root?.querySelectorAll?.('.qz-countdown') ?? []) {
    const left = Number(el.dataset.until) - now;
    if (left <= 0) out = true;
    el.textContent = leftText(left);
  }
  return out;
}

export function questionCard({ assessment: a, picked = null, correct = false, answered = false, closed = null, until = null, onPick = () => {} }) {
  const done = picked != null;
  const choiceClass = i => 'qz-choice' + (done && i === picked ? (correct ? ' picked correct' : ' picked wrong') : '') + (answered && i === a.correct ? ' correct' : '');
  const choices = h('ol', { class: 'qz-choices' }, a.choices.map((c, i) => h('li', {},
    h('button', {
      type: 'button', class: choiceClass(i), disabled: done || answered || !!closed, dataset: { choice: String(i) },
      onclick: () => { if (!done && !answered && !closed) onPick(i); },
    }, h('span', { class: 'qz-letter' }, CHOICE_LETTERS[i]), h('span', { class: 'qz-choice-text' }, c)))));
  const result = done
    ? h('div', { class: 'qz-result ' + (correct ? 'right' : 'wrong'), role: 'status' },
      h('strong', {}, correct ? 'Correct.' : 'Not quite.'),
      correct ? ' The star-dot ignites.' : ' That isn’t the answer.',
      a.explanation.trim() && h('p', { class: 'qz-explanation' }, a.explanation))
    : answered
      ? h('div', { class: 'qz-result right', role: 'status' }, h('strong', {}, 'Answered correctly.'),
        a.explanation.trim() && h('p', { class: 'qz-explanation' }, a.explanation))
      : closed && h('div', { class: 'qz-result closed', role: 'status' }, closed, until != null && [' ', countdown(until)]);
  return h('div', { class: 'qz-card' + (a.image ? ' has-image' : '') },
    h('div', { class: 'qz-text' }, h('p', { class: 'qz-question' }, a.question), choices, result),
    a.image && h('img', { class: 'qz-image', src: a.image, alt: '' }));
}
