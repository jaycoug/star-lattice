// PLAY: the board, used. The map (shared/ui/map.js) fills the page, with a toolbar (Fit, zoom,
// the layer: Off · Constellation) and the info card for what's selected (a kite, an empty slot, an
// empty position, a star-dot, or an overview). Tapping a star-dot selects it and shows pills beside
// it: Open (its screen, fixed here: complete, assess, Ignite, Lapse) and Deploy or
// Withdraw. On a phone the card becomes a bottom sheet and two fingers pinch to zoom.
//
// Edit mode moves anything; Play mode follows the player's Movement (Design › Player; actions
// playCanMove / playMoveTo): Swap (drag a star-dot onto another or an empty slot, a kite onto
// another), Rotate star-dots (↻ Rotate, R) and Rotate kites (⟳, Shift+R). Every other control
// in Play mode shows only where Design › Player gives it (a.allow). Stars appear only when deployed (Deploy
// its star on a star-dot's card; Withdraw takes one off). Only allowed targets light up; a refused drop says why (the rule, or a lineage
// conflict). The card's Swap… buttons do the same with two taps. There's no shelf and no conflict
// card here: those are REARRANGE's. Everything is undoable.
//
// A kite-less star's empty slot has no kite to show; with Deploy: Automatically,
// PLAY offers no Deploy (a completed Zenith deploys its star by itself; MATERIALS still can).
//
// With Every star-dot is a question: On, PLAY is the player's.
// Every star-dot shows (faded until answered correctly, then in full color), and tapping one opens
// its question in a small popout (questionPopout; × or a click outside closes it). The card is the
// player's panel: each category's correct / total and the waits counting down, with Fit, − and +
// only: no kite cards, pills, Retire, Design…, layer or Designs switches, or Retired bank.

import { h, notify } from '../dom.js';
import { route } from '../route.js';
import { createMap } from '../../../shared/ui/map.js';
import { kiteDesigner, DEFAULT_SETTINGS } from '../../../shared/ui/kiteDesigner.js';
import * as E from '../../../shared/engine/index.js';
import { playerPaletteMenu, placeInView } from './playerPalette.js';
import { DEFAULT_PALETTES } from '../../../shared/color.js';
import { latticeRing } from '../../../shared/lattice.js';
import { designOf } from '../model.js';
import { countdown, updateCountdowns } from '../../../shared/ui/question.js';
import { questionSetView } from '../../../shared/ui/questionSet.js';

const STATUS = { empty: 'empty', open: 'not started', training: 'in training', ignited: 'ignited' };
const MARK = { empty: '·', open: '☆', training: '◐', ignited: '★' };
const LAYERS = [['off', 'Off'], ['constellation', 'Constellation']];   // No Relations layer
const layerOf = u => (u.layer === 'constellation' ? 'constellation' : 'off');
// 9e: turned on, the layer's arrows travel a moment (u.layerShow) from each origin to its target.
/** The quiz map's Layer switch: as Design › Player gives it, where there are relations to show. */
const quizLayer = (st, a) => a.allow('layer') && Object.values(st.state.dots).some(d => d.relations?.length);
function layerSwitch(u, a) {
  return h('span', { class: 'segmented', role: 'group', 'aria-label': 'Layer' },
    LAYERS.map(([id, label]) => h('button', {
      class: 'seg' + (layerOf(u) === id ? ' on' : ''), 'aria-pressed': String(layerOf(u) === id),
      title: { off: 'No relations', relations: 'Relations as arrows (zoomed in) or lines between stars (zoomed out)', constellation: 'Only star-dots and their relations, on a dark sky' }[id],
      onclick: () => a.setLayer(id),
    }, label)));
}

// One map for the page's whole life (it keeps its camera); each render re-inserts its element.
let current = null;
/** 9b: each ladder tool's prize, a shape alone (the map shows no words until it's claimed). */
const PRIZE_ICON = {
  tree: '🌳', deck: '🂠', kiteLook: '◆', layer: '✦', kiteDesign: '🖌', card: '▤', retire: '⇣', retired: '⌂', goal: '◎', waits: '⏳',
  swap: '⇄', rotateDots: '↻', rotateKites: '⟳', name: '✎', description: '☰', checklist: '☑', assessor: '?', progress: '▰', markAssessed: '✓', due: '⏰',
  attributes: '⚙', notesRead: '✉', notesWrite: '✍', relevance: '☍', addRelation: '+', describeRelation: '≈', move: '✥', shelf: '▭', rename: '✐', lists: '≡', newSession: '↺',
  'kite:cut': '✂', 'kite:paint': '🖌', 'palette:own': '+', spin: '⟲', comet: '☄', 'comet:write': '🌠',
};
/** 9c: ⟲ Spin beside every star on the map while a spin is waiting to be used (none while one turns). */
function starPillsOf(st, a, u) {
  const n = a.spinsLeft();
  if (!n || u.spin) return [];
  return st.ev.shownStars().map(s => ({ star: s, action: 'spin', label: `⟲ Spin${n > 1 ? ` ×${n}` : ''}`, title: 'Spin this star: the kite that stops at the top decides' }));
}

