'use client';

import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  QrCode as QrIcon,
  Share2,
  UserPlus,
  Video,
} from 'lucide-react';
import {
  formatNumber,
  VPN_LINK_KINDS,
  type AvailabilityDay,
  type CardLinkView,
  type LinkKind,
  type PublicCard,
  type ServiceMode,
} from '@vaqt/shared';

import { BusinessCard } from '@/components/domain/business-card';
import { LocationMap } from '@/components/domain/location-map';
import { WalletActions } from '@/components/domain/wallet-actions';
import { apiFetch } from '@/lib/api-client';
import { trackCardEvent, vcardUrl } from '@/lib/card';
import { motifUrl, themeFor } from '@/lib/card-themes';
import { formatDayTime } from '@/lib/date-format';
import { LINK_META, linkText } from '@/lib/link-meta';
import { fa } from '@/messages/fa';

import './card-view.css';
import { QrDialog } from './qr-dialog';

const p = fa.publicCard;
const t = fa.cardPage;

/** Staggered entrance; CSS turns it off for reduced motion. */
const rise = (i: number): CSSProperties => ({
  animationDelay: `${String(60 + i * 70)}ms`,
});

/** Glyph inside a link's brand tile. Iranian apps keep their letter mark. */
function LinkGlyph({ kind }: { kind: LinkKind }) {
  const svg = {
    viewBox: '0 0 24 24',
    className: 'size-6',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'instagram':
      return (
        <svg {...svg}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
        </svg>
      );
    case 'telegram':
      return (
        <svg {...svg}>
          <path d="M21.5 4.5 2.8 11.6c-.8.3-.8 1.4 0 1.7l4.6 1.6 1.8 5.4c.2.7 1.1.9 1.6.4l2.6-2.5 4.7 3.5c.6.4 1.4.1 1.6-.6L22.9 5.8c.2-.9-.6-1.6-1.4-1.3Z" />
          <path d="m7.4 14.9 10-7.4-6.6 8.6" />
        </svg>
      );
    case 'whatsapp':
      return <MessageCircle className="size-6" aria-hidden="true" />;
    case 'website':
      return <Globe className="size-6" aria-hidden="true" />;
    default:
      return (
        <span className="text-lg font-black leading-none">
          {LINK_META[kind].mark}
        </span>
      );
  }
}

const MODE_ICON: Record<ServiceMode, typeof Video> = {
  online: Video,
  in_person: MapPin,
  phone: Phone,
};

