import { readVisitorCount } from '$lib/site/visitors.server';

export function load() {
  return { visitorCount: readVisitorCount() };
}
