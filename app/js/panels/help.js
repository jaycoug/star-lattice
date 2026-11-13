// ? Help (P8): the manual, a section per view, then the star-dot screen, questions, Design and the
// saves, with a search box that hides what doesn't match as you type. In Play mode (and in a play
// version) it's the player's manual: Design and the saves go, and so does any view or tool that
// Design › Player doesn't give. Each tour can be started again from here.

import { ladderOf } from '../../../shared/engine/index.js';
import { h } from '../dom.js';
import { playerViews } from '../tabs.js';
import { restartTour } from '../tour.js';
import { PLAY } from '../edition.js';

// An entry: [title, text, needs]. needs: a view ('view:deck'), a player switch ('undo'), 'design'
// (the designer's manual only), 'quiz' / 'noquiz' (Every star-dot is a question on or off).
const MANUAL = [
  { id: 'start', title: 'Getting around', entries: [
    ['The top bar', 'View switches between the Star, Tree, Deck and Schedule views. Mode switches between Edit (build the board) and Play (try it as a first-time player).', 'design'],
    ['Views', 'The buttons at the top switch between the views you’re given.', 'player'],
    ['Undo and Redo', '↶ Undo (Ctrl+Z) takes back the last change; ↷ Redo (Ctrl+Shift+Z or Ctrl+Y) puts it back.', 'undo'],
    ['Light or dark', '☾ Dark and ☀ Light switch the colors; this browser remembers the choice.'],
    ['Saving', 'Every change is saved as you make it; the bar says “Saving…”, then “Saved” with the time.'],
    ['Start a new session…', '↺ New session… clears the progress (what’s done, answered and waiting) and keeps the board.', 'newSession'],
    ['A test run', 'Play mode here is a test run as a first-time player: the player’s permissions and tutorial, a fresh session, and nothing saved. ↺ Restart the test starts it over; Edit puts the board back as it was.', 'design'],
  ] },
  { id: 'star', title: 'Star view', view: 'star', entries: [
    ['The board', 'Each colored kite around a star is a category, and the dots on it are its star-dots. Finishing star-dots opens new stars outward. Drag to pan, scroll or pinch to zoom; Fit (F) shows everything.'],
    ['Selecting', 'Click a kite to show its star-dots; click a star-dot to select it. ↗ Open beside it opens its screen.', 'noquiz'],
    ['Answering', 'Tap a star-dot to answer its question. A right answer lights it up; a wrong one may make it wait a few minutes. The panel shows each category’s progress.', 'quiz'],
    ['Moving star-dots', 'Drag a star-dot onto another (or an empty place) to swap them, or a selected kite onto another kite.', 'swap'],
    ['Rotating', 'With a kite selected, ↻ Rotate (R) turns its star-dots one place around it.', 'rotateDots'],
    ['Rotating kites', 'With a kite selected, ⟳ Rotate kites (Shift+R) turns its star’s kites one place, with their star-dots.', 'rotateKites'],
    ['Stars', 'A star-dot at a kite’s tip can open a star of its own: Deploy puts it on the map, Withdraw takes it off.', 'design'],
    ['Constellation', 'Layer: Constellation draws the relations between star-dots as lines, brighter for stronger ones.', 'layer'],
    ['Designs', 'Kites: Designs paints the kites with their designs; 🖌 on a selected kite opens the kite designer.', 'kiteDesign'],
    ['Your colors', '🎨 recolors your board: the designer’s colors, a palette you’ve unlocked, or one of your own. A new session goes back to the designer’s colors.', 'palette'],
    ['Prizes', 'A glowing badge in an empty place on the map is a prize you’ve earned: click it to unlock what it shows. Prizes stay where they appear until you claim them, and several can wait at once: claim them in any order.', 'ladder'],
    ['Comets', 'Now and then a comet crosses the sky behind the board, trailing a message as its tail. A comet won as a prize (a star for its head) circles the sky for the rest of the session; with a comet to write, 🌠 by the map sends a note of your own off at once.', 'player'],
    ['Spinning the star', 'A spin you’ve won shows ⟲ Spin beside every star on the map: the one you tap turns like a pinwheel and the kite that stops at the top decides: 💡 a hint (your next question has one wrong choice crossed out), 🎁 the next prize early, ⟲ spin again, or nothing.', 'ladder'],
    ['Retiring', 'Retire takes a star-dot off the map into the Retired bank; Restore puts it back.', 'retire'],
  ] },
  { id: 'tree', title: 'Tree view', view: 'tree', entries: [
    ['The tree', 'Every item, in order: each category with its items, and under each the items of the star it opened.'],
    ['Adding and naming', 'Type a name in an empty place and press Enter to add an item there. Click an item to select it; click its name to rename it.', 'rename'],
    ['Moving', 'Pick an item up and put it in another place, or on the shelf to set it aside.', 'move'],
    ['Lists', 'Under Star-dots: Independent each category is one list, filling its stars in order; reorder, add and delete there.', 'lists'],
    ['Opening', 'Click an item to open its screen.', 'player'],
  ] },
  { id: 'deck', title: 'Deck view', view: 'deck', entries: [
    ['Decks', 'Each category is a deck of cards, in sub-decks: the first cards, then one for each of its stars. A sub-deck opens as its star would on the map, so progress is the same in both views.'],
    ['Cards', 'A card’s front shows its name and description. Click it, ↻ Flip or Space turns it over to answer it; ← and → (or a swipe) move between cards.'],
    ['Arranging', 'Move earlier and Move later reorder a card; Add a card… puts a new one in this deck.', 'design'],
  ] },
  { id: 'schedule', title: 'Schedule', view: 'schedule', entries: [
    ['The calendar', 'The week’s planned hours on star-dots; click a block to open its star-dot.'],
    ['Planning', 'Plan time… on a star-dot, then click a 15-minute slot to place an hour there; a day’s header spreads several hours over the day.', 'schedule:full'],
    ['The day’s hours', 'Design › Look › Schedule hours sets when the day starts and ends.', 'design'],
  ] },
  { id: 'screen', title: 'A star-dot’s screen', entries: [
    ['Its screen', 'Opened from any view: its name and description, then its sections: checklist, notes, questions (the Assessor), attributes and related star-dots.'],
    ['Checklist', 'The items inside it; Filter ▾ narrows them by kind, attribute or text.', 'checklist'],
    ['Questions', 'The Assessor asks its questions; answering them all right completes it.', 'assessor'],
    ['Mark assessed', 'A □ star-dot with no questions is completed with Mark assessed.', 'markAssessed'],
    ['Notes', 'Notes keep anything worth remembering about it.', 'notesRead'],
    ['Related', 'Relevance Information lists the star-dots related to it, and how strongly.', 'relevance'],
    ['Arranging the screen', 'In Edit mode, drag a section by its grip to move it, or switch it off; “Layout applies to” sets whether a change is for every star-dot or only this one.', 'design'],
    ['Writing questions', 'Write questions… in the Assessor opens the editor: a form, or Markdown, with a preview.', 'design'],
  ] },
  { id: 'design', title: '⚙ Design', need: 'design', entries: [
    ['Board', 'This save’s own settings: sessions, Start a new session…, and under Advanced the share and the assessor PIN (which keeps the save in Play mode until it’s given).'],
    ['Stars', 'How the board grows: kites on every star or the central one only, star-dots Hierarchical (each tip opens its own star) or Independent (each category one list, filling its stars in order), how many per star, deploying by hand or automatically, and Kites lock.'],
    ['Questions', 'Quiz mode (every star-dot is a question), what a wrong answer does, the goal, shuffling; Schedule definitions set how often things come back.'],
    ['Look', 'The categories and their colors, the item name convention (your word for a star-dot), fading and twinkling, and the schedule’s hours.'],
    ['Player', 'What the player gets in Play mode: the views, the tools on the map, how they may move things, what the star-dot screen shows, and the welcome line their tutorial opens with.'],
    ['Fun', 'Celebrations on the Star view, each a switch: Bursts lights a star-dot up with a burst as it ignites (bigger at a tip), and a supernova when a whole star is ignited. The system’s reduce-motion setting stops them.'],
    ['Constellation reveal', 'Design › Fun › Constellation reveal joins two related star-dots (+ Add relation on a star-dot’s screen) with a faint glowing line once both are ignited, drawn as the second one ignites.'],
    ['Comets', 'Design › Fun › Comets sends your messages across the Star view on comets, each trailing behind as its tail, once a session: after a number of star-dots ignited, when a category is complete, now and then, or with a ladder prize. On the ladder, “A comet with your message” carries the message you write on its row, and “A comet the player writes” lets the player write one; both, as often as you put them there, circle the sky for the rest of the session in a prize comet’s own look.'],
    ['Bonus ladder', 'Design › Fun › Bonus ladder locks prizes until they’re earned, in the order you set (drag a prize by its grip; × takes it off): the player’s tools, the kite designer’s Cut out kite shapes and Paint on kites (each on its own, each bringing Kites: Solid | Designs), each palette, Your own palette, and spins of the star (as many as you like, with what a spin can land on). Every few star-dots ignited earns the next, which appears as a prize in an empty place on the Star view; clicking it unlocks it. With the ladder on, the kite designer’s prizes and the palettes are only ever earned: one not on the ladder isn’t offered; the player’s other tools follow Player unless they’re on the ladder. With it off, Player decides. A new session starts the ladder over. Edit mode is never locked.'],
  ] },
  { id: 'saves', title: 'Saves', need: 'design', entries: [
    ['States ▾', 'Every save (click to open, × to delete), New from a blueprint…, New empty map…, Duplicate…, Download… and Upload… (a save with its content set, as one file).'],
    ['Content sets', 'A content set is a library: its categories’ names and its items and questions, in order. A new save on it starts from a copy. Each save keeps its own items, its own ⚙ Design settings (colors, rules, the player’s permissions…) and its progress, so a change in one save never touches another.'],
    ['Update content set…', 'Design › Board › Update content set… copies this save’s items and questions, their order, the category names and the item fields to its content set, for the saves started on it from then on. Saves already on it keep their own.'],
    ['Make a repo…', 'Writes a play version of one board beside this folder, ready for GitHub: Play mode only, its progress cleared, with only what Design › Player gives.'],
  ] },
];