function Section({
  title,
  icon,
  children,
  index,
  className = '',
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  index: number;
  className?: string;
}) {
  return (
    <section
      className={`cv-panel cv-rise p-5 sm:p-6 ${className}`}
      style={rise(index)}
    >
      <h2 className="mb-4 flex items-center gap-2.5 text-base font-extrabold">
        <span
          className="cv-tint cv-ink flex size-8 items-center justify-center rounded-xl"
          aria-hidden="true"
        >
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => {
            setDone(false);
          }, 1600);
        });
      }}
      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={done ? p.copied : p.copy}
      title={done ? p.copied : p.copy}
    >
      {done ? (
        <Check className="cv-ink size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

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
  const viewed = useRef(false);
  const heroActions = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // A missing image file shows the initial instead of a broken picture.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [nextSlot, setNextSlot] = useState<string | null>(null);
  // The sticky phone bar only appears once the hero's buttons scroll away.
  const [barVisible, setBarVisible] = useState(false);

  const services = card.booking.services;
  const bookingOn = card.booking.enabled && services.length > 0;
  const firstServiceId = services.at(0)?.id;
  const theme = themeFor(card.category);
  const bookLabel = card.category
    ? fa.categories[card.category].book
    : fa.categories.fallbackBook;
  const bookHref = `/${card.username}/book`;
  const displayUrl = cardUrl.replace(/^https?:\/\//, '');
  const initial = Array.from(card.displayName.trim())[0] ?? '';
  const longBio = (card.bio?.length ?? 0) > 260;
  const geo = card.location
    ? `${String(card.location.lat)},${String(card.location.lng)}`
    : null;
  const directionsHref = geo
    ? `https://www.google.com/maps/dir/?api=1&destination=${geo}`
    : null;

  useEffect(() => {
    // Strict Mode runs effects twice in dev; count the visit once.
    if (viewed.current) return;
    viewed.current = true;
    trackCardEvent(card.username, { type: 'view', source });
  }, [card.username, source]);

  useEffect(() => {
    if (!bookingOn || !firstServiceId) return;
    apiFetch<{ days: AvailabilityDay[] }>(
      `/booking/${card.username}/availability?serviceId=${encodeURIComponent(firstServiceId)}`,
      undefined,
      { redirectOnAuthFailure: false },
    )
      .then(({ days }) => {
        setNextSlot(days.find((d) => d.slots.length > 0)?.slots[0] ?? null);
      })
      .catch(() => undefined);
  }, [bookingOn, firstServiceId, card.username]);

  useEffect(() => {
    const el = heroActions.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      setBarVisible(!entries.some((e) => e.isIntersecting));
    });
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);

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

  const trackBook = () => {
    trackCardEvent(card.username, { type: 'book_click', source });
  };
  const trackSave = () => {
    trackCardEvent(card.username, { type: 'save_contact', source });
  };
  const trackLink = (kind: LinkKind) => {
    trackCardEvent(card.username, {
      type: 'link_click',
      linkKind: kind,
      source,
    });
  };

  const themeVars = {
    '--cv-from': theme.from,
    '--cv-to': theme.to,
    '--cv-accent': theme.accent,
    '--cv-on-accent': theme.onAccent,
    '--cv-motif': motifUrl(theme.motif),
  } as CSSProperties;

  // ------------------------------------------------------------------ hero
  const quick: {
    key: string;
    label: string;
    icon: ReactNode;
    href?: string;
    onClick?: () => void;
    download?: boolean;
    external?: boolean;
  }[] = [
    ...(card.phone
      ? [
          {
            key: 'call',
            label: p.quick.call,
            icon: <Phone className="size-5" aria-hidden="true" />,
            href: `tel:${card.phone}`,
          },
        ]
      : []),
    {
      key: 'save',
      label: p.quick.save,
      icon: <UserPlus className="size-5" aria-hidden="true" />,
      href: vcardUrl(card.username),
      download: true,
      onClick: trackSave,
    },
    ...(directionsHref
      ? [
          {
            key: 'route',
            label: p.quick.route,
            icon: <Navigation className="size-5" aria-hidden="true" />,
            href: directionsHref,
            external: true,
          },
        ]
      : []),
    {
      key: 'share',
      label: copied ? p.linkCopied : p.quick.share,
      icon: copied ? (
        <Check className="size-5" aria-hidden="true" />
      ) : (
        <Share2 className="size-5" aria-hidden="true" />
      ),
      onClick: () => void share(),
    },
  ];

  const hero = (
    <section className="cv-hero">
      <span className="cv-glow cv-glow-a" aria-hidden="true" />
      <span className="cv-glow cv-glow-b" aria-hidden="true" />

      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-4 sm:px-6">
        <Link
          href="/"
          className="cv-glass flex h-9 items-center rounded-full px-3 no-underline"
        >
          <span className="text-sm font-black">{fa.appShell.brand}</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            setQrOpen(true);
          }}
          className="cv-glass flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
        >
          <QrIcon className="size-4" aria-hidden="true" />
          {p.quick.qr}
        </button>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 pb-20 pt-6 text-center sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:pb-24 lg:pt-10 lg:text-start">
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="cv-rise cv-avatar-ring relative" style={rise(0)}>
            {card.avatarUrl && !avatarFailed ? (
              <img
                src={card.avatarUrl}
                alt={card.displayName}
                className="block size-28 rounded-full border-4 border-white/90 bg-white object-cover sm:size-32"
                onError={() => {
                  setAvatarFailed(true);
                }}
              />
            ) : (
              <span
                className="flex size-28 items-center justify-center rounded-full border-4 border-white/90 text-5xl font-black sm:size-32"
                style={{
                  background: `linear-gradient(150deg, ${theme.from}, ${theme.to})`,
                  color: '#fff',
                }}
                aria-hidden="true"
              >
                {initial}
              </span>
            )}
            {bookingOn ? (
              <span
                className="absolute bottom-2 end-2 flex size-5 items-center justify-center rounded-full border-[3px] border-white bg-emerald-500"
                aria-hidden="true"
              />
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-2 lg:items-start">
            <h1
              className="cv-rise m-0 text-3xl font-black leading-tight tracking-tight sm:text-4xl"
              style={rise(1)}
            >
              {card.displayName}
            </h1>
            {card.headline ? (
              <p
                className="cv-rise m-0 max-w-md text-base leading-7 text-white/85"
                style={rise(2)}
              >
                {card.headline}
              </p>
            ) : null}
            <div
              className="cv-rise mt-1 flex flex-wrap items-center justify-center gap-2 text-xs font-medium lg:justify-start"
              style={rise(3)}
            >
              {card.category ? (
                <span className="cv-glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: theme.accent }}
                    aria-hidden="true"
                  />
                  {fa.categories[card.category].label}
                </span>
              ) : null}
              {card.city ? (
                <span className="cv-glass flex items-center gap-1 rounded-full px-3 py-1.5">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {card.city}
                </span>
              ) : null}
              {nextSlot ? (
                <span className="cv-glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
                  <span className="relative flex size-2" aria-hidden="true">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  {p.nextSlot}: {formatDayTime(nextSlot)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div
          ref={heroActions}
          className="cv-rise flex items-start justify-center gap-4 sm:gap-5"
          style={rise(4)}
        >
          {quick.map((q) => {
            const inner = (
              <>
                <span className="cv-glass flex size-14 items-center justify-center rounded-2xl transition-transform group-hover:-translate-y-0.5">
                  {q.icon}
                </span>
                <span className="text-xs font-medium text-white/90">
                  {q.label}
                </span>
              </>
            );
            const cls =
              'group flex w-16 flex-col items-center gap-1.5 text-white no-underline';
            return q.href ? (
              <a
                key={q.key}
                href={q.href}
                download={q.download}
                onClick={q.onClick}
                target={q.external ? '_blank' : undefined}
                rel={q.external ? 'noopener noreferrer' : undefined}
                className={cls}
              >
                {inner}
              </a>
            ) : (
              <button
                key={q.key}
                type="button"
                onClick={q.onClick}
                className={cls}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );

  // --------------------------------------------------------------- booking
  const booking = bookingOn ? (
    <section className="cv-panel cv-book cv-rise p-5 sm:p-6" style={rise(5)}>
      <div className="flex items-start gap-3">
        <span
          className="cv-cta flex size-12 shrink-0 items-center justify-center rounded-2xl"
          aria-hidden="true"
        >
          <CalendarClock className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="cv-ink m-0 text-xs font-bold">
            {p.bookEyebrow} ·{' '}
            <span className="text-muted-foreground">{p.bookFree}</span>
          </p>
          <h2 className="m-0 mt-0.5 text-xl font-black">{bookLabel}</h2>
          <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">
            {p.bookSubtitle}
          </p>
        </div>
      </div>

      {nextSlot ? (
        <p className="cv-tint m-0 mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm">
          <CalendarCheck
            className="cv-ink size-4 shrink-0"
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{p.nextSlot}:</span>
          <b className="font-bold">{formatDayTime(nextSlot)}</b>
        </p>
      ) : null}

      <Link
        href={bookHref}
        onClick={trackBook}
        className="cv-cta mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-extrabold no-underline"
      >
        <CalendarClock className="size-5" aria-hidden="true" />
        {bookLabel}
      </Link>

      <h3 className="mb-2 mt-6 text-sm font-bold text-muted-foreground">
        {services.length > 1 ? p.chooseService : p.servicesTitle}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {services.map((s) => {
          const ModeIcon = MODE_ICON[s.mode];
          return (
            <li key={s.id}>
              <Link
                href={`${bookHref}?service=${encodeURIComponent(s.id)}`}
                onClick={trackBook}
                className="cv-row flex items-center gap-3 rounded-2xl border bg-card p-3 text-foreground no-underline"
              >
                <span
                  className="cv-tint cv-ink flex size-11 shrink-0 items-center justify-center rounded-xl"
                  aria-hidden="true"
                >
                  <ModeIcon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="text-sm font-bold">{s.name}</b>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{fa.booking.modeLabels[s.mode]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" aria-hidden="true" />
                      {fa.booking.minutes(formatNumber(s.durationMinutes))}
                    </span>
                  </span>
                  {s.note ? (
                    <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {s.note}
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  className="cv-chevron size-5 shrink-0 text-muted-foreground rtl:-scale-x-100"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  ) : null;

  // ----------------------------------------------------------------- links
  const linkRow = (link: CardLinkView) => {
    const meta = LINK_META[link.kind];
    return (
      <li key={link.kind}>
        <a
          href={link.href}
          onClick={() => {
            trackLink(link.kind);
          }}
          target="_blank"
          rel="noopener noreferrer"
          className="cv-row flex items-center gap-3 rounded-2xl border bg-card p-3 text-foreground no-underline"
        >
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{
              background: `linear-gradient(145deg, ${meta.bg}, color-mix(in oklab, ${meta.bg} 70%, #000))`,
              color: '#fff',
            }}
            aria-hidden="true"
          >
            <LinkGlyph kind={link.kind} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <b className="text-sm font-bold">
                {fa.cardEditPage.linkLabels[link.kind]}
              </b>
              {VPN_LINK_KINDS.has(link.kind) ? (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t.vpnHint}
                </span>
              ) : null}
            </span>
            <span
              dir="ltr"
              className="truncate text-end text-xs text-muted-foreground"
            >
              {linkText(link.kind, link.value)}
            </span>
          </span>
          <ChevronRight
            className="cv-chevron size-5 shrink-0 text-muted-foreground rtl:-scale-x-100"
            aria-hidden="true"
          />
        </a>
      </li>
    );
  };

  const links =
    card.links.length > 0 ? (
      <Section
        title={p.linksTitle}
        icon={<MessageCircle className="size-4" />}
        index={6}
      >
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {card.links.map(linkRow)}
        </ul>
      </Section>
    ) : null;

  // ----------------------------------------------------------------- about
  const about = card.bio ? (
    <Section
      title={p.aboutTitle}
      icon={<span className="text-sm font-black">{initial}</span>}
      index={7}
    >
      <div className="relative">
        <p
          className={`m-0 whitespace-pre-line text-[0.95rem] leading-8 text-foreground/80 ${
            longBio && !expanded ? 'line-clamp-5' : ''
          }`}
        >
          {card.bio}
        </p>
      </div>
      {longBio ? (
        <button
          type="button"
          onClick={() => {
            setExpanded((e) => !e);
          }}
          aria-expanded={expanded}
          className="cv-ink mt-2 text-sm font-bold"
        >
          {expanded ? p.readLess : p.readMore}
        </button>
      ) : null}
    </Section>
  ) : null;

  // --------------------------------------------------------------- contact
  const contact =
    card.address || card.location || card.phone ? (
      <Section
        title={p.locationTitle}
        icon={<MapPin className="size-4" />}
        index={8}
      >
        <div className="flex flex-col gap-2">
          {card.phone ? (
            <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
              <span
                className="cv-tint cv-ink flex size-10 shrink-0 items-center justify-center rounded-xl"
                aria-hidden="true"
              >
                <Phone className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs text-muted-foreground">
                  {p.phoneLabel}
                </span>
                <a
                  href={`tel:${card.phone}`}
                  dir="ltr"
                  className="text-end text-base font-bold tracking-wide text-foreground no-underline"
                >
                  {card.phone}
                </a>
              </span>
              <CopyButton value={card.phone} />
            </div>
          ) : null}
          {card.address ? (
            <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
              <span
                className="cv-tint cv-ink flex size-10 shrink-0 items-center justify-center rounded-xl"
                aria-hidden="true"
              >
                <MapPin className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs text-muted-foreground">
                  {p.addressLabel}
                </span>
                <span className="whitespace-pre-line text-sm font-medium leading-7">
                  {card.address}
                </span>
              </span>
              <CopyButton value={card.address} />
            </div>
          ) : null}
        </div>
        {card.location && geo ? (
          <div className="mt-3 overflow-hidden rounded-2xl border">
            <LocationMap value={card.location} className="h-56 sm:h-64" />
            <div className="grid grid-cols-2 gap-px bg-border">
              <a
                href={`geo:${geo}?q=${geo}`}
                className="flex items-center justify-center gap-1.5 bg-card px-3 py-3 text-xs font-bold text-foreground no-underline hover:bg-muted"
              >
                <MapPin className="size-4" aria-hidden="true" />
                {p.openInMaps}
              </a>
              <a
                href={directionsHref ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="cv-ink flex items-center justify-center gap-1.5 bg-card px-3 py-3 text-xs font-bold no-underline hover:bg-muted"
              >
                <Navigation className="size-4" aria-hidden="true" />
                {p.directions}
              </a>
            </div>
          </div>
        ) : null}
      </Section>
    ) : null;

  // --------------------------------------------------------- business card
  const businessCard = (
    <Section title={p.cardTitle} icon={<QrIcon className="size-4" />} index={9}>
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
      <a
        href={vcardUrl(card.username)}
        download
        onClick={trackSave}
        className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl border bg-card px-4 text-sm font-bold text-foreground no-underline transition-colors hover:bg-muted"
      >
        <UserPlus className="cv-ink size-5" aria-hidden="true" />
        {p.saveContactLong}
      </a>
      <div className="mt-4">
        <WalletActions username={card.username} />
      </div>
    </Section>
  );

  // ------------------------------------------------------------ sticky bar
  const bar = (
    <div
      className="cv-bar fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur-lg lg:hidden"
      data-hidden={barVisible ? 'false' : 'true'}
      aria-hidden={!barVisible}
      inert={!barVisible}
    >
      <div className="mx-auto flex max-w-xl items-center gap-2">
        {card.avatarUrl && !avatarFailed ? (
          <img
            src={card.avatarUrl}
            alt=""
            className="size-11 shrink-0 rounded-full object-cover"
            onError={() => {
              setAvatarFailed(true);
            }}
          />
        ) : null}
        {bookingOn ? (
          <Link
            href={bookHref}
            onClick={trackBook}
            className="cv-cta flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold no-underline"
          >
            <CalendarClock className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{bookLabel}</span>
          </Link>
        ) : (
          <a
            href={vcardUrl(card.username)}
            download
            onClick={trackSave}
            className="cv-cta flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold no-underline"
          >
            <UserPlus className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t.saveContact}</span>
          </a>
        )}
        {bookingOn ? (
          <a
            href={vcardUrl(card.username)}
            download
            onClick={trackSave}
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-card text-foreground"
            aria-label={t.saveContact}
          >
            <UserPlus className="size-5" aria-hidden="true" />
          </a>
        ) : null}
        {card.phone ? (
          <a
            href={`tel:${card.phone}`}
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-card text-foreground"
            aria-label={t.call}
          >
            <Phone className="size-5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="cv min-h-dvh bg-muted/40 pb-28 lg:pb-12" style={themeVars}>
      {hero}

      <div className="relative z-10 mx-auto -mt-12 grid max-w-5xl gap-4 px-4 sm:px-6 lg:-mt-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <main className="flex min-w-0 flex-col gap-4">
          {booking}
          {links}
          {about}
          {contact}
        </main>
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {businessCard}
        </aside>
      </div>

      <footer className="mx-auto mt-10 flex max-w-5xl flex-col items-center gap-3 px-4 text-center">
        <Link
          href="/card/edit"
          className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-3xl border bg-card px-5 py-2.5 text-xs font-medium text-muted-foreground no-underline shadow-sm transition-colors hover:text-foreground"
        >
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {p.poweredBy}
            <b className="font-black text-foreground">{fa.appShell.brand}</b>
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="cv-ink whitespace-nowrap font-bold">
            {t.makeYours} {t.makeYoursButton}
          </span>
        </Link>
      </footer>

      {bar}
      {qrOpen ? (
        <QrDialog
          displayName={card.displayName}
          username={card.username}
          cardUrl={cardUrl}
          onClose={() => {
            setQrOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
