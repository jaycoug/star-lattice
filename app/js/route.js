// Where the app is: a view (Star, Tree, Deck, Schedule) in a mode (Edit or Play), or Design or
// Help. It lives in the address, so a reload or a bookmark comes back to it:
//   Edit mode:  #star  #tree  #deck  #schedule  #design[/subtab]  #help
//   Play mode:  #play (the Star view)  #play/tree  #play/deck  #play/schedule  #play/help
// Older addresses still work: #rearrange (and MATERIALS' older names) is #tree, #govern[/subtab] is
// #design[/subtab]. No address at all is Edit mode's Star view. In a play version (edition.js) every
// address is Play mode's: an Edit mode one leads to the same view there, Design to the Star view.

import { PLAY } from './edition.js';

export const VIEWS = [
  { id: 'star', label: 'Star' },
  { id: 'tree', label: 'Tree' },
  { id: 'deck', label: 'Deck' },
  { id: 'schedule', label: 'Schedule' },
];

const RENAMED = {
  rearrange: 'tree', materials: 'tree', dissect: 'tree', stars: 'tree', arrangement: 'tree', 'central-star': 'tree',
  lineage: 'tree', 'item-dependencies': 'tree', 'task-hierarchy': 'tree', 'starfield-expansion': 'play',
  govern: 'design', lab: 'design',
};
const PAGES = ['star', 'tree', 'deck', 'schedule', 'design', 'help'];

/** The address as { mode, page, sub }: page is a view's id, 'design' or 'help'; sub is Design's subtab. */
export function route(hash = globalThis.location?.hash ?? '') {
  const [first = '', second = ''] = hash.replace(/^#/, '').split('/');
  const head = RENAMED[first] ?? first;
  if (head === 'play') return { mode: 'play', page: PAGES.includes(second) && second !== 'design' ? second : 'star', sub: '' };
  if (PLAY) return { mode: 'play', page: PAGES.includes(head) && head !== 'design' ? head : 'star', sub: '' };
  return { mode: 'edit', page: PAGES.includes(head) ? head : 'star', sub: head === 'design' ? second : '' };
}

/** The address for a page in a mode (Design is Edit mode's only). */
export function address(mode, page, sub = '') {
  if (mode === 'play') return page === 'star' ? '#play' : `#play/${page}`;
  return '#' + page + (sub ? '/' + sub : '');
}

/** An older address rewritten to its new form (so the bar shows where it is), or null. */
export function canonical(hash = globalThis.location?.hash ?? '') {
  const first = hash.replace(/^#/, '').split('/')[0];
  if (PLAY && first !== 'play') { const r = route(hash); return address(r.mode, r.page); }   // The play version's addresses
  if (!RENAMED[first] || RENAMED[first] === 'play') return null;
  const r = route(hash);
  return address(r.mode, r.page, r.sub);
}
