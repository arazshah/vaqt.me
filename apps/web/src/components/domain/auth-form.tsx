'use client';

import { useEffect, useState } from 'react';
import type { AuthMethods } from '@vaqt/shared';

import { OtpForm } from '@/components/domain/otp-form';
import { PasswordForm } from '@/components/domain/password-form';
import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

const t = fa.authForm;

/**
 * SMS is the primary sign-in and sign-up method. Existing password accounts
 * (including the administrator) retain their sign-in route.
 */
export function AuthForm({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) {
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [useEmail, setUseEmail] = useState(false);

  useEffect(() => {
    apiFetch<AuthMethods>('/auth/methods', undefined, {
      redirectOnAuthFailure: false,
    })
      .then(setMethods)
      .catch(() => {
        setMethods({ password: true, sms: false });
      });
  }, []);

  if (!methods) return <p role="status">{t.wait}</p>;

  if (!useEmail && methods.sms) {
    return (
      <div className="flex flex-col gap-4">
        <OtpForm {...(onSuccess ? { onSuccess } : {})} />
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => {
            setUseEmail(true);
          }}
        >
          {t.useEmail}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!methods.sms ? (
        <p className="text-sm text-muted-foreground">{t.smsUnavailable}</p>
      ) : null}
      <PasswordForm mode="login" {...(onSuccess ? { onSuccess } : {})} />
      {methods.sms ? (
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => {
            setUseEmail(false);
          }}
        >
          {t.useSms}
        </button>
      ) : null}
    </div>
  );
}
