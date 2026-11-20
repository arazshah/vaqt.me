import Link from 'next/link';

import { Logo } from '@/components/logo';
import { fa } from '@/messages/fa';

const t = fa.site.footer;

/** The creator's own vaqt.me card — the footer credit points here. */
export const CREATOR_PATH = '/araz_shahkarami';

export function SiteFooter() {
  return (
    <footer className="lp-footer border-t bg-muted/30">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="flex flex-col gap-4">
          <Logo className="h-9 w-auto self-start" />
          <p className="m-0 max-w-xs text-sm leading-8 text-muted-foreground">
            {t.tagline}
          </p>
        </div>

        <FooterCol title={t.product}>
          <Link href="/#features">{fa.site.nav.features}</Link>
          <Link href="/#professions">{fa.site.nav.professions}</Link>
          <Link href="/#how">{fa.site.nav.how}</Link>
        </FooterCol>
        <FooterCol title={t.help}>
          <Link href="/guide">{t.guide}</Link>
          <Link href="/#faq">{t.faq}</Link>
          <Link href={CREATOR_PATH}>{t.example}</Link>
        </FooterCol>
        <FooterCol title={t.account}>
          <Link href="/login">{t.login}</Link>
          <Link href="/login?tab=register">{t.register}</Link>
        </FooterCol>
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span>{t.rights}</span>
          <span className="inline-flex flex-wrap items-center justify-center gap-2.5">
            {t.builtBy}
            <Link
              href={CREATOR_PATH}
              className="lp-creator"
              title={t.builderHint}
            >
              <span className="lp-creator-av" aria-hidden="true">
                {Array.from(t.builder)[0]}
              </span>
              {t.builder}
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <b className="text-foreground">{title}</b>
      {children}
    </div>
  );
}
