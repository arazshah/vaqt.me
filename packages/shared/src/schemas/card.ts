import { z } from 'zod';
import { normalizePhone } from '../utils/normalize-phone';
import type { PublicBookingInfo } from './booking';

// ---------------------------------------------------------------------------
// Username — the public address vaqt.me/<username>
// ---------------------------------------------------------------------------

export const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,29}$/;

// Top-level web routes and words that must never be claimable, otherwise
// vaqt.me/<username> could shadow a real page or impersonate the platform.
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'login',
  'logout',
  'signup',
  'register',
  'requests',
  'request',
  'conversations',
  'users',
  'user',
  'dev',
  'api',
  'admin',
  'icon',
  'icons',
  'apple-icon',
  'manifest',
  'robots',
  'sitemap',
  'card',
  'cards',
  'b',
  'me',
  'settings',
  'help',
  'about',
  'terms',
  'privacy',
  'support',
  'contact',
  'www',
  'app',
  'vaqt',
  'vaqtme',
  'staff',
  'team',
  'root',
  'null',
  'undefined',
  'static',
  'uploads',
  'health',
  'docs',
  'pricing',
  'payment',
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_REGEX,
    'نام کاربری باید ۳ تا ۳۰ نویسه، با حرف انگلیسی شروع شود و فقط حرف انگلیسی، عدد و _ داشته باشد',
  )
  .refine(
    (v) => !RESERVED_USERNAMES.has(v),
    'این نام کاربری قابل استفاده نیست',
  );

export const setUsernameSchema = z.object({ username: usernameSchema });
export type SetUsernameInput = z.infer<typeof setUsernameSchema>;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const CARD_TEMPLATES = ['tile', 'night', 'minimal', 'kahi'] as const;
export const CardTemplateSchema = z.enum(CARD_TEMPLATES);
export type CardTemplate = z.infer<typeof CardTemplateSchema>;

// ---------------------------------------------------------------------------
// Professional category — drives the palette, cover motif and booking button
// wording of the public card (the visual registry lives in apps/web).
// ---------------------------------------------------------------------------

export const CARD_CATEGORIES = [
  'health',
  'legal',
  'counseling',
  'education',
  'tech',
  'creative',
  'beauty',
  'realestate',
  'business',
  'fitness',
] as const;
export const CardCategorySchema = z.enum(CARD_CATEGORIES);
export type CardCategory = z.infer<typeof CardCategorySchema>;

// ---------------------------------------------------------------------------
// Contact links
// ---------------------------------------------------------------------------

export const LINK_KINDS = [
  'ble',
  'eitaa',
  'rubika',
  'whatsapp',
  'telegram',
  'instagram',
  'linkedin',
  'aparat',
  'website',
] as const;
export const LinkKindSchema = z.enum(LINK_KINDS);
export type LinkKind = z.infer<typeof LinkKindSchema>;

// Kinds blocked or unreliable on Iranian networks without a VPN. Shown as a
// hint on the card, never used to hide a link.
export const VPN_LINK_KINDS: ReadonlySet<LinkKind> = new Set([
  'telegram',
  'instagram',
]);

const HANDLE_REGEX = /^[A-Za-z0-9._]{2,64}$/;
// LinkedIn public identifiers routinely contain hyphens.
const LINKEDIN_HANDLE_REGEX = /^[A-Za-z0-9._-]{2,100}$/;

const HANDLE_PREFIXES: Record<
  Exclude<LinkKind, 'whatsapp' | 'website'>,
  RegExp
> = {
  ble: /^(?:https?:\/\/)?(?:www\.)?ble\.ir\//i,
  eitaa: /^(?:https?:\/\/)?(?:www\.)?eitaa\.com\//i,
  rubika: /^(?:https?:\/\/)?(?:www\.)?rubika\.ir\//i,
  telegram: /^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\//i,
  instagram: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i,
  linkedin: /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\//i,
  aparat: /^(?:https?:\/\/)?(?:www\.)?aparat\.com\//i,
};

const HREF_BUILDERS: Record<
  Exclude<LinkKind, 'whatsapp' | 'website'>,
  (handle: string) => string
> = {
  ble: (h) => `https://ble.ir/${h}`,
  eitaa: (h) => `https://eitaa.com/${h}`,
  rubika: (h) => `https://rubika.ir/${h}`,
  telegram: (h) => `https://t.me/${h}`,
  instagram: (h) => `https://instagram.com/${h}`,
  linkedin: (h) => `https://www.linkedin.com/in/${h}`,
  aparat: (h) => `https://www.aparat.com/${h}`,
};

/**
 * Canonicalizes what a user typed for a link into the value we store:
 * a bare handle (messengers/social), a canonical +989… number (WhatsApp) or
 * an absolute http(s) URL (website). Returns null if it isn't valid.
 */
export function normalizeLinkValue(kind: LinkKind, raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  if (kind === 'whatsapp') {
    return normalizePhone(input);
  }

  if (kind === 'website') {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(input)
      ? input
      : `https://${input}`;
    try {
      const url = new URL(withScheme);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      if (!url.hostname.includes('.')) return null;
      if (url.username || url.password) return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  let handle = input.replace(HANDLE_PREFIXES[kind], '');
  handle = handle.replace(/^@/, '').replace(/[/?#].*$/, '');
  const re = kind === 'linkedin' ? LINKEDIN_HANDLE_REGEX : HANDLE_REGEX;
  return re.test(handle) ? handle : null;
}

/** The URL a visitor's phone opens for a stored link. */
export function buildLinkHref(kind: LinkKind, value: string): string {
  if (kind === 'website') return value;
  if (kind === 'whatsapp') return `https://wa.me/${value.replace(/^\+/, '')}`;
  return HREF_BUILDERS[kind](value);
}

export const contactLinkInputSchema = z
  .object({
    kind: LinkKindSchema,
    value: z.string().trim().min(1).max(300),
  })
  .transform((link, ctx) => {
    const value = normalizeLinkValue(link.kind, link.value);
    if (value === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'مقدار این لینک معتبر نیست',
        path: ['value'],
      });
      return z.NEVER;
    }
    return { kind: link.kind, value };
  });
export type ContactLinkInput = z.infer<typeof contactLinkInputSchema>;

export const updateCardSchema = z.object({
  template: CardTemplateSchema.optional(),
  category: CardCategorySchema.nullable().optional(),
  showPhone: z.boolean().optional(),
  links: z
    .array(contactLinkInputSchema)
    .max(LINK_KINDS.length)
    .refine(
      (links) => new Set(links.map((l) => l.kind)).size === links.length,
      'هر نوع لینک فقط یک بار قابل ثبت است',
    )
    .optional(),
});
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

// ---------------------------------------------------------------------------
// Shapes returned by the API
// ---------------------------------------------------------------------------

export interface CardLinkView {
  kind: LinkKind;
  value: string;
  href: string;
}

export interface PublicCard {
  username: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  avatarUrl: string | null;
  template: CardTemplate;
  category: CardCategory | null;
  // Local 09xxxxxxxxx form, present ONLY when the owner turned showPhone on.
  phone: string | null;
  links: CardLinkView[];
  booking: PublicBookingInfo;
}

export interface MyCard {
  username: string | null;
  displayName: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  template: CardTemplate;
  category: CardCategory | null;
  avatarUrl: string | null;
  showPhone: boolean;
  links: CardLinkView[];
}
