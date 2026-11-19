import { z } from 'zod';
import { LinkKindSchema, type LinkKind } from './card';

export const CARD_EVENT_TYPES = [
  'view',
  'save_contact',
  'link_click',
  'book_click',
] as const;
export const CardEventTypeSchema = z.enum(CARD_EVENT_TYPES);
export type CardEventType = z.infer<typeof CardEventTypeSchema>;

// Where a QR code is placed. The QR for a channel opens ?src=qr-<channel>, so
// the owner can see which printed/posted code actually brings visitors.
export const QR_CHANNELS = ['card', 'office', 'insta', 'event'] as const;
export const QrChannelSchema = z.enum(QR_CHANNELS);
export type QrChannel = z.infer<typeof QrChannelSchema>;

export const qrSource = (channel: QrChannel): string => `qr-${channel}`;

/** Sources we count; anything else a visitor puts in ?src= becomes "other". */
export const KNOWN_SOURCES: readonly string[] = [
  'direct',
  ...QR_CHANNELS.map(qrSource),
];

export function normalizeSource(raw: string | null | undefined): string {
  const value = (raw ?? '').trim().toLowerCase();
  return KNOWN_SOURCES.includes(value) ? value : value ? 'other' : 'direct';
}

export const recordCardEventSchema = z.object({
  type: CardEventTypeSchema,
  source: z.string().max(40).optional(),
  linkKind: LinkKindSchema.optional(),
});
export type RecordCardEventInput = z.infer<typeof recordCardEventSchema>;

export const cardStatsQuerySchema = z.object({
  days: z
    .union([z.literal(7), z.literal(30)])
    .optional()
    .default(7),
});
export type CardStatsQueryInput = z.infer<typeof cardStatsQuerySchema>;

export interface CardStatsView {
  days: number;
  views: number;
  /** Views that arrived through one of the QR codes. */
  qrScans: number;
  contactSaves: number;
  linkClicks: number;
  bookClicks: number;
  /** Booking requests actually created in the period. */
  bookingRequests: number;
  bySource: { source: string; views: number }[];
  byLink: { kind: LinkKind; clicks: number }[];
  /** One entry per Iran calendar day in the period, oldest first. */
  daily: { date: string; views: number }[];
}