/** 9c: a star turning (ui.spin), with what each of its kites stands for. */
const SPIN_ICON = { hint: '💡', prize: '🎁', again: '⟲', nothing: '·' };
function spinOf(st, u) {
  const s = u.spin;
  if (!s || !st.state.stars[s.star]) return null;
  const outs = E.spinOutcomes(st.content);
  return { ...s, icons: Object.fromEntries(st.state.stars[s.star].kites.map((k, i) => [k, SPIN_ICON[outs[i]]])) };
}

/**
 * The prizes on the field (Play mode): every rung earned, each beside the star-dot that earned it,
 * staying until it's claimed (claimed ones keep their place, unseen, so the others never move).
 */
function prizesOf(st) {
  if (route().mode !== 'play') return [];
  return E.fieldPrizes(st.content, st.save.state).map(({ i, key, near, claimed }) => {
    // A palette's prize is its six colors in a ring; Your own palette's, six blank dots around a +.
    const colors = key === 'palette:own' ? Array(6).fill('#ffffff') : DEFAULT_PALETTES[key.replace(/^palette:/, '')];
    return { i, key, near, claimed, icon: PRIZE_ICON[key] ?? (colors ? '' : '★'), ...(key.startsWith('palette:') && { colors }) };
  });
}
let map = null;
let shownSave = null;
const getMap = () => (map ??= createMap({
  onHit: t => current?.playHit(t),
  onDrop: (from, to) => current?.playMoveTo(from, to),
  canDrop: (from, to) => !!current?.playCanMove(from, to),
  onRefuse: (from, to) => current?.playRefused(from, to),
  onCometDone: id => current?.cometFlown(id),   // 9d
}));
// 9d: now and then, while the Star view is up in Play mode, a "now and then" message may fly (every 3–6 minutes).
setInterval(() => { if (current && route().page === 'star' && route().mode === 'play' && Math.random() < 1 / 4) current.randomComet(); }, 60000).unref?.();   // (unref: a headless check can still end)

document.addEventListener('keydown', e => {
  if (!current || route().page !== 'star' || current.ui().sds || current.ui().conflict) return;
  if (current.ui().design) { if (e.key === 'Escape') current.closeDesigner(); return; }   // the designer is open: Esc closes it
  if (current.ui().quiz) { if (e.key === 'Escape') current.closeQuestion(); return; }      // a question is open: Esc closes it
  if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  const { playSel } = current.ui();
  if (e.key === 'Escape') current.playCancel();
  else if (e.key === 'f' || e.key === 'F') map?.fit();
  else if (e.key === 'R' && e.shiftKey && playSel?.kind === 'kite') current.playRotateKites(playSel.id);
  else if (e.key === 'r' && playSel?.kind === 'kite') current.playRotate(playSel.id);
});

/**
 * Countdowns (waits after a wrong answer) tick once a second while any is shown; when one runs out,
 * the page redraws so its star-dot opens again.
 */
let root = null;
let ticking = false;
function tick() {
  if (ticking) return;
  ticking = true;
  setTimeout(() => {
    ticking = false;
    if (!root || !root.querySelectorAll?.('.qz-countdown').length) return;
    if (updateCountdowns(root)) current?.refresh();
    else tick();
  }, 1000);
}

export function play(st, a) {
  current = a;
  const m = getMap();
  const u = a.ui();
  if (shownSave !== st.file.name) {
    shownSave = st.file.name;
    m.refit();
  }
  if (st.ev.opts.questions === 'on' && route().mode === 'play') {   // Quiz mode, as the player gets it (Edit mode keeps the editing map)
    root = playerPlay(st, a, m);
    tick();
    return root;
  }
  root = null;
  m.update({
    state: st.state, view: st.ev, content: st.content, sel: u.playSel, mode: u.playMode,
    layer: layerOf(u), travel: !!u.layerShow,
    dots: 'kite',                       // Star-dots once a kite is selected; no star drawn before it's deployed
    pills: pillsFor(st, a, u.playSel),  // ↗ Open and Deploy / Withdraw beside a selected star-dot; ↻ Rotate, Swap kite…, 🖌 beside a selected kite
    centerDot: true,                    // The central star's dot opens its screen
    animate: true,                      // Changes animate on PLAY's map only
    fx: st.content.rules.bursts === 'on',   // 9a: bursts and supernovas
    reveal: st.content.rules.reveal === 'on',   // 9e: the constellation, revealed (Design › Fun)
    fog: route().mode === 'play' && st.content.rules.fog === 'on',   // 9e: Nebula fog (Play mode)
    streak: streakOf(st),               // 9e: right answers in a row
    hold: !!(u.quiz || u.sds),          // …played once the popout or screen over the map closes
    prizes: prizesOf(st),               // 9b: the bonus ladder's prizes on the field, to claim in any order
    spin: spinOf(st, u),                // 9c: a star turning
    comet: a.nextComet(),               // 9d: the next message to cross once
    cycling: a.activeComets(),          // 9d: the prize comets circling all session
    starPills: starPillsOf(st, a, u),   // 9c: ⟲ Spin beside every star, with a spin to use
    designs: st.kiteLook === 'designs' ? k => designOf(st.save, k, route().mode === 'play') : null,   // U11; the save's designs
  });
  return h('div', { class: 'play' },
    u.design && designSheet(st, a),
    h('div', { class: 'play-tools' },
      h('button', { class: 'text-btn small', title: 'Fit the board (F)', onclick: () => m.fit() }, 'Fit'),
      h('button', { class: 'text-btn small', title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => m.zoom(1 / 1.4) }, '−'),
      h('button', { class: 'text-btn small', title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => m.zoom(1.4) }, '+'),
      route().mode === 'play' && a.allow('palette') && playerPaletteMenu(st, a),   // 9b: the player's own colors
      a.notesLeft() > 0 && writeCometMenu(a),   // 9d
      a.allow('layer') && layerSwitch(u, a),
      a.allow('kiteLook') && kiteLookSwitch(st, a),
      funStrip(st)),
    h('div', { class: 'play-body' },
      h('div', { class: 'play-map' }, m.el, a.allow('card') && h('div', { class: 'play-card' }, card(st, a)))),
    u.quiz && st.state.dots[u.quiz.dot] && questionPopout(st, a, u.quiz));
}

