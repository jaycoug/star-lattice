// A small fake DOM + fetch for driving the app in gjs. fetch serves files under ROOT the way serve.py does.
import { GLib } from './node-gi.js';
import { Gio } from './node-gi.js';
export class Node {}
class Text extends Node { constructor(t) { super(); this.data = String(t); } get textContent() { return this.data; } }
export class El extends Node {
  constructor(tag) {
    super(); this.tagName = tag.toUpperCase(); this.attrs = {}; this.children = []; this.parent = null; this.listeners = {};
    this.style = { setProperty() {} }; this.dataset = {}; this.scrollTop = 0; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false;
    const cls = new Set(); this.classList = { toggle: (c, on) => (on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c), contains: c => cls.has(c), add: c => cls.add(c), remove: c => cls.delete(c) };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'checked') this.checked = true; if (k === 'disabled') this.disabled = true; if (k === 'value') this.value = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  append(...c) { for (const x of c) { const n = x instanceof Node ? x : new Text(x); n.parent = this; this.children.push(n); } }
  replaceChildren(...c) { this.children = []; this.append(...c); }
  replaceWith(n) { const i = this.parent.children.indexOf(this); n.parent = this.parent; this.parent.children[i] = n; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  fire(t, ev = {}) { let stop = false; const e = { target: this, preventDefault() {}, stopPropagation() { stop = true; }, button: 0, pointerId: 1, ...ev }; let c = 0; for (let n = this; n && !stop; n = n.parent) { if (++c > 100000) { print('CYCLE fire', t, new Error().stack); throw new Error('cycle'); } (n.listeners[t] ?? []).forEach(f => f(e)); } }
  closest(sel) {
    const parts = sel.split(',').map(x => x.trim());
    const match = (n, p) => {
      const data = /^\[data-([a-z-]+)\]$/.exec(p);
      if (data) return n.dataset[data[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())] != null;
      if (p.startsWith('.')) return (n.attrs.class ?? '').split(' ').includes(p.slice(1));
      return n.tagName === p.toUpperCase();
    };
    for (let n = this; n instanceof El; n = n.parent) if (parts.some(p => match(n, p))) return n;
    return null;
  }
  get textContent() { return this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.children = [new Text(v)]; }
  get isConnected() { return true; }
  focus() {} select() {} setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 700 }; }
  querySelectorAll(sel) {
    if (sel === '[data-scroll-key]') return this.all(n => n !== this && n.dataset.scrollKey != null);
    const attr = /^([a-z]*)\[([\w-]+)="([^"]*)"\]$/.exec(sel);   // tag[attr="value"], [data-x="value"] (the tutorials' targets)
    if (attr) {
      const [, tag, k, v] = attr;
      const of = n => (k.startsWith('data-') ? n.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] : n.attrs[k]);
      return this.all(n => n !== this && (!tag || n.tagName === tag.toUpperCase()) && of(n) === v);
    }
    const m = /^\.([\w-]+)/.exec(sel);
    return m ? this.all(n => n !== this && (n.attrs.class ?? '').split(' ').includes(m[1])) : [];
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  contains(n) { let c = 0; for (; n; n = n.parent) { if (++c > 100000) { print('CYCLE contains', new Error().stack); throw new Error('cycle'); } if (n === this) return true; } return false; }
  all(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) if (c instanceof El) c.all(pred, out); return out; }
  find(pred) { return this.all(pred)[0]; }
}
let openSave = 'outlook';   // the save a click-through opens (install's `save`)
/**
 * A file of the copy, as text. A content set (content/<id>.json) is read as the open save plays it
 * (P10): its library with that save's own design over it, when the save is on it and has one, so a
 * click-through checks a Design setting where it's now kept (in the save).
 */
