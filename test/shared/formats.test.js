// Content-set and save formats (shared/engine/formats.js).

import { test, assertEqual } from '../runner.js';
import {
  CONTENT_FORMAT, SAVE_FORMAT, RETRAIN_LEVELS, normalizeContent, normalizeSave, newSave, optionsFrom,
  centralStar, placeDot, addChild, updateDot, derive, descriptionLists, DAY, FORMAT_VERSION, createState, QUIZ_DEFAULTS, quizRules, pinHash, startSession, boardMove, planStar } from '../../shared/engine/index.js';
import { emptyDesign, GRID } from '../../shared/kiteDesign.js';

const raw = {
  format: CONTENT_FORMAT, id: 'Test Set', title: 'Test',
  categories: ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => ({ name, color: '#00000' + i })),
  properties: [{ id: 'resistance', name: 'Difficulty', choices: [{ name: 'Low' }, { name: 'High' }, { name: 'low' }] }, { id: 'cost', name: 'Cost', choices: [{ name: 'Medium' }] }],
  start: { central: [5, 4, 3, 2, 1, 0] },
};

test('normalizeContent fills defaults and cleans choices', () => {
  const c = normalizeContent(raw);
  assertEqual(c.id, 'test-set');
  assertEqual(c.properties.map(p => [p.id, p.name, p.kind]), [
    ['environment', 'Environment', 'choice'], ['finance', 'Financial Influence', 'amount'],
    ['persistence', 'Retrain', 'choice'], ['difficulty', 'Difficulty', 'choice'], ['due', 'Due', 'date']], 'old IDs renamed; cost becomes an amount');
  assertEqual(c.properties[3].choices, [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], 'duplicate ID dropped');
  assertEqual(c.properties[2].choices, RETRAIN_LEVELS, 'persistence defaults to the six retrain levels');
  assertEqual(c.marks.map(m => m.symbol), ['☺'], 'starter marks: only the free one');
  assertEqual(c.rules, { locks: 'off', fade: 'darken', twinkle: 'normal', lattice: 'shown', ...QUIZ_DEFAULTS, day: { start: 6, end: 22 }, finish: 'flat', bursts: 'on', reveal: 'off', fog: 'off', starfield: 'off', streaks: 'off', bonuses: { on: 'off', every: 3, ladder: [], spin: ['hint', 'prize', 'again', 'nothing'] }, comets: { on: 'off', messages: [] } }, 'round 7: locks off unless set; round 8: no ownership or color rule, the fade rule darken unless set; round 9: the quiz settings at today’s behavior');
  assertEqual(['brighten', 'none', 'sideways'].map(fade => normalizeContent({ ...raw, rules: { fade } }).rules.fade), ['brighten', 'none', 'darken'], 'round 8: the fade rule is kept; an unknown one becomes darken');
});

test('normalizeContent rejects files it can’t use', () => {
  for (const bad of [{}, { ...raw, format: 'x' }, { ...raw, categories: raw.categories.slice(1) }]) {
    let threw = false;
    try { normalizeContent(bad); } catch { threw = true; }
    assertEqual(threw, true);
  }
});

test('optionsFrom turns Persistence choices into retrain periods', () => {
  const o = optionsFrom(normalizeContent(raw), { now: 5 });
  assertEqual([o.periods.weekly, o.periods.never, o.now, 'ownership' in o], [7, null, 5, false]);
});

test('a new save starts with the central star in the content’s arrangement', () => {
  const c = normalizeContent(raw);
  const save = newSave(c, 'Mine');
  const central = centralStar(save.state);
  assertEqual(central.kites.map(k => save.state.kites[k].color), [5, 4, 3, 2, 1, 0]);
  assertEqual(central.kites.map(k => save.state.kites[k].name), ['F', 'E', 'D', 'C', 'B', 'A']);
  assertEqual([save.format, save.content, save.title], [SAVE_FORMAT, 'test-set', 'Mine']);
});

