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

function stripFencedBlocks(src: string): string {
  // Replace fenced regions (matched or open) with blank lines of equal count
  // so math/table scans don't pick up `$`, `|` inside code.
  let out = '';
  let inFence = false;
  for (const line of src.split('\n')) {
    if (/^[ ]{0,3}(```+|~~~+)/.test(line)) {
      out += '\n';
      inFence = !inFence;
      continue;
    }
    out += inFence ? '\n' : line + '\n';
  }
  return out;
}

function repairOpenDisplayMath(raw: string): { prepared: string; partial: boolean } {
  const stripped = stripFencedBlocks(raw);
  const matches = stripped.match(/\$\$/g);
  const count = matches ? matches.length : 0;
  if (count % 2 === 1) {
    return { prepared: raw + '\n$$', partial: true };
  }
  return { prepared: raw, partial: false };
}

function repairOpenInlineMath(raw: string): { prepared: string; partial: boolean } {
  const lines = raw.split('\n');
  const lastIdx = lines.length - 1;
  const last = lines[lastIdx];
  // Already-closed display math on last line is fine; we only worry about
  // unmatched single `$` after stripping `$$` pairs.
  const withoutDisplay = last.replace(/\$\$/g, '');
  // Skip if line is inside a fenced block — caller strips fences first via
  // stripFencedBlocks at the document level, but inline scan is line-local.
  const dollars = (withoutDisplay.match(/(?<!\\)\$/g) || []).length;
  if (dollars % 2 === 1) {
    lines[lastIdx] = last + '$';
    return { prepared: lines.join('\n'), partial: true };
  }
  return { prepared: raw, partial: false };
}

function repairIncompleteTable(raw: string): { prepared: string; pendingTail: string | null } {
  const lines = raw.split('\n');
  // Walk from end: gather contiguous trailing `|`-rows.
  let i = lines.length - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  const tailEnd = i;
  let tailStart = tailEnd;
  while (tailStart >= 0 && /^\s*\|/.test(lines[tailStart])) tailStart--;
  tailStart++;
  if (tailStart > tailEnd) return { prepared: raw, pendingTail: null };
  const tailRows = lines.slice(tailStart, tailEnd + 1);
  if (tailRows.length === 0) return { prepared: raw, pendingTail: null };

  // Detect missing separator: a valid GFM table needs at least 2 lines where
  // line[1] is `|---|---|...`. If the tail has only header (no separator yet),
  // or the last row has fewer columns than the header, treat as pending.
  const separatorRe = /^\s*\|?[\s:-]*\|[\s:|:-]*$/;
  const hasSeparator = tailRows.some((r) => /^\s*\|?\s*:?-+/.test(r) && separatorRe.test(r));
  const headerCols = (tailRows[0].match(/\|/g) || []).length;
  const lastCols = (tailRows[tailRows.length - 1].match(/\|/g) || []).length;
  const lastIncomplete = !lines[tailEnd].trim().endsWith('|');

  const incomplete = !hasSeparator || (tailRows.length >= 2 && lastCols < headerCols) || lastIncomplete;
  if (!incomplete) return { prepared: raw, pendingTail: null };

  const preparedLines = lines.slice(0, tailStart);
  return { prepared: preparedLines.join('\n').replace(/\s+$/, ''), pendingTail: tailRows.join('\n') };
}

function prepareStreaming(raw: string, streaming: boolean): {
  prepared: string;
  partial: boolean;
  totalBlocks: number;
  pendingTail: string | null;
} {
  if (!streaming) {
    const fences = countFenceMarkers(raw);
    return { prepared: raw, partial: false, totalBlocks: Math.floor(fences / 2), pendingTail: null };
  }

  // 1. Close open fence (existing behavior).
  const fences = countFenceMarkers(raw);
  const fenceOpen = fences % 2 === 1;
  let working = fenceOpen ? raw + '\n```' : raw;

  // 2. Close open `$$` block math (only when not inside an open fence — the
  //    fence repair above already closed the fence so the scan is safe).
  const dm = repairOpenDisplayMath(working);
  working = dm.prepared;

  // 3. Close open inline `$` on the last line.
  const im = repairOpenInlineMath(working);
  working = im.prepared;

  // 4. Strip incomplete trailing table rows and stash as pending tail.
  const tbl = repairIncompleteTable(working);
  working = tbl.prepared;

  const closedPairs = Math.floor(fences / 2);
  const totalBlocks = closedPairs + (fenceOpen ? 1 : 0);

  return {
    prepared: working,
    partial: fenceOpen,
    totalBlocks,
    pendingTail: tbl.pendingTail
  };
}

const PURIFY_CFG = {
  USE_PROFILES: { html: true, mathMl: true, svg: true },
  ADD_ATTR: ['target', 'rel', 'aria-hidden', 'data-lang', 'data-code', 'data-streaming', 'style']
};

function wrapTables(html: string): string {
  return html.replace(/<table>/g, '<div class="gooby-table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
}

function renderPendingTail(tail: string): string {
  return `<pre class="gooby-table-pending">${escapeHtml(tail)}</pre>`;
}

export function renderMarkdown(content: string, opts: { streaming?: boolean } = {}): string {
  const { prepared, partial, totalBlocks, pendingTail } = prepareStreaming(content || '', !!opts.streaming);
  renderCtx.codeIdx = 0;
  renderCtx.partialIdx = partial ? totalBlocks - 1 : -1;
  const raw = marked.parse(prepared, { async: false }) as string;
  const wrapped = wrapTables(raw) + (pendingTail ? renderPendingTail(pendingTail) : '');
  return String(DOMPurify.sanitize(wrapped, PURIFY_CFG));
}
