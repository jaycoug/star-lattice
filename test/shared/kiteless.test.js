// Round 9, stage 2 (Y4, Y5, Y7): kite-less stars (Kites in: Central star only) as six hidden
// spokes, the per-star count, the Zenith last, deploying from a spoke's Zenith, Hierarchical
// children on spokes, and Deploy: Automatically.

import { test, assertEqual } from '../runner.js';
import { DIRS, coordKey, addCoord } from '../../shared/lattice.js';
import {
  createState, centralStar, derive, placeDot, addChild, ignite, deployStar, withdrawStar, autoDeploy, childSlots,
  kiteless, usableSlots, maxChildren, optionsFrom, normalizeContent, CONTENT_FORMAT, ZENITH, BACK,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const CENTRAL = { now: NOW, locks: 'on', kites: 'central', perStar: 12 };
const ALL = { now: NOW, locks: 'on' };

/** A state with the central kite 0's Zenith ignited and its star deployed (at ring 1, NW): [state, zenithDot, star]. */
function oneStar(opts = CENTRAL) {
  let st = createState();
  const k0 = st.stars[centralStar(st).id].kites[0];
  let z;
  [st, z] = placeDot(st, k0, ZENITH, 'tip');
  st = ignite(st, z, NOW);
  const r = deployStar(st, z, opts);
  return [r.state, z, r.star];
}

test('Y4: every star but the central one is kite-less under Kites in: Central star only, none under All stars', () => {
  const [st, , s1] = oneStar();
  const c = centralStar(st).id;
  assertEqual([kiteless(st, c, CENTRAL), kiteless(st, s1, CENTRAL), kiteless(st, s1, ALL)], [false, true, false]);
  assertEqual(derive(st, CENTRAL).kiteless(s1), true);
  assertEqual(usableSlots(st, c, CENTRAL), [ZENITH, 1], 'round 11: the central star offers the per-star count too (12: Zenith and Port)');
  assertEqual(usableSlots(st, c, ALL), [0, 1, 2, 3], 'with kites in all stars, every slot');
});

test('Y5, Z2: the per-star count’s slots come into use Zenith, Port, Starboard, Nadir: 6 the Zeniths only, 12 adds the Ports …', () => {
  const [st, , s1] = oneStar();
  const counts = [6, 12, 18, 24].map(perStar => [usableSlots(st, s1, { ...CENTRAL, perStar }), maxChildren(st, s1, { ...CENTRAL, perStar })]);
  assertEqual(counts, [[[ZENITH], 6], [[ZENITH, 1], 12], [[ZENITH, 1, 3], 18], [[ZENITH, 1, 3, 0], 24]]);
});

test('Y5, Z2: children fill a kite-less star slot by slot (Nadir, Port, Starboard, Zenith among those in use), from the back kite, the Zeniths last', () => {
  const [st, , s1] = oneStar();
  const kites = st.stars[s1].kites;
  const order = childSlots(st, s1, CENTRAL).map(({ kite, slot }) => [kites.indexOf(kite), slot]);
  assertEqual(order.length, 12);
  assertEqual(order.slice(0, 6).map(x => x[1]), [1, 1, 1, 1, 1, 1], 'the Ports first (12 per star)');
  assertEqual(order.slice(6).map(x => x[1]), Array(6).fill(ZENITH), 'then the Zeniths');
  assertEqual([...new Set(childSlots(st, s1, { ...CENTRAL, perStar: 24 }).map(x => x.slot))], [0, 1, 3, ZENITH], '24: Nadir, Port, Starboard, Zenith');
  assertEqual(order[0][0], BACK, 'from the back spoke');
  assertEqual(childSlots(st, s1, ALL).length, 24, 'with kites, today’s 24 slots');
});

test('Y5: Hierarchical children on spokes: added inner first, refused once the count is full; one outside the count still counts', () => {
  let [st, z, s1] = oneStar({ ...CENTRAL, perStar: 6 });
  const six = { ...CENTRAL, perStar: 6 };
  for (let i = 0; i < 6; i++) st = addChild(st, z, `c${i}`, { options: six }).state;
  const view = derive(st, six);
  assertEqual(view.children(z).length, 6);
  assertEqual(view.children(z).every(d => st.kites[st.stars[s1].kites.find(k => st.kites[k].dots.includes(d))].dots[ZENITH] === d), true, 'all on Zeniths');
  const r = addChild(st, z, 'seventh', { options: six });
  assertEqual(r.problem, 'Its star is full (6 star-dots).');
  // A star-dot in a slot outside the count (placed before the count dropped) is kept and counted.
  [st] = placeDot(st, st.stars[s1].kites[0], 1, 'outside');
  assertEqual(derive(st, six).children(z).length, 7);
});

test('Y5: a Zenith can be completed only once the star-dots inside it are (spokes and central kites alike), only under Central only', () => {
  let [st, , s1] = oneStar();
  const spoke = st.stars[s1].kites[0];
  let tip, inner;
  [st, tip] = placeDot(st, spoke, ZENITH, 'tip');
  [st, inner] = placeDot(st, spoke, 0, 'inner');
  assertEqual([derive(st, CENTRAL).completable(tip), derive(st, CENTRAL).insideFirst(tip), derive(st, CENTRAL).completable(inner)], [false, true, true]);
  assertEqual(derive(st, { ...ALL, locks: 'off' }).completable(tip), true, 'with kites in all stars, no order');
  st = ignite(st, inner, NOW);
  assertEqual(derive(st, CENTRAL).completable(tip), true);
  // A central kite: its Zenith last, after Nadir, Port and Starboard.
  const k1 = st.stars[centralStar(st).id].kites[1];
  let cz, port;
  [st, cz] = placeDot(st, k1, ZENITH, 'z');
  [st, port] = placeDot(st, k1, 1, 'p');
  assertEqual(derive(st, CENTRAL).completable(cz), false);
  st = ignite(st, port, NOW);
  assertEqual(derive(st, CENTRAL).completable(cz), true);
});

test('Y4: a kite-less star’s spokes are always open, even with Kites lock on', () => {
  const [st, , s1] = oneStar();
  const view = derive(st, CENTRAL);
  assertEqual(st.stars[s1].kites.map(k => view.kiteOpen(k)), Array(6).fill(true));
  const kited = derive(oneStar(ALL)[0], ALL);
  assertEqual(oneStar(ALL)[0].stars[oneStar(ALL)[2]].kites.filter(k => kited.kiteOpen(k)).length, 1, 'a kited star opens only its back kite');
});

test('Y5: a spoke’s Zenith deploys toward the neighbor in its spoke’s direction', () => {
  let [st, , s1] = oneStar();
  const view = derive(st, CENTRAL);
  const { coord, turn } = view.place(s1);
  let tip;
  [st, tip] = placeDot(st, st.stars[s1].kites[0], ZENITH, 'tip');
  st = ignite(st, tip, NOW);
  const r = deployStar(st, tip, CENTRAL);
  assertEqual(r.problem, null);
  assertEqual(coordKey(derive(r.state, CENTRAL).place(r.star).coord), coordKey(addCoord(coord, DIRS[(0 + turn) % 6])));
  assertEqual(derive(r.state, CENTRAL).kiteless(r.star), true, 'its star is kite-less too');
});

test('Z3: a star-dot is deployable at an open Zenith whose faced position is free (or holds its own star); inner slots and blocked Zeniths aren’t', () => {
  let [st, z, s1] = oneStar();
  const v = derive(st, CENTRAL);
  assertEqual(v.deployable(z), true, 'the central Zenith whose star is on the map');
  let out, back, inner;
  [st, out] = placeDot(st, st.stars[s1].kites[0], ZENITH, 'faces out');
  [st, back] = placeDot(st, st.stars[s1].kites[BACK], ZENITH, 'faces the center');
  [st, inner] = placeDot(st, st.stars[s1].kites[0], 1, 'a Port');
  const w = derive(st, CENTRAL);
  assertEqual([w.deployable(out), w.deployable(back), w.deployable(inner)], [true, false, false]);
});

test('Y7: Deploy: Automatically deploys the star of a Zenith the change completed, where its position is free', () => {
  let st = createState();
  const k0 = st.stars[centralStar(st).id].kites[0];
  let z;
  [st, z] = placeDot(st, k0, ZENITH, 'tip');
  const lit = ignite(st, z, NOW);
  const auto = { ...CENTRAL, deploy: 'auto' };
  assertEqual(autoDeploy(st, lit, CENTRAL).deployed, [], 'By hand: nothing deploys');
  const r = autoDeploy(st, lit, auto);
  assertEqual(r.deployed.length, 1);
  assertEqual(derive(r.state, auto).shown(r.deployed[0]), true);
  // Withdrawn later, it stays off: the Zenith was already complete.
  const off = withdrawStar(r.state, z).state;
  assertEqual(autoDeploy(off, { ...off, title: 'any change' }, auto).deployed, []);
  // A completed star-dot that isn't at a Zenith deploys nothing.
  let st2, nadir;
  [st2, nadir] = placeDot(createState(), createState().stars[centralStar(createState()).id].kites[0], 0, 'n');
  assertEqual(autoDeploy(st2, ignite(st2, nadir, NOW), auto).deployed, []);
});

test('Y7: an automatic deploy is refused where the faced position is taken (back toward the center)', () => {
  let [st, , s1] = oneStar();
  const auto = { ...CENTRAL, deploy: 'auto' };
  let tip;
  [st, tip] = placeDot(st, st.stars[s1].kites[BACK], ZENITH, 'back');
  const r = autoDeploy(st, ignite(st, tip, NOW), auto);
  assertEqual(r.deployed, []);
});

test('the engine options carry the content set’s Kites in, per-star count and Deploy', () => {
  const content = normalizeContent({
    format: CONTENT_FORMAT, id: 'x', title: 'X',
    categories: Array.from({ length: 6 }, (_, i) => ({ name: 'C' + i, color: '#00000' + i })),
    rules: { kites: 'central', perStar: 18, deploy: 'auto' },
  });
  const o = optionsFrom(content);
  assertEqual([o.kites, o.perStar, o.deploy], ['central', 18, 'auto']);
});
