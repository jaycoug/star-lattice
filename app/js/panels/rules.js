// GOVERN's panels,
// by subtab (tabs.js GOVERN_TABS):
// Board (this save): sessionPanel (Start a new session…), and
// boardAdvancedPanel (Advanced: the share that ignites a star-dot with children; the assessor PIN).
// Stars, Questions, Look (the content set): rulesPanel(group) for each, generated from the rules'
// declarations: a label and ?, the control, and what it does when ? is open; a rule that doesn't
// apply is greyed out and says why; Advanced folds the rest. Questions adds the retrain periods,
// Look the categories and the word for a star-dot (termsPanel).
// The content set's settings apply to every save on it.

import { h } from '../dom.js';
import { RULES, RULE, PER_STAR, WRONG_MODES, ruleApplies, PLAYER, PLAYER_GROUPS } from '../../../shared/engine/index.js';
import * as E from '../../../shared/engine/index.js';
import { palettePicker } from './palette.js';

const WRONG_NAMES = { retry: 'Retry now', wait: 'Wait' };

/** A group of radio options for one setting; `names[v]` is a label, or [label, note] (the note shown beside it). */
const radios = (name, values, names, current, pick, disabled = false) => values.map(v => {
  const [label, note] = Array.isArray(names[v]) ? names[v] : [names[v], null];
  return h('label', { class: 'rule-option' + (disabled ? ' disabled' : '') },
    h('input', { type: 'radio', name, checked: current === v, disabled, onchange: () => pick(v) }),
    h('span', {}, h('strong', {}, label), note && h('span', { class: 'note' }, ' · ' + note)));
});
const heading = text => h('div', { class: 'eyebrow rules-gap' }, text);
/** The help icon: a small ? that drops down what a setting does (each line verb first). */
const helpDrop = (label, lines) => h('details', { class: 'help-drop' },
  h('summary', { class: 'rule-help-btn', title: 'What it does', 'aria-label': `About ${label}` }, '?'),
  h('div', { class: 'help-drop-body', role: 'note' }, lines.map(t => h('p', {}, t))));
/** A panel: its title (with a help icon when `help` is given) and body. */
const panel = (title, ...body) => {
  const help = Array.isArray(body[0]?.help) ? body.shift().help : null;
  return h('section', { class: 'panel rules-panel' },
    h('div', { class: 'panel-head' }, h('h2', { class: 'eyebrow' }, title), help && helpDrop(title, help)), h('div', { class: 'panel-body' }, ...body));
};
/** A whole number input, kept between min and max; `set` gets the new value. */
const number = (value, min, max, label, set) => h('input', {
  type: 'number', min, max, step: 1, value, class: 'share-input', 'aria-label': label,
  onchange: e => { const n = Math.round(Number(e.target.value)); if (n >= min && n <= max && n !== value) set(n); else e.target.value = value; },
});
/** Advanced, folded (open while anything in it was just used: it stays open across redraws). */
const advancedOpen = new Set();
const advanced = (id, ...body) => h('details', {
  class: 'rules-advanced', open: advancedOpen.has(id),
  ontoggle: e => { if (e.target.open) advancedOpen.add(id); else advancedOpen.delete(id); },
}, h('summary', {}, 'Advanced'), ...body);

// ---- Board (this save) ----

/** the Board's Advanced: the share (a star-dot that has deployed a star) and the assessor PIN. */
export function boardAdvancedPanel(st, a) {
  return h('section', { class: 'panel rules-panel' }, h('div', { class: 'panel-body' }, advanced('board',
    heading('A star-dot that has deployed a star'),
    h('label', { class: 'rule-option share-option' },
      h('span', {}, 'is ignited once '),
      number(a.share(), 1, 100, 'Percent of its star’s star-dots', n => a.setShare(n)),
      h('span', {}, '% of its star’s star-dots are ignited.')),
    pinPanel(st, a))));
}

