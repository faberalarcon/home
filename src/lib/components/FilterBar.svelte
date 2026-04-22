<script lang="ts">
  import { goto } from '$app/navigation';
  import { untrack } from 'svelte';

  let {
    profiles = [],
    drinks = [],
    filters
  }: {
    profiles: { id: number; name: string }[];
    drinks: { id: number; name: string; category: string }[];
    filters: { profileId: string; drinkId: string; category: string; from: string; to: string };
  } = $props();

  let profileId = $state(untrack(() => filters.profileId));
  let drinkId = $state(untrack(() => filters.drinkId));
  let category = $state(untrack(() => filters.category));
  let from = $state(untrack(() => filters.from));
  let to = $state(untrack(() => filters.to));

  const categories = $derived([...new Set(drinks.map((d) => d.category))].filter(Boolean));

  function apply() {
    const params = new URLSearchParams();
    if (profileId) params.set('profile_id', profileId);
    if (drinkId) params.set('drink_id', drinkId);
    if (category) params.set('category', category);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    goto(`?${params.toString()}`, { invalidateAll: true });
  }

  function reset() {
    profileId = '';
    drinkId = '';
    category = '';
    from = '';
    to = '';
    goto('?', { invalidateAll: true });
  }

  const isFiltered = $derived(
    profileId || drinkId || category || from || to
  );
</script>

<fieldset class="filters">
  <legend class="filters__legend">Filters</legend>

  <div class="filters__grid">
    {#if profiles.length > 0}
      <label class="filters__field">
        <span class="filter-label">Person</span>
        <select bind:value={profileId} class="filter-control">
          <option value="">All</option>
          {#each profiles as p}
            <option value={String(p.id)}>{p.name}</option>
          {/each}
        </select>
      </label>
    {/if}

    {#if categories.length > 1}
      <label class="filters__field">
        <span class="filter-label">Category</span>
        <select bind:value={category} class="filter-control">
          <option value="">All</option>
          {#each categories as cat}
            <option value={cat}>{cat}</option>
          {/each}
        </select>
      </label>
    {/if}

    <label class="filters__field">
      <span class="filter-label">From</span>
      <input type="date" bind:value={from} class="filter-control" />
    </label>

    <label class="filters__field">
      <span class="filter-label">To</span>
      <input type="date" bind:value={to} class="filter-control" />
    </label>

    <div class="filters__actions">
      <button type="button" class="filter-button filter-button--primary" onclick={apply}>Apply</button>
      {#if isFiltered}
        <button type="button" class="filter-button" onclick={reset}>Clear</button>
      {/if}
    </div>
  </div>

  {#if isFiltered}
    <p class="filters__note">
      <span class="status-chip status-chip--alert">Filters active</span>
    </p>
  {/if}
</fieldset>

<style>
  .filters {
    border: 1px solid var(--color-paper-300);
    padding: 1rem;
    background: var(--color-paper-100);
    margin-bottom: 2rem;
    min-width: 0;
    border-radius: var(--radius);
  }
  .filters__legend {
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-blood-500);
    padding: 0 0.6rem;
  }
  .filters__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
    gap: 0.85rem;
    align-items: end;
  }
  .filters__field {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .filters__actions {
    display: flex;
    gap: 0.5rem;
    align-items: end;
    flex-wrap: wrap;
  }
  .filters__note {
    margin: 1rem 0 0;
    padding-top: 1rem;
    border-top: 1px solid var(--color-paper-300);
  }
  .filter-label {
    display: block;
    font-family: var(--font-body);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin-bottom: 0.35rem;
  }
  .filter-control {
    width: 100%;
    min-height: 44px;
    font-family: var(--font-body);
    color: var(--color-ink-900);
    background: var(--color-paper-50);
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm);
    padding: 0.55rem 0.65rem;
  }
  .filter-control:focus {
    outline: none;
    border-color: var(--color-blood-500);
  }
  .filter-button {
    min-height: 44px;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm);
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    padding: 0.55rem 0.9rem;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .filter-button--primary {
    border-color: var(--color-blood-500);
    background: var(--color-blood-500);
    color: var(--color-paper-50);
  }
  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .status-chip--alert { color: var(--color-danger-text); }
  .status-chip::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  @media (max-width: 520px) {
    .filters {
      padding: 0.85rem;
    }
    .filters__actions,
    .filter-button {
      width: 100%;
    }
  }
</style>
