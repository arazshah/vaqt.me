'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { loginSchema, registerSchema } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';

import { ApiError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const t = fa.authForm;
// Sign-up is refused if the form was "submitted" faster than a person can
// type; keep the button disabled for that long so real users never hit it.
const MIN_FILL_MS = 3300;

export function PasswordForm({
  mode,
  onSuccess,
}: {
  mode: 'login' | 'register';
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { refetch } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [show, setShow] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(mode === 'login');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (mode !== 'register') return;
    let alive = true;
    setReady(false);
    apiFetch<{ token: string }>('/auth/register-token', undefined, {
      redirectOnAuthFailure: false,
    })
      .then((r) => {
        if (alive) setToken(r.token);
      })
      .catch(() => undefined);
    const id = setTimeout(() => {
      if (alive) setReady(true);
    }, MIN_FILL_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload =
      mode === 'login'
        ? { email, password }
        : {
            email,
            password,
            displayName: displayName.trim() || undefined,
            formToken: token ?? 'x'.repeat(10),
            website,
          };
    const parsed = (mode === 'login' ? loginSchema : registerSchema).safeParse(
      payload,
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? fa.loginPage.genericError);
      return;
    }
    setPending(true);
    try {
      await apiFetch(
        mode === 'login' ? '/auth/login' : '/auth/register',
        { method: 'POST', body: JSON.stringify(parsed.data) },
        { redirectOnAuthFailure: false },
      );
      await refetch();
      if (onSuccess) onSuccess();
      else router.push('/card');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : fa.loginPage.genericError,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      {mode === 'register' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auth-name">{t.displayName}</Label>
          <Input
            id="auth-name"
            value={displayName}
            maxLength={50}
            autoComplete="name"
            onChange={(e) => {
              setDisplayName(e.target.value);
            }}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auth-email">{t.email}</Label>
        <Input
          id="auth-email"
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auth-password">{t.password}</Label>
        <div className="relative">
          <Input
            id="auth-password"
            type={show ? 'text' : 'password'}
            dir="ltr"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            value={password}
            className="pe-10"
            onChange={(e) => {
              setPassword(e.target.value);
            }}
          />
          <button
            type="button"
            onClick={() => {
              setShow((s) => !s);
            }}
            className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label={show ? t.hidePassword : t.showPassword}
          >
            {show ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {mode === 'register' ? (
          <p className="text-xs text-muted-foreground">{t.passwordHelp}</p>
        ) : null}
      </div>

      {/* honeypot: invisible to people, tempting to bots */}
      <div
        aria-hidden="true"
        className="absolute -start-[9999px] size-px overflow-hidden"
      >
        <label>
          website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
            }}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || !ready}>
        {pending
          ? t.submitting
          : !ready
            ? t.wait
            : mode === 'login'
              ? t.submitLogin
              : t.submitRegister}
      </Button>
    </form>
  );
}