/** The assessor PIN: set, change or clear; asks for the current one first. */
export function pinPanel(st, a) {
  const has = !!st.save.pin;
  const field = (cls, label) => h('input', { type: 'password', class: `pin-input ${cls}`, inputmode: 'numeric', autocomplete: 'new-password', maxlength: 12, 'aria-label': label, placeholder: label });
  const pin = field('pin-new', 'New PIN');
  const again = field('pin-again', 'Repeat it');
  const msg = h('p', { class: 'note pin-msg', role: 'status' });
  const valid = v => /^[0-9A-Za-z]{4,12}$/.test(v);
  const set = e => {
    e.preventDefault();
    if (!valid(pin.value)) { msg.textContent = 'A PIN is 4 to 12 digits or letters.'; return; }
    if (pin.value !== again.value) { msg.textContent = 'The two don’t match.'; return; }
    const value = pin.value;
    a.askPin('change', () => a.setPin(value));
  };
  return panel('Assessor PIN',
    h('p', { class: 'note' }, has
      ? 'Set. The app opens on PLAY, and “Back to editing” and a new session ask for it. While PLAY is locked the player has no Undo, Redo or States menu.'
      : 'None. Set one to keep a player on PLAY: the app then opens there, and editing asks for the PIN. (It keeps a player out; it isn’t security: anyone with the files can edit them.)'),
    h('form', { class: 'pin-form', onsubmit: set }, pin, again, h('button', { type: 'submit', class: 'text-btn small' }, has ? 'Change PIN' : 'Set PIN')),
    has && h('button', { type: 'button', class: 'text-btn small danger', onclick: () => a.askPin('change', () => a.setPin(null)) }, 'Clear the PIN'),
    msg);
}

/** Design › Board › Content set (P10): which one this save is on, and Update content set…. */
export function contentSetPanel(st, a) {
  return panel('Content set', { help: ['Its items and questions (in their order and places) start every new save on it. Editing them here changes this save only; Update content set… copies this save’s items, their order, the category names and the item fields to it. Other saves on it keep their own; the rest of the design stays in each save.'] },
    h('p', { class: 'note small' }, `This save is on “${st.content.title || st.content.id}”.`),
    h('button', { type: 'button', class: 'text-btn small update-content-set', onclick: () => a.updateContentSet() }, 'Update content set…'));
}

/** Start a new session. */
export function sessionPanel(st, a) {
  return panel('Sessions', { help: ['Clears this save’s progress (answers, waits, goals, completed categories) and takes every star but the central one off the map. The questions and lists stay.'] },
    h('button', { type: 'button', class: 'text-btn small', onclick: () => a.startSession() }, 'Start a new session…'));
}


// ---- The content set's rules, generated ----

/** How each rule is set: most through setRule; two have their own actions; some start a new session. */
function setter(a, rule) {
  if (rule.key === 'locks') return v => a.setLocks(v);
  if (rule.key === 'fade') return v => a.setFade(v);
  const name = v => (rule.names?.[v] ?? String(v));
  if (rule.newSession) return v => a.setRuleNewSession(rule.key, v, `${rule.label}: ${name(v)}`);
  return v => a.setRule(rule.key, v, `${rule.label}: ${name(v)}`);
}

/** What the help icon drops down: what the rule does, then what each value does. */
const helpText = rule => [rule.help, ...(rule.details ? rule.values.map(v => `${rule.names[v]}: ${rule.details[v]}`) : [])].filter(Boolean);

