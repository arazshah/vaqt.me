'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SettingGroup, SettingView } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const t = fa.adminSettingsPage;
const GROUPS: SettingGroup[] = ['sms', 'bale', 'sms_templates'];

interface UpdateResponse {
  changed: string[];
  settings: SettingView[];
}
type Notice = { kind: 'ok' | 'error'; text: string } | null;

const post = <T,>(path: string, body: unknown = {}) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });

export default function AdminSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<SettingView[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Only fields the admin actually touched are sent.
  const [edits, setEdits] = useState<Partial<Record<string, string>>>({});
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [fieldError, setFieldError] = useState<{
    key: string;
    text: string;
  } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [baleBusy, setBaleBusy] = useState(false);
  const [baleNotice, setBaleNotice] = useState<Notice>(null);
  const [testPhone, setTestPhone] = useState('');
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsNotice, setSmsNotice] = useState<Notice>(null);

  const isAdmin = user?.systemRole === 'ADMIN';

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const load = useCallback(() => {
    post<{ settings: SettingView[] }>('/admin/settings/list')
      .then((r) => {
        setSettings(r.settings);
      })
      .catch(() => {
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (loading || !user)
    return (
      <AppShell>
        <Skeleton className="h-96 w-full max-w-2xl" />
      </AppShell>
    );
  if (!isAdmin) {
    return (
      <AppShell>
        <p className="text-muted-foreground">{t.forbidden}</p>
      </AppShell>
    );
  }

  async function save() {
    setNotice(null);
    setFieldError(null);
    const set = Object.fromEntries(
      Object.entries(edits).flatMap(([k, v]) =>
        v === undefined ? [] : [[k, v]],
      ),
    );
    if (Object.keys(set).length === 0 && cleared.size === 0) {
      setNotice({ kind: 'ok', text: t.nothingChanged });
      return;
    }
    setSaving(true);
    try {
      const res = await post<UpdateResponse>('/admin/settings/update', {
        set,
        clear: [...cleared],
      });
      setSettings(res.settings);
      setEdits({});
      setCleared(new Set());
      setNotice({ kind: 'ok', text: t.saved });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SETTING_INVALID') {
        const details = (
          err as ApiError & { details?: { key: string; reason: string } }
        ).details;
        setFieldError({
          key: details?.key ?? '',
          text: t.invalid[details?.reason ?? 'invalid'] ?? err.message,
        });
      }
      setNotice({
        kind: 'error',
        text: err instanceof ApiError ? err.message : t.loadError,
      });
    } finally {
      setSaving(false);
    }
  }

  async function connectBale() {
    setBaleBusy(true);
    setBaleNotice(null);
    try {
      // Unsaved token edits would otherwise be ignored by the server.
      if (edits['bale.botToken']) await save();
      const res = await post<{ username: string | null }>(
        '/admin/settings/bale/connect',
      );
      setBaleNotice({
        kind: 'ok',
        text: res.username
          ? t.baleConnected(res.username)
          : t.baleConnectedNoName,
      });
      load();
    } catch {
      setBaleNotice({ kind: 'error', text: t.baleConnectError });
    } finally {
      setBaleBusy(false);
    }
  }

  async function sendTestSms() {
    setSmsBusy(true);
    setSmsNotice(null);
    try {
      const res = await post<{ delivered: boolean }>(
        '/admin/settings/sms/test',
        { phone: testPhone },
      );
      setSmsNotice(
        res.delivered
          ? { kind: 'ok', text: t.smsTestOk }
          : { kind: 'error', text: t.smsTestNotDelivered },
      );
    } catch {
      setSmsNotice({ kind: 'error', text: t.smsTestError });
    } finally {
      setSmsBusy(false);
    }
  }

  const setValue = (key: string, value: string) => {
    setEdits((p) => ({ ...p, [key]: value }));
    setCleared((p) => {
      const n = new Set(p);
      n.delete(key);
      return n;
    });
  };

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        {failed ? (
          <p className="text-destructive">{t.loadError}</p>
        ) : !settings ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <>
            {GROUPS.map((group) => (
              <section
                key={group}
                className="flex flex-col gap-4 rounded-xl border bg-card p-4"
              >
                <div>
                  <h2 className="font-semibold">{t.groups[group]}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t.groupHelp[group]}
                  </p>
                </div>

                {settings
                  .filter((s) => s.group === group)
                  .map((s) => {
                    const meta = t.fields[s.key] ?? { label: s.key };
                    const edited = edits[s.key];
                    const isCleared = cleared.has(s.key);
                    return (
                      <div key={s.key} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={s.key}>{meta.label}</Label>
                          <span className="text-xs text-muted-foreground">
                            {t.sources[s.source]}
                          </span>
                        </div>

                        {s.kind === 'select' ? (
                          <select
                            id={s.key}
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                            value={edited ?? s.value ?? ''}
                            onChange={(e) => {
                              setValue(s.key, e.target.value);
                            }}
                          >
                            {s.options?.map((o) => (
                              <option key={o} value={o}>
                                {t.options[o] ?? o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={s.key}
                            dir="ltr"
                            type={s.kind === 'secret' ? 'password' : 'text'}
                            autoComplete="off"
                            spellCheck={false}
                            value={
                              edited ??
                              (s.kind === 'secret'
                                ? ''
                                : isCleared
                                  ? ''
                                  : (s.value ?? ''))
                            }
                            placeholder={
                              s.kind === 'secret'
                                ? s.isSet
                                  ? t.secretSet
                                  : t.secretUnset
                                : ''
                            }
                            onChange={(e) => {
                              setValue(s.key, e.target.value);
                            }}
                          />
                        )}

                        {meta.help ? (
                          <p className="text-xs text-muted-foreground">
                            {meta.help}
                          </p>
                        ) : null}
                        {fieldError?.key === s.key ? (
                          <p role="alert" className="text-xs text-destructive">
                            {fieldError.text}
                          </p>
                        ) : null}
                        {s.kind !== 'select' && s.source === 'panel' ? (
                          <button
                            type="button"
                            className="w-fit text-xs text-muted-foreground underline"
                            onClick={() => {
                              setCleared((p) => new Set(p).add(s.key));
                              setEdits((p) =>
                                Object.fromEntries(
                                  Object.entries(p).filter(
                                    ([k]) => k !== s.key,
                                  ),
                                ),
                              );
                            }}
                          >
                            {t.clear}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}

                {group === 'bale' ? (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-fit"
                      disabled={baleBusy}
                      onClick={() => void connectBale()}
                    >
                      {baleBusy ? t.baleConnecting : t.baleConnect}
                    </Button>
                    {baleNotice ? (
                      <p
                        role="status"
                        className={
                          baleNotice.kind === 'ok'
                            ? 'text-sm text-primary'
                            : 'text-sm text-destructive'
                        }
                      >
                        {baleNotice.text}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {group === 'sms' ? (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <b className="text-sm">{t.smsTestTitle}</b>
                    <div
                      className="flex flex-wrap items-center gap-2"
                      dir="ltr"
                    >
                      <Input
                        aria-label={t.smsTestPhone}
                        className="w-48"
                        inputMode="tel"
                        placeholder="09123456789"
                        value={testPhone}
                        onChange={(e) => {
                          setTestPhone(e.target.value);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={smsBusy || !testPhone}
                        onClick={() => void sendTestSms()}
                      >
                        {smsBusy ? t.smsTestSending : t.smsTestSend}
                      </Button>
                    </div>
                    {smsNotice ? (
                      <p
                        role="status"
                        className={
                          smsNotice.kind === 'ok'
                            ? 'text-sm text-primary'
                            : 'text-sm text-destructive'
                        }
                      >
                        {smsNotice.text}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ))}

            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="lg"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? t.saving : t.save}
              </Button>
              {notice ? (
                <p
                  role="status"
                  className={
                    notice.kind === 'ok'
                      ? 'text-sm text-primary'
                      : 'text-sm text-destructive'
                  }
                >
                  {notice.text}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
