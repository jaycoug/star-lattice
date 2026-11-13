// The kite design editor, shared by PLAY's Design… and the standalone Kite Designer
// (tools/kite-designer.html). Geometry and the design format are in shared/kiteDesign.js.
//
// kiteDesigner({ design, color, onCommit, settings, setSettings, fade, allowed }) → element (fade: the content set's rule, round 8)
// allowed (9b, the player's prizes) { tones, modes, syms }: only those offered (null: everything);
// a setting outside them falls back to the first allowed.
//
// It edits one design: Fill paints regions with a tone (Ink is the kite's color, Clear a hole),
// Lines paints guide segments with the same tones, each stroke
// repeated by the symmetry. A stroke (a click, or a drag across regions) is painted on a working copy and handed
// to onCommit(design) when it ends, so a host keeps one undo step per stroke. `settings` ({ mode,
// brush, sym, guides }) belong to the host (setSettings(next) when one changes), so they survive
// the host re-rendering the editor. The preview shows the design in all six directions of a
// star, from no progress to complete (the fade the map uses, U10, U11), and at three sizes.
// Also: designNodes(), a design's SVG on any kite, used by the map.

import { h, svg } from '../dom.js';
import { kite, slotAngle, svgPoints } from '../star.js';
import { kiteFill } from '../color.js';
import * as K from '../kiteDesign.js';

export const DEFAULT_SETTINGS = { mode: 'fill', brush: 'dark', sym: 'across', guides: true };
const EDIT_KITE = kite(-90, 1);   // tip up; the star's center at the origin
const toEdit = K.placer(EDIT_KITE);
const TONE_NAMES = { ink: 'Ink', light: 'Light', dark: 'Dark', none: 'Clear' };
let clips = 0;

/**
 * A design on a kite as SVG: its tone paths (Clear lines cut out of them with a mask),
 * then its lines in their tones, clipped to the kite.
 */
function designSvg({ paths, lines }, pts, base = `kd-clip-${++clips}`) {
  const cut = lines.filter(l => !l.stroke);
  const drawn = lines.filter(l => l.stroke);
  const out = [];
  const stroke = (l, color) => svg('path', { d: l.d, fill: 'none', stroke: color, 'stroke-width': l.width, 'stroke-linecap': 'round' });
  const painted = paths.map(p => svg('path', { d: p.d, fill: p.fill }));
  if (cut.length) {
    out.push(svg('mask', { id: `${base}-cut`, maskUnits: 'userSpaceOnUse' }, svg('polygon', { points: svgPoints(pts), fill: '#ffffff' }), cut.map(l => stroke(l, '#000000'))));
    out.push(svg('g', { mask: `url(#${base}-cut)` }, painted));
  } else out.push(...painted);
  if (drawn.length) {
    out.push(svg('clipPath', { id: base }, svg('polygon', { points: svgPoints(pts) })));
    out.push(svg('g', { 'clip-path': `url(#${base})`, 'pointer-events': 'none', class: 'kd-lines' }, drawn.map(l => stroke(l, l.stroke))));
  }
  return out;
}

/** A design painted on a kite (its four points, as star.js gives them) in `color`: tone paths, then lines. */
export function designNodes(design, pts, color, clipId) {
  return designSvg(K.designShapes(design, pts, color), pts, clipId);
}

const segmented = (options, current, onPick) => h('span', { class: 'segmented kd-seg' }, options.map(([value, label, sw]) =>
  h('button', { type: 'button', class: 'seg' + (value === current ? ' on' : ''), 'aria-pressed': String(value === current), onclick: () => onPick(value) }, sw, label)));
const swatch = (css, cls = '') => h('span', { class: 'kd-swatch ' + cls, style: { background: css } });

