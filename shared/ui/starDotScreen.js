// The star-dot screen: everything about one star-dot, laid out as in star-dot_screen_draft.png.
//
// ┌ header: star icon + name │ summary (status, place, progress, retrain, deployment, description) ┐
// │ Checklist · Notes · Assessor  │ Attributes · Relevance Information │   (the default layout)
//
// The five widgets sit in two columns as the layout says (engine layout.js): the content set's,
// or the star-dot's own. In Edit mode each widget has a grip (drag it to another place, or to the
// end of a column) and × (switch it off); the bar above them says what the layout applies to (all
// star-dots, or this star-dot only: its own) and switches widgets back on. `setLayout(layout,
// message)` saves the content set's; a star-dot's own is a state change. The checklist has a
// small Filter dropdown (by kind, difficulty, money, travel, due date, a free mark, or a search),
// and in Edit mode a strip on its left that **adds** an item with that attribute set, selecting it
// with the matching attribute highlighted, to be filled in.
//
// Used by every tab and knowing none: the host passes the engine state and view, and
// edit true in DISSECT STAR (authoring: names, description, items, attributes, relations,
// merge, activate), false on PLAY (authored parts are shown fixed)
// change (fn: state → state) => void, applying an engine change (the host records
// undo and saves); completing items, assessing, Ignite and Lapse work in both modes
// act (fn: (state, options) → { state, problem }, message) => boolean, for changes that can
// be refused (merging): the host shows the problem, or applies it with the message
// ui the screen's view state, kept by the host: { filter, item (a selected child's ID, or
// 'defaults'), picker, merge, slots ('add' | 'move': the slot picker is open), slot (the
// slot a new child goes to: { k, slot }, its star's kite index and slot) }
// setUi (patch) => void
// open (dotId) => void, to show another star-dot's screen; replace: (dotId) => void, to show
// it instead of this one (after a merge); back: () => void, with backLabel
// now the current time (ms), for completion dates and staleness
// closed { kind: text }, the host's own words for a question that can't be answered now (the
// Deck view's, which has no map), in place of CLOSED_NOW's
// allow (key) => boolean, what the player may see and do (Design › Player, engine player.js);
// the host passes allows(…) for Play mode, and nothing in Edit mode (everything shows)
//
// Checklist bullets: □ needs the assessor, ○ is clicked complete; the border shows Difficulty (thin
// Easy, thick Medium, double Hard, thin gray unset; a child with children shows their highest) and
// a letter beside it the Retrain period. Marks sit together in one pair of parentheses: $ ✈ ⏱ come
// from the child's attributes (see derive.js marks()), ☺ and other free marks are set by hand.
// Filter ▾ shows one bullet type, border, mark or free mark at a time, or what a search finds.
//
// Every checklist row is a child star-dot (the star-dots on this one's star, in slot
// order). A terminal child (no children of its own) is completed from its bullet; one with children
// shows its rolled-up status and opens with a click. Clicking a row's text selects it: the
// Attributes widget then shows that child's own values (inherited ones fill in the rest), and a □
// child shows in the Assessor. With nothing selected, the widget summarizes the children. Values
// with a fixed list cycle by click (Shift-click goes back).
//
// **Checklist · Table**: the children as a table, in three column sets (Status,
// Attributes, Relevance), as DISSECT STAR's table was. **Delete…** asks the host (`remove`),
// which confirms and deletes the star-dot with its branch; a checklist row's × does the same.
// **The central star's screen**: `dotId` CENTRAL shows the central star as if it were a
// star-dot: named after the content set, its children the central star's star-dots, its status
// and summary rolled up from them (view.group), its Notes the central star's (the general notes);
// nothing of its own to complete, move, merge, retire or delete.

import { h, svg, editableText, removeButton } from '../dom.js';
import { miniStar, halfStar, svgPoints } from '../star.js';
import * as E from '../engine/index.js';
import { attributeSummary, shortDate, dollars } from './summaryText.js';
import { cellFill } from '../color.js';
import { questionSetView } from './questionSet.js';
import { questionEditor, dropDraft } from './questionEditor.js';   // Edit mode's question editors (left out of the play version)

/** The dotId that opens the central star's screen. */
export const CENTRAL = '@central';

const STATUS = { empty: 'Empty', open: 'Not started', training: 'In training', ignited: 'Ignited' };
const PERIOD_NAMES = { once: 'one-time', week: 'per week', month: 'per month', year: 'per year' };
const ROLE_NAMES = { check: '○ Click to complete', assess: '□ Needs assessment' };
const SYMBOLS = Object.fromEntries(E.DERIVED_MARKS.map(m => [m.id, m.symbol]));
/** with Every star-dot is a question: On, every star-dot is assessed (□). */
const questionsOn = view => view.opts?.questions === 'on';
const roleOf = (view, t) => (questionsOn(view) ? 'assess' : t.role);
/** under Star-dots: Independent a star-dot has no children (its items are in MATERIALS' lists). */
const independent = view => view.opts?.stardots === 'independent';

export function starDotScreen(props) {
  if (props.dotId === CENTRAL) return centralScreen(props);
  const { state: st, view, content, dotId, edit = false, change, act = () => false, ui = {}, setUi = () => {}, open = () => {}, replace = open, back, backLabel = '← Back', now = Date.now(), remove = null, retire = null, allow = () => true, setLayout = null, closed = {} } = props;
  const dot = st.dots[dotId];
  const ix = E.index(st);
  // Off the map (retired, round 6, or on the shelf) a star-dot has no slot: no kite, nothing to complete here.
  const at = ix.dot.get(dotId) ?? null;
  const kite = at ? st.kites[at.kite] : null;
  const retired = (st.retired ?? []).find(e => e.id === dotId) ?? null;
  const kids = view.children(dotId);   // its children: the star-dots on its star, in slot order
  const sel = kids.includes(ui.item) ? ui.item : null;
  const ctx = { st, view, content, dotId, dot, kite, at, retired, edit, change, act, ui, setUi, open, replace, now, sel, kids, usable: !!at && view.kiteOpen(at.kite), remove, retire, allow: edit ? () => true : allow, setLayout, closed };

  return h('div', { class: 'sds' + (edit ? ' sds-edit' : '') },
    header(ctx, back, backLabel),
    edit && ui.merge && mergePanel(ctx),
    body(ctx, relevance));
}

// ---- The widgets and their layout ---------------------------------------------------------

let dragWidget = null;   // The widget being dragged to another place (Edit mode)

/**
 * The widgets in their layout's two columns, each only where the player may see it (ctx.allow);
 * in Edit mode with a grip and ×, and the layout bar above them.
 */
function body(ctx, relevanceOf) {
  const { allow, edit, content, dot, central, dotId, change, sel, setUi } = ctx;
  const own = !central && dot.layout ? dot.layout : null;
  const layout = own ?? content.layout ?? E.DEFAULT_LAYOUT;
  const commit = (next, message) => (own ? change(s => E.setDotLayout(s, dotId, E.cleanLayout(next))) : ctx.setLayout?.(next, message));
  const shows = {
    checklist: allow('checklist'), notes: allow('notesRead') || allow('notesWrite'), assessor: allow('assessor'),
    attributes: allow('attributes') || allow('due'), relevance: allow('relevance'),
  };
  const fill = { checklist: () => checklistWidget(ctx), notes: () => notes(ctx), assessor: () => assessor(ctx), attributes: () => attributes(ctx), relevance: () => relevanceOf(ctx) };
  const target = (col, before) => ({
    ondragover: e => { if (dragWidget) { e.preventDefault(); e.currentTarget?.classList?.add('sds-drop'); } },
    ondragleave: e => e.currentTarget?.classList?.remove('sds-drop'),
    ondrop: e => {
      if (!dragWidget) return;
      e.preventDefault();
      e.stopPropagation();
      const id = dragWidget;
      dragWidget = null;
      if (id !== before) commit(E.moveWidget(layout, id, col, before), `Moved ${E.WIDGET_NAMES[id]}`);
    },
  });
  const deselect = e => e.target.dataset?.blank != null && sel != null && setUi({ item: null, hl: null });
  const widget = (id, col) => {
    const name = E.WIDGET_NAMES[id];
    return h('section', {
      class: `sds-cell sds-widget sds-${id}`, dataset: { widget: id, ...(id === 'checklist' && { blank: '' }) },
      ...(id === 'checklist' && { onclick: deselect }), ...(edit && target(col, id)),
    },
    edit && h('div', { class: 'sds-widget-bar' },
      h('span', {
        class: 'sds-grip', draggable: 'true', title: `Drag ${name} to another place`, 'aria-hidden': 'true',
        ondragstart: e => { dragWidget = id; e.dataTransfer?.setData?.('text/plain', id); },
        ondragend: () => { dragWidget = null; },
      }, '⠿'),
      button('×', () => commit(E.hideWidget(layout, id), `Switched off ${name}`), { class: 'sds-btn sds-widget-off', title: `Switch ${name} off`, 'aria-label': `Switch ${name} off` })),
    fill[id]());
  };
  return [
    edit && layoutBar(ctx, layout, own, commit),
    h('div', { class: 'sds-body' }, layout.columns.map((ids, col) => h('div', { class: 'sds-col', dataset: { col: String(col) } },
      ids.filter(id => shows[id]).map(id => widget(id, col)),
      edit && h('div', { class: 'sds-col-end', title: 'Drop a widget here', ...target(col, null) })))),
  ];
}

