<script lang="ts">
  import StatCard from '$lib/components/StatCard.svelte';
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import Leaderboard from '$lib/components/Leaderboard.svelte';
  import BarChart from '$lib/components/BarChart.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';

  let { data } = $props();

  let leaderView: 'allTime' | 'today' | 'thisWeek' = $state('allTime');
  let topDrinksView: 'allTime' | 'thisWeek' = $state('allTime');

  const s = $derived(data.stats);

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function formatHour(h: string): string {
    const hour = parseInt(h);
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  }
</script>

<svelte:head>
  <title>Drinks — 21 Bristoe Stats</title>
  <meta name="description" content="Drink Hub stats and leaderboards" />
</svelte:head>

<div class="space-y-10">
  <div class="text-center pb-2">
    <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
      <span class="text-accent">Drink Hub</span> Stats
    </h1>
    <p class="mt-2 text-slate-500 dark:text-slate-400">Order history, leaderboards, and trends</p>
  </div>

  {#if s}
    <FilterBar
      profiles={s.profiles}
      drinks={s.drinks}
      filters={data.filters}
    />
  {/if}

  {#if !s}
    <div class="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 p-6 text-center">
      <p class="text-sky-700 dark:text-sky-400 font-medium">Drink Hub unavailable</p>
      <p class="text-sm text-sky-600 dark:text-sky-500 mt-1">Could not connect to drink-hub API</p>
    </div>
  {:else}
    <!-- Totals -->
    <section>
      <SectionHeader title="Order Totals" icon="🍻" />
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="All Time" value={s.totals.allTime.toLocaleString()} icon="📊" accent />
        <StatCard label="Today" value={s.totals.today} icon="📅" />
        <StatCard label="This Week" value={s.totals.thisWeek} icon="📆" />
        <StatCard label="This Month" value={s.totals.thisMonth} icon="🗓️" />
      </div>
    </section>

    <!-- Leaderboard -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <SectionHeader title="Leaderboard" icon="🏆" />
        <div class="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          <button
            class="px-3 py-1 text-xs font-medium rounded-md transition-colors {leaderView === 'allTime' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
            onclick={() => leaderView = 'allTime'}
          >All Time</button>
          <button
            class="px-3 py-1 text-xs font-medium rounded-md transition-colors {leaderView === 'thisWeek' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
            onclick={() => leaderView = 'thisWeek'}
          >Week</button>
          <button
            class="px-3 py-1 text-xs font-medium rounded-md transition-colors {leaderView === 'today' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
            onclick={() => leaderView = 'today'}
          >Today</button>
        </div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <Leaderboard entries={s.leaderboard[leaderView]} />
      </div>
    </section>

    <!-- Top Drinks -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <SectionHeader title="Top Drinks" icon="🥤" />
        <div class="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          <button
            class="px-3 py-1 text-xs font-medium rounded-md transition-colors {topDrinksView === 'allTime' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'}"
            onclick={() => topDrinksView = 'allTime'}
          >All Time</button>
          <button
            class="px-3 py-1 text-xs font-medium rounded-md transition-colors {topDrinksView === 'thisWeek' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'}"
            onclick={() => topDrinksView = 'thisWeek'}
          >Week</button>
        </div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        {#key topDrinksView}
          <BarChart
            labels={s.topDrinks[topDrinksView].map(d => d.name)}
            data={s.topDrinks[topDrinksView].map(d => d.count)}
            horizontal
            label="Orders"
          />
        {/key}
      </div>
    </section>

    <!-- Histograms -->
    <section>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Orders by Day of Week" icon="📊" />
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <BarChart
              labels={s.dowHistogram.map(d => d.day)}
              data={s.dowHistogram.map(d => d.count)}
              label="Orders"
            />
          </div>
        </div>
        <div>
          <SectionHeader title="Orders by Hour" icon="🕐" />
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <BarChart
              labels={s.hourHistogram.map(h => h.hour.toString().padStart(2, '0'))}
              data={s.hourHistogram.map(h => h.count)}
              label="Orders"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Daily Timeline -->
    {#if s.dailyTimeline.length > 0}
      <section>
        <SectionHeader title="Orders Over Time (90 Days)" icon="📈" />
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <LineChart
            labels={s.dailyTimeline.map(d => formatDate(d.date))}
            data={s.dailyTimeline.map(d => d.count)}
            label="Orders"
          />
        </div>
      </section>
    {/if}

    <!-- Fun Stats -->
    <section>
      <SectionHeader title="Fun Facts" icon="🎉" />
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#if s.funStats.busiestDay}
          <StatCard label="Busiest Day Ever" value="{s.funStats.busiestDay.count} orders" icon="🔥" sublabel={formatDate(s.funStats.busiestDay.date)} />
        {/if}
        <StatCard label="Longest Streak" value="{s.funStats.longestStreak} days" icon="🔥" />
        <StatCard label="Avg Per Day" value={s.funStats.avgPerDay} icon="📊" sublabel="on active days" />
        {#if s.funStats.peakDay}
          <StatCard label="Favorite Day" value={s.funStats.peakDay} icon="📅" />
        {/if}
        {#if s.funStats.peakHour}
          <StatCard label="Peak Hour" value={formatHour(s.funStats.peakHour)} icon="🕐" />
        {/if}
        <StatCard label="Drink Diversity" value="{s.funStats.diversityScore}%" icon="🎨" sublabel="unique drinks / total" />
        {#if s.funStats.firstOrderDate}
          <StatCard label="First Order" value={formatDate(s.funStats.firstOrderDate)} icon="🎂" />
        {/if}
      </div>

      {#if s.funStats.signatureDrinks.length > 0}
        <div class="mt-6">
          <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Signature Drinks</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {#each s.funStats.signatureDrinks as sig}
              <div class="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {sig.profileColor}"></div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{sig.profileName}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{sig.drinkName} &middot; {sig.count} orders</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </section>
  {/if}
</div>
