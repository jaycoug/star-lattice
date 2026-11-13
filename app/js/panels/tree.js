// REARRANGE's tree: the starfield as a hierarchy, read from the state. Levels
// alternate kite and star-dot rows: the central star's six kites, then the open kite's four
// star-dots, then the six kites of the star that star-dot deployed, and so on. A star has no box of its
// own; the star-dot box stands for it. One path is open (ui.tPath, a list of kite and star-dot IDs
// from the top): opening a box closes its open siblings. the shelf sits above the
// tree as a strip of circles (shelfItem): a click selects one, a double-click picks it up; its
// contents don't unfold there.
//
// Kites show in compass order (E, NE, NW, W, SW, SE) as they sit on the starfield; star-dots in the
// order Zenith, Port, Nadir, Starboard. Marks under a box are its children: a kite's four
// star-dots by status, a star-dot's deployed star's kites (filled when unlocked). A star shared by
// several star-dots opens under its first source only.
//
// A click selects a box and opens it; the selected box's name is a field, typed into to rename it
// (or, on an empty slot, to name a new star-dot). a star-dot opens its star's
// kites and, with them, the kite holding its next free slot; a star-dot without a star shows the
// six kites of the star it would plan, dashed (nothing is created by looking). Under a star-dot,
// empty slots are name fields straight away ("Add a child…"): Enter adds the child there (planning
// the star if needed) and moves the cursor to the next free slot; Escape or leaving it adds nothing. Moving has one gesture: double-click a
// star-dot, kite or shelved circle to pick it up; single clicks then only open boxes, to travel to the
// place (boxes it can't go to are dimmed); double-click where it goes (a box, an empty slot, or the
// shelf) to put it there, or the picked-up box itself (or Esc) to put it down. The move is
// REARRANGE's (rHit → canMove / moveTo: a swap, conflict cards, Undo). A double-click on the name
// field counts too, since the first click of a double-click can turn the name into a field.
//
// Play mode: a click on a star-dot also opens its screen, where the player acts. Nothing is
// added there (no name fields, no dashed stars); moving, the shelf and renaming are the player's
// only where Design › Player gives them (a.allow: Moving items, The shelf, Renaming).

import { h, svg } from '../dom.js';
import { route } from '../route.js';
import * as E from '../../../shared/engine/index.js';
import { DIR_NAMES } from '../../../shared/lattice.js';
import { CENTRAL } from '../../../shared/ui/starDotScreen.js';

const COMPASS = [2, 1, 0, 5, 4, 3];   // absolute slots E, NE, NW, W, SW, SE
const DOT_ORDER = [E.ZENITH, 1, 0, 3];

/** What a shelf entry is called: "Interview Prep", "the Career kite", "the Career star". */
export function shelfLabel(st, e) {
  const { state, content } = st;
  if (e.kind === 'dot') return state.dots[e.id]?.name || 'the star-dot';
  if (e.kind === 'kite') return state.kites[e.id]?.name || 'the kite';
  const star = state.stars[e.id];
  const color = star && state.kites[star.kites[0]].color;
  return `the ${color == null ? '' : content.categories[color].name + ' '}star`;
}

/**
 * Double-taps on touch screens, recognized from two taps (see box()): some phone browsers send no
 * dblclick for a double-tap. The last tap, the last pointer's type, and when the last double was handled.
 */
const DOUBLE_MS = 400;
let lastTap = { key: null, at: 0 };
let lastPointer = 'mouse';
let lastDouble = 0;

/**
 * After a child is added from the tree, put the cursor in the next free slot's field ("kite:slot"),
 * once the redraws it causes have settled (the field is found by its key, so whichever render made
 * it, the current one gets the cursor).
 */
function focusLater(key) {
  setTimeout(() => {
    const field = [...(document.querySelectorAll?.('.tree-input') ?? [])].find(e => e.dataset?.focusKey === key);
    field?.focus?.();
  }, 60);
}

/**
 * A name field: commits on Enter or leaving it (when changed); Escape restores it. `enterOnly`
 * (adding a child): only Enter commits; leaving or Escape adds nothing. `focusKey`: the slot it
 * names, so the cursor can land in it.
 */
