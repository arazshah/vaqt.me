'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  QR_CHANNELS,
  qrSource,
  type CardTemplate,
  type MyCard,
  type QrChannel,
} from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { BusinessCard } from '@/components/domain/business-card';
import { QrCode } from '@/components/domain/qr-code';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { downloadDataUrl, drawQr } from '@/lib/qr';
import { useOrigin } from '@/lib/use-origin';
import { fa } from '@/messages/fa';
import './print.css';

const t = fa.printPage;
type Format = 'poster' | 'card' | 'story';

const STORY_PALETTE: Record<
  CardTemplate,
  { from: string; to: string; text: string; accent: string; ink: string }
> = {
  tile: {
    from: '#0d6b60',
    to: '#13887a',
    text: '#f7f5ef',
    accent: '#f2c14e',
    ink: '#0d6b60',
  },
  night: {
    from: '#0f1726',
    to: '#22304a',
    text: '#e9dcc0',
    accent: '#c9a45a',
    ink: '#0f1726',
  },
  minimal: {
    from: '#ffffff',
    to: '#f1f1f1',
    text: '#111111',
    accent: '#e2462f',
    ink: '#111111',
  },
  kahi: {
    from: '#d9c7a3',
    to: '#cbb488',
    text: '#3b2a14',
    accent: '#3b2a14',
    ink: '#3b2a14',
  },
};
const QR_INK: Record<CardTemplate, string> = {
  tile: '#0d6b60',
  night: '#0f1726',
  minimal: '#111111',
  kahi: '#3b2a14',
};

/** Shrinks a font until `text` fits `maxWidth`. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: number,
  start: number,
  maxWidth: number,
): number {
  let size = start;
  while (size > 28) {
    ctx.font = `${String(weight)} ${String(size)}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  return size;
}

async function renderStory(
  card: MyCard,
  url: string,
  displayUrl: string,
): Promise<string> {
  await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily;
  const pal = STORY_PALETTE[card.template];
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, pal.from);
  grad.addColorStop(1, pal.to);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = pal.text;
  fitFont(ctx, card.displayName, family, 800, 120, 900);
  ctx.fillText(card.displayName, W / 2, 380);
  if (card.headline) {
    fitFont(ctx, card.headline, family, 500, 54, 900);
    ctx.globalAlpha = 0.85;
    ctx.fillText(card.headline, W / 2, 470);
    ctx.globalAlpha = 1;
  }

  // QR on a white rounded card
  const qrCanvas = document.createElement('canvas');
  drawQr(qrCanvas, url, QR_INK[card.template], 14, 3);
  const box = 700;
  const bx = (W - box) / 2;
  const by = 620;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(bx - 30, by - 30, box + 60, box + 60, 48);
  ctx.fill();
  ctx.drawImage(qrCanvas, bx, by, box, box);

  ctx.fillStyle = pal.text;
  fitFont(ctx, t.storyCta, family, 700, 60, 900);
  ctx.fillText(t.storyCta, W / 2, by + box + 150);

  ctx.fillStyle = pal.accent;
  ctx.direction = 'ltr';
  ctx.font = `800 64px ${family}`;
  ctx.fillText(displayUrl, W / 2, by + box + 260);

  ctx.fillStyle = pal.text;
  ctx.globalAlpha = 0.6;
  ctx.direction = 'rtl';
  ctx.font = `500 40px ${family}`;
  ctx.fillText(fa.appShell.brand, W / 2, H - 120);
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/png');
}

export default function CardPrintPage() {
  const { user, loading } = useAuth();
  const origin = useOrigin();
  const router = useRouter();
  const [card, setCard] = useState<MyCard | null>(null);
  const [format, setFormat] = useState<Format>('poster');
  const [channel, setChannel] = useState<QrChannel>('office');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<MyCard>('/cards/me', { method: 'POST', body: '{}' })
      .then(setCard)
      .catch(() => {
        setError(t.storyError);
      });
  }, [user]);

  if (!card) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full max-w-2xl" />
      </AppShell>
    );
  }
  if (!card.username) {
    return (
      <AppShell>
        <div className="flex flex-col items-start gap-3">
          <p>{t.needUsername}</p>
          <Button asChild>
            <Link href="/card/edit">{t.goEdit}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const base = `${origin}/${card.username}`;
  const url = `${base}?src=${qrSource(channel)}`;
  const displayUrl = base.replace(/^https?:\/\//, '');
  const ink = QR_INK[card.template];

  async function downloadStory() {
    if (!card) return;
    setError(null);
    try {
      downloadDataUrl(
        await renderStory(card, url, displayUrl),
        `story-${card.username ?? 'card'}.png`,
      );
    } catch {
      setError(t.storyError);
    }
  }

  return (
    <AppShell>
      {/* @page can only be set once per document, so the active format decides it. */}
      <style>
        {format === 'card'
          ? '@page { size: 85mm 55mm; margin: 0 }'
          : '@page { size: A4; margin: 12mm }'}
      </style>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div className="no-print">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          {(['poster', 'card', 'story'] as const).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={format === f ? 'default' : 'outline'}
              aria-pressed={format === f}
              onClick={() => {
                setFormat(f);
              }}
            >
              {f === 'poster'
                ? t.formatPoster
                : f === 'card'
                  ? t.formatCard
                  : t.formatStory}
            </Button>
          ))}
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.channel}:</span>
          {QR_CHANNELS.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={channel === c ? 'default' : 'outline'}
              aria-pressed={channel === c}
              onClick={() => {
                setChannel(c);
              }}
            >
              {fa.cardEditPage.qrChannels[c]}
            </Button>
          ))}
        </div>

        {format === 'poster' ? (
          <section className="print-poster flex flex-col items-center gap-6 rounded-2xl border bg-white p-10 text-center text-black">
            <h2 className="m-0 text-4xl font-extrabold">{card.displayName}</h2>
            {card.headline ? (
              <p className="m-0 text-xl">{card.headline}</p>
            ) : null}
            <div className="print-poster-qr rounded-xl border p-3 leading-none [&_canvas]:size-72">
              <QrCode value={url} ink={ink} label={displayUrl} />
            </div>
            <p className="m-0 text-2xl font-bold">{t.posterTitle}</p>
            <p className="m-0 text-base">{t.posterNote}</p>
            <p dir="ltr" className="m-0 text-2xl font-extrabold">
              {displayUrl}
            </p>
          </section>
        ) : null}

        {format === 'card' ? (
          <>
            <p className="no-print text-sm text-muted-foreground">
              {t.cardHelp}
            </p>
            <div className="print-cards flex flex-col gap-4">
              {[false, true].map((flipped) => (
                <div key={String(flipped)} className="print-card">
                  <BusinessCard
                    template={card.template}
                    displayName={card.displayName}
                    headline={card.headline}
                    displayUrl={displayUrl}
                    qrValue={url}
                    phone={null}
                    city={card.city}
                    initialFlipped={flipped}
                    interactive={false}
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}

        {format === 'story' ? (
          <p className="no-print text-sm text-muted-foreground">
            {t.storyHelp}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="no-print text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="no-print">
          {format === 'story' ? (
            <Button type="button" onClick={() => void downloadStory()}>
              {t.downloadStory}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                window.print();
              }}
            >
              {t.print}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