export function kiteDesigner({ design, color, onCommit = () => {}, settings = DEFAULT_SETTINGS, setSettings = () => {}, fade = 'darken', allowed = null }) {
  const ui = { ...DEFAULT_SETTINGS, ...settings };
  const may = (kind, v) => !allowed || allowed[kind].includes(v);
  if (allowed) {   // what isn't offered falls back to the first that is
    if (!may('modes', ui.mode)) ui.mode = allowed.modes[0];
    if (!may('tones', ui.brush)) ui.brush = allowed.tones[0];
    if (!may('syms', ui.sym)) ui.sym = allowed.syms[0];
  }
  const set = patch => setSettings({ ...ui, ...patch });
  let working = design ?? K.emptyDesign();
  let hover = null;
  let drag = null;   // { kind: 'region', tone } | { kind: 'edge', on }, while a stroke is under way

  const editor = svg('svg', { class: 'kd-editor', viewBox: '-0.33 -1.03 0.66 1.06', role: 'img', 'aria-label': 'Kite design editor' });
  const status = h('div', { class: 'kd-status' });
  const views = [['big', 0.012], ['s96', 0.02], ['s48', 0.03], ['s24', 0.045]].map(([id, w]) => ({ id, w, el: svg('svg', { class: `kd-preview kd-${id}`, viewBox: '-1.03 -1.03 2.06 2.06' }) }));

  function drawEditor() {
    const shapes = K.designShapes(working, EDIT_KITE, color);
    const nodes = designSvg({ paths: shapes.paths, lines: [] }, EDIT_KITE);
    // Invisible regions on top take the clicks.
    for (const r of K.GRID.regions) nodes.push(svg('polygon', { points: svgPoints(r.pts.map(toEdit)), class: 'kd-region', dataset: { region: String(r.id) }, fill: 'transparent' }));
    if (ui.guides || ui.mode === 'lines') {
      for (const e of K.GRID.edges) {
        const [a, b] = [K.GRID.nodes[e.a], K.GRID.nodes[e.b]].map(toEdit);
        nodes.push(svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'kd-guide' }));
      }
    }
    nodes.push(svg('polygon', { points: svgPoints(EDIT_KITE), class: 'kd-outline' }));
    nodes.push(...designSvg({ paths: [], lines: shapes.lines }, EDIT_KITE));
    if (ui.mode === 'fill' && hover?.kind === 'region') {
      for (const id of K.mirrors('region', hover.id, ui.sym)) nodes.push(svg('polygon', { points: svgPoints(K.GRID.regions[id].pts.map(toEdit)), class: 'kd-hl' }));
    }
    if (ui.mode === 'lines') {
      const hot = hover?.kind === 'edge' ? new Set(K.mirrors('edge', hover.id, ui.sym)) : new Set();
      for (const e of K.GRID.edges) {
        const [a, b] = [K.GRID.nodes[e.a], K.GRID.nodes[e.b]].map(toEdit);
        nodes.push(svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'kd-hit' + (hot.has(e.id) ? ' hover' : ''), dataset: { edge: e.id } }));
      }
    }
    editor.replaceChildren(...nodes);
    const parts = [];
    if (hover?.kind === 'region') parts.push(`Region ${hover.id} · ${TONE_NAMES[K.toneOf(working, hover.id)]}`);
    if (hover?.kind === 'edge') parts.push(`Segment ${hover.id} · ${K.lineOf(working, hover.id) ? TONE_NAMES[K.lineOf(working, hover.id)] : 'no line'}`);
    parts.push(`${Object.keys(working.fills).length} of ${K.GRID.regions.length} regions painted, ${Object.keys(working.lines).length} lines drawn`);
    status.textContent = parts.join('  —  ');
  }

  /** Every direction of a star (slot i at slotAngle(i)), from no progress to complete, by the fade rule (U10, U11; round 8). */
  function drawPreviews() {
    for (const v of views) {
      v.el.replaceChildren(...Array.from({ length: 6 }, (_, i) => {
        const pts = kite(slotAngle(i), 1);
        return [...designNodes(working, pts, kiteFill(color, 1 + (4 * i) / 5, fade)),
          svg('polygon', { points: svgPoints(pts), fill: 'none', stroke: '#111820', 'stroke-width': v.w * 0.6 })];
      }).flat());
    }
  }

  const draw = () => { drawEditor(); drawPreviews(); };

  /** The region or edge under a pointer event (the event's own target, else the point: works while dragging). */
  const targetAt = ev => {
    const el = ev.type === 'pointerdown' || typeof document.elementFromPoint !== 'function' ? ev.target : document.elementFromPoint(ev.clientX, ev.clientY);
    if (ui.mode === 'fill' && el?.dataset?.region != null) return { kind: 'region', id: +el.dataset.region };
    if (ui.mode === 'lines' && el?.dataset?.edge != null) return { kind: 'edge', id: el.dataset.edge };
    return null;
  };
  const apply = t => {
    if (t.kind === 'region' && drag.kind === 'region') working = K.withFill(working, K.mirrors('region', t.id, ui.sym), drag.tone);
    if (t.kind === 'edge' && drag.kind === 'edge') working = K.withLines(working, K.mirrors('edge', t.id, ui.sym), drag.tone);
  };
  editor.addEventListener('pointerdown', ev => {
    const t = targetAt(ev);
    if (!t) return;
    ev.preventDefault?.();
    editor.setPointerCapture?.(ev.pointerId);
    // A line stroke paints the brush's tone; starting on a line already in that tone takes lines away.
    drag = t.kind === 'region' ? { kind: 'region', tone: ui.brush } : { kind: 'edge', tone: K.lineOf(working, t.id) === ui.brush ? null : ui.brush };
    apply(t);
    draw();
  });
  editor.addEventListener('pointermove', ev => {
    const t = targetAt(ev);
    const same = t && hover && t.kind === hover.kind && t.id === hover.id;
    if (same) return;
    hover = t;
    if (drag && t) apply(t);
    draw();
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    if (JSON.stringify(working) !== JSON.stringify(design ?? K.emptyDesign())) onCommit(working);
  };
  editor.addEventListener('pointerup', end);
  editor.addEventListener('pointercancel', end);
  editor.addEventListener('pointerleave', () => { if (!drag) { hover = null; drawEditor(); } });

  draw();
  return h('div', { class: 'kd' },
    h('div', { class: 'kd-edit' },
      may('modes', 'lines') && h('div', { class: 'kd-row' }, h('span', { class: 'kd-label' }, 'Mode'), segmented([['fill', 'Fill'], ['lines', 'Lines']], ui.mode, v => set({ mode: v }))),
      h('div', { class: 'kd-row' }, h('span', { class: 'kd-label' }, 'Paint'),
        segmented(K.TONES.filter(t => may('tones', t)).map(t => [t, TONE_NAMES[t], swatch(K.toneColor(color, t) ?? 'transparent', t === 'none' ? 'none' : '')]), ui.brush, v => set({ brush: v }))),
      allowed?.syms.length !== 1 && h('div', { class: 'kd-row' }, h('span', { class: 'kd-label' }, 'Symmetry'),
        segmented([['none', 'None'], ['across', 'Across ↔'], ['along', 'Along ↕'], ['both', 'Both']].filter(([v]) => may('syms', v)), ui.sym, v => set({ sym: v }))),
      h('div', { class: 'kd-row' }, h('span', { class: 'kd-label' }, 'Guides'), segmented([[true, 'Show'], [false, 'Hide']], ui.guides, v => set({ guides: v }))),
      h('div', { class: 'kd-editor-wrap' }, editor),
      status,
      h('div', { class: 'kd-row' }, h('button', { type: 'button', class: 'text-btn small', onclick: () => onCommit(K.emptyDesign()), title: 'Back to the plain color' }, 'Reset this design')),
      h('ul', { class: 'kd-help' },
        h('li', {}, h('b', {}, 'Fill'), ': click or drag across regions to paint them. Ink is the kite’s color; Clear leaves a hole.'),
        may('modes', 'lines') && h('li', {}, h('b', {}, 'Lines'), ': click or drag along guide segments, border included, to draw them in the Paint tone (Clear cuts a gap through the design); starting on a line already in that tone takes lines away.'),
        allowed?.syms.length !== 1 && h('li', {}, h('b', {}, 'Symmetry'), ' repeats each stroke across the spine, along it (tip ↔ center), or both.'))),
    h('div', { class: 'kd-look' },
      h('div', { class: 'kd-caption' }, 'Every direction, from no progress to complete'),
      views[0].el,
      h('div', { class: 'kd-sizes' }, views.slice(1).map(v => h('figure', {}, v.el, h('figcaption', {}, v.id.slice(1) + ' px'))))));
}
