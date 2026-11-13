// Bulk import of question files. Each set names its star-dot by `target:`, a path of
// star-dot names joined by ">" (e.g. "Statistics > Problem set > 1."). planImport finds each
// path's star-dot, or the parent a missing last step is created under; applyImport does it all in
// one change. Names match ignoring case and spacing; a path may start at any star-dot whose name is
// unique, not only the central star's.
//
// Under Star-dots: Independent, a path is "Category > Item" (or just "Item"): the item in that
// category's list, created at the end of it when missing.
//
// planImport(st, view, sets, categories, { picks }) → [Row]
// Row { set (index), title, count, target, dot | null, create: { parent | kite, name } | null, problem | null }
// picks: { setIndex: dotId } for a set with no target (chosen in the preview)
// applyImport(st, plan, sets, { mode: 'replace' | 'append', options }) → { state, dots: [dotId], problem }

import { index, centralStar, childSlots, parentOf } from './model.js';
import { listOf, listKiteOf } from './independent.js';
import { addChild, updateDot } from './actions.js';
import { addItem } from './independent.js';
import { setAssessment } from './questions.js';
import { questionsOf, setValue, toMarkdown } from './qset.js';

const norm = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export const splitPath = p => String(p ?? '').split('>').map(x => x.trim()).filter(Boolean);

/** A star-dot's children by the view (the central star's kites for the top). */
function childrenOf(st, view, dotId) {
  if (dotId == null) {
    const c = centralStar(st);
    return childSlots(st, c.id).map(({ kite, slot }) => st.kites[kite].dots[slot]).filter(Boolean);
  }
  return view.children(dotId);
}

/** The star-dot a path names: { dot } or { parent, name } (its last step missing) or { problem }. */
export function resolvePath(st, view, path) {
  const names = splitPath(path);
  if (!names.length) return { problem: 'It has no target.' };
  const placed = [...index(st).dot.keys()];
  const named = (ids, n) => ids.filter(d => norm(st.dots[d]?.name) === norm(n));
  let cur = null;
  for (let i = 0; i < names.length; i++) {
    let hits = named(childrenOf(st, view, cur), names[i]);
    if (!hits.length && i === 0) hits = named(placed, names[i]);
    if (hits.length > 1) return { problem: `“${names[i]}” names ${hits.length} star-dots${cur ? ` under “${st.dots[cur].name}”` : ''}: the path can’t tell which.` };
    if (!hits.length) {
      if (i === names.length - 1 && cur != null) return { parent: cur, name: names[i] };
      return { problem: i === 0 ? `No star-dot is named “${names[0]}”.` : `No “${names[i]}” under “${st.dots[cur].name}”.` };
    }
    cur = hits[0];
  }
  return { dot: cur };
}

/** Under Independent: "Category > Item" or "Item". */
function resolveItem(st, path, categories) {
  const names = splitPath(path);
  const central = centralStar(st);
  const kites = central.kites;
  const ofCategory = n => kites.find(k => norm(categories[st.kites[k].color]?.name) === norm(n));
  if (names.length === 2) {
    const k = ofCategory(names[0]);
    if (!k) return { problem: `No category is named “${names[0]}”.` };
    const hits = listOf(st, k).filter(d => norm(st.dots[d].name) === norm(names[1]));
    if (hits.length > 1) return { problem: `“${names[1]}” names ${hits.length} items of ${names[0]}.` };
    return hits.length ? { dot: hits[0] } : { kite: k, name: names[1] };
  }
  if (names.length === 1) {
    const hits = kites.flatMap(k => listOf(st, k)).filter(d => norm(st.dots[d].name) === norm(names[0]));
    if (hits.length === 1) return { dot: hits[0] };
    return { problem: hits.length ? `“${names[0]}” names ${hits.length} items: give its category, “Category > ${names[0]}”.` : `No item is named “${names[0]}”: give its category to create it, “Category > ${names[0]}”.` };
  }
  return { problem: names.length ? 'Under Independent a target is “Category > Item”.' : 'It has no target.' };
}

export function planImport(st, view, sets, categories = [], { picks = {} } = {}) {
  const independent = view.opts?.stardots === 'independent';
  const creating = new Map();   // the same new star-dot named by two sets is made once
  return sets.map((set, i) => {
    const row = { set: i, title: set.title, count: questionsOf(set).length, target: set.target, dot: null, create: null, problem: null };
    if (!set.target.trim()) {
      if (picks[i] && st.dots[picks[i]]) return { ...row, dot: picks[i] };
      return { ...row, problem: 'It has no target: choose its star-dot.' };
    }
    const r = independent ? resolveItem(st, set.target, categories) : resolvePath(st, view, set.target);
    if (r.problem) return { ...row, problem: r.problem };
    if (r.dot) {
      if (!independent && view.children(r.dot).length) return { ...row, problem: `“${st.dots[r.dot].name}” has children: their questions decide it. Aim at one of them.` };
      return { ...row, dot: r.dot };
    }
    const key = `${r.parent ?? r.kite}>${norm(r.name)}`;
    const create = r.parent ? { parent: r.parent, name: r.name } : { kite: r.kite, name: r.name };
    if (creating.has(key)) return { ...row, create, same: creating.get(key) };
    creating.set(key, i);
    return { ...row, create };
  });
}

