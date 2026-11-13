// Kite designs: patterns painted on a kite so categories can be told apart by more than color.
//
// Everything here is in "diamond coordinates": X runs across the kite (−1 left waist, +1 right
// waist) and Y along its spine (−1 the star's center, +1 the tip), so the kite is |X| + |Y| ≤ 1.
// The app's kite is a rhombus (star.js: the waists cross the spine halfway), so one affine map
// (placer) puts a design on any kite at any angle, and a design drawn once fits every slot.
//
// The guide lines sit on a grid of halves: three lines in each of four directions (vertical,
// horizontal, and both border directions, each through the center and at ±½), plus the wide and
// long inner kites. They cut the kite into regions (filled with a tone) and edges (drawn or not).
// Regions and edges are numbered in a fixed order, so a design is just numbers; GRID_ID names the
// guide set, and changing the guides means a new GRID_ID.

export const GRID_ID = 'halves-1';
export const DESIGN_FORMAT = 'star-lattice-kite-design';
export const TONES = ['ink', 'light', 'dark', 'none'];
// Drawn segments are lines painted in a tone, like regions: Ink (the kite's color),
// Light, Dark, or Clear (a gap cut through the design), LINE_WIDTH of the kite's length wide.
// Version 1 designs listed their lines only (white grooves at 24%, round 6); they load as Light.
export const LINE_WIDTH = 0.024;

const H = 0.5;
const span = v => 1 - Math.abs(v);

/** The guide segments, each { group, a, b } in diamond coordinates. */
export const GUIDES = [
  ...ring([[0, 1], [-1, 0], [0, -1], [1, 0]], 'border'),
  ...[-H, 0, H].map(x => ({ group: 'vertical', a: [x, -span(x)], b: [x, span(x)] })),
  ...[-H, 0, H].map(y => ({ group: 'horizontal', a: [-span(y), y], b: [span(y), y] })),
  // X + Y = c, parallel to the tip–right and center–left borders.
  ...[-H, 0, H].map(c => ({ group: 'diagonal \\', a: [(c - 1) / 2, (c + 1) / 2], b: [(c + 1) / 2, (c - 1) / 2] })),
  // −X + Y = c, parallel to the tip–left and center–right borders.
  ...[-H, 0, H].map(c => ({ group: 'diagonal /', a: [(1 - c) / 2, (1 + c) / 2], b: [(-1 - c) / 2, (c - 1) / 2] })),
  ...ring([[-1, 0], [0, H], [1, 0], [0, -H]], 'wide kite'),
  ...ring([[0, 1], [-H, 0], [0, -1], [H, 0]], 'long kite'),
];

function ring(pts, group) {
  return pts.map((a, i) => ({ group, a, b: pts[(i + 1) % pts.length] }));
}

const EPS = 1e-9;
const key = ([x, y]) => `${(Math.round(x * 1e6) / 1e6) + 0},${(Math.round(y * 1e6) / 1e6) + 0}`;
const byPosition = (p, q) => (q[1] - p[1]) || (p[0] - q[0]);   // tip first, then left to right

/** Intersection parameter t on segment s (0..1) where it meets segment o, or null. */
function crossings(s, o) {
  const [ax, ay] = s.a, [bx, by] = s.b, [cx, cy] = o.a, [dx, dy] = o.b;
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < EPS) {
    // Parallel: collinear overlaps contribute the other segment's endpoints.
    if (Math.abs((cx - ax) * ry - (cy - ay) * rx) > EPS) return [];
    const len2 = rx * rx + ry * ry;
    return [o.a, o.b].map(([px, py]) => ((px - ax) * rx + (py - ay) * ry) / len2).filter(t => t > -EPS && t < 1 + EPS);
  }
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t > -EPS && t < 1 + EPS && u > -EPS && u < 1 + EPS ? [t] : [];
}

/**
 * The planar arrangement of the guides: nodes [[X, Y]], edges { id, a, b, groups } (a, b node
 * indices; id "a-b"), and regions { id, pts, centroid, area } (counterclockwise in diamond space).
 */
