// Node stand-ins for the few gjs-style calls the headless checks use (GLib, Gio, System). The checks
// were first written for gjs; stage 5 made them Node-only, and this file keeps their calls.
//
// Paths: a check builds module URLs as `file://${ROOT}/…`. On Windows, the project folder
// (C:/…) is handed over as /C:/…, so that URL reads file:///C:/…, and every file call here takes the
// leading slash off again. Elsewhere paths pass through unchanged.
import fs from 'fs';

const fix = p => String(p).replace(/^\/([A-Za-z]:)/, '$1');
const arg = a => (/^[A-Za-z]:[\\/]/.test(a) ? '/' + a.replace(/\\/g, '/') : a);

export const GLib = {
  file_get_contents: f => [true, fs.readFileSync(fix(f))],
  file_set_contents: (f, s) => fs.writeFileSync(fix(f), s),
  mkdir_with_parents: d => fs.mkdirSync(fix(d), { recursive: true }),
  getenv: k => process.env[k] ?? null,
};
const entry = (dir, n) => ({ get_name: () => n, get_file_type: () => (fs.statSync(`${dir}/${n}`).isDirectory() ? 2 : 1) });
export const Gio = {
  FileType: { DIRECTORY: 2 },
  File: {
    new_for_path: p => ({
      enumerate_children() { const names = fs.readdirSync(fix(p)); let i = 0; return { next_file: () => (i < names.length ? entry(fix(p), names[i++]) : null) }; },
      delete() { fs.unlinkSync(fix(p)); },
    }),
  },
};
export default { programArgs: process.argv.slice(2).map(arg) };
globalThis.print = (...a) => console.log(...a);
globalThis.window = globalThis;
