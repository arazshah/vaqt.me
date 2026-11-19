import {
  BarChart3,
  Bell,
  CalendarCheck,
  IdCard,
  QrCode,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import { fa } from '@/messages/fa';

const t = fa.landing.features;

export function Features() {
  const f = t.items;
  const heights = [38, 62, 48, 80, 66, 94, 72];
  return (
    <div className="lp-bento">
      {/* flip */}
      <article className="lp-cell lp-b-3 lp-reveal">
        <span className="lp-ico">
          <IdCard aria-hidden="true" />
        </span>
        <h3>{f.flip.title}</h3>
        <p>{f.flip.text}</p>
        <div className="lp-cell-art flex gap-2" aria-hidden="true">
          {['#0b6e6a', '#1b2a4e', '#8a4b5f', '#a8540a'].map((c, i) => (
            <span
              key={c}
              className="h-14 flex-1 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${c}, color-mix(in oklch, ${c} 55%, white))`,
                transform: `rotate(${String(i % 2 ? 3 : -3)}deg) translateY(${String(i % 2 ? 4 : 0)}px)`,
              }}
            />
          ))}
        </div>
      </article>

      {/* booking */}
      <article className="lp-cell lp-b-3 lp-reveal">
        <span className="lp-ico">
          <CalendarCheck aria-hidden="true" />
        </span>
        <h3>{f.booking.title}</h3>
        <p>{f.booking.text}</p>
        <div className="lp-cell-art flex flex-col gap-3" aria-hidden="true">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {f.booking.slotDay}
            </span>
            {f.booking.slots.map((s, i) => (
              <span key={s} className="lp-slot" data-on={i === 1}>
                {s}
              </span>
            ))}
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[color-mix(in_oklch,var(--brand-amber)_30%,transparent)] px-3 py-1 text-xs font-semibold">
            <i className="size-2 rounded-full bg-[var(--brand-amber)]" />
            {f.booking.pending}
          </span>
        </div>
      </article>

      {/* bale — dark hero cell */}
      <article className="lp-cell lp-cell-dark lp-b-4 lp-reveal">
        <span className="lp-ico">
          <Bell aria-hidden="true" />
        </span>
        <h3>{f.bale.title}</h3>
        <p>{f.bale.text}</p>
        <div
          className="lp-cell-art flex max-w-md flex-col gap-2"
          aria-hidden="true"
        >
          <div className="lp-toast">
            <span className="grid size-8 place-items-center rounded-full bg-white/20 font-bold">
              ب
            </span>
            <span className="flex-1">{fa.landing.hero.chipBooking}</span>
            <span className="lp-mini-btn bg-white text-[#0b4f4b]">
              {f.bale.approve}
            </span>
            <span className="lp-mini-btn bg-white/20">{f.bale.reject}</span>
          </div>
        </div>
      </article>

      {/* contact */}
      <article className="lp-cell lp-b-2 lp-reveal">
        <span className="lp-ico">
          <UserPlus aria-hidden="true" />
        </span>
        <h3>{f.contact.title}</h3>
        <p>{f.contact.text}</p>
      </article>

      {/* qr */}
      <article className="lp-cell lp-cell-amber lp-b-2 lp-reveal">
        <span className="lp-ico">
          <QrCode aria-hidden="true" />
        </span>
        <h3>{f.qr.title}</h3>
        <p>{f.qr.text}</p>
      </article>

      {/* privacy */}
      <article className="lp-cell lp-b-2 lp-reveal">
        <span className="lp-ico">
          <ShieldCheck aria-hidden="true" />
        </span>
        <h3>{f.privacy.title}</h3>
        <p>{f.privacy.text}</p>
        <div
          className="lp-cell-art flex items-center gap-3 text-sm"
          aria-hidden="true"
        >
          <span className="lp-switch" />
          <span>{f.privacy.toggle}</span>
          <b className="text-muted-foreground">{f.privacy.off}</b>
        </div>
      </article>

      {/* stats */}
      <article className="lp-cell lp-b-6 lp-reveal sm:min-h-0">
        <div className="grid items-center gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <span className="lp-ico">
              <BarChart3 aria-hidden="true" />
            </span>
            <h3>{f.stats.title}</h3>
            <p>{f.stats.text}</p>
          </div>
          <div className="lp-bars" aria-hidden="true">
            {heights.map((h, i) => (
              <i
                key={h}
                style={
                  {
                    '--h': `${String(h)}%`,
                    animationDelay: `${String(i * 80)}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
