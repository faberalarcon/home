import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { orders, drinks, profiles } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { fireEvent } from '$lib/server/ha';
import { evaluateMilestones } from '$lib/server/milestones';
import { broadcast } from '$lib/server/stream';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.profileId !== 'number' || typeof body.drinkId !== 'number') {
    throw error(400, 'profileId and drinkId required');
  }

  const profile = db.select().from(profiles).where(eq(profiles.id, body.profileId)).get();
  const drink = db.select().from(drinks).where(eq(drinks.id, body.drinkId)).get();
  if (!profile || !drink) throw error(404, 'profile or drink not found');

  const inserted = db
    .insert(orders)
    .values({
      profileId: body.profileId,
      drinkId: body.drinkId,
      notes: typeof body.notes === 'string' ? body.notes : null
    })
    .returning()
    .get();

  const countAllTime = db.select({ c: sql<number>`count(*)` }).from(orders).get()?.c ?? 0;

  const dayStart = Math.floor(
    new Date(new Date().toDateString()).getTime() / 1000
  );
  const countToday = db
    .select({ c: sql<number>`count(*)` })
    .from(orders)
    .where(sql`${orders.createdAt} >= ${dayStart}`)
    .get()?.c ?? 0;

  // Per-drink HA event
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

  // Milestone evaluation
  const firedMilestones = evaluateMilestones({ profileId: body.profileId, drinkId: body.drinkId });

  // Fire HA events for each triggered milestone
  for (const m of firedMilestones) {
    await fireEvent(m.haTriggerEvent, {
      milestone: m.name,
      threshold: m.threshold,
      scope: m.scope,
      profile: profile.name,
      drink: drink.name
    });
  }

  const payload = {
    order: { ...inserted, profileName: profile.name, profileColor: profile.color, drinkName: drink.name },
    counts: { allTime: countAllTime, today: countToday },
    firedMilestones: firedMilestones.map((m) => ({ id: m.id, name: m.name, scope: m.scope }))
  };

  broadcast('order', payload);

  return json({ ...payload, ha: haResult });
};
