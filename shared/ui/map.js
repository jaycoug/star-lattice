// The starfield map (PLAY's): shown stars with their kites and star-dots, a faint lattice of uniform
// points around them, the central star's white dot and an optional constellation
// layer. Only deployed stars on the map are drawn (round 8, X5: no planned, stored or what-if
// outlines). Drawn in screen pixels through the camera on every update, so strokes and dots keep
// their size at any zoom. Star-dots appear once zoomed in far enough.
//
// const map = createMap({ onHit, onDrop, canDrop, onRefuse, draggable });
// map.update({ state, view, content, sel, mode, layer, roles, dots, designs, centerDot, animate, pills, fx, prize, hold });
//
// The map keeps one element (and its camera) for its whole life, so a host that rebuilds its page
// on every change re-inserts map.el instead of making a new map.
//
// sel null | { kind: 'kite', id } | { kind: 'slot', kite, slot } | { kind: 'dot', id }
// | { kind: 'pos', coord } (an empty position) | { kind: 'central' } (the central star's dot)
// mode null | { kind: 'swapDot', from: { kite, slot } } | { kind: 'swapKite', kite }
// layer 'off' | 'constellation'
// constellation: a dark sky where kites and stars fade into the background and each
// star-dot is as bright as its strongest relation (either way; 5 full, 1 faint, none =
// background); with a star-dot selected, only its relations count.
// roles null | Map(dotId → 'focus' | 'up' | 'up-far' | 'implicit' | 'down' | 'down-far'): a focused
// star-dot's lineage and relations (see model.js linkRoles), ringed by role; the rest dim
// dots 'zoom' (default): star-dots appear once zoomed in | 'kite' (PLAY, round 6, U5): with the
// layer off, only the selected kite's (or selected star-dot's kite's) star-dots, at any
// zoom, plus, during a move, those it can go to; the layers show them as 'zoom' does
// | 'all' (the player's PLAY, round 9, Y15): every star-dot at any zoom (empty kite slots not shown)
// designs null (solid kites) | kiteId → design | null (PLAY's Designs, U11): open kites with a
// design are painted with it, in their progress color (shared/ui/kiteDesigner.js)
// centerDot true (PLAY, round 7, V7): a dot at the central star's center, a target { kind: 'central' }
// (it opens the central star's screen)
// pills [{ action, label, title }]: small pills beside the selected star-dot, each
// a target { kind: 'pill', action, id } (PLAY: ↗ Open, Deploy or Withdraw); 
// or beside the selected kite (PLAY: ↻ Rotate, Swap kite…, 🖌 its design), `id` the kite
// animate true (PLAY, round 7, V12): a change of the state animates for ANIM_MS: each kite and
// star-dot is drawn where it now is, with a transform easing from where it was (a rotate
// turns star-dots along their kite, a swap slides them, a carried branch turns and slides
// as a whole). a star that appears grows into place from its star-dot; one
// that goes shrinks back into it. Pointer input waits for it to end. Nothing animates
// with the system's reduce-motion setting, on the first draw, or after refit() (another save).
// fx true (P9, 9a; Design › Fun › Bursts): moments, drawn on top (layer-fx) under the same
// conditions: a star-dot that ignites bursts (rays and a ring in its category's color, bigger at a
// Zenith); a star whose every star-dot is now ignited goes supernova (a ring pulse, its kites
// flooding out from its center), and the camera glides to it when it's off toward the edge.
// prizes [{ i, key, near, claimed, icon, colors? }] (9b, the bonus ladder; colors: a palette's six, drawn as a ring of dots): a claimable prize, its icon alone (no words) in a
// badge in the hexagonal hole between three stars' positions (each triangle of the lattice leaves one,
// whether or not stars stand there) nearest the star-dot `near` that earned it (else the center),
// sized to fit inside it; a target { kind: 'prize' }. As it goes (claimed),
// it bursts there (with fx).
// cycling [{ id, text, mine }] (9d): the prize comets, each circling across the map all session in
// its own lane, staggered, off-screen only for a moment between crossings (a prize comet's own look;
// the player's own in theirs). Under reduce-motion they sit still near the top.
// starPills [{ star, action, label, title }] (9c): a pill beside each of those stars (⟲ Spin), a
// target { kind: 'pill', action, id: star }.
// comet { id, text, mine } (9d): the next comet to fly. It crosses the map behind the lattice
// (layer-sky), its message as its tail, then onCometDone(id); it waits while `hold` is set. Under
// reduce-motion it shows still, near the top, for a few seconds instead.
// reveal true (9e, Design › Fun › Constellation reveal): with the layer off, two related star-dots
// both ignited are joined by a faint glowing line (brighter for a stronger relation); one revealed
// by a change draws itself from end to end (a moment, with fx).
// spin { star, kite, t0, icons: kiteId → icon } (9c, Spin the star): the star turns like a pinwheel
// for SPIN_MS, easing to a stop with `kite` at the top under a pointer, stays a moment, then turns
// back the short way to where it was; each kite shows its outcome's icon meanwhile. Under
// reduce-motion it stops there at once (and is put back when the spin ends).
// hold true (a question popout or a star-dot's screen is open over the map): the map keeps drawing
// the board as it was when the hold began (the rest of the props live), so nothing animates under
// the box; once hold is false the change since then animates (stars deploying or withdrawing,
// star-dots moving) and its moments play, as any change does. Under reduce-motion, or with
// neither animate nor fx, nothing is held.
//
// A kite-less star (view.kiteless, Kites in: Central star only) has no kites or
// spokes drawn. it is a faint six-pointed star shape in its category's color (one
// outline, a faint fill, no kite lines; class kiteless-star), with its star-dots on top. Each
// spoke's star-dots sit along its direction, the Zenith at the tip and each further ring closer in;
// its star-dots and the empty slots its per-star count offers show at any zoom and under any `dots`
// rule. A kite-less star that appears grows (shape and star-dots) out of its star-dot; one that goes
// shrinks back into it. Once its category is complete it's drawn filled instead (Y13, below).
// With questions on (view.opts.questions), a star-dot not yet answered correctly is
// drawn fully faded (class q-faded), an answered one in full color (q-lit).
// A category's goal star-dot slowly fades in and out (q-goal); a category complete
// this session has its central kite and its stars drawn filled in its color, with no star-dots
// (a kite-less star as a filled star shape), each twinkling with its own phase (kite complete).
// Neither moves with the system's reduce-motion setting (map.css).
// An empty slot is a very small filled dot; a kite with no star-dots is a dashed
// outline, inert unless a kite being swapped may go there; a star-dot with a Due date that isn't
// complete is drawn under any `dots` rule and fades to clear and back, faster the sooner it's due
// (Z17, dueSpeed); with questions on, a Zenith waiting for the star-dots inside it has a padlock.
//
// Input: drag empty space (or anything not draggable) to pan; scroll or pinch (two fingers) to
// zoom; click or tap to select: onHit(target), target one of the `sel` shapes (or a pill), or null
// for empty space. Dragging a star-dot (or the selected kite) drops it on another target: onDrop(from, to),
// where `to` may also be { kind: 'shelf' } (an element with data-shelf, outside the map).
// canDrop(from, to) says which targets light up while dragging; a drop anywhere else calls
// onRefuse(from, to) (to may be null), so the host can say why. External drags (from the shelf
// strip) use map.targetAt(clientX, clientY) and map.setDragging(from). With draggable: false
// nothing is dragged.

import { svg } from '../dom.js';
import { createCamera } from '../camera.js';
import { DIRS, coordKey, addCoord, neighbors, latticeRing, toPixel } from '../lattice.js';
import { TWINKLES, GOAL_SLOWER } from '../color.js';

/**
 * How fast a star-dot's Due date twinkles, or null (no Due date, or complete):
 * 'fast' due within a day or overdue, 'normal' within 3 days, 'slow' within a week, else 'veryslow'
 * (TWINKLES' periods; GOVERN's Twinkle speed doesn't change these).
 */
export function dueSpeed(view, d, now = view.opts?.now ?? Date.now()) {
  const due = d && view.prop?.(d, 'due');
  if (!due || !['open', 'training'].includes(view.effective(d).status)) return null;
  const days = (Date.parse(due + 'T23:59:59') - now) / 86400000;
  return days <= 1 ? 'fast' : days <= 3 ? 'normal' : days <= 7 ? 'slow' : 'veryslow';
}
import { slotAngle, kite as kitePoints, polar, scaleAbout, miniStar, halfStar, svgPoints } from '../star.js';
import { kiteFill } from '../color.js';
import { designNodes } from './kiteDesigner.js';
import { cometNode, bannerWidth, lane, skyDefs, seeded, COMET_MS, PARKED_MS } from './sky.js';
import { KITES, ZENITH, index, overCount } from '../engine/index.js';

const TIP = 0.5;              // star tip radius in world units: neighboring tips touch
const MINI = 0.55;            // the star-dot skeleton: the kite scaled about its midpoint
const DOT_SCALE = 70;         // px per world unit from which star-dots are drawn
const ZOOM_STEP = 1.1;
const CLICK_SLOP = 6;         // pixels the pointer may move and still count as a click (fingers wobble)
const FORWARD = [2, 3, 4];    // E, SE, SW: each lattice edge once
/**
 * A completed category's twinkle phase, from the star's lattice position: one of
 * three, (q − r) mod 3, so no two neighboring stars twinkle together (each of a position's six
 * neighbors has another). The central star (and its kites) is phase 0. `period` is the
 * content set's Twinkle speed (ms per cycle), which map.css reads as --twinkle-period.
 */
const phaseOf = ([q, r], period) => `${-(((q - r) % 3 + 3) % 3) * Math.round(period / 3)}ms`;

const ANIM_MS = 300;
const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const nextFrame = f => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : setTimeout(f, 16).unref?.());   // (unref: outside a browser, a loop that runs on doesn't keep a check from ending)
const clock = () => globalThis.performance?.now?.() ?? Date.now();
const BURST_MS = 900;
const NOVA_MS = 1500;
const GLIDE_MS = 700;
const CYCLE_SPEED = 40;        // 9d: a prize comet's pace (px a second), far off and unhurried
const CYCLE_REST_MS = 45000;  // …and its rest out of view between crossings
const SPIN_MS = 2600;         // 9c: a spin's turn (actions.js waits as long to say what it landed on)
const SPIN_HOLD_MS = 1200;    // …then it stays, the kite it landed on at the top
const SPIN_BACK_MS = 1000;    // …then turns back to where it was
const easeOut = x => 1 - (1 - x) ** 3;
const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
const classOf = n => n.getAttribute?.('class') ?? '';

