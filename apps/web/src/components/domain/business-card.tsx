'use client';

import { useState } from 'react';
import type { CardTemplate } from '@vaqt/shared';

import { fa } from '@/messages/fa';
import { QrCode } from './qr-code';
import './business-card.css';

const QR_INK: Record<CardTemplate, string> = {
  tile: '#0d6b60',
  night: '#0f1726',
  minimal: '#111111',
  kahi: '#3b2a14',
};

export interface BusinessCardProps {
  template: CardTemplate;
  displayName: string;
  headline: string | null;
  /** The card's public address without scheme, e.g. "vaqt.me/ali". */
  displayUrl: string | null;
  /** Absolute URL encoded into the QR code; null hides the QR. */
  qrValue: string | null;
  phone: string | null;
  city: string | null;
  /** Start on the back (used by the printable sheet). */
  initialFlipped?: boolean;
  /** false = a static face for print/preview, no flipping. */
  interactive?: boolean;
}

export function BusinessCard({
  template,
  displayName,
  headline,
  displayUrl,
  qrValue,
  phone,
  city,
  initialFlipped = false,
  interactive = true,
}: BusinessCardProps) {
  const [flipped, setFlipped] = useState(initialFlipped);
  const t = fa.cardPage;
  const initial = Array.from(displayName.trim())[0] ?? '';

  return (
    <div className="bc-stage">
      <button
        type="button"
        className={`bc bc-${template}`}
        data-flipped={flipped}
        aria-pressed={flipped}
        aria-label={`${displayName} — ${t.flipHint}`}
        disabled={!interactive}
        onClick={() => {
          setFlipped((f) => !f);
        }}
      >
        <span className="bc-inner">
          <span className="bc-face bc-front">
            <span className="bc-band" />
            <span className="bc-body">
              <span className="bc-mono">{initial}</span>
              <span>
                <span className="bc-name" style={{ display: 'block' }}>
                  {displayName}
                </span>
                {headline ? (
                  <span className="bc-title" style={{ display: 'block' }}>
                    {headline}
                  </span>
                ) : null}
              </span>
              <span className="bc-row">
                <span className="bc-url">{displayUrl ?? ''}</span>
                <span className="bc-hint">{t.flipHint}</span>
              </span>
            </span>
          </span>
          <span className="bc-face bc-back">
            <span className="bc-bback">
              <span className="bc-info">
                {phone ? (
                  <span>
                    <span className="bc-k" style={{ display: 'block' }}>
                      {t.backPhoneLabel}
                    </span>
                    <span className="bc-v" style={{ display: 'block' }}>
                      {phone}
                    </span>
                  </span>
                ) : null}
                {city ? (
                  <span>
                    <span className="bc-k" style={{ display: 'block' }}>
                      {t.backCityLabel}
                    </span>
                    <span style={{ display: 'block', fontWeight: 700 }}>
                      {city}
                    </span>
                  </span>
                ) : null}
                {displayUrl ? (
                  <span>
                    <span className="bc-k" style={{ display: 'block' }}>
                      {t.backUrlLabel}
                    </span>
                    <span className="bc-v" style={{ display: 'block' }}>
                      {displayUrl}
                    </span>
                  </span>
                ) : null}
              </span>
              {qrValue ? (
                <span className="bc-qr">
                  <QrCode
                    value={qrValue}
                    ink={QR_INK[template]}
                    label={displayUrl ?? ''}
                  />
                </span>
              ) : null}
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
