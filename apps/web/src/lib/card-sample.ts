import type { BusinessCardProps } from '@/components/domain/business-card';
import { draftLinks, type CardDraft } from '@/lib/use-card-draft';

/** The owner's draft as business-card props, for the live preview. */
export function cardSample(
  d: CardDraft,
  origin: string,
): Omit<
  BusinessCardProps,
  'template' | 'initialFlipped' | 'interactive' | 'fields'
> {
  const host = origin.replace(/^https?:\/\//, '');
  return {
    displayName: d.displayName,
    headline: d.headline.trim() || null,
    displayUrl: d.username ? `${host}/${d.username}` : null,
    qrValue: d.username ? `${origin}/${d.username}` : null,
    phone: d.contactPhone.trim() || null,
    city: d.city.trim() || null,
    address: d.address.trim() || null,
    avatarUrl: d.avatarUrl,
    links: draftLinks(d),
  };
}
