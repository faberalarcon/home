import { db } from '$lib/server/db';
import { drinks } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const rows = db
    .select()
    .from(drinks)
    .where(eq(drinks.active, true))
    .orderBy(asc(drinks.sortOrder), asc(drinks.name))
    .all();
  return { drinks: rows };
};
