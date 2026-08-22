import Link from 'next/link';

import { fa } from '@/messages/fa';

export function AppShell({ children }: { children: React.ReactNode }) {
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
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
