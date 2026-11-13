// Round 16: one set of star-dots, two arrangements. syncArrangements keeps the tree (kite slots,
// children, stars) and the category lists holding the same star-dots, each in its own order.

import { test, assertEqual } from '../runner.js';
import {
  createState, centralStar, placeDot, addChild, deleteDot, shelveDot, retireDot, index, parentOf,
  addItem, moveItem, listOf, syncArrangements, treeOrder, overCount, ZENITH,
} from '../../shared/engine/index.js';

const NOW = 1e12;
const HIER = { now: NOW, locks: 'off', stardots: 'hierarchical', kites: 'central', perStar: 24 };
const ALL = { ...HIER, kites: 'all' };

/** A state whose central kite 0 lists `n` items (made under Independent, in no slot): [state, kiteId, ids]. */
function listed(n, st = createState()) {
  const k = st.stars[centralStar(st).id].kites[0];
  const ids = [];
  for (let i = 0; i < n; i++) { let id; [st, id] = addItem(st, k, 'i' + i); ids.push(id); }
  return [st, k, ids];
}
const slotOf = (st, d) => index(st).dot.get(d) ?? null;

test('round 16: list-only items get tree places: the central kite Nadir, Port, Starboard, Zenith, then a star planned on the Zenith', () => {
  const [st0, k, ids] = listed(7);
  const st = syncArrangements(st0, HIER);
  assertEqual(ids.slice(0, 4).map(d => slotOf(st, d)), [{ kite: k, slot: 0 }, { kite: k, slot: 1 }, { kite: k, slot: 3 }, { kite: k, slot: ZENITH }]);
  assertEqual(ids.slice(4).map(d => parentOf(st, d)), [ids[3], ids[3], ids[3]], 'the rest are the Zenith’s children');
  assertEqual(listOf(st, k), ids, 'the list keeps its order');
  assertEqual(syncArrangements(st, HIER), st, 'nothing more to do: the same state');
});

test('round 16: tree-only star-dots join their category’s list, in tree order', () => {
  let st = createState();
  const k = st.stars[centralStar(st).id].kites[0];
  let a, b, c;
  [st, a] = placeDot(st, k, ZENITH, 'a');
  [st, b] = placeDot(st, k, 0, 'b');
  ({ state: st, dot: c } = addChild(st, a, 'c', { options: ALL }));
  st = syncArrangements(st, ALL);
  assertEqual(listOf(st, k), [b, a, c]);
  assertEqual([...treeOrder(st, ALL).get(k)], [b, a, c]);
});

test('round 16: each arrangement’s own moves stay its own; deleting leaves both', () => {
  let [st, k, ids] = listed(5);
  st = syncArrangements(st, HIER);
  const tree = st.kites;
  st = syncArrangements(moveItem(st, k, 0, 3), HIER);
  assertEqual(listOf(st, k), [ids[1], ids[2], ids[3], ids[0], ids[4]], 'the list reordered');
  assertEqual(st.kites, tree, 'the tree untouched');
  st = syncArrangements(deleteDot(st, ids[1]), HIER);
  assertEqual(listOf(st, k).includes(ids[1]) || !!slotOf(st, ids[1]), false);
});

test('round 16: a star-dot shelved or retired leaves its list (not placed again), and rejoins at its end when it’s back', () => {
  let [st, k, ids] = listed(4);
  st = syncArrangements(st, HIER);
  st = syncArrangements(shelveDot(st, ids[0]), HIER);
  assertEqual([listOf(st, k), slotOf(st, ids[0])], [ids.slice(1), null]);
  st = syncArrangements(retireDot(st, ids[1], NOW), HIER);
  assertEqual(listOf(st, k), ids.slice(2));
  const back = { ...st, shelf: [], kites: { ...st.kites, [k]: { ...st.kites[k], dots: [ids[0], ...st.kites[k].dots.slice(1)] } } };
  assertEqual(listOf(syncArrangements(back, HIER), k).at(-1), ids[0]);
});

test('round 16: a star-dot already listed under another category follows its tree place', () => {
  let [st, k, ids] = listed(1);
  st = syncArrangements(st, HIER);
  const k2 = st.stars[centralStar(st).id].kites[1];
  const kites = { ...st.kites, [k]: { ...st.kites[k], dots: [null, null, null, null] }, [k2]: { ...st.kites[k2], dots: [ids[0], null, null, null] } };
  st = syncArrangements({ ...st, kites }, HIER);
  assertEqual([listOf(st, k), listOf(st, k2)], [[], ids]);
});

test('round 16: the per-star count limits new places; a star-dot beyond it keeps its slot and is marked', () => {
  const SIX = { ...HIER, perStar: 6 };
  const [st0, k, ids] = listed(3);
  const st = syncArrangements(st0, SIX);
  assertEqual(slotOf(st, ids[0]).slot, ZENITH, '6 per star: only Zeniths');
  assertEqual(ids.slice(1).map(d => parentOf(st, d)), [ids[0], ids[0]]);
  const full = syncArrangements(st0, HIER);
  // Placed under 24 (Nadir, Port, Starboard), then the count lowered to 6 (Zeniths only): all three are beyond it.
  assertEqual([overCount(full, ids[0], SIX), overCount(full, ids[2], SIX), overCount(full, ids[2], HIER)], [true, true, false]);
  assertEqual(syncArrangements(full, SIX), full, 'nothing moves when the count is lowered');
});