function ruleControl(st, a, rule) {
  const rules = st.content.rules;
  const value = rules[rule.key] ?? rule.default;
  const applies = ruleApplies(rule, rules);
  const set = setter(a, rule);
  const head = h('div', { class: 'rule-head' }, h('span', { class: 'eyebrow' }, rule.label), helpDrop(rule.label, helpText(rule)));
  let control;
  if (rule.type === 'perStar' || rule.type === 'twinkle') {
    control = h('span', { class: 'segmented', role: 'group', 'aria-label': rule.label }, rule.values.map(v => h('button', {
      type: 'button', class: 'seg' + (value === v ? ' on' : ''), 'aria-pressed': String(value === v), disabled: !applies,
      onclick: () => { if (value !== v) set(v); },
    }, rule.names?.[v] ?? String(v))));
  } else if (rule.type === 'wrong') {
    control = h('div', { class: 'rule-option wrong-option' },
      h('span', { class: 'segmented', role: 'group', 'aria-label': rule.label }, WRONG_MODES.map(m => h('button', {
        type: 'button', class: 'seg' + (value.mode === m ? ' on' : ''), 'aria-pressed': String(value.mode === m),
        onclick: () => { if (value.mode !== m) a.setRule('wrong', { ...value, mode: m }, m === 'retry' ? 'A wrong answer can be retried at once' : `A wrong answer waits ${value.minutes} minutes`); },
      }, WRONG_NAMES[m]))),
      value.mode === 'wait' && h('span', {}, ' ', number(value.minutes, 1, 1440, 'Minutes to wait', n => a.setRule('wrong', { ...value, minutes: n }, `A wrong answer waits ${n} minutes`)), ' minutes'));
  } else if (rule.type === 'dayRange') {
    const hours = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const pick = (which, list, current, set) => h('select', { class: 'hour-select', 'aria-label': which, dataset: { hour: which }, onchange: e => set(Number(e.target.value)) },
      list.map(hr => h('option', { value: String(hr), selected: hr === current }, E.hourName(hr))));
    const say = (s, e) => `The schedule runs from ${E.hourName(s)} to ${E.hourName(e)}`;
    control = h('label', { class: 'rule-option day-option' },
      h('span', {}, 'From '), pick('start', hours(0, value.end - 1), value.start, s => a.setRule('day', { ...value, start: s }, say(s, value.end))),
      h('span', {}, ' to '), pick('end', hours(value.start + 1, 24), value.end, e => a.setRule('day', { ...value, end: e }, say(value.start, e))));
  } else if (rule.type === 'bonuses') {
    control = bonusControl(st, a, value);
  } else if (rule.type === 'comets') {
    control = cometsControl(st, a, value);
  } else if (rule.type === 'goalAfter') {
    control = h('label', { class: 'rule-option share-option' },
      h('span', {}, 'After '),
      number(value, 0, 999, 'Correct answers before the goal', n => a.setRule('goalAfter', n, n ? `A goal question twinkles after ${n} correct answers` : 'No goal question')),
      h('span', {}, ' correct answers in a category (0: none)'));
  } else {
    control = radios(rule.radio ?? rule.key, rule.values, rule.names, value, set, !applies);
  }
  return h('div', { class: 'rule' + (applies ? '' : ' disabled'), dataset: { rule: rule.key } },
    head, control,
    !applies && h('p', { class: 'note small rule-why' }, rule.whyNot));
}

/**
 * 9b, the bonus ladder: Off | On, how many ignites earn a rung, and the ladder itself (the prizes in
 * order: drag a row by its grip to reorder, × to take one off; Add a prize… from what can work here).
 */
