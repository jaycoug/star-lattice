// A star-dot's screen (shared/ui/starDotScreen.js) as the app shows it: the overlay over any view
// (main.js), and the back of a card in the Deck view (panels/deck.js). One place for what the host
// passes: Edit mode edits; Play mode follows Design › Player (a.allow); the layout's setter.

import { starDotScreen } from '../../shared/ui/starDotScreen.js';

/**
 * The screen of `dotId`. `open` shows another star-dot (a related one); `back` steps back (null:
 * no ← Back). The screen's view state is the app's one (ui.sdsUi).
 */
export function screenFor(st, a, dotId, { edit, open = a.openRelated, replace = a.openInstead, back = null, closed = {} } = {}) {
  return starDotScreen({
    state: st.state, view: st.ev, content: st.content, dotId, edit,
    change: a.change, act: a.act, ui: a.ui().sdsUi, setUi: a.setSdsUi, open, replace,
    back, backLabel: '← Back', now: Date.now(),
    remove: edit ? a.deleteStarDot : null,                        // Delete…: Edit mode only
    retire: a.locked() || !a.allow('retire') ? null : a.retire,   // Retire, where the player may
    allow: a.allow,                                               // What Play mode shows (Design › Player)
    setLayout: a.setSharedLayout,                                 // The widgets' layout for every screen (Edit mode)
    closed,                                                       // The host's words for a question closed now
  });
}
