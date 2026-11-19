'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';

import { QrCode } from '@/components/domain/qr-code';
import { qrPngDataUrl } from '@/lib/qr';
import { fa } from '@/messages/fa';

const p = fa.publicCard;

/**
 * Full-screen QR of the card, for showing the phone to someone across the
 * table. Rendered inside `.cv`, so it inherits the category theme.
 */
export function QrDialog({
  displayName,
  username,
  cardUrl,
  onClose,
}: {
  displayName: string;
  username: string;
  cardUrl: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const displayUrl = cardUrl.replace(/^https?:\/\//, '');

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="cv-dialog"
      aria-label={p.qrTitle}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="w-[22rem] max-w-full overflow-hidden rounded-[2rem] bg-card text-card-foreground shadow-2xl">
        <div className="cv-hero flex flex-col items-center gap-1 px-6 pb-8 pt-5 text-center">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="cv-glass ms-auto flex size-9 items-center justify-center rounded-full"
            aria-label={p.close}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <b className="text-lg font-black">{displayName}</b>
          <span className="text-sm text-white/80">{p.qrTitle}</span>
        </div>
        <div className="relative z-10 -mt-6 flex flex-col items-center gap-4 px-6 pb-6">
          <div className="rounded-3xl bg-white p-4 shadow-lg [&_canvas]:block [&_canvas]:size-52">
            <QrCode value={cardUrl} label={p.qrTitle} />
          </div>
          <p className="m-0 text-center text-xs leading-6 text-muted-foreground">
            {p.qrHint}
          </p>
          <p
            dir="ltr"
            className="m-0 rounded-full bg-muted px-4 py-1.5 text-sm font-bold"
          >
            {displayUrl}
          </p>
          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(cardUrl).then(() => {
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                  }, 1800);
                });
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border text-sm font-bold"
            >
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? p.linkCopied : p.copyLink}
            </button>
            <button
              type="button"
              onClick={() => {
                const a = document.createElement('a');
                a.href = qrPngDataUrl(cardUrl);
                a.download = `vaqt-${username}-qr.png`;
                a.click();
              }}
              className="cv-cta flex h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold"
            >
              <Download className="size-4" aria-hidden="true" />
              {p.qrDownload}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
