import { db } from '$lib/drinks/server/db';
import { drinks } from '$lib/drinks/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export function _loadMenuPageData() {
  const rows = db
    .select()
    .from(drinks)
    .where(eq(drinks.active, true))
    .orderBy(asc(drinks.sortOrder), asc(drinks.name))
    .all();
  return { drinks: rows };
}

export const load: PageServerLoad = async () => {
  return _loadMenuPageData();
};
