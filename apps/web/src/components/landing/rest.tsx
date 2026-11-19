import Link from 'next/link';
import { CalendarClock, Check, Plus } from 'lucide-react';

import { fa } from '@/messages/fa';
import { CtaLink } from './cta-link';

const L = fa.landing;

export function Steps() {
  return (
    <ol className="lp-steps">
      {L.steps.map(([n, title, text]) => (
        <li key={n} className="lp-step lp-reveal">
          <span className="lp-step-n">{n}</span>
          <b className="text-lg">{title}</b>
          <p className="m-0 text-sm leading-8 text-muted-foreground">{text}</p>
        </li>
      ))}
    </ol>
  );
}

export function VisitorPhone() {
  const days = [
    ['۱۳', 'ش'],
    ['۱۴', 'ی'],
    ['۱۵', 'د'],
    ['۱۶', 'س'],
  ];
  return (
    <div className="lp-phone" aria-hidden="true">
      <div className="lp-phone-screen">
        <p className="m-0 mb-3 mt-2 flex items-center gap-2 text-sm font-bold">
          <CalendarClock className="size-4 text-primary" />
          {L.visitors.mockTitle}
        </p>
        <p className="m-0 mb-2 text-xs text-muted-foreground">
          {L.visitors.mockDay}
        </p>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {days.map(([n, d], i) => (
            <span key={n} className="lp-daychip" data-on={i === 1}>
              <small>{d}</small>
              <b>{n}</b>
            </span>
          ))}
        </div>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {['۰۹:۰۰', '۱۰:۳۰', '۱۱:۰۰', '۱۴:۰۰', '۱۶:۳۰', '۱۷:۰۰'].map(
            (s, i) => (
              <span key={s} className="lp-slot text-center" data-on={i === 4}>
                {s}
              </span>
            ),
          )}
        </div>
        <span className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          {L.visitors.mockCta}
        </span>
      </div>
    </div>
  );
}

export function Visitors() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <VisitorPhone />
      <div className="flex flex-col gap-5">
        <h2 className="lp-h2">{L.visitors.title}</h2>
        <p className="lp-lead m-0">{L.visitors.text}</p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {L.visitors.points.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="grid size-7 flex-none place-items-center rounded-full bg-primary/12 text-primary">
                <Check className="size-4" aria-hidden="true" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Faq({
  items = L.faq.items,
  showMore = true,
}: {
  items?: readonly (readonly [string, string])[];
  showMore?: boolean;
}) {
  return (
    <div className="lp-faq">
      {items.map(([q, a]) => (
        <details key={q}>
          <summary>
            {q}
            <Plus aria-hidden="true" />
          </summary>
          <p>{a}</p>
        </details>
      ))}
      {showMore ? (
        <p className="mt-6 text-sm">
          <Link href="/guide" className="font-bold text-primary">
            {L.faq.moreHelp} ←
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export function FinalCta() {
  return (
    <div className="lp-final lp-reveal">
      <h2 className="m-0 text-balance text-3xl font-black leading-tight sm:text-5xl">
        {L.finalCta.title}
      </h2>
      <p className="mx-auto mb-8 mt-4 max-w-xl text-lg leading-9 text-white/85">
        {L.finalCta.text}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <CtaLink
          label={L.finalCta.button}
          mineLabel={L.finalCta.buttonMine}
          className="lp-btn-primary lp-btn-light"
        />
        <Link
          href="/guide"
          className="lp-btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20"
        >
          {L.finalCta.guide}
        </Link>
      </div>
    </div>
  );
}
