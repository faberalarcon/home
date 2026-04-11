import type { RequestEvent } from '@sveltejs/kit';

export function load({ locals }: RequestEvent) {
  return {
    siteAuthenticated: locals.siteAuthenticated,
    sitePasswordEnabled: locals.sitePasswordEnabled
  };
}
