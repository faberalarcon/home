import { writable } from 'svelte/store';

const DEFAULT_TITLE = '21 Bristoe drinks';

export const pageTitle = writable(DEFAULT_TITLE);

export function setTitle(title: string, revertMs?: number) {
  pageTitle.set(title);
  if (revertMs) setTimeout(() => pageTitle.set(DEFAULT_TITLE), revertMs);
}
