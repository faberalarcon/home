import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  color: text('color').notNull().default('#f97316'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

export const drinks = sqliteTable('drinks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().default('drink'),
  imageUrl: text('image_url'),
  haTriggerEvent: text('ha_trigger_event'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0)
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id')
    .notNull()
    .references(() => profiles.id),
  drinkId: integer('drink_id')
    .notNull()
    .references(() => drinks.id),
  status: text('status').notNull().default('placed'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

export const milestones = sqliteTable('milestones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  threshold: integer('threshold').notNull(),
  scope: text('scope').notNull(), // all_time | daily | weekly | per_drink | per_profile
  drinkId: integer('drink_id').references(() => drinks.id),
  profileId: integer('profile_id').references(() => profiles.id),
  haTriggerEvent: text('ha_trigger_event').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastFiredAt: integer('last_fired_at', { mode: 'timestamp' })
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

export const haEventsLog = sqliteTable('ha_events_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(),
  payload: text('payload').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

export type Profile = typeof profiles.$inferSelect;
export type Drink = typeof drinks.$inferSelect;
export type Order = typeof orders.$inferSelect;
