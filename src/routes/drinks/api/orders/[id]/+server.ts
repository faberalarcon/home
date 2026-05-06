import { json, error } from '@sveltejs/kit';
import { db } from '$lib/drinks/server/db';
import { orders, profiles, drinks } from '$lib/drinks/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { broadcast } from '$lib/drinks/server/stream';
import type { RequestHandler } from './$types';

// Soft-delete an order (status → 'deleted'). Admin only.
export const DELETE: RequestHandler = ({ params, locals }) => {
  if (!locals.adminAuthenticated) throw error(403, 'Admin access required');

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

// Restore a soft-deleted order. Admin only.
export const PUT: RequestHandler = ({ params, locals }) => {
  if (!locals.adminAuthenticated) throw error(403, 'Admin access required');

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

// Reassign an order to a different profile (within 5 minutes). Requires site session.
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.siteAuthenticated) throw error(401, 'Authentication required');

  const id = Number(params.id);
  if (!id) throw error(400, 'Invalid id');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  if (!body || typeof body !== 'object') throw error(400, 'Request body must be a JSON object');
  const b = body as Record<string, unknown>;

  if (typeof b.profileId !== 'number' || !Number.isInteger(b.profileId) || b.profileId < 1) {
    throw error(400, 'profileId must be a positive integer');
  }

  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) throw error(404, 'Order not found');
  if (order.status === 'deleted') throw error(409, 'Cannot edit a deleted order');

  const ageSec = Math.floor((Date.now() - (order.createdAt?.getTime() ?? 0)) / 1000);
  if (ageSec > 300) throw error(403, 'Order is older than 5 minutes');

  const profile = db.select().from(profiles).where(eq(profiles.id, b.profileId)).get();
  if (!profile) throw error(404, 'Profile not found');

  db.update(orders).set({ profileId: b.profileId }).where(eq(orders.id, id)).run();

  const drink = db.select().from(drinks).where(eq(drinks.id, order.drinkId)).get();

  broadcast('order.updated', {
    orderId: id,
    profileId: b.profileId,
    profileName: profile.name,
    profileColor: profile.color,
    drinkName: drink?.name
  });

  return json({ ok: true });
};
