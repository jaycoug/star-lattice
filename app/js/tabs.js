// The top bar's switches and the page under them. Two switches replace the old tabs: View (Star,
// Tree, Deck, Schedule) and Mode (Edit, Play). Star is the map (panels/play.js), Tree the tree or
// Independent's lists (panels/rearrange.js), Schedule the calendar (panels/schedule.js), Deck the
// cards (P6). Edit mode builds; Play mode is what the player gets: only the views the designer
// allowed (Design › Player), and star-dot screens that can't be edited. In the design version Play
// mode is a test run on a copy (actions.startTest), with ↺ Restart the test. ⚙ Design (the rules, and
// what the player may do) is Edit mode's; ? Help is everyone's. A save with an assessor PIN stays in
// Play mode until the PIN is given. Where the app is lives in the address (route.js).

import { h } from './dom.js';
import { route, address, canonical, VIEWS } from './route.js';
import { rearrange as rearrangePage } from './panels/rearrange.js';
import { schedule as schedulePage } from './panels/schedule.js';
import { play as playPage } from './panels/play.js';
import { deck as deckPage } from './panels/deck.js';
import { help } from './panels/help.js';
import { boardAdvancedPanel, sessionPanel, starsPanel, questionsPanel, retrainPanel, categoriesPanel, termsPanel, lookPanel, schedulePanel, playerPanel, funPanel, contentSetPanel } from './panels/rules.js';
import { independentOn } from '../../shared/engine/index.js';
import { PLAY } from './edition.js';

const pageHead = (eyebrow, title, notes) => h('header', { class: 'page-head' },
  h('div', { class: 'title-block' }, h('div', { class: 'eyebrow' }, eyebrow), h('h1', {}, title)),
  notes && h('div', { class: 'head-notes' }, notes));

/** The Schedule view: a calendar for planning hours on star-dots, with the list to plan from (panels/schedule.js). */
function schedule(st, a) {
  return h('div', { class: 'page' },
    pageHead('Planning', 'Schedule', null),
    schedulePage(st, a));
}

/** The Deck view: each category's list as a deck of flip cards (panels/deck.js). Under Hierarchical it isn't offered. */
function deck(st, a) {
  return independentOn(st.ev.opts) ? h('div', { class: 'page deck-wrap' }, deckPage(st, a))
    : h('div', { class: 'page' }, pageHead('Deck', 'Deck', null), h('p', { class: 'note' }, 'The Deck view needs Star-dots: Independent (⚙ Design › Stars).'));
}

/**
 * ⚙ Design: six subtabs, by what their settings shape, each saying whose they are:
 * Board (this save), Stars, Questions, Look, Player and Fun (the content set). #design/<subtab>; #design opens Board.
 */
export const GOVERN_TABS = [
  { id: 'board', label: 'Board', whose: 'save', panels: [sessionPanel, contentSetPanel, boardAdvancedPanel] },   // The share and PIN under Advanced
  { id: 'stars', label: 'Stars', whose: 'content', panels: [starsPanel] },
  { id: 'questions', label: 'Questions', whose: 'content', panels: [questionsPanel, retrainPanel] },
  { id: 'look', label: 'Look', whose: 'content', panels: [categoriesPanel, termsPanel, lookPanel, schedulePanel] },
  { id: 'player', label: 'Player', whose: 'content', panels: [playerPanel] },
  { id: 'fun', label: 'Fun', whose: 'content', panels: [funPanel] },
];
export const governTab = () => GOVERN_TABS.find(t => t.id === route().sub) ?? GOVERN_TABS[0];
function design(st, a) {
  const sub = governTab();
  return h('div', { class: 'page' },
    pageHead('Design', 'Design', null),
    h('nav', { class: 'subtabs', 'aria-label': 'Design' }, GOVERN_TABS.map(t => h('a', {
      class: 'subtab', href: `#design/${t.id}`, 'aria-current': t === sub ? 'page' : null,
    }, t.label))),
    sub.panels.map(p => p(st, a)));
}

const PAGES = {
  star: { label: 'Star', render: (st, a) => playPage(st, a) },
  tree: { label: 'Tree', render: (st, a) => rearrangePage(st, a) },
  deck: { label: 'Deck', render: deck },
  schedule: { label: 'Schedule', render: schedule },
  design: { label: 'Design', render: design },
  help: { label: 'Help', render: (st, a) => help(st, a, route()) },
};

