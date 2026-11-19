'use client';

import Link from 'next/link';
import { CARD_CATEGORIES } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';

import { AppShell } from '@/components/app-shell';
import { CardPreview } from '@/components/domain/card-preview';
import { CATEGORY_THEMES } from '@/lib/card-themes';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const L = fa.landing;

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <AppShell>
      <section className="grid items-center gap-10 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <div className="flex flex-col items-start gap-5">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {fa.homePage.heroEyebrow}
          </span>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
            {fa.homePage.heroTitle}
          </h1>
          <p className="max-w-xl text-lg leading-8 text-muted-foreground">
            {fa.homePage.heroSubtitle}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {!loading && (
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href={user ? '/card' : '/login'}>
                  {user ? fa.homePage.ctaMyCard : fa.homePage.ctaStart}
                </Link>
              </Button>
            )}
            <span className="text-sm text-muted-foreground">{L.free}</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xs">
          <div
            className="absolute -inset-6 -z-10 rounded-[3rem] opacity-20 blur-2xl"
            style={{ background: 'linear-gradient(135deg, #16a394, #f2b84b)' }}
            aria-hidden="true"
          />
          <CardPreview
            displayName={L.demoName}
            headline={L.demoHeadline}
            city={L.demoCity}
            category="health"
            avatarUrl={null}
            linkKinds={['ble', 'whatsapp', 'instagram', 'linkedin']}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 py-10">
        <div>
          <h2 className="text-2xl font-bold">{L.professionsTitle}</h2>
          <p className="text-muted-foreground">{L.professionsText}</p>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {CARD_CATEGORIES.map((c) => {
            const th = CATEGORY_THEMES[c];
            return (
              <li
                key={c}
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={{
                  background: `linear-gradient(135deg, ${th.from}, ${th.to})`,
                  color: '#fff',
                }}
              >
                {fa.categories[c].label}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-6 py-10">
        <h2 className="text-2xl font-bold">{L.stepsTitle}</h2>
        <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-3">
          {L.steps.map(([n, title, text]) => (
            <li
              key={n}
              className="flex flex-col gap-2 rounded-3xl border bg-card p-6"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                {n}
              </span>
              <b>{title}</b>
              <p className="m-0 text-sm leading-7 text-muted-foreground">
                {text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="my-6 grid gap-6 rounded-[2rem] bg-primary p-8 text-primary-foreground sm:items-center">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">{L.forVisitors}</h2>
          <p className="m-0 max-w-xl leading-8 opacity-90">
            {L.forVisitorsText}
          </p>
        </div>
      </section>
    </AppShell>
  );
}