export function buildGrid(guides = GUIDES) {
  const nodeIx = new Map();
  const raw = [];
  const nodeOf = p => {
    const k = key(p);
    if (!nodeIx.has(k)) { nodeIx.set(k, raw.length); raw.push(p); }
    return nodeIx.get(k);
  };
  const rawEdges = new Map();
  for (const s of guides) {
    const ts = [0, 1];
    for (const o of guides) if (o !== s) ts.push(...crossings(s, o));
    const pts = [...new Set(ts.map(t => Math.min(1, Math.max(0, t))).map(t => Math.round(t * 1e9) / 1e9))].sort((p, q) => p - q)
      .map(t => [s.a[0] + t * (s.b[0] - s.a[0]), s.a[1] + t * (s.b[1] - s.a[1])]);
    const ids = pts.map(nodeOf).filter((n, i, all) => i === 0 || n !== all[i - 1]);
    for (let i = 1; i < ids.length; i++) {
      const k = [ids[i - 1], ids[i]].sort((p, q) => p - q).join('-');
      if (!rawEdges.has(k)) rawEdges.set(k, new Set());
      rawEdges.get(k).add(s.group);
    }
  }

  // Renumber nodes in reading order, so ids don't depend on guide order.
  const order = raw.map((p, i) => i).sort((i, j) => byPosition(raw[i], raw[j]));
  const renum = new Map(order.map((old, i) => [old, i]));
  const nodes = order.map(i => raw[i].map(v => (Math.abs(v) < EPS ? 0 : v)));
  const edges = [...rawEdges].map(([k, groups]) => {
    const [a, b] = k.split('-').map(n => renum.get(+n)).sort((p, q) => p - q);
    return { id: `${a}-${b}`, a, b, groups: [...groups] };
  }).sort((e, f) => e.a - f.a || e.b - f.b);

  // Faces: at each node, sort neighbors by angle; walking u→v, turn to the neighbor of v just
  // clockwise from u. Bounded faces come out counterclockwise (positive area).
  const nbrs = nodes.map(() => []);
  for (const e of edges) { nbrs[e.a].push(e.b); nbrs[e.b].push(e.a); }
  const angle = (from, to) => Math.atan2(nodes[to][1] - nodes[from][1], nodes[to][0] - nodes[from][0]);
  nbrs.forEach((list, n) => list.sort((p, q) => angle(n, p) - angle(n, q)));
  const seen = new Set();
  const faces = [];
  for (const e of edges) {
    for (const [u0, v0] of [[e.a, e.b], [e.b, e.a]]) {
      if (seen.has(`${u0}>${v0}`)) continue;
      const loop = [];
      let [u, v] = [u0, v0];
      while (!seen.has(`${u}>${v}`)) {
        seen.add(`${u}>${v}`);
        loop.push(u);
        const list = nbrs[v];
        const w = list[(list.indexOf(u) - 1 + list.length) % list.length];
        [u, v] = [v, w];
      }
      const pts = loop.map(n => nodes[n]);
      const area = signedArea(pts);
      if (area > EPS) faces.push({ nodes: loop, pts, area, centroid: centroid(pts, area) });
    }
  }
  faces.sort((f, g) => byPosition(f.centroid, g.centroid));
  const regions = faces.map((f, id) => ({ id, ...f }));
  return { nodes, edges, regions };
}

function signedArea(pts) {
  let s = 0;
  pts.forEach(([x1, y1], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; });
  return s / 2;
}

