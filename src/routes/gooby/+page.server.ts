import { getSettings, listConversations } from '$lib/gooby/db';
import { getLlamaStatus } from '$lib/gooby/llama';
import { readVisitorCount } from '$lib/site/visitors.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const [llama, conversations, settings] = await Promise.all([
    getLlamaStatus(),
    Promise.resolve(listConversations()),
    Promise.resolve(getSettings())
  ]);

  return {
    conversations,
    llama,
    settings,
    visitorCount: readVisitorCount()
  };
};
