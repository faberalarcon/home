import { error, json } from '@sveltejs/kit';
import { _loadProfilePageData } from '../../+page.server';
import { _loadMenuPageData } from '../../menu/+page.server';
import { _loadRecentPageData } from '../../recent/+page.server';
import { _loadStatsPageData } from '../../stats/+page.server';
import type { RequestHandler } from './$types';

const SUPPORTED = new Set(['/', '/menu', '/recent', '/stats']);

function canonicalHref(href: string): string | null {
  const url = new URL(href, 'http://drinks.local');
  if (url.search || !SUPPORTED.has(url.pathname)) return null;
  return url.pathname;
}

function loadPageData(href: string): Record<string, unknown> {
  switch (href) {
    case '/':
      return _loadProfilePageData() as Record<string, unknown>;
    case '/menu':
      return _loadMenuPageData() as Record<string, unknown>;
    case '/recent':
      return _loadRecentPageData() as Record<string, unknown>;
    case '/stats':
      return _loadStatsPageData() as Record<string, unknown>;
    default:
      throw error(404, 'Unknown Drinks page');
  }
}

export const GET: RequestHandler = async ({ request, url }) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    throw error(403, 'Cross-origin page data is not allowed');
  }

  const href = url.searchParams.get('href');
  if (!href) throw error(400, 'Missing href');

  const canonical = canonicalHref(href);
  if (!canonical) throw error(400, 'Unsupported Drinks href');

  return json({ href: canonical, data: loadPageData(canonical) });
};
