import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { orders, drinks, profiles } from '$lib/server/db/schema';
import { eq, sql, desc, lt, and } from 'drizzle-orm';
import { fireEvent } from '$lib/server/ha';
import { evaluateMilestones } from '$lib/server/milestones';
import { broadcast } from '$lib/server/stream';
import { checkRateLimit } from '$lib/server/ratelimit';
import { announceDrinkOrder } from '$lib/server/tts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
  const before = url.searchParams.get('before') ? Number(url.searchParams.get('before')) : null;
  const profileId = url.searchParams.get('profile_id') ? Number(url.searchParams.get('profile_id')) : null;
  const drinkId = url.searchParams.get('drink_id') ? Number(url.searchParams.get('drink_id')) : null;

  const conditions = [sql`${orders.status} != 'deleted'`];
  if (before) conditions.push(lt(orders.createdAt, new Date(before * 1000)));
  if (profileId) conditions.push(eq(orders.profileId, profileId));
  if (drinkId) conditions.push(eq(orders.drinkId, drinkId));

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
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextBefore = hasMore ? Math.floor((items[items.length - 1].createdAt?.getTime() ?? 0) / 1000) : null;

  return json({ items, hasMore, nextBefore });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.profileId !== 'number' || typeof body.drinkId !== 'number') {
    throw error(400, 'profileId and drinkId required');
  }

  const rateCheck = checkRateLimit(body.profileId);
  if (!rateCheck.allowed) {
    return json({ error: 'Too many orders' }, {
      status: 429,
      headers: { 'Retry-After': String(rateCheck.retryAfter ?? 3) }
    });
  }

  const profile = db.select().from(profiles).where(eq(profiles.id, body.profileId)).get();
  const drink = db.select().from(drinks).where(eq(drinks.id, body.drinkId)).get();
  if (!profile || !drink) throw error(404, 'profile or drink not found');

  // Insert and evaluate milestones atomically so concurrent orders can't
  // double-fire the same milestone.
  const { inserted, firedMilestones, countAllTime, countToday } = db.transaction((tx) => {
    const ins = tx
      .insert(orders)
      .values({
        profileId: body.profileId,
        drinkId: body.drinkId,
        notes: typeof body.notes === 'string' ? body.notes : null
      })
      .returning()
      .get();

    const dayStart = Math.floor(new Date(new Date().toDateString()).getTime() / 1000);

    const allTime = tx.select({ c: sql<number>`count(*)` }).from(orders)
      .where(sql`${orders.status} != 'deleted'`).get()?.c ?? 0;

    const today = tx.select({ c: sql<number>`count(*)` }).from(orders)
      .where(sql`${orders.createdAt} >= ${dayStart} AND ${orders.status} != 'deleted'`)
      .get()?.c ?? 0;

    const fired = evaluateMilestones({ profileId: body.profileId, drinkId: body.drinkId }, tx);

    return { inserted: ins, firedMilestones: fired, countAllTime: allTime, countToday: today };
  });

  // Fire HA events outside the transaction (async, non-critical)
  let haResult: { success: boolean; error?: string } | null = null;
  if (drink.haTriggerEvent) {
    haResult = await fireEvent(drink.haTriggerEvent, {
      profile: profile.name,
      drink: drink.name,
      category: drink.category,
      count_today: countToday,
      count_all_time: countAllTime
    });
  }

  for (const m of firedMilestones) {
    await fireEvent(m.haTriggerEvent, {
      milestone: m.name,
      threshold: m.threshold,
      scope: m.scope,
      profile: profile.name,
      drink: drink.name
    });
  }

  // TTS announcement — queued, non-critical
  announceDrinkOrder(
    profile.id,
    profile.name,
    drink.name,
    firedMilestones.map((m) => ({ threshold: m.threshold, scope: m.scope }))
  );

  const payload = {
    order: { ...inserted, profileName: profile.name, profileColor: profile.color, drinkName: drink.name },
    counts: { allTime: countAllTime, today: countToday },
    firedMilestones: firedMilestones.map((m) => ({ id: m.id, name: m.name, scope: m.scope }))
  };

  broadcast('order', payload);

  return json({ ...payload, ha: haResult });
};
