import { db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const rows = db.select().from(profiles).where(eq(profiles.active, true)).all();
  return { profiles: rows };
};
