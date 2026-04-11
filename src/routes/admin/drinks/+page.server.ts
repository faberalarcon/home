import { db } from '$lib/server/db';
import { drinks } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { saveImage } from '$lib/server/uploads';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const editId = url.searchParams.get('edit') ? Number(url.searchParams.get('edit')) : null;
  const showInactive = url.searchParams.get('inactive') === '1';

  const all = db.select().from(drinks).orderBy(asc(drinks.sortOrder), asc(drinks.name)).all();
  const visible = showInactive ? all : all.filter((d) => d.active);
  const editing = editId ? all.find((d) => d.id === editId) ?? null : null;

  const existingEvents = [
    ...new Set(all.map((d) => d.haTriggerEvent).filter(Boolean))
  ] as string[];

  const inactiveCount = all.filter((d) => !d.active).length;

  return { drinks: visible, editing, existingEvents, showInactive, inactiveCount };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const fd = await request.formData();
    const id = fd.get('id') ? Number(fd.get('id')) : null;
    const name = (fd.get('name') as string | null)?.trim();
    const description = (fd.get('description') as string | null)?.trim() || null;
    const notes = (fd.get('notes') as string | null)?.trim() || null;
    const category = (fd.get('category') as string | null)?.trim() || 'drink';
    const haTriggerEvent = (fd.get('haTriggerEvent') as string | null)?.trim() || null;
    const active = fd.get('active') === 'on';
    const sortOrder = Number(fd.get('sortOrder') ?? 0) || 0;
    const abv = fd.get('abv') ? Number(fd.get('abv')) : null;
    const volumeMl = fd.get('volume_ml') ? Number(fd.get('volume_ml')) : null;
    const imageFile = fd.get('image') as File | null;

    if (!name) return fail(400, { error: 'Name is required', fields: { name, description, category, haTriggerEvent, active, sortOrder } });

    if (id) {
      const existing = db.select().from(drinks).where(eq(drinks.id, id)).get();
      if (!existing) return fail(404, { error: 'Drink not found' });

      let imageUrl = existing.imageUrl;
      if (imageFile && imageFile.size > 0) {
        try {
          imageUrl = await saveImage(imageFile, 'items', id, name);
        } catch (err) {
          return fail(400, { error: err instanceof Error ? err.message : 'Image upload failed' });
        }
      }

      db.update(drinks)
        .set({ name, description, notes, category, haTriggerEvent, active, sortOrder, imageUrl, abv, volumeMl })
        .where(eq(drinks.id, id))
        .run();
    } else {
      const inserted = db.insert(drinks)
        .values({ name, description, notes, category, haTriggerEvent, active, sortOrder, abv, volumeMl })
        .returning({ id: drinks.id })
        .get();

      if (imageFile && imageFile.size > 0) {
        try {
          const imageUrl = await saveImage(imageFile, 'items', inserted.id, name);
          db.update(drinks).set({ imageUrl }).where(eq(drinks.id, inserted.id)).run();
        } catch (err) {
          return fail(400, { error: err instanceof Error ? err.message : 'Image upload failed' });
        }
      }
    }

    redirect(303, '/admin/drinks');
  },

  toggleActive: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });
    const drink = db.select().from(drinks).where(eq(drinks.id, id)).get();
    if (!drink) return fail(404, { error: 'Drink not found' });
    db.update(drinks).set({ active: !drink.active }).where(eq(drinks.id, id)).run();
    const params = !drink.active ? '' : '?inactive=1'; // if we just hid it, stay on current view
    redirect(303, `/admin/drinks${params}`);
  },

  delete: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });
    try {
      db.delete(drinks).where(eq(drinks.id, id)).run();
    } catch {
      // FK constraint — drink has orders; deactivate instead
      db.update(drinks).set({ active: false }).where(eq(drinks.id, id)).run();
    }
    redirect(303, '/admin/drinks');
  }
};
