'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const t = fa.site.nav;

const LINKS = [
  { href: '/#features', label: t.features },
  { href: '/#professions', label: t.professions },
  { href: '/#how', label: t.how },
  { href: '/guide', label: t.guide },
  { href: '/#faq', label: t.faq },
] as const;

/** Sticky marketing header: anchors, theme toggle and the right auth CTA. */
export function SiteHeader() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const cta = loading ? null : user ? (
    <Link
      href="/card"
      className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground no-underline transition-transform hover:-translate-y-0.5"
    >
      {fa.appShell.nav.dashboard}
    </Link>
  ) : (
    <>
      <Link href="/login" className="lp-navlink hidden sm:inline">
        {fa.appShell.nav.login}
      </Link>
      <Link
        href="/login?tab=register"
        className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground no-underline transition-transform hover:-translate-y-0.5"
      >
        {t.start}
      </Link>
    </>
  );

  return (
    <header className="lp-header" data-scrolled={scrolled}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center text-foreground no-underline"
          aria-label={fa.appShell.brand}
        >
          <Logo className="h-8 w-auto" />
        </Link>

        <nav
          className="hidden items-center gap-7 md:flex"
          aria-label={fa.appShell.brand}
        >
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="lp-navlink">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {cta}
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full border md:hidden"
            aria-expanded={open}
            aria-controls="lp-mobile-menu"
            aria-label={open ? t.closeMenu : t.openMenu}
            onClick={() => {
              setOpen((o) => !o);
            }}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="lp-mobile-menu"
          className="border-t bg-background px-4 pb-4 md:hidden"
          aria-label={fa.appShell.brand}
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="block border-b py-3.5 text-base font-medium text-foreground no-underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            {!loading && !user ? (
              <li>
                <Link
                  href="/login"
                  className="block py-3.5 text-base font-medium text-foreground no-underline"
                >
                  {fa.appShell.nav.login}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
