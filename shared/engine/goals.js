// Goals and completed categories, with questions on.
//
// state.goals: { category: dotId } a category's goal question, picked at random (kept in the save)
// state.complete: { category: at (ms) } categories completed this session (a new session clears both)
//
// A category is a category index (its kites' color), under Hierarchical and Independent alike.
//
// settleGoals(state, options) brings both up to date after any change (the app runs it on every
// change, around Deploy: Automatically):
// - a category whose goal has been answered correctly is complete;
// - under Independent, so is one with every item of its list answered, whether or not it has a
// goal. (Under Hierarchical there's no list to finish, and more star-dots can appear as stars
// deploy, so a category completes only through its goal.)
// - with Goal after N correct (options.goalAfter > 0), a category with at least N correct and no
// goal (or one that left the map, or was answered) gets one: an unanswered star-dot of it already
// on the map, at random (options.random). If none is on the map, it's picked when one appears,
// on a later change.
// A complete category is a closed branch: nothing in it can be answered (questionState 'complete')
// or deploy any more (deployStar refuses), and its stars and central kite are drawn filled, with no
// star-dots (shared/ui/map.js).

import { withDefaults, index } from './model.js';
import { derive } from './derive.js';
import { askable, categoryProgress } from './questions.js';

/** Whether a category (index) is complete this session. */
export const categoryComplete = (st, c) => c != null && st.complete?.[c] != null;
/** A category's goal star-dot, or null. */
export const goalOf = (st, c) => (c == null ? null : st.goals?.[c] ?? null);

const CATEGORIES = 6;

export function settleGoals(st, options) {
  const opts = withDefaults(options);
  if (opts.questions !== 'on') return st;
  const view = derive(st, opts);
  const vs = view.state;
  const progress = categoryProgress(st, view, CATEGORIES);
  const lit = d => view.effective(d).status === 'ignited';
  let goals = st.goals ?? {};
  let complete = st.complete ?? {};
  for (let c = 0; c < CATEGORIES; c++) {
    if (complete[c] != null) continue;
    const goal = goals[c];
    const p = progress[c];
    if ((goal && st.dots[goal] && lit(goal)) || (vs.projected && p.total && p.correct === p.total)) {
      complete = { ...complete, [c]: opts.now };
      continue;
    }
    const after = opts.goalAfter ?? 0;
    const stands = goal && st.dots[goal] && index(vs).dot.has(goal) && !lit(goal);
    if (!after || stands || p.correct < after) continue;
    // Not a Zenith still waiting for those inside it (the map doesn't show it yet).
    const candidates = [...index(vs).dot.keys()].filter(d => view.categoryOf(d) === c && !view.children(d).length && askable(st.dots[d].assessment) && !lit(d) && !view.insideFirst(d));
    if (!candidates.length) {
      if (goal) { const { [c]: _, ...rest } = goals; goals = rest; }   // gone: picked again when one appears
      continue;
    }
    goals = { ...goals, [c]: candidates[Math.min(candidates.length - 1, Math.floor(opts.random() * candidates.length))] };
  }
  return goals === (st.goals ?? {}) && complete === (st.complete ?? {}) ? st : { ...st, goals, complete };
}
