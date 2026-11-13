// The star-dot screen's question editors (Edit mode): the form (shared/ui/questionForm.js), the
// same draft as Markdown (question-format.md), Paste questions…, and Preview, which answers the draft
// as the player will without saving anything. starDotScreen.js shows them in the Assessor when a
// star-dot's questions are being edited. Design-only: the play version (P7) has a stand-in.

import { h } from '../dom.js';
import * as E from '../engine/index.js';
import { questionSetView, forgetTyped } from './questionSet.js';
import { questionForm, formDraft, setDraft, dropDraft, draftSet, blankQuestion, appendQuestions } from './questionForm.js';

export { dropDraft };

const title = text => h('h3', { class: 'sds-title' }, text);
const button = (label, onclick, props = {}) => h('button', { type: 'button', class: 'sds-btn', onclick, ...props }, label);
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;

/** A new set's Markdown, ready to be filled in (question-format.md has the whole format). */
const TEMPLATE = name => `# Set: ${name || 'Questions'}

## Q q1 [choice]
Write the question here.
- [x] The right answer
- [ ] A wrong answer
  > Why it's wrong (optional)
- [ ] Another wrong answer
explain: Why the right answer is right (shown after answering).
`;

/** Preview: the draft answered as the player will, graded here, nothing saved. */
const previewDone = new Map();   // target → Set of question ids answered right in its preview
const previewRuns = new Map();   // target → how many times its preview started over (its shuffle seed)
function previewSet(ctx, target, set) {
  const { ui, setUi } = ctx;
  const pv = ui.qPv ?? {};
  const done = previewDone.get(target) ?? new Set();
  previewDone.set(target, done);
  const states = new Map();
  for (const it of set.items) {
    let blocked = false;
    for (const q of it.type === 'chain' ? it.items : [it]) {
      const graded = E.GRADED.includes(q.kind);
      states.set(q.id, { kind: graded && done.has(q.id) ? 'answered' : blocked ? 'after' : 'open' });
      if (graded && !done.has(q.id) && it.type === 'chain') blocked = true;
    }
  }
  const graded = E.gradedOf(set);
  return h('div', { class: 'sds-question-preview' }, questionSetView({
    set, dotId: `preview:${target}`, states, live: false,
    seed: `preview|${previewRuns.get(target) ?? 0}`, shuffle: E.shuffleDefaults(ctx.view.opts),   // Start the preview over draws again
    progress: { right: graded.filter(q => done.has(q.id)).length, total: graded.length },
    ui: pv, setUi: patch => setUi({ qPv: { ...pv, ...patch } }),
    answer: (qid, response) => {
      const q = E.questionsOf(set).find(x => x.id === qid);
      const result = response?.self ? { correct: true } : E.grade(q, response);
      if (result.invalid) return { problem: result.feedback };
      if (result.correct) done.add(qid);
      return { correct: result.correct, result, complete: result.correct && graded.every(x => done.has(x.id)) };
    },
  }), button('Start the preview over', () => { previewDone.delete(target); previewRuns.set(target, (previewRuns.get(target) ?? 0) + 1); setUi({ qPv: null }); }, { class: 'sds-btn' }));
}

/** Edit questions: the form, or the same draft as Markdown. */
export const questionEditor = (ctx, target) => (ctx.ui.qMode === 'markdown' ? markdownEditor(ctx, target) : formEditor(ctx, target));
const closeEditor = (ctx, target) => { dropDraft(target); ctx.setUi({ qEdit: null, qMode: null, qDraft: null, qCheck: null, qPreview: false, qImages: null, qPv: null, qFormError: null, qPaste: false, qPasteErrors: null, qPasteNote: null }); };

/**
 * The form. Save is one undoable step (a set with anything missing isn't saved:
 * its cards say what); Preview tries it; Edit as Markdown carries the draft over.
 */
