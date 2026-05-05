export type DrinkSection = {
  href: string;
  label: string;
};

export const drinkSections: DrinkSection[] = [
  { href: '/', label: 'Profiles' },
  { href: '/menu', label: 'Menu' },
  { href: '/recent', label: 'Recent' },
  { href: '/stats', label: 'Leaderboard' }
];

export function sectionIndexForPath(pathname: string): number {
  return drinkSections.findIndex((section) => section.href === pathname);
}
