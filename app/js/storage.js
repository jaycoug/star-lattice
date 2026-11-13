// Saving and loading. Two places a save can live, picked as the app starts (init()):
//
// - **server** (serve.py running): two folders of JSON files beside the app.
// - saves/<name>.json: the saves (boards), listed in States ▾. One is open at a time; every
// change is written back to it (and to its content set) a moment after it's made.
// - content/<id>.json: the content sets (categories, attributes, rules). Saves on the same
// content set share its rules.
// - **browser**: the
// same two collections in this browser's IndexedDB. The first time, they're filled from the
// packs (packs/index.json, or the single file's own copy); after that, they're this browser's
// alone. States ▾ › Download… / Upload… carry a save (with its content set) between browsers.
//
// Settings that belong to this browser rather than to a save (the last save opened, the color
// palettes, Solid or Designs, light or dark) are kept in localStorage; losing them loses nothing
// that matters.

import { fileStore } from '../../shared/files.js';
import { PLAY } from './edition.js';
import { normalizeSave, freshBoard, designOf } from '../../shared/engine/index.js';

/** 'server' or 'browser' once init() has run. */
export let mode = null;
/** The two collections: { list, load, save, remove } each (see shared/files.js). */
export let saves = null;
export let contentSets = null;

const PREFS_KEY = 'star-lattice:prefs';
// Characters not allowed in names (Windows file-name rules, plus control characters).
const BAD_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/** A usable save name, or '' (trimmed, no forbidden characters, no leading "_" or ".", ≤ 80). */
export function cleanName(name) {
  return String(name ?? '').replace(BAD_CHARS, '').trim().replace(/^[_.]+/, '').replace(/\.+$/, '').slice(0, 80).trim();
}

/**
 * Whether serve.py's file API is there. serve.py marks every response (X-Star-Lattice); asking for
 * a file every host has (the manifest) keeps a static host from logging a 404 for a missing API.
 */
export async function available() {
  if (globalThis.location?.protocol === 'file:') return false;
  try {
    const r = await fetch('manifest.webmanifest', { method: 'HEAD', cache: 'no-store' });
    return r.ok && !!r.headers.get('x-star-lattice');
  } catch {
    return false;
  }
}

/**
 * Pick where saves live (serve.py when it answers, else this browser) and, in the browser the first
 * time, fill it from the packs. Returns the mode; throws when neither is usable.
 */
export async function init() {
  if (await available()) {
    saves = fileStore('../api/saves');
    contentSets = fileStore('../api/content');
    mode = 'server';
    await seed();   // A fresh copy (no content/ yet) starts with the packs
    return mode;
  }
  if (!globalThis.indexedDB) throw new Error('This browser can’t keep saves here (no IndexedDB: a private window, perhaps). Open it in a normal window, or run serve.py.');
  saves = idbStore('saves', 'save');
  contentSets = idbStore('content', 'content set');
  mode = 'browser';
  await seed();
  return mode;
}

// ---- The browser's store (IndexedDB) ----------------------------------------------------------