test('normalizeSave round-trips and fills missing dot fields', () => {
  const c = normalizeContent(raw);
  let { state } = newSave(c);
  let d;
  [state, d] = placeDot(state, centralStar(state).kites[0], 0, 'Task');
  const stripped = JSON.parse(JSON.stringify({ format: SAVE_FORMAT, content: c.id, state }));
  stripped.state.dots[d].urgent = true;   // dropped since round 7
  delete stripped.state.dots[d].history;
  const save = normalizeSave(stripped);
  assertEqual(['urgent' in save.state.dots[d], save.state.dots[d].history], [false, []]);
  assertEqual(normalizeSave(JSON.parse(JSON.stringify(save))), save);
});

test('version-1 content upgrades: names, Difficulty levels, travel environments, derived marks', () => {
  const c = normalizeContent({
    ...raw,
    properties: [
      { id: 'environment', name: 'Environment', choices: [{ id: 'office', name: 'Office' }, { id: 'local', name: 'Local' }, { id: 'distant', name: 'Distant' }] },
      { id: 'persistence', name: 'Retrain Frequency', choices: [{ id: 'weekly', name: 'Weekly', days: 7 }] },
      { id: 'difficulty', name: 'Size of Training Corpus', choices: ['small', 'medium', 'large'].map(id => ({ id, name: id })) },
    ],
    marks: [{ id: 'money', symbol: '$' }, { id: 'time', symbol: '⏱' }, { id: 'place', symbol: '⌂' }, { id: 'people', symbol: '☺', name: 'Involves others' }],
  });
  const prop = id => c.properties.find(p => p.id === id);
  assertEqual([prop('persistence').name, prop('difficulty').name], ['Retrain', 'Difficulty']);
  assertEqual(prop('difficulty').choices, [{ id: 'easy', name: 'Easy' }, { id: 'medium', name: 'Medium' }, { id: 'hard', name: 'Hard' }]);
  assertEqual(prop('environment').choices.map(x => x.travel), [false, true, true], 'Local and Distant need travel');
  assertEqual(c.marks.map(m => m.id), ['people'], '$ ⏱ ⌂ are derived now');
  assertEqual(optionsFrom(c).travel, ['local', 'distant']);
  assertEqual(normalizeContent(JSON.parse(JSON.stringify(c))), c, 'version 2 round-trips');
});

test('version-1 saves upgrade: items become children with a copy of their star-dot’s attributes; effort, notes, rules move', () => {
  const c = normalizeContent(raw);
  let { state } = newSave(c);
  let a, b;
  [state, a] = placeDot(state, centralStar(state).kites[0], 0, 'A');
  [state, b] = placeDot(state, centralStar(state).kites[1], 0, 'B');
  const old = JSON.parse(JSON.stringify({ format: SAVE_FORMAT, content: c.id, state, notes: { text: 'Header', clusters: [{ cats: [1], text: 'c' }], questions: ['Q1', ''] } }));
  for (const s of Object.values(old.state.stars)) { delete s.notes; delete s.shelved; }
  delete old.state.shelf;
  Object.assign(old.state.dots[a], {
    training: [{ text: 'x', done: true, checkedAt: 5, marks: ['money', 'people'] }, { text: 'y', effort: 'high' }],
    links: [b], relevance: [3, 4, 1, 1, 1, 1], expand: { rule: 'choice' },
    props: { environment: 'office', resistance: 'large', cost: 'medium', persistence: 'weekly' },
  });
  delete old.state.dots[a].items;
  old.state.kites[centralStar(state).kites[0]].links = [centralStar(state).kites[1]];
  const save = normalizeSave(old);
  const dot = save.state.dots[a];
  const props = { environment: 'office', finance: null, persistence: 'weekly', difficulty: 'hard', due: null };
  assertEqual(dot.props, props, 'large → hard; cost (a choice) dropped');
  const [x, y] = derive(save.state, {}).children(a).map(id => save.state.dots[id]);
  assertEqual([x.name, x.role, x.marks, x.props, x.ignitedAt, x.trained, x.history[0].text], ['x', 'check', ['money', 'people'], props, 5, true, 'Was a checklist line of A']);
  assertEqual([y.name, y.props.difficulty, y.ignitedAt], ['y', 'hard', null], 'high effort → Hard');
  assertEqual(['links', 'relevance', 'expand', 'training', 'items'].map(k => k in dot), [false, false, false, false, false]);
  assertEqual('links' in save.state.kites[centralStar(state).kites[0]], false);
  assertEqual([centralStar(save.state).notes, 'notes' in save, save.state.shelf], [['Header', 'Q1'], false, []]);
  assertEqual(normalizeSave(JSON.parse(JSON.stringify(save))), save, 'upgrades once: version 3 round-trips');
});

