'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, Loader2, Share2 } from 'lucide-react';

import { Button } from '@vaqt/ui/components/ui/button';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Textarea } from '@vaqt/ui/components/ui/textarea';
import { Checkbox } from '@vaqt/ui/components/ui/checkbox';
import { formatNumber, type LinkKind } from '@vaqt/shared';

import { AppShell } from '@/components/app-shell';
import { CardPreview } from '@/components/domain/card-preview';
import { CategoryPicker } from '@/components/domain/category-picker';
import { LinkEditor } from '@/components/domain/link-editor';
import { ContactLocationFields } from '@/components/domain/contact-location-fields';
import { PhotoPicker } from '@/components/domain/photo-picker';
import { TemplatePicker } from '@/components/domain/template-picker';
import { CardWizard } from '@/components/domain/card-wizard';
import { useAuth } from '@/lib/auth-context';
import { useOrigin } from '@/lib/use-origin';
import { useCardDraft, type SaveState } from '@/lib/use-card-draft';
import { cardSample } from '@/lib/card-sample';
import { fa } from '@/messages/fa';

const t = fa.editor;
type Tab = 'profile' | 'links' | 'look';

function SaveBadge({
  state,
  message,
}: {
  state: SaveState;
  message: string | null;
}) {
  if (state === 'idle') return null;
  const text =
    state === 'saving'
      ? t.autosave.saving
      : state === 'saved'
        ? t.autosave.saved
        : state === 'dirty'
          ? t.autosave.dirty
          : (message ?? t.autosave.error);
  return (
    <span
      role="status"
      className={`flex items-center gap-1.5 text-xs ${
        state === 'error' ? 'text-destructive' : 'text-muted-foreground'
      }`}
    >
      {state === 'saving' ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : state === 'saved' ? (
        <Check className="size-3.5 text-primary" aria-hidden="true" />
      ) : null}
      {text}
    </span>
  );
}

