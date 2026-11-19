'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MyCard, WalletStatusView } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';

import { ApiError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const t = fa.cardWallet;

function post<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    { redirectOnAuthFailure: false },
  );
}

/**
 * "Save to wallet" and "Exchange cards" under a public card. Hidden on your
 * own card; for guests it only points to login (nothing is saved anonymously).
 */
export function WalletActions({ username }: { username: string }) {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<WalletStatusView | null>(null);
  const [myUsername, setMyUsername] = useState<string | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      post<WalletStatusView>('/wallet/status', { username }),
      post<MyCard>('/cards/me', {}),
    ])
      .then(([s, mine]) => {
        setStatus(s);
        setMyUsername(mine.username);
      })
      .catch(() => {
        setError(t.error);
      });
  }, [user, username]);

  if (loading) return null;

  if (!user) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        {t.loginHint}{' '}
        <Link href="/login" className="font-medium text-primary">
          {t.login}
        </Link>
      </p>
    );
  }
  if (myUsername === username) return null; // your own card
  if (!status) {
    return error ? (
      <p role="alert" className="text-center text-sm text-destructive">
        {error}
      </p>
    ) : null;
  }

  async function run(path: string) {
    setBusy(true);
    setError(null);
    try {
      setStatus(await post<WalletStatusView>(path, { username }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 [&>*]:flex-1">
        <Button
          type="button"
          variant="outline"
          disabled={busy || status.saved}
          onClick={() => void run('/wallet/save')}
        >
          {status.saved ? t.saved : t.save}
        </Button>
        {myUsername ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy || status.exchanged}
            onClick={() => void run('/wallet/exchange')}
          >
            {status.exchanged ? t.exchanged : t.exchange}
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/card/edit">{t.makeCard}</Link>
          </Button>
        )}
      </div>
      {myUsername && !status.exchanged ? (
        <p className="text-center text-xs text-muted-foreground">
          {t.exchangeHint}
        </p>
      ) : null}
      {!myUsername ? (
        <p className="text-center text-xs text-muted-foreground">
          {t.needCard}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