/** Do a plan: create the missing star-dots, give each its set (Replace or Append), make them □. */
export function applyImport(st, plan, sets, { mode = 'replace', options } = {}) {
  const made = new Map();
  const dots = [];
  for (const row of plan) {
    if (row.problem) continue;
    let d = row.dot;
    if (!d && row.same != null) d = made.get(row.same);
    if (!d && row.create) {
      if (row.create.parent) {
        const r = addChild(st, row.create.parent, row.create.name, { options });
        if (r.problem) return { state: st, dots: [], problem: `${row.title || `Set ${row.set + 1}`}: ${r.problem}` };
        st = r.state; d = r.dot;
      } else {
        const [next, id] = addItem(st, row.create.kite, row.create.name);
        st = next; d = id;
      }
      made.set(row.set, d);
    }
    if (!d) continue;
    const incoming = { ...sets[row.set], target: '' };
    const had = st.dots[d].assessment;
    let set = incoming;
    if (mode === 'append' && had) {
      const ids = new Set(questionsOf(had).map(q => q.id));
      const items = incoming.items.map(it => {
        const fresh = id => { let x = id, n = 2; while (ids.has(x)) x = `${id}-${n++}`; ids.add(x); return x; };
        return it.type === 'chain' ? { ...it, items: it.items.map(q => ({ ...q, id: fresh(q.id) })) } : { ...it, id: fresh(it.id) };
      });
      set = setValue({ ...had, items: [...had.items, ...items] });
    }
    st = setAssessment(st, d, set);
    if (st.dots[d].role !== 'assess') st = updateDot(st, d, { role: 'assess' });
    dots.push(d);
  }
  return { state: st, dots, problem: null };
}

/** A star-dot's path of names (its target): from the top down; under Independent, [category, item]. */
export function pathOf(st, dotId, categories = [], view = null) {
  if (view?.opts?.stardots === 'independent') {
    const k = listKiteOf(st, dotId);
    if (k) return [categories[st.kites[k].color]?.name ?? 'Category', st.dots[dotId].name];
  }
  const out = [];
  const seen = new Set();
  for (let d = dotId; d && !seen.has(d); d = parentOf(st, d)) { seen.add(d); out.unshift(st.dots[d]?.name || 'Unnamed'); }
  return out;
}

/** Export questions…: every star-dot's set as one file, each with its target, in the save's order. */
export function exportQuestions(st, view, categories = []) {
  const independent = view?.opts?.stardots === 'independent';
  const ids = independent
    ? centralStar(st).kites.flatMap(k => listOf(st, k))
    : [...index(st).dot.keys()];
  return ids.filter(d => st.dots[d]?.assessment && questionsOf(st.dots[d].assessment).length)
    .map(d => toMarkdown({ ...st.dots[d].assessment, title: st.dots[d].assessment.title || st.dots[d].name }, { target: pathOf(st, d, categories, view).join(' > ') }))
    .join('\n---\n\n');
}

// ---- one new star-dot per question ------------------------------------------

/** A short star-dot name from a question: its first line of text, without Markdown marks or blanks. */
function nameFor(it, i) {
  const t = (it.type === 'chain' ? it.title || it.items[0]?.text : it.text) ?? '';
  const first = t.split('\n').find(l => l.trim() && !/^\s*(```|~~~)/.test(l)) ?? '';
  const clean = first.replace(/_{4,}/g, '…').replace(/[>`*#]/g, '').replace(/\s+/g, ' ').trim();
  return (clean.length > 48 ? `${clean.slice(0, 47).trimEnd()}…` : clean) || `Question ${i + 1}`;
}

/**
 * A set without a target as one set per question (a chain stays whole; a step goes with the
 * question after it), each aimed at a new star-dot under `under` (a target path: a star-dot's, or
 * under Independent a category's name), named by its question's first line (made unique).
 */
export function splitSet(set, under) {
  const used = new Set();
  const out = [];
  let steps = [];
  set.items.forEach((it, i) => {
    if (it.type !== 'chain' && it.kind === 'step') { steps.push(it); return; }
    let name = nameFor(it, i);
    const base = name;
    for (let n = 2; used.has(norm(name)); n++) name = `${base} (${n})`;
    used.add(norm(name));
    out.push(setValue({ ...set, title: name, target: `${under} > ${name}`, items: [...steps, it] }));
    steps = [];
  });
  return out;
}