/**
 * A shown star's drawing in world coordinates: { center, bare (kite-less, Y4), kites: [{ k, angle,
 * pts (its kite polygon), spots: [[x, y] × 4] (where each slot's star-dot goes) }] }.
 */
function starLayout(st, view, s) {
  const { coord, turn } = view.place(s);
  const center = toPixel(coord);
  const bare = !!view.kiteless?.(s);
  return {
    center, bare,
    kites: st.stars[s].kites.map((k, i) => {
      const angle = slotAngle((i + turn) % KITES);
      const pts = kitePoints(angle, TIP).map(([x, y]) => [center[0] + x, center[1] + y]);
      const mid = polar(TIP / 2, angle);
      // A kite-less star's star-dots sit where its (hidden) kites' would, like the central star's.
      const spots = scaleAbout(pts, [center[0] + mid[0], center[1] + mid[1]], MINI);
      return { k, angle, pts, spots };
    }),
  };
}

/**
 * Where each shown star's kites and star-dots are, in world coordinates: { kites: id → { c, a, star },
 * dots: id → [x, y], dotStar: id → star, source: star → its star-dot }.
 */
function poses(st, view) {
  const kites = new Map();
  const dots = new Map();
  const dotStar = new Map();
  const source = new Map();
  for (const s of view.shownStars()) {
    source.set(s, st.stars[s].sources[0] ?? null);
    const { center, kites: list } = starLayout(st, view, s);
    for (const { k, angle, spots } of list) {
      kites.set(k, { c: center, a: angle, star: s });
      st.kites[k].dots.forEach((d, slot) => { if (d) { dots.set(d, spots[slot]); dotStar.set(d, s); } });
    }
  }
  return { kites, dots, dotStar, source };
}

/**
 * 9b: where a prize goes: the centre of the hexagonal hole nearest star-dot `near` (else the
 * central star). Each lattice triangle leaves a regular hexagonal hole at its centroid, between the
 * three stars' tips and waists (tips 0.5 from a star's center, waists 0.5/√3; corners 0.29 from it).
 */
export function prizeSpot(st, view, near, taken = new Set()) {
  const at = near ? poses(st, view) : null;
  const point = at?.dots.get(near);
  const star = point && at.dotStar.get(near);
  const coord = star ? view.place(star).coord : [0, 0];
  const p = point ?? toPixel(coord);
  // The holes around its star, then around the positions next to it (as far as it takes), nearest
  // first; a hole another prize holds is skipped (the next nearest empty one).
  const holesOf = c => { const cp = toPixel(c); const ns = neighbors(c).map(n => toPixel(n)); return ns.map((a, i) => { const b = ns[(i + 1) % 6]; return [(cp[0] + a[0] + b[0]) / 3, (cp[1] + a[1] + b[1]) / 3]; }); };
  let ring = [coord];
  const seen = new Set();
  for (let r = 0; r < 4; r++) {
    const holes = ring.flatMap(holesOf).filter(h => { const k = h.map(v => v.toFixed(4)).join(); if (seen.has(k)) return false; seen.add(k); return true; });
    const free = holes.filter(h => !taken.has(h.map(v => v.toFixed(4)).join())).sort((a, b) => Math.hypot(a[0] - p[0], a[1] - p[1]) - Math.hypot(b[0] - p[0], b[1] - p[1]));
    if (free.length) return free[0];
    ring = [...new Map(ring.flatMap(c => [c, ...neighbors(c)]).map(c => [coordKey(c), c])).values()];
  }
  return toPixel(coord);
}
/** A hole's key (its center, rounded), for keeping track of which are taken. */
const holeKey = h => h.map(v => v.toFixed(4)).join();
const PRIZE_R = 0.05;         // a prize badge's radius in world units (its glow 1.4 times that: well inside the hole)

/**
 * 9e: the relations revealed: each relation between two star-dots both ignited and on the map, one
 * per direction ({ a, b (from and to, world), key 'from>to', from, to, score, how, lane: the other
 * way is there too, so each keeps to its own side, like a two-lane road }).
 */
function revealed(st, view) {
  const at = poses(st, view).dots;
  const lit = d => at.has(d) && view.effective(d).status === 'ignited';
  const out = new Map();
  for (const [a, dot] of Object.entries(st.dots)) {
    if (!lit(a)) continue;
    for (const r of dot.relations ?? []) {
      if (r.dot === a || !lit(r.dot)) continue;
      const lane = (st.dots[r.dot].relations ?? []).some(x => x.dot === a);
      out.set(`${a}>${r.dot}`, { a: at.get(a), b: at.get(r.dot), key: `${a}>${r.dot}`, from: a, to: r.dot, score: r.score ?? 3, how: r.how ?? '', lane });
    }
  }
  return out;
}
/** 9e, Nebula fog: how long it takes to clear to a new ring; the maps' ids; a ring's width (world units). */
const FOG_MS = 1800;
let fogCount = 0;
const RING = Math.hypot(...toPixel([1, 0]));
/** Every lattice position within ring n. */
function ringsUpTo(n) {
  const seen = new Map([[coordKey([0, 0]), [0, 0]]]);
  let edge = [[0, 0]];
  for (let k = 0; k < n; k++) {
    const next = [];
    for (const c of edge) for (const m of neighbors(c)) if (!seen.has(coordKey(m))) { seen.set(coordKey(m), m); next.push(m); }
    edge = next;
  }
  return [...seen.values()];
}
/** The fog's clear radius for a view: past the outermost shown star's ring and its tips. */
function clearRadius(view) {
  const ring = Math.max(0, ...view.shownStars().filter(view.place).map(s => latticeRing(view.place(s).coord)));
  return ring * RING + TIP * 1.1;
}

/** Two points moved `off` px to the right of the way a → b (screen space): its lane. */
function inLane([x1, y1], [x2, y2], off) {
  if (!off) return [[x1, y1], [x2, y2]];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const [nx, ny] = [-(y2 - y1) / len * off, (x2 - x1) / len * off];
  return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny]];
}
const REVEAL_LANE = 2.6;   // px each side of the middle, for a revealed relation with one each way

/** Opacity for a relation score 1–5 (1 faint, 5 full), or the background level for none. */
const glow = s => (s ? 0.25 + 0.75 * (s - 1) / 4 : 0.07);

