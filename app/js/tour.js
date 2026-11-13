// Tutorials (P8). The first time this browser opens the app, an intro popup says what to do first,
// with Show me more (the guided steps) and No more tutorials. Each step points at one feature (a
// ring around it) and either waits for the person to do it (it moves on by itself) or offers Next.
// Two tours: the designer's (Edit mode) and the player's (Play mode: the play version, and the
// design version's test run), which skips what Design › Player doesn't allow and opens with the
// designer's welcome line. Where each tour is (not started, a step, off, done) is kept in this
// browser; ? Help starts one again. Tips live here, not on the page.

import { h } from './dom.js';
import { route } from './route.js';
import { playerViews } from './tabs.js';

const KEY = 'star-lattice:tours';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
let where = null;   // { design, player }: undefined (the intro next), a step's id, 'off' or 'done'
const progress = () => (where ??= load());
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(where)); } catch { /* not kept: it shows again next time */ } };

let refresh = () => {};
let last = null;    // the context of the last render: { st, a, tab, which }
const off = () => globalThis.starLatticeTours === false;   // the click-throughs run without tours (tourflow.js checks them)

const playing = () => route().mode === 'play';
const at = (page, mode) => c => route().page === page && (mode ? route().mode === mode : true);
const VIEW_NAME = { star: 'Star view', tree: 'Tree view', deck: 'Deck view', schedule: 'Schedule' };

// ---- The designer's tour ----
const DESIGN = [
  { id: 'kite', page: 'star', target: '.sl-map', text: 'This is the Star view: your board. Each colored kite around the star is a category. Click a kite to select it.',
    done: () => !playing() && route().page === 'star' && ['kite', 'dot'].includes(last?.a.ui().playSel?.kind) },
  { id: 'open', page: 'star', target: '.sl-map', text: 'Its star-dots appear on it. Click one, then ↗ Open beside it to see its screen.',
    done: () => !playing() && !!last?.a.ui().sds },
  { id: 'screen', target: '.sds-sheet', text: 'A star-dot’s screen: its checklist, notes, questions, attributes and related star-dots. Drag a section by its grip to rearrange the screen, or switch one off. Close it (× or Esc) when you’re done.',
    done: () => !last?.a.ui().sds },
  { id: 'tree', target: '[data-view="tree"]', text: 'Open the Tree view: every item in order.', done: () => !playing() && route().page === 'tree' },
  { id: 'add', page: 'tree', target: '.page', text: 'Type a name in an empty place and press Enter to add an item there; click one to select, rename or open it.' },
  { id: 'design', target: '.design-link', text: 'Open ⚙ Design: the rules of the board (how stars open, questions, the look).', done: () => route().page === 'design' },
  { id: 'player', page: 'design', target: 'a[href="#design/player"]', text: 'Open Player: the views and tools the player gets.', done: () => route().page === 'design' && route().sub === 'player' },
  { id: 'welcome', page: 'design', target: '.player-welcome', text: 'This line greets the player at the start of their tutorial. Write one if you like.' },
  { id: 'play', target: '[data-mode="play"]', text: 'Switch to Play to try the board as a first-time player. Nothing done there is saved; Edit brings you back.',
    done: () => playing() },
  { id: 'states', target: '.states-btn', text: 'States ▾ keeps your saves: new ones from a blueprint, copies, downloads, and Make a repo…, which ships a play version of one board. ? Help has the manual.' },
];

// ---- The player's tour: only what the player is given ----
function playerSteps(st, a) {
  const views = playerViews(st).map(v => v.id);
  const quiz = st.ev.opts.questions === 'on';
  const allow = key => a.allow(key);
  const steps = [];
  if (views.includes('star')) {
    if (quiz) {
      steps.push({ id: 'p-answer', page: 'star', target: '.sl-map', text: 'Each colored kite is a category. Tap a star-dot to answer its question: a right answer lights it up and opens more of the board.',
        done: () => playing() && !!a.ui().quiz });
      steps.push({ id: 'p-close', target: '.qz-overlay', text: 'Answer it, then close it (×, Esc, or a click outside).', done: () => !a.ui().quiz });
    } else {
      steps.push({ id: 'p-kite', page: 'star', target: '.sl-map', text: 'Each colored kite is a category. Tap a kite to see its star-dots.',
        done: () => playing() && route().page === 'star' && ['kite', 'dot'].includes(a.ui().playSel?.kind) });
      steps.push({ id: 'p-open', page: 'star', target: '.sl-map', text: 'Tap a star-dot, then ↗ Open beside it to see its screen.', done: () => playing() && !!a.ui().sds });
      steps.push({ id: 'p-screen', target: '.sds-sheet', text: 'Its screen says what it is and how to finish it. Close it with × or Esc.', done: () => !a.ui().sds });
      const moves = [allow('swap') && 'drag a star-dot onto another to swap them', allow('rotateDots') && 'turn a selected kite’s star-dots with ↻ Rotate', allow('rotateKites') && 'turn a star’s kites with ⟳'].filter(Boolean);
      if (moves.length) steps.push({ id: 'p-move', page: 'star', target: '.sl-map', text: `You can rearrange the board: ${moves.join('; ')}.` });
    }
  }
  if (views.includes('deck')) {
    steps.push({ id: 'p-deck', target: '[data-view="deck"]', text: 'Open the Deck view: each category as a deck of cards.', done: at('deck', 'play') });
    steps.push({ id: 'p-flip', page: 'deck', target: '.deck-card', text: 'Click a card (or press Space) to flip it and answer it; ← and → move between cards. More cards open as you go.',
      done: () => playing() && !!a.ui().deck?.back });
  }
  if (views.includes('tree')) steps.push({ id: 'p-tree', target: '[data-view="tree"]', text: 'Open the Tree view: every item in order. Click one to open its screen.', done: at('tree', 'play') });
  if (views.includes('schedule')) {
    steps.push({ id: 'p-schedule', target: '[data-view="schedule"]', text: st.content.player.schedule === 'full' ? 'Open the Schedule: plan hours on your star-dots.' : 'Open the Schedule: the planned hours. Click a block to open its star-dot.', done: at('schedule', 'play') });
  }
  const extras = [allow('undo') && '↶ Undo takes back your last step', allow('newSession') && '↺ New session… starts over'].filter(Boolean);
  steps.push({ id: 'p-help', target: '.help-link', text: [...extras, '? Help has the manual'].join('. ') + '.' });
  return steps;
}