function bonusControl(st, a, value) {
  const set = (patch, message) => a.setRule('bonuses', { ...value, ...patch }, message);
  const label = k => E.prizeLabel(k);
  const given = k => !!E.PRIZE[k] || st.content.player?.[k] !== false;   // a tool needs Player; the extra prizes don't
  const ladder = value.ladder.filter(k => E.LADDER_KEYS.includes(k));   // (a prize no longer offered drops out)
  // Drag a row by its grip onto another: it goes before that one (onto the end, last). Rows go by
  // place, since a spin can be on the ladder more than once.
  let dragging = null;
  const dropBefore = before => {
    const from = dragging;
    dragging = null;
    if (from == null || from === before) return;
    const l = [...ladder];
    const [k] = l.splice(from, 1);
    l.splice(before == null ? l.length : before > from ? before - 1 : before, 0, k);
    if (l.join() !== ladder.join()) set({ ladder: l }, `Moved ${label(k)} on the ladder`);
  };
  const target = before => ({ ondragover: e => { if (dragging != null) e.preventDefault?.(); }, ondrop: e => { e.preventDefault?.(); dropBefore(before); } });
  const left = E.LADDER_KEYS.filter(k => given(k) && (['spin', 'comet', 'comet:write'].includes(k) || !ladder.includes(k)) && !E.prizeProblem(st.content, k));   // (spins and comets as often as you like)   // only prizes that can work here
  const outcomes = value.spin ?? E.SPIN_OUTCOMES;
  // "A comet with your message": the k-th such rung carries the k-th "With a ladder prize" message.
  const comets = st.content.rules.comets ?? { on: 'off', messages: [] };
  const ladderMsgs = comets.messages.filter(m => m.when === 'ladder');
  const nextMsgId = () => `m${Math.max(0, ...comets.messages.map(m => Number(m.id.slice(1)) || 0)) + 1}`;
  const cometIndex = i => ladder.slice(0, i).filter(k => k === 'comet').length;
  const cometField = i => {
    const m = ladderMsgs[cometIndex(i)];
    return h('input', {
      class: 'comet-text-input ladder-comet-text', value: m?.text ?? '', maxlength: 140, placeholder: 'Its message', 'aria-label': 'The comet\u2019s message',
      onchange: e => {
        const text = e.target.value;
        const messages = m ? comets.messages.map(x => (x.id === m.id ? { ...x, text } : x)) : [...comets.messages, { id: nextMsgId(), text, when: 'ladder', n: 5, category: 0 }];
        a.setRules({ comets: { ...comets, messages } }, 'Wrote a prize comet\u2019s message');
      },
    });
  };
  const removeRung = i => {
    const k = ladder[i];
    const m = k === 'comet' ? ladderMsgs[cometIndex(i)] : null;
    const next = { bonuses: { ...value, ladder: ladder.filter((_, j) => j !== i) } };
    if (m) next.comets = { ...comets, messages: comets.messages.filter(x => x.id !== m.id) };
    a.setRules(next, `${label(k)} off the ladder`);
  };
  const OUTCOME_NAMES = { hint: 'A hint (a wrong choice crossed out)', prize: 'The next prize early', again: 'Spin again', nothing: 'Nothing' };
  return h('div', { class: 'bonus-control' },
    radios('bonuses', ['off', 'on'], { off: 'Off', on: 'On' }, value.on, v => set({ on: v }, v === 'on' ? 'Bonus ladder on' : 'Bonus ladder off')),
    value.on === 'on' && [
      h('label', { class: 'rule-option share-option' }, h('span', {}, 'A rung every '),
        number(value.every, 1, 99, 'Star-dots ignited per rung', n => set({ every: n }, `A rung every ${n} star-dots ignited`)), h('span', {}, ' star-dots ignited')),
      ladder.length
        ? h('ol', { class: 'bonus-ladder' }, ladder.map((k, i) => h('li', { dataset: { tool: k, i: String(i) }, class: given(k) && !E.prizeProblem(st.content, k) ? '' : 'off', ...target(i) },
          h('span', {
            class: 'bonus-grip', draggable: 'true', title: `Drag ${label(k)} to another place`, 'aria-hidden': 'true',
            ondragstart: e => { dragging = i; e.dataTransfer?.setData?.('text/plain', k); },
            ondragend: () => { dragging = null; },
          }, '⠿'),
          h('span', { class: 'grow' }, label(k), !given(k) ? h('span', { class: 'note small' }, ' (not given in Player: skipped)')
            : E.prizeProblem(st.content, k) && h('span', { class: 'note small' }, ` (skipped: ${E.prizeProblem(st.content, k)})`)),
          k === 'comet' && cometField(i),
          h('button', { type: 'button', class: 'remove-btn', title: 'Take it off the ladder', onclick: () => removeRung(i) }, '×')),
        ), h('li', { class: 'bonus-ladder-end', 'aria-hidden': 'true', ...target(null) }))
        : h('p', { class: 'note small' }, 'Nothing on the ladder yet: add the prizes the player earns, in order.'),
      left.length > 0 && h('select', {
        class: 'bonus-add', 'aria-label': 'Add a prize to the ladder',
        onchange: e => {
          const k = e.target.value;
          if (!k) return;
          // A comet with your message: its message, to write on its row (kept with Comets' messages, “With a ladder prize”).
          if (k === 'comet') return void a.setRules({ bonuses: { ...value, ladder: [...ladder, k] }, comets: { ...comets, messages: [...comets.messages, { id: nextMsgId(), text: '', when: 'ladder', n: 5, category: 0 }] } }, `${label(k)} on the ladder: write its message on its row`);
          set({ ladder: [...ladder, k] }, `${label(k)} on the ladder`);
        },
      }, h('option', { value: '' }, 'Add a prize…'), left.map(k => h('option', { value: k }, label(k)))),
      // 9c: what a spin can land on (each of the star's six kites is one of these, in turn).
      ladder.includes('spin') && h('div', { class: 'spin-outcomes' }, h('span', { class: 'note small' }, 'A spin can land on: '),
        E.SPIN_OUTCOMES.map(o => h('label', { class: 'rule-option player-switch' },
          h('input', {
            type: 'checkbox', checked: outcomes.includes(o), dataset: { outcome: o }, disabled: outcomes.length === 1 && outcomes.includes(o),
            onchange: e => set({ spin: E.SPIN_OUTCOMES.filter(x => (x === o ? e.target.checked : outcomes.includes(x))) }, `A spin ${e.target.checked ? 'can' : 'can’t'} land on ${OUTCOME_NAMES[o].toLowerCase()}`),
          }), h('span', {}, OUTCOME_NAMES[o])))),
    ]);
}

