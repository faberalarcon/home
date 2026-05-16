<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Admin requires Tailscale · 21 Bristoe</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="admin-block">
  <p class="admin-block__eyebrow">Admin · Restricted</p>
  <h1 class="admin-block__title">Tailscale required</h1>
  <p class="admin-block__lede">
    The Drink Hub admin panel is only available from the 21 Bristoe tailnet. Connect to Tailscale on
    this device, then reload the page.
  </p>
  <ol class="admin-block__steps">
    <li>Open the Tailscale app and sign in.</li>
    <li>Wait for the connection indicator to turn green.</li>
    <li>Reload <code>/drinks/admin</code>.</li>
  </ol>
  {#if data.clientIp}
    <p class="admin-block__meta">
      Detected IP: <code>{data.clientIp}</code>
    </p>
  {/if}
  <p class="admin-block__back">
    <a href="/drinks/">← Back to Drink Hub</a>
  </p>
</section>

<style>
  .admin-block {
    max-width: 34rem;
    margin: clamp(2rem, 5vw, 4rem) auto;
    padding: clamp(1.5rem, 3vw, 2.25rem);
    border: 1px solid color-mix(in oklab, var(--color-ink-900) 8%, transparent);
    border-radius: var(--radius-md, 0.85rem);
    background: var(--color-paper-50, #fafbfc);
    color: var(--color-ink-900, #0f172a);
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04), 0 12px 28px -18px rgba(15, 23, 42, 0.25);
  }

  .admin-block__eyebrow {
    margin: 0 0 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-blood-500, #b91c1c);
  }

  .admin-block__title {
    margin: 0 0 0.75rem;
    font-family: var(--font-display);
    font-size: clamp(1.45rem, 3.5vw, 1.95rem);
    line-height: 1.15;
  }

  .admin-block__lede {
    margin: 0 0 1.25rem;
    font-size: 0.95rem;
    line-height: 1.55;
    color: var(--color-ink-500, #334155);
  }

  .admin-block__steps {
    margin: 0 0 1.25rem;
    padding-left: 1.25rem;
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--color-ink-700, #1f2937);
  }

  .admin-block__steps li + li {
    margin-top: 0.25rem;
  }

  .admin-block__meta {
    margin: 0 0 0.85rem;
    font-size: 0.78rem;
    color: var(--color-ink-500, #475569);
  }

  .admin-block__meta code,
  .admin-block__steps code {
    padding: 0.05rem 0.35rem;
    border-radius: 0.3rem;
    background: color-mix(in oklab, var(--color-ink-900) 7%, transparent);
    font-family: var(--font-mono);
    font-size: 0.85em;
  }

  .admin-block__back a {
    color: var(--color-blood-500, #b91c1c);
    font-weight: 600;
    text-decoration: none;
  }

  .admin-block__back a:hover {
    text-decoration: underline;
  }
</style>
