import { db } from '$lib/drinks/server/db';
import { orders, profiles, drinks } from '$lib/drinks/server/db/schema';
import { eq, sql, desc, and, lt } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
  const before = url.searchParams.get('before') ? Number(url.searchParams.get('before')) : null;

  const conditions = [sql`${orders.status} != 'deleted'`];
  if (before) conditions.push(lt(orders.createdAt, new Date(before * 1000)));

  const rows = db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      status: orders.status,
      profileId: orders.profileId,
      drinkId: orders.drinkId,
      profileName: profiles.name,
      profileColor: profiles.color,
      drinkName: drinks.name,
      drinkCategory: drinks.category
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE + 1)
    .all();

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextBefore = hasMore
    ? Math.floor((items[items.length - 1].createdAt?.getTime() ?? 0) / 1000)
    : null;

  return { items, hasMore, nextBefore, before };
};

export const actions: Actions = {
  delete: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });
    db.update(orders).set({ status: 'deleted' }).where(eq(orders.id, id)).run();
    return { deleted: true };
  },

  reassign: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    const profileId = Number(fd.get('profileId'));
    if (!id || !profileId) return fail(400, { error: 'Missing fields' });
    const profile = db.select().from(profiles).where(eq(profiles.id, profileId)).get();
    if (!profile) return fail(404, { error: 'Profile not found' });
    db.update(orders).set({ profileId }).where(eq(orders.id, id)).run();
    return { reassigned: true };
  }
};