/**
 * 9d, Comets: Off | On, and the messages: each its words (up to 140 characters) and when it flies
 * (after N star-dots ignited, when a category is complete, now and then, or with a ladder prize);
 * × takes one off, + Add a message adds one.
 */
function cometsControl(st, a, value) {
  const set = (patch, message) => a.setRule('comets', { ...value, ...patch }, message);
  const msgs = value.messages;
  const edit = (i, patch, message) => set({ messages: msgs.map((m, j) => (j === i ? { ...m, ...patch } : m)) }, message);
  const WHEN = { ignites: 'After star-dots ignited:', category: 'When a category is complete:', random: 'Now and then', ladder: 'With a ladder prize (“A comet”)' };
  const nextId = () => `m${Math.max(0, ...msgs.map(m => Number(m.id.slice(1)) || 0)) + 1}`;
  return h('div', { class: 'comets-control' },
    radios('comets', ['off', 'on'], { off: 'Off', on: 'On' }, value.on, v => set({ on: v }, v === 'on' ? 'Comets on' : 'Comets off')),
    value.on === 'on' && [
      msgs.length ? h('ol', { class: 'comet-list' }, msgs.map((m, i) => h('li', { class: 'comet-row', dataset: { message: m.id } },
        h('input', { class: 'comet-text-input', value: m.text, maxlength: 140, placeholder: 'Your message', 'aria-label': 'Message', onchange: e => edit(i, { text: e.target.value }, 'Changed a comet message') }),
        h('select', { class: 'comet-when', 'aria-label': 'When it flies', onchange: e => edit(i, { when: e.target.value }, 'Changed when a comet flies') },
          E.COMET_WHEN.map(w => h('option', { value: w, selected: m.when === w }, WHEN[w]))),
        m.when === 'ignites' && number(m.n, 1, 999, 'Star-dots ignited', n => edit(i, { n }, `A comet after ${n} star-dots ignited`)),
        m.when === 'category' && h('select', { class: 'comet-category', 'aria-label': 'Category', onchange: e => edit(i, { category: Number(e.target.value) }, 'Changed a comet’s category') },
          st.content.categories.map((c, ci) => h('option', { value: String(ci), selected: m.category === ci }, c.name || `Category ${ci + 1}`))),
        h('button', { type: 'button', class: 'remove-btn', title: 'Take this message off', onclick: () => set({ messages: msgs.filter((_, j) => j !== i) }, 'Took a comet message off') }, '×'))))
        : h('p', { class: 'note small' }, 'No messages yet.'),
      h('button', { type: 'button', class: 'text-btn small comet-add', onclick: () => set({ messages: [...msgs, { id: nextId(), text: '', when: 'random', n: 5, category: 0 }] }, 'Added a comet message') }, '+ Add a message'),
    ]);
}

/** A subtab's rules: the everyday ones, then Advanced. */
export function rulesPanel(group, title) {
  return (st, a) => {
    const mine = RULES.filter(r => r.group === group);
    const main = mine.filter(r => !r.advanced);
    const more = mine.filter(r => r.advanced);
    return panel(title, main.map(r => ruleControl(st, a, r)), more.length > 0 && advanced(group, more.map(r => ruleControl(st, a, r))));
  };
}
export const starsPanel = rulesPanel('stars', 'Stars and star-dots');
export const questionsPanel = rulesPanel('questions', 'Questions');
export const lookPanel = rulesPanel('look', 'The map');
export const schedulePanel = rulesPanel('schedule', 'Schedule');
export const funPanel = rulesPanel('fun', 'Fun on the Star view');

/** The retrain periods (the content set's Retrain attribute's choices, in days). */
export function retrainPanel(st, a) {
  const persistence = st.content.properties.find(p => p.id === 'persistence');
  return panel('Schedule definitions', { help: [`Sets how many days a completed item stays fresh (its ${persistence.name} period) before it drops to half and needs retraining. Empty: never.`] },
    h('table', { class: 'rules-table' }, persistence.choices.map(c => h('tr', {},
      h('td', {}, c.name),
      h('td', {}, h('input', {
        type: 'number', min: 1, step: 1, class: 'days-input', value: c.days ?? '', placeholder: 'never',
        title: 'Days a completed item stays fresh (empty: never stale)',
        onchange: e => a.setPeriod(c.id, e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null),
      }), ' days')))));
}

