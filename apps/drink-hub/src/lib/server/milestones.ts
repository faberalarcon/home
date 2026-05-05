import { db } from './db/index';
import { milestones, orders } from './db/schema';
import { eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

type Milestone = typeof milestones.$inferSelect;
type OrderRef = { profileId: number; drinkId: number };
// BaseSQLiteDatabase is the common base for both the main db and transaction contexts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = BaseSQLiteDatabase<'sync', any, any>;

function startOfDayLocal(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
}

function startOfWeekLocal(): number {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Math.floor(monday.getTime() / 1000);
}

function getCount(m: Milestone, order: OrderRef, tx: Tx): number | null {
  const active = sql`${orders.status} != 'deleted'`;
  switch (m.scope) {
    case 'all_time':
      return tx.select({ c: sql<number>`count(*)` }).from(orders).where(active).get()?.c ?? 0;

    case 'daily':
      return tx.select({ c: sql<number>`count(*)` }).from(orders)
        .where(sql`${orders.createdAt} >= ${startOfDayLocal()} AND ${orders.status} != 'deleted'`)
        .get()?.c ?? 0;

    case 'weekly':
      return tx.select({ c: sql<number>`count(*)` }).from(orders)
        .where(sql`${orders.createdAt} >= ${startOfWeekLocal()} AND ${orders.status} != 'deleted'`)
        .get()?.c ?? 0;

    case 'per_drink':
      if (!m.drinkId) return null;
      return tx.select({ c: sql<number>`count(*)` }).from(orders)
        .where(sql`${orders.drinkId} = ${m.drinkId} AND ${orders.status} != 'deleted'`)
        .get()?.c ?? 0;

    case 'per_profile': {
      // If milestone targets a specific profile, count that profile's orders.
      // If no profileId set, count the ordering profile's orders (fires for anyone).
      const pid = m.profileId ?? order.profileId;
      return tx.select({ c: sql<number>`count(*)` }).from(orders)
        .where(sql`${orders.profileId} = ${pid} AND ${orders.status} != 'deleted'`)
        .get()?.c ?? 0;
    }

    default:
      return null;
  }
}

// Use day/week start buckets to detect re-fire eligibility — avoids edge cases
// where an idle gap after the window boundary would suppress a valid fire.
function alreadyFiredInWindow(m: Milestone): boolean {
  if (!m.lastFiredAt) return false;
  const ts = Math.floor(m.lastFiredAt.getTime() / 1000);
  if (m.scope === 'daily') return ts >= startOfDayLocal();
  if (m.scope === 'weekly') return ts >= startOfWeekLocal();
  return false;
}

// tx defaults to the main db; pass a transaction context when calling inside
// db.transaction() to keep the insert + evaluation atomic.
export function evaluateMilestones(order: OrderRef, tx: Tx = db): Milestone[] {
  const all = tx.select().from(milestones).where(eq(milestones.enabled, true)).all();
  if (all.length === 0) return [];

  const fired: Milestone[] = [];
  for (const m of all) {
    const count = getCount(m, order, tx);
    if (count === null || count !== m.threshold) continue;
    if (alreadyFiredInWindow(m)) continue;

    tx.update(milestones).set({ lastFiredAt: new Date() }).where(eq(milestones.id, m.id)).run();
    fired.push(m);
  }
  return fired;
}