const DB_NAME = 'star-lattice';
let dbOpen = null;
const openDb = () => (dbOpen ??= new Promise((ok, fail) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    for (const s of ['saves', 'content']) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'name' });
  };
  req.onsuccess = () => ok(req.result);
  req.onerror = () => fail(req.error ?? new Error('Couldn’t open this browser’s storage.'));
}));
/** Run one request in a transaction; resolves with its result once the transaction is complete. */
async function run(store, mode, f) {
  const db = await openDb();
  return new Promise((ok, fail) => {
    const t = db.transaction(store, mode);
    const req = f(t.objectStore(store));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => fail(t.error ?? new Error('Couldn’t write to this browser’s storage.'));
    t.onabort = () => fail(t.error ?? new Error('This browser’s storage refused the write (is it full?).'));
  });
}
/** A collection in IndexedDB with fileStore's interface. Records: { name, data, savedAt }. */
function idbStore(store, what) {
  return {
    list: async () => (await run(store, 'readonly', s => s.getAll()))
      .filter(r => !r.name.startsWith('_')).map(r => ({ name: r.name, savedAt: r.savedAt }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    load: async name => {
      const r = await run(store, 'readonly', s => s.get(name));
      if (!r) throw new Error(`There’s no ${what} named “${name}” in this browser.`);
      return r.data;
    },
    save: async (name, data) => run(store, 'readwrite', s => s.put({ name, data, savedAt: new Date().toISOString() })),
    remove: async name => run(store, 'readwrite', s => s.delete(name)),
  };
}

// ---- The packs ------------------------------------------------------------------------
// packs/index.json: { packs: [{ id, title, about, content: 'id/pack.json', board: 'id/board.json' }] }
// (paths relative to the index). The single-file build carries the same list as
// window.STAR_LATTICE_PACKS, each pack's content and board inline ({ data }).

const PACKS_URL = () => new URL('../packs/index.json', globalThis.location?.href ?? 'http://localhost/app/');
let packIndex = null;
/** The packs: [{ id, title, about, … }] ([] when there are none to read). */
export async function packs() {
  if (packIndex) return packIndex.packs ?? [];
  if (globalThis.STAR_LATTICE_PACKS) return (packIndex = globalThis.STAR_LATTICE_PACKS).packs ?? [];
  const r = await fetch(PACKS_URL(), { cache: 'no-store' }).catch(() => null);
  packIndex = r?.ok ? await r.json().catch(() => ({ packs: [] })) : { packs: [] };
  return packIndex.packs ?? [];
}
/** A pack's content set and starter board: { content, board }. */
export async function loadPack(id) {
  const pack = (await packs()).find(p => p.id === id);
  if (!pack) throw new Error(`There’s no pack “${id}”.`);
  const get = async ref => ref?.data ?? (await (await fetch(new URL(ref, PACKS_URL()), { cache: 'no-store' })).json());
  const [content, board] = await Promise.all([get(pack.content), get(pack.board)]);
  return { content, board, pack };
}

/** The first time (no content sets yet, in this browser or a fresh copy's folders): every pack's content set and board. */
async function seed() {
  if ((await contentSets.list()).length) return;
  const list = await packs();
  if (!list.length) throw new Error('No content sets yet, and the packs (packs/index.json) couldn’t be read.');
  const loaded = await Promise.all(list.map(p => loadPack(p.id)));   // fetched together, saved in order
  for (const [i, p] of list.entries()) {
    const { content, board } = loaded[i];
    await contentSets.save(content.id, content);
    // A play version's board starts fresh, however it was shipped (its progress cleared, no PIN).
    await saves.save(p.title, PLAY ? (s => ({ ...s, pin: null, state: freshBoard(s.state) }))(normalizeSave(board)) : board);
  }
}

// ---- Writing the open file ----------------------------------------------------------------------

let written = { name: null, save: null, content: null };
/** The open save as written: with its own design (P10). */
export const withDesign = file => ({ ...file.save, design: designOf(file.content) });
/**
 * Write the open save and its content set (only the parts that changed since the last write).
 * `keepalive` lets a write sent while the page closes finish (server only; the browser's store
 * writes at once). Returns whether anything was written; throws when a write fails (the parts then
 * count as unwritten, so the next write retries them).
 */
export async function writeFile(file, { keepalive = false } = {}) {
  const jobs = [];
  // The save, with its own design (P10): a design change is this save's alone; the content set (the
  // library) is written only when it's made, or by Update content set.
  if (file.save !== written.save || file.name !== written.name || file.content !== written.content) jobs.push(saves.save(file.name, withDesign(file), { keepalive }));
  if (!jobs.length) return false;
  const before = written;
  written = { name: file.name, save: file.save, content: file.content };
  try {
    await Promise.all(jobs);
  } catch (e) {
    if (written.save === file.save) written = before;
    throw new Error(mode === 'server' && /fetch|network/i.test(e.message) ? 'the server didn’t answer (is serve.py running?)' : e.message);
  }
  return true;
}
/** Whether the open file has changes not yet written. */
export const unwritten = file => file.save !== written.save || file.name !== written.name || file.content !== written.content;
/** Mark a freshly opened file as already written, so opening it writes nothing. */
export const markWritten = file => { written = { name: file.name, save: file.save, content: file.content }; };

/** Where saves go, in words: for the save bar and States ▾. */
export const whereSaved = () => (mode === 'browser' ? 'in this browser' : 'to saves/');

/** This browser's settings ({} when there are none, or storage is unavailable). */
export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY));
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}
export function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* unavailable: settings just aren't kept */ }
}