// ---- Look (the content set) ----

/** The content set's categories (names and colors) and the color palette menu. */
export function categoriesPanel(st, a) {
  const { content } = st;
  return h('section', { class: 'panel rules-panel categories-panel' },
    h('div', { class: 'panel-head' }, h('h2', { class: 'eyebrow' }, 'Categories'), helpDrop('Categories', ['Sets the six colors (the palette button; yours are kept in this browser). Renames a category when you rename its central kite in MATERIALS.']), palettePicker(st, a)),
    h('div', { class: 'panel-body' },
      h('ul', { class: 'category-list' }, content.categories.map(c => h('li', {}, h('span', { class: 'swatch', style: { background: c.color } }), ' ', c.name)))));
}

/** what this content set calls a star-dot ("task", "question", "skill"…), used everywhere the app says it. */
export function termsPanel(st, a) {
  const t = st.content.terms ?? { stardot: 'star-dot', stardots: 'star-dots' };
  const field = (value, label, key) => h('input', {
    class: 'terms-input', value, 'aria-label': label, maxlength: 30, dataset: { term: key },
    onchange: e => {
      // A plural that was just the old word's default follows the new word ("task" → "tasks").
      const usual = t.stardot === 'star-dot' ? 'star-dots' : `${t.stardot}s`;
      a.setTerms(key === 'stardot' && t.stardots === usual ? { stardot: e.target.value, stardots: '' } : { ...t, [key]: e.target.value });
    },
  });
  return panel('Item name convention', { help: ['Replaces “star-dot” everywhere in this content set with your word (“task”, “question”, “skill”…). Empty brings “star-dot” back.'] },
    h('label', { class: 'rule-option terms-option' }, h('span', {}, 'A star-dot is called '), field(t.stardot, 'Its word', 'stardot'), h('span', {}, ', and several '), field(t.stardots, 'Its plural', 'stardots')));
}

// ---- Player (the content set): what the player may do ----

/** Design › Player: a switch per thing the player may see or do, by group (player.js). */
export function playerPanel(st, a) {
  const p = st.content.player;
  const control = sw => {
    const value = p[sw.key];
    const input = sw.values.length === 2 && typeof sw.default === 'boolean'
      ? h('label', { class: 'rule-option player-switch' },
        h('input', { type: 'checkbox', checked: !!value, dataset: { player: sw.key }, onchange: e => a.setPlayer(sw.key, e.target.checked) }),
        h('span', {}, sw.label))
      : h('div', { class: 'rule-option player-choice' }, h('span', {}, sw.label, ' '),
        h('span', { class: 'segmented', role: 'group', 'aria-label': sw.label }, sw.values.map(v => h('button', {
          type: 'button', class: 'seg' + (value === v ? ' on' : ''), 'aria-pressed': String(value === v), dataset: { player: sw.key, value: v },
          onclick: () => { if (value !== v) a.setPlayer(sw.key, v); },
        }, sw.names[v]))));
    return h('div', { class: 'player-row', dataset: { rule: sw.key } }, input, helpDrop(sw.label, [sw.help]));
  };
  const welcome = panel('Welcome', { help: ['Greets the player at the start of their tutorial, in Play mode and in a play version.'] },
    h('input', { class: 'state-name player-welcome', 'aria-label': 'Welcome line', placeholder: 'A line of your own for the player (optional)', maxlength: 200, value: st.content.welcome ?? '', onchange: e => a.setWelcome(e.target.value) }));
  return [welcome, ...PLAYER_GROUPS.map(g => panel(g.label, g.id === 'views' ? { help: ['Sets which views the player can open in Play mode. The Star view stays when nothing else is chosen.'] } : { help: [g.id === 'session' ? 'Sets whether the player can start over.' : g.id === 'move' ? 'Sets what the player can move on the map; with all three off the board is locked. In Edit mode everything moves, and Kites lock holds only the player.' : `Sets what the player can see and do in the ${g.label}.`] },
    PLAYER.filter(sw => sw.group === g.id).map(control)))];
}
