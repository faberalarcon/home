<script lang="ts">
  let {
    entries,
    maxCount = 0
  }: {
    entries: { name: string; color: string; count: number }[];
    maxCount?: number;
  } = $props();

  const max = $derived(maxCount > 0 ? maxCount : Math.max(...entries.map((e) => e.count), 1));

</script>

<table class="leaderboard">
  <thead>
    <tr>
      <th class="rank">№</th>
      <th>Name</th>
      <th class="num">Count</th>
      <th class="share" aria-hidden="true"></th>
    </tr>
  </thead>
  <tbody>
    {#each entries as entry, i}
      <tr>
        <td class="rank">{i + 1}</td>
        <td class="name">
          <span class="name__dot" aria-hidden="true" style="background:{entry.color}"></span>
          {entry.name}
        </td>
        <td class="num">{entry.count.toLocaleString()}</td>
        <td class="share">
          <span class="share__bar">
            <span
              class="share__fill"
              style="width:{Math.max((entry.count / max) * 100, 2)}%;background:{entry.color}"
            ></span>
          </span>
        </td>
      </tr>
    {/each}

    {#if entries.length === 0}
      <tr>
        <td colspan="4" class="empty">No data yet</td>
      </tr>
    {/if}
  </tbody>
</table>

<style>
  .leaderboard {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .leaderboard th {
    font-family: var(--font-body);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    text-align: left;
    padding: 0.65rem 0.5rem;
    border-bottom: 1px solid var(--color-paper-300);
  }
  .leaderboard td {
    padding: 0.7rem 0.5rem;
    border-bottom: 1px solid var(--color-paper-300);
  }
  .leaderboard .rank {
    font-family: var(--font-mono);
    color: var(--color-ink-500);
    width: 2.25rem;
    font-size: 0.9rem;
  }
  .leaderboard .name {
    font-family: var(--font-body);
    color: var(--color-ink-900);
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .name__dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .leaderboard .num {
    font-family: var(--font-mono);
    text-align: right;
  }
  .leaderboard .share { width: 34%; min-width: 80px; }
  .share__bar {
    display: block;
    height: 6px;
    background: var(--color-paper-200);
    overflow: hidden;
  }
  .share__fill {
    display: block;
    height: 100%;
    transition: width 0.6s ease-out;
  }
  .leaderboard td.empty {
    text-align: center;
    color: var(--color-ink-500);
    padding: 1.75rem 0;
  }
  @media (max-width: 560px) {
    .leaderboard thead { display: none; }
    .leaderboard,
    .leaderboard tbody,
    .leaderboard tr,
    .leaderboard td {
      display: block;
      width: 100%;
    }
    .leaderboard tr {
      display: grid;
      grid-template-columns: 2rem 1fr auto;
      gap: 0.5rem;
      align-items: center;
      padding: 0.7rem 0;
      border-bottom: 1px solid var(--color-paper-300);
    }
    .leaderboard td {
      padding: 0;
      border: 0;
    }
    .leaderboard .share {
      grid-column: 2 / -1;
      width: 100%;
      min-width: 0;
    }
    .leaderboard .num {
      text-align: right;
    }
  }
</style>
