<script lang="ts">
  import { goto } from '$app/navigation';
  import { selectedProfile } from '$lib/profile';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type Drink = PageData['drinks'][number];

  let pending = $state<Drink | null>(null);
  let submitting = $state(false);
  let toast = $state<string | null>(null);

  onMount(() => {
    if (!$selectedProfile) goto('/');
  });

  const categories = $derived(
    Array.from(new Set(data.drinks.map((d) => d.category)))
  );

  function byCategory(cat: string) {
    return data.drinks.filter((d) => d.category === cat);
  }

  async function confirmOrder() {
    if (!pending || !$selectedProfile) return;
    submitting = true;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: $selectedProfile.id, drinkId: pending.id })
      });
      if (!res.ok) throw new Error('order failed');
      toast = `${pending.name} ordered!`;
      pending = null;
      if (navigator.vibrate) navigator.vibrate(30);
      setTimeout(() => (toast = null), 2500);
    } catch (err) {
      toast = 'Something went wrong';
      setTimeout(() => (toast = null), 2500);
    } finally {
      submitting = false;
    }
  }
</script>

<h1 class="text-2xl font-semibold mb-4">Menu</h1>

{#each categories as cat}
  <section class="mb-6">
    <h2 class="text-xs uppercase tracking-widest text-slate-400 mb-2">{cat}</h2>
    <div class="grid grid-cols-2 gap-3">
      {#each byCategory(cat) as d (d.id)}
        <button
          class="rounded-2xl p-4 text-left bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-[0.98] transition"
          onclick={() => (pending = d)}
        >
          {#if d.imageUrl}
            <img src={d.imageUrl} alt={d.name} class="w-full aspect-square object-cover rounded-xl mb-2" />
          {:else}
            <div class="w-full aspect-square rounded-xl mb-2 bg-slate-800 flex items-center justify-center text-4xl">
              🍸
            </div>
          {/if}
          <div class="font-medium">{d.name}</div>
          {#if d.description}
            <div class="text-xs text-slate-400 line-clamp-2">{d.description}</div>
          {/if}
        </button>
      {/each}
    </div>
  </section>
{/each}

{#if pending}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
    <button
      type="button"
      class="absolute inset-0 bg-black/60"
      aria-label="Close"
      onclick={() => (pending = null)}
    ></button>
    <div
      role="dialog"
      aria-modal="true"
      class="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm"
    >
      <h3 class="text-lg font-semibold mb-1">Order {pending.name}?</h3>
      <p class="text-sm text-slate-400 mb-4">For {$selectedProfile?.name}</p>
      <div class="flex gap-2">
        <button
          class="flex-1 py-3 rounded-xl bg-slate-800 text-slate-200"
          onclick={() => (pending = null)}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          class="flex-1 py-3 rounded-xl bg-orange-500 text-slate-950 font-semibold disabled:opacity-50"
          onclick={confirmOrder}
          disabled={submitting}
        >
          {submitting ? '...' : 'Confirm'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if toast}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-full text-sm shadow-lg z-50">
    {toast}
  </div>
{/if}
