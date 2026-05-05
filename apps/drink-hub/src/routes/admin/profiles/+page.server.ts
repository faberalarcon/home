import { db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { saveImage } from '$lib/server/uploads';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const editId = url.searchParams.get('edit') ? Number(url.searchParams.get('edit')) : null;
  const all = db.select().from(profiles).orderBy(asc(profiles.name)).all();
  const editing = editId ? all.find((p) => p.id === editId) ?? null : null;
  return { profiles: all, editing };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const fd = await request.formData();
    const id = fd.get('id') ? Number(fd.get('id')) : null;
    const name = (fd.get('name') as string | null)?.trim();
    const color = (fd.get('color') as string | null)?.trim() || '#f97316';
    const active = fd.get('active') === 'on';
    const weightKg = fd.get('weight_kg') ? Number(fd.get('weight_kg')) : null;
    const biologicalSexRaw = (fd.get('biological_sex') as string | null) || null;
    const biologicalSex = (biologicalSexRaw === 'male' || biologicalSexRaw === 'female') ? biologicalSexRaw : null;
    const imageFile = fd.get('avatar') as File | null;

    if (!name) return fail(400, { error: 'Name is required' });
    if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500)) return fail(400, { error: 'Weight must be between 1 and 500 kg' });
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return fail(400, { error: 'Invalid color format' });

    if (id) {
      const existing = db.select().from(profiles).where(eq(profiles.id, id)).get();
      if (!existing) return fail(404, { error: 'Profile not found' });

      let avatarUrl = existing.avatarUrl;
      if (imageFile && imageFile.size > 0) {
        try {
          avatarUrl = await saveImage(imageFile, 'profiles', id, name);
        } catch (err) {
          return fail(400, { error: err instanceof Error ? err.message : 'Image upload failed' });
        }
      }

      db.update(profiles).set({ name, color, active, avatarUrl, weightKg, biologicalSex }).where(eq(profiles.id, id)).run();
    } else {
      const inserted = db.insert(profiles)
        .values({ name, color, active, weightKg, biologicalSex })
        .returning({ id: profiles.id })
        .get();

      if (imageFile && imageFile.size > 0) {
        try {
          const avatarUrl = await saveImage(imageFile, 'profiles', inserted.id, name);
          db.update(profiles).set({ avatarUrl }).where(eq(profiles.id, inserted.id)).run();
        } catch (err) {
          return fail(400, { error: err instanceof Error ? err.message : 'Image upload failed' });
        }
      }
    }

    redirect(303, '/admin/profiles');
  },

  delete: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });
    try {
      db.delete(profiles).where(eq(profiles.id, id)).run();
    } catch {
      // FK constraint — profile has orders; deactivate instead
      db.update(profiles).set({ active: false }).where(eq(profiles.id, id)).run();
    }
    redirect(303, '/admin/profiles');
  }
};
