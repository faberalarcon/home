<script lang="ts">
  import { goto } from '$app/navigation';
  import { selectedProfile } from '$lib/profile';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type Profile = PageData['profiles'][number];

  function pick(p: Profile) {
    selectedProfile.set({ id: p.id, name: p.name, color: p.color });
    goto('/menu');
  }

  async function orderUsual(e: MouseEvent, p: Profile) {
    e.stopPropagation();
    if (!p.usualDrinkId) return;
    selectedProfile.set({ id: p.id, name: p.name, color: p.color });
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileId: p.id, drinkId: p.usualDrinkId })
    });
    goto('/recent');
  }

  function timeAgo(date: Date | null): string {
    if (!date) return '';
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
</script>

<h1 class="text-2xl font-semibold mb-1">Who's ordering?</h1>
<p class="text-slate-400 mb-6 text-sm">Tap your name to start.</p>

<div class="grid grid-cols-2 gap-3">
  {#each data.profiles as p (p.id)}
    <div
      class="rounded-2xl shadow-lg shadow-black/30 overflow-hidden"
      style="background-color: {p.color}20; border: 1px solid {p.color}60"
    >
      <!-- Profile pick area -->
      <button
        class="w-full p-4 text-left active:scale-[0.98] transition"
        onclick={() => pick(p)}
      >
        {#if p.avatarUrl}
          <img
            src={p.avatarUrl.replace('.webp', '-thumb.webp')}
            alt={p.name}
            class="w-12 h-12 rounded-full mb-2 object-cover"
          />
        {:else}
          <div
            class="w-12 h-12 rounded-full mb-2 flex items-center justify-center text-xl font-bold"
            style="background-color: {p.color}; color: #0f172a"
          >
            {p.name[0]}
          </div>
        {/if}

        <div class="text-base font-medium">{p.name}</div>

        {#if p.lastDrinkName}
          <div class="text-xs text-slate-400 mt-0.5 truncate">
            Last: {p.lastDrinkName} · {timeAgo(p.lastOrderedAt)}
          </div>
        {/if}
      </button>

      <!-- "The usual" — separate button below the card body -->
      {#if p.usualDrinkName}
        <button
          class="w-full text-xs py-2 px-4 font-medium border-t active:opacity-70 transition truncate"
          style="border-color: {p.color}30; color: {p.color}"
          onclick={(e) => orderUsual(e, p)}
        >
          The usual · {p.usualDrinkName}
        </button>
      {/if}
    </div>
  {/each}
</div>
