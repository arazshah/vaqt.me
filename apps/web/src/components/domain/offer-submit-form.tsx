'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { submitOfferSchema, tomanToRial } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Textarea } from '@vaqt/ui/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@vaqt/ui/components/ui/form';

import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

// Structurally permissive on purpose (see request-form.tsx for the same
// pattern) — the authoritative bounds are submitOfferSchema, applied on
// submit below, not duplicated here.
const rawFormSchema = z.object({
  proposedStartAt: z.string().min(1, 'زمان پیشنهادی الزامی است'),
  proposedDurationMinutes: z.string().min(1, 'مدت زمان الزامی است'),
  amountToman: z.string().min(1, 'مبلغ پیشنهادی الزامی است'),
  message: z.string(),
});
type RawFormValues = z.infer<typeof rawFormSchema>;

const SCHEMA_TO_FORM_FIELD: Partial<Record<string, keyof RawFormValues>> = {
  proposedStartAt: 'proposedStartAt',
  proposedDurationMinutes: 'proposedDurationMinutes',
  amountRial: 'amountToman',
  message: 'message',
};

export function OfferSubmitForm({
  requestId,
  onSubmitted,
}: {
  requestId: string;
  onSubmitted: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<RawFormValues>({
    resolver: zodResolver(rawFormSchema),
    defaultValues: {
      proposedStartAt: '',
      proposedDurationMinutes: '',
      amountToman: '',
      message: '',
    },
  });

  async function handleSubmit(values: RawFormValues) {
    setServerError(null);

    const candidate = {
      requestId,
      // datetime-local has no timezone suffix — new Date() treats it as
      // local time, and toISOString() converts to UTC before it ever
      // leaves the browser (see CLAUDE.md TIMEZONE.md rule).
      proposedStartAt: new Date(values.proposedStartAt).toISOString(),
      proposedDurationMinutes: Number(values.proposedDurationMinutes),
      amountRial: tomanToRial(Number(values.amountToman)),
      message: values.message.trim() || null,
    };
    const result = submitOfferSchema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const schemaField = String(issue.path[0]);
        const formField = SCHEMA_TO_FORM_FIELD[schemaField];
        if (formField) {
          form.setError(formField, { message: issue.message });
        }
      }
      setServerError(result.error.issues[0]?.message ?? null);
      return;
    }

    setPending(true);
    try {
      await apiFetch('/offers', {
        method: 'POST',
        body: JSON.stringify(result.data),
      });
      form.reset();
      onSubmitted();
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : fa.requestDetailPage.offers.submitForm.genericError,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="proposedStartAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {fa.requestDetailPage.offers.submitForm.proposedStartAt}
              </FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="proposedDurationMinutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {fa.requestDetailPage.offers.submitForm.proposedDurationMinutes}
              </FormLabel>
              <FormControl>
                <Input type="number" min={15} max={1440} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amountToman"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {fa.requestDetailPage.offers.submitForm.amountToman}
              </FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {fa.requestDetailPage.offers.submitForm.message}
              </FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
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
            ? fa.requestDetailPage.offers.submitForm.submitting
            : fa.requestDetailPage.offers.submitForm.submitButton}
        </Button>
      </form>
    </Form>
  );
}
