'use client';

import { useState } from 'react';
import {
  Check,
  Copy,
  Mail,
  MessageCircle,
  MessageSquare,
  Send,
  Share2,
} from 'lucide-react';
import {
  QR_CHANNELS,
  qrSource,
  type MyCard,
  type QrChannel,
} from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';

import { QrCode } from '@/components/domain/qr-code';
import { coverBackground, themeFor } from '@/lib/card-themes';
import { downloadDataUrl, qrPngDataUrl } from '@/lib/qr';
import { fa } from '@/messages/fa';

const t = fa.shareHub;

/** Everything about getting the link to people, in one screen. */
export function ShareHub({
  card,
  baseUrl,
  channel,
  onChannel,
}: {
  card: MyCard;
  baseUrl: string;
  channel: QrChannel;
  onChannel: (c: QrChannel) => void;
}) {
  const [copied, setCopied] = useState(false);
  const theme = themeFor(card.category);
  const qrUrl = `${baseUrl}?src=${qrSource(channel)}`;
  const displayUrl = baseUrl.replace(/^https?:\/\//, '');
  const text = t.message(card.displayName, baseUrl);
  const enc = encodeURIComponent;
  const canNative =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copy() {
    try {
      await navigator.clipboard.writeText(baseUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // clipboard blocked; the link is on screen
    }
  }

  const channels = [
    {
      label: t.whatsapp,
      href: `https://wa.me/?text=${enc(text)}`,
      icon: MessageCircle,
      color: '#1f9d55',
    },
    {
      label: t.telegram,
      href: `https://t.me/share/url?url=${enc(baseUrl)}&text=${enc(card.displayName)}`,
      icon: Send,
      color: '#2a8bd6',
    },
    {
      label: t.eitaa,
      href: `https://eitaa.com/share/url?url=${enc(baseUrl)}&text=${enc(card.displayName)}`,
      icon: Send,
      color: '#e07b22',
    },
    {
      label: t.sms,
      href: `sms:?&body=${enc(text)}`,
      icon: MessageSquare,
      color: '#475569',
    },
    {
      label: t.email,
      href: `mailto:?subject=${enc(fa.publicCard.shareText(card.displayName))}&body=${enc(text)}`,
      icon: Mail,
      color: '#b4380c',
    },
  ];

  return (
    <div className="no-print grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* QR card */}
      <section
        className="flex flex-col items-center gap-4 rounded-3xl p-6 text-center text-white"
        style={{ background: coverBackground(theme) }}
      >
        <div>
          <b className="text-xl">{card.displayName}</b>
          {card.headline ? (
            <p className="m-0 text-sm opacity-85">{card.headline}</p>
          ) : null}
        </div>
        <div className="rounded-3xl bg-white p-4 leading-none shadow-xl [&_canvas]:size-52">
          <QrCode value={qrUrl} ink={theme.from} label={displayUrl} />
        </div>
        <p className="m-0 text-sm opacity-90">{t.scan}</p>
        <span
          dir="ltr"
          className="rounded-full px-4 py-1.5 text-sm font-bold"
          style={{ backgroundColor: theme.accent, color: theme.onAccent }}
        >
          {displayUrl}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            downloadDataUrl(
              qrPngDataUrl(qrUrl, theme.from),
              `qr-${card.username ?? 'card'}-${channel}.png`,
            );
          }}
        >
          {t.downloadQr}
        </Button>
      </section>

      <div className="flex flex-col gap-4">
        {/* Link */}
        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
          <h2 className="font-semibold">{t.yourLink}</h2>
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-2 ps-4">
            <span
              dir="ltr"
              className="min-w-0 flex-1 truncate text-start text-sm font-medium"
            >
              {displayUrl}
            </span>
            <Button type="button" size="sm" onClick={() => void copy()}>
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copied ? t.copied : t.copy}
            </Button>
          </div>
          <b className="text-sm">{t.sendVia}</b>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-3">
            {canNative ? (
              <button
                type="button"
                onClick={() => {
                  void navigator
                    .share({ title: card.displayName, text, url: baseUrl })
                    .catch(() => undefined);
                }}
                className="flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs hover:bg-muted"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Share2 className="size-5" aria-hidden="true" />
                </span>
                {t.native}
              </button>
            ) : null}
            {channels.map(({ label, href, icon: Icon, color }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs text-foreground no-underline hover:bg-muted"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {label}
              </a>
            ))}
          </div>
        </section>

        {/* QR source */}
        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-semibold">{t.qrTitle}</h2>
          <p className="text-xs text-muted-foreground">{t.qrHelp}</p>
          <div className="flex flex-wrap gap-2">
            {QR_CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={channel === c}
                onClick={() => {
                  onChannel(c);
                }}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  channel === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:border-primary'
                }`}
              >
                {fa.cardEditPage.qrChannels[c]}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-primary/5 p-5">
          <h2 className="mb-2 text-sm font-semibold">{t.tipsTitle}</h2>
          <ul className="m-0 flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground">
            {t.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
