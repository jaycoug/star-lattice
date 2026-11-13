// MATERIALS › Import questions…: a question file (question-format.md) read from a
// .md file or pasted, previewed, then imported in one undoable step. The preview lists the file's
// errors (with line numbers) and each set: its questions, its target and where it goes (an
// existing star-dot, or one it creates), or why it can't; a set with no target gets a star-dot
// picked here. Replace or Append decides what happens to a star-dot that already has questions.
// Export questions… writes every set in the save as one file, each with its target, to import again.

import { h, notify } from '../dom.js';
import * as E from '../../../shared/engine/index.js';

const button = (label, onclick, props = {}) => h('button', { type: 'button', class: 'text-btn small', onclick, ...props }, label);

/** The two buttons in MATERIALS' tools. */
export function questionTools(st, a) {
  return h('span', { class: 'q-tools' },
    button('Import questions…', () => a.openImport(), { class: 'text-btn small q-import-btn', title: 'Bring in a question file (Markdown, question-format.md): its sets go to the star-dots their targets name' }),
    button('Export questions…', () => download(st, a), { class: 'text-btn small q-export-btn', title: 'Every star-dot’s questions as one file, each set with its target' }));
}

function download(st, a) {
  const md = a.exportQuestions();
  if (!md) return void notify('No star-dot has questions yet.');
  try {
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    const link = h('a', { href: url, download: `${st.save.title || 'questions'}-questions.md` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) { notify(`Couldn’t export: ${err.message}`, 'error'); }
}

/** A star-dot's place, for the preview: "Statistics › Problem set › 1.". */
const where = (st, d) => E.pathOf(st.state, d, st.content.categories, st.ev).join(' › ');

export function importSheet(st, a) {
  const imp = a.ui().qImport;
  // Plain questions or the Markdown format; sets without a target go into one
  // picked star-dot each, or (A new star-dot per question) one new star-dot per question under a picked one.
  const parsed = imp.text ? E.readQuestions(imp.text) : { sets: [], errors: [], plain: false };
  const untargeted = parsed.sets.some(s => !s.target.trim());
  const independent = st.ev.opts?.stardots === 'independent';
  const unders = independent
    ? E.centralStar(st.state).kites.map(k => [k, st.content.categories[st.state.kites[k].color]?.name ?? 'Category'])
    : [...E.index(st.state).dot.keys()].map(d => [d, where(st, d)]).sort((x, y) => x[1].localeCompare(y[1]));
  const splitting = untargeted && imp.where === 'split';
  const underPath = splitting && imp.under && (independent ? unders.find(([k]) => k === imp.under)?.[1] : E.pathOf(st.state, imp.under, st.content.categories, st.ev).join(' > '));
  const sets = underPath ? parsed.sets.flatMap(s => (s.target.trim() ? [s] : E.splitSet(s, underPath))) : parsed.sets;
  const plan = parsed.errors.length || (splitting && !underPath) ? [] : E.planImport(st.state, st.ev, sets, st.content.categories, { picks: splitting ? {} : imp.picks ?? {} });
  const ok = plan.filter(r => !r.problem);
  const questions = ok.reduce((n, r) => n + r.count, 0);
  const anyHas = ok.some(r => r.dot && st.state.dots[r.dot].assessment);
  const file = h('input', {
    type: 'file', accept: '.md,.markdown,.txt,text/markdown,text/plain', hidden: true,
    onchange: async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      try { a.setImport({ text: await f.text(), name: f.name, picks: {}, where: null, under: null }); } catch (err) { notify(`Couldn’t read that file: ${err.message}`, 'error'); }
    },
  });
  const paste = h('textarea', {
    class: 'sds-input q-import-text', rows: imp.text ? 6 : 10, spellcheck: 'false', 'aria-label': 'Paste a question file',
    placeholder: '1. Which organelle makes ATP?\nA) Ribosome\nB) Mitochondrion\nAnswer: B\nExplanation: (optional)\n\n2. The function that loads a data set is ____.\nAnswer: data',
    onchange: e => a.setImport({ text: e.target.value, name: '', picks: {}, where: null, under: null }),
  });
  paste.value = imp.text ?? '';
  const choices = () => [...E.index(st.state).dot.keys()].filter(d => !st.ev.children(d).length).map(d => [d, where(st, d)]).sort((x, y) => x[1].localeCompare(y[1]));
  const rowFor = r => {
    const set = sets[r.set];
    const has = r.dot && st.state.dots[r.dot].assessment;
    const dest = r.problem
      ? (set.target.trim() ? h('span', { class: 'q-problem' }, r.problem) : h('select', {
        class: 'q-pick', 'aria-label': `The star-dot for ${set.title || `set ${r.set + 1}`}`,
        onchange: e => a.setImport({ picks: { ...imp.picks, [r.set]: e.target.value || undefined } }),
      }, h('option', { value: '' }, 'Choose its star-dot…'), choices().map(([d, label]) => h('option', { value: d }, label))))
      : r.dot ? [where(st, r.dot), has ? h('span', { class: 'sds-muted' }, ` (has ${E.questionsOf(has).length} ${E.questionsOf(has).length === 1 ? 'question' : 'questions'}: ${imp.mode === 'append' ? 'appended to' : 'replaced'})`) : '']
        : h('span', {}, h('strong', {}, 'New: '), r.create.name, ' ', h('span', { class: 'sds-muted' }, r.create.parent ? `under ${where(st, r.create.parent)}` : `at the end of ${st.content.categories[st.state.kites[r.create.kite].color]?.name ?? 'its'} list`));
    return h('tr', { class: 'q-row' + (r.problem ? ' bad' : ''), dataset: { set: String(r.set) } },
      h('td', {}, set.title || h('span', { class: 'sds-muted' }, parsed.plain ? 'The questions' : `Set ${r.set + 1}`)),
      h('td', { class: 'num' }, String(r.count)),
      h('td', {}, dest));
  };
  return h('div', { class: 'sds-overlay', onclick: e => { if (e.target === e.currentTarget) a.closeImport(); } },
    h('div', { class: 'sds-sheet q-import', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Import questions' },
      h('button', { type: 'button', class: 'sds-sheet-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => a.closeImport() }, '×'),
      h('header', { class: 'card-head' }, h('div', { class: 'eyebrow' }, 'MATERIALS'), h('h2', {}, 'Import questions'),
        h('p', { class: 'note small' }, 'Questions as plain text: numbered (1. 2. …), choices on their own lines (A) B) …), then an Answer: line (the right letter, the blank’s answers separated by ;, a number, or the typed answer), and Explanation: if you like. The Markdown format of question-format.md works too: each “# Set:” goes to the star-dot its “target:” names. The star-dots that get questions become □.')),
      h('div', { class: 'buttons' }, button('Choose a file…', () => file.click?.()), file, imp.name && h('span', { class: 'note small' }, imp.name)),
      paste,
      parsed.errors.length > 0 && h('div', { class: 'sds-q-check bad q-errors', role: 'status' },
        h('strong', {}, `${parsed.errors.length} ${parsed.errors.length === 1 ? 'error' : 'errors'}: nothing is imported until they're fixed.`),
        h('ul', {}, parsed.errors.slice(0, 40).map(x => h('li', {}, h('strong', {}, `Line ${x.line}: `), x.message)), parsed.errors.length > 40 && h('li', {}, `…and ${parsed.errors.length - 40} more.`))),
      untargeted && !parsed.errors.length && h('div', { class: 'q-where' },
        h('strong', {}, 'Where they go '),
        h('span', { class: 'segmented', role: 'group', 'aria-label': 'Where they go' },
          [['one', 'Into one star-dot'], ['split', independent ? 'A new item per question' : 'A new star-dot per question']].map(([id, label]) => h('button', {
            type: 'button', class: 'seg' + ((imp.where ?? 'one') === id ? ' on' : ''), 'aria-pressed': String((imp.where ?? 'one') === id), onclick: () => a.setImport({ where: id }),
          }, label))),
        splitting && h('select', { class: 'q-under', 'aria-label': independent ? 'The category' : 'The star-dot they go under', onchange: e => a.setImport({ under: e.target.value || null }) },
          h('option', { value: '' }, independent ? 'At the end of the category…' : 'Under the star-dot…'), unders.map(([id, label]) => h('option', { value: id, selected: id === imp.under }, label))),
        h('p', { class: 'note small' }, splitting
          ? (independent ? 'Each question becomes an item of its own, named by its first line.' : 'Each question becomes a new □ child, named by its first line.')
          : 'Choose the star-dot below.')),
      plan.length > 0 && h('table', { class: 'q-plan' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Set'), h('th', {}, 'Questions'), h('th', {}, 'Goes to'))),
        h('tbody', {}, plan.map(rowFor))),
      anyHas && h('div', { class: 'segmented q-mode', role: 'group', 'aria-label': 'A star-dot that has questions' },
        [['replace', 'Replace its questions'], ['append', 'Append to them']].map(([id, label]) => h('button', {
          type: 'button', class: 'seg' + ((imp.mode ?? 'replace') === id ? ' on' : ''), 'aria-pressed': String((imp.mode ?? 'replace') === id), onclick: () => a.setImport({ mode: id }),
        }, label))),
      h('div', { class: 'buttons' },
        button(ok.length ? `Import ${ok.length} ${ok.length === 1 ? 'set' : 'sets'} (${questions} ${questions === 1 ? 'question' : 'questions'})` : 'Import', () => a.importQuestions(sets, plan, imp.mode ?? 'replace'),
          { class: 'text-btn q-import-go', disabled: !ok.length || parsed.errors.length > 0 }),
        ok.length < plan.length && h('span', { class: 'note small' }, `${plan.length - ok.length} skipped (see why above).`),
        button('Cancel', () => a.closeImport()))));
}