test('version-2 saves upgrade: lines, their guidance and description lists become children on its star', () => {
  const c = normalizeContent(raw);
  let { state } = newSave(c);
  let a;
  [state, a] = placeDot(state, centralStar(state).kites[0], 0, 'A');
  const old = JSON.parse(JSON.stringify({ format: SAVE_FORMAT, version: 2, content: c.id, state }));
  const line = (text, guidance = [], extra = {}) => ({ text, role: 'check', marks: [], props: {}, guidance: guidance.map(t => ({ text: t })), assessment: null, done: false, checkedAt: null, ...extra });
  Object.assign(old.state.dots[a], {
    items: [line('x', ['g1', 'g2'], { role: 'assess', done: true, checkedAt: 7 }), line('Two')],
    description: 'Intro\n- one\n- Two\nWeek 9:\n- a\n- b\n\nLink',
  });
  const save = normalizeSave(old);
  const st = save.state;
  const v = derive(st, {});
  const names = id => v.children(id).map(k => st.dots[k].name);
  assertEqual([save.version, names(a)], [FORMAT_VERSION, ['x', 'Two', 'one', 'Week 9']], 'lines first, then the description; “Two” isn’t added twice');
  const [x, , one, week] = v.children(a);
  assertEqual([names(x), names(week)], [['g1', 'g2'], ['a', 'b']], 'guidance and a heading’s lines become their children');
  assertEqual([st.dots[x].role, st.dots[x].ignitedAt, st.dots[one].history[0].text], ['assess', 7, 'Was a line in A’s description']);
  assertEqual(v.children(x).map(g => [st.dots[g].ignitedAt, st.dots[g].trained]), [[7, true], [7, true]], 'a completed line’s guidance starts complete, with its date');
  assertEqual(st.dots[v.children(week)[0]].ignitedAt, null, 'other converted lines start not complete');
  assertEqual(st.dots[a].description, 'Intro\n\nLink', 'other text stays');
  assertEqual(st.stars[st.dots[a].branch].sources, [a], 'its star was planned to hold them');
  assertEqual(normalizeSave(JSON.parse(JSON.stringify(save))), save, 'upgrades once');
});

test('descriptionLists: "- " lines, headings with lines under them, the rest kept', () => {
  assertEqual(descriptionLists('Plain text only.'), { specs: [], rest: 'Plain text only.' });
  const { specs, rest } = descriptionLists('Note:\nnot a list\n- a\nEmpty heading:\n\n- b');
  assertEqual([specs.map(x => [x.name, x.children.length]), rest], [[['a', 0], ['b', 0]], 'Note:\nnot a list\nEmpty heading:'], 'a heading needs lines right under it');
});

