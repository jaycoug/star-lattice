// Question text as the player sees it, from the little Markdown a question file
// uses: paragraphs, ``` code blocks (with Copy), "- " and "1. " lists, | tables |, `code`, **bold**
// and *italic*. Built as DOM nodes (never innerHTML), so nothing in a file runs. With `blank`, each
// ____ (four or more underscores) becomes what blank(i) returns: the inputs of a blank question.
//
// richText(md, { blank, copy }) → element (div.rt)
// blank (i) => node, for the i-th ____ (0-based, in reading order), or null to show it as text
// copy whether code blocks get a Copy button (steps, context)

import { h } from '../dom.js';

const BLANK = /_{4,}/g;

function inline(text, ctx) {
  const out = [];
  // `code` first, so nothing inside it is read as **bold**.
  const parts = String(text).split(/(`[^`]+`)/);
  for (const p of parts) {
    if (!p) continue;
    if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) { out.push(h('code', {}, ...blanks(p.slice(1, -1), ctx))); continue; }
    for (const q of p.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/)) {
      if (!q) continue;
      if (q.startsWith('**') && q.endsWith('**') && q.length > 4) out.push(h('strong', {}, ...blanks(q.slice(2, -2), ctx)));
      else if (q.startsWith('*') && q.endsWith('*') && q.length > 2) out.push(h('em', {}, ...blanks(q.slice(1, -1), ctx)));
      else out.push(...blanks(q, ctx));
    }
  }
  return out;
}

function blanks(text, ctx) {
  if (!ctx.blank) return [text];
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(BLANK)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(ctx.blank(ctx.n++) ?? m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

/** One line of text with `code`, **bold** and *italic* (choice options): an array of nodes. */
export const inlineText = text => inline(String(text ?? ''), { blank: null, n: 0 });

/** Render a question file's Markdown. */
export function richText(md, { blank = null, copy = false } = {}) {
  const ctx = { blank, n: 0 };
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) out.push(h('p', {}, ...inline(para.join(' '), ctx))); para = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*(```|~~~)\s*([\w+-]*)/.exec(line);
    if (fence) {
      flush();
      const body = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
      const code = body.join('\n');
      const pre = h('pre', { class: 'rt-code', dataset: fence[2] ? { lang: fence[2] } : {} }, h('code', {}, ...blanks(code, ctx)));
      out.push(copy && !ctx.blank
        ? h('div', { class: 'rt-code-wrap' }, pre, h('button', {
          type: 'button', class: 'sds-btn rt-copy', title: 'Copy the code',
          onclick: e => { navigator.clipboard?.writeText?.(code); const b = e.currentTarget ?? e.target; if (b) b.textContent = 'Copied'; },
        }, 'Copy'))
        : pre);
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const rows = [];
      for (; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(lines[i]);
      i--;
      const body = rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(cells);
      const head = rows.length > 1 && /^\s*\|[\s:|-]+\|\s*$/.test(rows[1]) ? body.shift() : null;
      out.push(h('table', { class: 'rt-table' },
        head && h('thead', {}, h('tr', {}, head.map(c => h('th', {}, ...inline(c, ctx))))),
        h('tbody', {}, body.map(r => h('tr', {}, r.map(c => h('td', {}, ...inline(c, ctx))))))));
      continue;
    }
    const item = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const ordered = /\d/.test(item[1]);
      const items = [];
      for (; i < lines.length; i++) {
        const m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        items.push(m[2]);
      }
      i--;
      out.push(h(ordered ? 'ol' : 'ul', { class: 'rt-list' }, items.map(t => h('li', {}, ...inline(t, ctx)))));
      continue;
    }
    const head = /^#{1,6}\s+(.*)$/.exec(line);
    if (head) { flush(); out.push(h('p', { class: 'rt-head' }, h('strong', {}, ...inline(head[1], ctx)))); continue; }
    para.push(line.trim());
  }
  flush();
  return h('div', { class: 'rt' }, out);
}
