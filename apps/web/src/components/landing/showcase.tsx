'use client';

import { useState } from 'react';
import { CalendarClock, QrCode, UserPlus } from 'lucide-react';
import {
  CARD_CATEGORIES,
  CATEGORY_TEMPLATE,
  type CardCategory,
} from '@vaqt/shared';

import { BusinessCard } from '@/components/domain/business-card';
import { CATEGORY_THEMES } from '@/lib/card-themes';
import { fa } from '@/messages/fa';
import {
  DEMO_LINKS,
  DEMO_PHONE,
  DEMO_USERNAME,
  QR_DEMO_URL,
} from './demo-data';

const t = fa.landing.showcase;

/** Profession tabs → the card design built for that profession. */
export function Showcase() {
  const [active, setActive] = useState<CardCategory>('health');
  const theme = CATEGORY_THEMES[active];
  const demo = t.demos[active];
  const cat = fa.categories[active];

  return (
    <div className="flex flex-col gap-6">
      <div
        className="lp-tabs"
        role="tablist"
        aria-label={t.tabsLabel}
        onKeyDown={(e) => {
          const i = CARD_CATEGORIES.indexOf(active);
          // RTL: ArrowLeft moves to the next tab, ArrowRight to the previous.
          const next =
            e.key === 'ArrowLeft' ? i + 1 : e.key === 'ArrowRight' ? i - 1 : i;
          const c = next < 0 ? undefined : CARD_CATEGORIES.at(next);
          if (c && next !== i) {
            e.preventDefault();
            setActive(c);
            document.getElementById(`lp-tab-${c}`)?.focus();
          }
        }}
      >
        {CARD_CATEGORIES.map((c) => (
          <button
            key={c}
            id={`lp-tab-${c}`}
            type="button"
            role="tab"
            aria-selected={active === c}
            aria-controls="lp-showcase-panel"
            tabIndex={active === c ? 0 : -1}
            className="lp-tab"
            style={
              {
                '--tab-from': CATEGORY_THEMES[c].from,
                '--tab-to': CATEGORY_THEMES[c].to,
              } as React.CSSProperties
            }
            onClick={() => {
              setActive(c);
            }}
          >
            {fa.categories[c].label}
          </button>
        ))}
      </div>

      <div
        id="lp-showcase-panel"
        role="tabpanel"
        aria-labelledby={`lp-tab-${active}`}
        className="lp-showcase"
        style={
          {
            '--sc-from': theme.from,
            '--sc-accent': theme.accent,
            '--sc-on': theme.onAccent,
          } as React.CSSProperties
        }
      >
        <div className="lp-showcase-card">
          <BusinessCard
            key={active}
            template={CATEGORY_TEMPLATE[active]}
            displayName={demo.name}
            headline={demo.headline}
            displayUrl={`vaqt.me/${DEMO_USERNAME[active]}`}
            qrValue={QR_DEMO_URL}
            phone={DEMO_PHONE}
            city={fa.landing.demoCity}
            links={DEMO_LINKS}
          />
          <p className="m-0 mt-4 text-center text-xs text-muted-foreground">
            {fa.landing.hero.flipHint}
          </p>
        </div>

        <div className="flex flex-col items-start gap-5">
          <h3 className="m-0 text-2xl font-extrabold">{cat.label}</h3>
          <p className="m-0 leading-9 text-muted-foreground">
            {demo.name} · {demo.headline}
          </p>
          <span className="lp-bookbtn">
            <CalendarClock className="size-5" aria-hidden="true" />
            {cat.book}
          </span>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="lp-swatch" aria-hidden="true">
              <i style={{ background: theme.from }} />
              <i style={{ background: theme.to }} />
              <i style={{ background: theme.accent }} />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <QrCode className="size-4" aria-hidden="true" />
              <UserPlus className="size-4" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