function nameField(value, placeholder, onCommit, { enterOnly = false, focusKey = null } = {}) {
  const input = h('input', { class: 'tree-input', placeholder, 'aria-label': placeholder,
    onclick: e => e.stopPropagation(),
    onkeydown: e => {
      e.stopPropagation();
      if (e.key === 'Enter') { if (enterOnly) { const v = input.value.trim(); input.value = ''; if (v) onCommit(v); } else input.blur?.(); }
      if (e.key === 'Escape') { input.value = value; input.blur?.(); }
    },
    onblur: () => { if (enterOnly) input.value = ''; else if (input.value.trim() !== value) onCommit(input.value.trim()); } });
  input.value = value;
  if (focusKey) input.dataset.focusKey = focusKey;
  return input;
}

export function tree(st, a) {
  const { state, ev, content } = st;
  const u = a.ui();
  const path = u.tPath ?? [];
  const sel = u.rSel;
  const mode = u.rMode;
  const pickedId = mode?.kind === 'swapKite' ? mode.kite : mode?.kind === 'place' ? mode.entry.id
    : mode?.kind === 'swapDot' ? state.kites[mode.from.kite]?.dots[mode.from.slot] : null;
  const catColor = k => (state.kites[k].color == null ? null : content.categories[state.kites[k].color].color);
  const playing = route().mode === 'play';
  const moving = a.allow('move');

  // ---- Children ----------------------------------------------------------------------------------
  /** A star's kites, in compass order when it has a place (else stored order): [{ id, dir }]. */
  const kitesOf = starId => (ev.place(starId)
    ? COMPASS.map(slot => ({ id: ev.kiteAtSlot(starId, slot), dir: DIR_NAMES[slot] }))
    : state.stars[starId].kites.map(id => ({ id, dir: null })));
  /** The star a kite is on (null on the shelf), and whether it's a kite-less star's spoke. */
  const starOfKite = k => E.index(state).kite.get(k)?.star ?? null;
  /** A kite's slots, Zenith first: [{ kite, slot, dot }] (a spoke's: the rings its per-star count offers, and any holding a star-dot, Y5). */
  const slotsOf = k => {
    const offered = starOfKite(k) ? ev.usableSlots(starOfKite(k)) : [0, 1, 2, 3];
    return DOT_ORDER.filter(slot => offered.includes(slot) || state.kites[k].dots[slot]).map(slot => ({ kite: k, slot, dot: state.kites[k].dots[slot] }));
  };
  /** The category color behind a row item (kite, slot or shelf entry). */
  const colorOf = x => (x.kind === 'kite' ? catColor(x.id) : x.kind === 'slot' ? catColor(x.kite)
    : x.kind === 'ghost' ? (E.index(state).dot.get(x.dot) ? catColor(E.index(state).dot.get(x.dot).kite) : null)
    : x.kind === 'star' ? catColor(state.stars[x.id].kites[0]) : null);
  /** The star a star-dot opens: its deployed star when it is the first source. */
  const deployed = d => {
    const b = state.dots[d]?.branch;
    return b && state.stars[b]?.sources[0] === d ? b : null;
  };
  /** A star-dot with no star at all (not even a shared one): it shows the star it would plan, dashed. */
  const starless = d => !playing && !!d && !(state.dots[d].branch && state.stars[state.dots[d].branch]);   // (Play mode adds nothing: no dashed stars)
  const ghostId = (d, k) => `ghost:${d}:${k}`;
  /** What opens with a star-dot: the kite holding its next free slot (the back kite of the star it would plan). */
  const nextKite = d => {
    if (starless(d)) return ghostId(d, E.BACK);
    const b = deployed(d);
    return b ? E.childSlots(state, b, ev.opts).find(x => !state.kites[x.kite].dots[x.slot])?.kite ?? null : null;
  };
  const kiteColorOfDot = d => { const at = E.index(state).dot.get(d); return at ? catColor(at.kite) : null; };
  /** The parent whose children a star's slots hold: its first source (none on the central star or a shelved one). */
  const parentOfKite = k => { const star = E.index(state).kite.get(k)?.star; return star ? state.stars[star].sources[0] ?? null : null; };

  // ---- Boxes -------------------------------------------------------------------------------------
  const isSel = t => sel && sel.kind === t.kind && (t.kind === 'slot' ? sel.kite === t.kite && sel.slot === t.slot : sel.id === t.id);
  /**
   * Click and double-click handlers for a box or a shelf circle (`key` names it across redraws):
   * two quick taps on the same one are a double-tap, on touch screens only (a mouse has the
   * browser's dblclick, which is skipped when the double-tap was already handled).
   */
  const taps = (key, onSingle, onDouble) => ({
    onpointerdown: e => { lastPointer = e.pointerType || 'mouse'; },
    onclick: () => {
      const now = Date.now();
      if (lastPointer === 'touch' && lastTap.key === key && now - lastTap.at < DOUBLE_MS) {
        lastTap = { key: null, at: 0 };
        lastDouble = now;
        return onDouble();
      }
      lastTap = { key, at: now };
      onSingle();
    },
    ondblclick: () => { if (Date.now() - lastDouble > DOUBLE_MS) onDouble(); },
    onkeydown: e => { if (e.key === 'Enter') e.target.click(); },
  });
  const box = ({ cls, target, openId, alsoOpen = null, level, eyebrow, name, rename, placeholder, note, marks, color, field = null, selectAs = target, screen = null }) => {
    const selected = isSel(target);
    const pickState = !mode ? '' : target.id === pickedId ? ' picked' : a.rCan(target) ? ' target' : ' refused';
    const onDouble = () => {
      if (!mode) { if (moving && target.kind !== 'slot' && target.kind !== 'ghost') a.rPick(target); }
      else if (pickState === ' picked') a.setRMode(null);
      else if (pickState === ' target') a.rHit(target);
    };
    const key = target.id ?? `${target.kite}:${target.slot}`;
    return h('div', {
      class: `tree-box ${cls}` + (openId && path[level] === openId ? ' open' : '') + (selected ? ' selected' : '') + pickState,
      style: { '--cat': color },
      dataset: { node: key },
      role: 'button', tabindex: 0,
      title: !mode ? (target.kind === 'slot' || !moving ? (playing && screen ? 'Open its screen' : null) : 'Double-click to move it')
        : { ' picked': 'Double-click to put it down', ' target': 'Double-click to put it here', ' refused': 'It can’t go here' }[pickState],
      ...taps(key, () => { if (!mode) a.rHit(selectAs); a.openTree(level, openId, alsoOpen); if (playing && screen && !mode) a.openScreen(screen); }, onDouble),
    },
    eyebrow && h('div', { class: 'tree-eyebrow' }, eyebrow),
    field && !mode ? field
      : selected && rename && a.allow('rename') && !mode ? nameField(name ?? '', placeholder || 'Name (optional)', rename) : h('div', { class: 'tree-name' + (name ? '' : ' unnamed') }, name || placeholder),
    (Array.isArray(note) ? note.length > 0 : note) && h('div', { class: 'tree-note' }, Array.isArray(note) ? note.flatMap((n, i) => (i ? [' · ', n] : [n])) : note),
    marks?.length > 0 && h('div', { class: 'tree-marks' }, marks),
    // A star-dot box's ↗, bottom right: its screen (the box's own click and double-click don't fire).
    screen && !mode && h('button', {
      type: 'button', class: 'tree-open', title: 'Open its screen', 'aria-label': 'Open its screen',
      onclick: e => { e.stopPropagation(); a.openScreen(screen); }, ondblclick: e => e.stopPropagation(), onpointerdown: e => e.stopPropagation(),
    }, '↗'));
  };

  /** A mark opens (and, unless picking, selects) the child it stands for. */
  const mark = (cls, title, target, open) => h('span', { class: `tree-mark ${cls}`, title,
    onclick: e => { e.stopPropagation(); if (!mode) a.rHit(target); open(); } });

  /**
   * A kite's box. A kite without a name shows no title (names are optional); its color and marks say
   * what it is. One with nothing in it (no star-dots, name or description) is quiet, so the kites with
   * contents stand out, and comes back to full strength when selected,
   * opened or offered as a place to move something. It stays fully usable either way.
   */
  const kiteBox = ({ id: k, dir }, level) => {
    const kite = state.kites[k];
    const cat = kite.color == null ? null : content.categories[kite.color];
    const empty = !kite.name && !kite.description && kite.dots.every(d => !d);
    return box({
      cls: 'tree-kite' + (empty ? ' quiet' : ''), target: { kind: 'kite', id: k }, openId: k, level, color: catColor(k),
      eyebrow: null, name: kite.name, placeholder: '', rename: v => a.renameKite(k, v),   // An unnamed kite shows no title
      note: ev.kiteOpen(k) || !E.index(state).kite.has(k) ? null : h('span', { title: 'Locked' }, '🔒'),
      marks: slotsOf(k).map(s => mark(s.dot ? ev.effective(s.dot).status : 'vacant', s.dot ? state.dots[s.dot].name || 'unnamed' : '',
        s.dot ? { kind: 'dot', id: s.dot } : { kind: 'slot', kite: k, slot: s.slot }, () => a.openTree(level, k, s.dot))),
    });
  };

  const slotBox = ({ kite: k, slot, dot: d }, level) => {
    const where = state.kites[k].labels[slot] || null;   // Only a label the designer gave it
    if (!d) {
      const parent = parentOfKite(k);
      const key = `${k}:${slot}`;
      return box({
        cls: 'tree-empty', target: { kind: 'slot', kite: k, slot }, level, eyebrow: where, name: '', placeholder: '',
        field: playing ? null : parent ? nameField('', 'Add a child…', v => a.treeAddChild(parent, { kite: k, slot }, v, level, focusLater), { enterOnly: true, focusKey: key })
          : nameField('', 'Add a star-dot…', v => a.nameSlot(k, slot, v), { enterOnly: true, focusKey: key }),
      });
    }
    const dot = state.dots[d];
    const b = deployed(d);
    return box({
      cls: 'tree-dot', target: { kind: 'dot', id: d }, openId: d, alsoOpen: nextKite(d), level, color: catColor(k), screen: d,
      eyebrow: where, name: dot.name, placeholder: 'Name this star-dot', rename: v => a.renameDot(d, v),
      note: [ev.support(d) && `${ev.support(d).ignited}/${ev.support(d).total}`, E.overCount(state, d, ev.opts) && h('span', { title: 'Beyond Star-dots per star' }, '⚠')].filter(Boolean),
      // One mark per kite of its star, filled by how much of the kite is done (a kite with nothing in it faint).
      marks: b && kitesOf(b).map(x => {
        const progress = ev.kiteProgress(x.id);
        const has = state.kites[x.id].dots.some(Boolean);
        const fill = !has ? 'faint' : progress >= E.DOTS ? 'ignited' : progress > 0 ? 'training' : 'open';
        const label = `${state.kites[x.id].name ? state.kites[x.id].name + ': ' : ''}${has ? `${Math.round(progress * 10) / 10} of ${E.DOTS} done` : '—'}`;
        return mark(fill, label, { kind: 'kite', id: x.id }, () => a.openTree(level, d, x.id));
      }),
    });
  };

  /** A kite of the star a star-dot would plan: dashed; it opens its four empty slots. */
  const ghostKiteBox = ({ dot: d, k }, level) => box({
    cls: 'tree-kite tree-ghost', target: { kind: 'ghost', id: ghostId(d, k) }, selectAs: { kind: 'dot', id: d }, openId: ghostId(d, k), level,
    color: kiteColorOfDot(d), eyebrow: null, name: '', placeholder: '',
  });
  /** A slot of the star a star-dot would plan: typing a name adds the child there, planning the star. */
  const ghostSlotBox = ({ dot: d, k, slot }, level) => box({
    cls: 'tree-empty tree-ghost', target: { kind: 'ghost', id: `${ghostId(d, k)}:${slot}` }, selectAs: { kind: 'dot', id: d }, level,
    eyebrow: null, name: '', placeholder: '',
    field: nameField('', 'Add a child…', v => a.treeAddChild(d, { k, slot }, v, level, focusLater), { enterOnly: true, focusKey: `${ghostId(d, k)}:${slot}` }),
  });

  /**
   * A thing on the shelf: a small circle like the tree's marks, in its category's
   * color, filled by status (a star-dot's own, a kite's progress; a star is ringed). A click selects
   * it (its name shows, and the side card); a double-click picks it up, or puts it down again.
   */
  const shelfItem = e => {
    const target = { kind: 'shelfEntry', id: e.id, entry: e };
    const selected = isSel(target);
    const picked = mode?.kind === 'place' && mode.entry.id === e.id;
    const progress = k => ev.kiteProgress(k);
    const fill = e.kind === 'dot' ? ev.effective(e.id).status
      : e.kind === 'kite' ? (progress(e.id) >= E.DOTS ? 'ignited' : progress(e.id) > 0 ? 'training' : 'open') : 'star';
    const name = e.kind === 'dot' ? state.dots[e.id].name || 'Unnamed star-dot' : e.kind === 'kite' ? state.kites[e.id].name || 'Unnamed kite' : shelfLabel(st, e).replace(/^the /, '');
    const kind = e.kind === 'dot' ? 'star-dot' : e.kind;
    return h('div', {
      class: 'shelf-item' + (selected ? ' selected' : '') + (picked ? ' picked' : '') + (mode && !picked ? ' refused' : ''),
      style: { '--cat': colorOf(e) }, dataset: { node: e.id }, role: 'button', tabindex: 0,
      title: `${name} (shelved ${kind})${mode ? (picked ? ' · double-click to put it down' : '') : ' · double-click to pick it up'}`,
      ...taps(e.id, () => { if (!mode) a.rHit(target); }, () => (picked ? a.setRMode(null) : !mode && a.rPick(target))),
    },
    h('span', { class: `shelf-dot ${fill} ${e.kind}` }),
    (selected || picked) && h('span', { class: 'shelf-name' }, name));
  };

  // ---- Rows --------------------------------------------------------------------------------------
  /** Rows under an open box, following the path from `level`: children of kind kite or dot. */
  const rowsFrom = (first, level) => {
    const rows = [];
    let items = first;
    for (let l = level; items?.length; l++) {
      rows.push({ items, level: l });
      const open = path[l];
      if (open == null) break;
      const keyOf = x => (x.kind === 'kite' ? x.id : x.kind === 'ghost' ? ghostId(x.dot, x.k) : x.kind === 'slot' ? x.dot : null);
      const at = items.findIndex(x => keyOf(x) === open);
      if (at < 0) break;
      rows[rows.length - 1].openAt = at;
      const x = items[at];
      items = x.kind === 'kite' ? slotsOf(x.id).map(s => ({ kind: 'slot', ...s }))
        : x.kind === 'slot' ? (deployed(x.dot) ? kitesOf(deployed(x.dot)).map(k => ({ kind: 'kite', ...k }))
          : starless(x.dot) ? [0, 1, 2, 3, 4, 5].map(k => ({ kind: 'ghost', dot: x.dot, k })) : null)
        : x.kind === 'ghost' ? DOT_ORDER.filter(slot => E.createdSlots(ev.opts).includes(slot)).map(slot => ({ kind: 'ghostSlot', dot: x.dot, k: x.k, slot }))
        : null;
    }
    return rows;
  };
  const renderRow = ({ items, level, openAt }, i, rows) => {
    const prev = rows[i - 1];
    const cols = row => row.cols ?? row.items.length;
    const links = prev && prev.openAt != null && svg('svg', { class: 'tree-links', viewBox: '0 0 100 24', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      items.map((_, c) => svg('line', {
        x1: (prev.openAt + 0.5) / cols(prev) * 100, y1: 0, x2: (c + 0.5) / items.length * 100, y2: 24, 'vector-effect': 'non-scaling-stroke',
      })));
    const branchColor = prev && prev.openAt != null ? colorOf(prev.items[prev.openAt]) : null;
    return [links, h('div', { class: 'tree-row' + (i ? ' child' : ''), style: { '--cols': items.length, '--branch': branchColor } },
      items.map(x => (x.kind === 'kite' ? kiteBox(x, level) : x.kind === 'ghost' ? ghostKiteBox(x, level)
        : x.kind === 'ghostSlot' ? ghostSlotBox(x, level) : slotBox(x, level))))];
  };

  const central = E.centralStar(state);
  const fieldRows = rowsFrom(kitesOf(central.id).map(k => ({ kind: 'kite', ...k })), 0);
  // The shelf: above the tree, a strip of circles. With something picked up from the
  // tree, double-clicking the strip sets it aside there.
  const canShelve = !!mode && mode.kind !== 'place' && a.rCan({ kind: 'shelf' });
  const shelf = h('section', {
    class: 'shelf-section' + (mode && mode.kind !== 'place' ? (canShelve ? ' target' : ' refused') : ''),
    'aria-label': 'Shelf',
    title: mode && mode.kind !== 'place' ? (canShelve ? 'Double-click to set it aside on the shelf' : 'It can’t go on the shelf') : null,
    ondblclick: e => { if (canShelve && !e.target.closest?.('.shelf-item')) a.rHit({ kind: 'shelf' }); },
  },
  h('h2', { class: 'eyebrow shelf-title' }, 'Shelf', h('span', { class: 'sch-count' }, ` · ${state.shelf.length}`)),
  h('div', { class: 'shelf-board' },
    state.shelf.map(shelfItem),
    mode && mode.kind !== 'place' && h('div', { class: 'tree-shelf-drop' + (canShelve ? ' target' : ' refused') }, canShelve ? '＋' : '')));
  return h('div', { class: 'tree', dataset: { scrollKey: 'tree' } },
    moving && a.allow('shelf') && shelf,
    h('section', { class: 'tree-section' },
      h('h2', { class: 'eyebrow tree-central-head' },
        h('button', { type: 'button', class: 'tree-central', title: 'Open its screen', onclick: () => a.openScreen(CENTRAL) },
          h('span', { class: 'tree-central-dot' }), content.title || 'The central star', ' ↗')),
      fieldRows.map(renderRow)));
}