let query = '';   // the search, kept across redraws

const words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
const matches = (text, q) => words(q).every(w => text.toLowerCase().includes(w));

/** The manual: everything in Edit mode; in Play mode only what the player is given. */
export function help(st, a, page) {
  const designer = page.mode !== 'play';
  const views = designer ? ['star', 'tree', 'deck', 'schedule'] : playerViews(st).map(v => v.id);
  const quiz = st.ev.opts.questions === 'on';
  const ok = need => {
    if (!need) return true;
    if (need === 'design') return designer;
    if (need === 'player') return !designer;
    if (need === 'quiz') return designer || quiz;
    if (need === 'noquiz') return designer || !quiz;
    if (need === 'ladder') return designer || !!ladderOf(st.file.content);   // the bonus ladder is on
    if (need === 'schedule:full') return designer || st.content.player.schedule === 'full';
    return a.allow(need);
  };
  const sections = MANUAL.filter(s => ok(s.need) && (!s.view || views.includes(s.view)))
    .map(s => ({ ...s, entries: s.entries.filter(([, , need]) => ok(need)) })).filter(s => s.entries.length);
  const empty = h('p', { class: 'note help-none', hidden: true }, 'Nothing matches.');
  const body = h('div', { class: 'help-body' }, sections.map(s => h('section', { class: 'help-section', dataset: { section: s.id } },
    h('h2', {}, s.title),
    h('dl', {}, s.entries.map(([title, text]) => h('div', { class: 'help-entry', dataset: { text: `${s.title} ${title} ${text}` } }, h('dt', {}, title), h('dd', {}, text)))))), empty);
  const filter = q => {
    query = q;
    let any = false;
    for (const sec of body.querySelectorAll('.help-section')) {
      let shown = 0;
      for (const e of sec.querySelectorAll('.help-entry')) { const on = matches(e.dataset.text, q); e.hidden = !on; shown += on; }
      sec.hidden = !shown;
      any ||= !!shown;
    }
    empty.hidden = any;
  };
  const which = designer ? 'design' : 'player';
  const view = h('div', { class: 'page help-page' },
    h('header', { class: 'page-head' }, h('div', { class: 'title-block' }, h('div', { class: 'eyebrow' }, 'Help'), h('h1', {}, designer ? 'The manual' : 'How to play'))),
    h('div', { class: 'help-tools' },
      h('input', { type: 'search', class: 'help-search', placeholder: 'Search the manual', 'aria-label': 'Search the manual', value: query, oninput: e => filter(e.target.value) }),
      h('button', { type: 'button', class: 'text-btn small help-tour', onclick: () => restartTour(which) }, designer ? 'Start the tutorial again' : 'Start the tour again')),
    !designer && !PLAY && h('p', { class: 'note small' }, 'This is the player’s manual: only what Design › Player gives them.'),
    body);
  if (query) filter(query);
  return view;
}
