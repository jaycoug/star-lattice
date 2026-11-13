// Minimal state container: one state object, replaced (never mutated) on every change.
// Subscribers run after each change; main.js re-renders the page and autosaves from there.

export function createStore(initial) {
  let state = initial;
  const subscribers = new Set();
  const notify = () => subscribers.forEach(fn => fn(state));

  return {
    get: () => state,

    /** Merge a patch into the state. `update` is a patch object or (state) => patch. */
    set(update) {
      const patch = typeof update === 'function' ? update(state) : update;
      if (!patch) return;
      state = { ...state, ...patch };
      notify();
    },

    /** Swap in a whole new state (loading a file, snapshot or preset). */
    replace(next) {
      state = next;
      notify();
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
