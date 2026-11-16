import type { MouseEvent, ReactNode } from 'react';
import { BrandMark } from '../atoms/BrandMark';
import { Button } from '../atoms/Button';
import { cn } from '../cn';
import { COMPACT_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { Brand } from '../molecules/Brand';
import { Menu, type MenuItem } from '../molecules/Menu';
import { BROWSE_PATH, EDITOR_PATH, goToPath, MY_PATH } from '../router';
import { useAccountMenu } from './AccountMenu';

/** Which section the page belongs to (marked with aria-current). */
export type SiteSection = 'home' | 'browse' | 'my';

/** A real link (new tab, copy address) that stays in the app on a plain click. */
function NavLink({
  href,
  current,
  className,
  children,
}: {
  href: string;
  current?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goToPath(href);
  };
  return (
    <a
      href={href}
      onClick={go}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex items-center px-2.5 py-1.5 leading-[1.2] chamfer-sm hover:bg-frame-2 focus-visible:shadow-[inset_0_0_0_2px_var(--vent)] focus-visible:outline-none aria-[current=page]:shadow-[inset_0_-3px_0_var(--vent)] coarse:min-h-11',
        className,
      )}
    >
      {children}
    </a>
  );
}

const LINKS: readonly { href: string; label: string; section?: SiteSection }[] = [
  { href: BROWSE_PATH, label: 'Browse', section: 'browse' },
  { href: EDITOR_PATH, label: 'Create' },
  { href: MY_PATH, label: 'My scenarios', section: 'my' },
];

/**
 * The header of every page except the editor (which has its own toolbar): brand (home), Browse,
 * Create, My scenarios, and sign-in or the account menu. A Menu on narrow screens. Not printed.
 */
export function SiteHeader({ current }: { current?: SiteSection }) {
  const compact = useMediaQuery(COMPACT_QUERY);
  const acct = useAccountMenu();

  if (compact) {
    const items: MenuItem[] = [
      { label: 'Browse scenarios', icon: 'grid', onSelect: () => goToPath(BROWSE_PATH) },
      { label: 'Create a scenario', icon: 'new', onSelect: () => goToPath(EDITOR_PATH) },
      { label: 'My scenarios', icon: 'list', onSelect: () => goToPath(MY_PATH) },
      ...(acct.hidden
        ? []
        : acct.signedIn
          ? acct.items
          : [{ label: 'Sign in with Google', icon: 'user' as const, onSelect: acct.signIn }]),
    ];
    return (
      <header className="flex items-center gap-1 border-b-2 border-vent bg-frame px-1.5 py-1 text-frame-ink print:hidden">
        <NavLink href="/" current={current === 'home'} className="mr-auto gap-2 pl-1">
          <BrandMark />
          <span className="text-title font-bold font-stretch-condensed">Minovsky Maps</span>
        </NavLink>
        <Menu label="Menu" items={items} footer="Unofficial fan tool" />
        {acct.dialogs}
      </header>
    );
  }

  return (
    <header className="flex items-center gap-1 border-b-2 border-vent bg-frame px-2.5 py-1.5 text-frame-ink print:hidden">
      <NavLink href="/" current={current === 'home'} className="px-0 py-0">
        <Brand />
      </NavLink>
      <nav aria-label="Site" className="flex items-center gap-1">
        {LINKS.map((l) => (
          <NavLink key={l.href} href={l.href} current={!!l.section && l.section === current}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <span className="flex-1" />
      {acct.hidden ? null : acct.signedIn ? (
        <Menu label={acct.label} icon="user" items={acct.items} />
      ) : (
        <Button variant="frame" icon="user" onClick={acct.signIn}>
          Sign in
        </Button>
      )}
      {acct.dialogs}
    </header>
  );
}
