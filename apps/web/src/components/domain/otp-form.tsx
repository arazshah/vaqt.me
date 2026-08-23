'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@vaqt/ui/components/ui/button';
import { BidiInput } from '@vaqt/ui/components/bidi-input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@vaqt/ui/components/ui/form';

import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

// Mirrors apps/api/src/auth/dto/request-otp.dto.ts (IsString + IsNotEmpty)
// — there's no shared zod schema for these two DTOs (they predate the
// phase-3 move to zod, see CLAUDE.md bond 30), so this is hand-matched to
// the backend's class-validator rules rather than reused from @vaqt/shared.
const phoneSchema = z.object({
  phone: z.string().trim().min(1, fa.loginPage.phoneRequired),
});

// Mirrors apps/api/src/auth/dto/verify-otp.dto.ts (@Matches(/^\d{4,8}$/)).
const codeSchema = z.object({
  code: z.string().regex(/^\d{4,8}$/, fa.loginPage.codeInvalid),
});

export function OtpForm() {
  const router = useRouter();
  const { refetch } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  async function handleRequestCode(values: z.infer<typeof phoneSchema>) {
    setServerError(null);
    setPending(true);
    try {
      await apiFetch(
        '/auth/otp/request',
        { method: 'POST', body: JSON.stringify({ phone: values.phone }) },
        { redirectOnAuthFailure: false },
      );
      setPhone(values.phone);
      setStep('code');
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : fa.loginPage.genericError,
      );
    } finally {
      setPending(false);
    }
  }

  async function handleVerify(values: z.infer<typeof codeSchema>) {
    setServerError(null);
    setPending(true);
    try {
      await apiFetch(
        '/auth/otp/verify',
        {
          method: 'POST',
          body: JSON.stringify({ phone, code: values.code }),
        },
        { redirectOnAuthFailure: false },
      );
      await refetch();
      router.push('/requests');
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : fa.loginPage.genericError,
      );
    } finally {
      setPending(false);
    }
  }

  if (step === 'phone') {
    return (
      <Form {...phoneForm}>
        <form
          onSubmit={(e) => void phoneForm.handleSubmit(handleRequestCode)(e)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={phoneForm.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{fa.loginPage.phoneLabel}</FormLabel>
                <FormControl>
                  <BidiInput
                    placeholder={fa.loginPage.phonePlaceholder}
                    inputMode="tel"
                    autoComplete="tel"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverError ? (
            <p className="text-sm text-destructive">{serverError}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending
              ? fa.loginPage.requestingCode
              : fa.loginPage.requestCodeButton}
          </Button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...codeForm}>
      <form
        onSubmit={(e) => void codeForm.handleSubmit(handleVerify)(e)}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-muted-foreground">
          {fa.loginPage.codeSentTo(phone)}
        </p>
        <FormField
          control={codeForm.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.loginPage.codeLabel}</FormLabel>
              <FormControl>
                <BidiInput
                  placeholder={fa.loginPage.codePlaceholder}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError ? (
          <p className="text-sm text-destructive">{serverError}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? fa.loginPage.verifying : fa.loginPage.verifyButton}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setStep('phone');
            setServerError(null);
          }}
        >
          {fa.loginPage.changePhone}
        </Button>
      </form>
    </Form>
  );
}
