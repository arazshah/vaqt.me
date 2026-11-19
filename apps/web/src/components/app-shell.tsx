'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarCheck,
  IdCard,
  LayoutDashboard,
  Settings,
  Share2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@vaqt/ui/components/ui/button';
import { Container } from '@vaqt/ui/components/container';

import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { fa } from '@/messages/fa';

const navLinkClass =
  'text-sm text-muted-foreground no-underline transition-colors hover:text-foreground';

const t = fa.appShell.nav;

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone's bottom bar (max 5). */
  primary?: boolean;
  admin?: boolean;
}

const PANEL_NAV: NavItem[] = [
  { href: '/card', label: t.dashboard, icon: LayoutDashboard, primary: true },
  { href: '/card/edit', label: t.myCard, icon: IdCard, primary: true },
  {
    href: '/card/bookings',
    label: t.bookings,
    icon: CalendarCheck,
    primary: true,
  },
  { href: '/card/print', label: t.share, icon: Share2, primary: true },
  { href: '/card/stats', label: t.stats, icon: BarChart3, primary: true },
  { href: '/wallet', label: t.wallet, icon: Wallet },
  { href: '/admin/settings', label: t.admin, icon: Settings, admin: true },
];

const PANEL_PREFIXES = ['/card', '/wallet', '/admin'];

function isActive(pathname: string, href: string): boolean {
  if (href === '/card') return pathname === '/card';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  /** Let the content use the full panel width (editors with two columns). */
  wide?: boolean;
}) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const inPanel = !!user && PANEL_PREFIXES.some((p) => pathname.startsWith(p));

  if (inPanel) {
    const items = PANEL_NAV.filter(
      (i) => !i.admin || user.systemRole === 'ADMIN',
    );
    return (
      <div className="flex min-h-dvh bg-muted/40">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-e bg-card p-4 lg:flex">
          <Link
            href="/"
            className="mb-4 flex items-center px-2 text-foreground no-underline"
            aria-label={fa.appShell.brand}
          >
            <Logo className="h-8 w-auto" />
          </Link>
          <nav className="flex flex-col gap-1" aria-label={fa.appShell.brand}>
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm no-underline transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
            <span className="truncate text-sm">{user.displayName}</span>
            <div className="flex items-center">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                {t.logout}
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:hidden">
            <Link href="/" className="flex items-center text-foreground">
              <Logo className="h-7 w-auto" />
            </Link>
            <div className="flex items-center">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                {t.logout}
              </Button>
            </div>
          </header>
          <main
            className={`mx-auto w-full px-4 py-6 lg:px-8 lg:py-8 ${
              wide ? 'max-w-6xl' : 'max-w-3xl'
            }`}
          >
            {children}
          </main>
        </div>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          aria-label={fa.appShell.brand}
        >
          {items
            .filter((i) => i.primary)
            .map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] no-underline ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
        </nav>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-sm">
        <Container className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center text-foreground no-underline"
            aria-label={fa.appShell.brand}
          >
            <Logo className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6">
            {loading ? null : user ? (
              <Link href="/card" className={navLinkClass}>
                {t.dashboard}
              </Link>
            ) : null}
            <ThemeToggle />
            {loading ? null : user ? (
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                {t.logout}
              </Button>
            ) : (
              <Link href="/login" className={navLinkClass}>
                {t.login}
              </Link>
            )}
          </nav>
        </Container>
      </header>
      <main className="flex-1">
        <Container className="py-8">{children}</Container>
      </main>
    </div>
  );
}
