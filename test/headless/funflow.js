// Usage: node funflow.js <copy of the project>: P9, the fun on the Star view. 9a: a star-dot that
// ignites bursts (bigger at a Zenith), a star wholly ignited goes supernova, the moments fade and
// go; nothing with Design › Fun › Bursts off, on the first draw, or under reduce-motion; the switch
// is on by default and saved with the content set.
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/');
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const E = await import(`file://${ROOT}/shared/engine/index.js`);
const { createMap } = await import(`file://${ROOT}/shared/ui/map.js`);

const content = E.normalizeContent(JSON.parse(read('content/life.json')));
report('Bursts is on by default (a content set without it)', content.rules.bursts === 'on');
report('…and kept as set', E.normalizeContent({ ...JSON.parse(read('content/life.json')), rules: { ...JSON.parse(read('content/life.json')).rules, bursts: 'off' } }).rules.bursts === 'off');

const save = E.normalizeSave(JSON.parse(read('saves/outlook.json')));
const opts = { ...E.optionsFrom(content), share: save.share };
const view = st => E.derive(st, opts);
const map = createMap();
const fxOf = () => map.el.find(n => cls(n, 'layer-fx'));
const bursts = () => fxOf()?.all(n => cls(n, 'fx-burst')) ?? [];
const novas = () => fxOf()?.all(n => cls(n, 'fx-nova')) ?? [];
const draw = (st, more = {}) => map.update({ state: st, view: view(st), content, sel: null, mode: null, dots: 'all', fx: true, ...more });

let st = save.state;
draw(st);
resize(); await tick(20);
report('the first draw has no moments', bursts().length === 0 && novas().length === 0);

// A star-dot on the central star that isn't ignited: ignite it.
const central = Object.keys(st.stars).find(s => !st.stars[s].sources.length);
const ev0 = view(st);
const onCentral = st.stars[central].kites.flatMap(k => st.kites[k].dots.map((d, slot) => d && { d, slot })).filter(Boolean);
const inner = onCentral.find(x => x.slot !== E.ZENITH && ev0.effective(x.d).status !== 'ignited');
st = E.ignite(st, inner.d, Date.now());
draw(st);
report('a star-dot that ignites bursts where it is', bursts().length >= 1 && bursts().some(n => n.dataset.dot === inner.d && !cls(n, 'zenith')), bursts().map(n => n.dataset.dot).join());
await tick(1100);
draw(st, { sel: { kind: 'dot', id: inner.d } });   // another draw after it ended
report('…and goes once it has faded (under a second)', bursts().length === 0);

// Everything on the central star ignited: a supernova (and a Zenith's bigger burst).
const before = st;
for (const d of Object.keys(st.dots)) st = E.ignite(st, d, Date.now());   // a star-dot with children ignites through them
const allLit = onCentral.every(({ d }) => view(st).effective(d).status === 'ignited');
draw(st);
report('a star whose every star-dot is now ignited goes supernova, its kites flooding out', allLit && novas().some(n => n.dataset.star === central && n.all(x => cls(x, 'fx-flood')).length === 6) && novas().every(n => view(st).shownStars().includes(n.dataset.star)), `${novas().length} novas, all lit ${allLit}`);
report('…a Zenith’s burst is the bigger one', bursts().some(n => cls(n, 'zenith')));
report('…and nothing on the map underneath can’t be clicked through it', fxOf().attrs['pointer-events'] === 'none');
await tick(1700);
draw(st, { sel: null });
report('the supernova goes too', novas().length === 0 && bursts().length === 0);

// Under a popout (a question, a star-dot's screen): the moments wait until it closes.
const fresh = save.state;
const next = onCentral.find(x => x.d !== inner.d && view(fresh).effective(x.d).status !== 'ignited' && view(E.ignite(fresh, x.d, Date.now())).effective(x.d).status === 'ignited');
draw(fresh); await tick(1700); draw(fresh, { hold: true });
draw(E.ignite(fresh, next.d, Date.now()), { hold: true });
report('with a popout open over the map, an ignite doesn’t burst yet', bursts().length === 0);
report('…and the map underneath still shows the board as it was (the star-dot not lit)', !cls(map.el.find(n => n.dataset?.hit === 'dot' && n.dataset.id === next.d), 'ignited'));
draw(E.ignite(fresh, next.d, Date.now()), { hold: false });
report('…it bursts as the popout closes (the state unchanged since)', bursts().some(n => n.dataset.dot === next.d), bursts().map(n => n.dataset.dot).join());
await tick(1100); draw(st);
await tick(1700);

// A star deployed under a box (Deploy by hand or automatically): drawn and grown only once it closes.
const kitesDrawn = () => map.el.all(n => n.dataset?.hit === 'kite').length;
const opener = Object.keys(fresh.dots).find(d => { const r = E.deployStar(fresh, d, opts); return !r.problem && r.state !== fresh && view(r.state).shownStars().length > view(fresh).shownStars().length; });
if (opener) {
  const deployed = E.deployStar(fresh, opener, opts).state;
  draw(fresh, { animate: true }); await tick(400);
  const k0 = kitesDrawn();
  draw(fresh, { animate: true, hold: true });
  draw(deployed, { animate: true, hold: true });
  report('a star deployed while a box is open isn’t drawn yet, nor animating', kitesDrawn() === k0 && !map.animating(), `${kitesDrawn()} kites, ${k0} before`);
  draw(deployed, { animate: true, hold: false });
  report('…it grows from its star-dot as the box closes', kitesDrawn() > k0 && map.animating(), `${kitesDrawn()} kites`);
  await tick(500);
} else report('a star deployed under a box (no deployable star-dot on this save)', true, 'skipped');

// Off, and reduce-motion.
draw(before, { fx: false }); draw(st, { fx: false });
report('with Bursts off, nothing', bursts().length === 0 && novas().length === 0);
globalThis.matchMedia = q => ({ matches: q.includes('reduce') });
draw(before); draw(st);
report('under reduce-motion, nothing', bursts().length === 0 && novas().length === 0);
delete globalThis.matchMedia;

// ---- 9b: the bonus ladder ----
const ladderContent = { ...content, player: { ...content.player, rotateKites: true }, rules: { ...content.rules, bonuses: { on: 'on', every: 3, ladder: ['rotateKites', 'swap', 'rotateDots'] } } };
report('the ladder is off by default', content.rules.bonuses.on === 'off' && E.bonusStatus(content, save.state) === null && E.earnedPlayer(content, save.state) === content.player);
const cleaned = E.normalizeContent({ ...JSON.parse(read('content/life.json')), rules: { bonuses: { on: 'on', every: 500, ladder: ['swap', 'swap', 7] } } }).rules.bonuses;
report('…and cleaned as it loads (every 1–99, each tool once)', cleaned.on === 'on' && cleaned.every === 3 && cleaned.ladder.join() === 'swap', JSON.stringify(cleaned));
report('the layer is never a prize (one on a ladder from before is skipped)', E.ladderOf({ ...content, rules: { ...content.rules, bonuses: { on: 'on', every: 3, ladder: ['layer', 'swap'] } } }).rungs.join() === 'swap');
let b0 = E.startSession(save.state);
report('with it on, the ladder’s tools are locked for the player until earned', E.earnedPlayer(ladderContent, b0).rotateKites === false && E.earnedPlayer(ladderContent, b0).swap === false && E.allows(E.earnedPlayer(ladderContent, b0), true)('rotateKites'));
const onMap0 = new Set(view(b0).shownStars().flatMap(s => b0.stars[s].kites.flatMap(k => b0.kites[k].dots)).filter(Boolean));
const openOnes = Object.keys(b0.dots).filter(d => onMap0.has(d) && view(b0).effective(d).status !== 'ignited' && view(E.ignite(b0, d, 1)).effective(d).status === 'ignited').slice(0, 3);
let b = b0;
for (const d of openOnes.slice(0, 2)) b = E.settleBonus(ladderContent, b, E.ignite(b, d, Date.now()), opts);
report('two ignites: 1 to go, nothing to claim yet', E.bonusStatus(ladderContent, b).count === 2 && E.bonusStatus(ladderContent, b).toGo === 1 && !E.bonusStatus(ladderContent, b).next, JSON.stringify(E.bonusStatus(ladderContent, b)));
b = E.settleBonus(ladderContent, b, E.ignite(b, openOnes[2], Date.now()), opts);
report('the third earns the first rung: ⟳ Rotate kites, ready to claim', E.bonusStatus(ladderContent, b).next === 'rotateKites');
report('…and remembers the star-dot that earned it (its prize goes beside it)', b.bonus.at === openOnes[2] && E.normalizeSave({ ...JSON.parse(read('saves/outlook.json')), state: b }).state.bonus.at === openOnes[2]);
report('…still locked until it’s claimed', E.earnedPlayer(ladderContent, b).rotateKites === false);
const claimed = E.claimBonus(ladderContent, b);
report('claiming unlocks it (the next still locked)', E.earnedPlayer(ladderContent, claimed).rotateKites !== false && E.earnedPlayer(ladderContent, claimed).swap === false && !E.bonusStatus(ladderContent, claimed).next);
report('the count is kept with the save', E.normalizeSave({ ...JSON.parse(read('saves/outlook.json')), state: claimed }).state.bonus?.got?.join() === '0');
report('a new session starts the ladder over', !E.startSession(claimed).bonus);
const offInPlayer = { ...ladderContent, player: { ...ladderContent.player, rotateKites: false } };
report('a tool the player isn’t given (Player) is skipped', E.bonusStatus(offInPlayer, b).next === 'swap');

