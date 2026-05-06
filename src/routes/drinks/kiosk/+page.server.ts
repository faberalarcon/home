import { db } from '$lib/drinks/server/db';
import { orders, profiles, drinks } from '$lib/drinks/server/db/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { estimateBAC } from '$lib/drinks/server/bac';

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

  const leaderRaw = db
    .select({
      id: profiles.id,
      name: profiles.name,
      color: profiles.color,
      c: sql<number>`count(*)`,
      weightKg: profiles.weightKg,
      biologicalSex: profiles.biologicalSex
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .where(sql`${orders.createdAt} >= ${dayStart}`)
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(3)
    .all();

  const nowSec = Math.floor(Date.now() / 1000);
  const leaderToday = leaderRaw.map(({ weightKg, biologicalSex, ...p }) => {
    const drinkEntries = db
      .select({ abv: drinks.abv, volumeMl: drinks.volumeMl, orderedAtSec: orders.createdAt })
      .from(orders)
      .innerJoin(drinks, eq(orders.drinkId, drinks.id))
      .where(sql`${orders.profileId} = ${p.id} AND ${orders.createdAt} >= ${dayStart}`)
      .all()
      .map((d) => ({ ...d, orderedAtSec: Math.floor((d.orderedAtSec?.getTime() ?? 0) / 1000) }));

    const { bac, hasData } = estimateBAC(drinkEntries, weightKg, biologicalSex, nowSec);
    return { ...p, bac, bacHasData: hasData };
  });

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
