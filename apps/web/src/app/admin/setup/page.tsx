'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';

import { AppShell } from '@/components/app-shell';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const t = fa.adminSetupPage;

export default function AdminSetupPage() {
  const router = useRouter();
  const { refetch } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ needsSetup: boolean }>(
      '/admin/setup/status',
      { method: 'POST', body: '{}' },
      { redirectOnAuthFailure: false },
    )
      .then((r) => {
        setNeedsSetup(r.needsSetup);
      })
      .catch(() => {
        setNeedsSetup(false);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(
        '/admin/setup/claim',
        {
          method: 'POST',
          body: JSON.stringify({
            token: token.trim(),
            phone,
            ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          }),
        },
        { redirectOnAuthFailure: false },
      );
      await refetch();
      router.push('/admin/settings');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        {needsSetup === null ? (
          <p className="text-muted-foreground">{t.loading}</p>
        ) : !needsSetup ? (
          <div className="flex flex-col items-start gap-3">
            <p>{t.alreadyDone}</p>
            <Button asChild>
              <Link href="/login">{t.goLogin}</Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => void submit(e)}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-muted-foreground">{t.intro}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="token">{t.token}</Label>
              <Input
                id="token"
                dir="ltr"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                }}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{t.phone}</Label>
              <Input
                id="phone"
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                }}
                placeholder="09123456789"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t.displayName}</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                }}
                maxLength={50}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? t.submitting : t.submit}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
