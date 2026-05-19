<script lang="ts">
  import { goto } from '$app/navigation';
  import { appPath, assetPath } from '$lib/drinks/app-paths';
  import { selectedProfile } from '$lib/drinks/profile';
  import { setTitle } from '$lib/drinks/stores/title';
  import VoiceOrderButton from '$lib/drinks/components/VoiceOrderButton.svelte';
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
    if (!$selectedProfile) {
      goto(appPath('/'));
      return;
    }
    fetch(appPath('/api/tts/preload'), { method: 'POST' }).catch(() => {});
    const beat = setInterval(() => {
      fetch(appPath('/api/tts/heartbeat'), { method: 'POST' }).catch(() => {});
    }, 30_000);
    return () => clearInterval(beat);
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

  const submitLabel = $derived.by(() => {
    if (!cart.length) return 'Order';
    const distinct: Array<{ name: string; count: number }> = [];
    for (const d of cart) {
      const existing = distinct.find((x) => x.name === d.name);
      if (existing) existing.count += 1;
      else distinct.push({ name: d.name, count: 1 });
    }
    const itemized =
      distinct.length === 1 && distinct[0].count === 1
        ? `Order ${distinct[0].name}`
        : `Order ${distinct.map((d) => `${d.count} × ${d.name}`).join(', ')}`;
    return itemized.length > 40
      ? `Order ${cart.length} item${cart.length === 1 ? '' : 's'}`
      : itemized;
  });

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
      const res = await fetch(appPath('/api/orders'), {
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

<header class="menu-head">
  <div>
    <p class="dossier-kicker">Drink Hub</p>
    <h1>Menu</h1>
  </div>
</header>

<input
  type="search"
  bind:value={search}
  placeholder="Search items…"
  class="dossier-input menu-search"
/>

{#each categories as cat}
  <section class="mb-6">
    <h2 class="text-xs uppercase tracking-widest text-slate-400 mb-2">{cat}</h2>
    <div class="grid grid-cols-2 gap-3">
      {#each byCategory(cat) as d (d.id)}
        <div class="drink-tile overflow-hidden">
          <!-- Image / tap to expand -->
          <button
            class="w-full text-left"
            onclick={() => (expanded = expanded === d.id ? null : d.id)}
          >
            {#if d.imageUrl}
              <img src={assetPath(d.imageUrl)} alt={d.name} class="w-full aspect-square object-cover" />
            {:else}
              {@const emoji = ({food:'🍽️',snack:'🍿',dessert:'🍰','non-alcoholic':'🥤',beer:'🍺',wine:'🍷',spirit:'🥃',cocktail:'🍸'} as Record<string,string>)[d.category] ?? '🍽️'}
              <div class="w-full aspect-square fallback-art flex items-center justify-center text-4xl">
                {emoji}
              </div>
            {/if}
          </button>

          <div class="p-3">
            <div class="drink-name">{d.name}</div>
            {#if d.description}
              <div class="drink-description line-clamp-1">{d.description}</div>
            {/if}

            <!-- Notes expand -->
            {#if expanded === d.id && d.notes}
              <div class="drink-notes whitespace-pre-line">{d.notes}</div>
            {/if}

            <!-- Add to cart controls -->
            <div class="flex items-center justify-between mt-2">
              {#if cartCount(d.id) === 0}
                <button
                  class="drink-action drink-action--primary"
                  onclick={() => addToCart(d)}
                >
                  Add
                </button>
              {:else}
                <div class="flex items-center gap-2 w-full justify-between">
                  <button
                    class="drink-stepper"
                    onclick={() => removeFromCart(d.id)}
                  >−</button>
                  <span class="font-semibold tabular-nums">{cartCount(d.id)}</span>
                  <button
                    class="drink-stepper drink-stepper--primary"
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
    class="floating-cart"
    onclick={() => (showCart = true)}
  >
    <span class="floating-cart__count">{cart.length}</span>
    View order
  </button>
{/if}

<!-- Cart drawer -->
{#if showCart}
  <div class="fixed inset-0 z-50 flex items-end justify-center">
    <button class="absolute inset-0 bg-black/60" aria-label="Close" onclick={() => (showCart = false)}></button>
    <div class="cart-drawer">
      <h3 class="text-lg font-semibold mb-4">Your order — {$selectedProfile?.name}</h3>

      <div class="space-y-2 mb-6 max-h-60 overflow-y-auto">
        {#each [...new Set(cart.map((d) => d.id))] as id}
          {@const drink = cart.find((d) => d.id === id)!}
          {@const count = cartCount(id)}
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <button class="cart-stepper" onclick={() => removeFromCart(id)}>−</button>
              <span class="w-4 text-center font-semibold tabular-nums">{count}</span>
              <button class="cart-stepper" onclick={() => addToCart(drink)}>+</button>
            </div>
            <span class="flex-1">{drink.name}</span>
          </div>
        {/each}
      </div>

      <div class="flex gap-3">
        <button
          class="cart-button"
          onclick={clearCart}
        >Clear</button>
        <button
          class="cart-button cart-button--primary disabled:opacity-50"
          onclick={submitCart}
          disabled={submitting}
        >
          {submitting ? '…' : submitLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if toast}
  <div class="toast">
    {toast}
  </div>
{/if}

<VoiceOrderButton
  onSubmitted={(summary) => {
    toast = `Voice order placed: ${summary}`;
    setTitle('Cheers! 🍹', 3000);
    setTimeout(() => (toast = null), 3000);
  }}
  onError={(message) => {
    toast = message;
    setTimeout(() => (toast = null), 2500);
  }}
/>

<style>
  .menu-head {
    margin-bottom: 1rem;
    display: flex;
    align-items: end;
    justify-content: space-between;
  }
  .menu-head h1 { font-size: clamp(2.25rem, 10vw, 4rem); }
  .menu-search { margin-bottom: 1.35rem; }
  section h2 {
    color: var(--color-blood-500);
    font-size: 0.72rem;
    letter-spacing: 0.18em;
  }
  .drink-tile {
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius);
    background: var(--color-paper-100);
    transition: transform 0.16s ease, border-color 0.16s ease;
  }
  .drink-tile:hover {
    transform: translateY(-2px);
    border-color: var(--color-blood-300);
  }
  .fallback-art { background: color-mix(in oklab, var(--color-paper-200) 75%, var(--color-olive-300)); }
  .drink-name {
    color: var(--color-ink-900);
    font-weight: 700;
    font-size: 0.92rem;
  }
  .drink-description,
  .drink-notes {
    color: var(--color-ink-500);
    font-size: 0.76rem;
  }
  .drink-notes {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-paper-300);
  }
  .drink-action,
  .drink-stepper,
  .cart-stepper,
  .cart-button {
    border: 1px solid var(--color-paper-300);
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    border-radius: var(--radius-sm);
    transition: transform 0.12s ease, background 0.12s ease;
  }
  .drink-action {
    width: 100%;
    padding: 0.42rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 800;
  }
  .drink-action--primary,
  .drink-stepper--primary,
  .cart-button--primary,
  .floating-cart {
    border-color: var(--color-blood-500);
    background: var(--color-blood-500);
    color: var(--color-paper-50);
  }
  .drink-stepper {
    width: 2rem;
    height: 2rem;
    font-size: 1.1rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .drink-action:active,
  .drink-stepper:active,
  .cart-button:active,
  .floating-cart:active { transform: scale(0.96); }
  .floating-cart {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.8rem 1.25rem;
    border-radius: var(--radius);
    font-weight: 800;
    box-shadow: 0 16px 42px color-mix(in oklab, var(--color-blood-600) 28%, transparent);
  }
  .floating-cart__count {
    min-width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--color-paper-50) 20%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
  }
  .cart-drawer {
    position: relative;
    width: 100%;
    max-width: 32rem;
    padding: 1.5rem 1.5rem 2rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius) var(--radius) 0 0;
    background: var(--color-paper-50);
  }
  .cart-stepper {
    width: 1.75rem;
    height: 1.75rem;
  }
  .cart-button {
    flex: 1;
    padding: 0.8rem;
    font-size: 0.9rem;
    font-weight: 750;
  }
  .toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    max-width: calc(100vw - 2rem);
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius);
    background: var(--color-paper-100);
    color: var(--color-ink-900);
    padding: 0.6rem 0.9rem;
    font-size: 0.875rem;
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .drink-tile,
    .drink-action,
    .drink-stepper,
    .cart-button { transition: none; }
    .drink-tile:hover { transform: none; }
  }
</style>
