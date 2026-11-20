import Link from 'next/link';
import {
  Bell,
  CalendarCheck,
  Check,
  QrCode as QrIcon,
  UserPlus,
} from 'lucide-react';

import { BusinessCard } from '@/components/domain/business-card';
import { fa } from '@/messages/fa';
import { CtaLink } from './cta-link';
import { DEMO_LINKS, DEMO_PHONE, QR_DEMO_URL } from './demo-data';

const t = fa.landing.hero;

export function Hero() {
  return (
    <section className="lp-hero">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-8">
        <div className="flex flex-col items-start gap-7">
          <span className="lp-eyebrow">
            <i aria-hidden="true" />
            {t.eyebrow}
          </span>
          <h1 className="lp-h1">
            {t.titleBefore}
            <br />
            <span className="lp-mark">{t.titleEm}</span> {t.titleAfter}
          </h1>
          <p className="m-0 max-w-xl text-lg leading-9 text-muted-foreground">
            {t.subtitle}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <CtaLink label={t.ctaStart} mineLabel={t.ctaMyCard} />
            <Link href="/#professions" className="lp-btn-ghost">
              {t.ctaExample}
            </Link>
          </div>
          <ul className="lp-trust">
            {t.trust.map((x) => (
              <li key={x}>
                <Check aria-hidden="true" />
                {x}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-stage" aria-label={fa.appShell.brand}>
          <div className="lp-stage-back" aria-hidden="true">
            <BusinessCard
              template="night"
              displayName={fa.landing.showcase.demos.tech.name}
              headline={fa.landing.showcase.demos.tech.headline}
              displayUrl="vaqt.me/amir_naderi"
              qrValue={QR_DEMO_URL}
              phone={DEMO_PHONE}
              city={null}
              links={DEMO_LINKS}
              interactive={false}
            />
          </div>
          <div className="lp-stage-front">
            <BusinessCard
              template="clinic"
              displayName={fa.landing.demoName}
              headline={fa.landing.demoHeadline}
              displayUrl="vaqt.me/sara_ahmadi"
              qrValue={QR_DEMO_URL}
              phone={DEMO_PHONE}
              city={fa.landing.demoCity}
              links={DEMO_LINKS}
            />
          </div>

          <div
            className="lp-chip"
            style={{ insetInlineEnd: '-0.5rem', top: '-0.4rem' }}
          >
            <span className="lp-chip-ic" style={{ background: '#2f8f6b' }}>
              <Bell aria-hidden="true" />
            </span>
            <span>
              <b>{t.chipBooking}</b>
              <small>{t.chipBookingSub}</small>
            </span>
          </div>
          <div
            className="lp-chip"
            style={{
              insetInlineStart: '-0.8rem',
              top: '46%',
              animationDelay: '-2s',
            }}
          >
            <span className="lp-chip-ic" style={{ background: '#0e7268' }}>
              <UserPlus aria-hidden="true" />
            </span>
            <b>{t.chipSaved}</b>
          </div>
          <div
            className="lp-chip"
            style={{
              insetInlineEnd: '1.5rem',
              bottom: '1.6rem',
              animationDelay: '-4s',
            }}
          >
            <span className="lp-chip-ic" style={{ background: '#c48a14' }}>
              <QrIcon aria-hidden="true" />
            </span>
            <b>{t.chipQr}</b>
          </div>
          <p className="lp-flip-hint m-0">
            <CalendarCheck className="size-3.5" aria-hidden="true" />
            {t.flipHint}
          </p>
        </div>
      </div>
    </section>
  );
}
