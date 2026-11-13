// Usage: gjs -m smoke.js <copy of the project>: round-4 baseline. Every tab renders on the copy's save,
// the PLAY switch toggles, the saved indicator shows, and opening writes nothing. Round 6: dark mode
// (the switch, kept in this browser, and every light color token redefined for dark).
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/');
let hash = '#dissect';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
let before = read('saves/outlook.json');
doc.documentElement = doc.createElement('html');   // main.js sets data-theme on it (round 6)
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
await tick(500);   // P10: a save from before writes its own copy of the design once, as it opens
print(`${JSON.parse(read('saves/outlook.json')).design ? 'ok  ' : 'FAIL'} opening a save from before writes its own copy of the design, once (P10)`);
before = read('saves/outlook.json');   // from here on, browsing writes nothing
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const go = async h => { location.hash = h; doc.fire?.('hashchange'); await tick(50); };

const status = app.find(n => cls(n, 'save-status'));
report('saved indicator shows', !!status && text(status).startsWith('Saved'), status ? text(status) : '(none)');
const expect = { tree: 'Shelf', schedule: 'Schedule', design: 'Design', play: 'ignited', star: 'ignited' };
// P2: View (Star · Tree · Deck · Schedule) and Mode (Edit · Play) replace the tabs; older addresses still work.
await go('#dissect');
report('an old #dissect link opens the Tree view', hash === '#tree' && text(app).includes('Shelf'), hash);
await go('#materials');
report('#materials and #rearrange open the Tree view too', hash === '#tree' && text(app).includes('Shelf'), hash);
await go('#govern/look');
report('#govern/look opens ⚙ Design › Look', hash === '#design/look' && text(app).includes('Item name convention'), hash);
await go('#tree');
const segs = name => app.find(n => n.attrs?.['aria-label'] === name)?.all(n => cls(n, 'seg')).map(text) ?? [];
report('P2: the bar has View: Star · Tree · Deck · Schedule and Mode: Edit · Play, then ⚙ Design and ? Help', segs('View').join(' · ') === 'Star · Tree · Deck · Schedule' && segs('Mode').join(' · ') === 'Edit · Play'
  && app.all(n => cls(n, 'tab')).map(text).join(' · ') === '⚙ Design · ? Help', `${segs('View').join(' · ')} | ${segs('Mode').join(' · ')}`);
report('under Hierarchical, Deck is greyed out and says why', !!app.find(n => cls(n, 'seg') && cls(n, 'disabled') && text(n) === 'Deck' && /Independent/.test(n.attrs.title)));
for (const [tab, word] of Object.entries(expect)) {
  try {
    await go('#' + tab);
    const t = text(app);
    report(`#${tab} renders`, t.length > 200 && t.includes(word), `${t.length} chars`);
  } catch (e) { report(`#${tab} renders`, false, String(e)); }
}
const modeSeg = m => app.find(n => cls(n, 'seg') && n.dataset?.mode === m);
await go('#play');
report('in Play mode the player’s views only (the Star view by default), and no ⚙ Design', segs('View').length === 0 && !app.find(n => cls(n, 'design-link')) && cls(modeSeg('play'), 'on'));
await go('#play/tree');
report('a view the player isn’t given opens the Star view instead', hash === '#play', hash);
await go(modeSeg('edit')?.attrs.href ?? '');
report('Mode › Edit goes to the same view in Edit mode', hash === '#star', hash);
await go('#design/player');
report('⚙ Design › Player lists what the player may do, by group', ['Views', 'Star view', 'Star-dot screen', 'Tree view', 'Sessions'].every(g => text(app).includes(g)) && !!app.find(n => n.dataset?.player === 'tree'));
report('opening and browsing write nothing', read('saves/outlook.json') === before);

// Dark mode (round 6): light by default here (no system preference in the fake DOM); the switch flips it.
const theme = () => doc.documentElement.dataset.theme;
report('the page starts light (no theme chosen, no system preference)', theme() === 'light');
const themeBtn = () => app.find(n => cls(n, 'theme-btn'));
themeBtn().fire('click'); await tick(500);
report('☾ Dark switches the whole page to dark, kept in this browser', theme() === 'dark' && JSON.parse(localStorage.getItem('star-lattice:prefs')).theme === 'dark' && text(themeBtn()).includes('Light'));
report('switching themes writes nothing to the save', read('saves/outlook.json') === before);
themeBtn().fire('click'); await tick(500);
report('☀ Light switches back', theme() === 'light');
const css = read('app/css/app.css');
const tokens = block => new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
const darkAt = css.indexOf(':root[data-theme="dark"] {');
const dark = tokens(css.slice(darkAt, css.indexOf('}', darkAt)));
const missing = [...light].filter(v => !dark.has(v) && !['--mono', '--sans', '--tint-ink'].includes(v));
report('the dark theme redefines every color token of the light one', darkAt > 0 && missing.length === 0, missing.join(' '));
// A popout sheet (a star-dot's screen) stands off the page: darker than it in light mode, lighter in dark.
const lightness = (block, v) => Number(new RegExp(v + ':[ ]*oklch[(]([0-9.]+)').exec(block)?.[1]);
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const darkBlock = css.slice(darkAt, css.indexOf('}', darkAt));
const [lb, ls, db, ds] = [lightness(lightBlock, '--bg'), lightness(lightBlock, '--sheet'), lightness(darkBlock, '--bg'), lightness(darkBlock, '--sheet')];
report('the star-dot screen’s sheet is a shade darker than the page in light mode, lighter in dark mode', ls < lb && ds > db && css.includes('background: var(--sheet)') && css.includes('--sds-bg: var(--sheet)'), `light ${ls} < ${lb}, dark ${ds} > ${db}`);
