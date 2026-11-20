import { fa } from '@/messages/fa';
import { MESSENGER_STYLE } from './demo-data';

export function Marquee() {
  const names = fa.landing.messengers;
  const row = names.map((n, i) => (
    <span key={n} className="lp-pill">
      <span
        className="lp-pill-dot"
        style={{ background: MESSENGER_STYLE[i]?.bg }}
        aria-hidden="true"
      >
        {MESSENGER_STYLE[i]?.mark}
      </span>
      {n}
    </span>
  ));
  return (
    <section
      className="border-y bg-muted/30 py-7"
      aria-label={fa.landing.messengersLabel}
    >
      <p className="m-0 mb-4 text-center text-sm text-muted-foreground">
        {fa.landing.messengersLabel}
      </p>
      <div className="lp-marquee">
        <div className="lp-marquee-track">
          {row}
          <span aria-hidden="true" className="contents">
            {row}
          </span>
          <span aria-hidden="true" className="contents">
            {row}
          </span>
          <span aria-hidden="true" className="contents">
            {row}
          </span>
        </div>
      </div>
    </section>
  );
}