// Only the Star view's tools are prizes, and only where they can work.
report('the tools that can be prizes: the three moves (no layer, Undo, Kites: Solid | Designs, Retire, screen or Tree tools)', E.LADDER_TOOLS.join() === 'swap,rotateDots,rotateKites' && !E.LADDER_KEYS.includes('layer') && !E.LADDER_KEYS.includes('undo') && !E.LADDER_KEYS.includes('retire') && !E.LADDER_KEYS.includes('kiteLook'));
const ind = { ...content, rules: { ...content.rules, stardots: 'independent', questions: 'on', bonuses: { on: 'on', every: 1, ladder: ['swap', 'rotateDots', 'kite:cut'] } } };
report('under Independent the moves can’t work: not offered, skipped on the ladder', !!E.prizeProblem(ind, 'swap') && !!E.prizeProblem(ind, 'rotateDots') && !E.prizeProblem(ind, 'kite:cut') && E.ladderOf(ind).rungs.join() === 'kite:cut');
report('…Kites lock: no swapping or turning kites (↻ Rotate still works)', !!E.prizeProblem({ rules: { locks: 'on', kites: 'all' } }, 'swap') && !E.prizeProblem({ rules: { locks: 'on', kites: 'all' } }, 'rotateDots'));

// The kite designer's two prizes, each on its own, in any order.
const withPrizes = ladder => ({ ...content, player: { ...content.player, kiteDesign: false, palette: false, kiteLook: false }, rules: { ...content.rules, bonuses: { on: 'on', every: 1, ladder } } });   // Player's switches off: the ladder decides
const kc = withPrizes(['kite:paint', 'kite:cut']);
const at = n => ({ ...b0, bonus: { count: 9, claimed: n } });
report('Cut out and Paint on can be laddered in any order (Paint on first here)', E.bonusStatus(kc, at(0)).next === 'kite:paint' && E.bonusStatus(kc, at(1)).next === 'kite:cut');
report('…before either, no kite designer', E.earnedPlayer(kc, at(0)).kiteDesign === false);
const paintOnly = E.designerAllows(kc, at(1), false);
report('…Paint on alone: Light and Dark, Fill and Lines, every symmetry', E.earnedPlayer(kc, at(1)).kiteDesign !== false && paintOnly.tones.join() === 'light,dark' && paintOnly.modes.join() === 'fill,lines' && paintOnly.syms.length === 4, JSON.stringify(paintOnly));
const cutOnly = E.designerAllows(withPrizes(['kite:cut', 'kite:paint']), at(1), false);
report('…Cut out alone: Ink and Clear, Fill only, Across ↔', cutOnly.tones.join() === 'none,ink' && cutOnly.modes.join() === 'fill' && cutOnly.syms.join() === 'across', JSON.stringify(cutOnly));
report('…both: everything; Edit mode always everything', E.designerAllows(kc, at(2), false) === null && E.designerAllows(kc, at(0), true) === null);
report('…one on the ladder, the other is never the player’s (with a ladder, only claimed prizes)', E.earnedPlayer(withPrizes(['kite:cut']), at(0)).kiteDesign === false && E.designerAllows(withPrizes(['kite:cut']), at(1), false).tones.join() === 'none,ink');
report('…without a ladder, Player decides: the whole designer', E.designerAllows({ ...kc, rules: { ...kc.rules, bonuses: { on: 'off', every: 1, ladder: [] } } }, at(0), false) === null);
const { kiteDesigner } = await import(`file://${ROOT}/shared/ui/kiteDesigner.js`);
const kd = kiteDesigner({ design: null, color: '#ff0000', allowed: cutOnly });
const segs = kd.all(n => cls(n, 'seg')).map(n => (n.textContent ?? '').trim());
report('the designer shows only what’s allowed (Cut out: Ink, Clear; no Lines, no symmetry choice)', segs.includes('Ink') && segs.includes('Clear') && !segs.includes('Light') && !segs.includes('Lines') && !segs.includes('Both'), segs.join('|'));

// Palettes: each its own prize; Your own palette too.
const pc = withPrizes(['palette:fizzbolt', 'palette:own']);
report('with a ladder, the player has only the palettes they’ve claimed: none at first (no 🎨), none off the ladder', E.playerPalettes(pc, at(0)).length === 0 && E.earnedPlayer(pc, at(0)).palette === false && !E.playerPalettes(pc, at(2)).includes('coastglow'));
report('…without a ladder, Player decides: every palette and their own', E.playerPalettes({ ...pc, rules: { ...pc.rules, bonuses: { on: 'off', every: 1, ladder: [] } } }, at(0)).length === 6);
report('…claimed, they’re the player’s', E.playerPalettes(pc, at(2)).includes('fizzbolt') && E.playerPalettes(pc, at(2)).includes('own'));
report('the prizes are offered whatever Player says (Palette and Kite designer off here)', E.ladderOf(pc)?.rungs.join() === 'palette:fizzbolt,palette:own');
report('a kite prize claimed brings 🖌 and Kites: Solid | Designs with it, though Player has them off', E.earnedPlayer(kc, at(1)).kiteDesign === true && E.earnedPlayer(kc, at(1)).kiteLook === true && E.earnedPlayer(kc, at(0)).kiteLook === false);
report('the player’s palette this session and their own palette are kept with the save', E.normalizeSave({ ...JSON.parse(read('saves/outlook.json')), playerPalette: { name: 'Mine', colors: Array(6).fill('#ABCDEF') }, state: { ...at(2), look: { palette: 'own' } } }).playerPalette?.colors[0] === '#abcdef'
  && E.normalizeSave({ ...JSON.parse(read('saves/outlook.json')), state: { ...at(2), look: { palette: 'own' } } }).state.look?.palette === 'own');
report('a new session goes back to the designer’s colors', !E.startSession({ ...at(2), look: { palette: 'fizzbolt' } }).look);

// The prize on the map: an icon alone on an empty position; a click is a { kind: 'prize' } target; it bursts as it goes.
const { hitOf } = await import(`file://${ROOT}/shared/ui/map.js`);
await tick(1800);
// Where it goes: the hexagonal hole (a lattice triangle's centroid, 1/√3 from each of its three
// positions) nearest the star-dot that earned it; around the central star when there's none.
const { prizeSpot } = await import(`file://${ROOT}/shared/ui/map.js`);
const L = await import(`file://${ROOT}/shared/lattice.js`);
const vb = view(b);
const earner = b.bonus.at;
const spot = prizeSpot(b, vb, earner);
const starOf = Object.keys(b.stars).find(s => vb.shownStars().includes(s) && b.stars[s].kites.some(k => b.kites[k].dots.includes(earner)));
const c0 = L.toPixel(vb.place(starOf).coord);
const holes = L.neighbors(vb.place(starOf).coord).map(n => L.toPixel(n)).map((a, i, ns) => [(c0[0] + a[0] + ns[(i + 1) % 6][0]) / 3, (c0[1] + a[1] + ns[(i + 1) % 6][1]) / 3]);
report('the prize sits in a hexagonal hole of its star-dot’s star (1/√3 from its center)', holes.some(h => Math.hypot(h[0] - spot[0], h[1] - spot[1]) < 1e-9) && Math.abs(Math.hypot(spot[0] - c0[0], spot[1] - c0[1]) - 1 / Math.sqrt(3)) < 1e-9, JSON.stringify(spot));
const central0 = prizeSpot(b, vb, null);
report('…with none, a hole around the central star (where its neighbors would be, there or not)', Math.abs(Math.hypot(...central0) - 1 / Math.sqrt(3)) < 1e-9);
draw(b, { prizes: [{ i: 0, key: 'rotateKites', near: earner, icon: '⟳' }] });
const prizeEl = () => map.el.find(n => cls(n, 'prize'));
report('a prize ready: its icon on the map, no words', !!prizeEl() && prizeEl().find(n => cls(n, 'prize-icon'))?.textContent === '⟳' && !prizeEl().find(n => n.tagName === 'TITLE'));
report('…a click on it is the prize (the host claims it)', hitOf(prizeEl().find(n => cls(n, 'prize-badge')))?.kind === 'prize');
draw(claimed, { prizes: [{ i: 0, key: 'rotateKites', near: earner, icon: '⟳', claimed: true }] });
report('claimed: it goes, with a burst where it was', !prizeEl() && !!map.el.find(n => cls(n, 'prize-burst')));

