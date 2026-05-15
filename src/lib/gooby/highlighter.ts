import type { HighlighterCore } from 'shiki/core';
import { createHighlighter, type Highlighter } from 'shiki';

const LANGS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'bash',
  'shell',
  'sh',
  'html',
  'css',
  'svelte',
  'python',
  'sql',
  'go',
  'rust',
  'yaml',
  'markdown',
  'diff',
  'docker'
] as const;

const LANG_ALIAS: Record<string, string> = {
  py: 'python',
  rb: 'ruby',
  yml: 'yaml',
  md: 'markdown',
  dockerfile: 'docker',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  console: 'bash',
  text: 'plaintext',
  txt: 'plaintext',
  plain: 'plaintext'
};

let highlighter: Highlighter | null = null;
let loading: Promise<Highlighter> | null = null;
const subscribers = new Set<() => void>();

export function getHighlighter(): Highlighter | null {
  return highlighter;
}

export function ensureHighlighter(): Promise<Highlighter> {
  if (highlighter) return Promise.resolve(highlighter);
  if (loading) return loading;
  loading = createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [...LANGS]
  }).then((h) => {
    highlighter = h;
    subscribers.forEach((cb) => cb());
    subscribers.clear();
    return h;
  });
  return loading;
}

export function onReady(cb: () => void): () => void {
  if (highlighter) {
    cb();
    return () => {};
  }
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function resolveLang(raw: string | undefined): string {
  if (!raw) return 'plaintext';
  const key = raw.toLowerCase().split(/\s+/)[0];
  const alias = LANG_ALIAS[key] ?? key;
  if (!highlighter) return alias;
  const loaded = highlighter.getLoadedLanguages();
  return loaded.includes(alias as never) ? alias : 'plaintext';
}

export function highlightToHtml(code: string, lang: string): string | null {
  if (!highlighter) return null;
  try {
    return highlighter.codeToHtml(code, {
      lang: resolveLang(lang),
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      defaultColor: false,
      cssVariablePrefix: '--shiki-'
    });
  } catch {
    return null;
  }
}

export type { HighlighterCore };
