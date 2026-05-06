import { db } from '$lib/drinks/server/db';
import { orders, profiles, drinks } from '$lib/drinks/server/db/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
import { getStatsResetAt } from '$lib/drinks/server/db/settings';

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

function startOfMonthLocal(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

export function getDrinkHubStats(searchParams: URLSearchParams = new URLSearchParams()) {
  const resetAt = getStatsResetAt();
  const dayStart = startOfDayLocal();
  const weekStart = startOfWeekLocal();
  const monthStart = startOfMonthLocal();

  // Optional filters
  const profileIdParam = searchParams.get('profile_id');
  const drinkIdParam = searchParams.get('drink_id');
  const categoryParam = searchParams.get('category');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  // Build base filter conditions
  const baseConditions = [
    sql`${orders.status} != 'deleted'`,
    sql`${orders.createdAt} > ${resetAt}`
  ];

  if (profileIdParam) {
    baseConditions.push(sql`${orders.profileId} = ${parseInt(profileIdParam)}`);
  }
  if (drinkIdParam) {
    baseConditions.push(sql`${orders.drinkId} = ${parseInt(drinkIdParam)}`);
  }
  if (fromParam) {
    const fromTs = Math.floor(new Date(fromParam).getTime() / 1000);
    baseConditions.push(sql`${orders.createdAt} >= ${fromTs}`);
  }
  if (toParam) {
    const toTs = Math.floor(new Date(toParam + 'T23:59:59').getTime() / 1000);
    baseConditions.push(sql`${orders.createdAt} <= ${toTs}`);
  }

  const baseWhere = sql.join(baseConditions, sql` AND `);

  // Category filter needs a join condition
  const categoryCondition = categoryParam
    ? sql` AND ${drinks.category} = ${categoryParam}`
    : sql``;

  // --- Totals ---
  const totalAllTime = db
    .select({ c: count() })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .get()?.c ?? 0;

  const totalToday = db
    .select({ c: count() })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere} AND ${orders.createdAt} >= ${dayStart}${categoryCondition}`)
    .get()?.c ?? 0;

  const totalWeek = db
    .select({ c: count() })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere} AND ${orders.createdAt} >= ${weekStart}${categoryCondition}`)
    .get()?.c ?? 0;

  const totalMonth = db
    .select({ c: count() })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere} AND ${orders.createdAt} >= ${monthStart}${categoryCondition}`)
    .get()?.c ?? 0;

  // --- Leaderboards ---
  const leaderAllTime = db
    .select({
      id: profiles.id,
      name: profiles.name,
      color: profiles.color,
      avatarUrl: profiles.avatarUrl,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  const leaderToday = db
    .select({
      id: profiles.id,
      name: profiles.name,
      color: profiles.color,
      avatarUrl: profiles.avatarUrl,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere} AND ${orders.createdAt} >= ${dayStart}${categoryCondition}`)
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  const leaderWeek = db
    .select({
      id: profiles.id,
      name: profiles.name,
      color: profiles.color,
      avatarUrl: profiles.avatarUrl,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere} AND ${orders.createdAt} >= ${weekStart}${categoryCondition}`)
    .groupBy(profiles.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  // --- Top Drinks ---
  const topDrinksAllTime = db
    .select({
      id: drinks.id,
      name: drinks.name,
      category: drinks.category,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .groupBy(drinks.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  const topDrinksWeek = db
    .select({
      id: drinks.id,
      name: drinks.name,
      category: drinks.category,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere} AND ${orders.createdAt} >= ${weekStart}${categoryCondition}`)
    .groupBy(drinks.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  // --- Histograms ---
  const dowRows = db
    .select({
      dow: sql<number>`cast(strftime('%w', datetime(${orders.createdAt}, 'unixepoch', 'localtime')) as integer)`,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .groupBy(sql`strftime('%w', datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .all();

  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowHistogram = dowLabels.map((day, i) => ({
    day,
    count: dowRows.find((r) => r.dow === i)?.count ?? 0
  }));

  const hourRows = db
    .select({
      hour: sql<number>`cast(strftime('%H', datetime(${orders.createdAt}, 'unixepoch', 'localtime')) as integer)`,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .groupBy(sql`strftime('%H', datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .all();

  const hourHistogram = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourRows.find((r) => r.hour === i)?.count ?? 0
  }));

  // --- Daily Timeline (last 90 days) ---
  const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
  const dailyTimeline = db
    .select({
      date: sql<string>`date(datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere} AND ${orders.createdAt} >= ${ninetyDaysAgo}${categoryCondition}`)
    .groupBy(sql`date(datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .orderBy(sql`date(datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .all();

  // --- Profiles and Drinks for filters ---
  const allProfiles = db
    .select({ id: profiles.id, name: profiles.name, color: profiles.color, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.active, true))
    .all();

  const allDrinks = db
    .select({ id: drinks.id, name: drinks.name, category: drinks.category })
    .from(drinks)
    .where(eq(drinks.active, true))
    .all();

  // --- Fun Stats ---
  // Busiest day ever
  const busiestDay = db
    .select({
      date: sql<string>`date(datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .groupBy(sql`date(datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .orderBy(desc(sql`count(*)`))
    .limit(1)
    .get();

  // First order date
  const firstOrder = db
    .select({ createdAt: orders.createdAt })
    .from(orders)
    .where(sql`${orders.status} != 'deleted' AND ${orders.createdAt} > ${resetAt}`)
    .orderBy(orders.createdAt)
    .limit(1)
    .get();

  // Average per day (total / distinct days)
  const distinctDays = db
    .select({
      days: sql<number>`count(distinct date(datetime(${orders.createdAt}, 'unixepoch', 'localtime')))`
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .get();

  const avgPerDay = distinctDays && distinctDays.days > 0
    ? Math.round((totalAllTime / distinctDays.days) * 10) / 10
    : 0;

  // Favorite drink per profile
  const favoriteDrinkPerProfile = db
    .select({
      profileId: orders.profileId,
      profileName: profiles.name,
      profileColor: profiles.color,
      drinkName: drinks.name,
      count: sql<number>`count(*)`
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .groupBy(orders.profileId, orders.drinkId)
    .orderBy(desc(sql`count(*)`))
    .all();

  // De-duplicate: keep only the top drink per profile
  const seenProfiles = new Set<number>();
  const signatureDrinks = favoriteDrinkPerProfile.filter((row) => {
    if (seenProfiles.has(row.profileId)) return false;
    seenProfiles.add(row.profileId);
    return true;
  });

  // Drink diversity: unique drinks ordered / total orders
  const uniqueDrinksOrdered = db
    .select({ c: sql<number>`count(distinct ${orders.drinkId})` })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .get()?.c ?? 0;

  const diversityScore = totalAllTime > 0
    ? Math.round((uniqueDrinksOrdered / totalAllTime) * 100)
    : 0;

  // Longest streak (consecutive days with at least one order)
  const allDays = db
    .select({
      date: sql<string>`date(datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`
    })
    .from(orders)
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(sql`${baseWhere}${categoryCondition}`)
    .groupBy(sql`date(datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .orderBy(sql`date(datetime(${orders.createdAt}, 'unixepoch', 'localtime'))`)
    .all();

  let longestStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < allDays.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prev = new Date(allDays[i - 1].date + 'T12:00:00');
      const curr = new Date(allDays[i].date + 'T12:00:00');
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  // Most popular day of week
  const peakDow = dowHistogram.reduce((a, b) => (b.count > a.count ? b : a), dowHistogram[0]);

  // Peak hour
  const peakHour = hourHistogram.reduce((a, b) => (b.count > a.count ? b : a), hourHistogram[0]);

  return {
    totals: {
      allTime: totalAllTime,
      today: totalToday,
      thisWeek: totalWeek,
      thisMonth: totalMonth
    },
    leaderboard: {
      allTime: leaderAllTime,
      today: leaderToday,
      thisWeek: leaderWeek
    },
    topDrinks: {
      allTime: topDrinksAllTime,
      thisWeek: topDrinksWeek
    },
    dowHistogram,
    hourHistogram,
    dailyTimeline,
    profiles: allProfiles,
    drinks: allDrinks,
    funStats: {
      busiestDay: busiestDay ? { date: busiestDay.date, count: busiestDay.count } : null,
      longestStreak,
      avgPerDay,
      firstOrderDate: firstOrder
        ? new Date((firstOrder.createdAt as Date).getTime()).toISOString().split('T')[0]
        : null,
      signatureDrinks: signatureDrinks.map((s) => ({
        profileName: s.profileName,
        profileColor: s.profileColor,
        drinkName: s.drinkName,
        count: s.count
      })),
      diversityScore,
      peakDay: peakDow?.day ?? null,
      peakHour: peakHour ? `${peakHour.hour}:00` : null
    },
    meta: {
      resetAt,
      generatedAt: new Date().toISOString()
    }
  };
}