/** 9d: 🌠 Write a comet: a note (up to 140 characters) that flies back to the player in a later session. */
function writeCometMenu(a) {
  const text = h('textarea', { class: 'comet-note', maxlength: 140, rows: 3, placeholder: 'A note to your future self…', 'aria-label': 'Your note' });
  const menu = h('form', {
    class: 'popover comet-menu', hidden: true,
    onsubmit: e => { e.preventDefault(); if (a.writeComet(text.value)) menu.hidden = true; },
  }, h('div', { class: 'palette-editor-title' }, 'Write a comet'), text,
    h('p', { class: 'note small' }, 'It sets off at once, trailing your words, and circles the sky for the rest of this session.'),
    h('div', { class: 'btn-row' }, h('button', { type: 'submit', class: 'text-btn small comet-send' }, 'Send'), h('button', { type: 'button', class: 'text-btn small subtle', onclick: () => { menu.hidden = true; } }, 'Cancel')));
  const button = h('button', {
    type: 'button', class: 'text-btn small comet-btn', title: `Write a comet (${a.notesLeft()} to write)`, 'aria-label': 'Write a comet',
    onclick: e => { e.stopPropagation(); menu.hidden = !menu.hidden; if (!menu.hidden) { placeInView(button, menu); text.focus?.(); } },
  }, '🌠');
  return h('div', { class: 'popover-wrap' }, button, menu);
}

/** 9e: the streak (Play mode, Streaks and marks on), else 0. */
const streakOf = st => (route().mode === 'play' && E.streaksOn(st.content) ? E.funOf(st.save.state).streak : 0);
/** 9e: by the map: “✦ n in a row” (from 2) and the marks earned this session. */
function funStrip(st) {
  if (route().mode !== 'play' || !E.streaksOn(st.content)) return null;
  const f = E.funOf(st.save.state);
  if (f.streak < 2 && !f.marks.length) return null;
  return h('span', { class: 'fun-strip', 'aria-label': 'Streak and marks' },
    f.streak >= 2 && h('span', { class: 'streak-chip' + (f.streak >= E.STREAK_SHOWN ? ' hot' : ''), title: `${f.streak} right answers in a row (best this session: ${f.best})` }, `✦ ${f.streak} in a row`),
    f.marks.map(id => E.MARK[id]).map(m => h('span', { class: 'mark-badge', dataset: { mark: m.id }, title: `${m.name}: ${m.about}`, 'aria-label': m.name }, m.icon)));
}

/** Whether any kite has a design to show (its category's, or its own). */
const hasDesigns = st => (st.save.designs ?? []).some(Boolean) || (st.save.state.look?.designs ?? []).some(Boolean) || Object.values(st.state.kites).some(k => k.design);
/** Kites: Solid | Designs. */
const kiteLookSwitch = (st, a) => h('span', { class: 'segmented', role: 'group', 'aria-label': 'Kites' },
  [['solid', 'Solid'], ['designs', 'Designs']].map(([id, label]) => h('button', {
    class: 'seg' + (st.kiteLook === id ? ' on' : ''), 'aria-pressed': String(st.kiteLook === id),
    title: id === 'solid' ? 'Kites in their progress color' : 'Kites painted with their designs (Design… on a kite’s card), in their progress color',
    onclick: () => a.setKiteLook(id),
  }, label)));

// ---- The player's PLAY ---------------------------------------------------------

