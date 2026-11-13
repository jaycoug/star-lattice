// Usage: gjs -m loadall.js <project>  → imports every module in app/js and shared (except main.js) on the fake DOM
import System from './node-gi.js';
import { Gio } from './node-gi.js';
import { install } from './fakedom.js';
const root = System.programArgs[0];
install(root, '/app/');
const walk = p => {
  const out = [];
  const en = Gio.File.new_for_path(p).enumerate_children('standard::name,standard::type', 0, null);
  for (let i; (i = en.next_file(null));) {
    const c = `${p}/${i.get_name()}`;
    if (i.get_file_type() === Gio.FileType.DIRECTORY) out.push(...walk(c)); else if (c.endsWith('.js')) out.push(c);
  }
  return out;
};
const files = [...walk(`${root}/app/js`), ...walk(`${root}/shared`)].filter(f => !f.endsWith('/main.js')).sort();
let bad = 0;
for (const f of files) {
  try { await import(`file://${f}`); } catch (e) { bad++; print(`FAIL ${f}: ${e}`); }
}
print(`${files.length - bad}/${files.length} modules loaded`);
