import { getSetting } from '$lib/drinks/server/db/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
  const haToken = getSetting('ha_token') ?? '';
  const haBaseUrl = getSetting('ha_base_url') ?? '';
  const haLastError = getSetting('ha_last_error') ?? '';

  let haWarning: string | null = null;
  if (!haToken) haWarning = 'HA token not set — events will not fire.';
  else if (!haBaseUrl) haWarning = 'HA base URL not set — events will not fire.';
  else if (haLastError) haWarning = `Last HA error: ${haLastError}`;

  return { haWarning };
};
