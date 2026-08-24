'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  createRequestSchema,
  tomanToRial,
  RequestMode,
  type CreateRequestInput,
} from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Textarea } from '@vaqt/ui/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@vaqt/ui/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@vaqt/ui/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vaqt/ui/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@vaqt/ui/components/ui/radio-group';
import { Label } from '@vaqt/ui/components/ui/label';

import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface Category {
  id: string;
  name: string;
}

// Raw shape of the form's inputs (everything the browser can actually
// produce: strings, even for numeric/date fields). No business-rule
// bounds live here — those all belong to createRequestSchema, the single
// shared source of truth, and are applied explicitly on submit via
// createRequestSchema.safeParse (see handleSubmit below), not duplicated
// here. This schema only guards against structurally-unusable input
// (empty required fields) so the resolver can show *something* before the
// user even tries to submit.
const rawFormSchema = z.object({
  title: z.string().trim().min(1, 'عنوان الزامی است'),
  description: z.string().trim().min(1, 'توضیحات الزامی است'),
  categoryId: z.string().min(1, 'دسته را انتخاب کنید'),
  mode: z.enum([RequestMode.ONLINE, RequestMode.IN_PERSON, RequestMode.HYBRID]),
  city: z.string().trim(),
  durationMinutes: z.string().min(1, 'مدت زمان الزامی است'),
  budgetMinToman: z.string().min(1, 'حداقل بودجه الزامی است'),
  budgetMaxToman: z.string().min(1, 'حداکثر بودجه الزامی است'),
  deadlineAt: z.string().min(1, 'مهلت الزامی است'),
  // Structurally permissive on purpose (plain strings, no HH:mm regex, no
  // length bounds) — the authoritative shape/format checks are
  // preferredWindowSchema inside createRequestSchema, applied on submit
  // below. A row left fully blank is treated as "not added" (filtered out
  // in toCreateRequestInput), so users can add a row and only fill part of
  // it to see the real per-field error from the shared schema.
  preferredWindows: z.array(
    z.object({
      day: z.string(),
      start: z.string(),
      end: z.string(),
    }),
  ),
});
type RawFormValues = z.infer<typeof rawFormSchema>;

// Maps createRequestSchema's field-error paths back to this form's actual
// field names, since budgetMinRial/budgetMaxRial (the schema's fields)
// aren't literally what the user types (they type Toman, in
// budgetMinToman/budgetMaxToman).
const SCHEMA_TO_FORM_FIELD: Partial<Record<string, keyof RawFormValues>> = {
  title: 'title',
  description: 'description',
  categoryId: 'categoryId',
  mode: 'mode',
  city: 'city',
  durationMinutes: 'durationMinutes',
  budgetMinRial: 'budgetMinToman',
  budgetMaxRial: 'budgetMaxToman',
  deadlineAt: 'deadlineAt',
};

// react-hook-form's FieldPath type for a preferredWindows row is a template
// literal keyed on `number` (`preferredWindows.${number}.day`), so the path
// has to be built from an actual number, not a stringified one — but
// interpolating a number into a template literal is exactly what
// @typescript-eslint/restrict-template-expressions forbids by default.
// Centralizing the (safe) cast here means the `as` only needs to be
// justified once instead of at every call site.
type PreferredWindowField = 'day' | 'start' | 'end';
// Narrower than FieldPath<RawFormValues> on purpose: keeping this as the
// exact leaf-path shape (not the full field-path union) is what lets
// FormField's generic narrow `field.value` down to `string` at each call
// site below, instead of widening it to every possible field's value type.
type PreferredWindowPath = `preferredWindows.${number}.${PreferredWindowField}`;
function preferredWindowFieldPath(
  index: number,
  field: PreferredWindowField,
): PreferredWindowPath {
  return `preferredWindows.${String(index)}.${field}` as PreferredWindowPath;
}

