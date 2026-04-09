<script lang="ts">
  import { goto } from '$app/navigation';
  import { selectedProfile } from '$lib/profile';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function pick(p: { id: number; name: string; color: string }) {
    selectedProfile.set({ id: p.id, name: p.name, color: p.color });
    goto('/menu');
  }
</script>

<h1 class="text-2xl font-semibold mb-1">Who's ordering?</h1>
<p class="text-slate-400 mb-6 text-sm">Tap your name to start.</p>

<div class="grid grid-cols-2 gap-3">
  {#each data.profiles as p (p.id)}
    <button
      class="rounded-2xl p-6 text-left shadow-lg shadow-black/30 active:scale-[0.98] transition"
      style="background-color: {p.color}20; border: 1px solid {p.color}60"
      onclick={() => pick(p)}
    >
      {#if p.avatarUrl}
        <img
          src={p.avatarUrl.replace('.webp', '-thumb.webp')}
          alt={p.name}
          class="w-12 h-12 rounded-full mb-3 object-cover"
        />
      {:else}
        <div
          class="w-12 h-12 rounded-full mb-3 flex items-center justify-center text-xl font-bold"
          style="background-color: {p.color}; color: #0f172a"
        >
          {p.name[0]}
        </div>
      {/if}
      <div class="text-lg font-medium">{p.name}</div>
    </button>
  {/each}
</div>
