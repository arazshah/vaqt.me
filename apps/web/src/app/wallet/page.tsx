'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WalletEntryView } from '@vaqt/shared';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@vaqt/ui/components/ui/avatar';
import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const t = fa.walletPage;

export default function WalletPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<WalletEntryView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const load = useCallback(() => {
    apiFetch<WalletEntryView[]>('/wallet/list', { method: 'POST', body: '{}' })
      .then(setEntries)
      .catch(() => {
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function remove(username: string) {
    setError(null);
    try {
      await apiFetch('/wallet/remove', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      setEntries(
        (prev) => prev?.filter((e) => e.username !== username) ?? null,
      );
    } catch {
      setError(t.removeError);
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!entries || !q) return entries;
    return entries.filter((e) =>
      `${e.displayName} ${e.headline ?? ''} ${e.city ?? ''} ${e.username}`
        .toLowerCase()
        .includes(q),
    );
  }, [entries, query]);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {failed ? (
          <p className="text-destructive">{t.loadError}</p>
        ) : shown === null ? (
          <Skeleton className="h-40 w-full" />
        ) : entries && entries.length === 0 ? (
          <p className="text-muted-foreground">{t.empty}</p>
        ) : (
          <>
            {entries && entries.length > 6 ? (
              <Input
                aria-label={t.search}
                placeholder={t.search}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
              />
            ) : null}
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {shown.map((e) => (
                <li
                  key={e.username}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3"
                >
                  <Avatar className="size-11">
                    {e.avatarUrl ? (
                      <AvatarImage src={e.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>
                      {Array.from(e.displayName)[0] ?? ''}
                    </AvatarFallback>
                  </Avatar>
                  <Link
                    href={`/${e.username}`}
                    className="flex min-w-0 flex-1 flex-col text-foreground no-underline"
                  >
                    <span className="truncate font-medium">
                      {e.displayName}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[e.headline, e.city].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                  {e.source === 'exchanged' ? (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                      {t.exchangedBadge}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void remove(e.username)}
                  >
                    {t.remove}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
