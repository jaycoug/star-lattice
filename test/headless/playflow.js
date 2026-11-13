// Usage: gjs -m playflow.js <copy of the project>: PLAY on the copy's save. The fade (the content
// set's rule); star-dots hidden until a kite is selected (U5); a tap selects a star-dot and shows its
// pills, Open and Deploy / Withdraw (round 8, X7), nothing drawn for a star before it's deployed
// (X5); no Needs retraining (U19); Retire, the Retired bank, Open ↗ and Restore (U7, U8); deploying,
// moves, the board rules; the animation (a deployed star grows from its star-dot, X6).
import { GLib } from './node-gi.js';
import System from './node-gi.js';
import { install, tick, readFile } from './fakedom.js';
const ROOT = System.programArgs[0];
const { els, doc, resize } = install(ROOT, '/app/');
let hash = '#play';
const winListeners = {};
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; (winListeners.hashchange ?? []).forEach(f => f()); } };
globalThis.history = { replaceState(_, __, h) { hash = h; } };
globalThis.scrollTo = () => {};
globalThis.addEventListener = (t, f) => { (winListeners[t] ??= []).push(f); };
globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] ?? []).filter(x => x !== f); };
const read = f => readFile(ROOT, f);   // a content set as the open save plays it (P10)
const E = await import(`file://${ROOT}/shared/engine/index.js`);
const content = E.normalizeContent(JSON.parse(read('content/life.json')));
const loaded = E.normalizeSave(JSON.parse(read('saves/outlook.json')));
const state = loaded.state;
const ev = E.derive(state, { ...E.optionsFrom(content), share: loaded.share, now: Math.floor(Date.now() / 60000) * 60000 });
await import(`file://${ROOT}/app/js/main.js`);
await tick(200); resize(); await tick(50);
const app = els.app;
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const cls = (n, c) => (n.attrs?.class ?? '').split(' ').includes(c);
const report = (what, ok, extra = '') => print(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  — ' + extra : ''}`);
const map = () => app.find(n => cls(n, 'sl-map'));
const hits = kind => map().all(n => n.dataset?.hit === kind);
const card = () => app.find(n => cls(n, 'play-card'));
const btn = (label, root = app) => root.find(n => n.tagName === 'BUTTON' && text(n).startsWith(label));
const tap = async el => { const e = { button: 0, pointerId: 1, clientX: 0, clientY: 0 }; el.fire('pointerdown', e); el.fire('pointerup', e); await tick(50); };
const press = async el => { el.fire('click'); await tick(450); };   // past the 0.4 s autosave
const save = () => JSON.parse(read('saves/outlook.json')).state;
const sheet = () => app.find(n => cls(n, 'sds-sheet'));

// The fade (the content set's rule, round 8): a kite with no progress, and one partly done, as kiteFill says.
const { kiteFill } = await import(`file://${ROOT}/shared/color.js`);
const fadeRule = content.rules.fade;
const kitePolys = () => hits('kite');
const fillOf = k => kitePolys().find(n => n.dataset.id === k)?.attrs.fill;
// Kites with star-dots (an empty one is a dashed outline, round 14: Z14).
const openShown = ev.shownStars().flatMap(s => state.stars[s].kites).filter(k => ev.kiteOpen(k) && state.kites[k].color != null && state.kites[k].dots.some(Boolean));
const fresh = openShown.find(k => ev.kiteProgress(k) === 0);
const partly = openShown.find(k => ev.kiteProgress(k) > 0 && ev.kiteProgress(k) < 4);
report(`a kite with no progress is colored by the fade rule (${fadeRule})`, !fresh || fillOf(fresh) === kiteFill(content.categories[state.kites[fresh].color].color, 1, fadeRule), fresh ? fillOf(fresh) : 'none on this save');
report('a kite with some progress too', !partly || fillOf(partly) === kiteFill(content.categories[state.kites[partly].color].color, 1 + ev.kiteProgress(partly), fadeRule), partly ? fillOf(partly) : 'none on this save');

// U5 and the stage-2 decision: nothing selected, no star-dots and no stored outlines; round 14 (Z17):
// except those with a Due date that aren't complete, drawn always, twinkling faster the sooner they're due.
const { dueSpeed } = await import(`file://${ROOT}/shared/ui/map.js`);
const onMap = ev.shownStars().flatMap(s => state.stars[s].kites).flatMap(k => state.kites[k].dots).filter(Boolean);
const dueOnes = onMap.filter(x => dueSpeed(ev, x));
report('PLAY opens with no star-dots drawn (layer Off) but those due and not complete (Z17)', hits('slot').length === 0 && hits('dot').length === dueOnes.length && hits('dot').every(n => dueOnes.includes(n.dataset.id)),
  `${hits('dot').length} dots, ${dueOnes.length} due`);
report('…each twinkling by how soon: Fast within a day (or overdue), Normal 3 days, Slow a week, Very slow beyond (Z17)', hits('dot').every(n => n.dataset.due === dueSpeed(ev, n.dataset.id) && cls(n, 'due') && cls(n, `due-${n.dataset.due}`))
  && dueOnes.every(x => { const days = (Date.parse(ev.prop(x, 'due') + 'T23:59:59') - Date.now()) / 864e5; return dueSpeed(ev, x) === (days <= 1 ? 'fast' : days <= 3 ? 'normal' : days <= 7 ? 'slow' : 'veryslow'); }),
  [...new Set(hits('dot').map(n => n.dataset.due))].join(', ') || 'none due on this save');
report('…and a complete one with a Due date doesn’t twinkle', onMap.filter(x => ev.prop(x, 'due') && ev.effective(x).status === 'ignited').every(x => !dueSpeed(ev, x)));
{
  // The rule itself, on made-up dates (the save's own may not cover every case): due at the end of its day.
  const NOW = Date.parse('2026-11-07T12:00:00');
  const stub = (due, status) => ({ prop: () => due, effective: () => ({ status }), opts: { now: NOW } });
  // (noon on Nov 7: today's end is 0.5 days off, Nov 8's 1.5, Nov 9's 2.5, Nov 10's 3.5, Nov 13's 6.5, Nov 14's 7.5)
  const cases = [['2026-11-01', 'open', 'fast'], ['2026-11-07', 'open', 'fast'], ['2026-11-08', 'open', 'normal'], ['2026-11-09', 'training', 'normal'],
    ['2026-11-10', 'open', 'slow'], ['2026-11-13', 'open', 'slow'], ['2026-11-14', 'open', 'veryslow'], ['2026-11-07', 'ignited', null], ['2026-11-07', 'empty', null], [null, 'open', null]];
  const got = cases.map(([due, status]) => dueSpeed(stub(due, status), 'x'));
  report('…the rule on made-up dates: overdue and within a day Fast, 3 days Normal, a week Slow, beyond Very slow; complete (or nothing to do) none', cases.every(([, , want], i) => got[i] === want), got.join(','));
}
{
  const css = read('shared/ui/map.css');
  report('…its symbol fades to clear and back (1.3, 2.6, 5.2, 10.4 s), only without reduce-motion', /@keyframes sl-due \{[^@]*50% \{ opacity: 0; \}/.test(css)
    && ['fast { animation-duration: 1300ms', 'normal > :not(title):not(.dot-hit):not(.dot-ring) { animation-duration: 2600ms', 'slow > :not(title):not(.dot-hit):not(.dot-ring) { animation-duration: 5200ms', 'veryslow > :not(title):not(.dot-hit):not(.dot-ring) { animation-duration: 10400ms'].every(t => css.includes(t.replace('fast {', 'fast > :not(title):not(.dot-hit):not(.dot-ring) {')))
    && /@media \(prefers-reduced-motion: no-preference\) \{\s*\.sl-map \.dot\.due/.test(css));
}
report('no stored-star outlines while nothing is selected', hits('star').length === 0, `${hits('star').length} outlines`);
report('the overview has no Needs retraining list (U19)', !text(card()).includes('Needs retraining'));
const R0 = state.retired.filter(e => state.dots[e.id]).length;
const bankDots = () => app.all(n => cls(n, 'retired-dot'));
const detail = () => app.find(n => cls(n, 'retired-detail'));
report('the overview ends with the Retired bank: a dot per retired star-dot, no details until one is clicked (W5)', text(card()).includes(`Retired · ${R0}`) && bankDots().length === R0 && !detail(), `${R0} retired`);
// Round 8 (W2): before any change, a star blocked on disk is already withdrawn as the save opens.
{
  const b0 = ev.blocked[0];
  if (b0) {
    const at0 = E.index(state).dot.get(b0.dot);
    await tap(hits('kite').find(n => n.dataset.id === at0.kite)); await tap(hits('dot').find(n => n.dataset.id === b0.dot));
    report('as the save opens, a deployed star whose position is taken is already withdrawn (planned, with the reason)', /planned\. It can’t deploy here/.test(text(card())), text(card()).slice(0, 120));
    await press(app.find(n => cls(n, 'card-close')) ?? card().find(n => n.tagName === 'BUTTON'));
  } else report('withdrawn as the save opens (none blocked on this save)', true, 'skipped');
}

// A star-dot on the map whose star isn't (planned, or stored), preferably one whose star would sit
// where no lattice is drawn yet (so the lattice not growing shows): its kite, then it.
const central = E.centralStar(state);
const L = await import(`file://${ROOT}/shared/lattice.js`);
const reached = c => ev.shownStars().some(s => L.distance(ev.place(s).coord, c) <= 1);
const unreached = d => { const p = ev.place(state.dots[d].branch).coord; return [p, ...L.neighbors(p)].filter(c => !reached(c)).length; };
const choices = ev.shownStars().flatMap(s => state.stars[s].kites).flatMap(k => state.kites[k].dots.filter(Boolean).map(d => ({ k, d })))
  .filter(({ d }) => { const b = state.dots[d].branch; return b && state.stars[b] && !ev.shown(b) && ev.place(b); });
const candidate = choices.find(({ d }) => unreached(d) > 0) ?? choices[0];
report('the save has a star-dot whose star isn’t on the map (for the next steps)', !!candidate, candidate ? state.dots[candidate.d].name : '');
const { k, d } = candidate;
await tap(kitePolys().find(n => n.dataset.id === k));
const shownDots = [...hits('dot'), ...hits('slot')].filter(n => (n.dataset.kite ?? E.index(state).dot.get(n.dataset.id)?.kite) === k);
report('tapping a kite shows its four star-dots, and only those (and the due ones elsewhere)', shownDots.length === 4 && hits('dot').every(n => state.kites[k].dots.includes(n.dataset.id) || dueOnes.includes(n.dataset.id)), `${shownDots.length} shown`);
report('an empty slot is a very small filled dot, no ring (Z13)', hits('slot').every(n => n.children.some(c => cls(c, 'dot-slot')) && !n.children.some(c => cls(c, 'dot-empty'))), `${hits('slot').length} empty slots`);
const dotEl = () => hits('dot').find(n => n.dataset.id === d);
const pills = () => hits('pill');
const pill = action => pills().find(n => n.dataset.action === action);
const pillText = n => text(n.find(c => c.tagName?.toLowerCase() === 'text'));
// Round 14 (Z12): a selected kite's pills: ↻ Rotate, ⟳ (Rotate kites), Swap kite… and 🖌 (its design), as Design › Player gives them (P3).
const moves = E.playerMoves(content.player, false);
report('a selected kite has pills beside it: ↻ Rotate, Swap kite… and 🖌 its design, as the player’s Movement gives (Z12, P3)', pills().every(n => n.dataset.id === k)
  && pills().map(n => n.dataset.action).join() === [moves.rotateDots && 'rotate', moves.rotateKites && 'rotateKites', moves.swap && 'swapKite', 'design'].filter(Boolean).join()
  && pillText(pill('design')) === '🖌', `${pills().map(pillText).join(' · ')}`);
report('…and its card shows 🖌 in place of Design…', !!card().find(n => n.tagName === 'BUTTON' && text(n) === '🖌' && n.attrs['aria-label'] === 'Design…') && !btn('Design…', card()));
if (pill('rotate')) {
  const before = save().kites[k].dots.join();
  await tap(pill('rotate')); await tick(400);
  report('the ↻ Rotate pill rotates it (saved), the kite still selected', save().kites[k].dots.join() !== before && pills().some(n => n.dataset.action === 'design'));
  doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
}
// Z14: Swap kite… (Free): an empty kite's outline becomes a target where the swap is allowed (a
// central kite swaps within the central star; others between any stars but the central one).
if (pill('swapKite')) {
  const empties = () => map().all(n => cls(n, 'kite') && cls(n, 'empty'));
  const starOf = kk => Object.values(save().stars).find(x => x.kites.includes(kk));
  const where = kk => { const x = starOf(kk); return x ? `${x.id}:${x.kites.indexOf(kk)}` : null; };
  const c0 = E.centralStar(save()).id;
  // A kite can't swap into a star deployed from its own star-dots, or one below those (it would hold its own star).
  const below = (kk, star) => { for (let s = star, n = 0; s && n < 99; n++) { const d = save().stars[s]?.sources[0]; const at = d && E.index(save()).dot.get(d); if (!at) return false; if (at.kite === kk) return true; s = starOf(at.kite)?.id; } return false; };
  const may = (a, b) => { const [x, y] = [starOf(a)?.id, starOf(b)?.id]; return (x === y || (x !== c0 && y !== c0)) && !below(a, y) && !below(b, x); };
  report('with nothing being swapped, empty kites take no taps', empties().every(n => !n.dataset.hit));
  // A kite with star-dots that some empty kite may swap with (else the selected one).
  const src = hits('kite').map(n => n.dataset.id).find(kk => empties().some(n => may(kk, n.dataset.id))) ?? k;
  await tap(kitePolys().find(n => n.dataset.id === src));
  await tap(pill('swapKite'));
  const live = empties().filter(n => n.dataset.hit === 'kite');
  const allowed = empties().filter(n => may(src, n.dataset.id));
  report('Swap kite…: the empty kites it may swap with become targets, the rest stay inert (Z14)', live.length === allowed.length && live.every(n => allowed.includes(n) && cls(n, 'target')), `${live.length} of ${empties().length}`);
  if (live.length) {
    const other = live[0].dataset.id;
    const [w0, w1] = [where(src), where(other)];
    await tap(live[0]); await tick(400);
    report('…and tapping one swaps the kite with it (saved)', where(src) === w1 && where(other) === w0, `${w0} ⇄ ${w1}`);
    doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
    report('…undoable', where(src) === w0);
  } else report('…swapping into an empty kite (none allowed on this save)', true, 'skipped');
  // A central kite (k) may only swap within the central star: empty kites elsewhere stay inert.
  await tap(kitePolys().find(n => n.dataset.id === k));
  await tap(pill('swapKite'));
  const liveC = empties().filter(n => n.dataset.hit === 'kite');
  report('…from a central kite, only empty kites on the central star open (Z14)', liveC.every(n => may(k, n.dataset.id)) && empties().filter(n => !may(k, n.dataset.id)).every(n => !n.dataset.hit && !cls(n, 'target')),
    `${liveC.length} open, ${empties().filter(n => !may(k, n.dataset.id)).length} elsewhere`);
  doc.fire('keydown', { key: 'Escape', target: doc }); await tick(60);
  await tap(kitePolys().find(n => n.dataset.id === k));
}
await tap(pill('design'));
report('the 🖌 pill opens the design editor over PLAY', !!app.find(n => cls(n, 'design-sheet')));
await press(app.find(n => cls(n, 'design-sheet')).find(n => cls(n, 'sds-sheet-close')));
await tap(kitePolys().find(n => n.dataset.id === k));
await tap(dotEl());
report('tapping a star-dot selects it: its card, no screen (U4)', !sheet() && text(card()).includes(state.dots[d].name) && !!btn('Open ↗', card()) && !!btn('Retire', card()), text(card()).slice(0, 80));
report('…and pills beside it (X7): ↗ Open (Z15), and Deploy exactly when its card offers Deploy its star', !!pill('open') && pillText(pill('open')) === '↗' && pills().every(n => n.dataset.id === d)
  && !!pill('deploy') === !!btn('Deploy its star', card()) && !!pill('withdraw') === !!btn('Withdraw its star', card()), pills().map(n => n.dataset.action).join(', '));
report('nothing is drawn for its star before it’s deployed (X5): no outline, no faint kites', map().all(n => cls(n, 'preview-star') || cls(n, 'stored') || cls(n, 'preview')).length === 0 && hits('star').length === 0);
const place = ev.place(state.dots[d].branch).coord;
const onlyIts = [place, ...L.neighbors(place)].filter(c => !reached(c)).map(c => c.join(','));
const posAt = new Set(hits('pos').map(n => n.dataset.coord));
report('…nor does the lattice grow around where it would go', onlyIts.every(c => !posAt.has(c)), `${place.join(',')}; ${onlyIts.length} points only it would reach`);
report('its kite’s star-dots stay shown while it is selected', hits('dot').some(n => n.dataset.id === d));
report('no lattice point is marked: no faced-position circles, no lines to stars further out (W6, W1)', map().all(n => cls(n, 'faced') || cls(n, 'outward-link') || cls(n, 'pending')).length === 0
  && hits('pos').every(n => n.children.filter(c => c.tagName === 'circle').every(c => !cls(c, 'faced'))));
await tap(dotEl());
report('a second tap keeps it selected, with no screen (X7)', !sheet() && !!pill('open'));
await tap(pill('open'));
report('the Open pill opens its screen', !!sheet() && text(sheet()).includes(state.dots[d].name));
await press(app.find(n => cls(n, 'sds-sheet-close')));
report('× closes it, back on PLAY', !sheet() && !!map());

// Retire, the bank, Open ↗ (read-only), Restore.
const at = E.index(state).dot.get(d);
await press(btn('Retire', card()));
let sv = save();
report('Retire takes it out of its slot into the Retired bank (saved)', sv.kites[at.kite].dots[at.slot] === null && sv.retired[0]?.id === d);
report('the card returns to the overview, and the bank has a dot for it, first', text(card()).includes(`Retired · ${R0 + 1}`) && bankDots()[0]?.dataset.id === d && !detail());
report('its star is no longer drawn', map().all(n => cls(n, 'preview-star')).length === 0 && hits('star').length === 0);
await press(bankDots()[0]);
report('clicking its dot shows its details under the dots: name, where from, Open ↗, Restore (Delete… is Edit mode’s, P3)', !!detail() && text(detail()).includes(state.dots[d].name)
  && ['Open ↗', 'Restore'].every(l => !!btn(l, detail())) && !btn('Delete…', detail()) && cls(bankDots()[0], 'on'));
await press(bankDots()[0]);
report('clicking it again hides them', !detail());
await press(bankDots()[0]);
await press(btn('Open ↗', detail()));
report('Open ↗ shows its screen, read-only, with no Retire or Deploy (no status line, P1)', !!sheet() && !sheet().find(n => cls(n, 'editable')) && !btn('Retire', sheet()) && !btn('Deploy its star', sheet()) && !text(sheet()).includes('Restore it from'));
await press(app.find(n => cls(n, 'sds-sheet-close')));
await press(btn('Restore', detail()));
sv = save();
report('Restore puts it back in its old slot (saved); its dot and details go', sv.kites[at.kite].dots[at.slot] === d && sv.retired.length === R0 && text(card()).includes(`Retired · ${R0}`) && !detail() && !bankDots().some(n => n.dataset.id === d));

// Round 7 (V1, V3, V4): nothing deploys by itself; Deploy its star and Withdraw on the card; free moves; Bring to the Zenith; Fixed board.
{
  const ZEN = E.ZENITH;
  const savedState = () => JSON.parse(read('saves/outlook.json')).state;
  const kitesOnMap = () => map().find(n => cls(n, 'layer-stars')).all(n => cls(n, 'kite')).length;   // round 14: empty kites too (inert, Z14)
  // The save's own deployed stars are on the map (round 7 started with only the central star; the developer has deployed more since).
  const K0 = kitesOnMap();
  report('the map opens with the deployed stars only (six kites each)', K0 === 6 * ev.shownStars().length, `${K0} kites, ${ev.shownStars().length} stars`);
  // Round 14 (Z14): a kite with no star-dots is a dashed outline, unfilled and inert.
  const emptyKites = map().all(n => cls(n, 'kite') && cls(n, 'empty'));
  const shownKites = ev.shownStars().flatMap(s => state.stars[s].kites).filter(x => !ev.kiteless(state.kites[x] && E.index(state).kite.get(x).star));
  report('a kite with no star-dots is a dashed outline, unfilled, not clickable (Z14)', emptyKites.length === shownKites.filter(x => state.kites[x].dots.every(y => !y)).length
    && emptyKites.every(n => n.attrs.fill === 'none' && n.attrs['pointer-events'] === 'none' && !n.dataset.hit), `${emptyKites.length} empty kites`);
  // The plain .kite rule strokes kites in the background's color, so the empty outline has to take its color
  // from the stylesheet (--kite-stroke), or it's invisible until it lights up as a swap target.
  report('…its outline drawn in its color, visible always, not only while swapping', /\.sl-map \.kite\.empty \{[^}]*stroke: var\(--kite-stroke/.test(read('shared/ui/map.css'))
    && read('shared/ui/map.js').includes("style: { '--kite-stroke': color"));
  const tapKite = async kk => tap(hits('kite').find(n => n.dataset.id === kk));
  const tapDot = async dd => tap(hits('dot').find(n => n.dataset.id === dd));
  // A central Zenith star-dot with a star: a planned one, else a deployed one, withdrawn first (the
  // developer deploys their central stars; withdrawing takes its branch along, deploying brings it back).
  const withStar = central.kites.map(kk => ({ kk, dd: state.kites[kk].dots[ZEN] })).filter(x => x.dd && state.stars[state.dots[x.dd].branch]);
  const zen = withStar.find(x => !state.stars[state.dots[x.dd].branch].deployed) ?? withStar.find(x => ev.shown(state.dots[x.dd].branch));
  report('a central Zenith star-dot with a star (for the next steps)', !!zen, zen && state.dots[zen.dd].name);
  const star = state.dots[zen.dd].branch;
  await tapKite(zen.kk); await tapDot(zen.dd);
  if (state.stars[star].deployed) { await press(btn('Withdraw its star', card())); await tapKite(zen.kk); await tapDot(zen.dd); }
  const K1 = kitesOnMap();   // without its star (and its branch)
  report('selecting it offers Deploy its star, and says its star is planned', !!btn('Deploy its star', card()) && text(card()).includes('planned'));
  await press(btn('Deploy its star', card()));
  report('Deploy its star puts it on the map (saved), with its kites (and its branch, as it was)', savedState().stars[star].deployed === true && kitesOnMap() === (state.stars[star].deployed ? K0 : K1 + 6), `${K1} → ${kitesOnMap()} kites`);
  report('its card now offers Withdraw its star', !!btn('Withdraw its star', card()) && !btn('Deploy its star', card()));

  // P1: the card has no Swap… or Swap kite… (the map's Swap kite… pill and dragging move things;
  // free moves between stars are the engine's boardMove, tested in test/shared/arrangement.test.js).
  const other = central.kites.find(kk => kk !== zen.kk && state.kites[kk].dots[0]);
  const mover = state.kites[other].dots[0];
  await tapKite(other);
  report('under Free, a kite’s card has no Swap… or Swap kite… buttons (P1)', !btn('Swap…', card()) && !btn('Swap kite…', card()) && !!pill('swapKite'));

  // X4: no Bring to the Zenith (↻ Rotate does it).
  await tapKite(other); await tapDot(mover);
  report('the star-dot’s card has no ↥ Zenith (X4)', !btn('↥', card()));

  // Withdraw.
  await tapKite(zen.kk); await tapDot(zen.dd);
  await press(btn('Withdraw its star', card()));
  report('Withdraw its star takes it off the map (saved)', savedState().stars[star].deployed === false && kitesOnMap() === K1);

  // P3: Design › Player › Movement with Swap off: no swaps in Play mode, only ↻ Rotate.
  location.hash = '#design/player'; await tick(100);
  const swapBox = () => app.find(n => n.tagName === 'INPUT' && n.dataset?.player === 'swap');
  swapBox().checked = false; swapBox().fire('change', { target: swapBox() }); await tick(450);
  report('Design › Player › Swap off is saved with the content set', JSON.parse(read('content/life.json')).player.swap === false);
  location.hash = '#play'; await tick(100); resize(); await tick(50);
  await tapKite(other);
  const before = savedState().kites[other].dots;
  report('with Swap off, a kite’s card offers no Swap… and no ↥, only ↻ Rotate', !btn('Swap…', card()) && !card().find(n => n.tagName === 'BUTTON' && text(n).startsWith('↥')) && !!btn('↻ Rotate', card()));
  await press(btn('↻ Rotate', card()));
  report('…which works there', savedState().kites[other].dots.join() === [before[3], before[0], before[1], before[2]].join());
  doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
  location.hash = '#design/player'; await tick(100);
  swapBox().checked = true; swapBox().fire('change', { target: swapBox() }); await tick(450);
  location.hash = '#play'; await tick(100); resize(); await tick(50);
}

// The layers still show star-dots as before (zoom, or every one in the constellation view).
await press(app.find(n => n.tagName === 'BUTTON' && text(n) === 'Constellation'));
report('the Constellation layer shows star-dots everywhere', hits('dot').length > 4, `${hits('dot').length} dots`);

// Round 7 (V12): moves animate on PLAY's map: mid-move the star-dots carry a transform easing from
// their old place, the map takes no taps, and at the end everything is drawn plainly; round 8 (X6):
// a star deployed (from its pill) grows from its star-dot, one withdrawn shrinks back into it;
// nothing moves with reduce-motion.
{
  const moving = () => map().all(n => n.attrs?.transform);
  const kk = central.kites.find(k => save().kites[k].dots.filter(Boolean).length >= 2);
  await tap(hits('kite').find(n => n.dataset.id === kk));
  const rotate = btn('↻ Rotate', card());
  rotate.fire('click'); await tick(40);
  const kiteDots = save().kites[kk].dots.filter(Boolean);
  report('↻ Rotate animates: mid-move its star-dots ease in from their old places', moving().some(n => n.dataset?.hit === 'dot' && kiteDots.includes(n.dataset.id)), `${moving().length} moving`);
  const selectedBefore = text(card());
  await tap(hits('kite').find(n => n.dataset.id !== kk));
  report('…the map takes no taps while it moves', text(card()) === selectedBefore);
  await tick(400);
  report('…and at the end everything is drawn plainly', moving().length === 0 && !map().find(n => n.attrs?.opacity && n.dataset?.hit));
  doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
  report('undo puts them back, and ends plainly', moving().length === 0 && save().kites[kk].dots.join() === state.kites[kk].dots.join());

  const planned = central.kites.map(k => save().kites[k].dots[E.ZENITH]).concat(central.kites.flatMap(k => save().kites[k].dots))
    .find(d => d && save().dots[d].branch && save().stars[save().dots[d].branch] && !save().stars[save().dots[d].branch].deployed);
  if (planned) {
    const pk = E.index(save()).dot.get(planned).kite;
    const starKites = save().stars[save().dots[planned].branch].kites;
    await tap(hits('kite').find(n => n.dataset.id === pk)); await tap(hits('dot').find(n => n.dataset.id === planned));
    const scaleOf = n => Number(/scale\(([\d.e-]+)\)/.exec(n.attrs?.transform ?? '')?.[1] ?? 1);
    const srcAt = hits('dot').find(n => n.dataset.id === planned);
    await tap(pill('deploy')); await tick(40);
    const growing = map().all(n => cls(n, 'kite')).filter(n => starKites.includes(n.dataset.id));
    report('the Deploy pill deploys it, and its six kites grow from the star-dot (X6)', growing.length === 6 && growing.every(n => scaleOf(n) < 1 && /translate\(/.test(n.attrs.transform)), growing.map(n => scaleOf(n).toFixed(2)).join(','));
    await tick(400);
    report('…to full size, drawn plainly', save().stars[save().dots[planned].branch].deployed === true && map().all(n => cls(n, 'kite')).filter(n => starKites.includes(n.dataset.id)).every(n => !n.attrs.transform));
    await tap(hits('kite').find(n => n.dataset.id === pk)); await tap(hits('dot').find(n => n.dataset.id === planned));
    report('its pills now offer Withdraw', !!pill('withdraw') && !pill('deploy'));
    await tap(pill('withdraw')); await tick(40);
    const leaving = map().find(n => cls(n, 'layer-leaving'));
    // Its own six kites, and those of any deployed star below it (they leave the map with it).
    report('the Withdraw pill: its kites shrink back into the star-dot, drawn apart (no longer tappable)', !!leaving && leaving.attrs['pointer-events'] === 'none'
      && starKites.every(kk => leaving.all(n => cls(n, 'kite')).some(n => n.dataset.id === kk)) && leaving.all(n => cls(n, 'kite')).length % 6 === 0 && leaving.all(n => cls(n, 'kite')).every(n => scaleOf(n) < 1)
      && !map().find(n => cls(n, 'layer-stars')).find(n => n.dataset?.hit === 'kite' && starKites.includes(n.dataset.id)));
    await tick(400);
    report('…and are gone', !map().find(n => cls(n, 'layer-leaving')) && !hits('kite').some(n => starKites.includes(n.dataset.id)) && !!srcAt);
  } else report('Deploy / Withdraw grow and shrink (no planned central star on this save)', true, 'skipped');

  globalThis.matchMedia = q => ({ matches: q.includes('reduce') });
  await tap(hits('kite').find(n => n.dataset.id === kk));
  btn('↻ Rotate', card()).fire('click'); await tick(40);
  const still = moving().length;
  await tick(450);
  report('with reduce-motion, the move is drawn at once', still === 0 && save().kites[kk].dots.join() !== state.kites[kk].dots.join(), `${still} moving`);
  delete globalThis.matchMedia;
  doc.fire('keydown', { key: 'z', ctrlKey: true, target: doc }); await tick(450);
}

// Round 8: the layers are Off · Constellation (W4); stars deploy only at a free faced position (W1),
// and a deployed star whose position is taken was withdrawn as the save opened (W2).
{
  const layerBtns = app.find(n => n.attrs?.['aria-label'] === 'Layer')?.all(n => n.tagName === 'BUTTON').map(text) ?? [];
  report('the layer switch is Off · Constellation (no Relations)', layerBtns.join() === 'Off,Constellation', layerBtns.join());
  await press(btn('Off', app.find(n => n.attrs?.['aria-label'] === 'Layer')));
  const blockedAtLoad = ev.blocked;   // the real save as it is on disk: the stars that sat outward before round 8
  report('the save’s stars whose faced position is taken are withdrawn (saved with the first change)', blockedAtLoad.every(b => save().stars[b.star].deployed === false),
    blockedAtLoad.map(b => state.dots[b.dot].name).join('; ') || 'none on this save');
  const b = blockedAtLoad[0];
  if (b) {
    const at = E.index(state).dot.get(b.dot);
    await tap(hits('kite').find(n => n.dataset.id === at.kite)); await tap(hits('dot').find(n => n.dataset.id === b.dot));
    report('its star-dot’s card offers no Deploy its star and says what’s in the way', !btn('Deploy its star', card()) && /can’t deploy here: .*(taken by|central star|ring 1)/.test(text(card())), text(card()).slice(0, 160));
    report('its planned star isn’t outlined on top of the star in its way', hits('star').length === 0 && map().all(n => cls(n, 'preview-star')).length === 0);
  } else report('a blocked star-dot’s card (none on this save)', true, 'skipped');
}
