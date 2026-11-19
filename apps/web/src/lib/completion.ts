import type { MyCard } from '@vaqt/shared';

export type CompletionStep =
  'username' | 'headline' | 'bio' | 'link' | 'booking';

export interface Completion {
  percent: number;
  missing: CompletionStep[];
}

/** How complete a card is, and which steps are still open (in order). */
export function cardCompletion(
  card: Pick<MyCard, 'username' | 'headline' | 'bio' | 'links'>,
  bookingEnabled: boolean,
): Completion {
  const done: Record<CompletionStep, boolean> = {
    username: !!card.username,
    headline: !!card.headline?.trim(),
    bio: !!card.bio?.trim(),
    link: card.links.length > 0,
    booking: bookingEnabled,
  };
  const order = Object.keys(done) as CompletionStep[];
  const missing = order.filter((s) => !done[s]);
  return {
    percent: Math.round(((order.length - missing.length) / order.length) * 100),
    missing,
  };
}