// ---- In the app, in Play mode: the prize on the Star view; clicking it unlocks the tool ----
const lifeRaw = JSON.parse(read('content/life.json'));
GLib.file_set_contents(`${ROOT}/content/life.json`, JSON.stringify({ ...lifeRaw, rules: { ...lifeRaw.rules, bonuses: { on: 'on', every: 1, ladder: ['kite:cut'] } } }));
const outRaw = JSON.parse(read('saves/outlook.json'));
GLib.file_set_contents(`${ROOT}/saves/outlook.json`, JSON.stringify({ ...outRaw, state: { ...outRaw.state, bonus: { count: 1, claimed: 0 } } }));
let hash = '#play';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const txt = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const undoBtn = () => app.find(n => n.attrs?.['aria-label'] === 'Kites');   // Kites: Solid | Designs (comes with the prize here)
const appPrize = () => app.find(n => cls(n, 'prize'));
report('Play mode: Cut out kite shapes is on the ladder, so the player hasn’t Kites: Solid | Designs yet', !undoBtn());
report('…its prize waits on the Star view', !!appPrize() && appPrize().dataset.prize === 'kite:cut');
const ev2 = { button: 0, pointerId: 1, clientX: 0, clientY: 0 };
const badge = appPrize().find(n => cls(n, 'prize-badge'));
badge.fire('pointerdown', { ...ev2, target: badge }); badge.fire('pointerup', { ...ev2, target: badge }); await tick(600);
report('clicking it unlocks it, and says so', !!undoBtn() && !appPrize() && /Unlocked: Cut out kite shapes/.test(txt(els.toast ?? doc)), txt(els.toast ?? doc).slice(0, 60));
{
  // 9e: the layer is never a prize (Design › Player gives it); turned to Constellation, its arrows travel a moment.
  const amap = () => app.find(n => cls(n, 'sl-map'));
  const lay = () => app.find(n => n.attrs?.['aria-label'] === 'Layer');
  const seg = t => lay().find(n => cls(n, 'seg') && txt(n) === t);
  report('9e: the Layer switch is the player’s with the ladder on (never a prize)', !!lay());
  seg('Constellation').fire('click'); await tick(300);
  report('…turned to Constellation, its arrows travel from origin to target', amap().classList.contains('constellation') && !!amap().find(n => cls(n, 'rel') && cls(n, 'travel')));
  await tick(2600);
  report('…then it stays as the constellation view, the arrows drawn', amap().classList.contains('constellation') && !!amap().find(n => cls(n, 'rel')) && !amap().find(n => cls(n, 'travel')));
  seg('Off').fire('click'); await tick(300);
  report('…Off: back to the regular view', !amap().classList.contains('constellation') && !amap().find(n => cls(n, 'rel')));
  seg('Constellation').fire('click'); await tick(300);
  report('…and every time it’s turned on, they travel again', !!amap().find(n => cls(n, 'rel') && cls(n, 'travel')));
  seg('Off').fire('click'); await tick(300);
}
report('…kept with the save', JSON.parse(read('saves/outlook.json')).state.bonus?.got?.join() === '0');
location.hash = '#star'; await tick(150);
report('Edit mode is never locked', !!undoBtn());

// ---- In the app: the player's palette ----
const go = async h => { location.hash = h; await tick(150); resize(); await tick(50); };
await go('#design/player');
const palSwitch = app.find(n => n.tagName === 'INPUT' && n.dataset?.player === 'palette');
palSwitch.checked = true; palSwitch.fire('change', { target: palSwitch }); await tick(500);
await go('#design/fun');
const add = app.find(n => cls(n, 'bonus-add'));
report('Design › Fun offers the prizes: the kite designer’s two and the palettes', ['kite:paint', 'palette:fizzbolt', 'palette:own'].every(k => add.find(n => n.tagName === 'OPTION' && n.attrs?.value === k)));
add.value = 'palette:fizzbolt'; add.fire('change', { target: add }); await tick(500);
const savedContent = () => JSON.parse(read('content/life.json'));
report('…added to the ladder (after Cut out kite shapes), saved', savedContent().rules.bonuses.ladder.join() === 'kite:cut,palette:fizzbolt', savedContent().rules.bonuses.ladder.join());
const palBtn = () => app.find(n => cls(n, 'player-palette-btn'));
await go('#play');
report('Play mode, Fizzbolt not yet earned (Cut out kite shapes was the rung claimed): no 🎨 at all, though Palette is on in Player', !palBtn());
// Fizzbolt first (↑), so the one rung claimed is Fizzbolt; Gladetrail after it, waiting.
await go('#design/fun');
{
  const li = k => app.find(n => n.tagName === 'LI' && n.dataset?.tool === k);
  report('the ladder’s rows have grips (no ↑ ↓)', !!li('palette:fizzbolt').find(n => cls(n, 'bonus-grip')) && !app.find(n => n.tagName === 'BUTTON' && ['Earlier', 'Later'].includes(n.attrs?.title)));
  const ev = { preventDefault() {}, dataTransfer: { setData() {} } };
  li('palette:fizzbolt').find(n => cls(n, 'bonus-grip')).fire('dragstart', ev);
  li('kite:cut').fire('dragover', ev); li('kite:cut').fire('drop', ev); await tick(500);
}
const add2 = app.find(n => cls(n, 'bonus-add'));
add2.value = 'palette:gladetrail'; add2.fire('change', { target: add2 }); await tick(500);
report('…reordered in Design › Fun (dragged by its grip onto Cut out kite shapes), saved', savedContent().rules.bonuses.ladder.join() === 'palette:fizzbolt,kite:cut,palette:gladetrail', savedContent().rules.bonuses.ladder.join());
await go('#play');
const palOpt = id => app.find(n => cls(n, 'palette-option') && n.dataset?.palette === id);
report('Fizzbolt claimed: 🎨, with the designer’s colors and Fizzbolt', !!palBtn() && !!palOpt('designer') && !!palOpt('fizzbolt') && !palOpt('fizzbolt').disabled);
report('…Gladetrail, still waiting on the ladder, greyed with a padlock', palOpt('gladetrail')?.disabled === true && cls(palOpt('gladetrail'), 'locked'));
report('…and the palettes not on the ladder aren’t offered at all', !palOpt('coastglow') && !palOpt('cloudblush') && !palOpt('mothchalk') && !app.find(n => cls(n, 'palette-new')));
const designerColors = savedContent().categories.map(c => c.color).join();
palOpt('fizzbolt').fire('click'); await tick(500);
report('picking Fizzbolt recolors the player’s board (kept with the save), not the content set', JSON.parse(read('saves/outlook.json')).state.look?.palette === 'fizzbolt' && cls(palOpt('fizzbolt'), 'current') && savedContent().categories.map(c => c.color).join() === designerColors);
const fills = () => app.find(n => cls(n, 'sl-map')).all(n => n.dataset?.hit === 'kite').map(n => `${n.dataset.id}=${n.attrs.fill}`).sort().join();
const playFills = fills();
await go('#star');
report('Edit mode shows the designer’s colors (the kites drawn differently), with no 🎨', !palBtn() && fills() !== playFills, `${fills().slice(0, 40)} vs ${playFills.slice(0, 40)}`);

// ---- In the app: the ladder off, Player decides; the player's kite designer is always the category's ----
await go('#design/fun');
const ladderOff = app.all(n => n.tagName === 'INPUT' && n.attrs?.name === 'bonuses')[0];   // Off, On
ladderOff.checked = true; ladderOff.fire('change', { target: ladderOff }); await tick(500);
report('the ladder off (saved)', savedContent().rules.bonuses.on === 'off');
await go('#play'); await tick(700);
report('…Player decides as before: 🎨 with every palette and New palette…', !!palBtn() && ['fizzbolt', 'coastglow', 'gladetrail', 'cloudblush', 'mothchalk'].every(n => palOpt(n) && !palOpt(n).disabled) && !!app.find(n => cls(n, 'palette-new')));
const tapIt = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0, target: el }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(300); };
const mapEl = () => app.find(n => cls(n, 'sl-map'));
const colored = mapEl().all(n => n.dataset?.hit === 'kite').find(n => !cls(n, 'empty'));
await tapIt(colored);
const designPill = mapEl().find(n => n.dataset?.hit === 'pill' && n.dataset.action === 'design');
if (designPill) {
  await tapIt(designPill);
  const sheet = app.find(n => cls(n, 'design-sheet'));
  report('Play mode’s kite designer paints the category’s design: no “This kite only”, no Import…', !!sheet && !txt(sheet).includes('This kite only') && !txt(sheet).includes('Import…'), txt(sheet).slice(0, 80));
  await go('#star'); await tick(300);
} else report('Play mode’s kite designer (no 🖌 pill on this kite)', false, 'no design pill');

