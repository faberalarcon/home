import { db } from '$lib/server/db';
import { orders, profiles, drinks } from '$lib/server/db/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

function startOfDayLocal(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
}

export const load: PageServerLoad = async () => {
  const dayStart = startOfDayLocal();

  const recentOrders = db
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
    .orderBy(desc(orders.createdAt))
    .limit(10)
    .all();

  const todayTotal = db.select({ c: count() }).from(orders)
    .where(sql`${orders.createdAt} >= ${dayStart}`)
    .get()?.c ?? 0;

  const leaderToday = db
    .select({ id: profiles.id, name: profiles.name, color: profiles.color, c: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .where(sql`${orders.createdAt} >= ${dayStart}`)
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(3)
    .all();

  const topDrinkToday = db
    .select({ name: drinks.name, c: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${orders.createdAt} >= ${dayStart}`)
    .groupBy(drinks.id)
    .orderBy(desc(sql`count(*)`))
    .limit(1)
    .get();

  return { recentOrders, todayTotal, leaderToday, topDrinkToday: topDrinkToday ?? null };
};