test('derived marks: $ ✈ ⏱ come from attributes; legacy marks without one show as reminders', () => {
  const c = normalizeContent({ ...raw, properties: [{ id: 'environment', choices: [{ id: 'den', name: 'Den', travel: false }, { id: 'local', name: 'Local', travel: true }] }], version: 2 });
  let { state } = newSave(c);
  let d, i, j;
  [state, d] = placeDot(state, centralStar(state).kites[0], 0, 'Task');
  state = updateDot(state, d, { props: { environment: 'local' } });
  ({ state, dot: i } = addChild(state, d, 'i'));
  ({ state, dot: j } = addChild(state, d, 'j'));
  state = updateDot(state, i, { marks: ['people'], props: { finance: { amount: -5, period: 'month' }, due: '2001-01-01' } });
  state = updateDot(state, j, { marks: ['time', 'place'], props: { environment: 'den', finance: { amount: 9, period: 'once' } } });
  const v = derive(state, optionsFrom(c, { now: Date.parse('2001-06-01') }));
  assertEqual(v.marks(i), [{ id: 'finance', tone: 'cost' }, { id: 'travel', tone: 'plain' }, { id: 'due', tone: 'overdue' }, { id: 'people', tone: 'free' }], 'travel inherited from its parent');
  assertEqual(v.marks(j), [{ id: 'finance', tone: 'earn' }, { id: 'travel', tone: 'reminder' }, { id: 'due', tone: 'reminder' }], 'its own Den overrides; ⌂ ⏱ marks remind');
});

test('relations survive a round trip; broken ones are dropped', () => {
  const c = normalizeContent(raw);
  let { state } = newSave(c);
  let a, b;
  [state, a] = placeDot(state, centralStar(state).kites[0], 0, 'A');
  [state, b] = placeDot(state, centralStar(state).kites[1], 0, 'B');
  const old = JSON.parse(JSON.stringify({ format: SAVE_FORMAT, content: c.id, state }));
  old.state.dots[a].relations = [{ dot: b, score: 4, how: 'x' }, { dot: b, score: 2 }, { dot: 'gone', score: 5 }, { dot: a, score: 5 }];
  assertEqual(normalizeSave(old).state.dots[a].relations, [{ dot: b, score: 4, how: 'x' }]);
});

test('retrain levels drive staleness through optionsFrom', () => {
  const c = normalizeContent(raw);
  let { state } = newSave(c);
  let d;
  [state, d] = placeDot(state, centralStar(state).kites[0], 0, 'Task');
  state = { ...state, dots: { ...state.dots, [d]: { ...state.dots[d], ignitedAt: 0, trained: true, props: { ...state.dots[d].props, persistence: 'weekly' } } } };
  assertEqual(derive(state, optionsFrom(c, { now: 6 * DAY })).own(d).status, 'ignited');
  assertEqual(derive(state, optionsFrom(c, { now: 8 * DAY })).own(d).status, 'training');
});

test('format 4 (round 6): version-3 files load with no designs, nothing retired, no blocks, a 30-minute gap', () => {
  const c = normalizeContent({ ...raw, version: 3 });
  assertEqual([c.legacyDesigns, 'designs' in c], [null, false]);
  const v3 = { format: SAVE_FORMAT, version: 3, content: 'test-set', state: createState() };
  const save = normalizeSave(v3);
  assertEqual([save.version, save.gap, save.state.retired, save.state.blocks], [FORMAT_VERSION, 30, [], []]);
  assertEqual(Object.values(save.state.kites).every(k => k.design === null), true);
});

