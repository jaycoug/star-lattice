// The assessor PIN dialog: asked before editing (PLAY's "Back to editing" while a PIN
// is set) and before a new session or a PIN change. Light protection, not security: the PIN only
// keeps a player on PLAY; anyone with the files can edit them.

import { h } from '../dom.js';

const PURPOSES = { edit: 'Back to editing', session: 'Start a new session', change: 'Change the PIN' };

export function pinDialog(ask, a) {
  const input = h('input', { type: 'password', class: 'pin-input', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Assessor PIN', maxlength: 12 });
  queueMicrotask?.(() => input.focus?.());
  return h('div', { class: 'sds-overlay pin-overlay', onclick: e => { if (e.target === e.currentTarget) a.cancelPin(); } },
    h('form', { class: 'sds-sheet pin-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Assessor PIN',
      onsubmit: e => { e.preventDefault(); a.answerPin(input.value); } },
      h('h2', {}, PURPOSES[ask.purpose] ?? 'Assessor PIN'),
      h('p', { class: 'note' }, 'Enter the assessor PIN.'),
      input,
      ask.error && h('p', { class: 'note pin-error', role: 'alert' }, ask.error),
      h('div', { class: 'buttons' },
        h('button', { type: 'submit', class: 'text-btn' }, 'OK'),
        h('button', { type: 'button', class: 'text-btn', onclick: () => a.cancelPin() }, 'Cancel'))));
}