export function createMap({ onHit = () => {}, onDrop = () => {}, canDrop = () => false, onRefuse = () => {}, onCometDone = () => {}, draggable: canDrag = true } = {}) {
  const el = svg('svg', { class: 'sl-map', role: 'img', 'aria-label': 'Starfield map' });
  const camera = createCamera();
  let props = null;
  let fitted = false;
  let sized = false;
  let drag = null;              // { from, at: [x, y] } while dragging something
  let external = null;          // a drag from outside (the shelf strip)
  let anim = null;              // V12: { from, to, t0, leaving, origins } while a change animates
  let skipAnim = false;         // the next change doesn't animate (after refit: another save)
  let fx = [];                  // 9a: moments on top: { node, inner, kind, at (world), t0, ms, s0 (scale when made) }
  let glide = null;             // 9a: { to (world), t0 } while the camera glides to a supernova
  let prizeAt = new Map();      // 9b: each prize on the field (rung i) → the world point it's drawn at
  let spinning = null;          // 9c: { t0, turn (degrees, all of it), star } for the spin in props
  let flying = null;            // 9d: { id, text, mine, start, still } while a comet crosses
  const cycleFrom = new Map();  // 9d: a prize comet's id → when it first showed (its crossings count from then)
  const skyLayer = svg('g', { class: 'layer-sky', 'pointer-events': 'none' });
  let held = null;              // { state, view } drawn while a box is open over the map (hold)
  const fxLayer = svg('g', { class: 'layer-fx', 'pointer-events': 'none' });
  // Relation lines (the layer's arrows, the revealed lines): the one hovered sparkles; a click pins its label.
  let relDrawn = new Map();      // key 'from>to' → { node, ends: [[ax, ay], [bx, by]] (screen), from, to, how, score }
  let hoverKey = null;           // the relation under the pointer
  let pinned = null;             // the relation whose label shows (clicked)
  // 9e, Nebula fog: the sky past the outermost star's ring, clearing ring by ring.
  const fogId = `sl-fog-${++fogCount}`;
  const skyId = `sl-sky-${fogCount}`;   // the starry background's patterns
  const starfield = svg('g', { class: 'layer-starfield', 'pointer-events': 'none' });
  let fogAnim = null;           // { from, to (world radii), t0 } while it clears
  let fogGrad = null;           // the mask's gradient, drawn last (its radius set each frame while it clears)

  const fit = () => {
    if (!props || !sized) return;
    const { state, view } = props;
    const rings = Object.keys(state.stars).filter(view.place).map(s => latticeRing(view.place(s).coord));
    camera.fitBoard(Math.max(1, ...rings));   // the central star and ring 1 at least (their tips 1.5 out), the rest when they're there
    fitted = true;
    render();
  };

  function render() {
    if (!props || !sized) return;
    if (!fitted) return fit();
    const fade = props.content?.rules?.fade ?? 'darken';   // The content set's fade rule
    // The content set's Twinkle speed and Background lattice.
    const period = Object.hasOwn(TWINKLES, props.content?.rules?.twinkle ?? '') ? TWINKLES[props.content.rules.twinkle] : TWINKLES.normal;
    const latticeShown = props.content?.rules?.lattice !== 'hidden';
    const finish = ['crystal', 'glass'].includes(props.content?.rules?.finish) ? props.content.rules.finish : 'flat';
    const { state: st, view, content, sel, mode, layer = 'off', roles, dots: dotRule = 'zoom', designs: designOf = null, centerDot = false, pills = [] } = props;
    const scr = p => camera.worldToScreen(p);
    const colorOf = cat => (cat == null ? null : content.categories[cat].color);
    const constellation = layer === 'constellation';
    const out = { lattice: [], marks: [], stars: [], lines: [], dots: [], top: [] };
    relDrawn = new Map();
    const dragging = drag?.from ?? external;
    const target = to => !!dragging && canDrop(dragging, to);

    const shown = view.shownStars();
    const occupied = new Set(shown.map(s => coordKey(view.place(s).coord)));
    const focus = sel?.kind === 'dot' ? sel.id : null;
    const focusAt = focus ? index(st).dot.get(focus) : null;
    // Faint lattice: shown stars and their neighbors; empty positions are clickable. (Round 8, X5:
    // nothing is drawn for a star before it's deployed.)
    const around = new Map();
    for (const s of shown) for (const c of [view.place(s).coord, ...neighbors(view.place(s).coord)]) around.set(coordKey(c), c);
    // Each prize its own hole, in ladder order: the nearest empty one to the star-dot that earned it.
    prizeAt = new Map();
    const taken = new Set();
    for (const pz of props.prizes ?? []) {
      const h = prizeSpot(st, view, pz.near, taken);
      taken.add(holeKey(h));
      if (!pz.claimed) prizeAt.set(pz.i, h);
    }
    for (const c of around.values()) {
      const [x1, y1] = scr(toPixel(c));
      for (const slot of FORWARD) {
        const n = addCoord(c, DIRS[slot]);
        if (!around.has(coordKey(n))) continue;
        const [x2, y2] = scr(toPixel(n));
        const both = occupied.has(coordKey(c)) && occupied.has(coordKey(n));
        if (latticeShown) out.lattice.push(svg('line', { x1, y1, x2, y2, class: both ? 'lattice-star' : 'lattice' }));
      }
      if (occupied.has(coordKey(c))) continue;
      const selected = sel?.kind === 'pos' && coordKey(sel.coord) === coordKey(c);
      // With the lattice hidden its points stay clickable, drawn only on hover or when selected.
      out.lattice.push(svg('g', { class: 'pos' + (selected ? ' selected' : '') + (latticeShown ? '' : ' quiet'), dataset: { hit: 'pos', coord: coordKey(c) } },
        svg('circle', { cx: x1, cy: y1, r: 10, class: 'hit' }), svg('circle', { cx: x1, cy: y1, r: 2.5, class: 'lattice-point' })));
    }

    // Stars and kites; star-dot positions (for the dots and the relations layer).
    const showDots = constellation || camera.scale() >= DOT_SCALE;
    const dotR = Math.min(7, Math.max(2.6, camera.scale() * 0.03));
    const selKite = sel?.kind === 'kite' ? sel.id : null;
    const selStar = selKite && index(st).kite.get(selKite)?.star;
    // dots: 'kite': with the layer off, the selected kite's star-dots (or the selected star-dot's
    // or slot's kite), and during a move the slots it can go to.
    const openKite = selKite ?? (sel?.kind === 'slot' ? sel.kite : focusAt?.kite ?? null);
    const modeFrom = mode?.kind === 'swapDot' && st.kites[mode.from.kite]
      ? (st.kites[mode.from.kite].dots[mode.from.slot] ? { kind: 'dot', id: st.kites[mode.from.kite].dots[mode.from.slot] } : { kind: 'slot', ...mode.from })
      : null;
    const mover = dragging ?? modeFrom;
    const dotShown = (k, hit) => (dotRule === 'all' ? hit.kind === 'dot'
      : dotRule !== 'kite' || layer !== 'off' ? showDots || (hit.kind === 'dot' && !!dueSpeed(view, hit.id))
      : k === openKite || (!!mover && mover.kind !== 'kite' && canDrop(mover, hit)) || (hit.kind === 'dot' && !!dueSpeed(view, hit.id)));   // Z17: due ones always
    const kitePts = new Map();   // kiteId → screen polygon (for the selected kite's pills, Z12)
    // Z14: the kite being swapped (Swap kite… or a drag), whose allowed targets empty kites become.
    const kiteFrom = mode?.kind === 'swapKite' ? { kind: 'kite', id: mode.kite } : mover?.kind === 'kite' ? mover : null;
    const dotAt = new Map();     // dotId → screen [x, y]
    const starAt = new Map();    // starId → screen [x, y]
    const slots = [];
    for (const s of shown) {
      const { center, bare, kites: layout } = starLayout(st, view, s);
      starAt.set(s, scr(center));
      // The per-star count's slots, on every star (the central one too). under
      // Independent (a projected state) an empty slot has no item coming, so none is drawn.
      const offered = st.projected ? [] : view.usableSlots?.(s) ?? [0, 1, 2, 3];
      const centralStar = !st.stars[s].sources.length;
      // Z1: a kite-less star's own shape, unless its category is complete (then its kites are drawn filled below).
      const shapeColor = st.kites[st.stars[s].kites[0]].color;
      if (bare && !(view.opts?.questions === 'on' && shapeColor != null && st.complete?.[shapeColor] != null)) {
        const outline = layout.flatMap(({ pts }) => [pts[2], pts[3]]);   // each kite's tip, then its right waist: the six-pointed star
        out.stars.push(svg('polygon', {
          points: svgPoints(outline.map(scr)), class: 'kiteless-star', 'pointer-events': 'none', dataset: { kite: layout[0].k, star: s },
          fill: colorOf(shapeColor) ?? '#9aa4b2', stroke: colorOf(shapeColor) ?? '#9aa4b2',
        }));
        if (finish !== 'flat') out.stars.push(finishNode(finish, layout.map(({ pts }) => pts.map(scr)), scr(center), s, layout[0].k, true));
      }
      const plain = new Map();   // this star's kites drawn in plain color (no design): their finish goes over them
      layout.forEach(({ k, pts, spots }) => {
        const kite = st.kites[k];
        const open = view.kiteOpen(k);
        const color = colorOf(kite.color);
        // Y13: a completed category: filled in its color, twinkling, no star-dots.
        if (view.opts?.questions === 'on' && kite.color != null && st.complete?.[kite.color] != null) {
          // With a design (Kites: Designs), the design stays, twinkling with the kite in the category's
          // color; the plain fill under it goes (so its Clear stays a hole) but still takes the clicks.
          const design = designOf ? designOf(k) : null;
          const phase = phaseOf(view.place(s).coord, period);
          out.stars.push(svg('polygon', {
            points: svgPoints(pts.map(scr)), class: 'kite complete' + (design ? ' designed' : ''), dataset: { hit: 'kite', id: k, phase }, fill: color,
            style: { '--c': color, animationDelay: phase },
          }, svg('title', {}, `${content.categories[kite.color]?.name ?? 'Category'}: complete`)));
          if (!design) plain.set(k, pts.map(scr));
          if (design) out.stars.push(svg('g', { class: 'kite-design complete', 'pointer-events': 'none', dataset: { kite: k }, style: { animationDelay: phase } }, designNodes(design, pts.map(scr), color, `map-clip-${k}`)));
          return;
        }
        if (bare) {
          // Y4: star-dots only, and the empty slots its count offers, whatever the zoom or dots rule.
          kite.dots.forEach((d, slot) => {
            if (d) dotAt.set(d, scr(spots[slot]));
            if (d || offered.includes(slot)) slots.push({ d, k, slot, at: scr(spots[slot]), color, open, bare: true });
          });
          return;
        }
        kitePts.set(k, pts.map(scr));
        // Z14: a kite with no star-dots: a dashed outline in its color, inert unless a kite is being swapped.
        if (kite.dots.every(x => !x)) {
          const live = !!kiteFrom && canDrop(kiteFrom, { kind: 'kite', id: k });
          out.stars.push(svg('polygon', {
            points: svgPoints(pts.map(scr)), class: 'kite empty' + (live ? ' target' : ''),
            ...(live ? { dataset: { hit: 'kite', id: k } } : { 'pointer-events': 'none', dataset: { id: k } }),
            fill: live ? 'transparent' : 'none', stroke: color ?? '#9aa4b2', style: { '--kite-stroke': color ?? '#9aa4b2' },
          }, svg('title', {}, `${kite.name || 'Kite'} (empty)`)));
          const mini = spots.map(scr);
          kite.dots.forEach((d, slot) => {
            if (offered.includes(slot) && dotShown(k, { kind: 'slot', kite: k, slot })) slots.push({ d, k, slot, at: mini[slot], color, open });
          });
          return;
        }
        const cls = ['kite', !open && 'locked', k === selKite && 'selected',
          mode?.kind === 'swapKite' && mode.kite === k && 'source', drag?.from.kind === 'kite' && drag.from.id === k && 'source',
          target({ kind: 'kite', id: k }) && 'target'].filter(Boolean).join(' ');
        // designs: an open kite with a design is painted with it, in its progress color; the
        // polygon on top stays for clicks and outlines.
        const fill = color == null ? null : open ? kiteFill(color, view.kiteLevel(k), fade) : null;
        const design = designOf && fill ? designOf(k) : null;
        if (design) out.stars.push(svg('g', { class: 'kite-design', 'pointer-events': 'none', dataset: { kite: k } }, designNodes(design, pts.map(scr), fill, `map-clip-${k}`)));
        out.stars.push(svg('polygon', {
          points: svgPoints(pts.map(scr)), class: cls + (design ? ' designed' : ''), dataset: { hit: 'kite', id: k },
          fill: design ? 'transparent' : fill,
        }, svg('title', {}, `${kite.name || 'Kite'}${open ? '' : ' (locked)'}`)));
        if (fill && !design) plain.set(k, pts.map(scr));
        const mini = spots.map(scr);
        kite.dots.forEach((d, slot) => {
          if (d) dotAt.set(d, mini[slot]);
          if ((d || offered.includes(slot)) && dotShown(k, d ? { kind: 'dot', id: d } : { kind: 'slot', kite: k, slot })) slots.push({ d, k, slot, at: mini[slot], color, open });
        });
      });
      // The kite finish (Design › Look): over the plain kites only, never a design.
      if (finish !== 'flat' && plain.size) out.stars.push(finishNode(finish, [...plain.values()], scr(center), s, [...plain.keys()][0], false));
    }

    // Relations: who relates to what, and how strongly (each star-dot's strongest, for constellations).
    const strength = new Map();
    const relations = [];
    if (constellation) {
      for (const d of dotAt.keys()) {
        for (const r of st.dots[d].relations) {
          if (!dotAt.has(r.dot)) continue;
          const counts = !constellation || !focus || d === focus || r.dot === focus;
          relations.push({ from: d, to: r.dot, score: r.score, how: r.how, counts });
          if (!counts) continue;
          for (const x of [d, r.dot]) strength.set(x, Math.max(strength.get(x) ?? 0, r.score));
        }
      }
      if (focus) strength.set(focus, 5);
    }
    const name = d => st.dots[d].name || 'unnamed';
    if (constellation) {
      // travel (9e, the layer just turned on): each line travels from its origin to its target, one after another.
      const travel = props.travel ? relations.filter(r => r.counts) : [];
      const ways = new Set(relations.map(r => `${r.from}>${r.to}`));
      for (const r of relations) {
        const width = 0.6 + r.score * 0.5;
        const key = `${r.from}>${r.to}`;
        // One each way between the same two: side by side, each on its own right (a two-lane road).
        const [a, b] = inLane(dotAt.get(r.from), dotAt.get(r.to), ways.has(`${r.to}>${r.from}`) ? 1.2 + width / 2 : 0);
        const color = colorOf(view.categoryOf(r.to)) ?? '#ffffff';
        const opacity = constellation ? (r.counts ? glow(r.score) : 0.04) : 0.9;
        const t = travel.indexOf(r);
        const node = arrow(a, b, dotR * 1.6, width, color, opacity, key, t < 0 ? null : (1.2 * t) / Math.max(1, travel.length - 1));
        relDrawn.set(key, { node, ends: trimmed(a, b, dotR * 1.6), from: name(r.from), to: name(r.to), how: r.how, score: r.score });
        out.lines.push(node);
      }
    }

    for (const { d, k, slot, at, color, open, bare } of slots) {
      // With every star-dot a question, a Zenith waiting for those inside it isn't shown until it can be answered.
      if (d && view.opts?.questions === 'on' && view.insideFirst?.(d)) continue;
      const selected = d ? d === focus : sel?.kind === 'slot' && sel.kite === k && sel.slot === slot;
      const source = (mode?.kind === 'swapDot' && mode.from.kite === k && mode.from.slot === slot) || (drag?.from.kind === 'dot' && drag.from.id === d);
      const hit = d ? { kind: 'dot', id: d } : { kind: 'slot', kite: k, slot };
      const opacity = constellation ? (d ? glow(strength.get(d)) : 0.05) : null;
      const role = roles?.size ? (d && roles.get(d)) || 'dim' : null;
      const goal = !!d && view.opts?.questions === 'on' && Object.values(st.goals ?? {}).includes(d);
      out.dots.push(dotMark(st, view, d, at, dotR, color, { selected, source, open, target: target(hit), opacity, role, bare, goal },
        d ? { hit: 'dot', id: d } : { hit: 'slot', kite: k, slot: String(slot) }, content.dotNames[slot]));
    }
    // The central star's own dot: it opens the central star's screen.
    if (centerDot) {
      const [x, y] = scr(toPixel([0, 0]));
      const r = Math.max(5, Math.min(11, camera.scale() * 0.05));
      out.top.push(svg('g', { class: 'central-dot' + (sel?.kind === 'central' ? ' selected' : ''), dataset: { hit: 'central' } },
        svg('circle', { cx: x, cy: y, r: r * 2, class: 'hit' }), svg('circle', { cx: x, cy: y, r, class: 'central-dot-mark' }),
        svg('title', {}, `${content.title || 'The central star'}: open its screen`)));
    }
    // X7: pills beside the selected star-dot (↗ Open, Deploy or Withdraw), each a target of its own;
    // Or beside the selected kite, right of its rightmost point.
    const focusSlot = focus && pills.length ? slots.find(s => s.d === focus) : null;
    const kiteAt = !focusSlot && selKite && pills.length && kitePts.get(selKite);
    const anchor = focusSlot ? { x: focusSlot.at[0] + dotR * 2.6 + 6, y: focusSlot.at[1], id: focus }
      : kiteAt ? { x: Math.max(...kiteAt.map(p => p[0])) + 8, y: kiteAt.reduce((n, p) => n + p[1], 0) / kiteAt.length, id: selKite } : null;
    if (anchor) {
      let { x } = anchor;
      const { y, id } = anchor;
      const row = pills.map(({ action, label, title }) => {
        const w = 14 + [...label].length * 7 + (/\p{Extended_Pictographic}/u.test(label) ? 6 : 0);
        const g = svg('g', { class: `dot-pill ${action}`, dataset: { hit: 'pill', action, id } },
          svg('title', {}, title ?? label),
          svg('rect', { x, y: y - 11, width: w, height: 22, rx: 11 }),
          svg('text', { x: x + w / 2, y: y + 4 }, label));
        x += w + 5;
        return g;
      });
      out.top.push(svg('g', { class: 'dot-pills' }, row));
    }
    for (const sp of props.starPills ?? []) {
      if (!view.place(sp.star)) continue;
      const [cx, cy] = scr(starLayout(st, view, sp.star).center);
      const x = cx + camera.scale() * (TIP + 0.08), y = cy - camera.scale() * TIP * 0.55;
      const w = 16 + [...sp.label].length * 7;
      out.top.push(svg('g', { class: `dot-pill star-pill ${sp.action}`, dataset: { hit: 'pill', action: sp.action, id: sp.star } },
        svg('title', {}, sp.title ?? sp.label),
        svg('rect', { x, y: y - 11, width: w, height: 22, rx: 11 }),
        svg('text', { x: x + w / 2, y: y + 4 }, sp.label)));
    }
    for (const pz of props.prizes ?? []) {
      if (pz.claimed || !prizeAt.has(pz.i)) continue;
      const [x, y] = scr(prizeAt.get(pz.i));
      const r = Math.max(2.5, camera.scale() * PRIZE_R);   // well inside the hole (its inradius is 0.25)
      out.top.push(svg('g', { class: 'prize', dataset: { hit: 'prize', prize: pz.key, i: String(pz.i) }, role: 'button', 'aria-label': 'A prize' },
        svg('circle', { cx: x, cy: y, r: r * 1.4, class: 'prize-glow' }),
        svg('circle', { cx: x, cy: y, r, class: 'prize-badge' }),
        (pz.colors ?? []).map((c, i) => {
          const t = (i * Math.PI) / 3 - Math.PI / 2;
          return svg('circle', { cx: x + Math.cos(t) * r * 0.58, cy: y + Math.sin(t) * r * 0.58, r: r * 0.2, fill: c, class: 'prize-color' });
        }),
        pz.icon && svg('text', { x, y: y + r * 0.36, class: 'prize-icon', 'font-size': r * (pz.colors ? 0.8 : 1.05), 'text-anchor': 'middle' }, pz.icon)));
    }
    if (props.spin && view.place(props.spin.star)) {
      const { center, kites: lay } = starLayout(st, view, props.spin.star);
      const [cx, cy] = scr(center);
      const s = camera.scale();
      out.top.push(svg('g', { class: 'spin-icons', 'pointer-events': 'none' }, lay.map(({ k, angle }) => {
        const [ix, iy] = [cx + Math.cos(angle * Math.PI / 180) * s * TIP * 0.62, cy + Math.sin(angle * Math.PI / 180) * s * TIP * 0.62];
        return svg('text', { x: ix, y: iy + s * 0.04, class: 'spin-icon', 'font-size': Math.max(9, s * 0.12), 'text-anchor': 'middle', dataset: { kite: k } }, props.spin.icons?.[k] ?? '');
      })));
      const top = cy - s * (TIP + 0.06);   // the pointer, above the star's top
      out.top.push(svg('polygon', { class: 'spin-pointer', 'pointer-events': 'none', points: svgPoints([[cx, top + s * 0.07], [cx - s * 0.05, top - s * 0.03], [cx + s * 0.05, top - s * 0.03]]) }));
    }
    if (drag?.at) out.top.push(svg('circle', { cx: drag.at[0], cy: drag.at[1], r: 9, class: 'drag-ghost' }));

    // 9e: the constellation revealed so far (the layer off: the relations layer draws its own).
    if (props.reveal && layer === 'off') {
      for (const r of revealed(st, view).values()) {
        const [a, b] = inLane(scr(r.a), scr(r.b), r.lane ? REVEAL_LANE : 0);
        const node = revealNode(a, b, dotR * 1.8, r);
        relDrawn.set(r.key, { node, ends: trimmed(a, b, dotR * 1.8), from: st.dots[r.from].name || 'unnamed', to: st.dots[r.to].name || 'unnamed', how: r.how, score: r.score });
        out.lines.push(node);
      }
    }
    if (hoverKey && !relDrawn.has(hoverKey)) hoverKey = null;
    if (hoverKey) shine(hoverKey);
    if (pinned && !relDrawn.has(pinned)) pinned = null;
    if (pinned) out.top.push(relLabel(relDrawn.get(pinned), pinned));
    const fog = props.fog ? fogNode(st, view) : null;
    el.replaceChildren(
      svg('rect', { x: 0, y: 0, width: '100%', height: '100%', class: 'map-bg' }),
      ...(props.content?.rules?.starfield === 'on' ? [starfieldNode()] : []),   // the starry background, behind everything
      skyDefs(), skyLayer,   // 9d: the comets' dust; the sky behind the lattice and the stars
      svg('g', { class: 'layer-lattice' }, out.lattice), svg('g', { class: 'layer-marks' }, out.marks),
      svg('g', { class: 'layer-stars' }, out.stars), svg('g', { class: 'layer-lines' }, out.lines),
      ...(fog ? [fog] : []),   // 9e: over the empty sky, under the star-dots
      svg('g', { class: 'layer-dots' }, out.dots), svg('g', { class: 'layer-top' }, out.top));
    el.classList.toggle('picking', !!mode);
    el.classList.toggle('constellation', constellation);
    // 9e: a streak (from 3 right in a row): the lit star-dots twinkle brighter, faster from 5 and 10.
    const streak = props.streak ?? 0;
    el.classList.toggle('streak', streak >= 3);
    el.dataset.streak = streak >= 10 ? '10' : streak >= 5 ? '5' : streak >= 3 ? '3' : '';
    el.classList.toggle('no-lattice', !latticeShown);
    el.dataset.twinkle = String(period);   // round 13 (map.css reads the two periods)
    el.style.setProperty?.('--twinkle-period', `${period}ms`);
    el.style.setProperty?.('--goal-period', `${Math.round(period * GOAL_SLOWER)}ms`);
    el.classList.toggle('dragging', !!dragging);
    if (anim) { if (anim.leaving) el.append(anim.leaving); frame(); }
    el.append(fxLayer);
    drawFx();
    spinFrame();
    cometFrame(false);   // (drawn only: a comet ends from its own loop, never inside a render)
  }

  // ---- Comets (9d) ----
  /** Place the comet in flight for now; at the end, it's done (onCometDone). Returns whether it flies on. */
  function cometFrame(loop = true) {
    const cycling = props?.cycling ?? [];
    if (!flying && !cycling.length) { skyLayer.replaceChildren(); return false; }
    const { width, height } = el.getBoundingClientRect();
    // The prize comets: each in its lane, staggered, circling on (120 px a second).
    const still = reducedMotion();
    const now = clock();
    const circling = cycling.map((c, i) => {
      const w = bannerWidth(c.text) + 110;
      if (still) return cometNode(c.text, 24 + bannerWidth(c.text) + 70, height * 0.06 + 30 * i, 0, { mine: c.mine, prize: true });
      // Each crossing at its own height and tilt, anywhere from top to bottom (lane), so comets pass
      // above, below and behind the stars; slowly, as if far off (CYCLE_SPEED), then a long rest out
      // of view (CYCLE_REST_MS) before the next.
      const span = width + w + 20;   // the head from just off the left to where its tail has left on the right
      const cross = (span / CYCLE_SPEED) * 1000;
      const cycle = cross + CYCLE_REST_MS;
      if (!cycleFrom.has(c.id)) cycleFrom.set(c.id, now + i * 4000);   // from when it first shows: it sets off at once (a few at once, a little apart)
      const into = Math.max(0, now - cycleFrom.get(c.id));
      const at = into % cycle;
      if (at >= cross) return null;   // resting, out of view
      const { y, angle } = lane(c.id, Math.floor(into / cycle));
      return cometNode(c.text, -10 + (at / 1000) * CYCLE_SPEED, height * y, angle, { mine: c.mine, prize: true, t: now + i * 500 });
    }).filter(Boolean);
    if (!flying) { skyLayer.replaceChildren(...circling); return !still; }
    const t = clock() - flying.start;
    const ms = flying.still ? PARKED_MS : COMET_MS;
    if (t >= ms) {
      if (!loop) { skyLayer.replaceChildren(...circling); return circling.length > 0 && !still; }
      const id = flying.id;
      flying = null;
      skyLayer.replaceChildren(...circling);
      (globalThis.queueMicrotask ?? (f => f()))(() => onCometDone(id));
      return circling.length > 0 && !still;
    }
    const w = bannerWidth(flying.text) + 110;   // the banner and streak behind the head
    const p = t / ms;
    const path = lane(flying.id, flying.start);   // its own height and tilt
    const rad = (path.angle * Math.PI) / 180;
    const [x, y, angle] = flying.still
      ? [width / 2 + bannerWidth(flying.text) / 2, height * 0.12, 0]
      : [-40 + (width + w + 80) * p, height * path.y + Math.tan(rad) * (width + w + 80) * (p - 0.5), path.angle];   // left to right, along its tilt
    skyLayer.replaceChildren(...circling, cometNode(flying.text, x, y, angle, { mine: flying.mine, t: now }));
    return true;
  }
  /** A comet waiting in the props, and nothing in flight or over the map: off it goes. */
  let looping = false;   // the sky's loop is running
  const skyLoop = () => { if (cometFrame()) nextFrame(skyLoop); else looping = false; };
  function launchComet() {
    const c = props?.comet;
    if (c && !flying && !props.hold && sized && fitted) flying = { ...c, start: clock(), still: reducedMotion() };
    if ((flying || props?.cycling?.length) && !looping && sized && fitted) { looping = true; nextFrame(skyLoop); }
  }

  // ---- Spin the star (9c) ----
  /** Turn the spinning star's kites and star-dots (and its icons) to where the spin is now. */
  function spinFrame() {
    const sp = props?.spin;
    if (!sp || !spinning || spinning.t0 !== sp.t0 || !props.view.place(sp.star)) return false;
    // Turn, stop and stay a moment (the kite it landed on at the top), then turn back the short way
    // to where the star was.
    const t = clock() - spinning.start;
    const back = (((spinning.turn % 360) + 360) % 360) <= 180 ? -(((spinning.turn % 360) + 360) % 360) : 360 - (((spinning.turn % 360) + 360) % 360);
    const p = reducedMotion() ? 1 : Math.min(1, t / SPIN_MS);
    const q = reducedMotion() ? 0 : Math.max(0, Math.min(1, (t - SPIN_MS - SPIN_HOLD_MS) / SPIN_BACK_MS));
    const r = spinning.turn * easeOut(p) + back * ease(q);
    const { state: st, view } = props;
    const [cx, cy] = camera.worldToScreen(starLayout(st, view, sp.star).center);
    const kites = new Set(st.stars[sp.star].kites);
    const dots = new Set([...kites].flatMap(k => st.kites[k].dots).filter(Boolean));
    const turn = `rotate(${r} ${cx} ${cy})`;
    for (const layer of [...(el.children ?? [])].filter(n => ['layer-stars', 'layer-dots'].includes(classOf(n)))) {
      walk(layer, n => {
        const ds = n.dataset ?? {};
        const k = ds.hit === 'kite' || classOf(n).split(' ').includes('empty') ? ds.id : ds.kite;
        if ((k && kites.has(k) && (ds.hit === 'kite' || ds.hit === 'slot' || /kite-design|kiteless-star|kite-finish|empty/.test(classOf(n)))) || (ds.hit === 'dot' && dots.has(ds.id))) n.setAttribute('transform', turn);
      });
    }
    const icons = el.querySelector?.('.spin-icons') ?? null;
    icons?.setAttribute('transform', turn);
    for (const t of icons?.children ?? []) t.setAttribute('transform', `rotate(${-r} ${t.getAttribute?.('x') ?? 0} ${t.getAttribute?.('y') ?? 0})`);   // upright
    return !reducedMotion() && q < 1;
  }
  const spinLoop = () => { if (spinFrame()) nextFrame(spinLoop); };
  /** A new spin in the props: how far it turns, so its kite stops at the top. */
  function startSpin() {
    const sp = props.spin;
    const lay = starLayout(props.state, props.view, sp.star);
    const a = lay.kites.find(x => x.k === sp.kite)?.angle ?? -90;
    spinning = { t0: sp.t0, start: clock(), turn: 1080 + ((((-90 - a) % 360) + 360) % 360), star: sp.star };
    nextFrame(spinLoop);
  }

  // ---- The starry background (Design › Fun) ----
  /** Two depths of twinkling stars filling the sky, each a seamless tile shifted with a fraction of the pan. */
  function starfieldNode() {
    const [ox, oy] = camera.worldToScreen([0, 0]);
    const depth = (n, tile, count, drift, rMin, rMax, glowEvery) => {
      const r = seeded(`starfield:${n}`);
      const stars = Array.from({ length: count }, (_, i) => {
        const [x, y, rad] = [r() * tile, r() * tile, rMin + r() ** 2 * (rMax - rMin)];
        const tint = ['#ffffff', '#ffffff', '#dfe8ff', '#fff1d6'][Math.floor(r() * 4)];
        return svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: rad.toFixed(2), fill: tint,
          class: `sky-star t${i % 3}${glowEvery && i % glowEvery === 0 ? ' glow' : ''}`, style: { animationDelay: `${(-r() * 6).toFixed(2)}s` } });
      });
      const [dx, dy] = [((ox * drift) % tile + tile) % tile, ((oy * drift) % tile + tile) % tile];
      return [
        svg('pattern', { id: `${skyId}-${n}`, width: tile, height: tile, patternUnits: 'userSpaceOnUse', patternTransform: `translate(${dx.toFixed(1)} ${dy.toFixed(1)})` }, stars),
        svg('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: `url(#${skyId}-${n})`, class: `sky-depth d${n}` }),
      ];
    };
    const [p0, r0] = depth(0, 360, 110, 0.18, 0.3, 0.9, 0);    // far: many, small, slow
    const [p1, r1] = depth(1, 520, 46, 0.42, 0.5, 1.5, 9);      // near: fewer, brighter, a few glowing
    starfield.replaceChildren(svg('defs', {}, p0, p1), r0, r1);
    return starfield;
  }

  // ---- Nebula fog (9e) ----
  /** The fog's radius now (world units): its target, or on the way there while it clears. */
  function fogRadius(view) {
    const to = clearRadius(view);
    if (!fogAnim) return to;
    const p = Math.min(1, (clock() - fogAnim.t0) / FOG_MS);
    return fogAnim.from + (fogAnim.to - fogAnim.from) * easeOut(p);
  }
  /** Sets the mask's gradient for a radius (world units): clear inside it, fogged a ring's width past it. */
  function placeFog(radius) {
    if (!fogGrad) return;
    const [cx, cy] = camera.worldToScreen([0, 0]);
    const inner = radius * camera.scale(), soft = RING * 0.9 * camera.scale();
    fogGrad.setAttribute('cx', String(cx)); fogGrad.setAttribute('cy', String(cy));
    fogGrad.setAttribute('r', String(inner + soft));
    fogGrad.children?.[1]?.setAttribute('offset', String(inner / (inner + soft)));
    fogGrad.dataset.radius = radius.toFixed(3);
  }
  function fogNode(st, view) {
    const scr = p => camera.worldToScreen(p);
    const s = camera.scale();
    const ring = Math.max(0, ...view.shownStars().filter(view.place).map(x => latticeRing(view.place(x).coord)));
    // Puffs over the next few rings' positions (seeded: they stay put from draw to draw).
    const puffs = [], flecks = [];
    for (const c of ringsUpTo(ring + 4)) {
      const k = latticeRing(c);
      if (k <= ring) continue;
      const r = seeded(`fog:${coordKey(c)}`);
      const [x, y] = scr(toPixel(c));
      for (let i = 0; i < 2; i++) {
        puffs.push(svg('circle', { cx: (x + (r() - 0.5) * s * 0.9).toFixed(1), cy: (y + (r() - 0.5) * s * 0.9).toFixed(1), r: (s * (0.55 + r() * 0.55)).toFixed(1),
          class: `fog-puff p${Math.floor(r() * 3)} d${i}`, fill: `url(#${fogId}-n${Math.floor(r() * 3)})`, opacity: (0.35 + r() * 0.35).toFixed(2) }));
      }
      for (let i = 0; i < 3; i++) {
        flecks.push(svg('circle', { cx: (x + (r() - 0.5) * s * 1.4).toFixed(1), cy: (y + (r() - 0.5) * s * 1.4).toFixed(1), r: (0.4 + r() * 0.7).toFixed(2),
          class: `fog-fleck s${i}`, style: { animationDelay: `${(-r() * 4).toFixed(2)}s` } }));
      }
    }
    const nebula = (i, color) => svg('radialGradient', { id: `${fogId}-n${i}` },
      svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.9' }),
      svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }));
    fogGrad = svg('radialGradient', { id: `${fogId}-g`, gradientUnits: 'userSpaceOnUse' },
      svg('stop', { offset: '0', 'stop-color': '#000' }), svg('stop', { offset: '0.5', 'stop-color': '#000' }), svg('stop', { offset: '1', 'stop-color': '#fff' }));
    placeFog(fogRadius(view));
    return svg('g', { class: 'layer-fog', 'pointer-events': 'none', dataset: { ring: String(ring) } },
      svg('defs', {}, fogGrad, nebula(0, '#7a5cc8'), nebula(1, '#3b8fb0'), nebula(2, '#b05a96'),
        svg('mask', { id: `${fogId}-m` }, svg('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: `url(#${fogId}-g)` }))),
      svg('g', { mask: `url(#${fogId}-m)` },
        svg('rect', { x: 0, y: 0, width: '100%', height: '100%', class: 'fog-base' }),
        svg('g', { class: 'fog-puffs' }, puffs), ...(props.content?.rules?.starfield === 'on' ? [] : flecks)));
  }

  // ---- Moments (9a) ----
  /** Each moment where its world point now is on the screen, at its progress; finished ones go. */
  function drawFx() {
    const now = clock();
    fx = fx.filter(m => {
      const p = (now - m.t0) / m.ms;
      if (p >= 1) return false;
      if (m.kind === 'fog') {   // 9e: the fog's edge moves out to the new ring
        placeFog(m.from + (m.to - m.from) * easeOut(Math.min(1, p)));
        return true;
      }
      if (m.kind === 'reveal') {   // 9e: from one end to the other, then gone (the line itself stays drawn)
        const [[x1, y1], [x2, y2]] = inLane(camera.worldToScreen(m.from), camera.worldToScreen(m.to), m.lane);
        const q = easeOut(Math.min(1, p * 1.6));
        m.node.setAttribute('x1', String(x1)); m.node.setAttribute('y1', String(y1));
        m.node.setAttribute('x2', String(x1 + (x2 - x1) * q)); m.node.setAttribute('y2', String(y1 + (y2 - y1) * q));
        m.node.setAttribute('opacity', String(1 - p * p));
        return true;
      }
      const [x, y] = camera.worldToScreen(m.at);
      m.node.setAttribute('transform', `translate(${x} ${y})${m.kind === 'nova' ? ` scale(${camera.scale() / m.s0})` : ''}`);
      if (m.kind === 'burst') {
        m.inner.setAttribute('transform', `scale(${0.35 + 1.15 * easeOut(p)})`);
        m.inner.setAttribute('opacity', String(1 - p));
      } else {
        m.flood.setAttribute('transform', `scale(${easeOut(Math.min(1, p * 1.8))})`);
        m.flood.setAttribute('opacity', String(0.9 * (1 - p)));
        m.ring.setAttribute('transform', `scale(${0.2 + 2.6 * easeOut(p)})`);
        m.ring.setAttribute('opacity', String(1 - p));
      }
      return true;
    });
    if (fxLayer.children.length !== fx.length) fxLayer.replaceChildren(...fx.map(m => m.node));
  }
  const fxLoop = () => {
    if (glide) {
      const p = Math.min(1, (clock() - glide.t0) / GLIDE_MS);
      const [x, y] = camera.worldToScreen(glide.to);
      const { width, height } = el.getBoundingClientRect();
      const k = p >= 1 ? 1 : 0.15;
      camera.panByPixels((width / 2 - x) * k, (height / 2 - y) * k);
      if (p >= 1) glide = null;
      render();
    } else drawFx();
    if (fx.length || glide) nextFrame(fxLoop);
  };
  function addMoment(m) {
    const start = !fx.length && !glide;
    fx.push({ ...m, t0: clock(), s0: camera.scale() });
    fxLayer.append(m.node);
    if (start) nextFrame(fxLoop);
  }
  function prizeBurst(p) {
    const rays = Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return svg('line', { x1: Math.cos(a) * 14, y1: Math.sin(a) * 14, x2: Math.cos(a) * 34, y2: Math.sin(a) * 34, stroke: '#ffd27a', class: 'fx-ray' }); });
    const inner = svg('g', {}, svg('circle', { cx: 0, cy: 0, r: 20, stroke: '#ffd27a', class: 'fx-ring' }), rays);
    addMoment({ kind: 'burst', at: p, ms: BURST_MS, inner, node: svg('g', { class: 'fx-burst prize-burst' }, inner) });
  }
  /** What changed from `before` worth a moment: star-dots that ignited, stars now wholly ignited. */
  function moments(before, prizeWas) {
    const { state: st, view, content } = props;
    if (props.fx) for (const [i, p] of prizeWas ?? []) if (!prizeAt.has(i)) prizeBurst(p);   // a prize claimed bursts where it was
    if (props.fog) {   // 9e: a star in a new ring: the fog clears to it
      const [from, to] = [clearRadius(before.view), clearRadius(view)];
      if (to > from + 1e-9) {
        const at = fogAnim ? fogRadius(before.view) : from;
        fogAnim = { from: at, to, t0: clock() };
        addMoment({ kind: 'fog', from: at, to, ms: FOG_MS, node: svg('g', {}) });
      }
    }
    if (props.reveal && (props.layer ?? 'off') === 'off') {   // 9e: a relation just revealed draws itself
      const was = revealed(before.state, before.view);
      for (const [key, r] of revealed(st, view)) {
        if (was.has(key)) continue;
        addMoment({ kind: 'reveal', from: r.a, to: r.b, lane: r.lane ? REVEAL_LANE : 0, ms: 1400, node: svg('line', { class: 'reveal-draw', dataset: { pair: key } }) });
      }
    }
    if (!props.fx) return;   // the rest: bursts and supernovas (Bursts)
    const lit = d => view.effective(d).status === 'ignited';
    const was = d => !!before.state.dots[d] && before.view.effective(d).status === 'ignited';
    const where = index(st).dot;
    const colorOf = k => { const c = k && st.kites[k]?.color; return c == null ? '#ffd27a' : content.categories[c].color; };
    for (const [d, p] of poses(st, view).dots) {
      if (!lit(d) || was(d)) continue;
      const at = where.get(d);
      const big = at?.slot === ZENITH;
      const r = big ? 26 : 15;
      const color = colorOf(at?.kite);
      const rays = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return svg('line', { x1: Math.cos(a) * r * 0.45, y1: Math.sin(a) * r * 0.45, x2: Math.cos(a) * r, y2: Math.sin(a) * r, stroke: color, class: 'fx-ray' });
      });
      const inner = svg('g', {}, svg('circle', { cx: 0, cy: 0, r: r * 0.6, stroke: color, class: 'fx-ring' }), rays);
      addMoment({ kind: 'burst', at: p, ms: BURST_MS, inner, node: svg('g', { class: 'fx-burst' + (big ? ' zenith' : ''), dataset: { dot: d } }, inner) });
    }
    for (const s of view.shownStars()) {
      const ds = st.stars[s].kites.flatMap(k => st.kites[k].dots).filter(Boolean);
      if (!ds.length || !ds.every(lit) || ds.every(was)) continue;
      const { center, kites } = starLayout(st, view, s);
      const [cx, cy] = camera.worldToScreen(center);
      const flood = svg('g', {}, kites.map(({ k, pts }) => svg('polygon', {
        points: svgPoints(pts.map(p => camera.worldToScreen(p)).map(([x, y]) => [x - cx, y - cy])), fill: colorOf(k), class: 'fx-flood',
      })));
      const ring = svg('circle', { cx: 0, cy: 0, r: camera.scale() * TIP, class: 'fx-nova-ring' });
      addMoment({ kind: 'nova', at: center, ms: NOVA_MS, flood, ring, node: svg('g', { class: 'fx-nova', dataset: { star: s } }, flood, ring) });
      // Off toward the edge (outside the middle half): the camera glides to it.
      const { width, height } = el.getBoundingClientRect();
      if (Math.abs(cx - width / 2) > width / 4 || Math.abs(cy - height / 2) > height / 4) glide = { to: center, t0: clock() };
    }
  }

  // ---- Animation ----
  const walk = (node, fn) => { for (const c of [...(node.children ?? [])]) { fn(c); walk(c, fn); } };
  /** Set every moved element's transform for the current moment; at the end, draw plainly. */
  function frame() {
    if (!anim) return;
    const x = Math.min(1, (clock() - anim.t0) / ANIM_MS);
    const k = 1 - ease(x);
    const scr = p => camera.worldToScreen(p);
    // X6: scale `s` toward screen point `o` (s 0: all at o; 1: where it's drawn).
    const grow = (n, o, s) => n.setAttribute('transform', `translate(${(1 - s) * o[0]} ${(1 - s) * o[1]}) scale(${s})`);
    /** Where a star appears from or goes back to: its star-dot, now or before (else its own center). */
    const originOf = (star, fallback) => {
      const src = anim.to.source.get(star) ?? anim.from.source.get(star);
      const p = (src && (anim.to.dots.get(src) ?? anim.from.dots.get(src))) ?? fallback;
      return scr(p);
    };
    walk(el, n => {
      const ds = n.dataset ?? {};
      const kite = ds.hit === 'kite' || classOf(n).split(' ').includes('empty') ? ds.id : ['kite-design', 'kiteless-star', 'kite-finish'].some(c => classOf(n).split(' ').includes(c)) ? ds.kite : null;
      if (kite) {
        const [a, b] = [anim.from.kites.get(kite), anim.to.kites.get(kite)];
        if (!b) return;
        if (!a) return grow(n, originOf(b.star, b.c), 1 - k);   // a star that appears grows from its star-dot
        const turn = ((a.a - b.a + 540) % 360) - 180;
        const [[ox, oy], [nx, ny]] = [scr(a.c), scr(b.c)];
        if (Math.abs(turn) > 1e-6 || Math.abs(ox - nx) + Math.abs(oy - ny) > 0.01) n.setAttribute('transform', `translate(${(ox - nx) * k} ${(oy - ny) * k}) rotate(${turn * k} ${nx} ${ny})`);
      } else if (ds.hit === 'slot') {
        // Y4: a new kite-less star's empty slots grow out of its star-dot with it.
        const [a, b] = [anim.from.kites.get(ds.kite), anim.to.kites.get(ds.kite)];
        if (b && !a) grow(n, originOf(b.star, b.c), 1 - k);
      } else if (ds.hit === 'dot') {
        const [a, b] = [anim.from.dots.get(ds.id), anim.to.dots.get(ds.id)];
        if (!b) return;
        if (!a) return grow(n, originOf(anim.to.dotStar.get(ds.id), b), 1 - k);
        const [[ox, oy], [nx, ny]] = [scr(a), scr(b)];
        if (Math.abs(ox - nx) + Math.abs(oy - ny) > 0.01) n.setAttribute('transform', `translate(${(ox - nx) * k} ${(oy - ny) * k})`);
      }
    });
    for (const [n, o] of anim.origins) grow(n, scr(o), k);            // stars that go shrink back into their star-dot
    if (x >= 1) { anim = null; render(); }
  }
  const loop = () => { if (!anim) return; frame(); if (anim) nextFrame(loop); };
  /** Start animating from the previous drawing's places (`before`: the props it was drawn with). */
  function animateFrom(before, oldStars, oldDots) {
    const from = poses(before.state, before.view);
    const to = poses(props.state, props.view);
    const moved = [...to.kites].some(([id, b]) => { const a = from.kites.get(id); return !a || a.a !== b.a || a.c[0] !== b.c[0] || a.c[1] !== b.c[1]; })
      || [...from.kites.keys()].some(id => !to.kites.has(id))
      || [...to.dots].some(([id, b]) => { const a = from.dots.get(id); return a && (a[0] !== b[0] || a[1] !== b[1]); });
    if (!moved) return;
    // Kites (and their designs) that leave the map: their old drawings, on top, shrinking back into
    // their star's star-dot (X6; world point `origins`, per drawing).
    let leaving = null;
    const origins = new Map();
    const gone = [];
    if (oldStars) {
      walk(oldStars, n => {
        const ds = n.dataset ?? {};
        const kite = ds.hit === 'kite' || classOf(n).split(' ').includes('empty') ? ds.id : ['kite-design', 'kiteless-star', 'kite-finish'].some(c => classOf(n).split(' ').includes(c)) ? ds.kite : null;
        if (!kite || to.kites.has(kite)) return;
        gone.push(n);
        const { star, c } = from.kites.get(kite) ?? {};
        const src = star && from.source.get(star);
        origins.set(n, (src && (to.dots.get(src) ?? from.dots.get(src))) ?? c ?? [0, 0]);
      });
    }
    // Y4: star-dots (and a kite-less star's empty slots) that leave with their star shrink back into its star-dot too.
    if (oldDots) {
      walk(oldDots, n => {
        const ds = n.dataset ?? {};
        const star = ds.hit === 'dot' && !to.dots.has(ds.id) ? from.dotStar.get(ds.id)
          : ds.hit === 'slot' && !to.kites.has(ds.kite) ? from.kites.get(ds.kite)?.star : null;
        const src = star && from.source.get(star);
        if (!src) return;
        gone.push(n);
        origins.set(n, to.dots.get(src) ?? from.dots.get(src) ?? from.kites.get(ds.kite)?.c ?? [0, 0]);
      });
    }
    if (gone.length) leaving = svg('g', { class: 'layer-leaving', 'pointer-events': 'none' }, gone);
    anim = { from, to, t0: clock(), leaving, origins };
    if (leaving) el.append(leaving);
    loop();
  }

  // ---- Input ----
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      camera.setViewport(width, height);
      sized = true;
      render();
    }).observe(el);
  }

  const local = e => {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const pointers = new Map();   // pointerId → [x, y], for pinching
  let press = null;
  let pinch = null;
  /** The hovered relation sparkles (its dust drifting from origin to target, as a comet's). */
  function shine(key) {
    const r = relDrawn.get(key);
    if (!r) return;
    r.node.classList.add('hover');
    r.node.append(shineNode(r.ends, key));
  }
  const setHover = key => {
    if (key === hoverKey) return;
    const old = hoverKey && relDrawn.get(hoverKey);
    if (old) { old.node.classList.remove('hover'); old.node.replaceChildren(...[...(old.node.children ?? [])].filter(n => classOf(n) !== 'rel-shine')); }
    hoverKey = key;
    if (key) shine(key);
  };
  el.addEventListener('pointerover', e => { const h = hitOf(e.target); setHover(h?.kind === 'rel' ? h.key : null); });
  el.addEventListener('pointerleave', () => setHover(null));
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  };
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || anim) return;   // held while a change animates
    el.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 2) {
      press = null;
      pinch = spread();
      return;
    }
    const hit = hitOf(e.target);
    // A star-dot, or the selected kite, can be dragged; anything else pans.
    const draggable = canDrag && hit && (hit.kind === 'dot' || (hit.kind === 'kite' && props?.sel?.kind === 'kite' && props.sel.id === hit.id));
    press = { start: local(e), last: local(e), moved: false, hit, draggable };
  });
  el.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const now = spread();
      camera.panByPixels(now.mid[0] - pinch.mid[0], now.mid[1] - pinch.mid[1]);
      if (pinch.dist > 0) camera.zoomAt(now.dist / pinch.dist, now.mid);
      pinch = now;
      return render();
    }
    if (!press) return;
    if (!press.moved && Math.hypot(p[0] - press.start[0], p[1] - press.start[1]) > CLICK_SLOP) press.moved = true;
    if (!press.moved) return;
    if (press.draggable) {
      drag = { from: press.hit, at: p };
    } else {
      camera.panByPixels(p[0] - press.last[0], p[1] - press.last[1]);
    }
    press.last = p;
    render();
  });
  const release = e => {
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      return;
    }
    const p = press;
    press = null;
    if (!p) return;
    if (drag) {
      const to = targetAt(e.clientX, e.clientY);
      const from = drag.from;
      drag = null;
      render();
      if (to && canDrop(from, to)) onDrop(from, to);
      else onRefuse(from, to);
      return;
    }
    if (p.moved) return;
    // A relation clicked shows its label (clicked again, or anything else, it goes).
    if (p.hit?.kind === 'rel') { pinned = pinned === p.hit.key ? null : p.hit.key; render(); return; }
    if (pinned) { pinned = null; render(); }
    onHit(p.hit);
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); press = null; pinch = null; if (drag) { drag = null; render(); } });
  el.addEventListener('wheel', e => {
    e.preventDefault();
    if (!e.deltaY) return;
    camera.zoomAt(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, local(e));
    render();
  }, { passive: false });

  /** The drop target under a page point: a map target, { kind: 'shelf' }, or null. */
  function targetAt(x, y) {
    const under = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null;
    if (!under) return null;
    if (under.closest?.('[data-shelf]')) return { kind: 'shelf' };
    return el.contains(under) ? hitOf(under) : null;
  }

  return {
    el,
    update(next) {
      const before = props;
      const oldStars = before && [...(el.children ?? [])].find(n => classOf(n) === 'layer-stars');
      const oldDots = before && [...(el.children ?? [])].find(n => classOf(n) === 'layer-dots');
      const live = sized && fitted && !skipAnim && !reducedMotion();
      // Under a box: keep drawing the board as it was, until the box closes.
      if (next.hold && before && live && (next.animate || next.fx)) held ??= { state: before.state, view: before.view };
      else held = null;
      props = held ? { ...next, ...held } : next;
      if (!props.spin) spinning = null;
      const newSpin = props.spin && spinning?.t0 !== props.spin.t0;
      const prizeWas = prizeAt;
      render();
      const changed = !!before && before.state !== props.state && live;
      skipAnim = false;
      if (!props.fog || (fogAnim && clock() - fogAnim.t0 > FOG_MS)) fogAnim = null;
      if (changed && (props.fx || props.reveal || props.fog)) moments(before, prizeWas);
      if (changed && props.animate && !newSpin) animateFrom(before, oldStars, oldDots);
      if (newSpin && sized && fitted) startSpin();
      launchComet();
    },
    render,
    fit,
    /** Re-fit on the next draw (after opening another save); that change doesn't animate. */
    refit: () => { fitted = false; skipAnim = true; anim = null; fx = []; glide = null; held = null; spinning = null; flying = null; skyLayer.replaceChildren(); fxLayer.replaceChildren(); render(); },
    /** Whether a change is animating. */
    animating: () => !!anim,
    targetAt,
    /** Light up the targets for a drag that started outside the map (null when it ends). */
    setDragging: from => { external = from; render(); },
    /** Zoom about the middle of the map (the + / − buttons). */
    zoom: factor => {
      const { width, height } = el.getBoundingClientRect();
      camera.zoomAt(factor, [width / 2, height / 2]);
      render();
    },
  };
}

