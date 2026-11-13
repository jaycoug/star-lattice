// Kite designs (shared/kiteDesign.js): the guide arrangement, symmetry, placement and the format.

import { test, assertEqual, assertClose, assertSamePoint } from '../runner.js';
import { GRID, GUIDES, mirrors, placer, emptyDesign, normalizeDesign, withFill, withLines, designShapes, toneColor } from '../../shared/kiteDesign.js';
import { createState, centralStar, setKiteDesign, normalizeSave } from '../../shared/engine/index.js';
import { kite, slotAngle } from '../../shared/star.js';

const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

test('guides: border, 3 per straight direction, two inner kites', () => {
  const count = g => GUIDES.filter(s => s.group === g).length;
  assertEqual(['border', 'vertical', 'horizontal', 'diagonal \\', 'diagonal /', 'wide kite', 'long kite'].map(count), [4, 3, 3, 3, 3, 4, 4]);
});

test('straight guides span the kite: their ends lie on the border', () => {
  for (const s of GUIDES.filter(g => !g.group.endsWith('kite'))) for (const [x, y] of [s.a, s.b]) assertClose(Math.abs(x) + Math.abs(y), 1, `${s.group} end`);
});

test('regions tile the kite exactly (area 2, planar graph)', () => {
  assertClose(GRID.regions.reduce((s, r) => s + r.area, 0), 2, 'total area', 1e-9);
  assertEqual(GRID.nodes.length - GRID.edges.length + GRID.regions.length, 1, 'Euler V − E + F');
  assertEqual(GRID.regions.length, 64, 'region count');
});

test('no slivers: every region is at least 1% of the kite', () => {
  for (const r of GRID.regions) assert(r.area / 2 >= 0.01, `region ${r.id} is ${(r.area / 2 * 100).toFixed(2)}%`);
});

test('regions and edges are numbered tip first, left to right', () => {
  const c = GRID.regions.map(r => r.centroid);
  for (let i = 1; i < c.length; i++) assert(c[i][1] < c[i - 1][1] + 1e-9, `region ${i} after ${i - 1}`);
  assertSamePoint(GRID.nodes[0], [0, 1], 'node 0 is the tip');
});

test('the half-size kite corners are the busiest nodes', () => {
  const deg = GRID.nodes.map(() => 0);
  for (const e of GRID.edges) { deg[e.a]++; deg[e.b]++; }
  const top = Math.max(...deg);
  const hubs = GRID.nodes.filter((p, i) => deg[i] === top).map(p => p.map(v => +v.toFixed(6)));
  assertEqual(hubs.length, 4, 'hub count');
  for (const [x, y] of hubs) assertClose(Math.abs(x) + Math.abs(y), 0.5, 'hub on the half-size kite');
});

test('mirrors map regions and edges onto real ones, and flipping twice returns', () => {
  for (const kind of ['region', 'edge']) {
    const ids = kind === 'region' ? GRID.regions.map(r => r.id) : GRID.edges.map(e => e.id);
    for (const id of ids) {
      assertEqual(mirrors(kind, id, 'none'), [id]);
      for (const s of ['across', 'along']) {
        const [, m = id] = mirrors(kind, id, s);
        assert(m !== undefined, `${kind} ${id} ${s}`);
        assert(mirrors(kind, m, s).includes(id), `${kind} ${id} ${s} twice`);
      }
      const all = mirrors(kind, id, 'both');
      assert(all.length >= 1 && all.length <= 4 && all.every(x => x !== undefined), `${kind} ${id} both`);
    }
  }
});

test('placer puts the diamond corners on the kite points, in every slot', () => {
  for (let i = 0; i < 6; i++) {
    const k = kite(slotAngle(i), 2);
    const at = placer(k);
    assertSamePoint(at([0, -1]), k[0], 'center');
    assertSamePoint(at([-1, 0]), k[1], 'left waist');
    assertSamePoint(at([0, 1]), k[2], 'tip');
    assertSamePoint(at([1, 0]), k[3], 'right waist');
  }
});

test('normalizeDesign keeps known regions, edges and tones only', () => {
  const edge = GRID.edges[0].id;
  const d = normalizeDesign({ grid: 'halves-1', fills: { 0: 'dark', 1: 'ink', 2: 'plaid', 999: 'light' }, lines: [edge, edge, 'x-y'] });
  assertEqual(d.fills, { 0: 'dark' });
  assertEqual(d.lines, { [edge]: 'light' }, 'a version-1 list: Light lines (X3)');
  assertEqual(normalizeDesign({ grid: 'halves-1', lines: { [edge]: 'dark', 'x-y': 'dark', [GRID.edges[1].id]: 'plaid' } }).lines, { [edge]: 'dark' }, 'version 2: known edges, known tones');
  assertEqual(normalizeDesign({ grid: 'other' }), null);
});

test('withFill / withLines / designShapes', () => {
  let d = withFill(emptyDesign(), [3, 4], 'none');
  d = withFill(d, [4], 'ink');
  assertEqual(d.fills, { 3: 'none' });
  d = withLines(d, [GRID.edges[5].id], 'dark');
  const s = designShapes(d, kite(-90, 1), '#ff0000');
  assertEqual(s.paths.map(p => p.tone), ['ink'], 'one path per painted tone');
  assertEqual(s.paths[0].d.split('Z').length - 1, GRID.regions.length - 1, 'a "none" region is not painted');
  assertEqual(s.lines.map(l => [l.tone, l.stroke]), [['dark', toneColor('#ff0000', 'dark')]], 'one inner line path, in its tone (X3)');
  const border = GRID.edges.find(e => e.groups.includes('border')).id;
  const g = designShapes(withLines(d, [border], 'dark'), kite(-90, 1), '#ff0000').lines;
  assertEqual(g.length, 2, 'border lines get their own path');
  assertClose(g[1].width, 2 * g[0].width, 'a border line is drawn double (half is clipped)');
  const cut = designShapes(withLines(d, [border], 'none'), kite(-90, 1), '#ff0000').lines;
  assertEqual(cut.map(l => [l.tone, l.stroke]), [['dark', toneColor('#ff0000', 'dark')], ['none', null]], 'Clear: no stroke (a gap cut through the design)');
  assertEqual(withLines(withLines(d, [border], 'light'), [border], null).lines, d.lines, 'tone null takes a line away');
});

test('a kite’s own design (U12): cleaned when set, null shows its category’s again, kept on loading', () => {
  let st = createState();
  const k = centralStar(st).kites[2];
  st = setKiteDesign(st, k, { ...emptyDesign(), fills: { 0: 'dark', 1: 'plaid' } });
  assertEqual(st.kites[k].design.fills, { 0: 'dark' });
  assertEqual(normalizeSave({ format: 'star-lattice-save', content: 'x', state: st }).state.kites[k].design.fills, { 0: 'dark' });
  assertEqual(setKiteDesign(st, k, null).kites[k].design, null);
  assertEqual(setKiteDesign(st, 'nope', emptyDesign()), st, 'an unknown kite changes nothing');
});
