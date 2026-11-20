import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUp, Lightbulb, ShieldCheck } from 'lucide-react';
import { formatNumber } from '@vaqt/shared';

import { CtaLink } from '@/components/landing/cta-link';
import { Faq } from '@/components/landing/rest';
import { CREATOR_PATH } from '@/components/site/site-footer';
import { SiteShell } from '@/components/site/site-shell';
import { fa } from '@/messages/fa';

const G = fa.guide;

export const metadata: Metadata = {
  title: G.metaTitle,
  description: G.metaDescription,
};

interface GuideStep {
  title: string;
  text: string;
  image?: string;
  alt?: string;
  caption?: string;
  tip?: string;
  mobile?: boolean;
}
interface GuideSection {
  id: string;
  title: string;
  intro: string;
  steps: readonly GuideStep[];
  bullets?: { title: string; items: readonly string[] };
}

const SECTIONS: readonly GuideSection[] = G.sections;

// Pixel sizes of the captured screenshots (keeps layout from jumping).
const SIZE = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 780, height: 1688 },
  square: { width: 600, height: 680 },
} as const;
function sizeOf(step: GuideStep) {
  if (step.mobile) return SIZE.mobile;
  return step.image === 'register' ? SIZE.square : SIZE.desktop;
}

function Shot({ step }: { step: GuideStep }) {
  if (!step.image) return null;
  const { width, height } = sizeOf(step);
  return (
    <figure
      className="gd-shot"
      style={
        step.mobile ? { maxWidth: '17rem', marginInline: 'auto' } : undefined
      }
    >
      <img
        src={`/guide/${step.image}.webp`}
        alt={step.alt ?? ''}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
      {step.caption ? <figcaption>{step.caption}</figcaption> : null}
    </figure>
  );
}

function Step({
  step,
  n,
  flip,
}: {
  step: GuideStep;
  n: number;
  flip: boolean;
}) {
  const text = (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 flex items-center gap-3 text-xl font-extrabold">
        <span className="gd-num">{formatNumber(n)}</span>
        {step.title}
      </h3>
      <p className="m-0 leading-9 text-muted-foreground">{step.text}</p>
      {step.tip ? (
        <p className="gd-tip m-0">
          <Lightbulb aria-hidden="true" />
          <span>
            <b>{G.tipLabel}: </b>
            {step.tip}
          </span>
        </p>
      ) : null}
    </div>
  );
  return (
    <article
      className={`gd-step lp-reveal ${step.image ? '' : 'block'}`}
      data-flip={flip}
    >
      {text}
      <Shot step={step} />
    </article>
  );
}

export default function GuidePage() {
  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <header className="mb-12 flex flex-col items-start gap-5">
          <span className="lp-eyebrow">
            <i aria-hidden="true" />
            {G.eyebrow}
          </span>
          <h1 className="lp-h1 !text-[clamp(2.1rem,6vw,4rem)]">{G.title}</h1>
          <p className="lp-lead m-0">{G.lead}</p>
          <span className="text-sm text-muted-foreground">{G.readTime}</span>
        </header>

        {/* quick start */}
        <section
          className="mb-14 rounded-[2rem] bg-primary p-6 text-primary-foreground sm:p-10"
          aria-labelledby="quick"
        >
          <h2 id="quick" className="m-0 text-2xl font-extrabold sm:text-3xl">
            {G.quick.title}
          </h2>
          <ol className="m-0 mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {G.quick.items.map(([t, d], i) => (
              <li
                key={t}
                className="flex flex-col gap-1.5 rounded-2xl bg-white/12 p-4"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-white/90 font-extrabold text-primary">
                  {formatNumber(i + 1)}
                </span>
                <b>{t}</b>
                <span className="text-sm leading-7 opacity-85">{d}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7">
            <CtaLink
              label={G.quick.cta}
              mineLabel={fa.landing.finalCta.buttonMine}
              className="lp-btn-primary lp-btn-light"
            />
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-14">
          {/* TOC */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label={G.tocTitle} className="gd-toc">
              <b className="mb-2 hidden text-sm lg:block">{G.tocTitle}</b>
              <div className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
                {[...SECTIONS.map((s) => [s.id, s.title] as const)].map(
                  ([id, title], i) => (
                    <a key={id} href={`#${id}`} className="whitespace-nowrap">
                      <span className="me-2 text-primary tabular-nums">
                        {formatNumber(i + 1)}
                      </span>
                      {title}
                    </a>
                  ),
                )}
                <a href="#privacy" className="whitespace-nowrap">
                  {G.privacy.title}
                </a>
                <a href="#help" className="whitespace-nowrap">
                  {G.faq.title}
                </a>
              </div>
            </nav>
          </aside>

          <div className="flex min-w-0 flex-col gap-16">
            {SECTIONS.map((s, si) => (
              <section key={s.id} id={s.id} className="gd-section">
                <div className="mb-6 flex flex-col gap-2">
                  <span className="lp-kicker m-0">{formatNumber(si + 1)}</span>
                  <h2 className="m-0 text-3xl font-extrabold">{s.title}</h2>
                  <p className="m-0 max-w-3xl leading-9 text-muted-foreground">
                    {s.intro}
                  </p>
                </div>
                <div className="flex flex-col gap-5">
                  {s.steps.map((st, i) => (
                    <Step
                      key={st.title}
                      step={st}
                      n={i + 1}
                      flip={i % 2 === 1}
                    />
                  ))}
                </div>
                {s.bullets ? (
                  <div className="mt-5 rounded-3xl border bg-card p-6">
                    <b>{s.bullets.title}</b>
                    <ul className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
                      {s.bullets.items.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-sm">
                          <span className="size-2 rounded-full bg-[var(--brand-amber)]" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ))}

            <section id="privacy" className="gd-section">
              <h2 className="m-0 mb-6 flex items-center gap-3 text-3xl font-extrabold">
                <ShieldCheck
                  className="size-8 text-primary"
                  aria-hidden="true"
                />
                {G.privacy.title}
              </h2>
              <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
                {G.privacy.items.map(([t, d]) => (
                  <li key={t} className="rounded-3xl border bg-card p-5">
                    <b>{t}</b>
                    <p className="m-0 mt-2 text-sm leading-8 text-muted-foreground">
                      {d}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section id="help" className="gd-section">
              <h2 className="m-0 mb-4 text-3xl font-extrabold">
                {G.faq.title}
              </h2>
              <Faq items={G.faq.items} showMore={false} />
            </section>

            <section className="lp-final">
              <h2 className="m-0 text-3xl font-black sm:text-4xl">
                {G.final.title}
              </h2>
              <p className="mx-auto mb-7 mt-3 max-w-lg text-lg leading-9 text-white/85">
                {G.final.text}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <CtaLink
                  label={G.final.button}
                  mineLabel={G.final.buttonMine}
                  className="lp-btn-primary lp-btn-light"
                />
                <Link
                  href={CREATOR_PATH}
                  className="lp-btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  {G.final.stuck}
                </Link>
              </div>
            </section>

            <a
              href="#quick"
              className="inline-flex items-center gap-2 self-start text-sm text-muted-foreground no-underline hover:text-foreground"
            >
              <ArrowUp className="size-4" aria-hidden="true" />
              {G.backToTop}
            </a>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
