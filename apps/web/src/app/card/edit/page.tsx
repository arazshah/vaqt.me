'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CARD_TEMPLATES,
  QR_CHANNELS,
  qrSource,
  type QrChannel,
  LINK_KINDS,
  normalizeLinkValue,
  type CardTemplate,
  type LinkKind,
  type MyCard,
} from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Checkbox } from '@vaqt/ui/components/ui/checkbox';
import { Input } from '@vaqt/ui/components/ui/input';
import { Label } from '@vaqt/ui/components/ui/label';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Textarea } from '@vaqt/ui/components/ui/textarea';

import { AppShell } from '@/components/app-shell';
import { BusinessCard } from '@/components/domain/business-card';
import { QrCode } from '@/components/domain/qr-code';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { downloadDataUrl, qrPngDataUrl } from '@/lib/qr';
import { useOrigin } from '@/lib/use-origin';
import { fa } from '@/messages/fa';

type LinkDrafts = Partial<Record<LinkKind, string>>;
type Status = { kind: 'ok' | 'error'; text: string } | null;

const t = fa.cardEditPage;

function post<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export default function CardEditPage() {
  const { user, loading } = useAuth();
  const origin = useOrigin();
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [template, setTemplate] = useState<CardTemplate>('tile');
  const [showPhone, setShowPhone] = useState(false);
  const [links, setLinks] = useState<LinkDrafts>({});
  const [channel, setChannel] = useState<QrChannel>('card');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [usernameStatus, setUsernameStatus] = useState<Status>(null);

  const applyCard = useCallback((card: MyCard) => {
    setUsername(card.username);
    setUsernameDraft(card.username ?? '');
    setDisplayName(card.displayName);
    setHeadline(card.headline ?? '');
    setBio(card.bio ?? '');
    setCity(card.city ?? '');
    setTemplate(card.template);
    setShowPhone(card.showPhone);
    setLinks(Object.fromEntries(card.links.map((l) => [l.kind, l.value])));
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<MyCard>('/cards/me', { method: 'POST', body: '{}' })
      .then((card) => {
        applyCard(card);
        setLoaded(true);
      })
      .catch(() => {
        setLoadFailed(true);
      });
  }, [user, applyCard]);

  if (loading || !user || (!loaded && !loadFailed)) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full max-w-3xl" />
      </AppShell>
    );
  }
  if (loadFailed) {
    return (
      <AppShell>
        <p className="text-destructive">{t.loadError}</p>
      </AppShell>
    );
  }

  const cardUrl = username && origin ? `${origin}/${username}` : null;
  const displayUrl = cardUrl ? cardUrl.replace(/^https?:\/\//, '') : null;

  async function saveUsername() {
    setUsernameStatus(null);
    try {
      const card = await post<MyCard>('/cards/me/username', {
        username: usernameDraft,
      });
      applyCard(card);
      setUsernameStatus({ kind: 'ok', text: t.usernameSaved });
    } catch (err) {
      setUsernameStatus({
        kind: 'error',
        text: err instanceof ApiError ? err.message : t.saveError,
      });
    }
  }

  async function save() {
    setStatus(null);
    const linkList: { kind: LinkKind; value: string }[] = [];
    for (const kind of LINK_KINDS) {
      const raw = (links[kind] ?? '').trim();
      if (!raw) continue;
      if (normalizeLinkValue(kind, raw) === null) {
        setStatus({ kind: 'error', text: t.invalidLink(t.linkLabels[kind]) });
        return;
      }
      linkList.push({ kind, value: raw });
    }
    setSaving(true);
    try {
      await post('/users/me/update', {
        displayName,
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        city: city.trim() || null,
      });
      const card = await post<MyCard>('/cards/me/update', {
        template,
        showPhone,
        links: linkList,
      });
      applyCard(card);
      setStatus({ kind: 'ok', text: t.saved });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: err instanceof ApiError ? err.message : t.saveError,
      });
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!cardUrl) return;
    try {
      await navigator.clipboard.writeText(cardUrl);
      setStatus({ kind: 'ok', text: t.copied });
    } catch {
      setStatus({ kind: 'error', text: cardUrl });
    }
  }

  return (
    <AppShell>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>

          <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{t.usernameTitle}</h2>
            <div className="flex items-center gap-2" dir="ltr">
              <span className="text-muted-foreground">vaqt.me/</span>
              <Input
                id="username"
                value={usernameDraft}
                onChange={(e) => {
                  setUsernameDraft(e.target.value.toLowerCase());
                }}
                maxLength={30}
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="username-help"
              />
              <Button type="button" onClick={() => void saveUsername()}>
                {t.usernameSave}
              </Button>
            </div>
            <p id="username-help" className="text-xs text-muted-foreground">
              {t.usernameHelp}
              {username ? ` ${t.usernameChangeWarning}` : ''}
            </p>
            {usernameStatus ? (
              <p
                role="status"
                className={
                  usernameStatus.kind === 'ok'
                    ? 'text-sm text-primary'
                    : 'text-sm text-destructive'
                }
              >
                {usernameStatus.text}
              </p>
            ) : null}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{t.profileTitle}</h2>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">{t.displayName}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                }}
                maxLength={50}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="headline">{t.headline}</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => {
                  setHeadline(e.target.value);
                }}
                placeholder={t.headlinePlaceholder}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">{t.city}</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                }}
                maxLength={80}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bio">{t.bio}</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                }}
                maxLength={1000}
                rows={4}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{t.templateTitle}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CARD_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  aria-pressed={template === tpl}
                  onClick={() => {
                    setTemplate(tpl);
                  }}
                  className={`rounded-lg border p-2 text-sm transition-colors ${
                    template === tpl
                      ? 'border-primary bg-primary/10'
                      : 'hover:border-primary'
                  }`}
                >
                  {t.templates[tpl]}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{t.phoneTitle}</h2>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showPhone"
                checked={showPhone}
                onCheckedChange={(v) => {
                  setShowPhone(v === true);
                }}
              />
              <Label htmlFor="showPhone">{t.showPhone}</Label>
            </div>
            <p className="text-xs text-muted-foreground">{t.phoneHelp}</p>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div>
              <h2 className="font-semibold">{t.linksTitle}</h2>
              <p className="text-xs text-muted-foreground">{t.linksHelp}</p>
            </div>
            {LINK_KINDS.map((kind) => (
              <div key={kind} className="flex flex-col gap-1.5">
                <Label htmlFor={`link-${kind}`}>{t.linkLabels[kind]}</Label>
                <Input
                  id={`link-${kind}`}
                  dir="ltr"
                  value={links[kind] ?? ''}
                  onChange={(e) => {
                    setLinks((prev) => ({ ...prev, [kind]: e.target.value }));
                  }}
                  maxLength={300}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            ))}
          </section>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="lg"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? t.saving : t.save}
            </Button>
            {status ? (
              <p
                role="status"
                className={
                  status.kind === 'ok'
                    ? 'text-sm text-primary'
                    : 'text-sm text-destructive'
                }
              >
                {status.text}
              </p>
            ) : null}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <BusinessCard
            template={template}
            displayName={displayName || ' '}
            headline={headline || null}
            displayUrl={displayUrl}
            qrValue={cardUrl}
            phone={null}
            city={city || null}
          />
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{t.shareTitle}</h2>
            {cardUrl ? (
              <>
                <div className="flex flex-col gap-1">
                  <b className="text-sm">{t.qrChannelTitle}</b>
                  <p className="text-xs text-muted-foreground">
                    {t.qrChannelHelp}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {QR_CHANNELS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={channel === c}
                        onClick={() => {
                          setChannel(c);
                        }}
                        className={`rounded-full border px-3 py-0.5 text-xs transition-colors ${
                          channel === c
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'hover:border-primary'
                        }`}
                      >
                        {t.qrChannels[c]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg border bg-white p-2 leading-none [&_canvas]:size-28">
                    <QrCode
                      value={`${cardUrl}?src=${qrSource(channel)}`}
                      label={displayUrl ?? ''}
                    />
                  </div>
                  <p dir="ltr" className="break-all text-start font-medium">
                    {displayUrl}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyLink()}
                  >
                    {t.copyLink}
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/${username ?? ''}`}>{t.openCard}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/card/booking">{t.bookingSettingsLink}</Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      downloadDataUrl(
                        qrPngDataUrl(`${cardUrl}?src=${qrSource(channel)}`),
                        `qr-${username ?? 'card'}-${channel}.png`,
                      );
                    }}
                  >
                    {t.downloadQr}
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/card/print">{t.printLink}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/card/stats">{t.statsLink}</Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t.needUsername}</p>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
