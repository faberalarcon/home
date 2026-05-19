export type StatsSection = {
  href: string;
  label: string;
};

export const statsSections: StatsSection[] = [
  { href: '/', label: 'Overview' },
  { href: '/brief', label: 'Brief' },
  { href: '/house', label: 'House' },
  { href: '/drinks', label: 'Drinks' },
  { href: '/visitors', label: 'Visitors' },
  { href: '/backups', label: 'Backups' },
  { href: '/pi', label: 'Pi' }
];

export const defaultStatsPreloadHrefs = statsSections
  .map((section) => section.href)
  .filter((href) => href !== '/');

export const houseRangeHrefs = ['/house?range=1d', '/house?range=7d', '/house?range=30d', '/house?range=90d'];
export const piRangeHrefs = ['/pi?range=1d', '/pi?range=7d', '/pi?range=30d', '/pi?range=90d'];

export function sectionIndexForPath(pathname: string): number {
  return statsSections.findIndex((section) => section.href === pathname);
}
