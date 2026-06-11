import { appPath, routePath } from '$lib/drinks/app-paths';
import { drinkSections, sectionIndexForPath } from '$lib/drinks/drink-sections';
import type { SwipeEnhancerConfig, TabShellConfig } from '$lib/site/tab-shell/types';
import ProfilesPage from '../../routes/drinks/+page.svelte';
import MenuPage from '../../routes/drinks/menu/+page.svelte';
import RecentPage from '../../routes/drinks/recent/+page.svelte';
import StatsPage from '../../routes/drinks/stats/+page.svelte';

const base = {
  sections: drinkSections,
  sectionIndexForPath,
  appPath,
  routePath,
  navEventName: 'drink:swipe-navigate'
};

export const drinkTabShellConfig: TabShellConfig = {
  ...base,
  cacheTtlMs: 30_000,
  navAnchorSelector: '.drink-shell__nav',
  pageComponents: {
    '/': ProfilesPage,
    '/menu': MenuPage,
    '/recent': RecentPage,
    '/stats': StatsPage
  }
};

export const drinkSwipeConfig: SwipeEnhancerConfig = {
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
    '.drink-shell__nav',
    '.hubnav',
    '.site-tab-bar'
  ].join(','),
  mainSelector: '.drink-shell__main',
  overlayClass: 'drink-swipe-overlay',
  pageClass: 'drink-swipe-page',
  draggingBodyClass: 'drink-swipe-dragging',
  placeholderHtml: '<main class="drink-shell__main"><div class="drink-swipe-preview-loading"></div></main>'
};
