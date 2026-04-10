import { db } from '$lib/server/db';
import { profiles, orders, drinks } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const rows = db.select().from(profiles).where(eq(profiles.active, true)).all();

  // For each profile: last order and most-ordered drink
  const profileData = rows.map((p) => {
    const lastOrder = db
      .select({ drinkName: drinks.name, createdAt: orders.createdAt })
      .from(orders)
      .innerJoin(drinks, eq(orders.drinkId, drinks.id))
      .where(sql`${orders.profileId} = ${p.id} AND ${orders.status} != 'deleted'`)
      .orderBy(desc(orders.createdAt))
      .limit(1)
      .get();

    const usual = db
      .select({ drinkId: drinks.id, drinkName: drinks.name, c: sql<number>`count(*)` })
      .from(orders)
      .innerJoin(drinks, eq(orders.drinkId, drinks.id))
      .where(sql`${orders.profileId} = ${p.id} AND ${orders.status} != 'deleted'`)
      .groupBy(drinks.id)
      .orderBy(desc(sql`count(*)`))
      .limit(1)
      .get();

    return {
      ...p,
      lastDrinkName: lastOrder?.drinkName ?? null,
      lastOrderedAt: lastOrder?.createdAt ?? null,
      usualDrinkId: usual?.drinkId ?? null,
      usualDrinkName: usual?.drinkName ?? null
    };
  });

  return { profiles: profileData };
};