function toCreateRequestInput(values: RawFormValues): unknown {
  return {
    title: values.title,
    description: values.description,
    categoryId: values.categoryId,
    mode: values.mode,
    city: values.city ? values.city : null,
    durationMinutes: Number(values.durationMinutes),
    budgetMinRial: tomanToRial(Number(values.budgetMinToman)),
    budgetMaxRial: tomanToRial(Number(values.budgetMaxToman)),
    deadlineAt: values.deadlineAt,
    // Rows the user never touched (all three fields still blank) are
    // dropped rather than sent as empty strings — they weren't an intended
    // window, just an unused row.
    preferredWindows: values.preferredWindows
      .filter(
        (w) =>
          w.day.trim() !== '' || w.start.trim() !== '' || w.end.trim() !== '',
      )
      .map((w) => ({
        day: w.day.trim(),
        start: w.start.trim(),
        end: w.end.trim(),
      })),
  };
}

type Draft = { id: string; status: string } & RawFormValues;

// What the AI wizard (Phase 7) can hand off to prefill this form —
// deadlineAt and preferredWindows are deliberately excluded, since
// extracting a concrete deadline/schedule from free-form conversation is
// out of scope for the AI draft; the user fills those in manually either
// way.
export type RequestFormPrefill = Partial<
  Pick<
    RawFormValues,
    | 'title'
    | 'description'
    | 'categoryId'
    | 'mode'
    | 'city'
    | 'durationMinutes'
    | 'budgetMinToman'
    | 'budgetMaxToman'
  >
>;