/** The target a clicked element stands for, or null for empty space. */
export function hitOf(target) {
  const el = target?.closest?.('[data-hit]');
  if (!el) return null;
  const { hit, id, kite, slot, coord } = el.dataset;
  if (hit === 'dot' || hit === 'kite') return { kind: hit, id };
  if (hit === 'pill') return { kind: 'pill', action: el.dataset.action, id };
  if (hit === 'central') return { kind: 'central' };
  if (hit === 'rel') return { kind: 'rel', key: el.dataset.rel };
  if (hit === 'prize') return { kind: 'prize', key: el.dataset.prize, i: Number(el.dataset.i) };
  if (hit === 'slot') return { kind: 'slot', kite, slot: Number(slot) };
  if (hit === 'pos') return { kind: hit, coord: coord.split(',').map(Number) };
  return null;
}

/** One star-dot: faint ring (empty slot), outline star (open), half star (in training), filled (ignited). */
/**
 * One star-dot: faint ring (empty slot); then by status, outline (open), half (in training) or
 * filled (ignited). a star-dot that can deploy a star (view.deployable) is a small
 * star; any other (inner slots, blocked Zeniths) a circle. A goal has no ring: its fill fades
 * between a dim and the full tone of its color (map.css, --dot).
 */
function dotMark(st, view, d, [x, y], r, color, { selected, source, open, target, opacity, role, bare, goal }, hit, slotName) {
  const status = d ? view.effective(d).status : 'empty';
  const star = !!d && !!view.deployable?.(d);
  const due = dueSpeed(view, d);   // Z17
  const locked = !!d && view.opts?.questions === 'on' && !!view.insideFirst?.(d);   // Z18: a Zenith waiting for those inside it
  const name = d ? st.dots[d].name : '';
  const over = !!d && overCount(st, d, view.opts);   // Beyond the per-star count, marked
  const label = `${slotName}${name ? ': ' + name : ' (empty)'}${{ ignited: ' · ignited', training: ' · in training' }[status] ?? ''}${over ? ' · over the per-star count' : ''}`;
  const fill = color ?? '#9aa4b2';
  const quiz = d && view.opts?.questions === 'on' ? (status === 'ignited' ? ' q-lit' : ' q-faded') : '';
  const cls = `dot ${status}${d ? (star ? ' deployable' : ' inner') : ''}${quiz}${selected ? ' selected' : ''}${source ? ' source' : ''}${open ? '' : ' locked'}${target ? ' target' : ''}${role ? ' role-' + role : ''}${bare ? ' bare' : ''}${goal ? ' q-goal' : ''}${due ? ` due due-${due}` : ''}${locked ? ' waiting' : ''}${over ? ' over' : ''}`;
  const R = r * 1.2;   // a circle about the star symbol's size
  const filled = status === 'ignited' && !goal ? { fill } : null;
  return svg('g', { class: cls, dataset: { ...hit, ...(due && { due }) }, style: { ...(opacity != null && { opacity }), '--dot': fill } },
    svg('title', {}, label),
    svg('circle', { cx: x, cy: y, r: r * 2.6, class: 'dot-hit' }),
    (selected || source || target || (role && role !== 'dim')) && svg('circle', { cx: x, cy: y, r: r * 2, class: 'dot-ring' }),
    over && svg('circle', { cx: x, cy: y, r: r * 1.7, class: 'dot-over' }),
    !d ? svg('circle', { cx: x, cy: y, r: Math.max(1.4, r * 0.32), class: 'dot-slot' })   // Z13: an empty slot
      : status === 'empty' ? svg('circle', { cx: x, cy: y, r: r * 0.8, class: 'dot-empty' })
      : star ? svg('polygon', { points: svgPoints(miniStar(x, y, r)), class: 'dot-star', style: filled })
        : svg('circle', { cx: x, cy: y, r: R, class: 'dot-circle', style: filled }),
    status === 'training' && !goal && (star ? svg('polygon', { points: svgPoints(halfStar(x, y, r)), class: 'dot-half', style: { fill } })
      : svg('path', { d: `M ${x} ${y - R} A ${R} ${R} 0 0 0 ${x} ${y + R} Z`, class: 'dot-half', style: { fill } })),
    locked && padlock(x + r * 0.9, y + r * 0.9, Math.max(3.2, r * 0.75)));
}