function playerPlay(st, a, m) {
  const u = a.ui();
  const sel = u.playSel?.kind === 'kite' ? u.playSel : null;   // a kite, when the player has a tool for it
  m.update({
    state: st.state, view: st.ev, content: st.content, sel, mode: u.playMode, layer: quizLayer(st, a) ? layerOf(u) : 'off', travel: !!u.layerShow,
    dots: 'all',                        // every star-dot, at any zoom (Y12: faded until answered)
    pills: pillsFor(st, a, sel), centerDot: false, animate: true, fx: st.content.rules.bursts === 'on', reveal: st.content.rules.reveal === 'on', fog: st.content.rules.fog === 'on', streak: streakOf(st), hold: !!(u.quiz || u.sds), prizes: prizesOf(st), spin: spinOf(st, u), comet: a.nextComet(), cycling: a.activeComets(), starPills: starPillsOf(st, a, u),
    designs: st.kiteLook === 'designs' ? k => designOf(st.save, k, route().mode === 'play') : null,
  });
  return h('div', { class: 'play quiz-play' },
    h('div', { class: 'play-tools' },
      h('button', { class: 'text-btn small', title: 'Fit the board (F)', onclick: () => m.fit() }, 'Fit'),
      h('button', { class: 'text-btn small', title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => m.zoom(1 / 1.4) }, '−'),
      h('button', { class: 'text-btn small', title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => m.zoom(1.4) }, '+'),
      a.allow('palette') && playerPaletteMenu(st, a),   // 9b: the player's own colors
      a.notesLeft() > 0 && writeCometMenu(a),   // 9d
      quizLayer(st, a) && layerSwitch(u, a),   // 9e: the constellation, as Design › Player gives it
      a.allow('kiteLook') && (hasDesigns(st) || (E.ladderOf(st.file.content) && a.allow('kiteDesign'))) && kiteLookSwitch(st, a),   // once there's a design to see, or with a kite prize
      funStrip(st)),
    u.design && designSheet(st, a),
    h('div', { class: 'play-body' },
      h('div', { class: 'play-map' }, m.el, h('div', { class: 'play-card quiz-panel' }, quizPanel(st, a)))),
    u.quiz && st.state.dots[u.quiz.dot] && questionPopout(st, a, u.quiz));
}

