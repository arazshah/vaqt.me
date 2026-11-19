'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatNumber, type CardStatsView } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { dayKeyLabel } from '@/lib/date-format';
import { fa } from '@/messages/fa';

const t = fa.statsPage;

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4">
      <b className="text-2xl tabular-nums">{formatNumber(value)}</b>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export default function CardStatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [days, setDays] = useState<7 | 30>(7);
  const [stats, setStats] = useState<CardStatsView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setStats(null);
    setFailed(false);
    apiFetch<CardStatsView>('/cards/me/stats', {
      method: 'POST',
      body: JSON.stringify({ days }),
    })
      .then(setStats)
      .catch(() => {
        setFailed(true);
      });
  }, [user, days]);

  const maxDaily = Math.max(1, ...(stats?.daily.map((d) => d.views) ?? [1]));
  const maxSource = Math.max(
    1,
    ...(stats?.bySource.map((s) => s.views) ?? [1]),
  );
  const maxLink = Math.max(1, ...(stats?.byLink.map((l) => l.clicks) ?? [1]));

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          {([7, 30] as const).map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              aria-pressed={days === d}
              onClick={() => {
                setDays(d);
              }}
            >
              {d === 7 ? t.last7 : t.last30}
            </Button>
          ))}
        </div>

        {failed ? (
          <p className="text-destructive">{t.loadError}</p>
        ) : !stats ? (
          <Skeleton className="h-60 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label={t.views} value={stats.views} />
              <Tile label={t.qrScans} value={stats.qrScans} />
              <Tile label={t.contactSaves} value={stats.contactSaves} />
              <Tile label={t.linkClicks} value={stats.linkClicks} />
              <Tile label={t.bookClicks} value={stats.bookClicks} />
              <Tile label={t.bookingRequests} value={stats.bookingRequests} />
            </div>

            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="font-semibold">{t.daily}</h2>
              <div
                className="flex h-32 items-end gap-1"
                role="img"
                aria-label={t.daily}
              >
                {stats.daily.map((d) => (
                  <div
                    key={d.date}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`${dayKeyLabel(d.date).day} ${dayKeyLabel(d.date).month}: ${formatNumber(d.views)}`}
                  >
                    <div
                      className="w-full rounded-t bg-primary"
                      style={{
                        height: `${String(Math.max(d.views ? 6 : 2, (d.views / maxDaily) * 100))}%`,
                        opacity: d.views ? 1 : 0.2,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {dayKeyLabel(stats.daily[0].date).day}{' '}
                  {dayKeyLabel(stats.daily[0].date).month}
                </span>
                <span>
                  {dayKeyLabel(stats.daily[stats.daily.length - 1].date).day}{' '}
                  {dayKeyLabel(stats.daily[stats.daily.length - 1].date).month}
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="font-semibold">{t.sources}</h2>
              {stats.bySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.nothing}</p>
              ) : (
                stats.bySource.map((s) => (
                  <div
                    key={s.source}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-36 shrink-0">
                      {t.sourceLabels[s.source] ?? s.source}
                    </span>
                    <div className="h-2 flex-1 rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary"
                        style={{
                          width: `${String((s.views / maxSource) * 100)}%`,
                        }}
                      />
                    </div>
                    <b className="w-10 text-end tabular-nums">
                      {formatNumber(s.views)}
                    </b>
                  </div>
                ))
              )}
            </section>

            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="font-semibold">{t.links}</h2>
              {stats.byLink.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.nothing}</p>
              ) : (
                stats.byLink.map((l) => (
                  <div key={l.kind} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0">
                      {fa.cardEditPage.linkLabels[l.kind]}
                    </span>
                    <div className="h-2 flex-1 rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary"
                        style={{
                          width: `${String((l.clicks / maxLink) * 100)}%`,
                        }}
                      />
                    </div>
                    <b className="w-10 text-end tabular-nums">
                      {formatNumber(l.clicks)}
                    </b>
                  </div>
                ))
              )}
            </section>
            <p className="text-xs text-muted-foreground">{t.selfNote}</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