/** Z18: a small padlock centered at (x, y), its body `s` wide: a shackle arc over a rounded body. */
function padlock(x, y, s) {
  const w = s, hgt = s * 0.8, top = y - hgt / 2 + s * 0.15;
  return svg('g', { class: 'dot-lock', 'pointer-events': 'none' },
    svg('path', { d: `M ${x - w * 0.3} ${top} V ${top - s * 0.25} A ${w * 0.3} ${w * 0.3} 0 0 1 ${x + w * 0.3} ${top - s * 0.25} V ${top}`, class: 'dot-lock-shackle' }),
    svg('rect', { x: x - w / 2, y: top, width: w, height: hgt, rx: s * 0.15, class: 'dot-lock-body' }));
}

/** A line's ends, shortened by `gap` at both ends (so the star-dots stay clear). */
function trimmed([x1, y1], [x2, y2], gap) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  return [[x1 + ux * gap, y1 + uy * gap], [x2 - ux * gap, y2 - uy * gap]];
}

/**
 * The kite finish (Design › Look) over one star's plain kites (screen points, each [center, left
 * waist, tip, right waist]): Crystal cuts each into two facets lit from the upper left (white over
 * the lit, shade over the dark), Glass lights the star from its center toward the tips; both draw
 * a bright rim along the outer edges and a glowing core where the kites meet. `bare`: a kite-less
 * star's shape (its six kites' outlines). Nothing here takes clicks.
 */