let imagePicked = null;
let pasted = '';   // Paste questions…'s text, kept across redraws
function formEditor(ctx, target) {
  const { st, view, change, ui, setUi } = ctx;
  const t = st.dots[target];
  formDraft(target, t.assessment ?? E.setValue({ items: [blankQuestion('q1')] }));
  const refresh = () => setUi({ qForm: (ui.qForm ?? 0) + 1, qFormError: null });
  const file = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: async e => {
      const f = e.target.files?.[0];
      if (!f || !imagePicked) return;
      try { imagePicked(await shrinkImage(f)); } catch (err) { setUi({ qFormError: err.message }); }
    },
  });
  const pickImage = cb => { imagePicked = cb; file.click?.(); };
  const clean = draftSet(target);
  return [
    h('div', { class: 'sds-assess-item' }, 'Questions · ', t.name || 'Unnamed'),
    questionForm({ target, refresh, pickImage, defaults: E.shuffleDefaults(view.opts) }),
    ui.qPaste ? pastePanel(ctx, target, refresh) : ui.qPasteNote && h('p', { class: 'sds-muted sds-small qf-paste-note', role: 'status' }, ui.qPasteNote),
    ui.qFormError && h('p', { class: 'qf-not-saved', role: 'alert' }, ui.qFormError),
    h('div', { class: 'sds-buttons' },
      !ui.qPaste && button('Paste questions…', () => setUi({ qPaste: true, qPasteErrors: null, qPasteNote: null }), { class: 'sds-btn qf-paste', title: 'Typed-up questions (numbered, choices A) B) …, an Answer: line) become cards here to check' }),
      button(ui.qPreview ? 'Hide the preview' : 'Preview', () => { previewDone.delete(target); setUi({ qPreview: !ui.qPreview, qPv: null }); }, { class: 'sds-btn' }),
      button('Save', () => {
        const s = draftSet(target);
        if (!E.askable(s)) return void setUi({ qFormError: 'Not saved yet: finish what the cards say is missing.' });
        change(x => E.setAssessment(x, target, s));
        forgetTyped(target);
        closeEditor(ctx, target);
        setUi({ qRun: null });
      }, { class: 'sds-btn sds-q-save' }),
      button('Cancel', () => closeEditor(ctx, target), { class: 'sds-btn' }),
      button('Edit as Markdown', () => {
        const s = draftSet(target);
        const untouched = !t.assessment && E.questionsOf(s).every(q => !q.text.trim() && (q.options ?? []).every(o => !o.text.trim()));
        setUi({ qMode: 'markdown', qDraft: untouched ? TEMPLATE(t.name) : E.toMarkdown(s, { target: '' }), qImages: E.imagesOf(s), qCheck: null, qFormError: null });
      }, { class: 'sds-btn qf-to-markdown', title: 'The same questions as Markdown (question-format.md): for chains, or to copy them out' }),
      t.assessment && button('Remove the questions', () => { change(s => E.setAssessment(s, target, null)); closeEditor(ctx, target); }, { class: 'sds-btn' })),
    file,
    ui.qPreview && (E.askable(clean) ? previewSet(ctx, target, clean) : h('p', { class: 'sds-muted' }, 'Finish the questions (the cards say what’s missing) to preview them.')),
  ];
}

/** Paste questions…: plain text (or the Markdown format) added as cards. */
function pastePanel(ctx, target, refresh) {
  const { ui, setUi } = ctx;
  const area = h('textarea', {
    class: 'sds-input qf-paste-text', rows: 10, spellcheck: 'false', 'aria-label': 'Questions to add',
    placeholder: '1. Which organelle makes ATP?\nA) Ribosome\nB) Mitochondrion\nAnswer: B\nExplanation: (optional)\n\n2. The function that loads a data set is ____.\nAnswer: data\n\n3. What is the hazard ratio for race?\nAnswer: 0.716',
    oninput: e => { pasted = e.target.value; },
  });
  area.value = pasted;
  const errors = ui.qPasteErrors;
  return h('div', { class: 'qf-paste-panel' },
    h('p', { class: 'sds-muted sds-small' }, 'Number the questions (1. 2. …); put choices on their own lines (A) B) …); then Answer: the right letter (B, or B and D), the blank’s answers separated by ;, a number, or the typed answer. Explanation: and Hint: are optional.'),
    area,
    errors?.length > 0 && h('div', { class: 'sds-q-check bad', role: 'status' }, h('ul', {}, errors.slice(0, 20).map(x => h('li', {}, h('strong', {}, `Line ${x.line}: `), x.message)))),
    h('div', { class: 'sds-buttons' },
      button('Add them', () => {
        const r = E.readQuestions(pasted);
        if (r.errors.length) return void setUi({ qPasteErrors: r.errors });
        const n = appendQuestions(target, r.sets);
        pasted = '';
        setUi({ qPaste: false, qPasteErrors: null, qPasteNote: `Added ${plural(n, 'question')} at the end: check their cards, then Save.` });
        refresh();
      }, { class: 'sds-btn sds-primary qf-paste-add' }),
      button('Cancel', () => setUi({ qPaste: false, qPasteErrors: null }), { class: 'sds-btn' })));
}

/**
 * Edit questions as Markdown: the set as Markdown, with Check (errors with line numbers), Preview, Save
 * (one undoable step; a draft with errors isn't saved), per-question images (shrunk, kept in the
 * save), Back to the form and Remove the questions.
 */
