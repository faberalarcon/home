import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type SelectedProfile = { id: number; name: string; color: string } | null;

const KEY = 'drink-hub.profile';

function load(): SelectedProfile {
  if (!browser) return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SelectedProfile;
  } catch {
    return null;
  }
}

export const selectedProfile = writable<SelectedProfile>(load());

if (browser) {
  selectedProfile.subscribe((v) => {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  });
}
