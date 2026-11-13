// Stage 3: a content set's own word for a star-dot: cleaned as it loads, and said everywhere the
// app writes text (shared/dom.js term: plural, capitals, "a" / "an").

import { test, assertEqual } from '../runner.js';
import { cleanTerms, cleanRules, RULES, engineRules, ENGINE_RULE_KEYS, QUIZ_DEFAULTS } from '../../shared/engine/index.js';
import { setTerms, term } from '../../shared/dom.js';

test('stage 3: a content set’s word for a star-dot, cleaned: star-dot unless set; the plural follows', () => {
  assertEqual([cleanTerms(), cleanTerms({ stardot: '  task ' }), cleanTerms({ stardot: 'person', stardots: 'people' }), cleanTerms({ stardot: 7 })],
    [{ stardot: 'star-dot', stardots: 'star-dots' }, { stardot: 'task', stardots: 'tasks' }, { stardot: 'person', stardots: 'people' }, { stardot: 'star-dot', stardots: 'star-dots' }]);
});

test('stage 3: the app says it with that word: plurals, capitals, “a” and “an”; off for star-dot', () => {
  setTerms({ stardot: 'task', stardots: 'tasks' });
  assertEqual(term('Star-dots per star: a star-dot’s star holds 24 star-dots. Star-dot 3.'), 'Tasks per star: a task’s star holds 24 tasks. Task 3.');
  setTerms({ stardot: 'item', stardots: 'items' });
  assertEqual(term('A star-dot, and a star-dot.'), 'An item, and an item.');
  setTerms({ stardot: 'star-dot' });
  assertEqual(term('a star-dot'), 'a star-dot');
  setTerms(null);
  assertEqual(term('Star-dots'), 'Star-dots');
});

test('stage 3: every rule is declared once: cleaned with its default, the engine’s ones passed on', () => {
  const clean = cleanRules({});
  assertEqual(RULES.every(r => JSON.stringify(clean[r.key]) === JSON.stringify(r.default)), true, 'defaults');
  assertEqual(cleanRules({ kites: 'nowhere', perStar: 7, goalAfter: -1 }).kites, 'all', 'an unknown value takes the default');
  assertEqual(Object.keys(engineRules(clean)).sort(), [...ENGINE_RULE_KEYS].sort());
  assertEqual(['fade', 'twinkle', 'lattice'].some(k => ENGINE_RULE_KEYS.includes(k)), false, 'the looks aren’t engine options');
  assertEqual(Object.keys(QUIZ_DEFAULTS).includes('locks'), false);
});
