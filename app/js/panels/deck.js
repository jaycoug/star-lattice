// The Deck view (Star-dots: Independent only): each category's list as a deck of cards.
//
// Six decks, one per category. A deck's sub-decks are the map's stars: the first items (the
// central kite), then each star the category has deployed, holding its share of the items in the
// order the field takes them (the list's, or shuffled per session); then the rest, 🔒 Locked. A
// sub-deck opens when its star is on the map (as the cards before it are completed), so the Deck and
// Star views share one progress: a card done here is done there. The Deck never speaks of the map.
// In Play mode the locked sub-deck can't be opened; in Edit mode every card can (a new card joins
// its category's deck at the end, locked until its sub-deck opens).
//
// A card flips (a click on its front, Space, or ↻): front, the item's name and its description
// (blank when it has none); back, the star-dot screen in the designer's layout, compact, where it is
// answered, completed and deployed, with its related cards as chips that jump to them. ← / → (keys,
// the arrows beside it, or a swipe) move between cards across the sub-decks.
//
// Edit mode edits the same items as the lists do: rename on the front, Move earlier / later, Add a
// card…. In Play mode those follow Design › Player (Renaming; Editing the lists).

import { h, editableText } from '../dom.js';
import { route } from '../route.js';
import * as E from '../../../shared/engine/index.js';
import { screenFor } from '../screen.js';

const MARK = { open: '☆', training: '◐', ignited: '★' };
const STATUS = { open: 'Not started', training: 'In training', ignited: 'Complete' };
const button = (label, onclick, props = {}) => h('button', { type: 'button', class: 'text-btn small', onclick, ...props }, label);