/**
 * Edit mode, above the widgets: Layout applies to: ( ) all star-dots ( ) this star-dot only (in the
 * content set's word), chosen before arranging; then the widgets switched off (+ to switch one back
 * on). "This star-dot only" starts from the layout shown; "all star-dots" drops its own again.
 */
function layoutBar(ctx, layout, own, commit) {
  const scope = (id, label, on, pick) => h('label', { class: 'sds-scope' + (on ? ' on' : '') },
    h('input', { type: 'radio', name: `sds-scope-${ctx.dotId}`, checked: on, dataset: { scope: id }, onchange: () => { if (!on) pick(); } }), ' ', label);
  return h('div', { class: 'sds-layout-bar' },
    h('span', { class: 'sds-scopes', role: 'radiogroup', 'aria-label': 'Layout applies to' },
      h('span', { class: 'sds-muted sds-small' }, 'Layout applies to:'),
      scope('all', 'all star-dots', !own, () => ctx.change(s => E.setDotLayout(s, ctx.dotId, null))),
      !ctx.central && scope('own', 'this star-dot only', !!own, () => ctx.change(s => E.setDotLayout(s, ctx.dotId, E.cleanLayout(layout))))),
    h('span', { class: 'sds-widgets-off' },
      E.hiddenWidgets(layout).map(id => button(`+ ${E.WIDGET_NAMES[id]}`, () => commit(E.showWidget(layout, id), `Switched on ${E.WIDGET_NAMES[id]}`), { class: 'sds-btn sds-widget-on', dataset: { widget: id }, title: 'Switch it back on' }))));
}

/** The checklist; in Edit mode with the strip that adds an item (under Independent there are no children). */
function checklistWidget(ctx) {
  if (!ctx.edit || (independent(ctx.view) && !ctx.central)) return checklist(ctx);
  return h('div', { class: 'sds-check-wrap', dataset: { blank: '' } }, strip(ctx), h('div', { class: 'sds-check-main', dataset: { blank: '' } }, checklist(ctx)));
}

/**
 * The central star's screen: the central star shown as if it were a star-dot. The view is
 * wrapped so that asking about CENTRAL answers with the roll-up of the central star's star-dots.
 */
function centralScreen({ state: st, view, content, edit = false, change, act = () => false, ui = {}, setUi = () => {}, open = () => {}, replace = open, back, backLabel = '← Back', now = Date.now(), remove = null, allow = () => true, setLayout = null }) {
  const star = E.centralStar(st);
  const kids = E.childSlots(st, star.id).map(({ kite, slot }) => st.kites[kite].dots[slot]).filter(Boolean);
  const g = view.group(kids);
  const mine = (id, fn) => (x, ...rest) => (x === CENTRAL ? fn() : view[id](x, ...rest));
  const cview = {
    ...view,
    summary: mine('summary', () => g.summary), support: mine('support', () => g.support), effective: mine('effective', () => g.status),
    own: mine('own', () => g.status), difficulty: mine('difficulty', () => g.difficulty), prop: mine('prop', () => null),
  };
  const dot = { id: CENTRAL, name: content.title || 'The central star', description: '', role: 'check', marks: [], props: {}, notes: star.notes, relations: [], history: [], branch: star.id };
  const sel = kids.includes(ui.item) ? ui.item : null;
  const ctx = { st, view: cview, content, dotId: CENTRAL, dot, kite: null, at: null, retired: null, central: star.id, edit, change, act, ui, setUi, open, replace, now, sel, kids, usable: false, remove, allow: edit ? () => true : allow, setLayout };
  const eff = g.status;
  return h('div', { class: 'sds sds-central' + (edit ? ' sds-edit' : '') },
    h('header', { class: 'sds-header' },
      h('div', { class: 'sds-name' },
        back && button(backLabel, back, { class: 'sds-btn sds-back' }),
        statusStar(eff.status, '#c99a1e'),
        ctx.allow('name') && h('h2', {}, dot.name))),
    body(ctx, groupRelevance));
}

/** The central star's relevance: its star-dots' relations, averaged by category (counted together). */
function groupRelevance({ view, content, kids }) {
  const sums = content.categories.map(() => [0, 0]);
  for (const c of kids) view.relevance(c).forEach(({ avg, count }, ci) => { if (count) { sums[ci][0] += avg * count; sums[ci][1] += count; } });
  return [
    title('Relevance Information'),
    h('p', { class: 'sds-muted sds-small' }, 'Its star-dots’ relations, averaged by the related star-dot’s category. Relations are added on each star-dot’s own screen.'),
    h('div', { class: 'sds-averages' }, content.categories.map((c, i) => h('span', { class: 'sds-avg' },
      h('span', { class: 'sds-swatch', style: { background: c.color } }), ' ', c.name, ' ',
      h('strong', {}, sums[i][1] ? (sums[i][0] / sums[i][1]).toFixed(1) : '—'),
      sums[i][1] > 0 && h('span', { class: 'sds-muted' }, ` (${sums[i][1]})`)))),
  ];
}

// ---- Pieces ----------------------------------------------------------------------------------

const title = text => h('h3', { class: 'sds-title' }, text);
const button = (label, onclick, props = {}) => h('button', { type: 'button', class: 'sds-btn', onclick, ...props }, label);
const catColor = (content, c) => (c == null ? 'transparent' : content.categories[c].color);
const property = (content, id) => content.properties.find(p => p.id === id);
const choiceName = (content, id, v) => property(content, id)?.choices?.find(c => c.id === v)?.name;
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;

/** "Career › Interview Prep": a dot's kite (else its parent, round 5) and name ("Shelf › …" when it's on the shelf). */
function dotPath(st, d) {
  const at = E.index(st).dot.get(d);
  const parent = E.parentOf(st, d);
  return `${at ? st.kites[at.kite].name || (parent && st.dots[parent].name) || 'Kite' : 'Shelf'} › ${st.dots[d].name || 'unnamed'}`;
}

/** "Central star" or "Interview Prep’s star". */
function starName(st, starId) {
  const s = st.stars[starId];
  return s.sources.length ? `${st.dots[s.sources[0]]?.name || 'An unnamed star-dot'}’s star` : 'Central star';
}

const kiteName = (st, starId, k) => st.kites[st.stars[starId].kites[k]].name || (k === E.BACK ? 'Back kite' : `Kite ${k + 1}`);

function money(v) {
  if (!v) return '—';
  return `${dollars(v.amount)} ${PERIOD_NAMES[v.period]}`;
}

