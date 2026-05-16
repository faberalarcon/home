import { db } from '$lib/drinks/server/db';
import { haEventsLog } from '$lib/drinks/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { adminPath } from '$lib/drinks/app-paths';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const filter = url.searchParams.get('filter');

  let query = db.select().from(haEventsLog).$dynamic();
  if (filter === 'success') query = query.where(eq(haEventsLog.success, true));
  if (filter === 'failure') query = query.where(eq(haEventsLog.success, false));

  const rows = query.orderBy(desc(haEventsLog.createdAt)).limit(50).all();
  return { rows, filter };
};

export const actions: Actions = {
  clear: async () => {
    db.delete(haEventsLog).run();
    redirect(303, adminPath('/ha-log'));
  }
};
