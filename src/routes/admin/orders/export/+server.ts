import { db } from '$lib/server/db';
import { orders, profiles, drinks } from '$lib/server/db/schema';
import { eq, sql, gte, lte, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const format = url.searchParams.get('format') ?? 'csv';
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const conditions = [sql`${orders.status} != 'deleted'`];
  if (from) conditions.push(gte(orders.createdAt, new Date(from)));
  if (to) conditions.push(lte(orders.createdAt, new Date(to)));

  const rows = db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      profileName: profiles.name,
      drinkName: drinks.name,
      drinkCategory: drinks.category,
      status: orders.status
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.profileId, profiles.id))
    .innerJoin(drinks, eq(orders.drinkId, drinks.id))
    .where(and(...conditions))
    .orderBy(orders.createdAt)
    .all();

  if (format === 'json') {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="orders.json"'
      }
    });
  }

  // CSV
  const header = 'id,created_at,profile,drink,category,status\n';
  const lines = rows.map((r) => {
    const ts = r.createdAt ? new Date(r.createdAt).toISOString() : '';
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [r.id, ts, esc(r.profileName), esc(r.drinkName), esc(r.drinkCategory), r.status].join(',');
  });

  return new Response(header + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="orders.csv"'
    }
  });
};