export default function CardEditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const origin = useOrigin();
  const form = useCardDraft(!!user, true);
  const { draft, patch } = form;

  const [tab, setTab] = useState<Tab>('profile');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  // decided once, right after load: a card without an address is a new card
  const [wizard, setWizard] = useState<boolean | null>(null);
  const [addr, setAddr] = useState('');
  const [addrMsg, setAddrMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [addrOpen, setAddrOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (form.loaded && wizard === null) setWizard(!draft.username);
  }, [form.loaded, wizard, draft.username]);

  useEffect(() => {
    setAddr(draft.username ?? '');
  }, [draft.username]);

  if (
    loading ||
    !user ||
    (!form.loaded && !form.loadFailed) ||
    (form.loaded && wizard === null)
  ) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }
  if (form.loadFailed) {
    return (
      <AppShell>
        <p className="text-destructive">{fa.cardEditPage.loadError}</p>
      </AppShell>
    );
  }

  // First visit: guide step by step instead of showing every field at once.
  if (wizard) {
    return (
      <AppShell>
        <CardWizard
          form={form}
          onDone={() => {
            setWizard(false);
          }}
        />
      </AppShell>
    );
  }

  const host = origin.replace(/^https?:\/\//, '');
  const cardUrl =
    draft.username && origin ? `${origin}/${draft.username}` : null;
  const linkKinds = Object.entries(draft.links)
    .filter(([, v]) => v.trim() !== '')
    .map(([k]) => k as LinkKind);
  const initial = Array.from(draft.displayName.trim())[0] ?? '';

  async function changeAddress() {
    setAddrMsg(null);
    const err = await form.saveUsername(addr.trim().toLowerCase());
    setAddrMsg({ ok: !err, text: err ?? t.addressSaved });
  }

  const tabs: [Tab, string][] = [
    ['profile', t.tabs.profile],
    ['links', t.tabs.links],
    ['look', t.tabs.look],
  ];

  const editor = (
    <div className="flex min-w-0 flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-6">
      <div role="tablist" className="flex gap-1 rounded-xl bg-muted p-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === id ? 'bg-card shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className="flex flex-col gap-4">
          <PhotoPicker
            avatarUrl={draft.avatarUrl}
            initial={initial}
            onUpload={form.uploadAvatar}
            onRemove={form.removeAvatar}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">{t.displayName}</Label>
              <Input
                id="displayName"
                value={draft.displayName}
                maxLength={50}
                onChange={(e) => {
                  patch({ displayName: e.target.value });
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">{t.city}</Label>
              <Input
                id="city"
                value={draft.city}
                maxLength={80}
                onChange={(e) => {
                  patch({ city: e.target.value });
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="headline">{t.headline}</Label>
            <Input
              id="headline"
              value={draft.headline}
              maxLength={120}
              placeholder={
                draft.category
                  ? fa.categories[draft.category].headline
                  : undefined
              }
              onChange={(e) => {
                patch({ headline: e.target.value });
              }}
            />
            <p className="text-xs text-muted-foreground">{t.headlineHelp}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">{t.bio}</Label>
            <Textarea
              id="bio"
              value={draft.bio}
              rows={5}
              maxLength={1000}
              placeholder={t.bioPlaceholder}
              onChange={(e) => {
                patch({ bio: e.target.value });
              }}
            />
            <p className="text-end text-xs text-muted-foreground">
              {t.bioCount(formatNumber(draft.bio.length))}
            </p>
          </div>
          <section className="flex flex-col gap-3 border-t pt-4">
            <h2 className="font-semibold">{t.contact.title}</h2>
            <ContactLocationFields
              contactPhone={draft.contactPhone}
              address={draft.address}
              location={draft.location}
              onChange={patch}
            />
          </section>
          <label className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
            <Checkbox
              checked={draft.showPhone}
              onCheckedChange={(v) => {
                patch({ showPhone: v === true });
              }}
            />
            <span className="flex flex-col">
              <b className="text-sm">{t.phoneTitle}</b>
              <span className="text-xs text-muted-foreground">
                {t.phoneHelp}
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {tab === 'links' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t.linksIntro}</p>
          <LinkEditor
            links={draft.links}
            errors={form.linkErrors}
            onChange={(links) => {
              patch({ links });
            }}
          />
        </div>
      ) : null}

      {tab === 'look' ? (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">{t.category}</h2>
            <p className="text-xs text-muted-foreground">{t.categoryHelp}</p>
            <CategoryPicker
              value={draft.category}
              onChange={(category) => {
                patch({ category });
              }}
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">{t.cardStyle}</h2>
            <p className="text-xs text-muted-foreground">{t.cardStyleHelp}</p>
            <TemplatePicker
              value={draft.template}
              sample={cardSample(draft, origin)}
              fields={draft.cardFields}
              onFieldsChange={(cardFields) => {
                patch({ cardFields });
              }}
              onChange={(template) => {
                patch({ template });
              }}
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">{t.address}</h2>
            {!addrOpen ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 p-3">
                <span dir="ltr" className="truncate text-sm font-medium">
                  {host}/{draft.username}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAddrOpen(true);
                  }}
                >
                  {t.addressChange}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2" dir="ltr">
                  <span className="text-sm text-muted-foreground">{host}/</span>
                  <Input
                    value={addr}
                    maxLength={30}
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => {
                      setAddr(e.target.value.toLowerCase());
                    }}
                  />
                  <Button type="button" onClick={() => void changeAddress()}>
                    {t.addressSave}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.addressHelp} {t.addressWarn}
                </p>
                {addrMsg ? (
                  <p
                    role="status"
                    className={`text-sm ${addrMsg.ok ? 'text-primary' : 'text-destructive'}`}
                  >
                    {addrMsg.text}
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );

  const preview = (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-8 lg:self-start">
      <div>
        <h2 className="text-sm font-semibold">{t.previewTitle}</h2>
        <p className="text-xs text-muted-foreground">{t.previewHint}</p>
      </div>
      <div className="mx-auto w-full max-w-xs">
        <CardPreview
          displayName={draft.displayName}
          headline={draft.headline}
          city={draft.city}
          category={draft.category}
          avatarUrl={draft.avatarUrl}
          linkKinds={linkKinds}
        />
      </div>
    </aside>
  );

  return (
    <AppShell wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-bold">{t.title}</h1>
            <SaveBadge state={form.saveState} message={form.message} />
          </div>
          <div className="flex gap-2">
            {cardUrl ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/${draft.username ?? ''}`}>
                    <ExternalLink aria-hidden="true" />
                    {t.openCard}
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/card/print">
                    <Share2 aria-hidden="true" />
                    {t.shareNow}
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex gap-1 rounded-xl bg-muted p-1 lg:hidden">
          {(
            [
              ['edit', t.editTab],
              ['preview', t.previewTab],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMobileView(id);
              }}
              aria-pressed={mobileView === id}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${
                mobileView === id
                  ? 'bg-card shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className={mobileView === 'edit' ? '' : 'hidden lg:block'}>
            {editor}
          </div>
          <div className={mobileView === 'preview' ? '' : 'hidden lg:block'}>
            {preview}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
