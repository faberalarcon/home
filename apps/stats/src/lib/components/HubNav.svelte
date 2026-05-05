<script lang="ts">
  import { appPath } from '$lib/app-paths';

  // HubNav — three-pill ecosystem navigation shared across home / drink-hub / stats.
  // Matches the visual/semantic pattern of home repo's HubNav.astro, translated
  // to drink-hub's scoped-style idiom (raw CSS variables on class names).
  interface Props {
    current: 'home' | 'drinks' | 'stats';
  }

  let { current }: Props = $props();

  type Pill = { key: 'home' | 'drinks' | 'stats'; label: string; href: string; external: boolean };

  // Stats is same-origin on 21bristoe.com — points at the canonical path, not the subdomain.
  const pills: Pill[] = [
    { key: 'home',   label: 'Home',   href: 'https://21bristoe.com',         external: false },
    { key: 'drinks', label: 'Drinks', href: 'https://21bristoe.com/drinks/', external: false },
    { key: 'stats',  label: 'Stats',  href: appPath('/'),                    external: false }
  ];
</script>

<nav class="hubnav" aria-label="21 Bristoe sites">
  <ul class="hubnav__list" role="list">
    {#each pills as pill (pill.key)}
      {@const isActive = pill.key === current}
      <li>
        {#if isActive}
          <a
            href={pill.href}
            class="hubnav__pill hubnav__pill--active"
            aria-current="page"
          >
            {pill.label}
          </a>
        {:else}
          <a
            href={pill.href}
            class="hubnav__pill hubnav__pill--inactive"
            target={pill.external ? '_blank' : undefined}
            rel={pill.external ? 'noopener noreferrer' : undefined}
          >
            {pill.label}
          </a>
        {/if}
      </li>
    {/each}
  </ul>
</nav>

<style>
  .hubnav__list {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .hubnav__pill {
    display: inline-block;
    padding: 0.3rem 0.7rem;
    border-radius: var(--radius-sm, 0.5rem);
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
    text-decoration: none;
    transition: background 120ms, color 120ms, border-color 120ms;
  }
  .hubnav__pill--active {
    background: var(--color-blood-500);
    color: #fff;
    border: 1px solid var(--color-blood-500);
  }
  .hubnav__pill--active:hover {
    background: var(--color-blood-600);
    border-color: var(--color-blood-600);
    color: #fff;
  }
  .hubnav__pill--inactive {
    background: transparent;
    color: var(--color-ink-700);
    border: 1px solid color-mix(in oklab, var(--color-paper-300) 80%, transparent);
  }
  .hubnav__pill--inactive:hover {
    background: var(--color-paper-100);
    color: var(--color-ink-900);
  }
  @media (max-width: 520px) {
    .hubnav__list { gap: 0.35rem; }
    .hubnav__pill { padding: 0.25rem 0.55rem; letter-spacing: 0.1em; }
  }
</style>
