import DOMPurify from 'dompurify';
import { Marked, type Tokens } from 'marked';
import markedKatex from 'marked-katex-extension';
import { highlightToHtml, resolveLang } from './highlighter';

const renderCtx = {
  codeIdx: 0,
  partialIdx: -1
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function codeBlockShell(args: {
  lang: string;
  rawCode: string;
  innerHtml: string;
  streaming: boolean;
}): string {
  const langLabel = args.lang && args.lang !== 'plaintext' ? args.lang : 'code';
  const streamAttr = args.streaming ? ' data-streaming="1"' : '';
  const dataCode = escapeAttr(args.rawCode);
  return (
    `<div class="gooby-code-block" data-lang="${escapeAttr(langLabel)}"${streamAttr}>` +
    `<div class="gooby-code-head">` +
    `<span class="gooby-code-lang">${escapeHtml(langLabel)}</span>` +
    `<button type="button" class="gooby-copy-btn" data-code="${dataCode}" aria-label="Copy code">Copy</button>` +
    `</div>` +
    args.innerHtml +
    `</div>`
  );
}

const marked = new Marked({
  gfm: true,
  breaks: true
});

marked.use(markedKatex({ throwOnError: false, nonStandard: true }));

marked.use({
  renderer: {
    code({ text, lang }: Tokens.Code) {
      const idx = renderCtx.codeIdx++;
      const isPartial = idx === renderCtx.partialIdx;
      const resolved = resolveLang(lang);

      if (isPartial) {
        return codeBlockShell({
          lang: lang || resolved,
          rawCode: text,
          innerHtml: `<pre><code class="language-${escapeAttr(resolved)}">${escapeHtml(text)}</code></pre>`,
          streaming: true
        });
      }

      const shiki = highlightToHtml(text, lang || '');
      if (shiki) {
        return codeBlockShell({
          lang: lang || resolved,
          rawCode: text,
          innerHtml: shiki,
          streaming: false
        });
      }

      return codeBlockShell({
        lang: lang || resolved,
        rawCode: text,
        innerHtml: `<pre><code class="language-${escapeAttr(resolved)}">${escapeHtml(text)}</code></pre>`,
        streaming: false
      });
    },
    link({ href, title, tokens }: Tokens.Link) {
      const self = this as unknown as { parser: { parseInline: (t: Tokens.Link['tokens']) => string } };
      const inner = self.parser.parseInline(tokens);
      const safeHref = /^(https?:|mailto:|\/|#)/i.test(href) ? href : '#';
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      const ext = /^https?:/i.test(safeHref)
        ? ' target="_blank" rel="noopener noreferrer"'
        : '';
      return `<a href="${escapeAttr(safeHref)}"${titleAttr}${ext}>${inner}</a>`;
    }
  }
});

function countFenceMarkers(src: string): number {
  const matches = src.match(/^[ ]{0,3}(```+|~~~+)/gm);
  return matches ? matches.length : 0;
}

function prepareStreaming(raw: string, streaming: boolean): { prepared: string; partial: boolean; totalBlocks: number } {
  const fences = countFenceMarkers(raw);
  const partial = streaming && fences % 2 === 1;
  const prepared = partial ? raw + '\n```' : raw;
  const closedPairs = Math.floor(fences / 2);
  const totalBlocks = closedPairs + (partial ? 1 : 0);
  return { prepared, partial, totalBlocks };
}

const PURIFY_CFG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel', 'aria-hidden', 'data-lang', 'data-code', 'data-streaming', 'style'],
  ADD_TAGS: ['svg', 'path', 'g', 'line', 'circle', 'rect', 'polyline']
};

function wrapTables(html: string): string {
  return html.replace(/<table>/g, '<div class="gooby-table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
}

export function renderMarkdown(content: string, opts: { streaming?: boolean } = {}): string {
  const { prepared, partial, totalBlocks } = prepareStreaming(content || '', !!opts.streaming);
  renderCtx.codeIdx = 0;
  renderCtx.partialIdx = partial ? totalBlocks - 1 : -1;
  const raw = marked.parse(prepared, { async: false }) as string;
  const wrapped = wrapTables(raw);
  return String(DOMPurify.sanitize(wrapped, PURIFY_CFG));
}
