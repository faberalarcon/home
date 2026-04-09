import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { orders, profiles, drinks } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { broadcast } from '$lib/server/stream';
import type { RequestHandler } from './$types';

// Soft-delete an order (status → 'deleted').
export const DELETE: RequestHandler = ({ params }) => {
  const id = Number(params.id);
  if (!id) throw error(400, 'Invalid id');

  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) throw error(404, 'Order not found');
  if (order.status === 'deleted') throw error(409, 'Already deleted');

  db.update(orders).set({ status: 'deleted' }).where(eq(orders.id, id)).run();

  const dayStart = Math.floor(new Date(new Date().toDateString()).getTime() / 1000);
  const countAllTime = db.select({ c: sql<number>`count(*)` }).from(orders)
    .where(sql`${orders.status} != 'deleted'`).get()?.c ?? 0;
  const countToday = db.select({ c: sql<number>`count(*)` }).from(orders)
    .where(sql`${orders.createdAt} >= ${dayStart} AND ${orders.status} != 'deleted'`)
    .get()?.c ?? 0;

  broadcast('order.deleted', { orderId: id, counts: { allTime: countAllTime, today: countToday } });

  return json({ ok: true });
};

// Restore a soft-deleted order.
export const PUT: RequestHandler = ({ params }) => {
  const id = Number(params.id);
  if (!id) throw error(400, 'Invalid id');

  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) throw error(404, 'Order not found');

  db.update(orders).set({ status: 'placed' }).where(eq(orders.id, id)).run();

  const dayStart = Math.floor(new Date(new Date().toDateString()).getTime() / 1000);
  const countAllTime = db.select({ c: sql<number>`count(*)` }).from(orders)
    .where(sql`${orders.status} != 'deleted'`).get()?.c ?? 0;
  const countToday = db.select({ c: sql<number>`count(*)` }).from(orders)
    .where(sql`${orders.createdAt} >= ${dayStart} AND ${orders.status} != 'deleted'`)
    .get()?.c ?? 0;

  broadcast('order.restored', { orderId: id, counts: { allTime: countAllTime, today: countToday } });

  return json({ ok: true });
};

// Reassign an order to a different profile (within 5 minutes of creation).
export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) throw error(400, 'Invalid id');

  const body = await request.json().catch(() => null);
  if (!body || typeof body.profileId !== 'number') {
    throw error(400, 'profileId required');
  }

  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) throw error(404, 'Order not found');
  if (order.status === 'deleted') throw error(409, 'Cannot edit a deleted order');

  const ageSec = Math.floor((Date.now() - (order.createdAt?.getTime() ?? 0)) / 1000);
  if (ageSec > 300) throw error(403, 'Order is older than 5 minutes');

  const profile = db.select().from(profiles).where(eq(profiles.id, body.profileId)).get();
  if (!profile) throw error(404, 'Profile not found');

  db.update(orders).set({ profileId: body.profileId }).where(eq(orders.id, id)).run();

  const drink = db.select().from(drinks).where(eq(drinks.id, order.drinkId)).get();

  broadcast('order.updated', {
    orderId: id,
    profileId: body.profileId,
    profileName: profile.name,
    profileColor: profile.color,
    drinkName: drink?.name
  });

  return json({ ok: true });
};