function centroid(pts, area) {
  let cx = 0, cy = 0;
  pts.forEach(([x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  });
  return [cx / (6 * area), cy / (6 * area)];
}

export const GRID = buildGrid();

const regionAt = new Map(GRID.regions.map(r => [key(r.centroid), r.id]));
const nodeAt = new Map(GRID.nodes.map((p, i) => [key(p), i]));
const edgeAt = new Map(GRID.edges.map(e => [`${e.a}-${e.b}`, e.id]));
const FLIP = { across: ([x, y]) => [-x, y], along: ([x, y]) => [x, -y] };

/** The ids a region or edge maps to under a symmetry: 'none', 'across', 'along' or 'both'. */
export function mirrors(kind, id, symmetry) {
  const flips = { none: [], across: ['across'], along: ['along'], both: ['across', 'along'] }[symmetry] || [];
  const out = new Set([id]);
  for (const f of flips) for (const x of [...out]) out.add(mirrorOne(kind, x, FLIP[f]));
  return [...out];
}

function mirrorOne(kind, id, flip) {
  if (kind === 'region') return regionAt.get(key(flip(GRID.regions[id].centroid)));
  const [a, b] = id.split('-').map(n => nodeAt.get(key(flip(GRID.nodes[+n])))).sort((p, q) => p - q);
  return edgeAt.get(`${a}-${b}`);
}

/**
 * A function mapping diamond coordinates onto a kite given as star.js does it:
 * [center, left waist, tip, right waist] (screen points).
 */
export function placer([C, L, T, R]) {
  const mx = (C[0] + T[0]) / 2, my = (C[1] + T[1]) / 2;
  const ux = (T[0] - C[0]) / 2, uy = (T[1] - C[1]) / 2;
  const vx = (R[0] - L[0]) / 2, vy = (R[1] - L[1]) / 2;
  return ([X, Y]) => [mx + Y * ux + X * vx, my + Y * uy + X * vy];
}

/** An empty design: the whole kite in the category's color, as kites look today. */
export function emptyDesign() {
  return { format: DESIGN_FORMAT, version: 2, grid: GRID_ID, fills: {}, lines: {} };
}

/** A clean copy of a design, dropping anything unknown (null if it isn't a design for this grid). */
export function normalizeDesign(d) {
  if (!d || typeof d !== 'object' || (d.grid && d.grid !== GRID_ID)) return null;
  const out = emptyDesign();
  for (const [id, tone] of Object.entries(d.fills || {})) {
    if (GRID.regions[+id] && TONES.includes(tone) && tone !== 'ink') out.fills[+id] = tone;
  }
  const edgeIds = new Set(GRID.edges.map(e => e.id));
  // Version 1: a list of drawn edges (white grooves), now Light lines; version 2: { edge: tone }.
  const lines = Array.isArray(d.lines) ? d.lines.map(id => [id, 'light']) : Object.entries(d.lines || {});
  for (const [id, tone] of lines.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (edgeIds.has(id) && TONES.includes(tone)) out.lines[id] = tone;
  }
  return out;
}

/** The tone of a region in a design. */
export const toneOf = (design, id) => design.fills[id] || 'ink';

/** A copy of a design with these regions set to a tone. */
export function withFill(design, ids, tone) {
  const fills = { ...design.fills };
  for (const id of ids) { if (tone === 'ink') delete fills[id]; else fills[id] = tone; }
  return { ...design, fills };
}

/** The tone of a line in a design, or null where none is drawn. */
export const lineOf = (design, id) => design.lines[id] ?? null;

/** A copy of a design with these edges drawn in `tone`, or not drawn (tone null). */
export function withLines(design, ids, tone) {
  const lines = { ...design.lines };
  for (const id of ids) { if (tone) lines[id] = tone; else delete lines[id]; }
  return { ...design, lines };
}

/** CSS color for a tone of a category color (null for 'none': nothing is painted). */
export function toneColor(color, tone) {
  if (tone === 'none') return null;
  if (tone === 'light') return `color-mix(in oklab, ${color}, #ffffff 62%)`;
  if (tone === 'dark') return `color-mix(in oklab, ${color}, #000000 55%)`;
  return color;
}

/**
 * What to draw for a design on a kite: one SVG path per painted tone { tone, fill, d } (its
 * regions as subpaths, so neighbors of one tone show no seams), and the lines { tone, stroke, d,
 * width } by tone (stroke null for Clear: cut those out of the design). Draw them clipped to the
 * kite; border lines come twice as wide, and the clip keeps their inner half, which then matches
 * the others.
 */
export function designShapes(design, kitePts, color) {
  const at = placer(kitePts);
  const sub = pts => pts.map(at).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(4)} ${y.toFixed(4)}`).join('');
  const byTone = new Map();
  for (const r of GRID.regions) {
    const tone = toneOf(design, r.id);
    if (tone !== 'none') byTone.set(tone, (byTone.get(tone) || '') + sub(r.pts) + 'Z');
  }
  const paths = TONES.filter(t => byTone.has(t)).map(tone => ({ tone, fill: toneColor(color, tone), d: byTone.get(tone) }));
  const [C, , T] = kitePts;
  const width = LINE_WIDTH * Math.hypot(T[0] - C[0], T[1] - C[1]);
  const edgeById = new Map(GRID.edges.map(e => [e.id, e]));
  const byKey = new Map();
  for (const [id, tone] of Object.entries(design.lines)) {
    const e = edgeById.get(id);
    const border = e.groups.includes('border');
    const k = `${tone}|${border}`;
    byKey.set(k, { tone, border, d: (byKey.get(k)?.d ?? '') + sub([GRID.nodes[e.a], GRID.nodes[e.b]]) });
  }
  const lines = TONES.flatMap(tone => [false, true].map(border => byKey.get(`${tone}|${border}`)).filter(Boolean))
    .map(({ tone, border, d }) => ({ tone, stroke: toneColor(color, tone), d, width: border ? 2 * width : width }));
  return { paths, lines };
}
