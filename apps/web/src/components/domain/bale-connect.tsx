'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@vaqt/ui/components/ui/button';

import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface Status {
  bound: boolean;
  botUsername: string | null;
}
interface LinkOffer {
  code: string;
  url: string | null;
  expiresInSeconds: number;
}

const t = fa.baleConnect;
const POLL_MS = 3000;

function post<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: '{}' });
}

export function BaleConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [offer, setOffer] = useState<LinkOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await post<Status>('/messenger/bale/status');
      setStatus(s);
      if (s.bound) setOffer(null);
    } catch {
      setError(t.error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // While a code is on screen, poll until the bot reports the link.
  useEffect(() => {
    if (!offer) return;
    timer.current = setInterval(() => void refresh(), POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [offer, refresh]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      setOffer(await post<LinkOffer>('/messenger/bale/link'));
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await post('/messenger/bale/unlink');
      await refresh();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{t.title}</h2>
      <p className="text-sm text-muted-foreground">{t.description}</p>

      {status.bound ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-primary">{t.connected}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            {t.disconnect}
          </Button>
        </div>
      ) : offer ? (
        <div className="flex flex-col gap-2">
          {offer.url ? (
            <Button asChild className="w-fit">
              <a href={offer.url} target="_blank" rel="noopener noreferrer">
                {t.openBale}
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t.notConfigured}</p>
          )}
          <p className="text-sm">{t.codeIntro}</p>
          <p
            dir="ltr"
            className="w-fit select-all rounded-lg bg-muted px-4 py-2 text-start text-xl font-bold tracking-widest"
          >
            {offer.code}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.codeExpires} {t.waiting}
          </p>
        </div>
      ) : (
        <div>
          <Button type="button" disabled={busy} onClick={() => void connect()}>
            {t.connect}
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
