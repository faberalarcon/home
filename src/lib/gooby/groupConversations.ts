import type { GoobyConversation } from './useGoobyChat.svelte';

export type ConversationGroup = {
  key: 'today' | 'yesterday' | 'previous7' | 'older';
  label: string;
  items: GoobyConversation[];
};

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function groupConversations(conversations: GoobyConversation[], now: number = Date.now()): ConversationGroup[] {
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const week = today - 6 * 86_400_000;

  const groups: Record<ConversationGroup['key'], GoobyConversation[]> = {
    today: [],
    yesterday: [],
    previous7: [],
    older: []
  };

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const conversation of sorted) {
    const day = startOfDay(conversation.updatedAt);
    if (day >= today) groups.today.push(conversation);
    else if (day >= yesterday) groups.yesterday.push(conversation);
    else if (day >= week) groups.previous7.push(conversation);
    else groups.older.push(conversation);
  }

  const ordered: ConversationGroup[] = [
    { key: 'today', label: 'Today', items: groups.today },
    { key: 'yesterday', label: 'Yesterday', items: groups.yesterday },
    { key: 'previous7', label: 'Previous 7 days', items: groups.previous7 },
    { key: 'older', label: 'Older', items: groups.older }
  ];
  return ordered.filter((group) => group.items.length > 0);
}
