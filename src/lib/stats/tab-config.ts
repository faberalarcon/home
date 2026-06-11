import { appPath, routePath } from '$lib/stats/app-paths';
import {
  defaultStatsPreloadHrefs,
  houseRangeHrefs,
  piRangeHrefs,
  sectionIndexForPath,
  statsSections
} from '$lib/stats/stats-sections';
import type { SwipeEnhancerConfig, TabShellConfig } from '$lib/site/tab-shell/types';
import OverviewPage from '../../routes/stats/+page.svelte';
import BackupsPage from '../../routes/stats/backups/+page.svelte';
import DrinksPage from '../../routes/stats/drinks/+page.svelte';
import HousePage from '../../routes/stats/house/+page.svelte';
import PiPage from '../../routes/stats/pi/+page.svelte';
import VisitorsPage from '../../routes/stats/visitors/+page.svelte';

const base = {
  sections: statsSections,
  sectionIndexForPath,
  appPath,
  routePath,
  navEventName: 'stats:swipe-navigate'
};

export const statsTabShellConfig: TabShellConfig = {
  ...base,
  cacheTtlMs: 60_000,
  navAnchorSelector: '.app-header__nav',
  pageComponents: {
    '/': OverviewPage,
    '/house': HousePage,
    '/drinks': DrinksPage,
    '/visitors': VisitorsPage,
    '/backups': BackupsPage,
    '/pi': PiPage
  }
};

function localDate(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function hrefWithParams(pathname: string, entries: Array<[string, string | number]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) params.set(key, String(value));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function currentVariantHref(url: URL): string {
  const pathname = routePath(url.pathname);
  if (pathname === '/house') {
    return `/house?range=${url.searchParams.get('range') ?? '7d'}`;
  }
  if (pathname === '/pi') {
    return `/pi?range=${url.searchParams.get('range') ?? '1d'}`;
  }
  return `${pathname}${url.search}`;
}

function datePresetHrefs(): string[] {
  const now = new Date();
  const today = localDate(now);

  const monday = new Date(now);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);

  return [
    hrefWithParams('/drinks', [['from', today], ['to', today]]),
    hrefWithParams('/drinks', [['from', localDate(monday)], ['to', today]]),
    hrefWithParams('/drinks', [['from', localDate(monthStart)], ['to', today]]),
    hrefWithParams('/drinks', [['from', localDate(ninetyDaysAgo)], ['to', today]])
  ];
}

function buildDrinkWarmups(data: Record<string, unknown>): string[] {
  const stats = data.stats as
    | {
        profiles?: Array<{ id: number }>;
        drinks?: Array<{ id: number; category: string }>;
      }
    | null
    | undefined;

  const hrefs: string[] = [];
  for (const profile of stats?.profiles ?? []) {
    hrefs.push(hrefWithParams('/drinks', [['profile_id', profile.id]]));
  }
  for (const drink of stats?.drinks ?? []) {
    hrefs.push(hrefWithParams('/drinks', [['drink_id', drink.id]]));
  }

  const categories = new Set((stats?.drinks ?? []).map((drink) => drink.category).filter(Boolean));
  for (const category of categories) {
    hrefs.push(hrefWithParams('/drinks', [['category', category]]));
  }

  hrefs.push(...datePresetHrefs());
  return hrefs;
}

function buildWarmupHrefs(url: URL, data: Record<string, unknown>): string[] {
  let hrefs: string[] = [];
  const pathname = routePath(url.pathname);
  if (pathname === '/') hrefs = defaultStatsPreloadHrefs;
  else if (pathname === '/house') hrefs = houseRangeHrefs;
  else if (pathname === '/pi') hrefs = piRangeHrefs;
  else if (pathname === '/drinks') hrefs = buildDrinkWarmups(data);

  const current = currentVariantHref(url);
  return [...new Set(hrefs)]
    .filter((href) => href !== current && href !== `${pathname}${url.search}`);
}

export const statsSwipeConfig: SwipeEnhancerConfig = {
  ...base,
  interactiveSelector: [
    'a',
    'button',
    'input',
    'select',
    'textarea',
    'label',
    'summary',
    '[role="button"]',
    '[contenteditable="true"]',
    '.filters',
    '.tab-row',
    '.house__range-tabs',
    '.pi__range-tabs',
    '.app-header__nav',
    '.hubnav',
    '.site-tab-bar'
  ].join(','),
  mainSelector: '#main-content',
  overlayClass: 'swipe-overlay',
  pageClass: 'swipe-page',
  draggingBodyClass: 'swipe-dragging',
  headerHeightVar: '--stats-app-header-height',
  fixedHeaderSelector: '.app-header',
  buildWarmupHrefs,
  warmupPath: '/api/preload'
};
