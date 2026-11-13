// The content set's rules, declared once. Each rule says what it's called, its values and
// their short names, what each value does (GOVERN's help dropdown: verb first), which GOVERN subtab it's on and
// whether it's folded under Advanced, when it applies, whether changing it starts a new session,
// and whether the engine reads it. From this list come:
// - cleaning a content set's rules as it loads (cleanRules; formats.js normalizeContent),
// - the engine options a content set gives (engineRules; formats.js optionsFrom; derive's cache),
// - GOVERN's Stars, Questions and Look controls (app/js/panels/rules.js).
// Adding a rule is one entry here (plus its default in model.js DEFAULT_OPTIONS, for the engine's
// own tests, if the engine reads it).

import { LOCKS, PER_STAR } from './model.js';
import { FADES, TWINKLES, LATTICES } from '../color.js';
import { cleanMessage } from './comets.js';

export const KITES_IN = ['all', 'central'];
export const STARDOT_MODELS = ['hierarchical', 'independent'];
export const DEPLOY_MODES = ['hand', 'auto'];
export const WRONG_MODES = ['retry', 'wait'];
/** What a spin of the star can land on (9c): Design › Fun picks which are in play. */
export const SPIN_OUTCOMES = ['hint', 'prize', 'again', 'nothing'];

const choice = (values, fallback) => v => (values.includes(v) ? v : fallback);

/**
 * The rules. `values` with `names` (short labels) and `details` (what each does, for ?), or a
 * `type` with its own control ('perStar' and 'twinkle' as segmented buttons, 'wrong' and
 * 'goalAfter' as their own). `radio` is the radio group's name (kept from before, for the checks).
 */
