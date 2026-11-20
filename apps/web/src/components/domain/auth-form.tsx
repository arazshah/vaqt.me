'use client';

import { useEffect, useState } from 'react';
import type { AuthMethods } from '@vaqt/shared';

import { OtpForm } from '@/components/domain/otp-form';
import { PasswordForm } from '@/components/domain/password-form';
import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

const t = fa.authForm;

/**
 * Email + password (login / sign-up) by default. The SMS code flow is still
 * here but only offered when the server has it switched on.
 */
export function AuthForm({
  onSuccess,
  initialMode = 'login',
}: {
  onSuccess?: () => void;
  initialMode?: 'login' | 'register';
} = {}) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [useSms, setUseSms] = useState(false);

  useEffect(() => {
    apiFetch<AuthMethods>('/auth/methods', undefined, {
      redirectOnAuthFailure: false,
    })
      .then(setMethods)
      .catch(() => {
        setMethods({ password: true, sms: false });
      });
  }, []);

  if (useSms && methods?.sms) {
    return (
      <div className="flex flex-col gap-4">
        <OtpForm {...(onSuccess ? { onSuccess } : {})} />
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => {
            setUseSms(false);
          }}
        >
          {t.useEmail}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ['login', t.tabLogin],
            ['register', t.tabRegister],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => {
              setMode(id);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              mode === id ? 'bg-card shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <PasswordForm
        key={mode}
        mode={mode}
        {...(onSuccess ? { onSuccess } : {})}
      />
      {methods?.sms ? (
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => {
            setUseSms(true);
          }}
        >
          {t.useSms}
        </button>
      ) : null}
    </div>
  );
}
