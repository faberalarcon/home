export type SiteKey = 'home' | 'drinks' | 'stats' | 'gooby' | 'gallery';

export const siteLinks: Array<{ key: SiteKey; label: string; href: string }> = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'drinks', label: 'Drinks', href: '/drinks/' },
  { key: 'stats', label: 'Stats', href: '/stats/' },
  { key: 'gooby', label: 'GPT', href: '/gooby/' },
  { key: 'gallery', label: 'Gallery', href: '/gallery/' }
];

export function keyForPath(pathname: string): SiteKey {
  if (pathname === '/drinks' || pathname.startsWith('/drinks/')) return 'drinks';
  if (pathname === '/stats' || pathname.startsWith('/stats/')) return 'stats';
  if (pathname === '/gooby' || pathname.startsWith('/gooby/')) return 'gooby';
  if (pathname === '/gallery' || pathname.startsWith('/gallery/')) return 'gallery';
  return 'home';
}