function markdownEditor(ctx, target) {
  const { st, change, ui, setUi } = ctx;
  const t = st.dots[target];
  const draft = ui.qDraft ?? (t.assessment ? E.toMarkdown(t.assessment, { target: '' }) : TEMPLATE(t.name));
  const images = ui.qImages ?? E.imagesOf(t.assessment);
  const parse = text => E.parseQuestions(text, { images });
  const area = h('textarea', {
    class: 'sds-input sds-q-source', spellcheck: 'false', 'aria-label': 'The questions, as Markdown', rows: Math.min(28, Math.max(10, draft.split('\n').length + 2)),
    onchange: e => setUi({ qDraft: e.target.value, qCheck: null }),
  });
  area.value = draft;
  const read = () => { const v = area.value; return { v, r: parse(v) }; };
  const one = r => (r.errors.length ? r.errors : r.sets.length > 1 ? [{ line: 1, message: `It holds ${r.sets.length} sets: a star-dot has one (a file of many is imported in MATERIALS).` }] : !r.sets.length ? [{ line: 1, message: 'Nothing to save: write a question (## Q q1 [choice]…).' }] : []);
  const withImages = set => ({ ...set, items: set.items.map(it => (it.type === 'chain' ? { ...it, items: it.items.map(q => ({ ...q, image: images[q.id] ?? null })) } : { ...it, image: images[it.id] ?? null })) });
  const parsed = parse(draft);
  const set = parsed.sets.length === 1 && !parsed.errors.length ? withImages(parsed.sets[0]) : null;
  const check = ui.qCheck;
  const file = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: async e => {
      const f = e.target.files?.[0];
      const qid = ui.qImageFor;
      if (!f || !qid) return;
      try { setUi({ qImages: { ...images, [qid]: await shrinkImage(f) }, qDraft: area.value, qError: null }); } catch (err) { setUi({ qError: err.message }); }
    },
  });
  return [
    h('div', { class: 'sds-assess-item' }, 'Questions · ', t.name || 'Unnamed'),
    h('p', { class: 'sds-muted sds-small' }, 'Markdown, as in question-format.md: ## Q id [choice | blank | number | recall | step], then its text, options (- [x] right, - [ ] wrong) or answer:, and explain:, hint:. ## Chain: groups questions answered in order.'),
    area,
    check && h('div', { class: 'sds-q-check ' + (check.errors.length ? 'bad' : 'good'), role: 'status' }, check.errors.length
      ? h('ul', {}, check.errors.map(x => h('li', {}, h('strong', {}, `Line ${x.line}: `), x.message)))
      : check.message),
    h('div', { class: 'sds-buttons' },
      button('Check', () => { const { v, r } = read(); const errors = one(r); setUi({ qDraft: v, qCheck: { errors, message: errors.length ? '' : `No errors: ${plural(E.questionsOf(r.sets[0]).length, 'question')}, ${E.gradedOf(r.sets[0]).length} graded.` } }); }, { class: 'sds-btn sds-q-checkbtn' }),
      button(ui.qPreview ? 'Hide the preview' : 'Preview', () => { const { v } = read(); previewDone.delete(target); setUi({ qDraft: v, qPreview: !ui.qPreview, qPv: null }); }, { class: 'sds-btn' }),
      button('Save', () => {
        const { v, r } = read();
        const errors = one(r);
        if (errors.length) return void setUi({ qDraft: v, qCheck: { errors } });
        change(s => E.setAssessment(s, target, withImages(r.sets[0])));
        forgetTyped(target);
        closeEditor(ctx, target);
        setUi({ qRun: null });
      }, { class: 'sds-btn sds-q-save' }),
      button('Cancel', () => closeEditor(ctx, target), { class: 'sds-btn' }),
      button('Back to the form', () => {
        const { v, r } = read();
        const errors = one(r);
        if (errors.length) return void setUi({ qDraft: v, qCheck: { errors } });
        setDraft(target, withImages(r.sets[0]));
        setUi({ qMode: 'form', qDraft: null, qCheck: null, qImages: null, qPreview: false });
      }, { class: 'sds-btn qf-to-form', title: 'The same questions as cards (fix any errors first)' }),
      t.assessment && button('Remove the questions', () => { change(s => E.setAssessment(s, target, null)); closeEditor(ctx, target); }, { class: 'sds-btn' })),
    set && h('details', { class: 'sds-q-images' }, h('summary', {}, `Images (${Object.keys(images).filter(id => E.questionsOf(set).some(q => q.id === id)).length})`),
      h('ul', {}, E.questionsOf(set).map(q => h('li', {},
        h('span', { class: 'grow' }, `${q.id} · ${q.kind}`),
        images[q.id] && h('img', { class: 'sds-question-image', src: images[q.id], alt: '' }),
        button(images[q.id] ? 'Replace…' : 'Add an image…', () => { setUi({ qImageFor: q.id, qDraft: area.value }); file.click?.(); }, { class: 'sds-btn', title: `Shrunk to ${E.IMAGE_MAX} px on its long side, kept in the save` }),
        images[q.id] && button('Remove', () => { const { [q.id]: _, ...rest } = images; setUi({ qImages: rest, qDraft: area.value }); }, { class: 'sds-btn' })))),
      file),
    ui.qError && h('p', { class: 'sds-muted sds-small' }, ui.qError),
    ui.qPreview && (set ? previewSet(ctx, target, set) : h('p', { class: 'sds-muted' }, 'Fix the errors (Check lists them) to preview it.')),
  ];
}

/** Shrink an image file to IMAGE_MAX px on its long side: a data URL (PNG stays PNG, the rest JPEG). */
async function shrinkImage(file) {
  const url = await new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => fail(new Error('Couldn’t read the file.')); r.readAsDataURL(file); });
  const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('That isn’t an image.')); i.src = url; });
  const [w, ht] = E.fitSize(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = ht;
  canvas.getContext('2d').drawImage(img, 0, 0, w, ht);
  return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
}
