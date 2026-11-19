'use client';

import Link from 'next/link';

import { Button } from '@vaqt/ui/components/ui/button';
import { Container } from '@vaqt/ui/components/container';

import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { fa } from '@/messages/fa';

const navLinkClass =
  'text-sm text-muted-foreground no-underline transition-colors hover:text-foreground';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();

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
          <nav className="flex items-center gap-6">
            <Link href="/" className={navLinkClass}>
              {fa.appShell.nav.home}
            </Link>
            {loading ? null : user ? (
              <>
                <Link href="/card/edit" className={navLinkClass}>
                  {fa.appShell.nav.myCard}
                </Link>
                <Link href="/card/bookings" className={navLinkClass}>
                  {fa.appShell.nav.bookings}
                </Link>
                <Link href="/wallet" className={navLinkClass}>
                  {fa.appShell.nav.wallet}
                </Link>
                {user.systemRole === 'ADMIN' ? (
                  <Link href="/admin/settings" className={navLinkClass}>
                    {fa.appShell.nav.admin}
                  </Link>
                ) : null}
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {user.displayName}
                </span>
              </>
            ) : null}
            <ThemeToggle />
            {loading ? null : user ? (
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                {fa.appShell.nav.logout}
              </Button>
            ) : (
              <Link href="/login" className={navLinkClass}>
                {fa.appShell.nav.login}
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
