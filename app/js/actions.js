// Every change to the working file goes through one of these actions. Panels call them; they
// never touch the store directly. Storage actions report results with notify(). Every change to
// the save or content set can be undone (history.js); main.js writes them back to their files.
//
// `store` holds the working file (see model.js). `ui` holds view-only selection (open kite
// skeleton, selected star-dot, widget tab, PLAY's and REARRANGE's map selections) that is never
// saved.
//
// Panels address star-dots, kites and stars by engine ID. Board changes are engine actions
// (shared/engine), with the file's own rule options; stars appear only when deployed (deployStar).
// Moves (PLAY's map and REARRANGE's tree) share canMove / moveTo; a move that would clash
// (a branch landing on another star, a star-dot into its own branch) opens a conflict card
// (ui.conflict): shelve, or cancel.

import * as E from '../../shared/engine/index.js';
import { openFile, prefsOf, resolve, options, paletteNameProblem, builtInPalette, themeOf } from './model.js';
import { notify, downloadJson } from './dom.js';
import { normalizeDesign } from '../../shared/kiteDesign.js';
import { CENTRAL } from '../../shared/ui/starDotScreen.js';
import * as storage from './storage.js';
import { route } from './route.js';
import { PLAY } from './edition.js';


export function createActions(store, ui, history) {
  const file = () => store.get();
  const view = () => resolve(file());
  const set = patch => store.set(patch);

  /**
   * Apply an engine change fn(state) → state. Every change passes here, so a star-dot that becomes
   * complete, wherever that happens, loses its hour blocks after now, and a deployed star the
   * change leaves facing a taken position is withdrawn, in the same undo step; the
   * change's message (withUndo) names the withdrawn stars, or a message of their own does. Round 9
   *: with Deploy: Automatically, a Zenith star-dot the change completed deploys its star here
   * too (and the message says so).
   */
  let undoDepth = 0;
  let withdrawnNote = '';
  let marksNote = '';
  const change = (fn) => {
    withdrawnNote = '';
    marksNote = '';
    store.set(f => {
      let next = fn(f.save.state);
      if (!next || next === f.save.state) return null;
      next = E.syncArrangements(next, options(f));   // The tree and the lists hold the same star-dots
      next = E.clearCompleted(f.save.state, next, options(f));
      // Goals and completed categories settle before and after Deploy: Automatically
      // (a completed category deploys nothing; a goal can be picked among star-dots just deployed).
      next = E.settleGoals(next, options(f));
      const auto = E.autoDeploy(f.save.state, next, options(f));
      next = E.settleGoals(auto.state, options(f));
      const w = E.withdrawBlocked(next, options(f), f.save.state);
      next = E.settleBonus(f.content, f.save.state, w.state, options(f));   // the bonus ladder counts what ignited
      next = E.settleComets(f.content, f.save.state, next, options(f));        // 9d: comets whose trigger this met
      if (route().mode === 'play') next = E.settleMarks(f.content, next, options(f));   // 9e: marks met (Play mode)
      marksNote = E.newMarks(f.save.state, next).map(m => `${m.icon} Mark earned: ${m.name}`).join(' · ');
      const starName = s => `${next.dots[next.stars[s].sources[0]]?.name || 'an unnamed star-dot'}’s star`;
      const notes = [];
      // Under Independent a star holds the category's next items, nothing of the item that opened
      // it: no "Deployed X's star" or "Withdrew X's star".
      const independent = E.independentOn(options(f));
      if (auto.deployed.length && !independent) notes.push(`Deployed ${auto.deployed.map(starName).join(', ')}.`);
      if (w.withdrawn.length && !independent) notes.push(`Withdrew ${w.withdrawn.map(starName).join(', ')}: the position its kite faces is taken.`);
      withdrawnNote = notes.join(' ');
      return { save: { ...f.save, state: next } };
    });
    if (withdrawnNote && !undoDepth) notify(withdrawnNote, 'info', { label: 'Undo', onClick: () => actions.undo() });
    if (marksNote) notify(marksNote, 'info');
  };
  const setSave = patch => store.set(f => ({ save: { ...f.save, ...(typeof patch === 'function' ? patch(f.save) : patch) } }));
  // ---- Saves ----
  // `saving`: 'saved' (nothing unwritten), 'saving' (changes waiting or being written) or 'failed';
  // `savedAt`: when this session last wrote the open save (else the file's own time is shown).
  // A status change redraws only the save bar's indicator (`onSaving`, set by stateBar.js), never
  // the whole page: a full re-render from inside a write could loop.
  // The packs, for New from a blueprint…; derive: Make a repo… under serve.py ({ available, parent, previous }), else null.
  const session = { saves: [], packs: [], derive: null, saving: 'saved', savedAt: null, error: '' };
  let onSaving = () => {};
  let test = null;   // Play mode's test run: { home (the file as Edit mode left it), history (Edit mode's undo) }
  /** A fresh test run on the designed board: a new session, its own empty undo history. */
  const fresh = () => {
    const home = test.home;
    store.replace({ ...home, kiteLook: file().kiteLook, theme: file().theme, save: { ...home.save, state: E.startSession(home.save.state) } });
    history.reset();
    ui.set({ playSel: null, playMode: null, quiz: null, sds: null, sdsUi: {}, rSel: null, rMode: null, retiredPick: null });
  };
  /** The file to write: the designed board, even during a test run. */
  const written = () => test?.home ?? file();
  const setSaving = (saving, patch = {}) => {
    Object.assign(session, { saving, ...patch });
    onSaving();
  };

  async function refreshSaves() {
    try { session.saves = await storage.saves.list(); } catch { session.saves = []; }
    try { session.packs = await storage.packs(); } catch { session.packs = []; }
    if (storage.mode === 'server' && !session.derive) {
      try {
        const r = await fetch('../api/derive', { cache: 'no-store' });
        session.derive = r.ok ? await r.json() : { available: false };
      } catch { session.derive = { available: false }; }
    }
    ui.set({});  // empty patch: re-render only
  }

  /** Write the open save and content set (main.js calls this after changes, and on closing). */
  function persist({ keepalive = false } = {}) {
    const f = written();
    storage.savePrefs(prefsOf(file()));
    if (storage.unwritten(f)) setSaving('saving');
    storage.writeFile(f, { keepalive }).then(
      wrote => { if (!storage.unwritten(written())) setSaving('saved', wrote ? { savedAt: new Date().toISOString(), error: '' } : {}); },
      e => { setSaving('failed', { error: e.message }); notify('Couldn’t save: ' + e.message, 'error'); });
  }
  /** Called on every change of the file: shows "Saving…" until the write is done. */
  function pending() {
    if (storage.unwritten(written()) && session.saving === 'saved') Object.assign(session, { saving: 'saving' });
  }

  /** Open save `name` (with its content set); the history starts over. */
  async function open(name, message = `Opened "${name}"`) {
    try {
      const save = E.normalizeSave(await storage.saves.load(name));
      const content = E.normalizeContent(await storage.contentSets.load(save.content));
      const f = openFile(name, save, content, prefsOf(file()));
      storage.markWritten(save.design ? f : { ...f, content: null });
      if (!content.starter) storage.contentSets.save(content.id, { ...content, starter: E.freshBoard(save.state) }).catch(() => {});   // its library starts as this save's items (P10)
      if (!save.design) setTimeout(() => persist());   // a save from before takes its own copy of the design now (P10)
      ui.set({ kite: -1, dot: -1, playSel: null, playMode: null, rSel: null, rMode: null, tPath: [], sds: null, sdsUi: {}, quiz: null });
      Object.assign(session, { saving: 'saved', savedAt: null, error: '' });
      test = null;   // (A test run's designed board was written as it began)
      store.replace(f);
      history.reset();
      notify(message);
      refreshSaves();
      return true;
    } catch (e) {
      notify(`Couldn’t open "${name}": ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Apply a change and say what it did (with Undo, which is the general undo: Ctrl+Z also works).
   * Returns whether anything changed.
   */
  function withUndo(apply, message) {
    const before = file();
    undoDepth++;
    try { apply(); } finally { undoDepth--; }
    if (file() === before) return false;
    if (withdrawnNote) message = message ? `${message}. ${withdrawnNote}` : withdrawnNote;
    if (message) notify(message, 'info', { label: 'Undo', onClick: () => actions.undo() });   // (no message: done quietly)
    return true;
  }

  /**
   * A move (engine fn(state, options, how) → { state, problem, conflict }), undoable; a refused move
   * shows why, and a clash opens the conflict card, whose Shelve runs it again with onConflict
   * 'shelve'. Returns whether it happened.
   */
  function move(fn, message, how = {}) {
    const { state, problem, conflict } = fn(file().save.state, options(file()), how);
    if (conflict && !how.onConflict) {
      ui.set({ conflict: { kind: conflict, problem, message, shelve: () => move(fn, message, { onConflict: 'shelve' }) } });
      return false;
    }
    if (problem) return void notify(problem, 'error') ?? false;
    return withUndo(() => change(() => state), message);
  }

  /** What REARRANGE's pick mode is moving, as a move source; null when not picking. */
  function rFrom() {
    const mode = ui.get().rMode;
    return !mode ? null : mode.kind === 'swapKite' ? { kind: 'kite', id: mode.kite }
      : mode.kind === 'place' ? { kind: 'shelf', entry: mode.entry } : slotTarget(mode.from);
  }

  /** A slot { kite, slot } as a map target (its star-dot, or the empty slot). */
  function slotTarget({ kite, slot }) {
    const d = file().save.state.kites[kite].dots[slot];
    return d ? { kind: 'dot', id: d } : { kind: 'slot', kite, slot };
  }

  /** Whether dragging `from` onto `to` does anything (see drop). */
  function canDrop(from, to) {
    if (!from || !to) return false;
    const st = file().save.state;
    const ix = E.index(st);
    const central = E.centralStar(st).id;
    const slotOf = x => (x.kind === 'dot' ? ix.dot.get(x.id) : x.kind === 'slot' ? { kite: x.kite, slot: x.slot } : null);
    const starOf = k => ix.kite.get(k)?.star;
    if (from.kind === 'shelf') {
      const e = from.entry;
      if (e.kind === 'dot') return to.kind === 'slot' || to.kind === 'dot';
      if (e.kind === 'kite') return to.kind === 'kite' && starOf(to.id) !== central;
      return to.kind === 'dot' && !(st.dots[to.id].branch && st.stars[st.dots[to.id].branch]);
    }
    if (to.kind === 'shelf') return from.kind === 'dot' || (from.kind === 'kite' && starOf(from.id) !== central);
    if (from.kind === 'kite') {
      if (to.kind !== 'kite' || to.id === from.id) return false;
      const [a, b] = [starOf(from.id), starOf(to.id)];
      return a === b || (a !== central && b !== central);
    }
    const [a, b] = [slotOf(from), slotOf(to)];
    return !!a && !!b && !(a.kite === b.kite && a.slot === b.slot) && (from.kind === 'dot' || to.kind === 'dot');
  }

  /**
   * Drop `from` on `to`: swap two star-dots (or move one into an empty slot), swap two kites (on
   * any stars but the central one, which keeps its own), put a star-dot or kite on the shelf, or
   * place something from the shelf. Every one is undoable; a refused move says why.
   */
  function drop(from, to) {
    if (!canDrop(from, to)) return;
    const st = file().save.state;
    const ix = E.index(st);
    const dotName = id => st.dots[id].name || 'the star-dot';
    const kiteName = id => st.kites[id].name || 'the kite';
    const slotOf = x => (x.kind === 'dot' ? { ...ix.dot.get(x.id) } : { kite: x.kite, slot: x.slot });
    if (from.kind === 'shelf') {
      const e = from.entry;
      const target = e.kind === 'dot' ? slotOf(to) : e.kind === 'kite' ? { ...ix.kite.get(to.id) } : { dot: to.id };
      const what = e.kind === 'dot' ? dotName(e.id) : e.kind === 'kite' ? kiteName(e.id) : 'the star';
      return move((s, o, how) => E.placeFromShelf(s, e, target, o, how), `Placed ${what} from the shelf`);
    }
    if (to.kind === 'shelf') {
      return from.kind === 'dot'
        ? withUndo(() => change(s => E.shelveDot(s, from.id)), `Put ${dotName(from.id)} on the shelf`)
        : withUndo(() => change(s => E.shelveKite(s, from.id)), `Put ${kiteName(from.id)} on the shelf`);
    }
    if (from.kind === 'kite') {
      return move((s, o, how) => E.swapKites(s, { ...ix.kite.get(from.id) }, { ...ix.kite.get(to.id) }, o, how), moveMessage(from, to));
    }
    return move((s, o, how) => E.swapDots(s, slotOf(from), slotOf(to), o, how), moveMessage(from, to));
  }

  // ---- The Star view's moves ----
  // They go through E.boardMove: in Play mode under the player's Movement switches (Design ›
  // Player), in Edit mode freely. What isn't allowed, or a move that would cause a lineage conflict,
  // is refused with a reason (never shelved; the shelf and conflict cards are the Tree view's).
  // Results are cached per state while a drag asks about every target.
  const editing = () => route().mode !== 'play';
  const SPIN_MS = 2600;   // 9c: how long the star turns (map.js turns it in the same time)
  const player = () => E.earnedPlayer(file().content, file().save.state);   // Design › Player, less the ladder's locked rungs
  /**
   * 9e: Layer turned to Constellation (by the designer or the player): its arrows travel from each
   * origin to its target, one after another (u.layerShow), then it stays as the constellation view.
   */
  const TRAVEL_MS = 2600;
  const showConstellation = () => {
    const t0 = Date.now();
    ui.set({ layer: 'constellation', layerShow: t0 });
    const t = setTimeout(() => { if (ui.get().layerShow === t0) ui.set({ layerShow: null }); }, TRAVEL_MS); t.unref?.();
  };
  const boardRule = () => E.playerMoves(player(), editing());
  let boardCache = { state: null, rule: null, results: new Map() };
  /** PLAY's move of `from` onto `to`: { state, problem } (problem null when allowed). */
  function boardTry(from, to) {
    const st = file().save.state;
    if (from.kind === 'shelf' || to.kind === 'shelf') return { state: st, problem: 'The shelf is in the Tree view.' };
    const rule = JSON.stringify(boardRule());
    if (boardCache.state !== st || boardCache.rule !== rule) boardCache = { state: st, rule, results: new Map() };
    const key = JSON.stringify([from, to]);
    if (!boardCache.results.has(key)) {
      const ix = E.index(st);
      const slotOf = x => (x.kind === 'dot' ? { ...ix.dot.get(x.id) } : { kite: x.kite, slot: x.slot });
      const m = from.kind === 'kite'
        ? { kind: 'kites', a: { ...ix.kite.get(from.id) }, b: { ...ix.kite.get(to.id) } }
        : { kind: 'dots', a: slotOf(from), b: slotOf(to) };
      boardCache.results.set(key, E.boardMove(st, boardRule(), m, options(file())));
    }
    return boardCache.results.get(key);
  }
  const playCanMove = (from, to) => !!from && !!to && canDrop(from, to) && !boardTry(from, to).problem;
  function playMoveTo(from, to) {
    if (!canDrop(from, to)) return false;
    const { state, problem } = boardTry(from, to);
    if (problem) return void notify(problem, 'error') ?? false;
    return withUndo(() => change(() => state), moveMessage(from, to));
  }
  /** A drop PLAY refused: say why (the rule, a lineage conflict, or the shelf). */
  function playRefused(from, to) {
    if (to?.kind === 'shelf') return notify('The shelf is in the Tree view.', 'error');
    if (from && to && canDrop(from, to)) notify(boardTry(from, to).problem, 'error');
  }

  /** What a move does, for its message ("Swapped kites Career and School"). */
  function moveMessage(from, to) {
    const st = file().save.state;
    const dotName = id => st.dots[id].name || 'the star-dot';
    const kiteName = id => st.kites[id].name || 'the kite';
    if (from.kind === 'kite') return `Swapped kites ${kiteName(from.id)} and ${kiteName(to.id)}`;
    const name = x => (x.kind === 'dot' ? dotName(x.id) : 'an empty slot');
    return to.kind === 'slot' ? `Moved ${name(from)}` : `Swapped ${name(from)} and ${name(to)}`;
  }

  const actions = {
    ui: () => ui.get(),

    renameDot: (id, name) => change(s => E.updateDot(s, id, { name })),

    /** The Star view's ↻ Rotate (and R): as rotateKiteById, where the player may rotate star-dots. */
    playRotate(kite) {
      if (!E.canRotate(boardRule())) return void notify('Rotating star-dots isn’t allowed here.', 'error');
      if (E.independentOn(options(file()))) return void notify('Under Independent the items keep their list order: reorder them in the Tree view.', 'error');
      actions.rotateKiteById(kite);
    },
    /** ⟳ Rotate kites (and Shift+R): the kites of `kite`'s star move one place clockwise around it. */
    playRotateKites(kite) {
      const star = E.index(file().save.state).kite.get(kite)?.star;
      if (!star) return;
      const { state, problem } = E.boardMove(file().save.state, boardRule(), { kind: 'rotateKites', star }, options(file()));
      if (problem) return void notify(problem, 'error');
      withUndo(() => change(() => state), 'Rotated the star’s kites clockwise');
    },
    /** Rotate a kite's skeleton one step clockwise (Nadir → Port → Zenith → Starboard), with Undo. */
    rotateKiteById(kite) {
      withUndo(() => change(s => E.rotateKite(s, kite)), `Rotated ${file().save.state.kites[kite].name || 'the kite'} clockwise`);
    },

    // ---- The star-dot screen (shared/ui/starDotScreen.js), as a full view over any tab ----
    /** Any engine change from the screen. */
    change,
    openScreen: id => ui.set({ sds: { dot: id, trail: [] }, sdsUi: {} }),
    openRelated: id => ui.set(u => ({ sds: { dot: id, trail: [...(u.sds?.trail ?? []), u.sds.dot] }, sdsUi: {} })),
    back: () => ui.set(u => {
      const trail = u.sds?.trail ?? [];
      return trail.length ? { sds: { dot: trail[trail.length - 1], trail: trail.slice(0, -1) }, sdsUi: {} } : { sds: null, sdsUi: {} };
    }),
    closeScreen: () => ui.set({ sds: null, sdsUi: {} }),
    /** Show `id`'s screen in place of the current one (after merging it away); the trail drops star-dots that are gone. */
    openInstead: id => ui.set(u => ({ sds: { dot: id, trail: (u.sds?.trail ?? []).filter(d => d !== id && file().save.state.dots[d]) }, sdsUi: {} })),
    /** A change that can be refused (engine fn(state, options) → { state, problem }): shows why, or applies it (undoable). */
    act(fn, message) {
      const { state, problem } = fn(file().save.state, options(file()));
      if (problem) return void notify(problem, 'error') ?? false;
      return withUndo(() => change(() => state), message);
    },
    setSdsUi: patch => ui.set(u => ({ sdsUi: { ...u.sdsUi, ...patch } })),

    // ---- REARRANGE (panels/rearrange.js, tree.js): its selection and pick mode; moves are canMove / moveTo ----
    /** Name an empty slot: a new star-dot there (any kite, open or locked). */
    nameSlot: (kite, slot, name) => { if (name.trim()) change(s => E.placeDot(s, kite, slot, name.trim())[0]); },
    /**
     * Add a child from the tree: `at` is { kite, slot } on the star-dot's star, or { k, slot }
     * of the star it would plan (planned now). The child's slot row is `level` (its kite's is
     * level − 1): the kite holding the next free slot opens there. `onNext("kite:slot")` hears of
     * that slot before the tree redraws, so the cursor can land in it.
     */
    treeAddChild(dotId, at, name, level, onNext = () => {}) {
      if (!name.trim()) return null;
      let after = null;
      change(s => {
        let next = s;
        let target = at;
        if (at.k != null) {
          let starId;
          [next, starId] = E.planStar(s, dotId);
          target = { kite: next.stars[starId].kites[at.k], slot: at.slot };
        }
        const r = E.addChild(next, dotId, name.trim(), { target, options: options(file()) });
        if (r.problem) { notify(r.problem, 'error'); return s; }
        const slots = E.childSlots(r.state, r.state.dots[dotId].branch, options(file()));
        const i = slots.findIndex(x => x.kite === target.kite && x.slot === target.slot);
        after = [...slots.slice(i + 1), ...slots.slice(0, i)].find(x => !r.state.kites[x.kite].dots[x.slot]) ?? null;
        return r.state;
      });
      if (!after) return;
      onNext(`${after.kite}:${after.slot}`);
      ui.set(u => ({ tPath: [...(u.tPath ?? []).slice(0, level - 1), after.kite] }));
    },
    rSelect: rSel => ui.set({ rSel, rMode: null }),
    /** Open boxes in REARRANGE's tree from `level` down (closing the rest of the old path below it). */
    openTree: (level, ...ids) => ui.set(u => ({ tPath: [...(u.tPath ?? []).slice(0, level), ...ids.filter(Boolean)] })),
    setRMode: rMode => ui.set({ rMode }),
    /** Escape on REARRANGE: cancel a pick mode, else clear the selection. */
    rCancel: () => ui.set(u => (u.rMode ? { rMode: null } : { rSel: null })),
    /** A click on REARRANGE: finish a pick mode, else select (a star-dot is selected, not opened). */
    rHit(target) {
      const from = rFrom();
      if (!from) return ui.set({ rSel: target });
      ui.set({ rMode: null });
      if (target && canDrop(from, target)) drop(from, target);
    },
    /** Pick up a tree box's target (a star-dot, kite or shelf entry) to move it: selected, in pick mode. */
    rPick(target) {
      const at = target.kind === 'dot' && E.index(file().save.state).dot.get(target.id);
      const rMode = at ? { kind: 'swapDot', from: { ...at } } : target.kind === 'kite' ? { kind: 'swapKite', kite: target.id }
        : target.kind === 'shelfEntry' ? { kind: 'place', entry: target.entry } : null;
      if (rMode) ui.set({ rSel: target, rMode });
    },
    /** Whether the picked-up thing can go to `target` (a refused one is dimmed). */
    rCan: target => canDrop(rFrom(), target),
    /** Rename a kite (a central kite's name is its category's). */
    renameKite(k, name) {
      const st = file().save.state;
      const color = st.kites[k].color;
      if (E.index(st).kite.get(k)?.star === E.centralStar(st).id && color != null) actions.renameCategory(color, name);
      else change(s => E.updateKite(s, k, { name }));
    },

    // ---- Categories (the content set; the central kite's name follows) ----
    renameCategory: (ci, name) => {
      store.set(f => ({ content: { ...f.content, categories: f.content.categories.map((c, i) => (i === ci ? { ...c, name } : c)) } }));
      change(s => {
        const k = E.centralStar(s).kites.find(id => s.kites[id].color === ci);
        return k ? E.updateKite(s, k, { name }) : s;
      });
    },
    /** Color the categories with palette `name` (the content set's colors; "current" keeps them). */
    setPalette: (name) => store.set(f => (f.palettes[name] ? {
      content: { ...f.content, categories: f.content.categories.map((c, i) => ({ ...c, color: f.palettes[name][i] })) },
    } : null)),
    /** Keep `colors` as one of this browser's palettes, `name` (replacing one of the user's own of that name), and use it. */
    savePalette(name, colors) {
      const problem = paletteNameProblem(name);
      if (problem) return notify(problem, 'error'), false;
      const n = name.trim();
      store.set(f => ({ palettes: { ...f.palettes, [n]: colors.slice(0, E.KITES).map(c => c.toLowerCase()) } }));
      actions.setPalette(n);
      notify(`Saved palette "${n}"`);
      return true;
    },
    /** Forget one of the user's own palettes (the colors in use stay). */
    removePalette(name) {
      if (builtInPalette(name)) return;
      store.set(f => ({ palettes: Object.fromEntries(Object.entries(f.palettes).filter(([n]) => n !== name)) }));
      notify(`Removed palette "${name}"`);
    },

    // ---- Rule options (GOVERN › Rules; the content set) ----
    /** Retrain period (days, or null for never) of a Retrain choice. */
    setPeriod: (choiceId, days) => store.set(f => ({
      content: { ...f.content, properties: f.content.properties.map(p => (p.id !== 'persistence' ? p
        : { ...p, choices: p.choices.map(c => (c.id === choiceId ? { ...c, days } : c)) })) },
    })),

    // ---- PLAY: the map (shared/ui/map.js) and its info card ----
    // Map targets: { kind: 'dot', id } | { kind: 'slot', kite, slot } | { kind: 'kite', id } | { kind: 'pos', coord } | { kind: 'central' };
    // on REARRANGE, drags may also come from the shelf ({ kind: 'shelf', entry }) or end on it ({ kind: 'shelf' }).
    playSelect: playSel => ui.set({ playSel, playMode: null }),
    setPlayMode: playMode => ui.set({ playMode }),
    setLayer: layer => (layer === 'constellation' && ui.get().layer !== 'constellation' ? showConstellation() : ui.set({ layer, layerShow: null })),
    /** The Retired bank's opened dot, or null. */
    setRetiredPick: id => ui.set({ retiredPick: id }),
    /** Escape on PLAY: cancel a pick mode, else clear the selection. */
    playCancel: () => ui.set(u => (u.playMode ? { playMode: null } : { playSel: null })),
    /**
     * A click on the map: finish a pick mode, or select. A star-dot is selected by a tap (its card,
     * U4, and the pills beside it, round 8, X7); a pill opens it, or deploys or withdraws its star.
     */
    playHit(target) {
      const { playMode: mode, playSel } = ui.get();
      // With questions on, Play mode's map is the player's quiz: a star-dot opens its question; nothing
      // else is selected. Edit mode keeps the editing map (select a kite, then its star-dots).
      // A kite is selected when the player has a tool for it (its pills: ↻, ⟳, Swap kite…, 🖌); pills act as anywhere.
      if (options(file()).questions === 'on' && !editing() && !mode && target?.kind !== 'pill') {
        if (target?.kind === 'prize') return void actions.claimBonus(target.i);
        if (target?.kind === 'dot') actions.openQuestion(target.id);
        else if (target?.kind === 'kite' && actions.kiteTools()) ui.set({ playSel: target });
        else if (playSel) ui.set({ playSel: null });
        return;
      }
      if (mode) {
        ui.set({ playMode: null });
        const from = mode.kind === 'swapKite' ? { kind: 'kite', id: mode.kite } : slotTarget(mode.from);
        if (target && playCanMove(from, target)) playMoveTo(from, target);
        else playRefused(from, target);
        return;
      }
      if (target?.kind === 'prize') return void actions.claimBonus(target.i);
      if (target?.kind === 'pill') {
        if (target.action === 'open') return actions.openScreen(target.id);
        if (target.action === 'answer') return actions.openQuestion(target.id);   // A □ with questions, questions off
        if (target.action === 'deploy') return void actions.playDeploy(target.id);
        if (target.action === 'withdraw') return void actions.playWithdraw(target.id);
        // A selected kite's pills.
        if (target.action === 'rotate') return void actions.playRotate(target.id);
        if (target.action === 'rotateKites') return void actions.playRotateKites(target.id);
        if (target.action === 'spin') return void actions.spinStar(target.id);
        if (target.action === 'swapKite') return void ui.set({ playMode: { kind: 'swapKite', kite: target.id } });
        if (target.action === 'design') { const k = file().save.state.kites[target.id]; return void (k && actions.openDesigner(target.id, k.design || k.color == null ? 'kite' : 'category')); }
        return;
      }
      if (target?.kind === 'dot' && playSel?.kind === 'dot' && playSel.id === target.id) return;   // X7: tapping it again keeps it selected
      if (target?.kind === 'central') return actions.openScreen(CENTRAL);   // the central star's screen
      ui.set({ playSel: target });
    },
    /** Light or dark, the other way from the one in effect (a browser setting; until chosen, the system's). */
    toggleTheme: () => store.set(f => ({ theme: themeOf(f) === 'dark' ? 'light' : 'dark' })),

    // ---- SCHEDULE's calendar ----
    /** The calendar's view state (ui.sch): { start (a day), pick (a star-dot being planned), day, hours, showDone }. Never saved. */
    setSch: patch => ui.set(u => ({ sch: { ...(u.sch ?? {}), ...patch } })),
    /** The Deck view's view state (ui.deck): { cat (a category's index), card (the item in view), back (flipped) }. Never saved. */
    setDeck: patch => ui.set(u => ({ deck: { ...(u.deck ?? {}), ...patch } })),
    /** Plan `hours` 1-hour blocks of a star-dot on `day`, spread over its free time with the save's gap. Undoable. */
    placeTime(dot, day, hours) {
      const f = file();
      const r = E.placeBlocks(f.save.state, dot, day, hours, f.save.gap ?? E.DEFAULT_GAP, E.dayRange(f.content.rules));
      if (r.problem) return void notify(r.problem, 'error') ?? false;
      const when = new Date(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      return withUndo(() => change(() => r.state), `Planned ${hours} hour${hours === 1 ? '' : 's'} of ${f.save.state.dots[dot].name || 'a star-dot'} on ${when}`);
    },
    /** Plan one 1-hour block of a star-dot at `minute` after midnight of `day` (Plan time…, then a click on the calendar). Undoable. */
    placeAt(dot, day, minute) {
      const f = file();
      const r = E.placeBlockAt(f.save.state, dot, day, minute, E.dayRange(f.content.rules));
      if (r.problem) return void notify(r.problem, 'error') ?? false;
      const at = new Date(r.state.blocks.find(b => b.id === r.blocks[0]).start);
      const when = at.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      return withUndo(() => change(() => r.state), `Planned an hour of ${f.save.state.dots[dot].name || 'a star-dot'} on ${when}`);
    },
    /** Move a block within its day, to `minute` after midnight (snapped; an overlap is refused with a reason). Undoable. */
    moveBlock: (id, minute) => actions.act(s => E.moveBlock(s, id, minute, E.dayRange(file().content.rules)), 'Moved a block'),
    removeBlock: id => withUndo(() => change(s => E.removeBlock(s, id)), 'Removed a block'),
    /** The least time between hour blocks when placing them (the save's; 15, 30 or 60 minutes). Undoable. */
    setGap: gap => withUndo(() => setSave({ gap }), `New blocks keep at least ${gap} minutes apart`),

    // ---- Kite designs ----
    /** PLAY's unselected kites: 'solid' or 'designs' (a browser setting). */
    setKiteLook: kiteLook => store.set({ kiteLook }),
    /** Open the designer over PLAY for a kite: its own design ('kite') or its category's ('category'). */
    openDesigner: (kite, target = 'category') => ui.set({ design: { kite, target } }),
    setDesignTarget: target => ui.set(u => (u.design ? { design: { ...u.design, target } } : null)),
    closeDesigner: () => ui.set({ design: null }),
    /** The designer's tools (mode, brush, symmetry, guides): kept for the session, not saved. */
    setDesignerSettings: designer => ui.set({ designer }),
    /** A category's design, in this save; null clears it. Undoable. */
    setCategoryDesign(ci, design) {
      const name = file().content.categories[ci]?.name || 'the category';
      // The player's design is theirs for this session only (over the designer's; a new session clears it).
      if (!editing()) return void withUndo(() => change(s => {
        const designs = Array.from({ length: E.KITES }, (_, i) => (i === ci ? design : s.look?.designs?.[i] ?? null));
        return { ...s, look: { ...s.look, designs } };
      }), `Changed ${name}’s kite design`);
      withUndo(() => setSave(s => ({ designs: s.designs.map((d, i) => (i === ci ? design : d)) })), `Changed ${name}’s kite design`);
    },
    /** A kite's own design (the save's), or null to show its category's again. Undoable. */
    setKiteDesign(k, design) {
      withUndo(() => change(s => E.setKiteDesign(s, k, design)), design ? 'Changed this kite’s own design' : 'This kite shows its category’s design again');
    },
    /**
     * The Kite Designer's Export file (or one design) into this save: a set's designs go to
     * the categories of the same name (else by position); a single design to `ci`. Returns how many.
     */
    importDesigns(data, ci) {
      const cats = file().content.categories;
      const list = Array.isArray(data?.designs) ? data.designs : [{ design: data }];
      const next = [...file().save.designs];
      let n = 0;
      list.forEach((entry, i) => {
        const d = normalizeDesign(entry?.design);
        if (!d) return;
        const byName = cats.findIndex(c => c.name === entry.category);
        const at = Array.isArray(data?.designs) ? (byName >= 0 ? byName : i) : ci;
        if (at >= 0 && at < next.length) { next[at] = d; n++; }
      });
      if (!n) return void notify('No kite designs for this grid in that file.', 'error') ?? 0;
      withUndo(() => setSave({ designs: next }), `Imported ${n} kite design${n === 1 ? '' : 's'}`);
      return n;
    },
    /** Deploy a star-dot's star from PLAY: its planned star, or a new one. Undoable. */
    playDeploy: d => actions.act((s, o) => E.deployStar(s, d, o), E.independentOn(options(file())) ? null : `Deployed ${file().save.state.dots[d]?.name || 'the star-dot'}’s star`),
    /** Take a star-dot's star off the map: it stays planned, with its branch. Undoable. */
    playWithdraw: d => actions.act((s, o) => E.withdrawStar(s, d, o), E.independentOn(options(file())) ? null : `Withdrew ${file().save.state.dots[d]?.name || 'the star-dot'}’s star`),
    /** Bring a star-dot to its kite's Zenith, allowed under either board rule. Undoable. */
    /**
     * Delete a star-dot for good with its whole branch, after a confirmation naming
     * what goes with it; undoable. Its screen (or one on its branch) closes.
     */
    deleteStarDot(d) {
      const st = file().save.state;
      if (!st.dots[d]) return false;
      const { dots, stars } = E.branchOf(st, d);
      const name = st.dots[d].name || 'this star-dot';
      const more = dots.length - 1;
      const what = more ? `, its star${stars.length > 1 ? 's' : ''} and the ${more} star-dot${more === 1 ? '' : 's'} on ${stars.length > 1 ? 'them' : 'it'}` : '';
      if (!globalThis.confirm?.(`Delete ${name}${what}? Undo brings it back.`)) return false;
      const gone = new Set(dots);
      const done = withUndo(() => change(s => E.deleteDot(s, d)), `Deleted ${name}${more ? ` and ${more} more` : ''}`);
      const sds = ui.get().sds;
      if (done && sds && (gone.has(sds.dot) || sds.trail.some(x => gone.has(x)))) ui.set({ sds: null, sdsUi: {} });
      if (done && ui.get().rSel && gone.has(ui.get().rSel.id)) ui.set({ rSel: null });
      if (done && ui.get().playSel && gone.has(ui.get().playSel.id)) ui.set({ playSel: null });
      return done;
    },
    /** The content set's lock rule: 'off' (every kite open) or 'on'. Undoable. */
    /** How kites shade with progress: 'darken' · 'brighten' · 'none', for every save on the content set. Undoable. */
    setFade: fade => withUndo(() => store.set(f => ({ content: { ...f.content, rules: { ...f.content.rules, fade } } })), { darken: 'Kites now darken as they complete', brighten: 'Kites now brighten as they complete', none: 'Kites now keep their full color' }[fade]),
    /** this content set's word for a star-dot (and its plural). Undoable. */
    setTerms: terms => withUndo(() => store.set(f => ({ content: { ...f.content, terms: E.cleanTerms(terms) } })), `A star-dot is now called “${E.cleanTerms(terms).stardot}”`),
    setLocks: locks => withUndo(() => store.set(f => ({ content: { ...f.content, rules: { ...f.content.rules, locks } } })), locks === 'off' ? 'Kites no longer lock' : 'Kites lock until opened'),
    /** Retire a star-dot from PLAY: out of its slot, with its star and children, into the Retired bank. Undoable. */
    retire(d) {
      const name = file().save.state.dots[d]?.name || 'the star-dot';
      if (withUndo(() => change(s => E.retireDot(s, d, Date.now())), `Retired ${name}`)) ui.set({ playSel: null });
    },
    /** Bring a retired star-dot back: its old slot, else its old parent's next free slot, else the shelf. Undoable. */
    restore(d) {
      const { state, problem, where } = E.restoreDot(file().save.state, d, options(file()));
      if (problem) return void notify(problem, 'error');
      const name = state.dots[d].name || 'The star-dot';
      const to = { slot: 'is back in its old slot', parent: 'is back under its old parent (its old slot was taken)', shelf: 'is on MATERIALS’ shelf (its old place is gone)' }[where];
      withUndo(() => change(() => state), `${name} ${to}`);
    },
    /** PLAY's moves, under the save's board rule (see boardTry). */
    playCanMove,
    playMoveTo,
    playRefused,
    /** What can move on the Star view now: { swap, rotateDots, rotateKites } (engine movesOf). */
    moves: boardRule,
    /** Whether the person may use `key` (Design › Player) where they are: always in Edit mode. */
    allow: key => E.allows(player(), editing())(key),
    /** Claim the bonus ladder's next rung (its prize on the Star view): that tool unlocks. */
    claimBonus: i => {
      const s = E.bonusStatus(file().content, file().save.state);
      const which = Number.isInteger(i) ? i : s?.ready[0];
      if (!s?.ready.includes(which)) return;
      const key = s.rungs[which];
      const label = E.prizeLabel(key);
      const comet = key === 'comet';
      change(st => (comet ? E.winComet(file().content, E.claimBonus(file().content, st, which)) : E.claimBonus(file().content, st, which)));   // 9d: a comet claimed cycles your next ladder message all session
      notify(comet ? 'A comet! It circles the sky for the rest of this session.' : key === 'comet:write' ? 'Unlocked: write a comet (🌠 by the map): your note circles the sky for the rest of this session' : key === 'spin' ? 'A spin! ⟲ Spin is beside each star.' : `Unlocked: ${label}`, 'info');
    },
    /** 9d: the message to cross once next (Play mode), or null. */
    nextComet: () => (editing() ? null : E.nextComet(file().content, file().save.state)),
    /** 9d: the prize comets cycling this session (Play mode). */
    activeComets: () => (editing() ? [] : E.activeComets(file().save.state)),
    /** 9d: a message has crossed the map: done for this session. */
    cometFlown: id => change(st => E.cometFlown(st, id)),
    /** 9d: notes the player may still write this session (Write a comet claimed). */
    notesLeft: () => (editing() ? 0 : E.notesLeft(E.writesClaimed(file().content, file().save.state), file().save.state)),
    /** 9d: the player writes a note: it sets off at once, circling the sky for the rest of the session. */
    writeComet(text) {
      if (!String(text ?? '').trim() || actions.notesLeft() < 1) return false;
      change(st => E.writeNote(st, text, Date.now().toString(36)));
      return true;
    },
    /** 9d: now and then (in Play mode), one of the designer's "now and then" messages joins the queue. */
    randomComet: () => { if (!editing()) change(st => E.queueComet(file().content, st, 'random')); },
    /** The player's palette (9b): a built-in name, 'own', or null for the designer's colors; their board only, this session. */
    setPlayerPalette: name => change(st => {
      const { palette: _p, ...look } = st.look ?? {};
      return { ...st, look: name ? { ...look, palette: name } : look };   // (their designs stay)
    }),
    /** The player's own palette (Your own palette): kept with the save, then in use. */
    savePlayerPalette(name, colors) {
      const n = String(name ?? '').trim().slice(0, 40);
      if (!n) return notify('Give the palette a name.', 'error'), false;
      store.set(f => ({ save: { ...f.save, playerPalette: { name: n, colors: colors.slice(0, E.KITES).map(c => c.toLowerCase()) } } }));
      actions.setPlayerPalette('own');
      return true;
    },
    /** Whether the player has a tool for a selected kite (Quiz mode selects kites only then). */
    kiteTools: () => {
      const m = boardRule();
      return actions.allow('kiteDesign') || (!E.independentOn(options(file())) && (m.rotateDots || m.rotateKites || m.swap));
    },
    /** 9c: spins the player has to use (Play mode). */
    spinsLeft: () => (editing() ? 0 : E.spinsLeft(file().content, file().save.state)),
    /**
     * 9c: spin the star of `kite`: it turns like a pinwheel and the kite that stops at the top
     * decides (a hint, the next prize early, a spin again, or nothing), said once it has stopped.
     */
    spinStar(star) {
      // (A kite's id is taken too: its star.)
      if (!file().save.state.stars[star]) star = E.index(file().save.state).kite.get(star)?.star;
      if (!star || ui.get().spin || actions.spinsLeft() < 1) return;   // one spin at a time
      const i = Math.floor(Math.random() * 6);
      const t0 = Date.now();
      ui.set({ spin: { star, kite: file().save.state.stars[star].kites[i], t0 }, playSel: null });
      // What it lands on happens once it has stopped (a prize won appears then, not as it starts).
      const land = () => {
        const { state, outcome } = E.spinStar(file().content, file().save.state, i);
        if (outcome) change(() => state);
        notify({ hint: '💡 A hint: your next question has one wrong choice crossed out.', prize: '🎁 The next prize is ready to claim.', again: '⟲ Spin again!', nothing: 'No luck this time.' }[outcome] ?? 'No spin left.', 'info');
        setTimeout(() => { if (ui.get().spin?.t0 === t0) ui.set({ spin: null }); }, 1200 + 1000 + 200);   // after it has turned back (map.js)
      };
      setTimeout(land, globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0 : SPIN_MS);
    },
    /**
     * Update content set (P10): this save's items and questions, in their order and places, become its
     * content set's library (progress cleared), with its category names and item fields. The rest of
     * the design stays in this save; other saves on the content set keep their own copies.
     */
    async updateContentSet() {
      const f = file();
      if (!globalThis.confirm?.(`Replace the items and questions of the content set “${f.content.title}” with this save’s (their order too)? Other saves on it keep their own.`)) return false;
      try {
        const lib = E.normalizeContent(await storage.contentSets.load(f.content.id));
        const starter = E.freshBoard(f.save.state);
        const next = {
          ...lib, starter,
          categories: lib.categories.map((c, i) => ({ ...c, name: f.content.categories[i].name })),   // the names; the colors stay each save's
          properties: f.content.properties, marks: f.content.marks,
        };
        await storage.contentSets.save(lib.id, next);
        store.set(x => ({ content: { ...x.content, starter } }));   // new saves from here start from it
        notify(`Updated the content set “${lib.title}” from this save: ${Object.keys(starter.dots).length} items and their questions, in this save’s order.`);
        return true;
      } catch (e) {
        notify('Couldn’t update the content set: ' + e.message, 'error');
        return false;
      }
    },
    /** What the player's kite designer offers (null: everything). */
    designerAllows: () => E.designerAllows(file().content, file().save.state, editing()),

    // ---- Play mode's test run ----
    // In Edit mode, Play mode is a test run as a first-time player: a fresh session on a copy, so
    // nothing done there touches the designed board. Restart the test starts it over; going back
    // to Edit mode ends it (the board, and Edit mode's undo history, are as they were). A save with
    // an assessor PIN isn't tested: its Play mode is the player's own, kept as before.
    testing: () => !!test,
    startTest() {
      if (test || file().save.pin || PLAY || globalThis.starLatticeRealPlay) return;   // A play version plays for real   // (realPlay: the play version, P7, and the older click-throughs)
      persist();
      test = { home: file(), history: history.stash() };
      fresh();
    },
    restartTest() {
      if (!test) return;
      fresh();
      notify('Started the test over');
    },
    endTest() {
      if (!test) return;
      const { home, history: h } = test;
      test = null;
      const f = file();
      store.replace({ ...home, kiteLook: f.kiteLook, theme: f.theme, palettes: f.palettes });   // This browser's settings stay as chosen
      history.unstash(h);
    },

    // ---- the assessor PIN, the quiz settings, sessions ----
    /** Whether PLAY is locked: this save has a PIN and it hasn't been entered since PLAY opened. */
    locked: () => !!file().save.pin && !ui.get().unlocked,
    /** Whether `pin` is this save's PIN (true when it has none). */
    pinMatches: pin => !file().save.pin || E.pinHash(String(pin)) === file().save.pin,
    /** Set (a string of 4–12 digits or letters) or clear (null) this save's PIN. Undoable. */
    setPin: pin => withUndo(() => setSave({ pin: pin ? E.pinHash(pin) : null }), pin ? 'Set the assessor PIN: PLAY now locks' : 'Cleared the assessor PIN'),
    /** Ask for the PIN before `then` (a function) runs: { purpose, then } shows the PIN dialog. */
    askPin: (purpose, then) => (actions.locked() || (purpose !== 'edit' && file().save.pin) ? ui.set({ pinAsk: { purpose, then, error: '' } }) : then()),
    /** The PIN dialog's answer: runs its action if the PIN matches, else says so. */
    answerPin(pin) {
      const ask = ui.get().pinAsk;
      if (!ask) return;
      if (!actions.pinMatches(pin)) return ui.set({ pinAsk: { ...ask, error: 'That isn’t the PIN.' } });
      ui.set({ pinAsk: null, unlocked: true });
      ask.then();
    },
    cancelPin: () => ui.set({ pinAsk: null }),
    /** Lock PLAY again (on entering it). */
    relock: () => { if (ui.get().unlocked) ui.set({ unlocked: false }); },
    /** One of the content set's quiz settings: rules[key] = value, for every save on it. Undoable. */
    /** Design › Player: what the player may do (the content set's `player`). */
    setPlayer: (key, value) => withUndo(() => store.set(f => ({ content: { ...f.content, player: { ...f.content.player, [key]: value } } })),
      `Player: ${E.PLAYER_KEY[key]?.label ?? key} ${value === true ? 'on' : value === false ? 'off' : E.PLAYER_KEY[key]?.names?.[value] ?? value}`),
    /** Design › Player: the welcome line the player's tutorial opens with (the content set's). Undoable. */
    setWelcome: line => {
      const welcome = String(line ?? '').trim().slice(0, 200);
      if (welcome !== (file().content.welcome ?? '')) withUndo(() => store.set(f => ({ content: { ...f.content, welcome } })), welcome ? 'Set the welcome line' : 'Removed the welcome line');
    },
    /** The star-dot screen's layout for the whole content set (a star-dot's own goes through change). Undoable. */
    setSharedLayout: (layout, message = 'Rearranged the star-dot screen') => withUndo(() => store.set(f => ({ content: { ...f.content, layout: E.cleanLayout(layout) } })), message),
    /** Several rules at once, one undo step. */
    setRules: (patch, message) => withUndo(() => store.set(f => ({ content: { ...f.content, rules: { ...f.content.rules, ...patch } } })), message),
    setRule: (key, value, message) => withUndo(() => store.set(f => ({ content: { ...f.content, rules: { ...f.content.rules, [key]: value } } })), message),
    /**
     * A rule that rearranges the field mid-session (Shuffle the questions): asks for the PIN
     * (if any) and to confirm, then sets it and starts a new session, as one undoable step.
     */
    setRuleNewSession(key, value, message) {
      actions.askPin('session', () => {
        if (!globalThis.confirm?.(`${message}? This starts a new session: every star but the central one leaves the map, and every answer, wait, goal and completed category is cleared. The questions stay. Undo brings it back.`)) return void ui.set({});
        withUndo(() => store.set(f => ({ content: { ...f.content, rules: { ...f.content.rules, [key]: value } }, save: { ...f.save, state: E.startSession(f.save.state) } })), `${message}: started a new session`);
      });
    },
    /** Start a new session: asks for the PIN (if any) and to confirm; clears the progress, keeps the questions. Undoable. */
    startSession() {
      actions.askPin('session', () => {
        if (!globalThis.confirm?.('Start a new session? Every star but the central one leaves the map, and every answer, wait, goal and completed category is cleared. The questions stay. Undo brings it back.')) return;
        if (!withUndo(() => change(s => E.startSession(s)), 'Started a new session')) notify('Started a new session: there was nothing to clear.');
      });
    },
    // ---- the lists ----
    /** Add an item named `name` at the end of a category's list (its central kite). Undoable. */
    addItem(kite, name) {
      if (!name.trim()) return null;
      let id = null;
      withUndo(() => change(s => { const r = E.addItem(s, kite, name.trim()); id = r[1]; return r[0]; }), `Added ${name.trim()}`);
      return id;
    },
    /** Move a category's item from one place in its list to another. Undoable. */
    moveItem: (kite, from, to) => withUndo(() => change(s => E.moveItem(s, kite, from, to)), 'Moved an item'),

    // ---- questions ----
    /** PLAY's question popout for a star-dot (ui.quiz { dot, picked, correct }). */
    openQuestion(dot) {
      // 9c: a hint won by a spin crosses out one wrong choice of the first open choice question here.
      let hint = null;
      const st = file().save.state;
      if (!editing() && st.bonus?.hint && st.dots[dot]?.assessment && resolve(file()).ev.effective(dot).status !== 'ignited') {
        const q = E.questionsOf(st.dots[dot].assessment).find(x => x.kind === 'choice' && x.options.length > 2 && x.options.filter(o => !o.correct).length > 1);
        if (q) {
          const wrong = q.options.map((o, i) => (o.correct ? -1 : i)).filter(i => i >= 0);
          hint = { q: q.id, choice: wrong[Math.floor(Math.random() * wrong.length)] };
          change(E.useHint);
        }
      }
      ui.set({ quiz: { dot, cur: hint?.q ?? null, last: null, hint }, playSel: null });
    },
    /** the popout's own state (the question shown, the last answer's result). */
    setQuiz: patch => { const q = ui.get().quiz; if (q) ui.set({ quiz: { ...q, ...patch } }); },
    /**
     * Answer one question of a star-dot's set (the popout or its screen): saved;
     * the last right answer ignites it (and, with Deploy: Automatically, a Zenith deploys). Returns
     * answerItem's result ({ correct, problem, result, complete }).
     */
    answerItem(dot, qid, response) {
      const r = E.answerItem(file().save.state, dot, qid, response, { ...options(file()), now: Date.now() });
      if (r.problem) return r;
      const next = editing() ? r.state : E.recordAnswer(file().content, r.state, r.correct);   // 9e: the streak
      if (next !== file().save.state) change(() => next);
      return r;
    },
    /** Close the popout: a choice made in it is final until then. */
    closeQuestion: () => ui.set({ quiz: null }),
    /**
     * Answer the open popout's question with choice `i` (once per popout): a correct answer ignites
     * the star-dot (and, with Deploy: Automatically, a Zenith deploys), a wrong one may start a wait.
     */
    answer(i) {
      const q = ui.get().quiz;
      if (!q || q.picked != null) return;
      const r = E.answerQuestion(file().save.state, q.dot, i, { ...options(file()), now: Date.now() });
      if (r.problem) return void notify(r.problem, 'error');
      const next = editing() ? r.state : E.recordAnswer(file().content, r.state, r.correct);   // 9e: the streak
      if (next !== file().save.state) change(() => next);
      ui.set({ quiz: { ...q, picked: i, correct: r.correct } });
    },
    /** The assessor: set a star-dot's assessment (null clears it). Undoable. */
    setAssessment: (dot, assessment, message = 'Edited the question') => withUndo(() => change(s => E.setAssessment(s, dot, assessment)), message),
    // ---- Import questions… and Export questions… (MATERIALS) ----
    openImport: () => ui.set({ qImport: { text: '', name: '', picks: {}, mode: 'replace' } }),
    closeImport: () => ui.set({ qImport: null }),
    setImport: patch => { const q = ui.get().qImport; if (q) ui.set({ qImport: { ...q, ...patch } }); },
    /** Import a parsed file's sets by their plan (planImport): one undoable step. */
    importQuestions(sets, plan, mode = 'replace') {
      const f = file();
      let problem = null, dots = [];
      const ok = plan.filter(r => !r.problem);
      const count = ok.reduce((n, r) => n + r.count, 0);
      withUndo(() => change(s => { const r = E.applyImport(s, plan, sets, { mode, options: options(f) }); problem = r.problem; dots = r.dots; return r.state; }),
        `Imported ${ok.length} question ${ok.length === 1 ? 'set' : 'sets'} (${count} ${count === 1 ? 'question' : 'questions'})`);
      if (problem) return void notify(problem, 'error');
      ui.set({ qImport: null });
      notify(`Imported ${ok.length} ${ok.length === 1 ? 'set' : 'sets'}, ${count} ${count === 1 ? 'question' : 'questions'}, into ${dots.length} ${dots.length === 1 ? 'star-dot' : 'star-dots'}.`, 'info', { label: 'Undo', onClick: () => actions.undo() });
    },
    /** Every set in the save as one question file (Export questions…). */
    exportQuestions: () => { const f = file(); const r = resolve(f); return E.exportQuestions(f.save.state, r.ev, r.content.categories); },
    /** Redraw (a countdown ran out). */
    refresh: () => ui.set({}),
    /** The percent of a deployed star's star-dots that ignite its source (this save's, S3). */
    share: () => file().save.share ?? E.DEFAULT_SHARE,
    setShare: share => withUndo(() => setSave({ share }), `A deployed star now ignites its star-dot at ${share}%`),
    /** Whether dragging `from` onto `to` does anything (REARRANGE's map: any move, conflicts open the card). */
    canMove: (from, to) => canDrop(from, to),
    /** Drop `from` on `to` (see drop): undoable; a clash opens the conflict card. */
    moveTo: (from, to) => drop(from, to),
    /** The conflict card: shelve (the move happens, the clashing branch goes to the shelf), or cancel. */
    shelveConflict: () => { const c = ui.get().conflict; ui.set({ conflict: null }); c?.shelve(); },
    cancelConflict: () => ui.set({ conflict: null }),
    shelveStar: starId => withUndo(() => change(s => E.shelveStar(s, starId)), 'Put the star on the shelf (with its branch)'),


    // ---- Saves (the bar in the tab row) and undo ----
    session: () => ({ ...session, current: file().name, contentId: file().content.id, canUndo: history.canUndo(), canRedo: history.canRedo() }),
    refreshSaves,
    open,
    /** Copy the open save as `rawName` (same content set, so the same rules) and switch to the copy. */
    async duplicate(rawName) {
      const name = storage.cleanName(rawName);
      if (!name) return void notify('Give the copy a name (letters, numbers, spaces; no \\ / : * ? " < > |).', 'error') ?? false;
      if (session.saves.some(s => s.name === name)) return void notify(`There's already a save named "${name}".`, 'error') ?? false;
      try {
        await storage.saves.save(name, storage.withDesign(file()));   // a separate save: its own copy of the design
        return open(name, `Duplicated as "${name}" (now open)`);
      } catch (e) {
        notify('Couldn’t duplicate: ' + e.message, 'error');
        return false;
      }
    },
    /**
     * Start an empty map as save `rawName`: only the central star. With `newContent`
     * ({ title, categories: [{ name, color }] × 6 }), also a new content set, a copy of the open
     * one's attributes and rules with its own name and categories; else the open content set.
     */
    async newMap(rawName, newContent = null) {
      const name = storage.cleanName(rawName);
      if (!name) return void notify('Give the map a name (letters, numbers, spaces; no \\ / : * ? " < > |).', 'error') ?? false;
      if (session.saves.some(s => s.name === name)) return void notify(`There's already a save named "${name}".`, 'error') ?? false;
      let content = file().content;
      try {
        if (newContent) {
          const title = newContent.title.trim();
          if (!title) return void notify('Give the content set a name.', 'error') ?? false;
          if (newContent.categories.some(c => !c.name.trim())) return void notify('Name all six categories.', 'error') ?? false;
          const id = E.slug(title);
          if ((await storage.contentSets.list()).some(c => c.name === id)) return void notify(`There's already a content set named "${id}".`, 'error') ?? false;
          content = E.normalizeContent({ ...content, id, title, categories: newContent.categories.map(c => ({ name: c.name.trim(), color: c.color })) });
          await storage.contentSets.save(id, content);
        }
        await storage.saves.save(name, E.newSave(content, name));
        return open(name, `Started the empty map "${name}"${newContent ? ` on the new content set “${content.title}”` : ''} (now open)`);
      } catch (e) {
        notify('Couldn’t start the map: ' + e.message, 'error');
        return false;
      }
    },
    // ---- New from a blueprint… (a showcase pack) ----
    /**
     * Start a board from a pack: its content set is added (kept beside one here with its id that
     * differs, under a new id), and its starter board saved under a free name; then it opens.
     */
    async newFromPack(id) {
      try {
        const { content: rawContent, board, pack } = await storage.loadPack(id);
        let content = E.normalizeContent(rawContent);
        let save = E.normalizeSave(board);
        if (!content.starter) content = { ...content, starter: E.freshBoard(save.state) };   // its board is its library (P10)
        const existing = await storage.contentSets.list();
        if (existing.some(c => c.name === content.id)) {
          const here = E.normalizeContent(await storage.contentSets.load(content.id));
          if (JSON.stringify(here) !== JSON.stringify(content)) {
            let cid = `${content.id}-2`;
            for (let n = 3; existing.some(c => c.name === cid); n++) cid = `${content.id}-${n}`;
            content = { ...content, id: cid };
            save = { ...save, content: cid };
            await storage.contentSets.save(cid, content);
          }
        } else await storage.contentSets.save(content.id, content);
        const names = (await storage.saves.list()).map(x => x.name);
        const base = storage.cleanName(pack.title) || 'From a blueprint';
        let name = base;
        for (let n = 2; names.includes(name); n++) name = `${base} (${n})`;
        await storage.saves.save(name, save);
        return open(name, `Started "${name}" from its blueprint (now open)`);
      } catch (e) {
        notify('Couldn’t start it: ' + e.message, 'error');
        return false;
      }
    },
    // ---- Make a repo… (tools/derive.py, through serve.py): a play version of one designed board ----
    /**
     * Write a play version beside this folder: { name (its folder), title, save (the board to ship) }.
     * The board goes with its content set (rules, layout, the player's permissions), its progress
     * cleared (freshBoard) and no PIN. Returns whether it was written.
     */
    async makeRepo({ name, title, save: saveName }) {
      try {
        const open = file().name === saveName;
        const save = E.normalizeSave(open ? file().save : await storage.saves.load(saveName));
        const content = open ? file().content : E.contentFor(await storage.contentSets.load(save.content), save);
        const { design: _d, ...plain } = save;   // its design goes as the play version's content (its library stays here)
        const board = { ...plain, pin: null, state: E.freshBoard(save.state) };
        const r = await fetch('../api/derive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, title, board: { save: board, content: (({ starter: _s, ...c }) => c)(content), from: saveName } }) });
        const out = await r.json().catch(() => ({ error: 'the server’s answer wasn’t readable' }));
        if (!r.ok) { notify('Not written: ' + (out.error ?? r.statusText), 'error'); return false; }
        session.derive = null;   // its earlier choices now include this one
        notify(`Wrote ${out.path}: ${out.files} files, ${Math.round(out.bytes / 1024)} KB, a play version of “${saveName}”. Its README says how to put it on GitHub.`, 'info');
        refreshSaves();
        return true;
      } catch (e) {
        notify('Not written: the server didn’t answer (is serve.py running?)', 'error');
        return false;
      }
    },
    // ---- Download… / Upload… (a save and its content set, as one file) ----
    /** The open save with its content set, as one .json file (a "bundle"). */
    download() {
      const f = file();
      const bundle = { format: 'star-lattice-bundle', version: 1, name: f.name, save: storage.withDesign(f), content: f.content };
      const ok = downloadJson(`${f.name}.star-lattice.json`, bundle);
      notify(ok ? `Downloaded "${f.name}" with its content set “${f.content.title}”.` : 'Couldn’t start the download in this browser.', ok ? 'info' : 'error');
    },
    /**
     * Upload a file made by Download… (a save and its content set), or a save file alone (its
     * content set must be here already). A content set that differs from the one here with its
     * id is kept beside it under a new id; the save gets a free name. Then it opens.
     */
    async upload(text, fileName = '') {
      let data;
      try { data = JSON.parse(text); } catch { return void notify('That file isn’t a Star Lattice save (not JSON).', 'error'); }
      try {
        const bundle = data?.format === 'star-lattice-bundle';
        let save = E.normalizeSave(bundle ? data.save : data);
        const existing = await storage.contentSets.list();
        if (bundle) {
          let content = E.normalizeContent(data.content);
          if (existing.some(c => c.name === content.id)) {
            const here = E.normalizeContent(await storage.contentSets.load(content.id));
            if (JSON.stringify(here) !== JSON.stringify(content)) {
              let id = `${content.id}-2`;
              for (let n = 3; existing.some(c => c.name === id); n++) id = `${content.id}-${n}`;
              content = { ...content, id };
              save = { ...save, content: id };
              await storage.contentSets.save(id, content);
            }
          } else await storage.contentSets.save(content.id, content);
        } else if (!existing.some(c => c.name === save.content)) {
          return void notify(`That save is on the content set “${save.content}”, which isn’t here: upload a file made with Download… instead (it carries its content set).`, 'error');
        }
        const base = storage.cleanName(bundle ? data.name : fileName.replace(/(\.star-lattice)?\.json$/i, '')) || 'Uploaded';
        const names = (await storage.saves.list()).map(s => s.name);
        let name = base;
        for (let n = 2; names.includes(name); n++) name = `${base} (${n})`;
        await storage.saves.save(name, save);
        return open(name, `Uploaded "${name}" (now open)`);
      } catch (e) {
        notify('Couldn’t upload it: ' + e.message, 'error');
        return false;
      }
    },
    /** Delete a save other than the open one. */
    async remove(name) {
      if (name === file().name) return void notify('Open another save before deleting this one.', 'error');
      if (!confirm(`Delete the save "${name}"? This can't be undone.`)) return;
      try {
        await storage.saves.remove(name);
        notify(`Deleted "${name}"`);
        await refreshSaves();
      } catch (e) {
        notify(e.message, 'error');
      }
    },
    // No undo or redo while PLAY is locked, not even from a message's Undo button.
    undo: () => { if (actions.locked()) return void notify('Undo is for editing: Edit asks for the PIN.'); if (!actions.allow('undo')) return; if (!history.undo()) notify('Nothing to undo.'); },
    redo: () => { if (actions.locked() || !actions.allow('undo')) return; if (!history.redo()) notify('Nothing to redo.'); },
    persist,
    pending,
    /** The save bar's indicator redraw, called when the save status changes. */
    onSaving: fn => { onSaving = fn; },
  };
  return actions;
}
