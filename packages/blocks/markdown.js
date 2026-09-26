// A deliberately small Markdown subset for the rich_text block. Everything is HTML-escaped
// first, so staff cannot inject markup. Supported: ## / ### headings, paragraphs, blank-line
// separation, - or * bullet lists, 1. numbered lists, **bold**, *italic*, [text](url).

import { isSafeUrl } from './index.js';

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(escaped) {
  return escaped
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
      // href was escaped along with everything else; un-escape &amp; for the check only.
      const raw = href.replace(/&amp;/g, '&');
      if (!isSafeUrl(raw)) return label;
      const external = /^https?:\/\//i.test(raw);
      return `<a href="${href}"${external ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

export function renderMarkdown(src) {
  const lines = escapeHtml(src ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let listType = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (listType) out.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    const t = line.trim();
    let m;
    if (!t) {
      flushPara();
      closeList();
    } else if ((m = t.match(/^(#{2,3})\s+(.*)$/))) {
      flushPara();
      closeList();
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if ((m = t.match(/^[-*]\s+(.*)$/)) || (m = t.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      const type = /^\d/.test(t) ? 'ol' : 'ul';
      if (listType !== type) {
        closeList();
        out.push(`<${type}>`);
        listType = type;
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      para.push(t);
    }
  }
  flushPara();
  closeList();
  return out.join('\n');
}