const stepsOf = (which, st, a) => (which === 'design' ? DESIGN : playerSteps(st, a));

const INTRO = {
  design: () => ['Welcome to Star Lattice', 'Build a board: each category is a kite around a star, and its items are the star-dots on it. Finishing them opens new stars outward. Then choose what a player may do, and try it in Play mode.'],
  player: st => [st.content.title || 'Welcome', 'Here’s how this board works. It takes a minute, and you can stop at any time.'],
};

/** Use `render` to redraw when a tour moves on. */
export function initTour(render) { refresh = render; }

/** Start a tour again from its intro (? Help). */
export function restartTour(which) { progress()[which] = undefined; keep(); refresh(); }
/** Which tour this page shows: the player's in Play mode, the designer's in Edit mode. */
export const tourFor = tab => (tab.mode === 'play' ? 'player' : 'design');

function set(which, value) { progress()[which] = value; keep(); refresh(); }
function next(which, steps, id) {
  const i = steps.findIndex(s => s.id === id);
  set(which, i >= 0 && i + 1 < steps.length ? steps[i + 1].id : 'done');
}

/** The popup for this page (or nothing), drawn on top of it. */
export function tourPopup(st, a, tab) {
  if (off()) return null;
  const which = tourFor(tab);
  last = { st, a, tab, which };
  const now = progress()[which];
  if (now === 'off' || now === 'done') return null;
  const steps = stepsOf(which, st, a);
  const stop = h('button', { type: 'button', class: 'text-btn small subtle tour-off', onclick: () => set(which, 'off') }, 'No more tutorials');
  if (now === undefined) {
    const [title, text] = INTRO[which](st);
    const welcome = which === 'player' && st.content.welcome;
    return h('div', { class: 'tour-pop tour-intro', role: 'dialog', 'aria-label': 'Tutorial' },
      h('h2', {}, title),
      welcome && h('p', { class: 'tour-welcome' }, welcome),
      h('p', {}, text),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'text-btn small tour-more', onclick: () => set(which, steps[0].id) }, 'Show me more'), stop));
  }
  const i = Math.max(0, steps.findIndex(s => s.id === now));
  const step = steps[i];
  // On another page, it first says where to go (the step's view, or ⚙ Design).
  const away = step.page && route().page !== step.page;
  const goTo = step.page === 'design' ? '.design-link' : `[data-view="${step.page}"]`;
  const text = away ? `First open ${step.page === 'design' ? '⚙ Design' : `the ${VIEW_NAME[step.page]}`}.` : step.text;
  const last1 = i === steps.length - 1;
  return h('div', { class: 'tour-pop', role: 'dialog', 'aria-label': 'Tutorial', dataset: { step: step.id, target: away ? goTo : step.target } },
    h('div', { class: 'tour-count' }, `${i + 1} of ${steps.length}`),
    h('p', {}, text),
    h('div', { class: 'btn-row' },
      step.done
        ? h('button', { type: 'button', class: 'text-btn small subtle tour-skip', onclick: () => next(which, steps, step.id) }, last1 ? 'Finish' : 'Skip')
        : h('button', { type: 'button', class: 'text-btn small tour-next', onclick: () => next(which, steps, step.id) }, last1 ? 'Finish' : 'Next'),
      stop));
}

/** After a render: a step whose action was done moves on (either tour: Play mode ends a designer's step). */
export function checkTour() {
  if (off() || !last) return;
  for (const which of ['design', 'player']) {
    const now = progress()[which];
    if (now === undefined || now === 'off' || now === 'done') continue;
    if (which !== last.which && which === 'player') continue;   // the player's steps count in Play mode only
    const steps = stepsOf(which, last.st, last.a);
    const step = steps.find(s => s.id === now);
    if (!step) { set(which, steps[0]?.id ?? 'done'); return; }   // a step no longer offered: start from the first
    if (step.done?.()) { queueMicrotask(() => next(which, steps, step.id)); return; }
  }
}

/** After a render: ring the step's target and put the popup beside it (or in a corner). */
export function placeTour(root) {
  for (const el of root.querySelectorAll('.tour-target')) el.classList.remove('tour-target');
  const pop = root.querySelector('.tour-pop');
  const sel = pop?.dataset?.target;
  const target = sel && root.querySelector(sel);
  if (!pop || !target) return;
  target.classList.add('tour-target');
  const r = target.getBoundingClientRect?.();
  const vh = globalThis.innerHeight ?? 0, vw = globalThis.innerWidth ?? 0;
  if (!r || !vh || r.height > vh * 0.5 || r.width > vw * 0.6) return;   // a big target (the map): the corner
  const below = r.bottom + 12, w = Math.min(340, vw - 32);
  const left = Math.max(16, Math.min(r.left, vw - w - 16));
  Object.assign(pop.style, { left: `${left}px`, right: 'auto', bottom: 'auto', top: below + 160 < vh ? `${below}px` : `${Math.max(16, r.top - 172)}px` });
}
