'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  Copy,
  ExternalLink,
  Eye,
  MousePointerClick,
  Share2,
  UserPlus,
} from 'lucide-react';
import {
  formatNumber,
  type BookingSettingsView,
  type CardStatsView,
  type MyCard,
  type ProviderBookingView,
} from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { OtpForm } from '@/components/domain/otp-form';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cardCompletion } from '@/lib/completion';
import { useOrigin } from '@/lib/use-origin';
import { fa } from '@/messages/fa';

const t = fa.dashboard;

function post<T>(path: string, body: unknown = {}): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <b className="text-2xl tabular-nums">{formatNumber(value)}</b>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const origin = useOrigin();
  const [card, setCard] = useState<MyCard | null>(null);
  const [booking, setBooking] = useState<BookingSettingsView | null>(null);
  const [stats, setStats] = useState<CardStatsView | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    post<MyCard>('/cards/me')
      .then(setCard)
      .catch(() => undefined);
    post<BookingSettingsView>('/booking/me/settings')
      .then(setBooking)
      .catch(() => undefined);
    post<CardStatsView>('/cards/me/stats', { days: 7 })
      .then(setStats)
      .catch(() => undefined);
    post<ProviderBookingView[]>('/booking/me/list')
      .then((list) => {
        const now = Date.now();
        setPending(
          list.filter(
            (b) =>
              b.status === 'PENDING' && new Date(b.startAt).getTime() > now,
          ).length,
        );
      })
      .catch(() => undefined);
  }, [user]);

  if (loading || !user || !card) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  const url = card.username && origin ? `${origin}/${card.username}` : null;
  const completion = cardCompletion(card, booking?.enabled ?? false);
  const next = completion.missing.at(0);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // clipboard blocked: the link is visible on screen anyway
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {!user.phoneVerified && user.systemRole === 'USER' ? (
          <details className="rounded-2xl border bg-card p-4">
            <summary className="cursor-pointer font-medium">
              {fa.loginPage.linkPhoneTitle}
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              {fa.loginPage.linkPhoneHelp}
            </p>
            <OtpForm linkPhone />
          </details>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold">
            {t.greeting(card.displayName || user.displayName)}
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        {pending ? (
          <Link
            href="/card/bookings"
            className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--brand-amber)] p-4 text-[var(--brand-amber-foreground)] no-underline"
          >
            <span className="flex items-center gap-3 font-semibold">
              <CalendarClock aria-hidden="true" />
              {t.pendingCount(formatNumber(pending))}
            </span>
            <span className="rounded-full bg-black/10 px-3 py-1 text-sm">
              {t.reviewPending}
            </span>
          </Link>
        ) : null}

        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">{t.yourCard}</h2>
          {url ? (
            <>
              <p
                dir="ltr"
                className="break-all text-start text-lg font-bold text-primary"
              >
                {url.replace(/^https?:\/\//, '')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/card/print">
                    <Share2 aria-hidden="true" />
                    {t.share}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => void copy()}>
                  <Copy aria-hidden="true" />
                  {copied ? t.copied : t.copy}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/${card.username ?? ''}`}>
                    <ExternalLink aria-hidden="true" />
                    {t.open}
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">{t.noCardYet}</p>
              <Button asChild>
                <Link href="/card/edit">{t.startCard}</Link>
              </Button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t.completionTitle}</h2>
            <b className="tabular-nums text-primary">
              {formatNumber(completion.percent)}٪
            </b>
          </div>
          <div
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${String(completion.percent)}%` }}
            />
          </div>
          {next !== undefined ? (
            <Link
              href={next === 'booking' ? '/card/booking' : '/card/edit'}
              className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm text-foreground no-underline hover:bg-accent"
            >
              <span>
                <span className="text-muted-foreground">{t.nextStep}: </span>
                {t.steps[next]}
              </span>
              <UserPlus className="size-4 text-primary" aria-hidden="true" />
            </Link>
          ) : (
            <p className="text-sm">{t.completionDone}</p>
          )}
        </section>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Eye} label={t.viewsTitle} value={stats?.views ?? 0} />
          <Stat
            icon={UserPlus}
            label={t.contactsTitle}
            value={stats?.contactSaves ?? 0}
          />
          <Stat
            icon={MousePointerClick}
            label={t.clicksTitle}
            value={stats?.linkClicks ?? 0}
          />
        </div>
      </div>
    </AppShell>
  );
}
