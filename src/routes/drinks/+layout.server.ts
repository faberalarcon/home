import { readVisitorCount } from '$lib/site/visitors.server';
import type { RequestEvent } from '@sveltejs/kit';

export function load({ locals }: RequestEvent) {
  return {
    siteAuthenticated: locals.siteAuthenticated,
    sitePasswordEnabled: locals.sitePasswordEnabled,
    visitorCount: readVisitorCount(),
  };
}
