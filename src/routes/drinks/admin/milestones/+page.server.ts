import { db } from '$lib/drinks/server/db';
import { milestones, drinks, profiles } from '$lib/drinks/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { speakText, nextMilestoneMessage } from '$lib/drinks/server/tts';
import { appPath } from '$lib/drinks/app-paths';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const editId = url.searchParams.get('edit') ? Number(url.searchParams.get('edit')) : null;
  const all = db.select().from(milestones).orderBy(asc(milestones.name)).all();
  const editing = editId ? all.find((m) => m.id === editId) ?? null : null;

  const allDrinks = db.select({ id: drinks.id, name: drinks.name }).from(drinks).orderBy(asc(drinks.name)).all();
  const allProfiles = db.select({ id: profiles.id, name: profiles.name }).from(profiles).orderBy(asc(profiles.name)).all();

  const existingEvents = [
    ...new Set(all.map((m) => m.haTriggerEvent).filter(Boolean))
  ] as string[];

  return { milestones: all, editing, allDrinks, allProfiles, existingEvents };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const fd = await request.formData();
    const id = fd.get('id') ? Number(fd.get('id')) : null;
    const name = (fd.get('name') as string | null)?.trim();
    const threshold = Number(fd.get('threshold') ?? 0);
    const scope = (fd.get('scope') as string | null) ?? 'all_time';
    const haTriggerEvent = (fd.get('haTriggerEvent') as string | null)?.trim() ?? '';
    const enabled = fd.get('enabled') === 'on';
    const drinkIdRaw = fd.get('drinkId');
    const profileIdRaw = fd.get('profileId');
    const drinkId = drinkIdRaw ? Number(drinkIdRaw) || null : null;
    const profileId = profileIdRaw ? Number(profileIdRaw) || null : null;

    if (!name) return fail(400, { error: 'Name is required' });
    if (!haTriggerEvent) return fail(400, { error: 'HA trigger event is required' });
    if (!threshold || threshold < 1) return fail(400, { error: 'Threshold must be at least 1' });

    if (id) {
      const existing = db.select().from(milestones).where(eq(milestones.id, id)).get();
      if (!existing) return fail(404, { error: 'Milestone not found' });
      db.update(milestones)
        .set({ name, threshold, scope, haTriggerEvent, enabled, drinkId, profileId })
        .where(eq(milestones.id, id))
        .run();
    } else {
      db.insert(milestones)
        .values({ name, threshold, scope, haTriggerEvent, enabled, drinkId, profileId })
        .run();
    }

    redirect(303, appPath('/admin/milestones'));
  },

  delete: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });
    db.delete(milestones).where(eq(milestones.id, id)).run();
    redirect(303, appPath('/admin/milestones'));
  },

  testTts: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    if (!id) return fail(400, { error: 'Missing id', tested: null, ttsMessage: null });

    const m = db.select().from(milestones).where(eq(milestones.id, id)).get();
    if (!m) return fail(404, { error: 'Milestone not found', tested: null, ttsMessage: null });

    const extra = nextMilestoneMessage(m.threshold, m.scope, m.haTriggerEvent);
    const ttsMessage = extra ?? `No TTS message configured for "${m.name}".`;

    await speakText(ttsMessage);
    console.log(`[milestones] test TTS fired for "${m.name}": ${ttsMessage}`);

    return { tested: id, ttsMessage, error: null };
  }
};
