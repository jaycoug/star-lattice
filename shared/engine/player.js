// What the player may do: the designer's switches (Design › Player), kept in the content set as
// `player` beside its rules. Declared once here, as rules.js declares the rules: each switch has a
// key, the group it shows under, a label, a verb-first help line, and its default. The defaults
// allow what PLAY allowed before the design / play split, so nothing a player had goes away.
// Play mode follows them (allows); Edit mode allows everything.

/** The groups, in the order Design › Player shows them. */
export const PLAYER_GROUPS = [
  { id: 'views', label: 'Views' },
  { id: 'star', label: 'Star view' },
  { id: 'move', label: 'Movement' },
  { id: 'screen', label: 'Star-dot screen' },
  { id: 'tree', label: 'Tree view' },
  { id: 'session', label: 'Sessions' },
];

const on = (key, group, label, help, value = true) => ({ key, group, label, help, values: [true, false], default: value });

export const PLAYER = [
  on('star', 'views', 'Star', 'Shows the Star view to the player.'),
  on('tree', 'views', 'Tree', 'Shows the Tree view to the player.', false),
  on('deck', 'views', 'Deck', 'Shows the Deck view to the player (under Independent only).', false),
  {
    key: 'schedule', group: 'views', label: 'Schedule', values: ['none', 'view', 'full'], default: 'none',
    names: { none: 'Hidden', view: 'View only', full: 'Full editing' },
    help: 'Sets what the player can do with the Schedule view: nothing, see and open the planned blocks, or plan their own.',
  },
  on('undo', 'star', 'Undo', 'Gives the player ↶ Undo and ↷ Redo for the whole session (never a bonus-ladder prize).'),
  on('kiteLook', 'star', 'Kites: Solid | Designs', 'Lets the player switch the kites between plain colors and their designs.'),
  on('layer', 'star', 'Layer: Off | Constellation', 'Lets the player switch to the constellation view of relations.'),
  on('kiteDesign', 'star', 'Kite designer (🖌)', 'Lets the player paint kite designs (always for every kite of a category). With a bonus ladder, its prizes decide instead.'),
  on('palette', 'star', 'Palette (🎨)', 'Gives the player a palette menu that recolors their own board in Play mode; the designer’s colors stay the default. With a bonus ladder, its prizes decide instead.', false),
  on('card', 'star', 'Side card', 'Shows the card for what’s selected beside the map.'),
  on('retire', 'star', 'Retire', 'Lets the player take a star-dot off the map into the Retired bank.'),
  on('retired', 'star', 'Retired bank and Restore', 'Shows the Retired bank, and lets the player restore from it.'),
  on('goal', 'star', 'Goal line', 'Shows “Goal: find the twinkling star-dot” in the quiz panel.'),
  on('waits', 'star', 'Waiting countdowns', 'Shows the countdowns after a wrong answer in the quiz panel.'),
  on('swap', 'move', 'Swap star-dots and kites', 'Lets the player drag a star-dot onto another (or an empty slot), and a kite onto another.'),
  on('rotateDots', 'move', 'Rotate star-dots', 'Gives the player ↻ Rotate: a kite’s star-dots move one place around it.'),
  on('rotateKites', 'move', 'Rotate kites', 'Gives the player ⟳ Rotate kites: a star’s kites move one place around it, with their star-dots and branches.', false),
  on('name', 'screen', 'Name', 'Shows a star-dot’s name at the top of its screen.'),
  on('description', 'screen', 'Description', 'Shows a star-dot’s description.'),
  on('checklist', 'screen', 'Checklist items', 'Shows the checklist of its children.'),
  on('assessor', 'screen', 'Assessor questions', 'Shows the Assessor, where its questions are answered.'),
  on('progress', 'screen', 'Assessor progress bar', 'Shows how far through its questions the player is.'),
  on('markAssessed', 'screen', 'Mark assessed', 'Lets the player complete a □ star-dot that has no questions.'),
  on('due', 'screen', 'Due dates', 'Shows due dates among the attributes.'),
  on('attributes', 'screen', 'Kind and the other attributes', 'Shows the attribute fields (kind, money, travel…).'),
  on('notesRead', 'screen', 'Reading notes', 'Shows the notes.'),
  on('notesWrite', 'screen', 'Writing notes', 'Lets the player add and edit notes.', false),
  on('relevance', 'screen', 'Relevance Information', 'Shows the related star-dots.'),
  on('addRelation', 'screen', '+ Add relation', 'Lets the player relate two star-dots.', false),
  on('describeRelation', 'screen', 'Describing how they relate', 'Lets the player write how two star-dots relate.', false),
  on('move', 'tree', 'Moving items', 'Lets the player pick an item up and put it somewhere else.', false),
  on('shelf', 'tree', 'The shelf', 'Lets the player set items aside on the shelf (with Moving items on).', false),
  on('rename', 'tree', 'Renaming', 'Lets the player rename items.', false),
  on('lists', 'tree', 'Editing the lists (Independent)', 'Lets the player reorder, add and delete list items.', false),
  on('newSession', 'session', 'Start a new session…', 'Lets the player clear their progress and start again.'),
];

export const PLAYER_KEY = Object.fromEntries(PLAYER.map(p => [p.key, p]));
export const PLAYER_DEFAULTS = Object.fromEntries(PLAYER.map(p => [p.key, p.default]));

/** A content set's player switches, cleaned: anything missing or unknown takes its default. */
export const cleanPlayer = (raw = {}) => Object.fromEntries(PLAYER.map(p => [p.key, p.values.includes(raw?.[p.key]) ? raw[p.key] : p.default]));

/**
 * What the player may do, as a test: allows(player, edit)(key) is true in Edit mode, and in Play
 * mode when the switch is on (Schedule: anything but Hidden).
 */
export const allows = (player, edit) => key => edit || (player?.[key] ?? PLAYER_KEY[key]?.default) !== false && (player?.[key] ?? PLAYER_KEY[key]?.default) !== 'none';

/** The player's movement (engine movesOf) from the switches; the designer's in Edit mode. */
export const playerMoves = (player, edit) => (edit ? { swap: true, rotateDots: true, rotateKites: true, design: true }
  : { swap: allows(player, false)('swap'), rotateDots: allows(player, false)('rotateDots'), rotateKites: allows(player, false)('rotateKites') });
