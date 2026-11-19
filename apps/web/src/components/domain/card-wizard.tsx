'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatNumber, type LinkKind } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';

import { CategoryPicker } from '@/components/domain/category-picker';
import { LinkEditor } from '@/components/domain/link-editor';
import { PhotoPicker } from '@/components/domain/photo-picker';
import { TemplatePicker } from '@/components/domain/template-picker';
import { CardPreview } from '@/components/domain/card-preview';
import { useOrigin } from '@/lib/use-origin';
import type { useCardDraft } from '@/lib/use-card-draft';
import { fa } from '@/messages/fa';

const t = fa.wizard;
const STEPS = ['address', 'about', 'photo', 'links', 'look'] as const;
type Step = (typeof STEPS)[number];

/**
 * First-run flow: one question per screen, a live card on the side, and a
 * clear "done" screen with sharing. Replaces the all-fields-at-once form.
 */
export function CardWizard({
  form,
  onDone,
}: {
  form: ReturnType<typeof useCardDraft>;
  onDone: () => void;
}) {
  const { draft, patch } = form;
  const origin = useOrigin();
  const host = origin.replace(/^https?:\/\//, '');
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [addr, setAddr] = useState(draft.username ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const step: Step = STEPS[index] ?? 'address';
  const linkKinds = Object.entries(draft.links)
    .filter(([, v]) => v.trim() !== '')
    .map(([k]) => k as LinkKind);
  const initial = Array.from(draft.displayName.trim())[0] ?? '';

  async function next() {
    setError(null);
    setBusy(true);
    try {
      if (step === 'address') {
        const err = await form.saveUsername(addr.trim().toLowerCase());
        if (err) {
          setError(err);
          return;
        }
      } else {
        if (step === 'about' && draft.displayName.trim().length < 2) {
          setError(fa.editor.invalid);
          return;
        }
        if (!(await form.save())) {
          setError(form.message ?? fa.editor.autosave.error);
          return;
        }
      }
      if (index === STEPS.length - 1) {
        setFinished(true);
      } else {
        setIndex(index + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  if (finished) {
    const url = `${origin}/${draft.username ?? ''}`;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-8 text-center">
        <div className="w-full max-w-xs">
          <CardPreview
            displayName={draft.displayName}
            headline={draft.headline}
            city={draft.city}
            category={draft.category}
            avatarUrl={draft.avatarUrl}
            linkKinds={linkKinds}
          />
        </div>
        <h1 className="text-2xl font-extrabold">{t.doneTitle}</h1>
        <p className="text-muted-foreground">{t.doneText}</p>
        <p dir="ltr" className="font-bold text-primary">
          {url.replace(/^https?:\/\//, '')}
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button asChild size="lg" onClick={onDone}>
            <Link href="/card/print">{t.doneShare}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/${draft.username ?? ''}`}>{t.doneView}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/card">{t.doneDashboard}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const titles: Record<Step, [string, string]> = {
    address: [t.addressTitle, t.addressText],
    about: [t.aboutTitle, t.aboutText],
    photo: [t.photoTitle, t.photoText],
    links: [t.linksTitle, t.linksText],
    look: [t.lookTitle, t.lookText],
  };
  const [title, text] = titles[step];
  const optional = step === 'links' || step === 'look' || step === 'photo';

  return (
    <div className="mx-auto grid max-w-4xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <ol
            className="m-0 flex list-none gap-1.5 p-0"
            aria-label={t.stepOf(
              formatNumber(index + 1),
              formatNumber(STEPS.length),
            )}
          >
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            {t.stepOf(formatNumber(index + 1), formatNumber(STEPS.length))} ·{' '}
            {t.steps[step]}
          </p>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>

        <div className="rounded-3xl border bg-card p-5">
          {step === 'address' ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2" dir="ltr">
                <span className="text-sm text-muted-foreground">{host}/</span>
                <Input
                  autoFocus
                  value={addr}
                  maxLength={30}
                  placeholder="your-name"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => {
                    setAddr(e.target.value.toLowerCase());
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {fa.editor.addressHelp}
              </p>
            </div>
          ) : null}

          {step === 'about' ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="w-name">{fa.editor.displayName}</Label>
                <Input
                  id="w-name"
                  autoFocus
                  value={draft.displayName}
                  maxLength={50}
                  onChange={(e) => {
                    patch({ displayName: e.target.value });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="w-headline">{fa.editor.headline}</Label>
                <Input
                  id="w-headline"
                  value={draft.headline}
                  maxLength={120}
                  onChange={(e) => {
                    patch({ headline: e.target.value });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="w-city">{fa.editor.city}</Label>
                <Input
                  id="w-city"
                  value={draft.city}
                  maxLength={80}
                  onChange={(e) => {
                    patch({ city: e.target.value });
                  }}
                />
              </div>
            </div>
          ) : null}

          {step === 'photo' ? (
            <div className="flex flex-col gap-5">
              <PhotoPicker
                avatarUrl={draft.avatarUrl}
                initial={initial}
                onUpload={form.uploadAvatar}
                onRemove={form.removeAvatar}
              />
              <div className="flex flex-col gap-2">
                <b className="text-sm">{fa.editor.category}</b>
                <CategoryPicker
                  value={draft.category}
                  onChange={(category) => {
                    patch({ category });
                  }}
                />
              </div>
            </div>
          ) : null}

          {step === 'links' ? (
            <LinkEditor
              links={draft.links}
              errors={form.linkErrors}
              onChange={(links) => {
                patch({ links });
              }}
            />
          ) : null}

          {step === 'look' ? (
            <TemplatePicker
              value={draft.template}
              displayName={draft.displayName}
              headline={draft.headline}
              onChange={(template) => {
                patch({ template });
              }}
            />
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={index === 0 || busy}
            onClick={() => {
              setError(null);
              setIndex(index - 1);
            }}
          >
            {t.back}
          </Button>
          <div className="flex items-center gap-2">
            {optional ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  if (index === STEPS.length - 1) setFinished(true);
                  else setIndex(index + 1);
                }}
              >
                {t.skip}
              </Button>
            ) : null}
            <Button
              type="button"
              size="lg"
              disabled={busy}
              onClick={() => void next()}
            >
              {index === STEPS.length - 1 ? t.finish : t.next}
            </Button>
          </div>
        </div>
      </div>

      <aside className="hidden lg:block lg:sticky lg:top-8">
        <CardPreview
          displayName={draft.displayName}
          headline={draft.headline}
          city={draft.city}
          category={draft.category}
          avatarUrl={draft.avatarUrl}
          linkKinds={linkKinds}
        />
      </aside>
    </div>
  );
}
