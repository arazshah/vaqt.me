import type { Metadata } from 'next';

import { Features } from '@/components/landing/features';
import { Hero } from '@/components/landing/hero';
import { Marquee } from '@/components/landing/marquee';
import { Faq, FinalCta, Steps, Visitors } from '@/components/landing/rest';
import { Showcase } from '@/components/landing/showcase';
import { SiteShell } from '@/components/site/site-shell';
import { fa } from '@/messages/fa';

const L = fa.landing;

export const metadata: Metadata = {
  title: 'وقت من — کارت ویزیت آنلاین و رزرو وقت رایگان',
  description:
    'کارت ویزیت زنده با QR، ذخیره‌ی مخاطب و رزرو وقت با تأیید خودتان؛ رایگان، فارسی و روی سرور ایرانی. به‌جای شماره، لینکت را بده.',
};

function Heading({
  id,
  kicker,
  title,
  text,
}: {
  id?: string;
  kicker: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="lp-reveal mb-10 flex flex-col items-start" id={id}>
      <span className="lp-kicker">{kicker}</span>
      <h2 className="lp-h2">{title}</h2>
      {text ? <p className="lp-lead">{text}</p> : null}
    </div>
  );
}

const WRAP = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

export default function HomePage() {
  return (
    <SiteShell>
      <Hero />
      <Marquee />

      <section id="professions" className="lp-section scroll-mt-16">
        <div className={WRAP}>
          <Heading
            kicker={fa.site.nav.professions}
            title={L.showcase.title}
            text={L.showcase.text}
          />
          <Showcase />
        </div>
      </section>

      <section id="features" className="lp-section scroll-mt-16 bg-muted/30">
        <div className={WRAP}>
          <Heading
            kicker={fa.site.nav.features}
            title={L.features.title}
            text={L.features.subtitle}
          />
          <Features />
        </div>
      </section>

      <section id="how" className="lp-section scroll-mt-16">
        <div className={WRAP}>
          <Heading
            kicker={fa.site.nav.how}
            title={L.stepsTitle}
            text={L.stepsSubtitle}
          />
          <Steps />
        </div>
      </section>

      <section className="lp-section bg-[var(--lp-soft)]">
        <div className={WRAP}>
          <Visitors />
        </div>
      </section>

      <section id="faq" className="lp-section scroll-mt-16">
        <div className={`${WRAP} grid gap-10 lg:grid-cols-[0.8fr_1.2fr]`}>
          <div className="lp-reveal flex flex-col items-start">
            <span className="lp-kicker">{fa.site.nav.faq}</span>
            <h2 className="lp-h2">{L.faq.title}</h2>
          </div>
          <Faq />
        </div>
      </section>

      <section className="pb-20">
        <div className={WRAP}>
          <FinalCta />
        </div>
      </section>
    </SiteShell>
  );
}
