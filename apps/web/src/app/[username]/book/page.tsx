'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type {
  AvailabilityDay,
  MyBookingView,
  PublicCard,
  ServiceView,
} from '@vaqt/shared';
import { formatNumber } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Textarea } from '@vaqt/ui/components/ui/textarea';

import { AppShell } from '@/components/app-shell';
import { AuthForm } from '@/components/domain/auth-form';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { coverBackground, themeFor } from '@/lib/card-themes';
import {
  dayKeyLabel,
  formatDay,
  formatDayKey,
  formatDayTime,
  formatTime,
} from '@/lib/date-format';
import { fa } from '@/messages/fa';

type Step = 'service' | 'time' | 'info' | 'login' | 'done';

const t = fa.bookPage;

export default function BookPage() {
  const params = useParams<{ username: string }>();
  const username = params.username.toLowerCase();
  const { user, loading: authLoading } = useAuth();

  const [card, setCard] = useState<PublicCard | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [step, setStep] = useState<Step>('service');
  const [service, setService] = useState<ServiceView | null>(null);
  const [days, setDays] = useState<AvailabilityDay[] | null>(null);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MyBookingView | null>(null);

  useEffect(() => {
    apiFetch<PublicCard>(`/cards/${username}`, undefined, {
      redirectOnAuthFailure: false,
    })
      .then((c) => {
        setCard(c);
        // A service row on the public card links here with ?service=<id>.
        const wanted = new URLSearchParams(window.location.search).get(
          'service',
        );
        const only =
          c.booking.services.find((s) => s.id === wanted) ??
          (c.booking.services.length === 1 ? c.booking.services[0] : null);
        if (only) {
          setService(only);
          setStep('time');
        }
      })
      .catch(() => {
        setLoadFailed(true);
      });
  }, [username]);

  // Prefill the name for a returning user (but not the placeholder name
  // given to accounts created by the SMS login).
  useEffect(() => {
    if (user && !name && !user.displayName.startsWith('کاربر ')) {
      setName(user.displayName);
    }
  }, [user, name]);

  const loadDays = useCallback(
    async (svc: ServiceView) => {
      setDays(null);
      setDayIndex(null);
      setSlot(null);
      try {
        const res = await apiFetch<{ days: AvailabilityDay[] }>(
          `/booking/${username}/availability?serviceId=${encodeURIComponent(svc.id)}`,
          undefined,
          { redirectOnAuthFailure: false },
        );
        setDays(res.days);
        const firstOpen = res.days.findIndex((d) => d.slots.length > 0);
        setDayIndex(firstOpen === -1 ? null : firstOpen);
      } catch {
        setError(t.loadError);
      }
    },
    [username],
  );

  useEffect(() => {
    if (step === 'time' && service && days === null) void loadDays(service);
  }, [step, service, days, loadDays]);

  async function submit() {
    if (!service || !slot) return;
    setError(null);
    setSubmitting(true);
    try {
      const booking = await apiFetch<MyBookingView>(
        '/booking/create',
        {
          method: 'POST',
          body: JSON.stringify({
            username,
            serviceId: service.id,
            startAt: slot,
            name: name.trim(),
            note: note.trim() || null,
          }),
        },
        { redirectOnAuthFailure: false },
      );
      setResult(booking);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.submitError);
      // The slot may have just been taken: go pick another one.
      if (err instanceof ApiError && err.code === 'SLOT_UNAVAILABLE') {
        setDays(null);
        setStep('time');
      } else {
        setStep('info');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function goFromInfo() {
    if (name.trim().length < 2) {
      setError(t.name);
      return;
    }
    setError(null);
    if (user?.phoneVerified) void submit();
    else setStep('login');
  }

  if (loadFailed || (card && !card.booking.enabled)) {
    return (
      <AppShell>
        <p className="py-10 text-center text-muted-foreground">
          {t.notAvailable}
        </p>
      </AppShell>
    );
  }
  if (!card || authLoading) {
    return (
      <AppShell>
        <Skeleton className="mx-auto h-80 w-full max-w-lg" />
      </AppShell>
    );
  }

  const services = card.booking.services;
  const day = days && dayIndex !== null ? days[dayIndex] : null;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
        <header className="overflow-hidden rounded-3xl border bg-card">
          <div
            className="flex items-center gap-4 p-5 text-white"
            style={{
              background: coverBackground(themeFor(card.category)),
              color: '#fff',
            }}
          >
            {card.avatarUrl ? (
              <img
                src={card.avatarUrl}
                alt=""
                className="size-14 rounded-full border-2 border-white/80 object-cover"
              />
            ) : (
              <span
                className="flex size-14 items-center justify-center rounded-full border-2 border-white/80 bg-white/15 text-xl font-bold"
                aria-hidden="true"
              >
                {Array.from(card.displayName.trim())[0] ?? ''}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="m-0 text-lg font-bold">
                {t.title(card.displayName)}
              </h1>
              {card.headline ? (
                <p className="m-0 text-sm opacity-90">{card.headline}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <ol className="m-0 flex list-none gap-1.5 p-0" aria-hidden="true">
              {(['service', 'time', 'info'] as const).map((st, i) => (
                <li
                  key={st}
                  className={`h-1.5 w-10 rounded-full ${
                    i <=
                    ['service', 'time', 'info', 'login', 'done'].indexOf(step)
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </ol>
            <p className="m-0 text-xs text-muted-foreground">
              {t.timezoneNote}
            </p>
          </div>
        </header>

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {step === 'service' ? (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">{t.stepService}</h2>
            {services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => {
                  setService(svc);
                  setDays(null);
                  setStep('time');
                }}
                className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 text-start transition-colors hover:border-primary"
              >
                <span className="flex flex-col">
                  <b>{svc.name}</b>
                  <small className="text-muted-foreground">
                    {fa.booking.modeLabels[svc.mode]}
                    {svc.note ? ` · ${svc.note}` : ''}
                  </small>
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs">
                  {fa.booking.minutes(formatNumber(svc.durationMinutes))}
                </span>
              </button>
            ))}
          </section>
        ) : null}

        {step === 'time' && service ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">
                {service.name} ·{' '}
                {fa.booking.minutes(formatNumber(service.durationMinutes))}
              </h2>
              {services.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setStep('service');
                  }}
                >
                  {t.back}
                </Button>
              ) : null}
            </div>
            {days === null ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div
                  className="flex gap-2 overflow-x-auto pb-2"
                  role="listbox"
                  aria-label={t.stepTime}
                >
                  {days.map((d, i) => {
                    const label = dayKeyLabel(d.date);
                    const off = d.slots.length === 0;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        role="option"
                        aria-selected={dayIndex === i}
                        disabled={off}
                        onClick={() => {
                          setDayIndex(i);
                          setSlot(null);
                        }}
                        className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border p-2 text-xs leading-snug transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          dayIndex === i
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'bg-card hover:border-primary'
                        }`}
                      >
                        <span>{label.weekday}</span>
                        <b className="text-lg">{label.day}</b>
                        <span>{off ? t.dayOff : label.month}</span>
                      </button>
                    );
                  })}
                </div>
                {day ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {formatDayKey(day.date)}
                    </p>
                    {day.slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t.noSlots}
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {day.slots.map((s) => (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={slot === s}
                            onClick={() => {
                              setSlot(s);
                            }}
                            className={`rounded-lg border py-2 text-sm tabular-nums transition-colors ${
                              slot === s
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'bg-card hover:border-primary'
                            }`}
                          >
                            {formatTime(s)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {days.every((d) => d.slots.length === 0)
                      ? t.noSlots
                      : t.pickDay}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={!slot}
                    onClick={() => {
                      setStep('info');
                    }}
                  >
                    {t.next}
                  </Button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {step === 'info' && service && slot ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">{t.stepInfo}</h2>
            <p className="rounded-lg bg-muted p-3 text-sm">
              <b>{service.name}</b> ·{' '}
              {fa.booking.minutes(formatNumber(service.durationMinutes))}
              <br />
              {formatDayTime(slot)}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bookerName">{t.name}</Label>
              <Input
                id="bookerName"
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bookerNote">{t.note}</Label>
              <Textarea
                id="bookerNote"
                value={note}
                maxLength={500}
                rows={3}
                placeholder={t.notePlaceholder}
                onChange={(e) => {
                  setNote(e.target.value);
                }}
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('time');
                }}
              >
                {t.back}
              </Button>
              <Button type="button" disabled={submitting} onClick={goFromInfo}>
                {submitting ? t.submitting : t.next}
              </Button>
            </div>
          </section>
        ) : null}

        {step === 'login' ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">{t.stepLogin}</h2>
            <p className="text-sm text-muted-foreground">{t.loginHint}</p>
            <AuthForm onSuccess={() => void submit()} />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep('info');
              }}
            >
              {t.back}
            </Button>
          </section>
        ) : null}

        {step === 'done' && result ? (
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 text-center">
            <h2 className="text-xl font-semibold">{t.doneTitle}</h2>
            <p className="text-sm">
              {result.serviceName} · {formatDay(result.startAt)}،{' '}
              {formatTime(result.startAt)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t.doneText(card.displayName)}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href={`/b/${result.cancelToken}`}>{t.trackLink}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${username}`}>{t.backToCard}</Link>
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
