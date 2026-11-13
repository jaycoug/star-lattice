// Hour blocks (round 6, U16–U18, shared/engine/blocks.js): spreading blocks over a day's free time
// with a minimum gap, moving and removing them, and completion clearing a star-dot's later blocks.
// Times are local, like the calendar's.

import { test, assertEqual } from '../runner.js';
import * as E from '../../shared/engine/index.js';
import {
  createState, centralStar, derive, placeDot, addChild, checkDot, retireDot, removeDot, mergeDots, normalizeSave,
  placeBlocks, spreadBlocks, moveBlock, removeBlock, clearCompleted, blocksOn, minuteOf, atMinute, DEFAULT_GAP, addressedAt, scheduleList, scheduleLevel, updateDot,
} from '../../shared/engine/index.js';

const DAY = new Date(2026, 10, 9).getTime();          // local midnight, Mon Nov 9 2026
const NOW = atMinute(DAY, 8 * 60);                    // 8:00 that day
const OPTS = { now: NOW };
const hhmm = ms => { const m = minuteOf(ms); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const times = (st, day = DAY) => blocksOn(st, day).map(b => hhmm(b.start));

function oneDot() {
  let st = createState(), d;
  [st, d] = placeDot(st, centralStar(st).kites[0], 0, 'Study');
  return [st, d];
}

test('placing spreads the blocks evenly over the free day: equal time before, between and after', () => {
  const [st, d] = oneDot();
  const r = placeBlocks(st, d, DAY, 3);
  assertEqual([r.problem, times(r.state)], [null, ['9:15', '13:30', '17:45']], '16 h day, 3 h of blocks: 3 h 15 min free around each');
  assertEqual(r.state.blocks.map(b => [b.dot, b.minutes]), [[d, 60], [d, 60], [d, 60]]);
  assertEqual(times(placeBlocks(st, d, DAY, 1).state), ['13:30'], 'one block: the middle of the day');
});

test('placing works around other blocks, at least the gap away, and on the quarter hour', () => {
  let [st, d] = oneDot();
  st = placeBlocks(st, d, DAY, 1).state;                          // 13:30–14:30
  st = moveBlock(st, st.blocks[0].id, 12 * 60).state;             // now 12:00–13:00
  const r = placeBlocks(st, d, DAY, 1, 30);
  // Free time 6:00–11:30 and 13:30–22:00 (840 min); the middle of it, 390 min in, is 14:30.
  assertEqual(times(r.state), ['12:00', '14:30']);
  const wide = placeBlocks(st, d, DAY, 4, 60).state;
  const ms = blocksOn(wide, DAY).map(b => minuteOf(b.start)).sort((a, b) => a - b);
  assertEqual(ms.every((m, i) => i === 0 || m - ms[i - 1] >= 60 + 60), true, 'an hour plus the 60-minute gap between any two');
  assertEqual(ms.every(m => m % 15 === 0 && m >= 6 * 60 && m + 60 <= 22 * 60), true, 'on the grid, inside the day');
});

test('blocks that don’t all fit place none, and say so', () => {
  const [st, d] = oneDot();
  assertEqual(placeBlocks(st, d, DAY, 11, 30).problem, null, '11 h with 30-minute gaps just fits (16 h)');
  const r = placeBlocks(st, d, DAY, 12, 30);
  assertEqual([r.state, r.problem], [st, '12 hours don’t fit on that day with 30-minute gaps.']);
  assertEqual(spreadBlocks(st, DAY, 0).problem, 'Choose at least one hour.');
  assertEqual(DEFAULT_GAP, 30);
});

test('moving a block: within its day, snapped to 15 minutes, never overlapping; removing one', () => {
  let [st, d] = oneDot();
  st = placeBlocks(st, d, DAY, 2).state;                          // 10:45 and 16:15 (4 h 40 min free around each, on the grid)
  const [a, b] = st.blocks;
  let r = moveBlock(st, a.id, 7 * 60 + 7);
  assertEqual([r.problem, hhmm(r.state.blocks.find(x => x.id === a.id).start)], [null, '7:00'], '7:07 snaps to 7:00');
  r = moveBlock(st, a.id, minuteOf(b.start) + 30);
  assertEqual([r.state, r.problem], [st, 'That would overlap another block.']);
  assertEqual(moveBlock(st, a.id, 21 * 60 + 30).problem, 'Blocks stay between 6 a.m. and 10 p.m.');
  assertEqual(moveBlock(st, a.id, 5 * 60).problem, 'Blocks stay between 6 a.m. and 10 p.m.');
  assertEqual(moveBlock(st, a.id, minuteOf(b.start) + 60).problem, null, 'touching is fine');
  assertEqual(removeBlock(st, a.id).blocks.map(x => x.id), [b.id]);
});

test('completing a star-dot drops its blocks after now; earlier ones stay (U18)', () => {
  let [st, d] = oneDot();
  st = placeBlocks(st, d, DAY, 3).state;                          // 9:15, 13:30, 17:45
  const at = { ...OPTS, now: atMinute(DAY, 14 * 60) };            // 14:00: one passed, one under way, one ahead
  const after = clearCompleted(st, checkDot(st, d, true, at.now), at);
  assertEqual(times(after), ['9:15', '13:30'], 'the one ahead goes');
  const unrelated = clearCompleted(after, { ...after, nextId: after.nextId + 1 }, at);
  assertEqual(times(unrelated), ['9:15', '13:30'], 'already complete: nothing more goes');
  const later = placeBlocks(after, d, DAY, 1).state;              // planning time on a complete one is allowed
  assertEqual(clearCompleted(later, { ...later, nextId: later.nextId + 1 }, at).blocks.length, 3, 'and it stays, since it didn’t just become complete');
});

test('a parent completed through its children loses its later blocks too', () => {
  let [st, p] = oneDot();
  let a, b;
  ({ state: st, dot: a } = addChild(st, p, 'a'));
  ({ state: st, dot: b } = addChild(st, p, 'b'));
  st = placeBlocks(st, p, DAY, 2).state;
  st = checkDot(st, a, true, NOW);
  assertEqual(clearCompleted(st, st, OPTS).blocks.length, 2);
  const done = clearCompleted(st, checkDot(st, b, true, NOW), OPTS);
  assertEqual([derive(done, OPTS).effective(p).status, done.blocks.length], ['ignited', 0]);
});

test('retiring drops the later blocks of a star-dot and its branch; merging moves them; removing drops them', () => {
  let [st, p] = oneDot();
  let a, q;
  ({ state: st, dot: a } = addChild(st, p, 'a'));
  st = placeBlocks(st, p, DAY, 1).state;
  st = placeBlocks(st, a, DAY + 86400000, 1).state;               // tomorrow
  assertEqual(retireDot(st, p, NOW).blocks, [], 'its own and its child’s');
  [st, q] = placeDot(st, centralStar(st).kites[1], 0, 'Other');
  const merged = mergeDots(st, a, q, OPTS).state;
  assertEqual(merged.blocks.map(b => b.dot).sort(), [p, q].sort(), 'a’s block is now q’s');
  assertEqual(removeDot(st, p).blocks.map(b => b.dot), [a]);
});

test('blocks load cleaned: unknown star-dots, bad times and repeated ids dropped, in start order', () => {
  let [st, d] = oneDot();
  st = { ...st, blocks: [
    { id: 'b2', dot: d, start: NOW + 3600000, minutes: 60 }, { id: 'b1', dot: d, start: NOW },
    { id: 'b1', dot: d, start: NOW + 1 }, { id: 'b3', dot: 'nope', start: NOW }, { id: 'b4', dot: d, start: 'soon' },
  ] };
  const loaded = normalizeSave({ format: 'star-lattice-save', content: 'x', state: st });
  assertEqual(loaded.state.blocks, [{ id: 'b1', dot: d, start: NOW, minutes: 60 }, { id: 'b2', dot: d, start: NOW + 3600000, minutes: 60 }]);
  assertEqual([loaded.gap, normalizeSave({ format: 'star-lattice-save', content: 'x', state: st, gap: 60 }).gap, normalizeSave({ format: 'star-lattice-save', content: 'x', state: st, gap: 7 }).gap], [30, 60, 30]);
});

test('addressed (U15): the later of its own or a descendant’s last completion and its last block that has passed', () => {
  let [st, p] = oneDot();
  let a;
  ({ state: st, dot: a } = addChild(st, p, 'a'));
  const view = s => derive(s, OPTS);
  assertEqual(addressedAt(st, view(st), p, NOW), null, 'never');
  st = checkDot(st, a, true, NOW - 5000);
  assertEqual(addressedAt(st, view(st), p, NOW), NOW - 5000, 'a child’s completion counts for the parent');
  st = placeBlocks(st, p, DAY - 86400000, 1).state;                // yesterday, over by now
  const end = st.blocks[0].start + 3600000;
  assertEqual(addressedAt(st, view(st), p, NOW), Math.max(end, NOW - 5000));
  st = placeBlocks(st, p, DAY + 86400000, 1).state;                // tomorrow: not yet
  assertEqual(addressedAt(st, view(st), p, NOW), Math.max(end, NOW - 5000), 'a block still ahead doesn’t count');
});

test('the list (U15): every star-dot on the map, by Due date, then frequency, then oldest addressed; complete ones only on request', () => {
  let st = createState();
  const k = centralStar(st).kites[0];
  const make = (slot, name, props) => { let d; [st, d] = placeDot(st, k, slot, name); st = updateDot(st, d, { props }); return d; };
  const late = make(0, 'Due later', { due: '2026-11-20' });
  const soon = make(1, 'Due soon', { due: '2026-11-10' });
  const weekly = make(2, 'Weekly', { persistence: 'weekly' });
  const daily = make(3, 'Daily', { persistence: 'daily' });
  let fresh, old, none, done;
  [st, fresh] = placeDot(st, centralStar(st).kites[1], 0, 'Monthly, done lately');
  [st, old] = placeDot(st, centralStar(st).kites[1], 1, 'Monthly, done long ago');
  [st, none] = placeDot(st, centralStar(st).kites[1], 2, 'Monthly, never');
  [st, done] = placeDot(st, centralStar(st).kites[1], 3, 'Complete');
  for (const d of [fresh, old, none]) st = updateDot(st, d, { props: { persistence: 'monthly' } });
  st = { ...st, dots: { ...st.dots, [fresh]: { ...st.dots[fresh], ignitedAt: NOW - 40 * 86400000, trained: true }, [old]: { ...st.dots[old], ignitedAt: NOW - 90 * 86400000, trained: true } } };
  st = checkDot(st, done, true, NOW);
  const opts = { now: NOW, periods: { daily: 1, weekly: 7, monthly: 30, never: null } };
  const names = list => list.map(e => st.dots[e.dot].name);
  assertEqual(names(scheduleList(st, derive(st, opts))), ['Due soon', 'Due later', 'Daily', 'Weekly', 'Monthly, never', 'Monthly, done long ago', 'Monthly, done lately']);
  assertEqual(names(scheduleList(st, derive(st, opts), { showComplete: true })).includes('Complete'), true, 'complete ones on request');
  assertEqual(scheduleList(retireDot(st, soon, NOW), derive(retireDot(st, soon, NOW), opts)).some(e => e.dot === soon), false, 'retired ones aren’t listed');
});

test('SCHEDULE by star-dot (round 7, V11): each level rolls up its branch’s own Due dates and Retrain, complete ones hidden', () => {
  let st = createState(), p, q, r, a, b, c, g, n;
  const ck = centralStar(st).kites;
  [st, p] = placeDot(st, ck[0], 0, 'Parent');
  [st, q] = placeDot(st, ck[1], 0, 'Q');
  [st, r] = placeDot(st, ck[2], 0, 'R');
  ({ state: st, dot: a } = addChild(st, p, 'a'));
  ({ state: st, dot: b } = addChild(st, p, 'b'));
  ({ state: st, dot: c } = addChild(st, p, 'c'));
  ({ state: st, dot: g } = addChild(st, c, 'g'));
  ({ state: st, dot: n } = addChild(st, p, 'n'));                  // no Due of its own, no children: only its parent's, inherited
  st = updateDot(st, p, { props: { due: '2026-11-30' } });
  st = updateDot(st, a, { props: { due: '2026-11-01' } });            // overdue on Nov 9
  st = updateDot(st, b, { props: { due: '2026-11-02' } });
  st = updateDot(st, g, { props: { due: '2026-11-12', persistence: 'daily' } });
  st = updateDot(st, q, { props: { due: '2026-11-11' } });
  st = checkDot(st, b, true, NOW);                                     // complete: its Due doesn't count, and it's hidden
  const opts = { now: NOW, periods: { daily: 1, weekly: 7, never: null } };
  const v = derive(st, opts);
  const top = scheduleLevel(st, v);
  assertEqual(top.map(e => st.dots[e.dot].name), ['Parent', 'Q', 'R'], 'the central star’s star-dots, soonest rolled-up Due first');
  const P = top[0];
  assertEqual([P.due, P.dueFrom, P.overdue, P.days, P.retrain], ['2026-11-01', a, 1, 1, 'daily'], 'its branch’s soonest own Due (a’s, overdue) and most frequent Retrain (g’s)');
  assertEqual([P.children, P.support.total], [3, 4], 'three of its four children are listed (b is complete)');
  const kids = scheduleLevel(st, v, p);
  assertEqual(kids.map(e => st.dots[e.dot].name), ['a', 'c', 'n'], 'one level down, in the same order');
  assertEqual([kids[2].due, kids[2].inherited], [null, '2026-11-30'], 'an inherited Due never counts as its own');
  assertEqual([kids[1].due, kids[1].inherited, kids[0].inherited], ['2026-11-12', '2026-11-30', null], 'c rolls up g’s own Due; its inherited one (the parent’s) shows apart');
  assertEqual(scheduleLevel(st, v, p, { showComplete: true }).map(e => st.dots[e.dot].name).includes('b'), true, 'complete ones on request');
  const qDone = checkDot(st, q, true, NOW);
  assertEqual(scheduleLevel(qDone, derive(qDone, opts)).map(e => st.dots[e.dot].name), ['Parent', 'R'], 'a complete star-dot (and so its branch) is hidden');
});

test('P5: the day’s hours come from the content set; one block placed at a chosen 15-minute slot', () => {
  const { createState, centralStar, placeDot, placeBlockAt, moveBlock, dayRange, cleanRules, hourName, dayOf, minuteOf } = E;
  assertEqual(dayRange(cleanRules({})), { start: 360, end: 1320 }, '6 a.m. to 10 p.m. by default');
  assertEqual(cleanRules({ day: { start: 9, end: 5 } }).day, { start: 6, end: 22 }, 'a backwards range is the default');
  assertEqual(cleanRules({ day: { start: 0, end: 24 } }).day, { start: 0, end: 24 });
  assertEqual([hourName(0), hourName(12), hourName(18), hourName(24)], ['midnight', 'noon', '6 p.m.', 'midnight']);
  let st = createState();
  let d;
  [st, d] = placeDot(st, centralStar(st).kites[0], 0, 'One');
  const day = dayOf(Date.UTC(2026, 10, 12, 12));
  const range = dayRange({ day: { start: 8, end: 18 } });
  let r = placeBlockAt(st, d, day, 9 * 60 + 20, range);
  assertEqual([r.problem, minuteOf(r.state.blocks[0].start), r.state.blocks[0].minutes], [null, 9 * 60 + 15, 60], 'snapped down to the 15-minute slot');
  assertEqual(placeBlockAt(r.state, d, day, 9 * 60 + 45, range).problem, 'That would overlap another block.');
  assertEqual(placeBlockAt(st, d, day, 7 * 60, range).problem, 'Blocks stay between 8 a.m. and 6 p.m.');
  assertEqual(minuteOf(placeBlockAt(st, d, day, 17 * 60 + 30, range).state.blocks[0].start), 17 * 60, 'near the end: the last hour that fits');
  assertEqual(moveBlock(r.state, r.blocks[0], 18 * 60, range).problem, 'Blocks stay between 8 a.m. and 6 p.m.');
});