test('kite designs load cleaned: category designs by index (the save’s; X2), a kite’s own; others for another grid dropped', () => {
  const design = { ...emptyDesign(), fills: { 0: 'dark', 999: 'dark', 1: 'nonsense' }, lines: [GRID.edges[0].id, 'x-y'] };
  const save = normalizeSave({ format: SAVE_FORMAT, content: 'x', state: createState(), designs: [design, { grid: 'other' }, 'junk'] });
  assertEqual([save.designs[0].fills, save.designs[0].lines, save.designs[1], save.designs[2], save.designs.length], [{ 0: 'dark' }, { [GRID.edges[0].id]: 'light' }, null, null, 6], 'a version-1 line becomes Light (X3)');
  assertEqual(normalizeSave({ format: SAVE_FORMAT, content: 'x', state: createState() }).designs, null, 'a save from before: none of its own yet');
  const c = normalizeContent({ ...raw, designs: [design] });
  assertEqual([c.legacyDesigns[0].fills, JSON.stringify(c).includes('legacyDesigns'), 'designs' in c], [{ 0: 'dark' }, false, false], 'an older content set’s designs are read, never written back');
  let st = createState();
  const k = centralStar(st).kites[0];
  st = { ...st, kites: { ...st.kites, [k]: { ...st.kites[k], design } } };
  const loaded = normalizeSave({ format: SAVE_FORMAT, content: 'x', state: st }).state;
  assertEqual([loaded.kites[k].design.fills, loaded.kites[centralStar(st).kites[1]].design], [{ 0: 'dark' }, null]);
});

test('format 5 (round 7): only the central star stays deployed, board rules map to Free / Fixed, star notes join their star-dot’s Notes, urgent and row order go', () => {
  let st = createState(), d, s;
  [st, d] = placeDot(st, centralStar(st).kites[0], 2, 'Zenith');
  ({ state: st } = addChild(st, d, 'a child'));
  s = st.dots[d].branch;
  st = { ...st, stars: { ...st.stars, [s]: { ...st.stars[s], deployed: true, notes: ['a star note', ' '] }, [centralStar(st).id]: { ...centralStar(st), notes: ['general'] } },
    dots: { ...st.dots, [d]: { ...st.dots[d], urgent: true, notes: ['its own'] } } };
  const v4 = { format: SAVE_FORMAT, version: 4, content: 'x', state: st, board: 'rotate', ui: { order: [d] } };
  const save = normalizeSave(v4);
  assertEqual([save.version, save.state.stars[s].deployed, centralStar(save.state).deployed], [FORMAT_VERSION, false, true], 'every star but the central one waits to be deployed');
  assertEqual([save.board, normalizeSave({ ...v4, board: 'within' }).board, normalizeSave({ ...v4, board: 'anywhere' }).board, normalizeSave({ ...v4, board: 'fixed' }).board], ['fixed', 'free', 'free', 'fixed']);
  assertEqual([save.state.dots[d].notes, save.state.stars[s].notes, centralStar(save.state).notes], [['its own', 'a star note'], [], ['general']]);
  assertEqual(['urgent' in save.state.dots[d], 'ui' in save], [false, false]);
  const v5 = normalizeSave({ ...JSON.parse(JSON.stringify(save)), state: { ...save.state, stars: { ...save.state.stars, [s]: { ...save.state.stars[s], deployed: true } } } });
  assertEqual(v5.state.stars[s].deployed, true, 'a format-5 save keeps its deployed stars');
  assertEqual(normalizeContent({ ...raw, rules: { locks: 'on' } }).rules.locks, 'on');
});

test('round 9, stage 1: the quiz settings (Y4–Y13) are kept cleaned, at today’s behavior unless set', () => {
  const set = { kites: 'central', stardots: 'independent', perStar: 12, deploy: 'auto', questions: 'on', wrong: { mode: 'wait', minutes: 10 }, goalAfter: 14, shuffleChoices: 'on', shuffleQuestions: 'off' };
  assertEqual(normalizeContent({ ...raw, rules: set }).rules, { locks: 'off', fade: 'darken', twinkle: 'normal', lattice: 'shown', ...set, day: { start: 6, end: 22 }, finish: 'flat', bursts: 'on', reveal: 'off', fog: 'off', starfield: 'off', streaks: 'off', bonuses: { on: 'off', every: 3, ladder: [], spin: ['hint', 'prize', 'again', 'nothing'] }, comets: { on: 'off', messages: [] } }, 'every value kept');
  assertEqual(quizRules({ kites: 'some', stardots: 1, perStar: 7, deploy: 'later', questions: 'yes', wrong: { mode: 'sulk', minutes: 0 }, goalAfter: -2 }), QUIZ_DEFAULTS, 'unknown ones take the defaults');
  assertEqual(quizRules({ wrong: { mode: 'wait', minutes: 2.5 } }).wrong, { mode: 'wait', minutes: 5 }, 'minutes are whole, 1–1440');
  assertEqual(normalizeContent(JSON.parse(JSON.stringify(normalizeContent({ ...raw, rules: set })))).rules.goalAfter, 14, 'written and read back');
});

