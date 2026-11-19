'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  Check,
  Clock,
  Contact,
  Globe,
  MapPin,
  Phone,
  Share2,
} from 'lucide-react';
import {
  formatNumber,
  VPN_LINK_KINDS,
  type AvailabilityDay,
  type LinkKind,
  type PublicCard,
} from '@vaqt/shared';

import { BusinessCard } from '@/components/domain/business-card';
import { LocationMap } from '@/components/domain/location-map';
import { WalletActions } from '@/components/domain/wallet-actions';
import { apiFetch } from '@/lib/api-client';
import { trackCardEvent, vcardUrl } from '@/lib/card';
import { formatDayTime } from '@/lib/date-format';
import { coverBackground, themeFor } from '@/lib/card-themes';
import { fa } from '@/messages/fa';

const KIND_STYLE: Record<LinkKind, { bg: string; mark: string }> = {
  ble: { bg: '#2f8f6b', mark: 'ب' },
  eitaa: { bg: '#e07b22', mark: 'ا' },
  rubika: { bg: '#7b3fe4', mark: 'ر' },
  whatsapp: { bg: '#1f9d55', mark: 'W' },
  telegram: { bg: '#2a8bd6', mark: 'T' },
  instagram: { bg: '#c13584', mark: 'I' },
  linkedin: { bg: '#0a66c2', mark: 'in' },
  aparat: { bg: '#df0f50', mark: 'آ' },
  website: { bg: '#475569', mark: '' },
};