export function readFile(ROOT, f) {
  const raw = new TextDecoder().decode(GLib.file_get_contents(`${ROOT}/${f}`)[1]);
  const m = /^content\/(.+)\.json$/.exec(f);
  if (!m) return raw;
  try {
    const save = JSON.parse(new TextDecoder().decode(GLib.file_get_contents(`${ROOT}/saves/${openSave}.json`)[1]));
    if (save.content !== m[1] || !save.design) return raw;
    const lib = JSON.parse(raw);
    return JSON.stringify({ ...lib, ...save.design, format: lib.format, version: lib.version, id: lib.id, title: lib.title });
  } catch { return raw; }
}

export function install(ROOT, pageDir, { save = 'outlook', realPlay = true, tours = false } = {}) {
  openSave = save;
  globalThis.starLatticeTours = tours;   // the tutorials' popups stay out of the way, except in tourflow.js
  // Play mode plays for real here (as the play version will), so a click-through can answer in Play
  // mode and see it in Edit mode; testrun.js checks the design version's throwaway test run.
  globalThis.starLatticeRealPlay = realPlay;
  const els = {};
  const doc = new El('document');
  Object.assign(doc, { getElementById: id => (els[id] ??= new El('div')), createElement: t => new El(t), createElementNS: (_, t) => new El(t), title: '' });
  globalThis.document = doc; globalThis.Node = Node;
  // The click-throughs open a given save (test/fixtures/saves): most run on outlook, the quiz
  // click-throughs on Quiz bank.
  globalThis.localStorage = { _m: { 'star-lattice:prefs': JSON.stringify({ last: save }) }, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); } };
  globalThis.addEventListener = () => {};
  globalThis.structuredClone ??= v => JSON.parse(JSON.stringify(v));
  globalThis.prompt = () => globalThis.__answer ?? null; globalThis.confirm = () => true;
  let ro = []; globalThis.ResizeObserver = class { constructor(f) { ro.push(f); } observe() {} };
  const stores = { '/api/saves': 'saves', '/app/api/saves': 'app/saves', '/dashboard/api/saves': 'dashboard/saves', '/api/content': 'content' };
  const resolve = url => {
    const parts = (url.startsWith('/') ? '' : pageDir).concat(url.split('?')[0]).split('/'), out = [];
    for (const p of parts) p === '..' ? out.pop() : p && p !== '.' && out.push(p);
    return '/' + out.join('/');
  };
  globalThis.fetch = async (url, opts = {}) => {
    const path = resolve(url);
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body, headers: { get: () => 'application/json' } });
    for (const [base, dir] of Object.entries(stores)) {
      if (path === base) {
        const d = `${ROOT}/${dir}`; const out = [];
        try { const e = Gio.File.new_for_path(d).enumerate_children('standard::name', 0, null); for (let i; (i = e.next_file(null));) { const n = i.get_name(); if (n.endsWith('.json') && !n.startsWith('_')) out.push({ name: n.slice(0, -5), savedAt: '' }); } } catch (err) { print('list error', err); }
        return json(200, out);
      }
      if (path.startsWith(base + '/')) {
        const f = `${ROOT}/${dir}/${decodeURIComponent(path.slice(base.length + 1))}.json`;
        if ((opts.method ?? 'GET') === 'PUT' && globalThis.__failPut) return json(500, { error: 'disk full' });
        if ((opts.method ?? 'GET') === 'PUT') { GLib.mkdir_with_parents(`${ROOT}/${dir}`, 0o755); GLib.file_set_contents(f, opts.body); globalThis.__writes = (globalThis.__writes ?? 0) + 1; return json(200, {}); }
        if (opts.method === 'DELETE') { try { Gio.File.new_for_path(f).delete(null); } catch {} return json(200, {}); }
        try { return json(200, JSON.parse(new TextDecoder().decode(GLib.file_get_contents(f)[1]))); } catch { return json(404, { error: 'Not found' }); }
      }
    }
    try { return json(200, JSON.parse(new TextDecoder().decode(GLib.file_get_contents(ROOT + path)[1]))); } catch {}
    return json(404, { error: 'no route ' + path });
  };
  return { els, doc, resize: () => ro.forEach(f => f()) };
}
export const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
