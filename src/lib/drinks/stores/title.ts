import { writable } from 'svelte/store';

export const pageTitle = writable('drink-hub');

export function setTitle(title: string, revertMs?: number) {
  pageTitle.set(title);
  if (revertMs) setTimeout(() => pageTitle.set('drink-hub'), revertMs);
}
