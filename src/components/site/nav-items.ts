import type { IconName } from '@/components/ui/Icon';

export type NavItem = {
  href: string;
  label: string;
  full?: string;
  icon?: IconName;
  /** Visible dans la barre mobile du bas. */
  tab?: boolean;
  /** 2 = rangé dans « Plus » sur les écrans moyens. */
  prio?: 1 | 2;
  /** Module pas encore disponible : la page l'explique. */
  soon?: boolean;
};

export const NAV: NavItem[] = [
  { href: '/', label: 'Accueil', icon: 'home', tab: true },
  { href: '/elo-run', label: 'ELO Run', icon: 'trophy', tab: true },
  { href: '/matches', label: 'Matchs', icon: 'target', tab: true },
  { href: '/clips', label: 'Clips', prio: 2 },
  { href: '/crosshairs', label: 'Crosshairs', prio: 2 },
  { href: '/stuffs', label: 'Stuffs', icon: 'nade', tab: true },
  { href: '/team', label: 'Joueurs', icon: 'users' },
  { href: '/mur-des-lamentations', label: 'Mur', full: 'Mur des lamentations', icon: 'wall', prio: 2 },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/team' && pathname.startsWith('/players/')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
