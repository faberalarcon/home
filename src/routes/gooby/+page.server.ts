import { listConversations } from '$lib/gooby/db';
import { getGoobyLlamaStatus } from '$lib/gooby/llama';
import { readVisitorCount } from '$lib/site/visitors.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const [llama, conversations] = await Promise.all([
    getGoobyLlamaStatus(),
    Promise.resolve(listConversations())
  ]);

  return {
    conversations,
    llama,
    visitorCount: readVisitorCount()
  };
};
