<script lang="ts">
  import { goto } from '$app/navigation';
  import { selectedProfile } from '$lib/profile';
  import { setTitle } from '$lib/stores/title';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type Drink = PageData['drinks'][number];

  let search = $state('');
  let cart = $state<Drink[]>([]);
  let expanded = $state<number | null>(null);
  let submitting = $state(false);
  let toast = $state<string | null>(null);
  let showCart = $state(false);

  onMount(() => {
    if (!$selectedProfile) goto('/');
  });

  const filtered = $derived(
    search.trim()
      ? data.drinks.filter((d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.category.toLowerCase().includes(search.toLowerCase())
        )
      : data.drinks
  );

  const categories = $derived(Array.from(new Set(filtered.map((d) => d.category))));

  function byCategory(cat: string) {
    return filtered.filter((d) => d.category === cat);
  }

  function cartCount(drinkId: number) {
    return cart.filter((d) => d.id === drinkId).length;
  }

  function addToCart(drink: Drink) {
    cart = [...cart, drink];
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function removeFromCart(drinkId: number) {
    const idx = cart.findLastIndex((d) => d.id === drinkId);
    if (idx >= 0) cart = cart.filter((_, i) => i !== idx);
  }

  function clearCart() {
    cart = [];
    showCart = false;
  }

  async function submitCart() {
    if (!cart.length || !$selectedProfile) return;
    submitting = true;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: $selectedProfile.id, drinkIds: cart.map((d) => d.id) })
      });
      if (!res.ok) throw new Error('order failed');
      const result = await res.json();
      const fired = result.firedMilestones ?? [];
      const names = [...new Set(cart.map((d) => d.name))].join(', ');
      const suffix = fired.length ? ` 🎉 ${fired.map((m: { name: string }) => m.name).join(' · ')}` : '';
      toast = `Ordered: ${names}!${suffix}`;
      setTitle('Cheers! 🍹', 3000);
      cart = [];
      showCart = false;
      if (navigator.vibrate) navigator.vibrate(fired.length ? [30, 50, 30] : 30);
      setTimeout(() => (toast = null), fired.length ? 5000 : 3000);
    } catch {
      toast = 'Something went wrong';
      setTimeout(() => (toast = null), 2500);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="flex items-center gap-2 mb-4">
  <h1 class="text-2xl font-semibold">Menu</h1>
</div>

<input
  type="search"
  bind:value={search}
  placeholder="Search items…"
  class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-slate-600"
/>

{#each categories as cat}
  <section class="mb-6">
    <h2 class="text-xs uppercase tracking-widest text-slate-400 mb-2">{cat}</h2>
    <div class="grid grid-cols-2 gap-3">
      {#each byCategory(cat) as d (d.id)}
        <div class="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <!-- Image / tap to expand -->
          <button
            class="w-full text-left"
            onclick={() => (expanded = expanded === d.id ? null : d.id)}
          >
            {#if d.imageUrl}
              <img src={d.imageUrl} alt={d.name} class="w-full aspect-square object-cover" />
            {:else}
              {@const emoji = ({food:'🍽️',snack:'🍿',dessert:'🍰','non-alcoholic':'🥤',beer:'🍺',wine:'🍷',spirit:'🥃',cocktail:'🍸'} as Record<string,string>)[d.category] ?? '🍽️'}
              <div class="w-full aspect-square bg-slate-800 flex items-center justify-center text-4xl">
                {emoji}
              </div>
            {/if}
          </button>

          <div class="p-3">
            <div class="font-medium text-sm mb-0.5">{d.name}</div>
            {#if d.description}
              <div class="text-xs text-slate-400 line-clamp-1">{d.description}</div>
            {/if}

            <!-- Notes expand -->
            {#if expanded === d.id && d.notes}
              <div class="text-xs text-slate-400 mt-2 border-t border-slate-800 pt-2 whitespace-pre-line">{d.notes}</div>
            {/if}

            <!-- Add to cart controls -->
            <div class="flex items-center justify-between mt-2">
              {#if cartCount(d.id) === 0}
                <button
                  class="w-full py-1.5 rounded-lg bg-orange-500 text-slate-950 text-xs font-semibold hover:bg-orange-400 active:scale-95 transition"
                  onclick={() => addToCart(d)}
                >
                  Add
                </button>
              {:else}
                <div class="flex items-center gap-2 w-full justify-between">
                  <button
                    class="w-8 h-8 rounded-lg bg-slate-800 text-lg font-bold hover:bg-slate-700 active:scale-95 transition flex items-center justify-center"
                    onclick={() => removeFromCart(d.id)}
                  >−</button>
                  <span class="font-semibold tabular-nums">{cartCount(d.id)}</span>
                  <button
                    class="w-8 h-8 rounded-lg bg-orange-500 text-slate-950 text-lg font-bold hover:bg-orange-400 active:scale-95 transition flex items-center justify-center"
                    onclick={() => addToCart(d)}
                  >+</button>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/each}

{#if filtered.length === 0}
  <p class="text-center text-slate-500 text-sm py-12">No items match "{search}"</p>
{/if}

<!-- Floating cart button -->
{#if cart.length > 0 && !showCart}
  <button
    class="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-orange-500 text-slate-950 font-semibold px-6 py-3 rounded-full shadow-xl shadow-orange-900/40 active:scale-95 transition z-40"
    onclick={() => (showCart = true)}
  >
    <span class="bg-slate-950/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">{cart.length}</span>
    View order
  </button>
{/if}

<!-- Cart drawer -->
{#if showCart}
  <div class="fixed inset-0 z-50 flex items-end justify-center">
    <button class="absolute inset-0 bg-black/60" aria-label="Close" onclick={() => (showCart = false)}></button>
    <div class="relative bg-slate-900 border border-slate-800 rounded-t-2xl w-full max-w-lg p-6 pb-8">
      <h3 class="text-lg font-semibold mb-4">Your order — {$selectedProfile?.name}</h3>

      <div class="space-y-2 mb-6 max-h-60 overflow-y-auto">
        {#each [...new Set(cart.map((d) => d.id))] as id}
          {@const drink = cart.find((d) => d.id === id)!}
          {@const count = cartCount(id)}
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <button class="w-7 h-7 rounded bg-slate-800 text-sm hover:bg-slate-700" onclick={() => removeFromCart(id)}>−</button>
              <span class="w-4 text-center font-semibold tabular-nums">{count}</span>
              <button class="w-7 h-7 rounded bg-slate-800 text-sm hover:bg-slate-700" onclick={() => addToCart(drink)}>+</button>
            </div>
            <span class="flex-1">{drink.name}</span>
          </div>
        {/each}
      </div>

      <div class="flex gap-3">
        <button
          class="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm"
          onclick={clearCart}
        >Clear</button>
        <button
          class="flex-1 py-3 rounded-xl bg-orange-500 text-slate-950 font-semibold disabled:opacity-50"
          onclick={submitCart}
          disabled={submitting}
        >
          {submitting ? '…' : `Order ${cart.length} drink${cart.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if toast}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-full text-sm shadow-lg z-50 whitespace-nowrap">
    {toast}
  </div>
{/if}