/** The status star: outline (not started), half (in training) or filled (ignited), in the kite's color. */
function statusStar(status, color, size = 28) {
  const c = size / 2;
  return svg('svg', { class: 'sds-star', width: size, height: size, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' },
    svg('polygon', { points: svgPoints(miniStar(c, c, size * 0.24)), class: 'sds-star-outline', style: status === 'ignited' ? { fill: color } : null }),
    status === 'training' && svg('polygon', { points: svgPoints(halfStar(c, c, size * 0.24)), style: { fill: color } }));
}

/**
 * A checklist bullet: box or circle (its own role), its border by Difficulty (a child with
 * children: their highest, T6); `fill` true or 'done' when complete, 'half' while in training.
 */
const BORDERS = { easy: '', medium: ' thick', hard: ' double' };
const bullet = (role, difficulty, fill = false) =>
  h('span', { class: `sds-bullet ${role === 'assess' ? 'box' : 'circle'}${difficulty ? BORDERS[difficulty] ?? '' : ' unset'}${fill === 'half' ? ' half' : fill ? ' done' : ''}` });
const FILL = { ignited: 'done', training: 'half', open: '' };

/**
 * A value edited by clicking it: click → the next value, Shift-click → the previous one, wrapping
 * (through unset, —, when `unset`); hovering lists every value with the current one marked.
 */
function cycler({ values, value, name, onChange, unset = true, label = name(value) }) {
  const list = unset ? [null, ...values] : values;
  const at = list.indexOf(value);
  const n = list.length;
  return h('button', {
    type: 'button', class: 'sds-cycle',
    title: [...list.map(v => `${v === value ? '●' : '○'} ${name(v)}`), 'Click: next · Shift-click: back'].join('\n'),
    onclick: e => onChange(list[(at + (e.shiftKey ? -1 : 1) + n) % n]),
  }, label);
}

/**
 * Every option grouped (groups: [{ label, color?, options: [{ label, onPick }] }]), with a search
 * box that hides non-matching ones in place (no rebuild, so the box keeps focus).
 */
function searchList(groups, { placeholder = 'Search…', empty = 'Nothing to choose.', onClose } = {}) {
  const list = h('div', { class: 'sds-picker-list' }, groups.map(g => h('div', { class: 'sds-picker-group' },
    h('div', { class: 'sds-picker-cat' }, g.color && h('span', { class: 'sds-swatch', style: { background: g.color } }), g.color && ' ', g.label),
    g.options.map(o => button(o.label, o.onPick, { class: 'sds-btn sds-picker-option', dataset: { text: `${o.label} ${g.label}`.toLowerCase() } })))));
  const search = h('input', {
    type: 'search', class: 'sds-input', placeholder,
    oninput: e => {
      const q = e.target.value.trim().toLowerCase();
      for (const g of list.children) {
        let any = false;
        for (const b of g.querySelectorAll('.sds-picker-option')) {
          b.hidden = !!q && !b.dataset.text.includes(q);
          any ||= !b.hidden;
        }
        g.hidden = !any;
      }
    },
  });
  return h('div', { class: 'sds-picker' },
    h('div', { class: 'sds-picker-head' }, search, onClose && button('Close', onClose)),
    groups.length ? list : h('p', { class: 'sds-muted' }, empty));
}

/** Every placed star-dot except those in `skip`, grouped by category (for relations and merging). */
function dotGroups({ st, view, content }, skip, onPick) {
  const options = Object.values(st.dots)
    .filter(d => !skip.has(d.id) && E.index(st).dot.has(d.id))
    .map(d => ({ id: d.id, cat: view.categoryOf(d.id), label: dotPath(st, d.id), onPick: () => onPick(d.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return content.categories.map((c, ci) => ({ label: c.name, color: c.color, options: options.filter(o => o.cat === ci) })).filter(g => g.options.length);
}

// ---- Header ----------------------------------------------------------------------------------

function header(ctx, back, backLabel) {
  const { st, view, content, dotId, dot, kite, at, edit, change, ui, setUi } = ctx;
  const eff = view.effective(dotId);
  return h('header', { class: 'sds-header' },
    h('div', { class: 'sds-name' },
      back && button(backLabel, back, { class: 'sds-btn sds-back' }),
      statusStar(eff.status, catColor(content, kite?.color)),
      (edit || ctx.allow('name')) && h('h2', {}, edit
        ? editableText({ value: dot.name, placeholder: 'Name this star-dot', onCommit: v => change(s => E.updateDot(s, dotId, { name: v })) })
        : dot.name || 'Unnamed star-dot')),
    h('div', { class: 'sds-summary' },
      h('div', { class: 'sds-line sds-header-tools' },
        deployButton(ctx),
        // Retire, as on PLAY's card: a star-dot on the map, not under Independent (the host leaves `retire` out while PLAY is locked).
        ctx.retire && at && !ctx.central && !E.independentOn(view.opts) && button('Retire', () => ctx.retire(dotId), { title: 'Take it off the map, with its star and children, into the Retired bank (undoable; restore it from there, on PLAY or MATERIALS)' }),
        edit && button('Merge into…', () => setUi({ merge: ui.merge ? null : 'pick' }), { title: 'Merge this star-dot into another one', 'aria-pressed': String(!!ui.merge) }),
        edit && ctx.remove && button('Delete…', () => ctx.remove(dotId), { title: 'Delete it for good, with its star and everything on it (asks first; undoable)' })),
      dot.history.length > 0 && history(dot.history),
      ctx.allow('description') && h('div', { class: 'sds-description' }, edit
        ? editableText({ value: dot.description, multiline: true, placeholder: 'Double-click to add a description', onCommit: v => change(s => E.updateDot(s, dotId, { description: v })) })
        : dot.description)));   // No description: blank
}

/** Where it has been (most recent first): "Moved from Career › Interview Prep’s star (Oct 27)"; no effect on rules. */
function history(entries) {
  const MAX = 3;
  const text = e => `${e.text}${Number.isFinite(e.at) && e.at > 0 ? ` (${shortDate(e.at)})` : ''}`;
  return h('div', { class: 'sds-line sds-muted sds-history', title: entries.map(text).join('\n') },
    entries.slice(0, MAX).map(text).join(' · '), entries.length > MAX && ` · +${entries.length - MAX} earlier`);
}

/** What this star-dot deploys, or why not; at an open Zenith without a star, Deploy its star. */
/** Deploy its star or Withdraw its star, where it can (no explanation: the map shows where stars go). */
function deployButton(ctx) {
  const { st, view, dotId, dot, at, act } = ctx;
  const b = dot.branch && st.stars[dot.branch];
  const name = dot.name || 'the star-dot';
  if (b && b.deployed) return button('Withdraw its star', () => act((state, options) => E.withdrawStar(state, dotId, options), E.independentOn(view.opts) ? null : `Withdrew ${name}’s star`), { title: 'Take it off the map: it stays planned, with everything on it' });
  if (!at || at.slot !== E.ZENITH || !view.kiteOpen(at.kite) || view.opts.deploy === 'auto' || E.deployStar(st, dotId, view.opts).problem) return null;
  return button('Deploy its star', () => act((state, options) => E.deployStar(state, dotId, options), E.independentOn(view.opts) ? null : `Deployed ${name}’s star`), { title: 'Put its star on the map' });   // Independent: quietly
}

// ---- Merge into another star-dot -------------------------------------------------------------

function mergePanel(ctx) {
  const { st, dotId, dot, ui, setUi, act, replace } = ctx;
  const close = () => setUi({ merge: null });
  const name = d => `“${st.dots[d].name || 'unnamed'}”`;
  if (ui.merge === 'pick' || !st.dots[ui.merge]) {
    // Not into itself, nor into a star-dot inside its own branch.
    const branch = dot.branch && st.stars[dot.branch] ? new Set([dot.branch, ...E.descendants(st, dot.branch)]) : new Set();
    const skip = new Set([dotId, ...Object.keys(st.dots).filter(d => branch.has(E.starOfDot(st, d)))]);
    return h('div', { class: 'sds-panel' },
      h('div', { class: 'sds-head' }, title(`Merge ${name(dotId)} into…`)),
      searchList(dotGroups(ctx, skip, d => setUi({ merge: d })), { placeholder: 'Search star-dots…', empty: 'No other star-dots to merge into.', onClose: close }));
  }
  const into = ui.merge;
  const target = st.dots[into];
  const pointing = Object.values(st.dots).filter(d => d.id !== dotId && d.id !== into && d.relations.some(r => r.dot === dotId)).length;
  const hasStar = dot.branch && st.stars[dot.branch];
  const moves = [
    dot.notes.length ? `${plural(dot.notes.length, 'note')} move to the end of ${name(into)}’s notes.` : null,
    dot.relations.length ? `${plural(dot.relations.length, 'relation')} join ${name(into)}’s; a relation both have keeps the higher score, with both How? notes.` : null,
    pointing ? `${plural(pointing, 'other star-dot')} relating to it now relate to ${name(into)}.` : null,
    hasStar && (target.branch && st.stars[target.branch]
      ? `Its star (with its children and their branches) goes to the shelf: ${name(into)} already has one.`
      : `Its star (with its children and their branches) now belongs to ${name(into)}, where its kite faces.`),
    `Its name and description are added to ${name(into)}’s description; then ${name(dotId)} is deleted and its slot empties.`,
  ].filter(Boolean);
  const merge = () => {
    if (act((s, o) => E.mergeDots(s, dotId, into, o), `Merged ${name(dotId)} into ${name(into)}`)) replace(into);
  };
  return h('div', { class: 'sds-panel' },
    h('div', { class: 'sds-head' }, title(`Merge ${name(dotId)} into ${name(into)}?`)),
    h('ul', { class: 'sds-list' }, moves.map(m => h('li', {}, m))),
    h('div', { class: 'sds-buttons' },
      button('Merge', merge, { class: 'sds-btn sds-primary' }),
      button('Choose another', () => setUi({ merge: 'pick' })),
      button('Cancel', close)));
}

// ---- The kinds of item: Filter ▾ and the strip that adds ---------------------------------------

/** The kinds of item, in order: bullet type, Difficulty border, derived marks, then the content set’s free marks. */
/**
 * The checklist's kinds of item: each filters the checklist (Filter ▾), and, in Edit mode, adds an
 * item with that attribute set (`add`: the change, and the attribute field to highlight on it).
 */
function filters({ content, view }) {
  const has = (c, id, tones) => view.marks(c).some(m => m.id === id && (!tones || tones.includes(m.tone)));
  const mark = (symbol, tone) => h('span', { class: `sds-mark ${tone}` }, symbol);
  const levels = property(content, 'difficulty')?.choices ?? [];
  const kinds = !questionsOn(view);   // With Quiz mode on every item is a question
  const travelChoice = (view.opts?.travel ?? []).find(id => property(content, 'environment')?.choices?.some(c => c.id === id));
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return [
    { id: 'box', title: 'Needs assessment', icon: bullet('assess', 'easy'), test: (t) => t.role === 'assess', add: kinds && { patch: { role: 'assess' }, field: 'kind' } },
    { id: 'circle', title: 'Click to complete', icon: bullet('check', 'easy'), test: (t) => t.role === 'check', add: kinds && { patch: { role: 'check' }, field: 'kind' } },
    ...levels.map(c => ({ id: c.id, title: `${c.name} (border)`, icon: bullet('check', c.id), test: (t) => view.difficulty(t.id) === c.id, add: { patch: { props: { difficulty: c.id } }, field: 'difficulty' } })),
    { id: 'earn', title: 'Earns money', icon: mark(SYMBOLS.finance, 'earn'), test: (t) => has(t.id, 'finance', ['earn']), add: { patch: { props: { finance: { amount: 1, period: 'once' } } }, field: 'finance' } },
    { id: 'cost', title: 'Costs money', icon: mark(SYMBOLS.finance, 'cost'), test: (t) => has(t.id, 'finance', ['cost']), add: { patch: { props: { finance: { amount: -1, period: 'once' } } }, field: 'finance' } },
    { id: 'travel', title: 'Needs travel', icon: SYMBOLS.travel, test: (t) => has(t.id, 'travel', ['plain']), add: travelChoice && { patch: { props: { environment: travelChoice } }, field: 'environment' } },
    { id: 'due', title: 'Has a due date', icon: SYMBOLS.due, test: (t) => has(t.id, 'due', ['due', 'overdue']), add: { patch: { props: { due: today } }, field: 'due' } },
    ...content.marks.map(m => ({ id: m.id, title: m.name, icon: m.symbol, mark: true, test: (t) => t.marks.includes(m.id), add: { patch: { marks: [m.id] }, field: 'marks' } })),
  ];
}

/** Edit mode: the checklist's left strip: ＋ adds a star-dot; each symbol adds one with that attribute set. */
function strip(ctx) {
  const plain = { id: 'plain', title: 'Add a star-dot', icon: '＋', add: { patch: {}, field: null } };
  return h('nav', { class: 'sds-strip', 'aria-label': 'Add a star-dot' },
    [plain, ...filters(ctx).filter(f => f.add)].map(f => h('button', {
      type: 'button', class: 'sds-strip-btn' + (typeof f.icon === 'string' ? ' mark' : '') + (f === plain ? ' plain' : ''),
      title: f === plain ? f.title : `Add a star-dot: ${f.title}`, 'aria-label': f === plain ? f.title : `Add a star-dot: ${f.title}`,
      dataset: { add: f.id }, onclick: () => addWith(ctx, f),
    }, f.icon)));
}

/** A new, unnamed item in the next free slot with `f`'s attribute set; selected, the attribute highlighted. */
function addWith(ctx, f) {
  const { dotId, view, change, setUi } = ctx;
  let made = null;
  change(s => {
    const before = new Set(Object.keys(s.dots));
    let next;
    if (ctx.central) {
      const free = E.childSlots(s, ctx.central, view.opts).find(x => !s.kites[x.kite].dots[x.slot]);
      if (!free) return s;
      next = E.placeDot(s, free.kite, free.slot, '')[0];
    } else {
      const r = E.addChild(s, dotId, '', { options: view.opts });
      if (r.problem) return s;
      next = r.state;
    }
    made = Object.keys(next.dots).find(d => !before.has(d)) ?? null;
    return made ? E.updateDot(next, made, f.add.patch) : s;
  });
  if (made) setUi({ item: made, hl: f.add.field, filter: null, slots: null });
}

/** The checklist's search text per screen, kept outside the state so typing never redraws. */
const queries = new Map();
const matches = (name, q) => !q.trim() || (name ?? '').toLowerCase().includes(q.trim().toLowerCase());

/** Filter ▾: a search box (it hides rows in place, keeping focus) and the kinds of item. */
function filterDrop(ctx, list) {
  const { ui, setUi, dotId } = ctx;
  const on = list.find(f => f.id === ui.filter);
  const q = queries.get(dotId) ?? '';
  const search = h('input', {
    type: 'search', class: 'sds-input sds-filter-search', placeholder: 'Search items…', 'aria-label': 'Search the checklist', value: q,
    oninput: e => {
      const v = e.target.value;
      queries.set(dotId, v);
      for (const li of e.target.closest?.('.sds-checklist')?.querySelectorAll?.('.sds-item') ?? []) li.hidden = !matches(li.dataset.name, v);
    },
  });
  return h('details', { class: 'sds-filter-drop' + (on || q.trim() ? ' on' : '') },
    h('summary', { class: 'sds-btn sds-filter-btn', title: 'Filter the checklist' }, on ? `Filter: ${on.title}` : q.trim() ? 'Filter: search' : 'Filter ▾'),
    h('div', { class: 'sds-filter-menu' },
      search,
      list.map(f => button(h('span', {}, h('span', { class: 'sds-filter-icon' + (typeof f.icon === 'string' ? ' mark' : '') }, f.icon), ' ', f.title), () => setUi({ filter: ui.filter === f.id ? null : f.id }), {
        class: 'sds-btn sds-filter-option' + (ui.filter === f.id ? ' on' : ''), dataset: { filter: f.id }, 'aria-pressed': String(ui.filter === f.id),
      }))));
}

// ---- Checklist -------------------------------------------------------------------------------

function checklist(ctx) {
  const { st, dot, dotId, view, content, edit, change, setUi, open, now, usable, sel, kids, ui } = ctx;
  const kinds = filters(ctx);
  const filter = kinds.find(f => f.id === ui.filter);
  const q = queries.get(dotId) ?? '';
  const rows = kids.filter(c => !filter || filter.test(st.dots[c]));
  const markTitle = (m, c) => {
    if (m.tone === 'reminder') return 'Set this attribute to replace the old mark';
    if (m.id === 'finance') return money(view.prop(c, 'finance'));
    if (m.id === 'travel') return choiceName(content, 'environment', view.prop(c, 'environment'));
    if (m.id === 'due') return `Due ${shortDate(view.prop(c, 'due'))}${m.tone === 'overdue' ? ' (overdue)' : ''}`;
    return content.marks.find(x => x.id === m.id)?.name ?? '';
  };
  const marks = c => view.marks(c).flatMap(m => {
    const symbol = SYMBOLS[m.id] ?? content.marks.find(x => x.id === m.id)?.symbol;
    return symbol ? [h('span', { class: `sds-mark ${m.tone}`, title: markTitle(m, c) }, symbol)] : [];
  });
  const select = c => e => { if (!(e.detail > 1)) setUi({ item: sel === c ? null : c, slots: null, hl: null }); };
  const row = c => {
    const t = st.dots[c];
    const grand = view.support(c);   // it has children of its own: its bullet shows theirs
    const status = view.effective(c).status;
    const fresh = grand ? status === 'ignited' : view.fresh(c);
    const stale = !grand && t.ignitedAt != null && !fresh;
    const retrain = property(content, 'persistence')?.choices?.find(x => x.id === view.prop(c, 'persistence'));
    const role = roleOf(view, t);
    const onBullet = grand ? () => open(c)
      : role === 'check' ? () => view.completable(c) && change(s => E.checkDot(s, c, !fresh, now))
        : () => setUi({ item: c });
    return h('li', { class: 'sds-item' + (stale ? ' stale' : '') + (fresh ? ' done' : '') + (sel === c ? ' selected' : ''), hidden: !matches(t.name, q), dataset: { blank: '', child: c, name: t.name }, ...(edit && dragProps(ctx, c)) },
      h('div', { class: 'sds-item-row', dataset: { blank: '' } },
        h('button', {
          type: 'button', class: 'sds-bullet-btn', disabled: !grand && role === 'check' && !view.completable(c),
          title: grand ? `${STATUS[status]}: its children decide · open it` : role === 'check' ? (fresh ? 'Mark not complete' : 'Mark complete') : 'Select it for the Assessor (its questions)',
          onclick: onBullet,
        }, bullet(role, view.difficulty(c), grand ? FILL[status] : fresh || (role === 'assess' && t.trained ? 'half' : false))),   // Half-way through its set
        h('span', { class: 'sds-retrain', title: retrain?.days ? `Retrain ${retrain.name.toLowerCase()}` : '' }, retrain?.days ? retrain.name[0] : ''),
        marks(c).length > 0 && h('span', { class: 'sds-marks' }, '(', marks(c), ')'),
        h('span', { class: 'sds-item-text', title: sel === c ? 'Click to deselect' : 'Click to select', onclick: select(c) }, edit
          ? editableText({ value: t.name, placeholder: 'Unnamed', onCommit: v => change(s => E.updateDot(s, c, { name: v })) })
          : t.name || h('span', { class: 'sds-muted' }, 'Unnamed')),
        grand && h('span', { class: 'sds-muted sds-small' }, `${grand.ignited}/${grand.total}`),
        stale && h('span', { class: 'sds-tag' }, 'stale'),
        button('Open ›', () => open(c), { class: 'sds-link sds-child', title: 'Open its own screen' }),
        edit && itemTools(ctx, c)));
  };
  const own = view.own(dotId).status;
  const support = view.support(dotId);
  return [
    h('div', { class: 'sds-head', dataset: { blank: '' } }, title('Checklist'),
      kids.length > 0 && filterDrop(ctx, kinds),
      kids.length > 0 && h('span', { class: 'sds-buttons sds-views', role: 'group', 'aria-label': 'Checklist or table' },
        [['list', 'Checklist'], ['table', 'Table']].map(([id, label]) => button(label, () => setUi({ view: id === 'list' ? null : id }), {
          class: 'sds-btn sds-seg-btn' + ((ui.view ?? 'list') === id ? ' on' : ''), 'aria-pressed': String((ui.view ?? 'list') === id),
        }))),
      !kids.length && !ctx.central && h('span', { class: 'sds-buttons' },
        button('Ignite', () => change(s => E.ignite(s, dotId, now)), { disabled: own === 'ignited' || !usable || view.insideFirst(dotId), title: 'Override: complete it now' }),
        button('Lapse', () => change(s => E.lapse(s, dotId)), { disabled: own !== 'ignited', title: 'Undo its completion' }))),
    support && h('p', { class: 'sds-muted sds-small' }, `${support.ignited} of ${support.total} complete; it ignites at ${support.share}%.`),
    !usable && !ctx.central && h('p', { class: 'sds-muted sds-small' }, 'This kite is locked: it opens when a neighboring open kite has two ignited star-dots.'),
    view.insideFirst(dotId) && h('p', { class: 'sds-muted sds-small sds-inside-first' }, 'A Zenith: it can be completed once the star-dots inside it are.'),
    filter && h('p', { class: 'sds-muted sds-small' }, `Showing: ${filter.title.toLowerCase()} · `, button('Show all', () => setUi({ filter: null }), { class: 'sds-link' })),
    !rows.length ? h('p', { class: 'sds-muted' }, kids.length ? 'No children match this filter.' : independent(view) && !ctx.central ? 'Independent: each star-dot stands alone, with no children.' : 'No children yet.')
      : ui.view === 'table' ? childTable(ctx, rows.filter(c => matches(st.dots[c].name, q)))
        : h('ul', { class: 'sds-items', dataset: { blank: '' } }, rows.map(row)),
    edit && kids.length > 1 && ui.view !== 'table' && h('p', { class: 'sds-muted sds-small sds-drag-hint' }, 'Drag a row onto another to swap their places, or select a row and use ↑ ↓.'),
    edit && !independent(view) && addChildForm(ctx),
    edit && !independent(view) && ui.slots === 'add' && slotPicker(ctx, {
      title: 'Where the new child goes',
      onPick: (k, slot) => setUi({ slot: { k, slot }, slots: null }),
    }),
  ];
}

/** "Add a child…": into the next free slot of its star, or the slot chosen with the picker. */
function addChildForm(ctx) {
  const { st, dot, dotId, change, ui, setUi } = ctx;
  const star = dot.branch && st.stars[dot.branch] ? dot.branch : null;
  const target = ui.slot && (!star || !st.kites[st.stars[star].kites[ui.slot.k]].dots[ui.slot.slot]) ? ui.slot : null;
  const add = name => {
    change(s => {
      if (ctx.central) {   // the central star's screen: into its next free slot, or the chosen one
        const free = E.childSlots(s, ctx.central, ctx.view.opts).filter(x => !s.kites[x.kite].dots[x.slot]);
        const at = target ? { kite: s.stars[ctx.central].kites[target.k], slot: target.slot } : free[0];
        return at && !s.kites[at.kite].dots[at.slot] ? E.placeDot(s, at.kite, at.slot, name)[0] : s;
      }
      if (!target) return E.addChild(s, dotId, name, { options: ctx.view.opts }).state;
      const [next, starId] = E.planStar(s, dotId);
      return E.addChild(next, dotId, name, { target: { kite: next.stars[starId].kites[target.k], slot: target.slot }, options: ctx.view.opts }).state;
    });
    if (target) setUi({ slot: null });
  };
  return h('div', { class: 'sds-add-child' },
    addForm('Add a child…', add),
    h('div', { class: 'sds-small sds-muted' },
      target ? `Goes to ${slotLabel(ctx, star, target.k, target.slot)} · ` : 'Goes to the next free slot of its star · ',
      button(ui.slots === 'add' ? 'Close' : 'Choose a slot…', () => setUi({ slots: ui.slots === 'add' ? null : 'add' }), { class: 'sds-link' }),
      target && [' · ', button('Next free slot', () => setUi({ slot: null }), { class: 'sds-link' })]));
}

/** "Back kite › Port": a slot of a star-dot's star (or of the star it would plan: "Back kite", "Kite 2"…). */
function slotLabel({ st, content }, star, k, slot) {
  const kiteId = star && st.stars[star].kites[k];
  const kiteText = star ? kiteName(st, star, k) : k === E.BACK ? 'Back kite' : `Kite ${k + 1}`;
  return `${kiteText} › ${(kiteId && st.kites[kiteId].labels[slot]) || content.dotNames[slot]}`;
}

/**
 * The slots of this star-dot's star (or the star it would plan), kites in fill order: free
 * slots always pickable, taken ones only when `taken` is true (for moving a child: a swap).
 */
function slotPicker(ctx, { title: heading, onPick, taken = false, current = null }) {
  const { st, view, dot, content, setUi } = ctx;
  const star = dot.branch && st.stars[dot.branch] ? dot.branch : null;
  const at = (k, slot) => (star ? st.kites[st.stars[star].kites[k]].dots[slot] : null);
  // A kite-less star's spokes offer only the per-star count's rings (and slots already holding a star-dot).
  const offered = star ? view.usableSlots(star) : E.createdSlots(view.opts);
  return h('div', { class: 'sds-panel sds-slot-picker' },
    h('div', { class: 'sds-head' }, title(heading), button('Cancel', () => setUi({ slots: null }))),
    !star && h('p', { class: 'sds-muted sds-small' }, 'Its star is planned when the first child is added.'),
    h('div', { class: 'sds-slots' }, E.CHILD_KITES.map(k => h('div', { class: 'sds-slot-kite' },
      h('span', { class: 'sds-muted sds-small' }, slotLabel(ctx, star, k, 0).split(' › ')[0]),
      [0, 1, 2, 3].filter(slot => offered.includes(slot) || at(k, slot)).map(slot => {
        const d = at(k, slot);
        const name = (star && st.kites[st.stars[star].kites[k]].labels[slot]) || content.dotNames[slot];
        return button(d ? `${name}: ${st.dots[d].name || 'unnamed'}` : name, () => onPick(k, slot), {
          class: 'sds-btn sds-slot' + (d ? ' taken' : '') + (d && d === current ? ' current' : ''),
          disabled: (!!d && !taken) || (!!d && d === current), title: d ? (taken ? 'Swap places with it' : 'Taken') : 'Free',
        });
      })))));
}

/** Drag a row onto another to swap their slots; the source is kept here, not in the view state, so nothing re-renders mid-drag. */
let dragFrom = null;
function dragProps({ st, act }, c) {
  const slotOf = d => ({ ...E.index(st).dot.get(d) });
  const mark = (e, on) => e.currentTarget?.classList?.toggle('sds-drop', on);
  return {
    draggable: 'true',
    ondragstart: e => { dragFrom = c; e.dataTransfer?.setData?.('text/plain', c); e.currentTarget?.classList?.add('sds-dragging'); },
    ondragend: e => { dragFrom = null; e.currentTarget?.classList?.remove('sds-dragging'); },
    ondragover: e => { if (dragFrom && dragFrom !== c) { e.preventDefault(); mark(e, true); } },
    ondragleave: e => mark(e, false),
    ondrop: e => {
      e.preventDefault();
      mark(e, false);
      const from = dragFrom;
      dragFrom = null;
      if (from && from !== c && st.dots[from]) act((s, o) => E.swapDots(s, slotOf(from), slotOf(c), o), `Swapped ${st.dots[from].name || 'a child'} and ${st.dots[c].name || 'a child'}`);
    },
  };
}

// ---- Notes ---------------------------------------------------------------------------

/** Free lines kept on this star-dot, separate from its children: never completed or counted. */
function notes({ dot, dotId, edit: authoring, change, central, allow }) {
  if (!allow('notesRead') && !allow('notesWrite')) return null;
  const edit = authoring || allow('notesWrite');   // The player may write notes when given
  // The central star's screen keeps the general notes (the central star's own, V7).
  const [add, editOne, removeOne] = central
    ? [v => s => E.addNote(s, central, v), (i, v) => s => E.editNote(s, central, i, v), i => s => E.removeNote(s, central, i)]
    : [v => s => E.addDotNote(s, dotId, v), (i, v) => s => E.editDotNote(s, dotId, i, v), i => s => E.removeDotNote(s, dotId, i)];
  return h('div', { class: 'sds-notes' },
    h('div', { class: 'sds-head' }, title(central ? 'Notes · general' : 'Notes')),
    dot.notes.length
      ? h('ul', { class: 'sds-note-list' }, dot.notes.map((n, i) => h('li', {},
        edit ? editableText({ value: n, multiline: true, placeholder: 'Empty note', onCommit: v => change(editOne(i, v)) }) : n,
        edit && removeButton(() => change(removeOne(i)), 'Remove note'))))
      : h('p', { class: 'sds-muted sds-small' }, 'No notes.'),
    edit && addForm('Add a note…', v => change(add(v))));
}

/** The children as a table: their name (opens their screen), then one of three column sets. */
function childTable(ctx, rows) {
  const { st, view, content, ui, setUi, open } = ctx;
  const set = ui.cols ?? 'status';
  const prop = id => property(content, id);
  const sum = (c, items = true) => attributeSummary(view, content, st.dots[c], { items });
  const columns = {
    status: [
      ['Status', c => h('span', { class: `sds-status ${view.effective(c).status}` }, STATUS[view.effective(c).status])],
      ['Children done', c => { const s = view.support(c); return s ? `${s.ignited} / ${s.total}` : '—'; }],
      [prop('persistence')?.name ?? 'Retrain', c => sum(c, false).persistence],
      [prop('due')?.name ?? 'Due', c => sum(c, false).due],
    ],
    attributes: ['difficulty', 'finance', 'environment'].filter(prop).map(id => [prop(id).name, c => sum(c)[id]]),
    relevance: content.categories.map((cat, ci) => [cat.name, c => {
      const r = view.relevance(c)[ci];
      return h('span', {
        class: 'sds-score-cell', style: { background: r.count ? cellFill(cat.color, Math.round(r.avg)) : null },
        title: r.count ? `${cat.name}: average ${r.avg.toFixed(1)} of ${plural(r.count, 'relation')}` : `${cat.name}: no relations`,
      }, r.count ? r.avg.toFixed(1) : '—');
    }, cat.color]),
  }[set];
  return h('div', { class: 'sds-table-wrap' },
    h('span', { class: 'sds-buttons sds-cols', role: 'group', 'aria-label': 'Columns' },
      [['status', 'Status'], ['attributes', 'Attributes'], ['relevance', 'Relevance']].map(([id, label]) => button(label, () => setUi({ cols: id }), {
        class: 'sds-btn sds-seg-btn' + (set === id ? ' on' : ''), 'aria-pressed': String(set === id),
      }))),
    h('table', { class: 'sds-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Child'), columns.map(([name, , color]) => h('th', { style: color ? { color } : null }, name)))),
      h('tbody', {}, rows.map(c => h('tr', { class: 'sds-table-row', dataset: { child: c } },
        h('td', {}, button(st.dots[c].name || 'Unnamed', () => open(c), { class: 'sds-link', title: 'Open its own screen' })),
        columns.map(([, cell]) => h('td', {}, cell(c))))))));
}

/** Authoring controls on a child's row: order (it swaps slots with its neighbor) and remove. */
function itemTools(ctx, c) {
  const { st, kids, change, act, setUi, sel } = ctx;
  const i = kids.indexOf(c);
  const slotOf = d => ({ ...E.index(st).dot.get(d) });
  // Moves can be refused (a child's star would land on another star): act shows why.
  const swap = j => act((s, o) => E.swapDots(s, slotOf(c), slotOf(kids[j]), o), `Moved ${st.dots[c].name || 'the child'} ${j < i ? 'up' : 'down'}`);
  const remove = () => {
    if (ctx.remove) ctx.remove(c);   // the host confirms and deletes it with its branch
    else change(s => E.removeDot(s, c));
    if (sel === c) setUi({ item: null });
  };
  return h('span', { class: 'sds-tools' },
    button('↑', () => swap(i - 1), { disabled: i <= 0, title: 'Move up' }),
    button('↓', () => swap(i + 1), { disabled: i === kids.length - 1, title: 'Move down' }),
    removeButton(remove, 'Remove this child'));
}

/** A one-line form: text input + Add; Enter submits. */
function addForm(placeholder, onSubmit) {
  const input = h('input', { type: 'text', class: 'sds-input', placeholder });
  return h('form', { class: 'sds-add', onsubmit: e => {
    e.preventDefault();
    if (input.value.trim()) onSubmit(input.value.trim());
  } }, input, h('button', { type: 'submit', class: 'sds-btn' }, 'Add'));
}

// ---- Attributes ------------------------------------------------------------------------------

function attributes(ctx) {
  const { sel, ui, kids } = ctx;
  if (sel != null) return childAttributes(ctx, sel);
  if (ctx.central) return kids.length ? summary(ctx) : [title('Attributes'), h('p', { class: 'sds-muted' }, 'No star-dots yet.')];
  if (ui.item === 'defaults' || !kids.length) return defaults(ctx);
  return summary(ctx);
}

/** One attribute: its name and value; `hl` highlights it (a new item's attribute, to fill in). */
const attrRow = (name, value, hl = false) => h('div', { class: 'sds-attr' + (hl ? ' sds-attr-hl' : '') }, h('span', { class: 'sds-attr-name' }, name), h('span', { class: 'sds-attr-value' }, value));
/** Whether attribute `id` is the one just set on a new item (addWith), shown selected. */
const lit = (ctx, id) => !!ctx.ui?.hl && ctx.ui.hl === id && ctx.sel != null && ctx.sel === ctx.ui.item;

/**
 * One row per attribute: `own` values (a star-dot's), `inherited(p)` the value it takes from its
 * parent where it has none (not for Financial Influence); editable in DISSECT STAR.
 */
function valueRows(ctx, own, inherited, set) {
  const { content, edit, allow } = ctx;
  return content.properties.filter(p => (p.id === 'due' ? allow('due') : allow('attributes'))).map(p => {
    const value = own[p.id] ?? null;
    const base = E.INHERITED.includes(p.id) ? inherited(p.id) ?? null : null;
    const text = v => (p.kind === 'amount' ? money(v) : p.kind === 'date' ? (v ? shortDate(v) : '—') : p.choices.find(c => c.id === v)?.name ?? '—');
    const inheritedText = value == null && base != null && h('span', { class: 'sds-inherited', title: 'Its parent’s value, used while it has none of its own' }, `${text(base)} (inherited)`);
    let control;
    if (!edit) control = inheritedText || text(value);
    else if (p.kind === 'amount') control = [financeEditor(value, v => set(p.id, v)), inheritedText];
    else if (p.kind === 'date') control = [h('input', { type: 'date', class: 'sds-input', value: value ?? '', onchange: e => set(p.id, e.target.value || null) }), inheritedText];
    else control = cycler({ values: p.choices.map(c => c.id), value, name: v => p.choices.find(c => c.id === v)?.name ?? '—', onChange: v => set(p.id, v), label: value == null && inheritedText ? inheritedText : text(value) });
    return attrRow(p.name, control, lit(ctx, p.id));
  });
}

/** Kind and free marks of a star-dot (its bullet and its marks in its parent's checklist). */
function kindRows(ctx, d) {
  const { content, view, edit, change, allow } = ctx;
  if (!allow('attributes')) return [];
  const t = d;
  const update = patch => change(s => E.updateDot(s, d.id, patch));
  return [
    attrRow('Kind', edit
      && !questionsOn(view) ? cycler({ values: E.ROLES, value: t.role, unset: false, name: r => ROLE_NAMES[r], onChange: role => update({ role }) })
      : questionsOn(view) ? '□ A question (every star-dot is one)' : ROLE_NAMES[t.role], lit(ctx, 'kind')),
    content.marks.length > 0 && attrRow('Marks', edit
      ? content.marks.map(m => button(m.symbol, () => update({ marks: t.marks.includes(m.id) ? t.marks.filter(x => x !== m.id) : [...t.marks, m.id] }),
        { class: 'sds-btn sds-mark-btn' + (t.marks.includes(m.id) ? ' on' : ''), title: m.name, 'aria-pressed': String(t.marks.includes(m.id)) }))
      : content.marks.filter(m => t.marks.includes(m.id)).map(m => m.symbol).join(' ') || '—', lit(ctx, 'marks')),
  ];
}

/** The selected child: its own attributes (inherited ones filling the rest), kind and free marks. */
function childAttributes(ctx, c) {
  const { st, view, dotId, change, act, setUi, open } = ctx;
  const t = st.dots[c];
  return [
    h('div', { class: 'sds-head' }, title('Attributes · child'), button('Show summary', () => setUi({ item: null, slots: null }), { class: 'sds-link' })),
    h('p', { class: 'sds-selected-item' }, button(t.name || 'Unnamed', () => open(c), { class: 'sds-link', title: 'Open its own screen' })),
    h('div', { class: 'sds-attrs' },
      valueRows(ctx, t.props, p => view.prop(dotId, p), (p, v) => change(s => E.updateDot(s, c, { props: { [p]: v } }))),
      kindRows(ctx, t)),
    ctx.edit && !independent(ctx.view) && (ctx.ui.slots === 'move'
      ? slotPicker(ctx, {
        title: `Move “${t.name || 'unnamed'}” to…`, taken: true, current: c,
        onPick: (k, slot) => {
          const kite = st.stars[ctx.dot.branch].kites[k];
          act((s, o) => E.swapDots(s, { ...E.index(s).dot.get(c) }, { kite, slot }, o), `Moved ${t.name || 'the child'}`);
          setUi({ slots: null });
        },
      })
      : h('div', { class: 'sds-buttons sds-actions' }, button('Move to a slot…', () => setUi({ slots: 'move' }), { title: 'Put it in another slot of this star (a free one, or swap with a child)' }))),
  ];
}

/** The star-dot's own values (what its children inherit where they have none), kind and marks. */
function defaults(ctx) {
  const { st, view, dot, dotId, change, setUi, kids } = ctx;
  const parent = E.parentOf(st, dotId);
  return [
    h('div', { class: 'sds-head' }, title('Attributes'), kids.length > 0 && button('Show summary', () => setUi({ item: null }), { class: 'sds-link' })),
    kids.length > 0 && h('p', { class: 'sds-muted sds-small' }, 'Its own values: its children use them where they have none of their own (except Financial Influence).'),
    h('div', { class: 'sds-attrs' },
      valueRows(ctx, dot.props, p => (parent ? view.prop(parent, p) : null), (p, v) => change(s => E.updateDot(s, dotId, { props: { [p]: v } }))),
      kindRows(ctx, dot)),
  ];
}

/** With no child selected: what its children add up to (D3, T8; see summaryText.js). */
function summary(ctx) {
  const { view, content, dot, edit, setUi, kids } = ctx;
  const lines = attributeSummary(view, content, dot);
  return [
    h('div', { class: 'sds-head' }, title('Attributes'), edit && !ctx.central && button('Edit its own', () => setUi({ item: 'defaults' }), { class: 'sds-link', title: 'Its own values, which its children inherit where they have none' })),
    h('p', { class: 'sds-muted sds-small' }, `Rolled up from ${plural(kids.length, 'child', 'children')}: money adds up, difficulty takes the highest, Retrain and Due take the soonest.`),
    h('div', { class: 'sds-attrs' }, content.properties.filter(p => (p.id === 'due' ? ctx.allow('due') : ctx.allow('attributes'))).map(p => attrRow(p.name, lines[p.id] ?? '—'))),
  ];
}

/** Signed amount + period (cycles by click); an empty amount clears it. */
function financeEditor(value, onChange) {
  const period = value?.period ?? 'once';
  const amount = h('input', { type: 'number', step: 'any', class: 'sds-input sds-amount', placeholder: '± amount', value: value?.amount ?? '', title: 'Positive earns money, negative costs money' });
  amount.addEventListener('change', () => onChange(amount.value === '' ? null : { amount: Number(amount.value), period }));
  return h('span', { class: 'sds-finance' }, amount,
    cycler({ values: E.PERIODS, value: period, unset: false, name: p => PERIOD_NAMES[p], onChange: p => onChange(amount.value === '' ? null : { amount: Number(amount.value), period: p }) }));
}

// ---- Assessor ----------------------------------------------

const CLOSED_NOW = {
  complete: 'Its category is complete for this session.',
  off: 'It isn’t on the map: place it to answer its questions.',
  locked: 'Its kite is locked.',
  inside: 'Answer the star-dots inside it first.',
};

/**
 * The assessor, for the selected child, else this star-dot. A □ star-dot (role 'assess', or every
 * star-dot under Every star-dot is a question: On) is answered here through its question set; one
 * with no questions keeps Mark assessed (questions off). On the editing tabs, Edit questions opens
 * its set as Markdown.
 */
function assessor(ctx) {
  const { st, view, dotId, sel, kids, edit, ui, central } = ctx;
  const target = sel ?? (central ? null : dotId);
  const box = (...body) => [title('Assessor'), h('div', { class: 'sds-assess-box' }, ...body)];
  const waiting = () => kids.filter(c => roleOf(view, st.dots[c]) === 'assess' && !view.support(c) && !view.fresh(c)).length;
  const pointer = () => box(h('p', { class: 'sds-muted' }, waiting()
    ? `${plural(waiting(), 'child', 'children')} need${waiting() === 1 ? 's' : ''} assessment. Click a □ bullet to assess it.`
    : questionsOn(view) ? 'Select a star-dot in the checklist to see its questions.' : 'Nothing waiting for assessment.'));
  if (!target) return pointer();
  const t = st.dots[target];
  if (view.support(target)) return target === dotId && kids.length ? pointer() : box(h('p', { class: 'sds-muted' }, 'It has children: their questions decide it.'));
  if (roleOf(view, t) !== 'assess') return target === dotId ? pointer() : box(h('div', { class: 'sds-assess-item' }, bullet('check', view.difficulty(target), view.fresh(target)), ' ', t.name || 'Unnamed'), h('p', { class: 'sds-muted' }, '○ is clicked complete in the checklist; a □ star-dot is assessed here.'));
  if (edit && ui.qEdit === target) return box(questionEditor(ctx, target));
  const head = h('div', { class: 'sds-assess-item' }, bullet('assess', view.difficulty(target), view.fresh(target) || (t.trained ? 'half' : false)), ' ', t.name || 'Unnamed');
  const editBtn = edit && button(t.assessment ? 'Edit questions' : 'Write questions…', () => { dropDraft(target); ctx.setUi({ qEdit: target, qMode: null, qDraft: null, qCheck: null, qPreview: false, qImages: null, qFormError: null }); }, { class: 'sds-btn sds-q-edit', title: 'Its question set as Markdown (question-format.md)' });
  if (!t.assessment) {
    if (questionsOn(view)) return box(head, h('p', { class: 'sds-muted' }, edit ? 'No question yet.' : 'No question yet. Questions are written in MATERIALS.'), editBtn);
    return box(head, markButton(ctx, target), h('p', { class: 'sds-muted sds-small' }, 'Or give it questions: answering them all right completes it.'), editBtn);
  }
  if (!E.askable(t.assessment)) return box(head, h('p', { class: 'sds-muted' }, 'Its questions aren’t finished: Edit questions shows what’s missing.'), editBtn);
  return box(head, liveSet(ctx, target), editBtn && h('div', { class: 'sds-buttons' }, editBtn));
}

/** Mark assessed (a □ star-dot without questions, questions off). */
function markButton({ view, change, now, allow }, target) {
  if (!allow('markAssessed')) return null;
  return view.fresh(target)
    ? button('Undo assessment', () => change(s => E.assessDot(s, target, false, now)), { class: 'sds-btn' })
    : button('Mark assessed', () => change(s => E.assessDot(s, target, true, now)), { class: 'sds-btn', disabled: !view.completable(target) });
}

/** The set, answered for real: each right answer is saved; the last one ignites the star-dot. */
function liveSet(ctx, target) {
  const { st, view, change, ui, setUi } = ctx;
  const now = Date.now();
  const qs = E.questionState(st, view, target, now);
  const runUi = ui.qRun?.target === target ? ui.qRun : { target };
  return questionSetView({
    set: st.dots[target].assessment, dotId: target, now,
    seed: E.attemptSeed(st, target), shuffle: E.shuffleDefaults(view.opts),
    states: E.itemStates(st, target, now, view.opts, qs.kind === 'answered'),
    progress: E.setProgress(st, view, target),
    showProgress: ctx.allow('progress'),
    closed: ctx.closed?.[qs.kind] ?? CLOSED_NOW[qs.kind] ?? null,
    ui: runUi, setUi: patch => setUi({ qRun: { ...runUi, ...patch, target } }),
    answer: (qid, response) => {
      let r = null;
      change(s => { r = E.answerItem(s, target, qid, response, { ...view.opts, now: Date.now() }); return r.state; });
      return r;
    },
  });
}

// ---- Relevance Information -------------------------------------------------------------------

function relevance(ctx) {
  const { st, view, content, dotId, dot, edit, change, ui, setUi, open, allow } = ctx;
  const averages = view.relevance(dotId);
  const relatedBy = view.relevantTo(dotId);
  const placed = d => E.index(st).dot.has(d);
  const chip = d => button(dotPath(st, d), () => open(d), {
    class: 'sds-chip', style: { borderLeftColor: catColor(content, view.categoryOf(d)) },
    disabled: !placed(d), title: placed(d) ? 'Open this star-dot' : 'On the shelf: place it to open it',
  });
  const scoreName = v => `${v} · ${content.relevanceNames[v - 1]}`;
  const score = r => (edit
    ? cycler({ values: E.SCORES, value: r.score, unset: false, name: scoreName, onChange: v => change(s => E.updateRelation(s, dotId, r.dot, { score: v })) })
    : h('span', { class: 'sds-score-read' }, scoreName(r.score)));
  const taken = new Set([dotId, ...dot.relations.map(r => r.dot)]);
  return [
    title('Relevance Information'),
    h('div', { class: 'sds-averages' }, content.categories.map((c, i) => h('span', {
      class: 'sds-avg', title: averages[i].count ? `${c.name}: average of ${plural(averages[i].count, 'relation')}` : `${c.name}: no relations`,
    }, h('span', { class: 'sds-swatch', style: { background: c.color } }), ' ', c.name, ' ',
      h('strong', {}, averages[i].count ? averages[i].avg.toFixed(1) : '—'),
      averages[i].count > 0 && h('span', { class: 'sds-muted' }, ` (${averages[i].count})`)))),
    dot.relations.length
      ? h('ul', { class: 'sds-relations' }, dot.relations.map(r => h('li', { class: 'sds-relation' },
        h('div', { class: 'sds-relation-row' }, chip(r.dot), score(r), edit && removeButton(() => change(s => E.removeRelation(s, dotId, r.dot)), 'Remove relation')),
        h('div', { class: 'sds-how' }, h('span', { class: 'sds-muted' }, 'How? '), edit || allow('describeRelation')
          ? editableText({ value: r.how, multiline: true, placeholder: 'Double-click to describe how they relate', onCommit: v => change(s => E.updateRelation(s, dotId, r.dot, { how: v })) })
          : r.how || h('span', { class: 'sds-muted' }, '—')))))
      : h('p', { class: 'sds-muted' }, 'No relations yet.'),
    (edit || allow('addRelation')) && (ui.picker
      ? searchList(dotGroups(ctx, taken, d => { change(s => E.addRelation(s, dotId, d, 3, '')); setUi({ picker: false }); }),
        { placeholder: 'Search star-dots…', empty: 'No other star-dots to relate to.', onClose: () => setUi({ picker: false }) })
      : button('+ Add relation', () => setUi({ picker: true }), { class: 'sds-btn sds-add-rel' })),
    relatedBy.length > 0 && h('div', { class: 'sds-related-by' }, h('span', { class: 'sds-muted' }, 'Relevant to me: '),
      relatedBy.map(r => h('span', { class: 'sds-by' }, chip(r.dot), ` ${r.score}`))),
  ];
}