test('round 9, stage 1: format 7: Movement Locked (Y2) and the assessor PIN, hashed (Y3)', () => {
  const save = normalizeSave({ format: SAVE_FORMAT, version: 6, content: 'x', state: createState(), board: 'locked', pin: pinHash('2468') });
  assertEqual([save.version, save.board, save.pin, FORMAT_VERSION], [8, 'locked', pinHash('2468'), 8], 'round 15: format 8 (question sets)');
  assertEqual([pinHash('2468').length, /^[0-9a-f]+$/.test(pinHash('2468')), pinHash('2468') === pinHash('2468'), pinHash('2468') === pinHash('2469')], [16, true, true, false], 'a 16-digit hex hash, stable, different per PIN');
  assertEqual(JSON.stringify(save).includes('2468'), false, 'the PIN itself is never stored');
  assertEqual([normalizeSave({ format: SAVE_FORMAT, content: 'x', state: createState(), pin: '2468' }).pin, normalizeSave({ format: SAVE_FORMAT, content: 'x', state: createState() }).pin], [null, null], 'anything but a hash: no PIN');
  const st = createState();
  const kites = { kind: 'kites', a: { star: centralStar(st).id, i: 0 }, b: { star: centralStar(st).id, i: 1 } };
  const r = boardMove(st, 'locked', kites, {});
  assertEqual([r.state === st, /locked/.test(r.problem)], [true, true], 'Locked refuses every move on PLAY');
});

test('round 9, stage 1: a new session (Y14) withdraws every star but the central one and clears questions’ answers', () => {
  let st = createState(), q, p, s;
  const k = centralStar(st).kites;
  [st, q] = placeDot(st, k[0], 0, 'a question');
  [st, p] = placeDot(st, k[1], 0, 'not a question');
  [st, s] = planStar(st, p);
  st = { ...st, stars: { ...st.stars, [s]: { ...st.stars[s], deployed: true } },
    dots: { ...st.dots, [q]: { ...st.dots[q], assessment: { question: 'Why?' }, ignitedAt: DAY, trained: true }, [p]: { ...st.dots[p], ignitedAt: DAY, trained: true } } };
  const next = startSession(st);
  assertEqual([next.dots[q].ignitedAt, next.dots[q].trained, next.dots[p].ignitedAt, next.dots[q].assessment.question], [null, false, DAY, 'Why?'], 'a question’s answer goes; others’ completions and the question stay');
  assertEqual([next.stars[s].deployed, !!next.stars[s], Object.values(next.stars).filter(x => x.deployed).map(x => x.id)], [false, true, [centralStar(st).id]], 'its star is withdrawn (kept, planned); only the central star stays on the map');
});

test('round 13: the map’s Look settings: Twinkle speed (slow · normal · fast) and Background lattice (shown · hidden), cleaned', () => {
  const r = rules => normalizeContent({ ...raw, rules }).rules;
  assertEqual(r({ twinkle: 'veryslow' }).twinkle, 'veryslow', 'round 14: Very slow');
  assertEqual([r({ twinkle: 'fast', lattice: 'hidden' }).twinkle, r({ twinkle: 'fast', lattice: 'hidden' }).lattice], ['fast', 'hidden'], 'kept');
  assertEqual([r({ twinkle: 'toString', lattice: 'off' }).twinkle, r({ twinkle: 9, lattice: 'off' }).lattice], ['normal', 'shown'], 'unknown ones take the defaults');
});