export const RULES = [
  // ---- Stars ----
  {
    key: 'kites', group: 'stars', label: 'Kites in', radio: 'kites-in', engine: true, quiz: true,
    values: KITES_IN, default: 'all',
    names: { all: 'All stars', central: 'Central star only' },
    details: { all: 'Gives every star six kites of four star-dots.', central: 'Gives only the central star kites; every other star holds its star-dots on six spokes.' },
    help: 'Sets which stars have kites.',
  },
  {
    key: 'stardots', group: 'stars', label: 'Star-dots', radio: 'stardots', engine: true, quiz: true,
    values: STARDOT_MODELS, default: 'hierarchical',
    names: { hierarchical: 'Hierarchical', independent: 'Independent' },
    details: { hierarchical: 'Nests each star-dot’s children on its own star; their progress rolls up to it.', independent: 'Lines each category up as one ordered list that fills its stars in turn; every star-dot stands alone.' },
    help: 'Sets how star-dots relate to each other.',
  },
  {
    key: 'perStar', group: 'stars', label: 'Star-dots per star', type: 'perStar', engine: true, quiz: true, newSession: true,
    values: PER_STAR, default: 24,
    appliesWhen: r => r.kites === 'central', whyNot: 'Only for stars without kites (Kites in: Central star only); with kites, each star holds 24.',
    help: 'Sets how many star-dots a kite-less star holds: 6 fills the tips; each step adds a ring further in. Changing it starts a new session.',
  },
  {
    key: 'deploy', group: 'stars', label: 'Deploy', radio: 'deploy', engine: true, quiz: true,
    values: DEPLOY_MODES, default: 'hand',
    names: { hand: 'By hand', auto: 'Automatically' },
    details: { hand: 'Offers Deploy on a completed tip (Zenith).', auto: 'Deploys the star as soon as its tip is completed or answered.' },
    help: 'Sets how a new star reaches the map (only where its kite faces a free position).',
  },
  {
    key: 'locks', group: 'stars', label: 'Kites lock', radio: 'locks', engine: true,
    values: LOCKS, default: 'off',
    names: { off: 'Off', on: 'On' },
    details: { off: 'Opens every kite from the start.', on: 'Opens only a new star’s back kite; two ignited star-dots on an open kite open its neighbors. A locked kite can’t be completed, and nothing moves on PLAY but ↻ Rotate.' },
    appliesWhen: r => r.kites !== 'central', whyNot: 'With Kites in: Central star only, nothing locks.',
    help: 'Sets whether kites start closed and open as the player progresses.',
  },
  // ---- Questions ----
  {
    key: 'questions', group: 'questions', label: 'Quiz mode', radio: 'questions', engine: true, quiz: true,
    values: ['off', 'on'], default: 'off',
    names: { off: 'Off', on: 'On' },
    details: { off: 'Completes a star-dot by a click (○) or by assessment (□, in its screen’s Assessor).', on: 'Makes every star-dot a question that opens in a popout on PLAY; answering all of it right ignites it.' },
    help: 'Turns every star-dot into a question answered on the map.',
  },
  {
    key: 'wrong', group: 'questions', label: 'After a wrong answer', type: 'wrong', engine: true, quiz: true,
    default: { mode: 'retry', minutes: 5 },
    help: 'Sets what follows a wrong answer. Retry now lets the player try again at once; Wait closes that question for the minutes given. The right answer is never revealed; the explanation and the chosen option’s feedback are.',
  },
  {
    key: 'shuffleChoices', group: 'questions', label: 'Shuffle choices', radio: 'shuffleChoices', engine: true, quiz: true,
    values: ['off', 'on'], default: 'off',
    names: { off: 'Off', on: 'On' },
    details: { off: 'Shows choices in the order written (unless a question asks to shuffle).', on: 'Reorders the choices on every attempt; “All of the above” and choices that cite letters stay put.' },
    help: 'Sets the order of a question’s choices.',
  },
  {
    key: 'shuffleQuestions', group: 'questions', label: 'Shuffle the questions', radio: 'shuffleQuestions', engine: true, quiz: true, newSession: true,
    values: ['off', 'on'], default: 'off',
    names: { off: 'Off', on: 'On' },
    details: { off: 'Places each category’s star-dots in list order.', on: 'Reorders each category’s star-dots every session; the list keeps your order.' },
    appliesWhen: r => r.stardots === 'independent', whyNot: 'Only under Star-dots: Independent (Stars): a hierarchy’s star-dots stay where you put them.',
    help: 'Sets the order star-dots come onto the field. Changing it starts a new session.',
  },
  {
    key: 'goalAfter', group: 'questions', label: 'Goal question', type: 'goalAfter', engine: true, quiz: true,
    default: 0,
    help: 'Makes one unanswered star-dot twinkle after this many correct answers in a category; answering it completes the category. 0 turns the goal off.',
  },
  // ---- Look ----
  {
    key: 'fade', group: 'look', label: 'Kite colors by progress', radio: 'fade',
    values: FADES, default: 'darken',
    names: { darken: 'Darken as they complete', brighten: 'Brighten as they complete', none: 'No fade' },
    details: { darken: 'Fades a kite from full color to dark gray as it completes.', brighten: 'Brightens a kite from dark gray to full color as it completes.', none: 'Keeps every kite in full color.' },
    help: 'Sets how a kite’s color follows its progress.',
  },
  {
    key: 'twinkle', group: 'look', label: 'Twinkle speed', type: 'twinkle', advanced: true,
    values: Object.keys(TWINKLES), default: 'normal',
    names: { veryslow: 'Very slow', slow: 'Slow', normal: 'Normal', fast: 'Fast' },
    help: 'Sets how fast a completed category twinkles (one fade out and back). The system’s reduce-motion setting stops it.',
  },
  // ---- Schedule ----
  {
    key: 'day', group: 'schedule', label: 'Schedule hours', type: 'dayRange',
    default: { start: 6, end: 22 },
    help: 'Sets the hours each day of the Schedule view shows; blocks are planned and moved only within them.',
  },
  {
    key: 'lattice', group: 'look', label: 'Background lattice', radio: 'lattice', advanced: true,
    values: LATTICES, default: 'shown',
    names: { shown: 'Shown', hidden: 'Hidden' },
    details: { shown: 'Draws faint lines and points around the stars.', hidden: 'Hides them; a position’s point shows only under the pointer.' },
    help: 'Shows or hides the background grid of positions stars can deploy into.',
  },
  {
    key: 'finish', group: 'look', label: 'Kite finish', radio: 'finish',
    values: ['flat', 'crystal', 'glass'], default: 'flat',
    names: { flat: 'Flat', crystal: 'Crystal', glass: 'Glass' },
    details: {
      flat: 'Kites in plain color, as before.',
      crystal: 'Each kite cut into two facets, lit from the upper left, with a bright rim; a glowing core where a star\u2019s kites meet.',
      glass: 'Each star lit from its center, its kites fading toward their tips, with a bright rim; a glowing core where its kites meet.',
    },
    help: 'Gives the stars a material on the Star view. A kite showing a design (painted or cut out) is drawn as its design, untouched.',
  },
  // ---- Fun (P9, the Star view) ----
  {
    key: 'bursts', group: 'fun', label: 'Bursts', radio: 'bursts',
    values: ['off', 'on'], default: 'on',
    names: { off: 'Off', on: 'On' },
    details: { off: 'Ignites star-dots quietly.', on: 'Bursts a star-dot as it ignites (bigger at a Zenith); a star whose every star-dot is ignited goes supernova.' },
    help: 'Celebrates progress on the Star view. The system’s reduce-motion setting stops it.',
  },
  {
    key: 'reveal', group: 'fun', label: 'Constellation reveal', radio: 'reveal',
    values: ['off', 'on'], default: 'off',
    names: { off: 'Off', on: 'On' },
    details: { off: 'Draws no lines between star-dots on the Star view.', on: 'Joins two related star-dots with a thin white line in sparkling dust once both are ignited; the line draws itself as the second one ignites.' },
    help: 'Reveals the board\u2019s constellations as the player progresses (it needs related star-dots: + Add relation on a star-dot\u2019s screen).',
  },
  {
    key: 'fog', group: 'fun', label: 'Nebula fog', radio: 'fog',
    values: ['off', 'on'], default: 'off',
    names: { off: 'Off', on: 'On' },
    details: { off: 'The whole sky shows from the start.', on: 'A drifting nebula hides the sky beyond the outermost star; it clears ring by ring as stars reach further out.' },
    help: 'Makes the board something to explore, in Play mode: the empty sky past the stars is fogged, and each star deployed into a new ring clears the fog to it. It never hides a star or a star-dot.',
  },
  {
    key: 'starfield', group: 'fun', label: 'Starry background', radio: 'starfield',
    values: ['off', 'on'], default: 'off',
    names: { off: 'Off', on: 'On' },
    details: { off: 'A plain dark sky.', on: 'A field of twinkling stars fills the whole sky behind the board, in two depths that drift past slower than the board as it pans.' },
    help: 'A backdrop for the Star view (behind the comets and the stars). With Nebula fog on, the fog dims it past the outermost star.',
  },
  {
    key: 'streaks', group: 'fun', label: 'Streaks and marks', radio: 'streaks',
    values: ['off', 'on'], default: 'off',
    names: { off: 'Off', on: 'On' },
    details: { off: 'No streaks or marks.', on: 'Right answers in a row make the lit star-dots twinkle brighter (from 3 in a row); marks are earned for the first star-dot ignited, five in a row, a whole star, halfway and every star-dot lit.' },
    help: 'Rewards steady progress in Play mode. A wrong answer ends a streak. Marks show by the map and last the session; a new session starts them over.',
  },
  {
    key: 'bonuses', group: 'fun', label: 'Bonus ladder', type: 'bonuses',
    default: { on: 'off', every: 3, ladder: [], spin: ['hint', 'prize', 'again', 'nothing'] },
    help: 'Makes prizes something the player earns: every few star-dots ignited earns the next one on the ladder, claimed by clicking it on the Star view. A tool on the ladder is locked until then; the kite designer’s prizes and the palettes are only ever earned (one not on the ladder isn’t offered). Edit mode is never locked.',
  },
  {
    key: 'comets', group: 'fun', label: 'Comets', type: 'comets',
    default: { on: 'off', messages: [] },
    help: 'Sends your messages across the Star view on comets, each trailing behind as its tail, once a session: after a number of star-dots ignited, when a category is complete, now and then, or as a bonus-ladder prize, which then circles the sky for the rest of the session. Under reduce-motion a message shows in place.',
  },
];

