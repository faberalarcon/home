import { db } from './db/index';
import { milestones, orders } from './db/schema';
import { eq, sql } from 'drizzle-orm';

type Milestone = typeof milestones.$inferSelect;
type OrderRef = { profileId: number; drinkId: number };

function startOfDayLocal(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
}

function startOfWeekLocal(): number {
  const now = new Date();
  const day = now.getDay(); // 0=Sunday
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Math.floor(monday.getTime() / 1000);
}

function getCount(m: Milestone, order: OrderRef): number | null {
  switch (m.scope) {
    case 'all_time':
      return db.select({ c: sql<number>`count(*)` }).from(orders).get()?.c ?? 0;

    case 'daily':
      return db.select({ c: sql<number>`count(*)` }).from(orders)
        .where(sql`${orders.createdAt} >= ${startOfDayLocal()}`)
        .get()?.c ?? 0;

    case 'weekly':
      return db.select({ c: sql<number>`count(*)` }).from(orders)
        .where(sql`${orders.createdAt} >= ${startOfWeekLocal()}`)
        .get()?.c ?? 0;

    case 'per_drink':
      if (!m.drinkId) return null;
      return db.select({ c: sql<number>`count(*)` }).from(orders)
        .where(eq(orders.drinkId, m.drinkId))
        .get()?.c ?? 0;

    case 'per_profile':
      if (!m.profileId) return null;
      return db.select({ c: sql<number>`count(*)` }).from(orders)
        .where(eq(orders.profileId, m.profileId))
        .get()?.c ?? 0;

    default:
      return null;
  }
}

function alreadyFiredInWindow(m: Milestone): boolean {
  if (!m.lastFiredAt) return false;
  const ts = Math.floor(m.lastFiredAt.getTime() / 1000);
  if (m.scope === 'daily') return ts >= startOfDayLocal();
  if (m.scope === 'weekly') return ts >= startOfWeekLocal();
  return false;
}

export function evaluateMilestones(order: OrderRef): Milestone[] {
  const all = db.select().from(milestones).where(eq(milestones.enabled, true)).all();
  if (all.length === 0) return [];

  const fired: Milestone[] = [];

  for (const m of all) {
    const count = getCount(m, order);
    if (count === null || count !== m.threshold) continue;
    if (alreadyFiredInWindow(m)) continue;

    db.update(milestones).set({ lastFiredAt: new Date() }).where(eq(milestones.id, m.id)).run();
    fired.push(m);
  }

  return fired;
}
