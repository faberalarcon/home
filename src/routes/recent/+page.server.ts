import { db } from '$lib/server/db';
import { orders, profiles, drinks } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const rows = db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      profileName: profiles.name,
      profileColor: profiles.color,
      drinkName: drinks.name,
      drinkCategory: drinks.category
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${orders.status} != 'deleted'`)
    .orderBy(desc(orders.createdAt))
    .limit(50)
    .all();
  return { recent: rows };
};
