'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SERVICE_MODES,
  type BookingSettingsView,
  type MyCard,
  type ServiceMode,
} from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Checkbox } from '@vaqt/ui/components/ui/checkbox';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  formatDayKey,
  minutesToTimeInput,
  timeInputToMinutes,
} from '@/lib/date-format';
import { fa } from '@/messages/fa';

const t = fa.bookingSettingsPage;

// Iranian week order, Saturday first. Values are Date#getDay numbers.
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;
const DURATIONS = [15, 30, 45, 60, 90, 120];

interface Window {
  start: string;
  end: string;
}
interface ServiceDraft {
  id?: string;
  name: string;
  durationMinutes: number;
  mode: ServiceMode;
  note: string;
}
type Status = { kind: 'ok' | 'error'; text: string } | null;

const selectClass = 'h-9 rounded-md border bg-background px-2 text-sm';

function emptyWeek(): Record<number, Window[]> {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

export default function BookingSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasUsername, setHasUsername] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [minNotice, setMinNotice] = useState(2);
  const [maxDays, setMaxDays] = useState(30);
  const [week, setWeek] = useState<Record<number, Window[]>>(emptyWeek());
  const [services, setServices] = useState<ServiceDraft[]>([]);
  const [leave, setLeave] = useState<string[]>([]);
  const [leaveDraft, setLeaveDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  function apply(s: BookingSettingsView) {
    setEnabled(s.enabled);
    setMinNotice(s.minNoticeHours);
    setMaxDays(s.maxDaysAhead);
    const w = emptyWeek();
    for (const r of s.rules) {
      w[r.weekday].push({
        start: minutesToTimeInput(r.startMinute),
        end: minutesToTimeInput(r.endMinute),
      });
    }
    setWeek(w);
    setServices(
      s.services.map((svc) => ({
        id: svc.id,
        name: svc.name,
        durationMinutes: svc.durationMinutes,
        mode: svc.mode,
        note: svc.note ?? '',
      })),
    );
    setLeave(s.exceptions);
  }

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiFetch<BookingSettingsView>('/booking/me/settings', {
        method: 'POST',
        body: '{}',
      }),
      apiFetch<MyCard>('/cards/me', { method: 'POST', body: '{}' }),
    ])
      .then(([s, card]) => {
        apply(s);
        setHasUsername(card.username !== null);
        setReady(true);
      })
      .catch(() => {
        setFailed(true);
      });
  }, [user]);

  if (loading || !user || (!ready && !failed)) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full max-w-2xl" />
      </AppShell>
    );
  }
  if (failed) {
    return (
      <AppShell>
        <p className="text-destructive">{t.loadError}</p>
      </AppShell>
    );
  }
  if (!hasUsername) {
    return (
      <AppShell>
        <div className="flex flex-col items-start gap-3">
          <p>{t.needUsername}</p>
          <Button asChild>
            <Link href="/card/edit">{t.goToCard}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  function setWindow(day: number, index: number, patch: Partial<Window>) {
    setWeek((prev) => ({
      ...prev,
      [day]: prev[day].map((w, i) => (i === index ? { ...w, ...patch } : w)),
    }));
  }

  function suggestHours() {
    const w = emptyWeek();
    for (const d of [6, 0, 1, 2, 3]) w[d] = [{ start: '09:00', end: '17:00' }];
    setWeek(w);
  }

  function setService(index: number, patch: Partial<ServiceDraft>) {
    setServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function addLeave() {
    if (!leaveDraft || leave.includes(leaveDraft)) return;
    setLeave((prev) => [...prev, leaveDraft].sort());
    setLeaveDraft('');
  }

  async function save() {
    setStatus(null);
    const rules: { weekday: number; startMinute: number; endMinute: number }[] =
      [];
    for (const day of WEEK_ORDER) {
      const windows = week[day]
        .map((w) => ({
          s: timeInputToMinutes(w.start),
          e: timeInputToMinutes(w.end),
        }))
        .sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
      for (const [i, w] of windows.entries()) {
        if (w.s === null || w.e === null || w.s >= w.e) {
          setStatus({ kind: 'error', text: t.invalidWindow });
          return;
        }
        if (i > 0 && w.s < (windows[i - 1].e ?? 0)) {
          setStatus({ kind: 'error', text: t.overlapWindow });
          return;
        }
        rules.push({ weekday: day, startMinute: w.s, endMinute: w.e });
      }
    }
    if (enabled && services.length === 0) {
      setStatus({ kind: 'error', text: t.needService });
      return;
    }
    setSaving(true);
    try {
      const next = await apiFetch<BookingSettingsView>(
        '/booking/me/settings/update',
        {
          method: 'POST',
          body: JSON.stringify({
            enabled,
            minNoticeHours: minNotice,
            maxDaysAhead: maxDays,
            rules,
            exceptions: leave,
            services: services.map((s) => ({
              ...(s.id ? { id: s.id } : {}),
              name: s.name,
              durationMinutes: s.durationMinutes,
              mode: s.mode,
              note: s.note.trim() || null,
            })),
          }),
        },
      );
      apply(next);
      setStatus({ kind: 'ok', text: t.saved });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: err instanceof ApiError ? err.message : t.saveError,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <section className="flex items-center gap-2 rounded-xl border bg-card p-4">
          <Checkbox
            id="enabled"
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v === true);
            }}
          />
          <Label htmlFor="enabled">{t.enabled}</Label>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div>
            <h2 className="font-semibold">{t.servicesTitle}</h2>
            <p className="text-xs text-muted-foreground">{t.servicesHelp}</p>
          </div>
          {services.map((svc, i) => (
            <div
              key={svc.id ?? `new-${String(i)}`}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`svc-name-${String(i)}`}>{t.serviceName}</Label>
                <Input
                  id={`svc-name-${String(i)}`}
                  value={svc.name}
                  maxLength={60}
                  placeholder={t.serviceNamePlaceholder}
                  onChange={(e) => {
                    setService(i, { name: e.target.value });
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`svc-dur-${String(i)}`}>{t.duration}</Label>
                  <select
                    id={`svc-dur-${String(i)}`}
                    className={selectClass}
                    value={svc.durationMinutes}
                    onChange={(e) => {
                      setService(i, {
                        durationMinutes: Number(e.target.value),
                      });
                    }}
                  >
                    {[...new Set([...DURATIONS, svc.durationMinutes])]
                      .sort((a, b) => a - b)
                      .map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`svc-mode-${String(i)}`}>{t.mode}</Label>
                  <select
                    id={`svc-mode-${String(i)}`}
                    className={selectClass}
                    value={svc.mode}
                    onChange={(e) => {
                      setService(i, { mode: e.target.value as ServiceMode });
                    }}
                  >
                    {SERVICE_MODES.map((m) => (
                      <option key={m} value={m}>
                        {fa.booking.modeLabels[m]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`svc-note-${String(i)}`}>{t.serviceNote}</Label>
                <Input
                  id={`svc-note-${String(i)}`}
                  value={svc.note}
                  maxLength={300}
                  onChange={(e) => {
                    setService(i, { note: e.target.value });
                  }}
                />
              </div>
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setServices((prev) => prev.filter((_, j) => j !== i));
                  }}
                >
                  {t.removeService}
                </Button>
              </div>
            </div>
          ))}
          {services.length < 8 ? (
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setServices((prev) => [
                    ...prev,
                    { name: '', durationMinutes: 30, mode: 'online', note: '' },
                  ]);
                }}
              >
                {t.addService}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t.rulesTitle}</h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={suggestHours}
            >
              {t.suggestHours}
            </Button>
          </div>
          {WEEK_ORDER.map((day) => (
            <div
              key={day}
              className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm">{fa.booking.weekdays[day]}</b>
                <span className="text-xs text-muted-foreground">
                  {week[day].length === 0 ? t.closed : t.open}
                </span>
              </div>
              {week[day].map((w, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2"
                  dir="ltr"
                >
                  <Input
                    type="time"
                    aria-label={`${fa.booking.weekdays[day]} ${t.from}`}
                    className="w-32"
                    value={w.start}
                    onChange={(e) => {
                      setWindow(day, i, { start: e.target.value });
                    }}
                  />
                  <span>–</span>
                  <Input
                    type="time"
                    aria-label={`${fa.booking.weekdays[day]} ${t.to}`}
                    className="w-32"
                    value={w.end}
                    onChange={(e) => {
                      setWindow(day, i, { end: e.target.value });
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setWeek((prev) => ({
                        ...prev,
                        [day]: prev[day].filter((_, j) => j !== i),
                      }));
                    }}
                  >
                    {t.removeWindow}
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setWeek((prev) => ({
                      ...prev,
                      [day]: [...prev[day], { start: '09:00', end: '17:00' }],
                    }));
                  }}
                >
                  {t.addWindow}
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{t.ruleTitle}</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minNotice">{t.minNotice}</Label>
              <Input
                id="minNotice"
                type="number"
                min={0}
                max={168}
                className="w-28"
                value={minNotice}
                onChange={(e) => {
                  setMinNotice(
                    Math.max(0, Math.min(168, Number(e.target.value) || 0)),
                  );
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxDays">{t.maxDays}</Label>
              <Input
                id="maxDays"
                type="number"
                min={1}
                max={90}
                className="w-28"
                value={maxDays}
                onChange={(e) => {
                  setMaxDays(
                    Math.max(1, Math.min(90, Number(e.target.value) || 1)),
                  );
                }}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div>
            <h2 className="font-semibold">{t.leaveTitle}</h2>
            <p className="text-xs text-muted-foreground">{t.leaveHelp}</p>
          </div>
          <div className="flex gap-2" dir="ltr">
            <Input
              type="date"
              aria-label={t.leaveTitle}
              className="w-44"
              value={leaveDraft}
              onChange={(e) => {
                setLeaveDraft(e.target.value);
              }}
            />
            <Button type="button" variant="outline" onClick={addLeave}>
              {t.addLeave}
            </Button>
          </div>
          {leave.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {leave.map((d) => (
                <li
                  key={d}
                  className="flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm"
                >
                  {formatDayKey(d)}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`${t.removeLeave} ${formatDayKey(d)}`}
                    onClick={() => {
                      setLeave((prev) => prev.filter((x) => x !== d));
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="lg"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? t.saving : t.save}
          </Button>
          {status ? (
            <p
              role="status"
              className={
                status.kind === 'ok'
                  ? 'text-sm text-primary'
                  : 'text-sm text-destructive'
              }
            >
              {status.text}
            </p>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
