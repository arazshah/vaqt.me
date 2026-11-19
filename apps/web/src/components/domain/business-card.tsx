'use client';

import { useState } from 'react';
import { Globe, MapPin, Phone } from 'lucide-react';
import type { CardField, CardTemplate, LinkKind } from '@vaqt/shared';

import { LINK_META } from '@/lib/link-meta';
import { fa } from '@/messages/fa';
import { QrCode } from './qr-code';
import './business-card.css';

const QR_INK: Record<CardTemplate, string> = {
  tile: '#0b5c55',
  night: '#0c1424',
  minimal: '#111111',
  kahi: '#3b2a14',
  marble: '#0f3d33',
  aurora: '#2a1458',
};

/** Rows that fit on the back of an 85×55 mm card next to the QR. */
const MAX_ROWS = 5;

export interface BusinessCardLink {
  kind: LinkKind;
  value: string;
}

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
  address?: string | null;
  avatarUrl?: string | null;
  links?: BusinessCardLink[];
  /** What the owner chose to print; undefined = everything. */
  fields?: readonly CardField[];
  /** Start on the back (used by the printable sheet). */
  initialFlipped?: boolean;
  /** false = a static face for print/preview, no flipping. */
  interactive?: boolean;
}

/** What a stored link looks like printed on paper. */
function linkText(kind: LinkKind, value: string): string {
  if (kind === 'website')
    return value.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  if (kind === 'whatsapp') return value.replace(/^\+98/, '0');
  return `@${value}`;
}

interface Row {
  key: string;
  icon: React.ReactNode;
  text: string;
  ltr: boolean;
  wide?: boolean;
}

export function BusinessCard({
  template,
  displayName,
  headline,
  displayUrl,
  qrValue,
  phone,
  city,
  address = null,
  avatarUrl = null,
  links = [],
  fields,
  initialFlipped = false,
  interactive = true,
}: BusinessCardProps) {
  const [flipped, setFlipped] = useState(initialFlipped);
  const t = fa.cardPage;
  const initial = Array.from(displayName.trim())[0] ?? '';
  const show = (f: CardField) => !fields || fields.includes(f);

  const rows: Row[] = [];
  if (phone && show('phone')) {
    rows.push({ key: 'phone', icon: <Phone />, text: phone, ltr: true });
  }
  const place = [address, city].filter(Boolean).join('، ');
  if (place && show('address')) {
    rows.push({
      key: 'address',
      icon: <MapPin />,
      text: place,
      ltr: false,
      wide: true,
    });
  }
  const website = links.find((l) => l.kind === 'website');
  if (website && show('website')) {
    rows.push({
      key: 'website',
      icon: <Globe />,
      text: linkText('website', website.value),
      ltr: true,
    });
  }
  if (show('messengers')) {
    for (const l of links) {
      if (l.kind === 'website') continue;
      rows.push({
        key: l.kind,
        icon: (
          <span
            className="bc-glyph"
            style={{ backgroundColor: LINK_META[l.kind].bg }}
          >
            {LINK_META[l.kind].mark}
          </span>
        ),
        text: linkText(l.kind, l.value),
        ltr: true,
      });
    }
  }
  const shown = rows.slice(0, MAX_ROWS);
  if (shown.length === 0 && displayUrl) {
    shown.push({ key: 'url', icon: <Globe />, text: displayUrl, ltr: true });
  }
  const photo = avatarUrl && show('avatar') ? avatarUrl : null;

  return (
    <div className="bc-stage">
      <button
        type="button"
        className={`bc bc-${template}`}
        data-flipped={flipped}
        data-dense={shown.length > 3 ? 'true' : undefined}
        aria-pressed={flipped}
        aria-label={`${displayName} — ${t.flipHint}`}
        disabled={!interactive}
        onClick={() => {
          setFlipped((f) => !f);
        }}
      >
        <span className="bc-inner">
          <span className="bc-face bc-front">
            <span className="bc-art" aria-hidden="true" />
            <span className="bc-frame" aria-hidden="true" />
            <span className="bc-id" aria-hidden="true">
              {photo ? (
                <img src={photo} alt="" />
              ) : (
                <span className="bc-mono">{initial}</span>
              )}
            </span>
            <span className="bc-names">
              <span className="bc-name">{displayName}</span>
              <span className="bc-rule" aria-hidden="true" />
              {headline ? <span className="bc-title">{headline}</span> : null}
            </span>
            <span className="bc-foot">
              <span className="bc-url">{displayUrl ?? ''}</span>
              {interactive ? (
                <span className="bc-hint">{t.flipHint}</span>
              ) : null}
            </span>
          </span>

          <span className="bc-face bc-back">
            <span className="bc-art" aria-hidden="true" />
            <span className="bc-frame" aria-hidden="true" />
            <span className="bc-bhead">
              <span className="bc-bname">{displayName}</span>
              {headline ? <span className="bc-btitle">{headline}</span> : null}
            </span>
            <span className="bc-rows">
              {shown.map((r) => (
                <span
                  key={r.key}
                  className="bc-r"
                  data-wide={r.wide ? 'true' : undefined}
                >
                  <span className="bc-ic" aria-hidden="true">
                    {r.icon}
                  </span>
                  <span className="bc-rt" dir={r.ltr ? 'ltr' : undefined}>
                    {r.text}
                  </span>
                </span>
              ))}
            </span>
            {qrValue ? (
              <span className="bc-qrbox">
                <span className="bc-qr">
                  <QrCode
                    value={qrValue}
                    ink={QR_INK[template]}
                    label={displayUrl ?? ''}
                  />
                </span>
                {displayUrl ? (
                  <span className="bc-qrcap">{displayUrl}</span>
                ) : null}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </div>
  );
}
