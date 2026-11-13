// The star-dot screen's widgets and where they sit: two columns, each a list of widgets top to
// bottom. A widget in neither column is switched off. The content set keeps one layout for every
// screen (content.layout); a star-dot can keep its own (dot.layout in the save), which the screen
// uses instead until Reset. The designer arranges them in Edit mode; the player sees the result.

export const WIDGETS = ['checklist', 'notes', 'assessor', 'attributes', 'relevance'];
export const WIDGET_NAMES = { checklist: 'Checklist', notes: 'Notes', assessor: 'Assessor', attributes: 'Attributes', relevance: 'Relevance Information' };
export const DEFAULT_LAYOUT = Object.freeze({ columns: Object.freeze([Object.freeze(['checklist', 'notes', 'assessor']), Object.freeze(['attributes', 'relevance'])]) });

/** A layout, cleaned: two columns of known widgets, each at most once; anything unreadable is the default. */
export function cleanLayout(raw) {
  const cols = raw?.columns;
  if (!Array.isArray(cols)) return { columns: DEFAULT_LAYOUT.columns.map(c => [...c]) };
  const seen = new Set();
  const columns = [0, 1].map(i => (Array.isArray(cols[i]) ? cols[i] : []).filter(w => WIDGETS.includes(w) && !seen.has(w) && seen.add(w)));
  return { columns };
}

/** The widgets switched off (in neither column), in WIDGETS order. */
export const hiddenWidgets = layout => WIDGETS.filter(w => !layout.columns.some(c => c.includes(w)));

/** `id` moved to column `col`, before widget `before` (null: at the column's end). */
export function moveWidget(layout, id, col, before = null) {
  const columns = layout.columns.map(c => c.filter(w => w !== id));
  const at = before == null ? -1 : columns[col].indexOf(before);
  columns[col].splice(at < 0 ? columns[col].length : at, 0, id);
  return { columns };
}

/** `id` switched off. */
export const hideWidget = (layout, id) => ({ columns: layout.columns.map(c => c.filter(w => w !== id)) });

/** `id` switched on again, at the end of the shorter column. */
export const showWidget = (layout, id) => moveWidget(layout, id, layout.columns[1].length < layout.columns[0].length ? 1 : 0);

/** Whether two layouts place the same widgets the same way. */
export const sameLayout = (a, b) => JSON.stringify(a?.columns) === JSON.stringify(b?.columns);