export const RULE = Object.fromEntries(RULES.map(r => [r.key, r]));
/** The order rules are written in a content set (as before stage 3, so files don't reorder); GOVERN shows them in RULES' order. */
const STORED = ['locks', 'fade', 'twinkle', 'lattice', 'kites', 'stardots', 'perStar', 'deploy', 'questions', 'wrong', 'goalAfter', 'shuffleChoices', 'shuffleQuestions'];
const ORDERED = [...STORED.map(k => RULE[k]), ...RULES.filter(r => !STORED.includes(r.key))];

/** One rule's value, cleaned: anything missing or unknown takes its default. */
export function cleanRule(rule, v) {
  if (rule.type === 'wrong') {
    const minutes = Number(v?.minutes);
    return { mode: WRONG_MODES.includes(v?.mode) ? v.mode : rule.default.mode, minutes: Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 ? minutes : rule.default.minutes };
  }
  if (rule.type === 'dayRange') {
    const [start, end] = [Number(v?.start), Number(v?.end)];
    return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 24 && start < end ? { start, end } : { ...rule.default };
  }
  if (rule.type === 'bonuses') {
    const every = Number(v?.every);
    // Each prize once, but a spin (9c) as often as it's put there.
    const seen = new Set();
    const repeats = ['spin', 'comet', 'comet:write'];   // prizes that can be on the ladder more than once
    const ladder = Array.isArray(v?.ladder) ? v.ladder.filter(k => typeof k === 'string' && (repeats.includes(k) || !seen.has(k)) && seen.add(k)).slice(0, 40) : [];
    const spin = Array.isArray(v?.spin) ? SPIN_OUTCOMES.filter(o => v.spin.includes(o)) : [];
    return { on: v?.on === 'on' ? 'on' : 'off', every: Number.isInteger(every) && every >= 1 && every <= 99 ? every : rule.default.every, ladder, spin: spin.length ? spin : [...SPIN_OUTCOMES] };
  }
  if (rule.type === 'comets') {
    const messages = (Array.isArray(v?.messages) ? v.messages : []).slice(0, 40).map(cleanMessage);
    const ids = new Set();
    for (const [i, m] of messages.entries()) { if (ids.has(m.id)) m.id = `m${Math.max(0, ...messages.map(x => Number(x.id.slice(1)) || 0)) + 1 + i}`; ids.add(m.id); }
    return { on: v?.on === 'on' ? 'on' : 'off', messages };
  }
  if (rule.type === 'goalAfter') {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 999 ? n : rule.default;
  }
  return choice(rule.values, rule.default)(v);
}

/** A content set's rules, cleaned (every rule present). */
export const cleanRules = (raw = {}) => Object.fromEntries(ORDERED.map(r => [r.key, cleanRule(r, raw?.[r.key])]));

/** The rules the engine reads, from a content set's (cleaned) rules. */
export const ENGINE_RULE_KEYS = RULES.filter(r => r.engine).map(r => r.key);
export const engineRules = rules => Object.fromEntries(ENGINE_RULE_KEYS.map(k => [k, rules?.[k] ?? RULE[k].default]));

/** Round 9's quiz settings (Stars and Questions), cleaned; kept for the checks and older callers. */
export const QUIZ_DEFAULTS = Object.fromEntries(ORDERED.filter(r => r.quiz).map(r => [r.key, r.default]));
export const quizRules = (raw = {}) => Object.fromEntries(ORDERED.filter(r => r.quiz).map(r => [r.key, cleanRule(r, raw?.[r.key])]));

/** Whether a rule applies under these rules (a greyed-out control says why not). */
export const ruleApplies = (rule, rules) => !rule.appliesWhen || rule.appliesWhen(rules);
