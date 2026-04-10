import { db } from '$lib/server/db';
import { orders, profiles, drinks } from '$lib/server/db/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
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

export const load: PageServerLoad = async () => {
  const dayStart = startOfDayLocal();
  const weekStart = startOfWeekLocal();

  const totalAllTime = db.select({ c: count() }).from(orders).get()?.c ?? 0;

  const totalToday = db.select({ c: count() }).from(orders)
    .where(sql`${orders.createdAt} >= ${dayStart}`)
    .get()?.c ?? 0;

  const totalWeek = db.select({ c: count() }).from(orders)
    .where(sql`${orders.createdAt} >= ${weekStart}`)
    .get()?.c ?? 0;

  // Leaderboard — all time
  const leaderAllTime = db
    .select({ id: profiles.id, name: profiles.name, color: profiles.color, c: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  // Leaderboard — today
  const leaderToday = db
    .select({ id: profiles.id, name: profiles.name, color: profiles.color, c: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .where(sql`${orders.createdAt} >= ${dayStart}`)
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  // Top 5 drinks all time
  const topDrinks = db
    .select({ id: drinks.id, name: drinks.name, category: drinks.category, c: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
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
    .where(sql`${orders.status} != 'deleted'`)
    .groupBy(sql`strftime('%w', datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .all();

  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowCounts = dowLabels.map((label, i) => ({
    label,
    count: dowRows.find((r) => r.dow === i)?.c ?? 0
  }));

  return { totalAllTime, totalToday, totalWeek, leaderAllTime, leaderToday, topDrinks, dowCounts };
};
