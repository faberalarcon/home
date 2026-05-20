<script lang="ts">
  import { goto } from '$app/navigation';
  import { appPath, thumbPath } from '$lib/drinks/app-paths';
  import { selectedProfile } from '$lib/drinks/profile';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type Profile = PageData['profiles'][number];

  function pick(p: Profile) {
    selectedProfile.set({ id: p.id, name: p.name, color: p.color });
    goto(appPath('/menu'));
  }

  async function orderUsual(e: MouseEvent, p: Profile) {
    e.stopPropagation();
    if (!p.usualDrinkId) return;
    selectedProfile.set({ id: p.id, name: p.name, color: p.color });
    await fetch(appPath('/api/orders'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileId: p.id, drinkId: p.usualDrinkId })
    });
    goto(appPath('/recent'));
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

<header class="mb-6">
  <p class="dossier-kicker">Drinks</p>
  <h1 class="text-4xl mb-2">Who's ordering?</h1>
  <p class="text-sm" style="color: var(--color-ink-500)">Tap your name to start.</p>
</header>

<div class="grid grid-cols-2 gap-3">
  {#each data.profiles as p (p.id)}
    <div
      class="profile-tile overflow-hidden"
      style="--profile-color: {p.color}"
    >
      <!-- Profile pick area -->
      <button
        class="w-full p-4 text-left active:scale-[0.98] transition"
        onclick={() => pick(p)}
      >
        {#if p.avatarUrl}
          <img
            src={thumbPath(p.avatarUrl)}
            alt={p.name}
            class="profile-avatar mb-2 object-cover"
          />
        {:else}
          <div
            class="profile-avatar mb-2 flex items-center justify-center text-xl font-bold"
            style="background-color: {p.color}; color: var(--color-paper-50)"
          >
            {p.name[0]}
          </div>
        {/if}

        <div class="text-base font-medium">{p.name}</div>

        {#if p.lastDrinkName}
          <div class="text-xs mt-0.5 truncate" style="color: var(--color-ink-500)">
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

<style>
  .profile-tile {
    border-radius: var(--radius);
    background:
      linear-gradient(135deg, color-mix(in oklab, var(--profile-color) 20%, var(--color-paper-50)), var(--color-paper-100));
    border: 1px solid color-mix(in oklab, var(--profile-color) 50%, var(--color-paper-300));
    transition: transform 0.16s ease, border-color 0.16s ease;
  }
  .profile-tile:hover {
    transform: translateY(-2px);
    border-color: color-mix(in oklab, var(--profile-color) 80%, var(--color-blood-500));
  }
  .profile-avatar {
    width: 3rem;
    height: 3rem;
    border-radius: var(--radius-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    .profile-tile { transition: none; }
    .profile-tile:hover { transform: none; }
  }
</style>
