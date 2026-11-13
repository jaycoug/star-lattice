// Undo and redo for every change: one history of the open save and its content set (about 100
// steps). It watches the store, so every action is covered without each one recording itself:
// whenever the save or the content set changes, the version before goes on the undo list. Opening
// another save starts a new history (reset). Browser settings (palette choice, the DISSECT STAR view, …)
// aren't part of it.

const LIMIT = 100;

export function createHistory(store) {
  let undo = [];
  let redo = [];
  let last = store.get();
  let replaying = false;
  const snap = f => ({ save: f.save, content: f.content });

  // A change that leaves both exactly as they were (e.g. committing an unchanged name) isn't a step.
  const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
  store.subscribe(f => {
    if (!replaying && (f.save !== last.save || f.content !== last.content) && !(same(f.save, last.save) && same(f.content, last.content))) {
      undo = [...undo.slice(1 - LIMIT), snap(last)];
      redo = [];
    }
    last = f;
  });

  /** Step back (undo) or forward (redo): the current version goes on the other list, which is updated before the store re-renders. */
  const step = from => {
    const list = from === 'undo' ? undo : redo;
    if (!list.length) return false;
    const target = list[list.length - 1];
    const current = snap(store.get());
    if (from === 'undo') [undo, redo] = [undo.slice(0, -1), [...redo, current]];
    else [redo, undo] = [redo.slice(0, -1), [...undo, current]];
    replaying = true;
    store.set(target);
    replaying = false;
    return true;
  };

  return {
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
    undo: () => step('undo'),
    redo: () => step('redo'),
    /** The history as it stands, to put back later (a Play-mode test run keeps its own meanwhile). */
    stash: () => ({ undo, redo }),
    /** Put back a stashed history; the store's current file is the one it continues from. */
    unstash(h) {
      ({ undo, redo } = h);
      last = store.get();
    },
    /** Forget the history (after opening another save). */
    reset() {
      undo = [];
      redo = [];
      last = store.get();
    },
  };
}
