'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePasswordSchema } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';

import { AppShell } from '@/components/app-shell';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const t = fa.changePasswordPage;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, refetch } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forced = user?.mustChangePassword === true;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== repeat) {
      setError(t.mismatch);
      return;
    }
    const parsed = changePasswordSchema.safeParse({
      currentPassword: current,
      newPassword: next,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t.error);
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/auth/password/change', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      await refetch();
      router.replace(
        user?.systemRole === 'ADMIN' ? '/admin/settings' : '/card',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    autoComplete: string,
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        dir="ltr"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => {
          set(e.target.value);
        }}
        required
      />
    </div>
  );

  return (
    <AppShell>
      <form
        onSubmit={(e) => void submit(e)}
        className="mx-auto flex max-w-md flex-col gap-4 py-8"
        noValidate
      >
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p
          className={`text-sm ${forced ? 'rounded-xl bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}
        >
          {forced ? t.forcedIntro : t.intro}
        </p>
        {field(
          'pw-current',
          t.current,
          current,
          setCurrent,
          'current-password',
        )}
        {field('pw-next', t.next, next, setNext, 'new-password')}
        <p className="-mt-2 text-xs text-muted-foreground">{t.help}</p>
        {field('pw-repeat', t.repeat, repeat, setRepeat, 'new-password')}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? t.submitting : t.submit}
        </Button>
      </form>
    </AppShell>
  );
}