/** A category's progress: a bar in its color and a percent ("Done" once complete); the counts in its tooltip. */
function scoreBar(color, { correct, total }, complete) {
  const pct = total ? Math.round((100 * correct) / total) : 0;
  return h('span', { class: 'quiz-score', title: `${correct} of ${total} answered right` },
    h('span', { class: 'quiz-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${complete ? 100 : pct}%`, background: color } })),
    h('span', { class: 'quiz-count' }, complete ? 'Done' : `${pct}%`));
}

/** Y15: each category's progress, and the waits counting down. */
function quizPanel(st, a) {
  const { state, ev, content } = st;
  const now = Date.now();
  const progress = E.categoryProgress(state, ev, content.categories.length);
  const waits = E.waitsAt(state, now, ev.opts);
  return h('div', {},
    h('header', { class: 'card-head' }, h('div', { class: 'eyebrow' }, 'Quiz'), h('h2', {}, content.title)),
    h('ul', { class: 'quiz-categories' }, content.categories.map((c, i) => h('li', { class: 'quiz-category' + (E.categoryComplete(state, i) ? ' complete' : ''), dataset: { category: String(i) } },
      h('span', { class: 'quiz-category-row' },
        swatch(c.color), h('span', { class: 'grow' }, c.name),
        scoreBar(c.color, progress[i], E.categoryComplete(state, i))),
      // Its goal, or that it's complete.
      a.allow('goal') && !E.categoryComplete(state, i) && E.goalOf(state, i) && h('span', { class: 'quiz-goal' }, 'Goal: find the twinkling star-dot')))),
    a.allow('waits') && waits.length > 0 && h('div', { class: 'card-section quiz-waits' },
      h('div', { class: 'eyebrow' }, 'Waiting after a wrong answer'),
      h('ul', {}, waits.map(w => h('li', {}, h('span', { class: 'grow' }, state.dots[w.dot].name || 'A star-dot'), ' ', countdown(w.until, now))))),
  );
}

const CLOSED_TEXT = {
  none: 'This star-dot has no question yet.',
  children: 'Its star’s star-dots decide this one: answer those.',
  off: 'This star-dot isn’t on the map.',
  locked: 'Its kite is locked.',
  inside: 'Answer the star-dots inside it first.',
  complete: 'Its category is complete for this session.',
  waiting: 'Not yet: after a wrong answer it opens again in',
};

/**
 * Y10, the question popout, the star-dot's question set (one question or
 * many). A choice is final until it closes (× or a click outside) or Try again (Retry now).
 */
function questionPopout(st, a, q) {
  const { state, ev, content } = st;
  const dot = state.dots[q.dot];
  const now = Date.now();
  const qs = E.questionState(state, ev, q.dot, now);
  const cat = ev.categoryOf(q.dot);
  // Waiting after a wrong answer (and nothing else open): just a small pill with the countdown.
  if (qs.kind === 'waiting' && !q.last) {
    return h('div', { class: 'qz-overlay', onclick: e => { if (e.target === e.currentTarget) a.closeQuestion(); } },
      h('div', { class: 'qz-popout qz-pill', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${dot.name || 'Question'}: waiting` },
        h('span', { class: 'qz-pill-name' }, dot.name || 'Question'),
        h('span', { class: 'qz-pill-wait' }, '⏳ ', countdown(qs.until, now)),
        h('button', { type: 'button', class: 'qz-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => a.closeQuestion() }, '×')));
  }
  const body = !dot.assessment || !E.askable(dot.assessment)
    ? h('p', { class: 'qz-result closed' }, CLOSED_TEXT.none)
    : ['children', 'off', 'locked', 'inside', 'complete'].includes(qs.kind) && !q.last
      ? h('p', { class: 'qz-result closed' }, CLOSED_TEXT[qs.kind])
      : questionSetView({
        set: dot.assessment, dotId: q.dot, now,
        seed: E.attemptSeed(state, q.dot), shuffle: E.shuffleDefaults(ev.opts),
        states: E.itemStates(state, q.dot, now, ev.opts, qs.kind === 'answered'),
        progress: E.setProgress(state, ev, q.dot),
        ui: q, setUi: patch => a.setQuiz(patch),
        answer: (qid, response) => a.answerItem(q.dot, qid, response),
      });
  return h('div', { class: 'qz-overlay', onclick: e => { if (e.target === e.currentTarget) a.closeQuestion(); } },
    h('div', { class: 'qz-popout', role: 'dialog', 'aria-modal': 'true', 'aria-label': dot.name || 'Question' },
      h('button', { type: 'button', class: 'qz-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => a.closeQuestion() }, '×'),
      h('div', { class: 'eyebrow' }, cat == null ? '' : h('span', {}, swatch(content.categories[cat].color), ' ', content.categories[cat].name)),
      dot.name && h('h2', { class: 'qz-title' }, dot.name),
      body));
}

// ---- Kite designs ------------------------------------------------------------------------

/**
 * The designer over PLAY for a kite (ui.design { kite, target }): its category's design (every
 * kite of the category without its own) or this kite's own; Use the category's design drops a
 * kite's own; Import… takes the standalone Kite Designer's Export file. Each stroke is one undo step.
 */
function designSheet(st, a) {
  const { design: d, designer } = a.ui();
  const { state, content } = st;
  const kite = state.kites[d.kite];
  if (!kite) return null;
  const ci = kite.color;
  const cat = ci == null ? null : content.categories[ci];
  const playing = route().mode === 'play';   // the player's designs are always the category's (9b)
  const target = ci == null ? 'kite' : playing ? 'category' : d.target;
  const own = kite.design;
  const catDesign = ci == null ? null : (playing && st.save.state.look?.designs?.[ci]) || st.save.designs[ci];   // the player's this session, else the designer's
  const current = target === 'kite' ? own ?? catDesign : catDesign;
  const commit = next => (target === 'kite' ? a.setKiteDesign(d.kite, next) : a.setCategoryDesign(ci, next));
  const file = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    onchange: async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      try { a.importDesigns(JSON.parse(await f.text()), ci); } catch (err) { notify(`Couldn’t read that file: ${err.message}`, 'error'); }
    },
  });
  const note = target === 'category'
    ? `Every ${cat.name} kite without a design of its own shows this one, and follows it when it changes.`
    : own ? 'This kite has its own design; other kites keep their category’s.'
      : `This kite shows ${cat ? `${cat.name}’s` : 'no'} design; painting here gives it one of its own.`;
  return h('div', { class: 'sds-overlay', onclick: e => { if (e.target === e.currentTarget) a.closeDesigner(); } },
    h('div', { class: 'sds-sheet design-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Kite design' },
      h('button', { type: 'button', class: 'sds-sheet-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => a.closeDesigner() }, '×'),
      h('header', { class: 'card-head design-head' },
        h('div', { class: 'eyebrow' }, cat ? h('span', {}, swatch(cat.color), ' ', cat.name) : 'Color not chosen yet'),
        h('h2', {}, `Design · ${kite.name || 'Unnamed kite'}`),
        cat && !playing && h('span', { class: 'segmented', role: 'group', 'aria-label': 'Whose design' },
          [['category', `${cat.name}’s design`], ['kite', 'This kite only']].map(([id, label]) => h('button', {
            class: 'seg' + (target === id ? ' on' : ''), 'aria-pressed': String(target === id), onclick: () => a.setDesignTarget(id),
          }, label))),
        h('p', { class: 'note small' }, note, st.kiteLook !== 'designs' && ' Turn on Designs in the toolbar to see designs on the map.')),
      kiteDesigner({ design: current, color: cat?.color ?? '#9aa4b2', onCommit: commit, settings: designer ?? DEFAULT_SETTINGS, setSettings: a.setDesignerSettings, fade: st.content.rules.fade, allowed: a.designerAllows() }),
      h('div', { class: 'buttons design-tools' },
        target === 'kite' && own && button('Use the category’s design', () => a.setKiteDesign(d.kite, null), { title: 'Drop this kite’s own design' }),
        cat && !playing && button('Import…', () => file.click(), { title: 'Designs from the Kite Designer’s Export file (matched by category name)' }),
        file)));
}

// ---- The info card -----------------------------------------------------------------------------

const button = (label, onclick, props = {}) => h('button', { type: 'button', class: 'text-btn small', onclick, ...props }, label);
const swatch = color => h('span', { class: 'swatch', style: { background: color ?? 'transparent' } });
const kiteName = (state, k) => state.kites[k]?.name || 'Kite';
/** "Career › Interview Prep": its kite's name, else its parent's. */
const dotPath = (state, d) => {
  const at = E.index(state).dot.get(d);
  const parent = E.parentOf(state, d);
  const where = at && (state.kites[at.kite].name || (parent && state.dots[parent].name) || 'Kite');
  return `${where ? where + ' › ' : ''}${state.dots[d].name || 'unnamed'}`;
};
const close = a => h('button', { type: 'button', class: 'card-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => a.playSelect(null) }, '×');

function card(st, a) {
  const { playSel: sel } = a.ui();
  const { state } = st;
  const body = sel?.kind === 'kite' && state.kites[sel.id] && E.index(state).kite.has(sel.id) ? kiteCard(st, a, sel.id)
    : sel?.kind === 'slot' && state.kites[sel.kite] ? slotCard(st, a, sel)
    : sel?.kind === 'pos' ? positionCard(st, a, sel.coord)
    : sel?.kind === 'dot' && state.dots[sel.id] && E.index(state).dot.has(sel.id) ? dotCard(st, a, sel.id)
    : overview(st, a);
  return [modeBanner(st, a), body];
}

function modeBanner(st, a) {
  const mode = a.ui().playMode;
  if (!mode) return null;
  const where = '';
  const text = mode.kind === 'swapDot' ? `Tap a star-dot or an empty slot${where} to swap with.`
    : `Tap another kite${where} to swap with (central kites stay on the central star).`;
  return h('div', { class: 'mode-banner' }, text, button('Cancel', () => a.setPlayMode(null)));
}

function kiteCard(st, a, k) {
  const { state, ev, content } = st;
  const kite = state.kites[k];
  const starId = E.index(state).kite.get(k).star;
  const star = state.stars[starId];
  const open = ev.kiteOpen(k);
  const cat = kite.color == null ? null : content.categories[kite.color];
  const ignited = kite.dots.filter(d => d && ev.effective(d).status === 'ignited').length;
  const stage = content.stageNames[Math.min(E.DOTS, Math.floor(ev.kiteProgress(k) + 1e-9))];
  const independent = E.independentOn(ev.opts);   // The list order places the items
  const moves = a.moves();
  return h('div', {},
    h('header', { class: 'card-head' }, close(a),
      h('div', { class: 'eyebrow' }, cat ? h('span', {}, swatch(cat.color), ' ', cat.name) : 'Color not chosen yet',
        star.sources.length ? ` · deployed from ${star.sources.map(d => state.dots[d].name || 'unnamed').join(', ')}` : ' · central star'),
      h('h2', {}, kite.name || 'Unnamed kite'),
      kite.description && h('p', { class: 'note kite-description' }, kite.description),   // V9: read-only here; edited on MATERIALS' card
      h('div', { class: 'note' }, open ? `${stage} · ${ignited} / ${E.DOTS} ignited` : 'Locked: opens when a neighboring open kite has two ignited star-dots')),
    h('ul', { class: 'card-dots' }, kite.dots.map((d, slot) => {
      const status = d ? ev.effective(d).status : 'empty';
      return h('li', {},
        h('span', { class: 'slot-name' }, kite.labels[slot] || content.dotNames[slot], slot === E.ZENITH && h('span', { class: 'note' }, ' (tip)')),
        d ? button(h('span', {}, h('span', { class: `dot-mark ${status}` }, MARK[status]), ' ', state.dots[d].name || 'unnamed'), () => a.openScreen(d), { class: 'text-btn small dot-btn', title: `Open (${STATUS[status]})` })
          : h('span', { class: 'note grow' }, 'empty'));
    })),
    h('div', { class: 'buttons' },
      moves.rotateDots && !independent && button('↻ Rotate', () => a.playRotate(k), { title: 'Each star-dot moves one place: Nadir → Port → Zenith → Starboard (R)' }),
      moves.rotateKites && !independent && button(ROTATE_KITES, () => a.playRotateKites(k), { title: 'This star’s kites move one place clockwise around it, with their star-dots and branches (Shift+R)' }),
      a.allow('kiteDesign') && button(DESIGN, () => a.openDesigner(k, kite.design || kite.color == null ? 'kite' : 'category'), { class: 'text-btn small icon-btn', title: 'Design…: its category’s kite design, or one for this kite only (shown with Designs)', 'aria-label': 'Design…' })));
}

function slotCard(st, a, { kite: k, slot }) {
  const { state, content, ev } = st;
  const star = E.index(state).kite.get(k)?.star;
  const bare = !!star && ev.kiteless(star);
  return h('div', {},
    h('header', { class: 'card-head' }, close(a),
      h('div', { class: 'eyebrow' }, `${kiteName(state, k)} · ${content.dotNames[slot]}`),
      h('h2', {}, 'Empty star-dot')),
    !bare && h('div', { class: 'buttons' }, button('Show this kite', () => a.playSelect({ kind: 'kite', id: k }))));
}

function positionCard(st, a, coord) {
  return h('div', {},
    h('header', { class: 'card-head' }, close(a),
      h('div', { class: 'eyebrow' }, `Position ${coord.join(',')} · ring ${latticeRing(coord)}`),
      h('h2', {}, 'Empty position')),
    h('p', { class: 'note' }, 'A star appears here when a star-dot at a Zenith facing it is deployed.'));
}

/**
 * Where a selected star-dot's star is: on the map, deployed, planned or none; at an open
 * Zenith whose faced position isn't free, why it can't deploy there.
 */
function starNote(st, d) {
  const { state, ev } = st;
  const b = state.dots[d].branch;
  const deployed = !!b && !!state.stars[b]?.deployed;
  const why = !deployed && ev.canExpand(d) ? E.deployStar(state, d, ev.opts).problem : null;
  const cant = why ? ` It can’t deploy here: ${why.charAt(0).toLowerCase()}${why.slice(1)}` : '';
  if (!b || !state.stars[b]) return 'No star of its own yet.' + cant;
  if (ev.shown(b)) return 'Its star is on the map.';
  if (deployed) return 'Its star is deployed: it shows while this star-dot is at an open kite’s Zenith.';
  if (cant) return 'Its star is planned.' + cant;
  if (ev.opts.deploy === 'auto') return 'Its star is planned: it deploys once this star-dot is complete.';
  return 'Its star is planned: Deploy puts it on the map where its kite faces a free position.';
}

/** the Design symbol (a kite's design), on its card and its pill. */
const DESIGN = '🖌';
/** Rotate kites: a star's kites one place around it. */
const ROTATE_KITES = '⟳ Rotate kites';

/**
 * X7: the pills beside a selected star-dot on the map: ↗ Open, and Deploy (where it can) or
 * Withdraw. beside a selected kite, ↻ Rotate (where the board rule rotates), Swap
 * kite… (Free) and 🖌 (its design), as on its card.
 */
/** a star-dot with a question set to answer (questions off: PLAY's Answer opens the popout). */
const hasQuestions = (state, d) => !!state.dots[d]?.assessment && E.askable(state.dots[d].assessment);

function pillsFor(st, a, sel) {
  const { state, ev } = st;
  if (sel?.kind === 'kite' && E.index(state).kite.has(sel.id)) {
    const independent = E.independentOn(ev.opts);
    const moves = a.moves();
    return [
      moves.rotateDots && !independent && { action: 'rotate', label: '↻ Rotate', title: 'Each star-dot moves one place: Nadir → Port → Zenith → Starboard (R)' },
      moves.rotateKites && !independent && { action: 'rotateKites', label: '⟳', title: 'Rotate kites: this star’s kites move one place clockwise around it (Shift+R)' },
      moves.swap && !independent && { action: 'swapKite', label: 'Swap kite…', title: 'Swap with another kite; branches turn along' },
      a.allow('kiteDesign') && { action: 'design', label: DESIGN, title: 'Design…: its category’s kite design, or one for this kite only (shown with Designs)' },
    ].filter(Boolean);
  }
  const d = sel?.kind === 'dot' && state.dots[sel.id] && E.index(state).dot.has(sel.id) ? sel.id : null;
  if (!d) return [];
  const b = state.dots[d].branch;
  const out = [{ action: 'open', label: '↗', title: 'Open its screen' }];
  if (hasQuestions(state, d)) out.unshift({ action: 'answer', label: 'Answer', title: 'Answer its questions in a popout' });
  if (b && state.stars[b]?.deployed) out.push({ action: 'withdraw', label: 'Withdraw', title: 'Take its star off the map: it stays planned, with everything on it' });
  else if (ev.opts.deploy !== 'auto' && ev.canExpand(d) && !E.deployStar(state, d, ev.opts).problem) out.push({ action: 'deploy', label: 'Deploy', title: b ? 'Put its planned star on the map' : 'Make its star and put it on the map' });
  return out;
}

/**
 * Deploy its star or Withdraw its star, as it stands: Withdraw for a deployed star,
 * Deploy where the engine allows it (a planned star, or none, at an open kite's Zenith), else nothing.
 */
function deployAction(st, a, d) {
  const { state, ev } = st;
  const b = state.dots[d].branch;
  if (b && state.stars[b]?.deployed) return button('Withdraw its star', () => a.playWithdraw(d), { title: 'Take its star off the map: it stays planned, with everything on it' });
  if (ev.opts.deploy === 'auto' || !ev.canExpand(d) || E.deployStar(state, d, ev.opts).problem) return null;
  return button('Deploy its star', () => a.playDeploy(d), { title: b ? 'Put its planned star on the map' : 'Make its star and put it on the map' });
}

/**
 * A selected star-dot: its status, kite and star (shown on the map while selected, U3), its
 * relations (lit up in the constellation view), Open ↗ (also a second tap) and Retire.
 */
function dotCard(st, a, d) {
  const { state, ev, content } = st;
  const dot = state.dots[d];
  const rel = (other, score, how, dir) => h('li', {},
    h('span', { class: 'note' }, dir),
    button(dotPath(state, other), () => a.playSelect({ kind: 'dot', id: other }), { class: 'text-btn small dot-btn', title: how || 'No note' }),
    h('span', { class: 'tag' }, String(score)));
  const out = dot.relations.filter(r => state.dots[r.dot]);
  const inn = ev.relevantTo(d);
  const cat = ev.categoryOf(d);
  const support = ev.support(d);
  return h('div', {},
    h('header', { class: 'card-head' }, close(a),
      h('div', { class: 'eyebrow' }, cat == null ? 'On the shelf' : h('span', {}, swatch(content.categories[cat].color), ' ', dotPath(state, d).replace(/ › [^›]*$/, ''))),
      h('h2', {}, dot.name || 'Unnamed star-dot'),
      h('div', { class: 'note' }, `${STATUS[ev.effective(d).status]}${support ? ` (${support.ignited} of ${support.total} complete)` : ''} · ${out.length} relation${out.length === 1 ? '' : 's'} · relevant to ${inn.length}`)),
    h('p', { class: 'note small' }, starNote(st, d)),
    E.overCount(state, d, ev.opts) && h('p', { class: 'note small over-count' }, 'Over the per-star count: it keeps its place and still counts, but this slot is beyond Star-dots per star.'),
    h('div', { class: 'buttons' },
      hasQuestions(state, d) && button('Answer', () => a.openQuestion(d), { title: 'Answer its questions in a popout' }),
      button('Open ↗', () => a.openScreen(d), { title: 'Its screen (or tap the star-dot again)' }),
      deployAction(st, a, d),
      a.allow('retire') && !E.independentOn(ev.opts) && button('Retire', () => a.retire(d), { title: 'Take it off the map, with its star and children, into the Retired bank (undoable; restore it from there)' })),
    (out.length || inn.length)
      ? h('ul', { class: 'card-dots' }, out.map(r => rel(r.dot, r.score, r.how, '→')), inn.map(r => rel(r.dot, r.score, r.how, '←')))
      : h('p', { class: 'note' }, 'No relations yet.'));
}

/**
 * The Retired bank (U8; round 8, W5), below the overview: a dot per retired star-dot, newest first,
 * in the color of the kite it left, filled by its status; clicking one shows its details under the
 * dots (where it came from, when, Open ↗ read-only, Restore, Delete…), clicking it again hides them.
 */
export function retiredBank(st, a) {
  if (!a.allow('retired')) return null;
  const { state, ev, content } = st;
  const list = state.retired.filter(e => state.dots[e.id]);
  const picked = list.find(e => e.id === a.ui().retiredPick);
  const name = e => state.dots[e.id].name || 'Unnamed star-dot';
  const colorOf = e => { const c = state.kites[e.from.kite]?.color; return c == null ? null : content.categories[c]?.color ?? null; };
  const detail = e => {
    const from = e.from.parent && state.dots[e.from.parent];
    return h('div', { class: 'retired-detail' },
      h('strong', {}, name(e)),
      h('div', { class: 'note small' }, `${from ? `From ${from.name || 'unnamed'}` : 'From the central star'}${Number.isFinite(e.at) ? ` · retired ${new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}`),
      h('div', { class: 'buttons' },
        button('Open ↗', () => a.openScreen(e.id), { title: 'Its screen (read-only)' }),
        button('Restore', () => a.restore(e.id), { title: 'Back to its old slot, else its old parent’s next free slot, else the shelf' }),
        route().mode !== 'play' && button('Delete…', () => a.deleteStarDot(e.id), { class: 'text-btn small danger', title: 'Delete it for good, with its star and everything on it (asks first; undoable)' })));
  };
  return h('div', { class: 'card-section retired-bank' },
    h('div', { class: 'eyebrow' }, `Retired · ${list.length}`),
    list.length
      ? h('div', { class: 'retired-dots', role: 'group', 'aria-label': 'Retired star-dots' }, list.map(e => h('button', {
        type: 'button', class: `retired-dot ${ev.effective(e.id).status}` + (picked === e ? ' on' : ''), style: { '--dot': colorOf(e) ?? 'var(--muted)' },
        title: name(e), 'aria-label': name(e), 'aria-pressed': String(picked === e), dataset: { id: e.id },
        onclick: () => a.setRetiredPick(picked === e ? null : e.id),
      })))
      : h('p', { class: 'note small' }, 'Nothing retired.'),
    picked && detail(picked));
}

function overview(st, a) {
  const { state, ev, content } = st;
  const placed = Object.keys(state.dots).filter(d => E.index(state).dot.has(d));
  const count = status => placed.filter(d => ev.effective(d).status === status).length;
  const shown = ev.shownStars().length;
  const stored = Object.values(state.stars).filter(s => !s.shelved).length - shown;
  return h('div', {},
    h('header', { class: 'card-head' },
      h('div', { class: 'eyebrow' }, 'Overview'),
      h('h2', {}, content.title),
      h('div', { class: 'note' }, `${shown} star${shown === 1 ? '' : 's'}${stored ? ` · ${stored} stored` : ''} · ${count('ignited')} ignited · ${count('training')} in training · ${count('open')} not started`)),
    // How-to tips live in the tutorials (tour.js) and ? Help, not on the page (P8).
    retiredBank(st, a));
}