export function RequestForm({
  initialValues,
}: {
  initialValues?: RequestFormPrefill;
} = {}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    apiFetch<{ items: Category[] }>('/categories')
      .then((res) => {
        setCategories(res.items);
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  const form = useForm<RawFormValues>({
    // Only catches structurally-empty fields (rawFormSchema has no
    // business-rule bounds) — the authoritative pass is
    // createRequestSchema.safeParse in handleCreate below, which is the
    // actual @vaqt/shared schema apps/api validates against.
    resolver: zodResolver(rawFormSchema),
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      mode: RequestMode.ONLINE,
      city: '',
      durationMinutes: '',
      budgetMinToman: '',
      budgetMaxToman: '',
      deadlineAt: '',
      preferredWindows: [],
      ...initialValues,
    },
  });

  const preferredWindows = useFieldArray({
    control: form.control,
    name: 'preferredWindows',
  });

  async function handleCreate(values: RawFormValues) {
    setServerError(null);

    // The authoritative validation pass: the exact same createRequestSchema
    // used by apps/api (via @vaqt/shared), not a re-implementation. Any
    // failure here means the request would also fail server-side.
    const candidate = toCreateRequestInput(values);
    const result = createRequestSchema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const [first, second, third] = issue.path;
        if (
          first === 'preferredWindows' &&
          typeof second === 'number' &&
          (third === 'day' || third === 'start' || third === 'end')
        ) {
          // Per-row error (e.g. a bad HH:mm value) — map straight to the
          // matching row/field, since preferredWindows entries have the
          // same shape and names on both the raw form and the schema.
          form.setError(preferredWindowFieldPath(second, third), {
            message: issue.message,
          });
          continue;
        }
        const schemaField = String(first);
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
      const created = await apiFetch<{ id: string; status: string }>(
        '/requests',
        {
          method: 'POST',
          body: JSON.stringify(result.data satisfies CreateRequestInput),
        },
      );
      setDraft({ ...values, id: created.id, status: created.status });
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : fa.newRequestPage.genericError,
      );
    } finally {
      setPending(false);
    }
  }

  async function handlePublish() {
    if (!draft) return;
    setServerError(null);
    setPending(true);
    try {
      await apiFetch('/requests/publish', {
        method: 'POST',
        body: JSON.stringify({ id: draft.id }),
      });
      router.push('/requests');
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : fa.newRequestPage.preview.publishError,
      );
    } finally {
      setPending(false);
    }
  }

  if (draft) {
    const categoryName =
      categories.find((c) => c.id === draft.categoryId)?.name ??
      draft.categoryId;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{fa.newRequestPage.preview.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {fa.newRequestPage.preview.description}
          </p>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {fa.newRequestPage.fields.title}
              </dt>
              <dd>{draft.title}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {fa.newRequestPage.fields.category}
              </dt>
              <dd>{categoryName}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {fa.newRequestPage.fields.mode}
              </dt>
              <dd>{fa.requestMode[draft.mode]}</dd>
            </div>
          </dl>
          {serverError ? (
            <p className="text-sm text-destructive">{serverError}</p>
          ) : null}
          <div className="flex gap-2">
            <Button disabled={pending} onClick={() => void handlePublish()}>
              {pending
                ? fa.newRequestPage.preview.publishing
                : fa.newRequestPage.preview.publishButton}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setDraft(null);
              }}
            >
              {fa.newRequestPage.preview.editButton}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(handleCreate)(e)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.newRequestPage.fields.title}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.newRequestPage.fields.description}</FormLabel>
              <FormControl>
                <Textarea rows={5} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.newRequestPage.fields.category}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={fa.newRequestPage.fields.categoryPlaceholder}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.newRequestPage.fields.mode}</FormLabel>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="flex gap-4"
              >
                {(
                  [
                    [RequestMode.ONLINE, fa.requestMode.ONLINE],
                    [RequestMode.IN_PERSON, fa.requestMode.IN_PERSON],
                    [RequestMode.HYBRID, fa.requestMode.HYBRID],
                  ] as const
                ).map(([value, label]) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem value={value} id={`mode-${value}`} />
                    <Label htmlFor={`mode-${value}`}>{label}</Label>
                  </div>
                ))}
              </RadioGroup>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.newRequestPage.fields.city}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="durationMinutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.newRequestPage.fields.durationMinutes}</FormLabel>
              <FormControl>
                <Input type="number" min={15} max={1440} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="budgetMinToman"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{fa.newRequestPage.fields.budgetMinToman}</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="budgetMaxToman"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{fa.newRequestPage.fields.budgetMaxToman}</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="deadlineAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.newRequestPage.fields.deadline}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-2">
          <Label>{fa.newRequestPage.fields.preferredWindows.label}</Label>
          <p className="text-sm text-muted-foreground">
            {fa.newRequestPage.fields.preferredWindows.hint}
          </p>
          {preferredWindows.fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-2">
              <FormField
                control={form.control}
                name={preferredWindowFieldPath(index, 'day')}
                render={({ field: dayField }) => (
                  <FormItem className="flex-1">
                    <FormLabel>
                      {fa.newRequestPage.fields.preferredWindows.day}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...dayField}
                        placeholder={
                          fa.newRequestPage.fields.preferredWindows
                            .dayPlaceholder
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={preferredWindowFieldPath(index, 'start')}
                render={({ field: startField }) => (
                  <FormItem className="flex-1">
                    <FormLabel>
                      {fa.newRequestPage.fields.preferredWindows.start}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...startField}
                        placeholder={
                          fa.newRequestPage.fields.preferredWindows
                            .timePlaceholder
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={preferredWindowFieldPath(index, 'end')}
                render={({ field: endField }) => (
                  <FormItem className="flex-1">
                    <FormLabel>
                      {fa.newRequestPage.fields.preferredWindows.end}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...endField}
                        placeholder={
                          fa.newRequestPage.fields.preferredWindows
                            .timePlaceholder
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  preferredWindows.remove(index);
                }}
                aria-label={
                  fa.newRequestPage.fields.preferredWindows.removeButton
                }
              >
                {fa.newRequestPage.fields.preferredWindows.removeButton}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={preferredWindows.fields.length >= 20}
            onClick={() => {
              preferredWindows.append({ day: '', start: '', end: '' });
            }}
          >
            {fa.newRequestPage.fields.preferredWindows.addButton}
          </Button>
          {preferredWindows.fields.length >= 20 ? (
            <p className="text-sm text-muted-foreground">
              {fa.newRequestPage.fields.preferredWindows.maxReached}
            </p>
          ) : null}
        </div>
        {serverError ? (
          <p className="text-sm text-destructive">{serverError}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending
            ? fa.newRequestPage.submitting
            : fa.newRequestPage.submitButton}
        </Button>
      </form>
    </Form>
  );
}