export function CardView({
  card,
  cardUrl,
  source,
}: {
  card: PublicCard;
  cardUrl: string;
  /** Normalised ?src= the visitor arrived with (e.g. qr-office). */
  source: string;
}) {
  const t = fa.cardPage;
  const p = fa.publicCard;
  const viewed = useRef(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [nextSlot, setNextSlot] = useState<string | null>(null);
  const firstServiceId = card.booking.services.at(0)?.id;
  const bookingOn = card.booking.enabled;

  useEffect(() => {
    if (!bookingOn || !firstServiceId) return;
    apiFetch<AvailabilityDay[]>(
      `/booking/${card.username}/availability?serviceId=${encodeURIComponent(firstServiceId)}`,
      undefined,
      { redirectOnAuthFailure: false },
    )
      .then((days) => {
        setNextSlot(days.find((d) => d.slots.length > 0)?.slots[0] ?? null);
      })
      .catch(() => undefined);
  }, [bookingOn, firstServiceId, card.username]);
  const theme = themeFor(card.category);
  const bookLabel = card.category
    ? fa.categories[card.category].book
    : fa.categories.fallbackBook;

  useEffect(() => {
    // Strict Mode runs effects twice in dev; count the visit once.
    if (viewed.current) return;
    viewed.current = true;
    trackCardEvent(card.username, { type: 'view', source });
  }, [card.username, source]);

  const displayUrl = cardUrl.replace(/^https?:\/\//, '');
  const initial = Array.from(card.displayName.trim())[0] ?? '';
  const longBio = (card.bio?.length ?? 0) > 220;

  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: card.displayName,
          text: p.shareText(card.displayName),
          url: cardUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // user dismissed the share sheet
    }
  }

  const bookButton = card.booking.enabled ? (
    <Link
      href={`/${card.username}/book`}
      onClick={() => {
        trackCardEvent(card.username, { type: 'book_click', source });
      }}
      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold no-underline shadow-md"
      style={{ backgroundColor: theme.accent, color: theme.onAccent }}
    >
      <CalendarClock className="size-5" aria-hidden="true" />
      {bookLabel}
    </Link>
  ) : null;

  const secondary =
    'flex h-12 min-w-12 items-center justify-center gap-2 rounded-2xl border bg-card px-3 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted';

  const actions = (
    <>
      {bookButton}
      <a
        href={vcardUrl(card.username)}
        download
        onClick={() => {
          trackCardEvent(card.username, { type: 'save_contact', source });
        }}
        className={`${secondary} ${bookButton ? '' : 'flex-1'}`}
        aria-label={t.saveContact}
      >
        <Contact className="size-5" aria-hidden="true" />
        {bookButton ? null : t.saveContact}
      </a>
      {card.phone ? (
        <a href={`tel:${card.phone}`} className={secondary} aria-label={t.call}>
          <Phone className="size-5" aria-hidden="true" />
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => void share()}
        className={secondary}
        aria-label={p.share}
      >
        {copied ? (
          <Check className="size-5 text-primary" aria-hidden="true" />
        ) : (
          <Share2 className="size-5" aria-hidden="true" />
        )}
      </button>
    </>
  );

  return (
    <div className="min-h-dvh bg-muted/40 pb-28 lg:pb-10">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-6 lg:px-6 lg:py-8">
        {/* Profile column */}
        <header className="lg:sticky lg:top-8 lg:self-start">
          <div className="overflow-hidden bg-card shadow-sm lg:rounded-3xl lg:border">
            <div
              className="h-32 sm:h-36"
              style={{ background: coverBackground(theme) }}
              aria-hidden="true"
            />
            <div className="-mt-12 flex flex-col items-center gap-1 px-5 pb-6 text-center">
              {card.avatarUrl ? (
                <img
                  src={card.avatarUrl}
                  alt=""
                  className="size-24 rounded-full border-4 border-card object-cover shadow-md"
                />
              ) : (
                <span
                  className="flex size-24 items-center justify-center rounded-full border-4 border-card text-4xl font-bold text-white shadow-md"
                  style={{ background: coverBackground(theme), color: '#fff' }}
                  aria-hidden="true"
                >
                  {initial}
                </span>
              )}
              <h1 className="mt-2 text-2xl font-extrabold leading-tight">
                {card.displayName}
              </h1>
              {card.headline ? (
                <p className="text-sm text-muted-foreground">{card.headline}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs">
                {card.category ? (
                  <span
                    className="rounded-full px-2.5 py-1 font-medium"
                    style={{
                      backgroundColor: theme.accent,
                      color: theme.onAccent,
                    }}
                  >
                    {fa.categories[card.category].label}
                  </span>
                ) : null}
                {card.city ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {card.city}
                  </span>
                ) : null}
              </div>
              {nextSlot ? (
                <p className="mt-2 flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {p.nextSlot}: {formatDayTime(nextSlot)}
                </p>
              ) : null}
              <div className="mt-4 hidden w-full gap-2 lg:flex">{actions}</div>
            </div>
          </div>
        </header>

        {/* Content column */}
        <main className="flex min-w-0 flex-col gap-4 px-4 lg:px-0">
          {card.bio ? (
            <section className="rounded-3xl border bg-card p-5">
              <h2 className="mb-2 text-sm font-bold">{p.aboutTitle}</h2>
              <p
                className={`whitespace-pre-line text-sm leading-7 text-muted-foreground ${
                  longBio && !expanded ? 'line-clamp-4' : ''
                }`}
              >
                {card.bio}
              </p>
              {longBio ? (
                <button
                  type="button"
                  onClick={() => {
                    setExpanded((e) => !e);
                  }}
                  className="mt-2 text-sm font-medium text-primary"
                >
                  {expanded ? p.readLess : p.readMore}
                </button>
              ) : null}
            </section>
          ) : null}

          {card.booking.enabled && card.booking.services.length > 0 ? (
            <section className="rounded-3xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-bold">{p.servicesTitle}</h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {card.booking.services.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3"
                  >
                    <span className="flex flex-col">
                      <b className="text-sm">{s.name}</b>
                      <span className="text-xs text-muted-foreground">
                        {fa.booking.modeLabels[s.mode]}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {fa.booking.minutes(formatNumber(s.durationMinutes))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {card.address || card.location || card.phone ? (
            <section className="rounded-3xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-bold">{p.locationTitle}</h2>
              {card.phone ? (
                <a
                  href={`tel:${card.phone}`}
                  dir="ltr"
                  className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground no-underline"
                >
                  <Phone className="size-4 text-primary" aria-hidden="true" />
                  {card.phone}
                </a>
              ) : null}
              {card.address ? (
                <p className="mb-3 flex items-start gap-2 text-sm leading-7 text-muted-foreground">
                  <MapPin
                    className="mt-1.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="whitespace-pre-line">{card.address}</span>
                </p>
              ) : null}
              {card.location ? (
                <>
                  <LocationMap value={card.location} className="h-56" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`geo:${String(card.location.lat)},${String(card.location.lng)}?q=${String(card.location.lat)},${String(card.location.lng)}`}
                      className="rounded-full border px-4 py-2 text-xs font-medium text-foreground no-underline hover:bg-muted"
                    >
                      {p.openInMaps}
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${String(card.location.lat)},${String(card.location.lng)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border px-4 py-2 text-xs font-medium text-foreground no-underline hover:bg-muted"
                    >
                      {p.directions}
                    </a>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {card.links.length > 0 ? (
            <section className="rounded-3xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-bold">{p.linksTitle}</h2>
              <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4">
                {card.links.map((link) => {
                  const style = KIND_STYLE[link.kind];
                  return (
                    <li key={link.kind}>
                      <a
                        href={link.href}
                        onClick={() => {
                          trackCardEvent(card.username, {
                            type: 'link_click',
                            linkKind: link.kind,
                            source,
                          });
                        }}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative flex flex-col items-center gap-1.5 rounded-2xl p-2 text-foreground no-underline transition-colors hover:bg-muted"
                      >
                        <span
                          className="flex size-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
                          style={{ backgroundColor: style.bg, color: '#fff' }}
                          aria-hidden="true"
                        >
                          {link.kind === 'website' ? (
                            <Globe className="size-6" />
                          ) : (
                            style.mark
                          )}
                        </span>
                        <span className="text-xs font-medium">
                          {fa.cardEditPage.linkLabels[link.kind]}
                        </span>
                        {VPN_LINK_KINDS.has(link.kind) ? (
                          <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                            {t.vpnHint}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-bold">{p.cardTitle}</h2>
            <div className="mx-auto max-w-sm">
              <BusinessCard
                template={card.template}
                displayName={card.displayName}
                headline={card.headline}
                displayUrl={displayUrl}
                qrValue={cardUrl}
                phone={card.phone}
                city={card.city}
                address={card.address}
                avatarUrl={card.avatarUrl}
                links={card.links}
                fields={card.cardFields}
              />
            </div>
          </section>

          <WalletActions username={card.username} />

          <Link
            href="/card/edit"
            className="mx-auto mt-2 text-xs text-muted-foreground no-underline hover:text-foreground"
          >
            {t.makeYours} {t.makeYoursButton} ←
          </Link>
        </main>
      </div>

      {/* Phone: actions stay reachable while scrolling */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {actions}
      </div>
    </div>
  );
}
