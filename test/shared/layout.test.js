// P4: the star-dot screen's widget layout (engine layout.js), kept in the content set and, for one
// star-dot, in the save.

import { test, assertEqual } from '../runner.js';
import {
  cleanLayout, moveWidget, hideWidget, showWidget, hiddenWidgets, DEFAULT_LAYOUT, setDotLayout, createState, placeDot, centralStar,
  normalizeSave, normalizeContent, SAVE_FORMAT, CONTENT_FORMAT,
} from '../../shared/engine/index.js';

test('P4: a layout is cleaned (two columns, known widgets once each); anything unreadable is the default', () => {
  assertEqual(cleanLayout(null).columns, DEFAULT_LAYOUT.columns.map(c => [...c]));
  assertEqual(cleanLayout({ columns: [['notes', 'bogus', 'notes'], ['checklist', 'notes']] }).columns, [['notes'], ['checklist']]);
  assertEqual(hiddenWidgets(cleanLayout({ columns: [['notes'], ['checklist']] })), ['assessor', 'attributes', 'relevance']);
});

test('P4: moving, switching off and on', () => {
  let l = cleanLayout(null);
  l = moveWidget(l, 'assessor', 1, 'attributes');
  assertEqual(l.columns, [['checklist', 'notes'], ['assessor', 'attributes', 'relevance']]);
  l = moveWidget(l, 'checklist', 1, null);
  assertEqual(l.columns, [['notes'], ['assessor', 'attributes', 'relevance', 'checklist']]);
  l = hideWidget(l, 'relevance');
  assertEqual(hiddenWidgets(l), ['relevance']);
  assertEqual(showWidget(l, 'relevance').columns, [['notes', 'relevance'], ['assessor', 'attributes', 'checklist']], 'back at the end of the shorter column');
});

test('P4: a star-dot’s own layout is kept in the save, and dropped by Reset', () => {
  let st = createState();
  const k = centralStar(st).kites[0];
  let d;
  [st, d] = placeDot(st, k, 0, 'One');
  const own = hideWidget(cleanLayout(null), 'notes');
  st = setDotLayout(st, d, own);
  const raw = JSON.parse(JSON.stringify({ format: SAVE_FORMAT, version: 8, content: 'x', state: st }));
  assertEqual(normalizeSave(raw).state.dots[d].layout, own, 'kept through a save and load');
  st = setDotLayout(st, d, null);
  assertEqual('layout' in st.dots[d], false, 'Reset drops it');
  assertEqual('layout' in normalizeSave({ ...raw, state: st }).state.dots[d], false, 'and a star-dot without one stays without one');
});

test('P4: a content set always has a layout (the default when it has none)', () => {
  const raw = { format: CONTENT_FORMAT, id: 'x', title: 'X', categories: ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => ({ name, color: '#00000' + i })) };
  assertEqual(normalizeContent(raw).layout, cleanLayout(null));
  assertEqual(normalizeContent({ ...raw, layout: { columns: [['relevance'], ['checklist']] } }).layout.columns, [['relevance'], ['checklist']], 'and keeps its own');
});
