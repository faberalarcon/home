import { db } from '$lib/drinks/server/db';
import { orders, profiles, drinks } from '$lib/drinks/server/db/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
import { getStatsResetAt } from '$lib/drinks/server/db/settings';
import { estimateBAC } from '$lib/drinks/server/bac';
import type { PageServerLoad } from './$types';

function startOfDayLocal(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
}

function startOfWeekLocal(): number {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Math.floor(monday.getTime() / 1000);
}

export function _loadStatsPageData() {
  const dayStart = startOfDayLocal();
  const weekStart = startOfWeekLocal();
  const resetAt = getStatsResetAt();

  const totalAllTime = db.select({ c: count() }).from(orders)
    .where(sql`${orders.createdAt} > ${resetAt}`)
    .get()?.c ?? 0;

  const totalToday = db.select({ c: count() }).from(orders)
    .where(sql`${orders.createdAt} >= ${dayStart} AND ${orders.createdAt} > ${resetAt}`)
    .get()?.c ?? 0;

  const totalWeek = db.select({ c: count() }).from(orders)
    .where(sql`${orders.createdAt} >= ${weekStart} AND ${orders.createdAt} > ${resetAt}`)
    .get()?.c ?? 0;

  // Leaderboard — all time
  const leaderAllTime = db
    .select({ id: profiles.id, name: profiles.name, color: profiles.color, c: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .where(sql`${orders.createdAt} > ${resetAt}`)
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  // Leaderboard — today
  const leaderToday = db
    .select({ id: profiles.id, name: profiles.name, color: profiles.color, c: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .where(sql`${orders.createdAt} >= ${dayStart} AND ${orders.createdAt} > ${resetAt}`)
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  // Top 5 drinks all time
  const topDrinks = db
    .select({ id: drinks.id, name: drinks.name, category: drinks.category, c: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${orders.createdAt} > ${resetAt}`)
    .groupBy(drinks.id)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  // Day-of-week histogram (0=Sun … 6=Sat)
  const dowRows = db
    .select({
      dow: sql<number>`cast(strftime('%w', datetime(${orders.createdAt}, 'unixepoch', 'localtime')) as integer)`,
      c: sql<number>`count(*)`
    })
    .from(orders)
    .where(sql`${orders.status} != 'deleted' AND ${orders.createdAt} > ${resetAt}`)
    .groupBy(sql`strftime('%w', datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .all();

  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowCounts = dowLabels.map((label, i) => ({
    label,
    count: dowRows.find((r) => r.dow === i)?.c ?? 0
  }));

  // BAC estimation — today's orders per profile with drink ABV/volume
  const todayDrinkData = db
    .select({
      profileId: orders.profileId,
      abv: drinks.abv,
      volumeMl: drinks.volumeMl,
      orderedAt: orders.createdAt
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${orders.createdAt} >= ${dayStart} AND ${orders.status} != 'deleted' AND ${orders.createdAt} > ${resetAt}`)
    .all();

  const profileBodyMap = new Map(
    db.select({ id: profiles.id, weightKg: profiles.weightKg, biologicalSex: profiles.biologicalSex })
      .from(profiles)
      .all()
      .map((p) => [p.id, p])
  );

  const nowSec = Math.floor(Date.now() / 1000);

  const leaderTodayWithBAC = leaderToday.map((entry) => {
    const body = profileBodyMap.get(entry.id);
    const drinkEntries = todayDrinkData
      .filter((o) => o.profileId === entry.id)
      .map((o) => ({
        abv: o.abv,
        volumeMl: o.volumeMl,
        orderedAtSec: Math.floor((o.orderedAt as Date).getTime() / 1000)
      }));
    const { bac, hasData } = estimateBAC(
      drinkEntries,
      body?.weightKg ?? null,
      body?.biologicalSex ?? null,
      nowSec
    );
    return { ...entry, bac, bacHasData: hasData };
  });

  return { totalAllTime, totalToday, totalWeek, leaderAllTime, leaderToday: leaderTodayWithBAC, topDrinks, dowCounts, resetAt };
}

export const load: PageServerLoad = async () => {
  return _loadStatsPageData();
};