const LIGHT = -135;   // degrees: the light comes from the upper left
let finishCount = 0;
function finishNode(finish, kites, [cx, cy], star, kite, bare) {
  const parts = [];
  const tipR = Math.max(...kites.map(p => Math.hypot(p[2][0] - cx, p[2][1] - cy)));
  if (finish === 'crystal') {
    for (const [c, l, t, r] of kites) {
      const spine = Math.atan2(t[1] - c[1], t[0] - c[0]) * 180 / Math.PI;
      for (const [half, side] of [[[c, l, t], -1], [[c, t, r], 1]]) {
        const facing = Math.cos((spine + side * 60 - LIGHT) * Math.PI / 180);   // a facet faces 60° off the spine
        parts.push(svg('polygon', { points: svgPoints(half), class: facing >= 0 ? 'facet lit' : 'facet shade',
          'fill-opacity': (facing >= 0 ? 0.08 + 0.22 * facing : 0.06 - 0.24 * facing).toFixed(3) }));
      }
      parts.push(svg('line', { x1: c[0], y1: c[1], x2: t[0], y2: t[1], class: 'facet-ridge' }));
    }
  } else {
    const id = `finish-glass-${++finishCount}`;
    parts.push(svg('defs', {}, svg('radialGradient', { id, gradientUnits: 'userSpaceOnUse', cx, cy, r: tipR },
      svg('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.42' }),
      svg('stop', { offset: '0.45', 'stop-color': '#ffffff', 'stop-opacity': '0.12' }),
      svg('stop', { offset: '1', 'stop-color': '#000000', 'stop-opacity': '0.22' }))));
    for (const k of kites) parts.push(svg('polygon', { points: svgPoints(k), fill: `url(#${id})`, class: 'glass' }));
  }
  for (const [, l, t, r] of kites) parts.push(svg('polyline', { points: svgPoints([l, t, r]), class: 'finish-rim' }));
  const core = Math.min(tipR * 0.06, 9);   // small, whatever the zoom
  parts.push(svg('g', { class: 'star-core' },
    svg('circle', { cx, cy, r: core * 2.4, class: 'core-glow' }),
    svg('line', { x1: cx - core * 3.2, y1: cy, x2: cx + core * 3.2, y2: cy, class: 'core-flare' }),
    svg('line', { x1: cx, y1: cy - core * 3.2, x2: cx, y2: cy + core * 3.2, class: 'core-flare' }),
    svg('circle', { cx, cy, r: core * 0.7, class: 'core-dot' })));
  return svg('g', { class: `kite-finish ${finish}${bare ? ' bare' : ''}`, 'pointer-events': 'none', dataset: { kite, star } }, parts);
}

