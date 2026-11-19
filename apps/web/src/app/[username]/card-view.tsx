'use client';

import Link from 'next/link';
import { Contact, Phone } from 'lucide-react';
import { VPN_LINK_KINDS, type LinkKind, type PublicCard } from '@vaqt/shared';
import { formatNumber } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Container } from '@vaqt/ui/components/container';

import { BusinessCard } from '@/components/domain/business-card';
import { vcardUrl } from '@/lib/card';
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
  website: { bg: '#475569', mark: 'www' },
};

function shortDisplay(kind: LinkKind, value: string): string {
  if (kind === 'website')
    return value.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (kind === 'whatsapp') return `0${value.slice(3)}`;
  return `@${value}`;
}

export function CardView({
  card,
  cardUrl,
}: {
  card: PublicCard;
  cardUrl: string;
}) {
  const t = fa.cardPage;
  const displayUrl = cardUrl.replace(/^https?:\/\//, '');

  return (
    <div className="min-h-screen py-6">
      <Container className="flex max-w-md flex-col gap-5">
        <BusinessCard
          template={card.template}
          displayName={card.displayName}
          headline={card.headline}
          displayUrl={displayUrl}
          qrValue={cardUrl}
          phone={card.phone}
          city={card.city}
        />

        <div className="flex gap-2 [&>*]:flex-1">
          <Button asChild>
            <a href={vcardUrl(card.username)} download>
              <Contact aria-hidden="true" />
              {t.saveContact}
            </a>
          </Button>
          {card.phone ? (
            <Button asChild variant="outline">
              <a href={`tel:${card.phone}`}>
                <Phone aria-hidden="true" />
                {t.call}
              </a>
            </Button>
          ) : null}
        </div>

        {card.links.length > 0 ? (
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">{t.linksTitle}</h2>
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
              {card.links.map((link) => {
                const style = KIND_STYLE[link.kind];
                return (
                  <li key={link.kind}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border bg-background p-2.5 text-foreground no-underline transition-colors hover:border-primary"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: style.bg, color: '#fff' }}
                        aria-hidden="true"
                      >
                        {style.mark}
                      </span>
                      <span className="flex min-w-0 flex-col leading-snug">
                        <span className="text-sm font-medium">
                          {fa.cardEditPage.linkLabels[link.kind]}
                        </span>
                        <span
                          dir="ltr"
                          className="truncate text-start text-xs text-muted-foreground"
                        >
                          {shortDisplay(link.kind, link.value)}
                        </span>
                      </span>
                      {VPN_LINK_KINDS.has(link.kind) ? (
                        <span className="ms-auto shrink-0 rounded bg-muted px-1.5 text-[10.5px] text-muted-foreground">
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

        {card.bio || card.skills.length > 0 || card.ratingCount > 0 ? (
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">{t.aboutTitle}</h2>
            {card.bio ? (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {card.bio}
              </p>
            ) : null}
            {card.skills.length > 0 ? (
              <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
                {card.skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full border bg-muted px-2.5 py-0.5 text-xs"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            ) : null}
            {card.ratingCount > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t.rating(
                  formatNumber(Number(card.ratingAvg.toFixed(1))),
                  formatNumber(card.ratingCount),
                )}
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/10 p-4">
          <p className="text-sm">
            <b>{t.makeYours}</b>
            <br />
            {t.makeYoursText}
          </p>
          <Button asChild size="sm">
            <Link href="/card/edit">{t.makeYoursButton}</Link>
          </Button>
        </div>
      </Container>
    </div>
  );
}
