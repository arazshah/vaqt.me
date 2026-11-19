import { CalendarClock, Globe, MapPin } from 'lucide-react';
import type { CardCategory, LinkKind } from '@vaqt/shared';

import { coverBackground, themeFor } from '@/lib/card-themes';
import { LINK_META } from '@/lib/link-meta';
import { fa } from '@/messages/fa';

/** A miniature of the public card page, used for the live preview. */
export function CardPreview({
  displayName,
  headline,
  city,
  category,
  avatarUrl,
  linkKinds,
}: {
  displayName: string;
  headline: string;
  city: string;
  category: CardCategory | null;
  avatarUrl: string | null;
  linkKinds: LinkKind[];
}) {
  const theme = themeFor(category);
  const initial = Array.from(displayName.trim())[0] ?? '؟';
  const book = category
    ? fa.categories[category].book
    : fa.categories.fallbackBook;

  return (
    <div className="overflow-hidden rounded-[2rem] border bg-card shadow-lg">
      <div
        className="h-20"
        style={{ background: coverBackground(theme) }}
        aria-hidden="true"
      />
      <div className="-mt-9 flex flex-col items-center gap-0.5 px-4 pb-5 text-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-[4.5rem] rounded-full border-4 border-card object-cover"
          />
        ) : (
          <span
            className="flex size-[4.5rem] items-center justify-center rounded-full border-4 border-card text-2xl font-bold text-white"
            style={{ background: coverBackground(theme), color: '#fff' }}
            aria-hidden="true"
          >
            {initial}
          </span>
        )}
        <b className="mt-1.5 text-lg leading-tight">
          {displayName || fa.editor.displayName}
        </b>
        <span className="min-h-5 text-xs text-muted-foreground">
          {headline}
        </span>
        {city ? (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3" aria-hidden="true" />
            {city}
          </span>
        ) : null}
        <span
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold"
          style={{ backgroundColor: theme.accent, color: theme.onAccent }}
        >
          <CalendarClock className="size-4" aria-hidden="true" />
          {book}
        </span>
        {linkKinds.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {linkKinds.map((kind) => (
              <span
                key={kind}
                className="flex size-9 items-center justify-center rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: LINK_META[kind].bg, color: '#fff' }}
                aria-hidden="true"
              >
                {kind === 'website' ? (
                  <Globe className="size-4" />
                ) : (
                  LINK_META[kind].mark
                )}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