/**
 * 9e: a revealed relation: a thin bright white line from a to b (shortened by `gap` at both ends, so
 * the star-dots stay clear), in a faint haze of the comets' sparkling dust, with a small arrowhead at
 * b. Brighter for a stronger relation, but kept quiet: the pattern is the point. In a lane (one each
 * way), its dust keeps closer to it.
 */
function revealNode([x1, y1], [x2, y2], gap, { key, score, lane }) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  const [nx, ny] = [-uy, ux];
  const [[ax, ay], [bx, by]] = trimmed([x1, y1], [x2, y2], gap);
  const run = Math.max(0, len - 2 * gap);
  const head = 3.6;
  const spread = lane ? 1.8 : 3.2;
  const r = seeded(`reveal:${key}`);
  const sparks = Array.from({ length: Math.min(40, Math.round(run / 7)) }, (_, i) => {
    const t = r(), off = (r() * 2 - 1) * spread * (0.4 + r() * 0.6);
    return svg('circle', { cx: (ax + (bx - ax) * t + nx * off).toFixed(1), cy: (ay + (by - ay) * t + ny * off).toFixed(1), r: (0.35 + r() * 0.75).toFixed(2),
      class: `reveal-spark s${i % 3}`, fill: i % 4 ? '#ffffff' : '#fff3cf', style: { animationDelay: `${(-r() * 3).toFixed(2)}s` } });
  });
  return svg('g', { class: 'reveal-line', opacity: (0.42 + 0.09 * score).toFixed(2), dataset: { pair: key, hit: 'rel', rel: key } },
    svg('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'reveal-dust' }),
    ...sparks,
    svg('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'reveal-core' }),
    svg('path', { class: 'reveal-head',
      d: `M ${bx - ux * head + nx * head * 0.55} ${by - uy * head + ny * head * 0.55} L ${bx} ${by} L ${bx - ux * head - nx * head * 0.55} ${by - uy * head - ny * head * 0.55}` }),
    svg('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'rel-hit' }));
}

/**
 * A hovered relation's highlight: a soft glow along it and the comets' sparkling dust, each fleck
 * drifting from its origin toward its target and twinkling out (still under reduce-motion).
 */
function shineNode([[ax, ay], [bx, by]], key) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const [ux, uy] = [(bx - ax) / len, (by - ay) / len];
  const [nx, ny] = [-uy, ux];
  const r = seeded(`shine:${key}`);
  const flecks = Array.from({ length: Math.max(6, Math.min(60, Math.round(len / 4))) }, (_, i) => {
    const t = r(), off = (r() * 2 - 1) * 3 * (0.3 + r() * 0.7), drift = 6 + r() * 10;
    return svg('circle', { cx: (ax + (bx - ax) * t + nx * off).toFixed(1), cy: (ay + (by - ay) * t + ny * off).toFixed(1), r: (0.45 + r() * 0.9).toFixed(2),
      class: `shine-fleck s${i % 3}`, fill: i % 3 ? '#ffffff' : '#fff3cf',
      style: { '--dx': `${(ux * drift).toFixed(1)}px`, '--dy': `${(uy * drift).toFixed(1)}px`, animationDelay: `${(-r() * 1.8).toFixed(2)}s` } });
  });
  return svg('g', { class: 'rel-shine', 'pointer-events': 'none' },
    svg('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'shine-glow' }), ...flecks);
}

/** A clicked relation's label: who relates to whom, and its words, in a box by the line's middle. */
function relLabel({ ends: [[ax, ay], [bx, by]], from, to, how }, key) {
  const words = (how || 'No description').split(/\s+/);
  const rows = [];
  for (const w of words) {
    if (rows.length && (rows.at(-1) + ' ' + w).length <= 34) rows[rows.length - 1] += ' ' + w;
    else rows.push(w);
  }
  const head = `${from} → ${to}`;
  const width = Math.min(260, Math.max(head.length * 5.6, ...rows.map(t => t.length * 6.9)) + 20);
  const height = 26 + rows.length * 16 + 6;
  const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
  const [x, y] = [mx - width / 2, my - height - 10];
  return svg('g', { class: 'rel-label', dataset: { hit: 'rel', rel: key }, role: 'note' },
    svg('rect', { x, y, width, height, rx: 7, class: 'rel-label-box' }),
    svg('text', { x: x + 10, y: y + 17, class: 'rel-label-head' }, head.length > 44 ? head.slice(0, 43) + '…' : head),
    ...rows.map((t, i) => svg('text', { x: x + 10, y: y + 37 + i * 16, class: 'rel-label-text' + (how ? '' : ' none') }, t)),
    svg('path', { d: `M ${mx - 6} ${my - 10} L ${mx} ${my - 3} L ${mx + 6} ${my - 10} Z`, class: 'rel-label-box' }));
}

/** A line from a to b (shortened by `gap` at both ends) with an arrowhead at b; `travel` (s): it draws itself from a after that delay. */
function arrow([x1, y1], [x2, y2], gap, width, color, opacity, key, travel = null) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  const [[ax, ay], [bx, by]] = trimmed([x1, y1], [x2, y2], gap);
  const head = 4 + width * 1.5;
  const [px, py] = [-uy * head * 0.5, ux * head * 0.5];
  return svg('g', { class: 'rel' + (travel == null ? '' : ' travel'), dataset: { hit: 'rel', rel: key }, style: { opacity, ...(travel != null && { '--d': `${travel.toFixed(2)}s` }) } },
    svg('line', { x1: ax, y1: ay, x2: bx - ux * head * 0.6, y2: by - uy * head * 0.6, stroke: color, 'stroke-width': width, ...(travel != null && { pathLength: 1 }) }),
    svg('polygon', { points: svgPoints([[bx, by], [bx - ux * head + px, by - uy * head + py], [bx - ux * head - px, by - uy * head - py]]), fill: color }),
    svg('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'rel-hit' }));
}

