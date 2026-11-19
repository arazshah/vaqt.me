'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { BookingTokenView } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { ApiError, apiFetch } from '@/lib/api-client';
import { formatDayTime } from '@/lib/date-format';
import { fa } from '@/messages/fa';

const t = fa.bookingTokenPage;

export default function BookingTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<BookingTokenView | null>(null);
  const [failed, setFailed] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<BookingTokenView>(
      `/booking/by-token/${encodeURIComponent(token)}`,
      undefined,
      {
        redirectOnAuthFailure: false,
      },
    )
      .then(setView)
      .catch(() => {
        setFailed(true);
      });
  }, [token]);

  useEffect(load, [load]);

  async function cancel() {
    setCanceling(true);
    setMessage(null);
    try {
      const next = await apiFetch<BookingTokenView>(
        '/booking/cancel-by-token',
        { method: 'POST', body: JSON.stringify({ token }) },
        { redirectOnAuthFailure: false },
      );
      setView(next);
      setMessage(t.canceled);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t.cancelError);
    } finally {
      setCanceling(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        {failed ? (
          <p className="text-muted-foreground">{t.loadError}</p>
        ) : !view ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <span className="w-fit rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium">
              {fa.booking.statusLabels[view.status]}
            </span>
            <p>
              <b>{view.serviceName}</b> {t.with(view.providerName)}
            </p>
            <p className="text-sm">{formatDayTime(view.startAt)}</p>
            {view.status === 'PENDING' ? (
              <p className="text-sm text-muted-foreground">{t.pendingHint}</p>
            ) : null}
            {view.status === 'CONFIRMED' ? (
              <p className="text-sm text-muted-foreground">{t.confirmedHint}</p>
            ) : null}
            {message ? (
              <p role="status" className="text-sm text-primary">
                {message}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {view.canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={canceling}
                  onClick={() => void cancel()}
                >
                  {canceling ? t.canceling : t.cancel}
                </Button>
              ) : null}
              {view.providerUsername ? (
                <Button asChild variant="ghost">
                  <Link href={`/${view.providerUsername}`}>{t.viewCard}</Link>
                </Button>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