// ---- Design › Fun: × takes a prize off the ladder; prizes that can't work aren't offered ----
await go('#design/fun');
const onOff = app.all(n => n.tagName === 'INPUT' && n.attrs?.name === 'bonuses')[1];   // On
onOff.checked = true; onOff.fire('change', { target: onOff }); await tick(500);
const row = k => app.find(n => n.tagName === 'LI' && n.dataset?.tool === k);
const x = row('palette:gladetrail')?.find(n => cls(n, 'remove-btn'));
report('each prize on the ladder has a × beside it', !!x && app.all(n => n.tagName === 'LI' && n.dataset?.tool).every(li => !!li.find(n => cls(n, 'remove-btn'))));
x.fire('click'); await tick(500);
report('…which takes it off the ladder (saved)', !row('palette:gladetrail') && !savedContent().rules.bonuses.ladder.includes('palette:gladetrail'), savedContent().rules.bonuses.ladder.join());
const offered = () => app.find(n => cls(n, 'bonus-add')).all(n => n.tagName === 'OPTION').map(n => n.attrs.value);
const workable = () => E.LADDER_KEYS.filter(k => !savedContent().rules.bonuses.ladder.includes(k) && !E.prizeProblem(E.normalizeContent(savedContent()), k) && (E.normalizeContent(savedContent()).player[E.PRIZE[k]?.needs ?? k] !== false));
report('the list offers exactly the prizes that can work here, not on the ladder yet (Hierarchical: Swap and ↻ Rotate among them; no Undo)', offered().filter(Boolean).join() === workable().join() && offered().includes('rotateDots') && offered().includes('swap') && !offered().includes('undo'), offered().join());
await go('#design/stars');
const indRadio = app.find(n => n.tagName === 'INPUT' && n.attrs?.name === 'stardots' && n.parent && txt(n.parent).includes('Independent'));
indRadio.checked = true; indRadio.fire('change', { target: indRadio }); await tick(500);
await go('#design/fun');
report('under Independent the moves aren’t in the list at all (not greyed: left out)', !['swap', 'rotateDots', 'rotateKites'].some(k => offered().includes(k)) && offered().includes('kite:paint') && !app.find(n => n.tagName === 'OPTION' && n.attrs?.disabled), offered().join());

// ---- The map's first view: the central star and ring 1 ----
const fresh2 = E.newSave(content, 'Fresh').state;
const m2 = createMap();
m2.update({ state: fresh2, view: view(fresh2), content, sel: null, mode: null, dots: 'all' });
resize(); await tick(20);
const kitePts = m2.el.all(n => n.tagName === 'POLYGON' && n.attrs?.points && (n.dataset?.hit === 'kite' || cls(n, 'empty') || cls(n, 'kite'))).flatMap(n => n.attrs.points.split(' ').map(p => p.split(',').map(Number)));
const xs = kitePts.map(p => p[0]), ys = kitePts.map(p => p[1]);
const span = Math.max(...xs) - Math.min(...xs);   // the central star: 1 world unit tip to tip
report('a board with only the central star opens zoomed in to it and ring 1 (the star about a quarter of the width, not a sixth)', span > 900 * 0.2 && span < 900 * 0.3, `${Math.round(span)} px of 900`);

// ---- 9c: Spin the star ----
const sc = { ...content, rules: { ...content.rules, bonuses: { on: 'on', every: 1, ladder: ['spin', 'spin', 'kite:cut'], spin: ['hint', 'prize', 'again', 'nothing'] } } };
report('a spin can be on the ladder more than once (each other prize once)', E.normalizeContent({ ...JSON.parse(read('content/life.json')), rules: { bonuses: { on: 'on', ladder: ['spin', 'spin', 'swap', 'swap'] } } }).rules.bonuses.ladder.join() === 'spin,spin,swap');
const s0 = { ...b0, bonus: { count: 1, claimed: 1 } };
report('a claimed spin is one spin to use', E.spinsLeft(sc, s0) === 1 && E.spinsLeft(sc, b0) === 0);
report('each of the star’s six kites is an outcome in play, in turn', E.spinOutcomes(sc).join() === 'hint,prize,again,nothing,hint,prize' && E.spinOutcomes({ rules: { bonuses: { spin: ['again'] } } }).every(o => o === 'again'));
const hinted = E.spinStar(sc, s0, 0);
report('landing on a hint: one waiting for the next question, the spin used', hinted.outcome === 'hint' && hinted.state.bonus.hint === 1 && E.spinsLeft(sc, hinted.state) === 0 && E.useHint(hinted.state).bonus.hint === 0);
const early = E.spinStar(sc, s0, 1);
report('landing on the next prize: it’s ready to claim now', early.outcome === 'prize' && E.bonusStatus(sc, early.state).next === 'spin' && !E.bonusStatus(sc, s0).next);
const again = E.spinStar(sc, s0, 2);
report('landing on Spin again: another spin', again.outcome === 'again' && E.spinsLeft(sc, again.state) === 1);
report('landing on nothing: just the spin used', E.spinStar(sc, s0, 3).outcome === 'nothing' && E.spinsLeft(sc, E.spinStar(sc, s0, 3).state) === 0);
report('without a spin, nothing happens', E.spinStar(sc, b0, 0).outcome === null);
const allIn = { ...sc, rules: { ...sc.rules, bonuses: { ...sc.rules.bonuses, ladder: ['spin'] } } };
report('the next prize with nothing left to unlock is nothing', E.spinStar(allIn, s0, 1).outcome === 'nothing');
report('the spins are kept with the save', E.normalizeSave({ ...JSON.parse(read('saves/outlook.json')), state: again.state }).state.bonus.again === 1);

// The hint, in the question: one wrong choice crossed out.
const { questionSetView } = await import(`file://${ROOT}/shared/ui/questionSet.js`);
const { setValue } = await import(`file://${ROOT}/shared/engine/qset.js`);
const qset = setValue({ title: '', context: '', items: [{ id: 'q1', kind: 'choice', text: 'Which?', options: [{ text: 'A', correct: false }, { text: 'B', correct: true }, { text: 'C', correct: false }] }] });
const qv = questionSetView({ set: qset, dotId: 'dx', states: new Map(), progress: { right: 0, total: 1 }, ui: { hint: { q: 'q1', choice: 2 } } });
const crossed = qv.all(n => cls(n, 'crossed'));
report('a hint crosses out one wrong choice (it can’t be picked)', crossed.length === 1 && crossed[0].dataset.choice === '2' && crossed[0].disabled === true);

