'use client';

import Link from 'next/link';

import { Button } from '@vaqt/ui/components/ui/button';

import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-semibold">
            {fa.appShell.brand}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground"
            >
              {fa.appShell.nav.home}
            </Link>
            <Link
              href="/requests"
              className="text-muted-foreground hover:text-foreground"
            >
              {fa.appShell.nav.requests}
            </Link>
            {loading ? null : user ? (
              <>
                <Link
                  href="/requests/new"
                  className="text-muted-foreground hover:text-foreground"
                >
                  {fa.appShell.nav.newRequest}
                </Link>
                <Link
                  href="/conversations"
                  className="text-muted-foreground hover:text-foreground"
                >
                  {fa.appShell.nav.conversations}
                </Link>
                <Link
                  href="/pricing"
                  className="text-muted-foreground hover:text-foreground"
                >
                  {fa.appShell.nav.pricing}
                </Link>
                <span className="text-muted-foreground">
                  {user.displayName}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  {fa.appShell.nav.logout}
                </Button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground"
              >
                {fa.appShell.nav.login}
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