// The card in view can be stepped and flipped from the keyboard (set at each render).
let nav = null;
document.addEventListener('keydown', e => {
  if (!nav || route().page !== 'deck' || nav.blocked()) return;
  if (e.target.closest?.('input, textarea, select, button, summary, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'ArrowRight') { e.preventDefault?.(); nav.step(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault?.(); nav.step(-1); }
  else if (e.key === ' ') { e.preventDefault?.(); nav.flip(); }
});

/** A category's sub-decks: [{ id, label, items, open }] (the star each opens with; the rest locked). */
/** The Deck's words for a card that can't be answered now (the screen's own speak of the map). */
const CLOSED = {
  off: 'This card is locked: its sub-deck opens as the cards before it are completed.',
  locked: 'This card is locked: it opens as the cards before it are completed.',
};
export function subDecks(st, k) {
  const items = E.fieldOrder(st.state, k, st.ev.opts);
  const segs = st.ev.segments(k)?.segments ?? [{ from: 0, to: 0 }];
  const out = segs.filter((s, i) => i === 0 || s.to > s.from).map((s, i) => ({ id: String(i), label: i ? `Star ${i + 1}` : 'Central kite', items: items.slice(s.from, s.to), open: true }));
  const placed = segs.length ? segs[segs.length - 1].to : 0;
  if (placed < items.length) out.push({ id: 'rest', label: 'Locked', items: items.slice(placed), open: false });
  return out;
}

export function deck(st, a) {
  const { state, ev, content } = st;
  const playing = route().mode === 'play';
  const central = E.centralStar(state);
  const u = { cat: 0, card: null, back: false, ...a.ui().deck };
  const cat = Math.min(Math.max(0, u.cat), central.kites.length - 1);
  const k = central.kites[cat];
  const subs = subDecks(st, k);
  const reachable = s => s.open || !playing;   // Edit mode opens every card
  const cards = subs.filter(reachable).flatMap(s => s.items.map(d => ({ d, sub: s })));
  const at = Math.max(0, cards.findIndex(c => c.d === u.card));
  const cur = cards[at] ?? null;
  const back = !!cur && u.back;
  const set = patch => { a.setDeck(patch); if ('card' in patch || 'cat' in patch) a.setSdsUi({}); };
  const go = i => { if (cards[i]) set({ card: cards[i].d, back: false }); };
  /** Jump to a card anywhere (a related chip): its category and place; one that can't be reached opens as a screen. */
  const jump = id => {
    const ki = central.kites.findIndex(x => E.fieldOrder(state, x, ev.opts).includes(id));
    const there = ki >= 0 && subDecks(st, central.kites[ki]).some(s => reachable(s) && s.items.includes(id));
    if (there) set({ cat: ki, card: id, back: true });
    else a.openScreen(id);
  };
  nav = { step: dir => go(at + dir), flip: () => cur && set({ back: !back }), blocked: () => !!(a.ui().sds || a.ui().conflict || a.ui().pinAsk || a.ui().qImport) };
  const done = list => list.filter(d => ev.effective(d).status === 'ignited').length;
  const colorOf = i => content.categories[state.kites[central.kites[i]].color ?? i]?.color;
  const color = colorOf(cat);

  // ---- The decks and their sub-decks ----
  const decks = h('nav', { class: 'deck-cats', 'aria-label': 'Decks' }, central.kites.map((x, i) => {
    const all = E.listOf(state, x);
    return h('button', {
      type: 'button', class: 'deck-cat' + (i === cat ? ' on' : ''), style: { '--cat': colorOf(i) }, 'aria-pressed': String(i === cat), dataset: { deck: String(i) },
      onclick: () => set({ cat: i, card: null, back: false }),
    }, h('span', { class: 'swatch', style: { background: colorOf(i) } }), ' ', state.kites[x].name || content.categories[i]?.name || 'Category',
    h('span', { class: 'deck-count' }, ` ${done(all)}/${all.length}`));
  }));
  const subBar = h('div', { class: 'deck-subs', role: 'group', 'aria-label': 'Sub-decks' }, subs.map(s => h('button', {
    type: 'button', class: 'deck-sub' + (cur?.sub.id === s.id ? ' on' : '') + (s.open ? '' : ' locked'), dataset: { sub: s.id },
    disabled: !reachable(s) || !s.items.length, title: s.open ? `${s.items.length} card${s.items.length === 1 ? '' : 's'}` : 'Opens as the cards before it are completed',
    onclick: () => { if (s.items.length) set({ card: s.items[0], back: false }); },
  }, s.open ? '' : '🔒 ', s.label, h('span', { class: 'deck-count' }, ` ${done(s.items)}/${s.items.length}`))));

  // ---- The card ----
  const listAt = cur ? E.listOf(state, k).indexOf(cur.d) : -1;
  const rename = !playing || a.allow('rename');
  const editing = !playing || a.allow('lists');
  const front = d => {
    const dot = state.dots[d];
    const status = ev.effective(d).status;
    let x0 = null;
    return h('div', {
      class: 'deck-face deck-front', role: 'button', tabindex: 0, title: 'Flip it (Space)',
      onclick: e => { if (!e.target.closest?.('button, input, textarea, .editable')) set({ back: true }); },
      onpointerdown: e => { x0 = e.clientX; },
      onpointerup: e => { if (x0 != null && Math.abs(e.clientX - x0) > 60) go(at + (e.clientX < x0 ? 1 : -1)); x0 = null; },   // a swipe
    },
    h('div', { class: `deck-status ${status}`, title: STATUS[status] }, MARK[status] ?? '·'),
    h('h2', { class: 'deck-name' }, rename ? editableText({ value: dot.name, placeholder: 'Unnamed star-dot', onCommit: v => a.renameDot(d, v) }) : dot.name || 'Unnamed star-dot'),
    h('p', { class: 'deck-text' }, dot.description));   // Blank without one; the question is on the back
  };
  const card = cur && h('div', { class: 'deck-card' + (back ? ' flipped' : ''), style: { '--cat': color }, dataset: { card: cur.d } },
    back
      ? h('div', { class: 'deck-face deck-back' },
        h('div', { class: 'deck-back-bar' }, button('↻ Front', () => set({ back: false }), { class: 'text-btn small deck-flip', title: 'Flip it back (Space)' })),
        screenFor(st, a, cur.d, { edit: !playing, open: jump, replace: id => set({ card: id, back: true }), closed: CLOSED }))
      : front(cur.d));
  const stage = h('div', { class: 'deck-stage' + (back ? ' wide' : '') },
    button('‹', () => go(at - 1), { class: 'text-btn deck-arrow', disabled: at <= 0, title: 'The card before (←)', 'aria-label': 'The card before' }),
    card ?? h('p', { class: 'note deck-empty' }, subs.some(s => s.items.length) ? 'No card is open yet.' : 'No cards in this deck yet.'),
    button('›', () => go(at + 1), { class: 'text-btn deck-arrow', disabled: at >= cards.length - 1, title: 'The next card (→)', 'aria-label': 'The next card' }));
  const where = cur && h('p', { class: 'deck-pos note small' },
    `${cur.sub.items.indexOf(cur.d) + 1} of ${cur.sub.items.length} · ${cur.sub.label}`,
    !back && button('↻ Flip', () => set({ back: true }), { class: 'text-btn small deck-flip', title: 'Flip it (Space)' }));

  // ---- Editing the deck (as the lists do) ----
  const input = h('input', { class: 'list-add-input deck-add-input', placeholder: 'Add a card…', 'aria-label': 'Add a card to this deck',
    onkeydown: e => { if (e.key === 'Enter' && input.value.trim()) { const v = input.value; input.value = ''; const id = a.addItem(k, v); if (id) set({ card: id, back: false }); } } });
  const tools = editing && h('div', { class: 'deck-tools' },
    cur && button('← Move earlier', () => a.moveItem(k, listAt, listAt - 1), { disabled: listAt <= 0, title: 'One place earlier in the list (and the deck)' }),
    cur && button('Move later →', () => a.moveItem(k, listAt, listAt + 1), { disabled: listAt < 0 || listAt >= E.listOf(state, k).length - 1, title: 'One place later in the list (and the deck)' }),
    h('span', { class: 'deck-add' }, input));

  return h('div', { class: 'deck-page' }, decks, subBar, stage, where, tools);
}
