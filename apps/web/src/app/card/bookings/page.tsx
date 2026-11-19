'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProviderBookingView } from '@vaqt/shared';
import { formatNumber } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { BaleConnect } from '@/components/domain/bale-connect';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDayTime } from '@/lib/date-format';
import { fa } from '@/messages/fa';

const t = fa.bookingsPage;

function BookingRow({
  booking,
  busy,
  onDecide,
  onCancel,
}: {
  booking: ProviderBookingView;
  busy: boolean;
  onDecide: (id: string, action: 'confirm' | 'reject') => void;
  onCancel: (id: string) => void;
}) {
  const upcoming = new Date(booking.startAt).getTime() > Date.now();
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{booking.bookerName}</b>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs">
          {fa.booking.statusLabels[booking.status]}
        </span>
      </div>
      <p className="text-sm">
        {booking.serviceName} ·{' '}
        {fa.booking.minutes(formatNumber(booking.durationMinutes))}
        <br />
        {formatDayTime(booking.startAt)}
      </p>
      {booking.note ? (
        <p className="text-sm text-muted-foreground">
          {t.note}: {booking.note}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {t.phone}:{' '}
        <a
          dir="ltr"
          className="font-medium text-foreground"
          href={`tel:${booking.bookerPhone}`}
        >
          {booking.bookerPhone}
        </a>
      </p>
      {upcoming && booking.status === 'PENDING' ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              onDecide(booking.id, 'confirm');
            }}
          >
            {t.confirm}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onDecide(booking.id, 'reject');
            }}
          >
            {t.reject}
          </Button>
        </div>
      ) : null}
      {upcoming &&
      (booking.status === 'CONFIRMED' || booking.status === 'PENDING') ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              onCancel(booking.id);
            }}
          >
            {t.cancel}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export default function BookingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<ProviderBookingView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const load = useCallback(() => {
    apiFetch<ProviderBookingView[]>('/booking/me/list', {
      method: 'POST',
      body: '{}',
    })
      .then(setBookings)
      .catch(() => {
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch {
      setError(t.actionError);
    } finally {
      setBusy(false);
    }
  }

  const decide = (id: string, action: 'confirm' | 'reject') =>
    run(() =>
      apiFetch('/booking/me/decide', {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      }),
    );
  const cancel = (id: string) =>
    run(() =>
      apiFetch('/booking/cancel', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    );

  const now = Date.now();
  const pending = (bookings ?? []).filter(
    (b) => b.status === 'PENDING' && new Date(b.startAt).getTime() > now,
  );
  const upcoming = (bookings ?? []).filter(
    (b) => b.status === 'CONFIRMED' && new Date(b.startAt).getTime() > now,
  );
  const other = (bookings ?? []).filter(
    (b) => !pending.includes(b) && !upcoming.includes(b),
  );

  const groups: [string, ProviderBookingView[]][] = [
    [t.pendingTitle, pending],
    [t.upcomingTitle, upcoming],
    [t.otherTitle, other],
  ];

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/card/booking">{t.settingsLink}</Link>
          </Button>
        </div>
        <BaleConnect />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {failed ? (
          <p className="text-destructive">{t.loadError}</p>
        ) : bookings === null ? (
          <Skeleton className="h-40 w-full" />
        ) : bookings.length === 0 ? (
          <p className="text-muted-foreground">{t.empty}</p>
        ) : (
          groups.map(([title, list]) =>
            list.length > 0 ? (
              <section key={title} className="flex flex-col gap-3">
                <h2 className="font-semibold">{title}</h2>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {list.map((b) => (
                    <BookingRow
                      key={b.id}
                      booking={b}
                      busy={busy}
                      onDecide={(id, a) => void decide(id, a)}
                      onCancel={(id) => void cancel(id)}
                    />
                  ))}
                </ul>
              </section>
            ) : null,
          )
        )}
      </div>
    </AppShell>
  );
}