/** Whether the Deck view can be offered: only under Independent. */
const deckOffered = st => independentOn(st.ev.opts);

/** The views the player may open (Design › Player), in the bar's order; at least the Star view. */
export function playerViews(st) {
  const p = st.player ?? st.content.player ?? {};   // less the bonus ladder's locked rungs
  const allowed = { star: p.star !== false, tree: !!p.tree, deck: !!p.deck && deckOffered(st), schedule: !!p.schedule && p.schedule !== 'none' };
  const ok = VIEWS.filter(v => allowed[v.id]);
  return ok.length ? ok : [VIEWS[0]];
}

/**
 * Where the app is, made consistent: an older address rewritten; a locked save in Play mode; Play
 * mode on a view the player may open. { mode, page, sub, edit, label, render }.
 */
export function activePage(st, a) {
  const fixed = canonical();
  if (fixed) history.replaceState(null, '', fixed);
  let r = route();
  if (a.locked() && r.mode !== 'play') { r = { mode: 'play', page: 'star', sub: '' }; history.replaceState(null, '', '#play'); }
  if (r.mode === 'play' && r.page !== 'help' && !playerViews(st).some(v => v.id === r.page)) {
    r = { ...r, page: playerViews(st)[0].id };
    history.replaceState(null, '', address('play', r.page));
  }
  return { ...r, edit: r.mode === 'edit', ...PAGES[r.page] };
}

const seg = (label, href, on, props = {}) => h('a', { class: 'seg' + (on ? ' on' : ''), href, 'aria-current': on ? 'page' : null, ...props }, label);

/** The bar's left side: the brand, View, Mode, ⚙ Design, ? Help and Start a new session…. */
export function tabBar(st, page, a) {
  const playing = page.mode === 'play';
  const locked = playing && a.locked();
  const viewPage = VIEWS.some(v => v.id === page.page) ? page.page : 'star';
  const views = playing ? playerViews(st) : VIEWS;
  const newSession = !playing || st.player?.newSession !== false;   // (in a test run it clears the test's own progress)
  return h('nav', { class: 'tabbar', 'aria-label': 'Views' },
    h('div', { class: 'tabbar-inner' },
      h('span', { class: 'brand' }, 'Star Lattice'),
      views.length > 1 && h('span', { class: 'segmented view-switch', role: 'group', 'aria-label': 'View' },
        views.map(v => v.id === 'deck' && !deckOffered(st)
          ? h('span', { class: 'seg disabled', title: 'The Deck view needs Star-dots: Independent (⚙ Design › Stars)', 'aria-disabled': 'true' }, v.label)
          : seg(v.label, address(page.mode, v.id), v.id === page.page, { dataset: { view: v.id } }))),
      !PLAY && h('span', { class: 'segmented mode-switch', role: 'group', 'aria-label': 'Mode' },   // A play version is Play mode only
        seg('Edit', address('edit', viewPage), !playing, {
          dataset: { mode: 'edit' },
          title: locked ? 'Edit (asks for the assessor PIN)' : 'Build the board',
          // With a PIN, editing asks for it first.
          onclick: locked ? e => { e.preventDefault(); a.askPin('edit', () => { location.hash = address('edit', viewPage); }); } : null,
        }),
        seg('Play', address('play', viewPage), playing, { dataset: { mode: 'play' }, title: 'Test it as a first-time player: nothing done there is saved' })),
      playing && a.testing() && h('button', { type: 'button', class: 'text-btn small restart-test', title: 'Start the test run over, as a first-time player', onclick: () => a.restartTest() }, '↺ Restart the test'),
      !playing && h('a', { class: 'tab design-link', href: '#design', 'aria-current': page.page === 'design' ? 'page' : null, title: 'The rules, and what the player may do' }, '⚙ Design'),
      h('a', { class: 'tab help-link', href: address(page.mode, 'help'), 'aria-current': page.page === 'help' ? 'page' : null }, '? Help'),
      newSession && h('button', { type: 'button', class: 'text-btn small new-session', title: 'Clear this save’s progress and start again', onclick: () => a.startSession() }, '↺ New session…')));
}