// The map: the star turns, its kites showing their outcomes under a pointer.
const m3 = createMap();
const sp = { star: Object.keys(b0.stars).find(s => !b0.stars[s].sources.length), t0: 1 };
sp.kite = b0.stars[sp.star].kites[3];
sp.icons = Object.fromEntries(b0.stars[sp.star].kites.map((k, i) => [k, ['💡', '🎁', '⟲', '·', '💡', '🎁'][i]]));
m3.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all' });
resize(); await tick(20);
m3.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all', spin: sp });
await tick(200);
const turned = () => m3.el.all(n => n.dataset?.hit === 'kite' && b0.stars[sp.star].kites.includes(n.dataset.id)).map(n => n.attrs.transform ?? '');
report('a spin: the star’s kites turn (a pinwheel), each showing its outcome, under a pointer', turned().every(t => /^rotate\(/.test(t)) && m3.el.all(n => cls(n, 'spin-icon')).length === 6 && !!m3.el.find(n => cls(n, 'spin-pointer')));
await tick(2700);
m3.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all', spin: sp });
const endAngle = Number((turned()[0].match(/rotate\(([-\d.e]+)/) ?? [])[1]);
const lay = view(b0).place(sp.star);
report('…and stops with the kite it landed on at the top (three turns and more)', endAngle >= 1080 && endAngle < 1440, String(endAngle));
const angleNow = () => { m3.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all', spin: sp }); return Number((turned()[0].match(/rotate\(([-\d.e]+)/) ?? [])[1]); };
await tick(1600);   // into the turn back (it stays 1.2 s, then turns back over 1 s)
const midBack = angleNow();
await tick(900);
const home = angleNow();
const mod = x => ((x % 360) + 360) % 360;
report('…then turns back (not a jump) to where it was', Math.abs(midBack - endAngle) > 1 && Math.abs(midBack - home) > 1 && Math.min(mod(home), 360 - mod(home)) < 0.01, `${endAngle} → ${midBack} → ${home}`);

// ---- In the app: a spin claimed, the ⟲ Spin pill, the star turning, what it landed on ----
await go('#design/fun');
const add3 = app.find(n => cls(n, 'bonus-add'));
add3.value = 'spin'; add3.fire('change', { target: add3 }); await tick(500);
{
  const rows = () => app.all(n => n.tagName === 'LI' && n.dataset?.tool);
  const ev = { preventDefault() {}, dataTransfer: { setData() {} } };
  rows().at(-1).find(n => cls(n, 'bonus-grip')).fire('dragstart', ev);
  rows()[0].fire('dragover', ev); rows()[0].fire('drop', ev); await tick(500);
}
report('a spin on the ladder, first (dragged up), and what it can land on (all four)', savedContent().rules.bonuses.ladder[0] === 'spin' && app.all(n => n.dataset?.outcome).length === 4, savedContent().rules.bonuses.ladder.join());
await go('#play'); await tick(700);
const spinPill = () => app.find(n => cls(n, 'sl-map')).find(n => n.dataset?.hit === 'pill' && n.dataset.action === 'spin');
const spinPills = () => app.find(n => cls(n, 'sl-map')).all(n => n.dataset?.hit === 'pill' && n.dataset.action === 'spin');
const shownNow = () => app.find(n => cls(n, 'sl-map')).all(n => n.dataset?.hit === 'kite' || cls(n, 'kiteless-star')).map(n => n.dataset.star ?? n.dataset.id);
report('the rung claimed is the spin: ⟲ Spin beside every star on the map at once (no kite to tap first)', !!spinPill() && spinPills().every(n => cls(n, 'star-pill')) && new Set(spinPills().map(n => n.dataset.id)).size === spinPills().length && spinPills().length >= 1, String(spinPills().length));
await tapIt(spinPill());
report('…tapping it turns the star, its kites showing what each stands for', app.find(n => cls(n, 'sl-map')).all(n => cls(n, 'spin-icon')).length === 6);
report('…no spin pills while it turns, and nothing won yet', !spinPill() && !JSON.parse(read('saves/outlook.json')).state.bonus?.spent);
await tick(2900);
report('…and once it stops, says what it landed on (what it won happens then)', /A hint|next prize|Spin again|No luck/.test(txt(els.toast ?? doc)) && JSON.parse(read('saves/outlook.json')).state.bonus?.spent === 1, txt(els.toast ?? doc).slice(0, 70));

// ---- 9d: comets and messages ----
const cc = { ...content, rules: { ...content.rules, comets: E.cleanRules({ comets: { on: 'on', messages: [
  { text: 'Two down!', when: 'ignites', n: 2 }, { text: 'Category done!', when: 'category', category: 1 }, { text: 'Hello from the sky', when: 'random' },
  { text: 'A prize comet', when: 'ladder' }, { text: '', when: 'random' }] } }).comets } };
report('comet messages are cleaned: ids, triggers, an empty one ignored', cc.rules.comets.messages.map(m => m.id).join() === 'm1,m2,m3,m4,m5' && E.cometMessages(cc).length === 4);
let cs = E.startSession(save.state);
const lit2 = Object.keys(cs.dots).filter(d => onMap0.has(d) && view(cs).effective(d).status !== 'ignited' && view(E.ignite(cs, d, 1)).effective(d).status === 'ignited').slice(0, 2);
cs = E.settleComets(cc, cs, E.ignite(cs, lit2[0], Date.now()), opts);
report('one star-dot ignited: nothing due yet', !E.nextComet(cc, cs));
cs = E.settleComets(cc, cs, E.ignite(cs, lit2[1], Date.now()), opts);
report('the second: “after 2 ignited” is due', E.nextComet(cc, cs)?.text === 'Two down!');
cs = E.cometFlown(cs, 'm1');
report('once flown, it doesn’t fly again this session', !E.nextComet(cc, cs) && !E.settleComets(cc, cs, E.ignite(cs, Object.keys(cs.dots).find(d => !lit2.includes(d)), Date.now()), opts).comets.due.includes('m1'));
const done1 = { ...cs, complete: { 1: Date.now() } };
report('a category complete: its message is due', E.settleComets(cc, cs, done1, opts).comets.due.includes('m2'));
report('now and then: a “now and then” message joins the queue', E.nextComet(cc, E.queueComet(cc, cs, 'random', 0))?.text === 'Hello from the sky');
report('a ladder comet: the next message set to come with it circles all session (not once)', E.activeComets(E.winComet(cc, cs)).map(c => c.text).join() === 'A prize comet' && !E.nextComet(cc, E.winComet(cc, cs)));
report('a new session starts the comets over', !E.startSession(cs).comets);
// The player's own note: it sets off at once and circles for the rest of this session.
const noted = E.writeNote(cs, 'Remember to rest', 'n1');
report('the player’s note circles at once, as their own prize comet', E.activeComets(noted).some(c => c.text === 'Remember to rest' && c.mine));
report('…kept for the session (with the save), gone in a new one', E.normalizeSave({ ...JSON.parse(read('saves/outlook.json')), state: noted }).state.comets.active.some(c => c.text === 'Remember to rest') && !E.startSession(noted).comets);

// The map: the comet flies behind the lattice, its message the tail; it waits under a box; then it's done.
let doneIds = [];
const m4 = createMap({ onCometDone: id => doneIds.push(id) });
const draw4 = more => m4.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all', ...more });
draw4({}); resize(); await tick(20);
draw4({ comet: { id: 'm9', text: 'Hello from the sky', mine: false }, hold: true });
await tick(100);
report('a comet waits while a box is open over the map', !m4.el.find(n => cls(n, 'comet')));
draw4({ comet: { id: 'm9', text: 'Hello from the sky', mine: false } });
await tick(300);
const cometEl = () => m4.el.find(n => cls(n, 'comet'));
const sky = m4.el.children.find(n => cls(n, 'layer-sky'));
report('then it crosses the map, its message trailing as its tail', !!cometEl() && txt(cometEl().find(n => cls(n, 'comet-text'))) === 'Hello from the sky');
report('…in the sky behind the lattice', !!sky && m4.el.children.indexOf(sky) < m4.el.children.findIndex(n => cls(n, 'layer-lattice')) && !!sky.find(n => cls(n, 'comet')));
const x0 = Number((cometEl().attrs.transform.match(/translate\(([-\d.]+)/) ?? [])[1]);
await tick(1000);
const x1 = Number((cometEl()?.attrs.transform.match(/translate\(([-\d.]+)/) ?? [])[1]);
report('…moving across', x1 > x0, `${x0} → ${x1}`);
// A comet crosses slowly (26 s): the map's clock is stood in for, to see it to the end.
const realPerf = globalThis.performance;
const t9 = realPerf.now();
globalThis.performance = { now: () => t9 + 13000 };
await tick(100);
const xHalf = Number((cometEl()?.attrs.transform.match(/translate\(([-\d.]+)/) ?? [])[1]);
report('…slowly, as if far off: half way after 13 s', Math.abs(xHalf - 450) < 200, String(xHalf));
globalThis.performance = { now: () => t9 + 27000 };
await tick(100);
globalThis.performance = realPerf;
report('…and once across, it’s done (the app marks it flown)', !cometEl() && doneIds.join() === 'm9', doneIds.join());
globalThis.matchMedia = q => ({ matches: q.includes('reduce') });
draw4({ comet: { id: 'm8', text: 'Still here', mine: true } });
await tick(200);
const xStill = Number((cometEl()?.attrs.transform.match(/translate\(([-\d.]+)/) ?? [])[1]);
await tick(600);
report('under reduce-motion it shows still, near the top', !!cometEl() && Number((cometEl()?.attrs.transform.match(/translate\(([-\d.]+)/) ?? [])[1]) === xStill && cls(cometEl(), 'mine'));
delete globalThis.matchMedia;

// ---- In the app: Design › Fun › Comets, and the player's own note on a comet ----
await go('#design/fun');
const cometsOn = app.all(n => n.tagName === 'INPUT' && n.attrs?.name === 'comets')[1];
cometsOn.checked = true; cometsOn.fire('change', { target: cometsOn }); await tick(500);
app.find(n => cls(n, 'comet-add')).fire('click'); await tick(500);
const msgInput = app.find(n => cls(n, 'comet-text-input'));
msgInput.value = 'Keep going!'; msgInput.fire('change', { target: msgInput }); await tick(500);
const when = app.find(n => cls(n, 'comet-when'));
when.value = 'ignites'; when.fire('change', { target: when }); await tick(500);
const saved9d = savedContent().rules.comets;
report('Design › Fun › Comets: a message, and when it flies (after N ignited), saved', saved9d.on === 'on' && saved9d.messages[0]?.text === 'Keep going!' && saved9d.messages[0].when === 'ignites' && !!app.find(n => n.tagName === 'INPUT' && n.attrs?.type === 'number' && n.parent && cls(n.parent, 'comet-row')), JSON.stringify(saved9d.messages));
const add4 = app.find(n => cls(n, 'bonus-add'));
add4.value = 'comet:write'; add4.fire('change', { target: add4 }); await tick(500);
{
  const rows = () => app.all(n => n.tagName === 'LI' && n.dataset?.tool);
  const ev = { preventDefault() {}, dataTransfer: { setData() {} } };
  rows().at(-1).find(n => cls(n, 'bonus-grip')).fire('dragstart', ev);
  rows()[0].fire('dragover', ev); rows()[0].fire('drop', ev); await tick(500);
}
await go('#play'); await tick(300);
const writeBtn = () => app.find(n => cls(n, 'comet-btn'));
report('Write a comet claimed (the first rung): 🌠 by the map', !!writeBtn());
const note = app.find(n => cls(n, 'comet-note'));
note.value = 'Future me: well done'; app.find(n => cls(n, 'comet-menu')).fire('submit', { preventDefault() {} }); await tick(500);
report('…a note written: the 🌠 is used', !writeBtn() && JSON.parse(read('saves/outlook.json')).state.comets?.active?.some(c => c.text === 'Future me: well done'));
await tick(300);
const mine = () => app.find(n => cls(n, 'comet') && cls(n, 'prize-comet') && cls(n, 'mine'));
report('…and it sets off at once, as a prize comet of the player’s own, trailing the words', !!mine() && txt(mine().find(n => cls(n, 'comet-text'))) === 'Future me: well done');
const xAt = () => Number((mine()?.attrs.transform.match(/translate\(([-\d.]+)/) ?? [])[1]);
const xa = xAt(); await tick(1500); const xb = xAt();
report('…circling across (it moves on)', Number.isFinite(xa) && xb !== xa, `${xa} → ${xb}`);
await go('#design/board');
globalThis.confirm = () => true;
app.find(n => n.tagName === 'BUTTON' && txt(n).startsWith('Start a new session')).fire('click'); await tick(500);
await go('#play'); await tick(400);
report('a new session: the note is gone', !mine());

// ---- The menus by the map stay in view; prize comets have their own look ----
const { placeInView } = await import(`file://${ROOT}/app/js/panels/playerPalette.js`);
globalThis.innerWidth = 800; globalThis.innerHeight = 600;
const fakeMenu = { style: {}, getBoundingClientRect: () => ({ width: 260, height: 300 }) };
placeInView({ getBoundingClientRect: () => ({ left: -40, right: -10, top: 50, bottom: 80 }) }, fakeMenu);
report('a menu opened near the left edge is moved fully into view', fakeMenu.style.position === 'fixed' && parseFloat(fakeMenu.style.left) === 8 && parseFloat(fakeMenu.style.top) === 84, JSON.stringify(fakeMenu.style));
placeInView({ getBoundingClientRect: () => ({ left: 700, right: 740, top: 50, bottom: 80 }) }, fakeMenu);
report('…and one near the right edge too', parseFloat(fakeMenu.style.left) === 800 - 260 - 8, fakeMenu.style.left);
const m5 = createMap();
m5.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all' }); resize(); await tick(20);
m5.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all', cycling: [{ id: 'm4', text: 'Prize!', mine: false }, { id: 'p:x', text: 'Mine!', mine: true }], comet: { id: 'm1', text: 'Once' } });
await tick(300);
const kinds = m5.el.all(n => cls(n, 'comet')).map(n => `${txt(n.find(x => cls(x, 'comet-text')))}:${cls(n, 'prize-comet') ? 'prize' : 'plain'}${cls(n, 'mine') ? '+mine' : ''}`).sort().join();
report('prize comets (yours and the player’s) look different from a message crossing once, and fly together', kinds === 'Mine!:prize+mine,Once:plain,Prize!:prize', kinds);

// ---- A comet with your message: offered always, its message written on its ladder row ----
report('a prize comet takes your message whether or not Comets is on', E.activeComets(E.winComet({ rules: { comets: { on: 'off', messages: [{ id: 'm1', text: 'Well played', when: 'ladder' }] } } }, b0)).map(c => c.text).join() === 'Well played');
await go('#design/fun');
const offered2 = () => app.find(n => cls(n, 'bonus-add')).all(n => n.tagName === 'OPTION').map(n => n.attrs.value);
report('Add a prize… offers A comet with your message (no message needed first)', offered2().includes('comet'));
const add5 = app.find(n => cls(n, 'bonus-add'));
add5.value = 'comet'; add5.fire('change', { target: add5 }); await tick(500);
const field = () => app.find(n => cls(n, 'ladder-comet-text'));
report('…its row has a box for the message', !!field());
field().value = 'You found the comet!'; field().fire('change', { target: field() }); await tick(500);
const ladderMsg = () => savedContent().rules.comets.messages.filter(m => m.when === 'ladder');
report('…written there, it’s kept (with Comets’ messages, “With a ladder prize”)', ladderMsg().some(m => m.text === 'You found the comet!'), JSON.stringify(ladderMsg()));
const cometRow = app.all(n => n.tagName === 'LI' && n.dataset?.tool === 'comet').at(-1);
cometRow.find(n => cls(n, 'remove-btn')).fire('click'); await tick(500);
report('…and × takes the rung and its message off together', !savedContent().rules.bonuses.ladder.includes('comet') && !ladderMsg().some(m => m.text === 'You found the comet!'), savedContent().rules.bonuses.ladder.join());

// ---- Cut out starts on Clear; the comet's tail; its paths ----
const kdCut = kiteDesigner({ design: null, color: '#ff0000', allowed: E.designerAllows(withPrizes(['kite:cut', 'kite:paint']), at(1), false) });
report('Cut out kite shapes starts with Clear as its paint', txt(kdCut.find(n => cls(n, 'seg') && cls(n, 'on') && ['Ink', 'Clear'].includes(txt(n)))) === 'Clear');
const { cometNode: cn, lane: laneOf } = await import(`file://${ROOT}/shared/ui/sky.js`);
const node = cn('A message for the sky', 100, 100, 0, { prize: true, t: 0 });
const tailPts = node.find(n => cls(n, 'comet-tail')).attrs.points.split(' ').map(p => p.split(',').map(Number));
const tailH = Math.max(...tailPts.map(p => p[1])) - Math.min(...tailPts.map(p => p[1]));
const headH = 2 * Number(node.find(n => cls(n, 'comet-glow')).attrs.r);
report('the message rides inside a tail of sparkling dust, no taller than the head', tailH <= headH && node.all(n => cls(n, 'comet-spark')).length > 20 && !node.find(n => cls(n, 'comet-banner')) && /url\(#comet-dust/.test(node.find(n => cls(n, 'comet-tail')).attrs.fill), `${tailH} ≤ ${headH}`);
const laneYs = Array.from({ length: 12 }, (_, n) => laneOf('m4', n).y);
report('each crossing takes its own height, from near the top to near the bottom', Math.min(...laneYs) < 0.35 && Math.max(...laneYs) > 0.65 && laneYs.every(y => y >= 0.06 && y <= 0.94), laneYs.map(y => y.toFixed(2)).join(' '));
report('the sky is drawn behind the stars (a comet passes behind them)', (() => { const kids = m5.el.children.map(n => n.attrs?.class); return kids.indexOf('layer-sky') < kids.indexOf('layer-stars'); })());

// ---- Prize comets: slow, then a long rest out of view between crossings ----
{
  const realPerf = globalThis.performance;
  let fake = 1e6;
  globalThis.performance = { now: () => fake };
  const m6 = createMap();
  const d6 = () => m6.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all', cycling: [{ id: 'mx', text: 'Far away', mine: false }] });
  m6.update({ state: b0, view: view(b0), content, sel: null, mode: null, dots: 'all' }); resize(); await tick(20);
  d6(); await tick(50);
  const xOf = () => Number((m6.el.find(n => cls(n, 'comet'))?.attrs.transform.match(/translate\(([-\d.]+)/) ?? [])[1]);
  const xStart = xOf();
  fake += 10000; d6(); await tick(50);
  const x10 = xOf();
  report('a prize comet sets off at once, unhurried (about 40 px a second)', Number.isFinite(xStart) && Math.abs(x10 - xStart - 400) < 5, `${xStart} → ${x10}`);
  fake += 30000; d6(); await tick(50);
  report('…once across, it rests out of view for a long while', !m6.el.find(n => cls(n, 'comet')));
  fake += 45000; d6(); await tick(50);
  report('…then comes round again', !!m6.el.find(n => cls(n, 'comet')));
  globalThis.performance = realPerf;
}

// ---- Prizes stay on the field until claimed, accumulate, and are claimed in any order ----
{
  const lc = { ...content, player: { ...content.player, rotateKites: true }, rules: { ...content.rules, bonuses: { on: 'on', every: 1, ladder: ['rotateKites', 'swap', 'rotateDots'] } } };
  let s1 = E.startSession(save.state);
  const two = Object.keys(s1.dots).filter(d => onMap0.has(d) && view(s1).effective(d).status !== 'ignited' && view(E.ignite(s1, d, 1)).effective(d).status === 'ignited').slice(0, 2);
  s1 = E.settleBonus(lc, s1, E.ignite(s1, two[0], Date.now()), opts);
  s1 = E.settleBonus(lc, s1, E.ignite(s1, two[1], Date.now()), opts);
  const st1 = E.bonusStatus(lc, s1);
  report('two rungs earned, none claimed: two prizes on the field, each remembering who earned it', st1.ready.join() === '0,1' && s1.bonus.by[0] === two[0] && s1.bonus.by[1] === two[1], JSON.stringify(s1.bonus));
  const later = E.claimBonus(lc, s1, 1);
  report('the second can be claimed first (any order)', E.earnedPlayer(lc, later).swap !== false && E.earnedPlayer(lc, later).rotateKites === false && E.bonusStatus(lc, later).ready.join() === '0');
  report('…then the first, still waiting', E.earnedPlayer(lc, E.claimBonus(lc, later, 0)).rotateKites !== false && !E.bonusStatus(lc, E.claimBonus(lc, later, 0)).ready.length);
  report('claims are kept with the save, in any order', E.normalizeSave({ ...JSON.parse(read('saves/outlook.json')), state: later }).state.bonus.got.join() === '1');
  // On the map: each in its own hole (the next nearest empty one), staying put when another is claimed.
  const m7 = createMap();
  const pz = (claimed1) => E.fieldPrizes(lc, claimed1).map(p => ({ ...p, icon: '✦' }));
  const v1 = view(s1);
  m7.update({ state: s1, view: v1, content, sel: null, mode: null, dots: 'all' }); resize(); await tick(20);
  m7.update({ state: s1, view: v1, content, sel: null, mode: null, dots: 'all', prizes: pz(s1) });
  const where = () => Object.fromEntries(m7.el.all(n => cls(n, 'prize')).map(n => [n.dataset.i, n.find(x => cls(x, 'prize-badge')).attrs.cx + ',' + n.find(x => cls(x, 'prize-badge')).attrs.cy]));
  const w0 = where();
  report('both prizes on the field, each in its own hole', Object.keys(w0).length === 2 && w0[0] !== w0[1], JSON.stringify(w0));
  m7.update({ state: later, view: view(later), content, sel: null, mode: null, dots: 'all', prizes: pz(later) });
  const w1 = where();
  report('claiming one leaves the other where it was', Object.keys(w1).join() === '0' && w1[0] === w0[0], JSON.stringify(w1));
  // A third with two holes already held near the same star-dot: the next nearest empty one.
  const t1 = new Set();
  const spots = [0, 1, 2].map(() => { const h = prizeSpot(s1, v1, two[0], t1); t1.add(h.map(v => v.toFixed(4)).join()); return h.join(); });
  report('more prizes near one star-dot take the next nearest empty holes', new Set(spots).size === 3);
}

// ---- A completed category's kites keep their design, twinkling with them ----
{
  const K = await import(`file://${ROOT}/shared/kiteDesign.js`);
  const design = K.normalizeDesign({ fills: { 0: 'dark', 3: 'none' }, lines: {} });
  const qOpts = { ...opts, questions: 'on' };
  const centralId = Object.keys(b0.stars).find(s => !b0.stars[s].sources.length);
  const cat = b0.kites[b0.stars[centralId].kites[0]].color;
  const done = { ...b0, complete: { [cat]: Date.now() } };
  const m8 = createMap();
  m8.update({ state: done, view: E.derive(done, qOpts), content, sel: null, mode: null, dots: 'all' }); resize(); await tick(20);
  m8.update({ state: done, view: E.derive(done, qOpts), content, sel: null, mode: null, dots: 'all', designs: () => design });
  const doneKites = m8.el.all(n => n.dataset?.hit === 'kite' && cls(n, 'complete'));
  const doneDesigns = m8.el.all(n => cls(n, 'kite-design') && cls(n, 'complete'));
  report('with Designs on, a completed category’s kites keep their design, twinkling in its place', doneKites.length > 0 && doneKites.every(n => cls(n, 'designed')) && doneDesigns.length === doneKites.length, `${doneKites.length} kites, ${doneDesigns.length} designs`);
  m8.update({ state: done, view: E.derive(done, qOpts), content, sel: null, mode: null, dots: 'all', designs: null });
  report('…and Solid (no designs) twinkles plain, as before', m8.el.all(n => n.dataset?.hit === 'kite' && cls(n, 'complete')).every(n => !cls(n, 'designed')) && !m8.el.find(n => cls(n, 'kite-design')));
}

// ---- The player's kite designs last for their session only ----
await go('#design/fun');
const ladOff = app.all(n => n.tagName === 'INPUT' && n.attrs?.name === 'bonuses')[0];
ladOff.checked = true; ladOff.fire('change', { target: ladOff }); await tick(500);
const savedFile = () => JSON.parse(read('saves/outlook.json'));
const designerDesigns = JSON.stringify(savedFile().designs);
await go('#play'); await tick(700);
await tapIt(app.find(n => cls(n, 'sl-map')).all(n => n.dataset?.hit === 'kite').find(n => !cls(n, 'empty')));
await tapIt(app.find(n => cls(n, 'sl-map')).find(n => n.dataset?.hit === 'pill' && n.dataset.action === 'design'));
const region = app.find(n => cls(n, 'design-sheet')).find(n => n.dataset?.region === '0');
region.fire('pointerdown', { button: 0, pointerId: 1, clientX: 0, clientY: 0, target: region, preventDefault() {} });
region.fire('pointerup', { button: 0, pointerId: 1, clientX: 0, clientY: 0, target: region }); await tick(500);
report('a design the player paints is theirs for the session (not the designer’s)', (savedFile().state.look?.designs ?? []).some(Boolean) && JSON.stringify(savedFile().designs) === designerDesigns);
doc.fire('keydown', { key: 'Escape', target: doc }); await tick(100);
await go('#design/board');
globalThis.confirm = () => true;
app.find(n => n.tagName === 'BUTTON' && txt(n).startsWith('Start a new session')).fire('click'); await tick(500);
report('…a new session clears it; the designer’s designs stay', !(savedFile().state.look?.designs ?? []).some(Boolean) && JSON.stringify(savedFile().designs) === designerDesigns);

// ---- The kite finish (Design › Look) and the starry background (Design › Fun) ----
{
  report('Kite finish is Flat and Starry background off by default', content.rules.finish === 'flat' && content.rules.starfield === 'off');
  const mk = createMap();
  const st = save.state;
  const look = (rules, more = {}) => mk.update({ state: st, view: view(st), content: { ...content, rules: { ...content.rules, ...rules } }, sel: null, mode: null, dots: 'all', ...more });
  look({}); resize(); await tick(20); look({});
  const fin = () => mk.el.all(n => cls(n, 'kite-finish'));
  report('Flat: no finish, no starfield', fin().length === 0 && !mk.el.find(n => cls(n, 'layer-starfield')));
  look({ finish: 'crystal' });
  report('Crystal: each star’s plain kites cut into lit and shaded facets, with a rim and a core; nothing of it takes clicks', fin().length > 0 && fin().every(n => n.attrs['pointer-events'] === 'none') && !!mk.el.find(n => cls(n, 'facet') && cls(n, 'lit')) && !!mk.el.find(n => cls(n, 'facet') && cls(n, 'shade')) && !!mk.el.find(n => cls(n, 'finish-rim')) && !!mk.el.find(n => cls(n, 'core-dot')));
  look({ finish: 'glass' });
  report('Glass: a gradient from each star’s center, no facets', fin().length > 0 && !!mk.el.find(n => cls(n, 'glass')) && !mk.el.find(n => cls(n, 'facet')));
  const KD = await import(`file://${ROOT}/shared/kiteDesign.js`);
  const painted = KD.normalizeDesign({ fills: { 0: 'dark', 3: 'none' }, lines: {} });
  const plainCount = mk.el.all(n => cls(n, 'glass')).length;
  look({ finish: 'glass' }, { designs: () => painted });
  report('every kite showing a design: left to its design (no finish over them)', plainCount > 0 && mk.el.all(n => cls(n, 'glass') && !cls(n.parent, 'bare')).length === 0 && mk.el.all(n => cls(n, 'kite-design')).length > 0);
  look({ starfield: 'on' });
  const sky = mk.el.find(n => cls(n, 'layer-starfield'));
  const order = [...mk.el.children].map(n => n.attrs?.class ?? '');
  report('Starry background: two depths of twinkling stars filling the sky, behind the comets and the lattice', !!sky && sky.all(n => cls(n, 'sky-depth')).length === 2 && sky.all(n => cls(n, 'sky-star')).length > 100 && order.indexOf('layer-starfield') < order.indexOf('layer-sky') && order.indexOf('layer-starfield') < order.indexOf('layer-lattice'));
}

// ---- 9e: Streaks and marks ----
{
  report('Streaks and marks is off by default (answers record nothing)', content.rules.streaks === 'off' && E.recordAnswer(content, save.state, true) === save.state);
  const on = { ...content, rules: { ...content.rules, streaks: 'on' } };
  let f0 = E.startSession(save.state);
  let f = f0;
  for (const ok of [true, true, true]) f = E.recordAnswer(on, f, ok);
  report('right answers in a row: a streak', E.funOf(f).streak === 3 && E.funOf(f).best === 3);
  f = E.recordAnswer(on, f, false);
  report('…a wrong one ends it (the best kept)', E.funOf(f).streak === 0 && E.funOf(f).best === 3);
  for (let i = 0; i < 5; i++) f = E.recordAnswer(on, f, true);
  const dots = Object.keys(f.dots).filter(d => onMap0.has(d) && view(f).effective(d).status !== 'ignited' && view(E.ignite(f, d, 1)).effective(d).status === 'ignited');
  const lit1 = E.ignite(f, dots[0], Date.now());
  const m1 = E.settleMarks(on, lit1, opts);
  report('marks: the first star-dot ignited and five in a row', E.funOf(m1).marks.join() === 'first,streak5' && E.newMarks(lit1, m1).map(m => m.name).join() === 'First light,Five in a row');
  report('…each once (settling again adds nothing)', E.settleMarks(on, m1, opts) === m1);
  let every = m1;
  for (const d of Object.keys(every.dots)) every = { ...every, dots: { ...every.dots, [d]: { ...every.dots[d], ignitedAt: every.dots[d].ignitedAt ?? 1, trained: true } } };
  const all = E.settleMarks(on, every, opts);
  report('…every star-dot lit: a whole star, halfway and every star lit', ['star', 'half', 'all'].every(m => E.funOf(all).marks.includes(m)), E.funOf(all).marks.join());
  report('…kept with the save; a new session starts them over', E.normalizeSave({ ...JSON.parse(read('saves/outlook.json')), state: m1 }).state.fun?.marks.join() === 'first,streak5' && !E.startSession(m1).fun);
  report('…none with it off', E.settleMarks(content, lit1, opts) === lit1);
  // The map: from 3 in a row the lit star-dots twinkle brighter.
  const ms = createMap();
  const ds = (n) => ms.update({ state: lit1, view: view(lit1), content, sel: null, mode: null, dots: 'all', streak: n });
  ds(2); resize(); await tick(20); ds(2);
  report('the map: no streak look under 3 in a row', !ms.el.classList.contains('streak'));
  ds(3);
  report('…from 3, the streak look', ms.el.classList.contains('streak') && ms.el.dataset.streak === '3');
  ds(12);
  report('…faster from 5 and 10', ms.el.dataset.streak === '10');
}

// ---- 9e: Nebula fog ----
{
  report('Nebula fog is off by default', content.rules.fog === 'off');
  const lone = E.newSave(content, 'Fog').state;
  const grown = save.state;
  const ringOf = st => Math.max(0, ...view(st).shownStars().filter(view(st).place).map(s => L.latticeRing(view(st).place(s).coord)));
  const mf = createMap();
  const df = (st, more = {}) => mf.update({ state: st, view: view(st), content, sel: null, mode: null, dots: 'all', fog: true, ...more });
  df(lone); resize(); await tick(20); df(lone);
  const fogEl = () => mf.el.find(n => cls(n, 'layer-fog'));
  const radius = () => Number(fogEl()?.find(n => n.tagName === 'RADIALGRADIENT' && n.attrs?.gradientUnits === 'userSpaceOnUse')?.dataset.radius);
  const order = () => [...mf.el.children].map(n => n.attrs?.class ?? '');
  report('on, the sky past the central star is fogged (over the lines, under the star-dots)', !!fogEl() && fogEl().dataset.ring === '0' && order().indexOf('layer-fog') > order().indexOf('layer-lines') && order().indexOf('layer-fog') < order().indexOf('layer-dots') && mf.el.all(n => cls(n, 'fog-puff')).length > 0);
  const r0 = radius();
  df(grown); await tick(100);
  const mid = radius();
  report('a star in a further ring: the fog clears out to it, over a moment', ringOf(grown) > 0 && fogEl().dataset.ring === String(ringOf(grown)) && mid > r0, `rings 0 → ${ringOf(grown)}, radius ${r0} → ${mid}`);
  await tick(1900); df(grown);
  report('…to past that ring’s stars', radius() > mid && radius() > ringOf(grown) * Math.hypot(...L.toPixel([1, 0])), String(radius()));
  df(grown, { fog: false });
  report('off: no fog', !fogEl());
}

// ---- 9e: Constellation reveal ----
{
  report('Constellation reveal is off by default', content.rules.reveal === 'off');
  let r0 = E.startSession(save.state);
  const pair = Object.keys(r0.dots).filter(d => onMap0.has(d) && view(r0).effective(d).status !== 'ignited' && view(E.ignite(r0, d, 1)).effective(d).status === 'ignited').slice(0, 2);
  r0 = E.addRelation(r0, pair[0], pair[1], 4);
  const r1 = E.ignite(r0, pair[0], Date.now());
  const r2 = E.ignite(r1, pair[1], Date.now());
  const m9 = createMap();
  const d9 = (st, more = {}) => m9.update({ state: st, view: view(st), content, sel: null, mode: null, dots: 'all', reveal: true, ...more });
  d9(r1); resize(); await tick(20); d9(r1);
  const lines = () => m9.el.all(n => cls(n, 'reveal-line'));
  report('one of two related star-dots ignited: no line yet', lines().length === 0);
  d9(r2); await tick(50);
  report('both ignited: a faint glowing line joins them', lines().length === 1 && lines()[0].dataset.pair === `${pair[0]}>${pair[1]}`);
  const heads = () => lines()[0].all(n => cls(n, 'reveal-head')).length;
  report('…a thin white core in sparkling dust, with an arrowhead at the end it points to', !!lines()[0].find(n => cls(n, 'reveal-core')) && !!lines()[0].find(n => cls(n, 'reveal-dust')) && lines()[0].all(n => cls(n, 'reveal-spark')).length > 0 && heads() === 1);
  report('…drawing itself as the second ignites', !!m9.el.find(n => cls(n, 'reveal-draw')));
  await tick(1600);
  d9(r2);
  report('…then it simply stays', lines().length === 1 && !m9.el.find(n => cls(n, 'reveal-draw')));
  const both = E.addRelation(r2, pair[1], pair[0], 2, 'The way back');
  d9(both);
  const mid = n => { const c = n.find(x => cls(x, 'reveal-core')).attrs; return [(+c.x1 + +c.x2) / 2, (+c.y1 + +c.y2) / 2]; };
  const apart = () => Math.hypot(mid(lines()[0])[0] - mid(lines()[1])[0], mid(lines()[0])[1] - mid(lines()[1])[1]);
  report('…related both ways: two lines side by side (a two-lane road), each with its own arrowhead', lines().length === 2 && lines().every(n => n.all(x => cls(x, 'reveal-head')).length === 1) && apart() > 4 && apart() < 7, apart().toFixed(2) + ' px apart');
  // Hover: the line sparkles; a click (not a hover) shows its label; a click elsewhere hides it.
  const hitLine = n => n.find(x => cls(x, 'rel-hit'));
  const back = () => lines().find(n => n.dataset.rel === `${pair[1]}>${pair[0]}`);
  hitLine(back()).fire('pointerover');
  report('hovering a relation line highlights it with sparkling dust', back().classList.contains('hover') && back().all(x => cls(x, 'shine-fleck')).length > 0 && !m9.el.find(n => cls(n, 'rel-label')));
  m9.el.fire('pointerleave');
  report('…gone when the pointer leaves', !back().classList.contains('hover') && !back().find(x => cls(x, 'rel-shine')));
  const clickOn = n => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0, target: n }; n.fire('pointerdown', e); n.fire('pointerup', e); };
  clickOn(hitLine(back()));
  const label = () => m9.el.find(n => cls(n, 'rel-label'));
  const words = () => label()?.all(n => n.tagName === 'TEXT').map(n => n.textContent).join(' ') ?? '';
  report('clicking it shows its label: who relates to whom, and its words', !!label() && words().includes('The way back') && words().includes('→'), words());
  d9(both);
  report('…kept as the map redraws', !!label());
  clickOn(m9.el);
  report('…a click elsewhere hides it', !label());
  d9(r2, { reveal: false });
  report('with the switch off, no lines', lines().length === 0);
  d9(r2, { layer: 'constellation' });
  report('…nor under the relations layer (it draws its own)', lines().length === 0);
  d9(both, { layer: 'constellation', reveal: false });
  const arrows = () => m9.el.all(n => cls(n, 'rel') && [`${pair[0]}>${pair[1]}`, `${pair[1]}>${pair[0]}`].includes(n.dataset.rel));
  const amid = n => { const c = n.find(x => x.tagName === 'LINE').attrs; return [(+c.x1 + +c.x2) / 2, (+c.y1 + +c.y2) / 2]; };
  report('the layer’s arrows both ways: side by side too', arrows().length === 2 && Math.hypot(amid(arrows()[0])[0] - amid(arrows()[1])[0], amid(arrows()[0])[1] - amid(arrows()[1])[1]) > 3, arrows().length + ' arrows ' + arrows().map(n => JSON.stringify(amid(n))).join(' '));
  const ar = arrows().find(n => n.dataset.rel === `${pair[0]}>${pair[1]}`);
  ar.find(x => cls(x, 'rel-hit')).fire('pointerover');
  report('…hovered, one sparkles', arrows().filter(n => n.find(x => cls(x, 'rel-shine'))).length === 1);
  clickOn(arrows().find(n => n.dataset.rel === `${pair[0]}>${pair[1]}`).find(x => cls(x, 'rel-hit')));
  report('…clicked, its label (no words: says so)', !!label() && words().includes('No description'), words());
}
