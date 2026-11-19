import type { LinkKind } from '@vaqt/shared';

export type LinkGroup = 'iran' | 'social' | 'web';

export interface LinkMeta {
  group: LinkGroup;
  /** Fixed part of the address, shown (LTR) before the input. */
  prefix: string;
  placeholder: string;
  /** Brand colour + short mark for the badge. */
  bg: string;
  mark: string;
}

// The prefix is the part the user would otherwise have to type or paste;
// normalizeLinkValue() still accepts a full pasted URL and strips it.
export const LINK_META: Record<LinkKind, LinkMeta> = {
  ble: {
    group: 'iran',
    prefix: 'ble.ir/',
    placeholder: 'username',
    bg: '#2f8f6b',
    mark: 'ب',
  },
  eitaa: {
    group: 'iran',
    prefix: 'eitaa.com/',
    placeholder: 'username',
    bg: '#e07b22',
    mark: 'ا',
  },
  rubika: {
    group: 'iran',
    prefix: 'rubika.ir/',
    placeholder: 'username',
    bg: '#7b3fe4',
    mark: 'ر',
  },
  whatsapp: {
    group: 'social',
    prefix: '+98',
    placeholder: '9123456789',
    bg: '#1f9d55',
    mark: 'W',
  },
  telegram: {
    group: 'social',
    prefix: 't.me/',
    placeholder: 'username',
    bg: '#2a8bd6',
    mark: 'T',
  },
  instagram: {
    group: 'social',
    prefix: 'instagram.com/',
    placeholder: 'username',
    bg: '#c13584',
    mark: 'I',
  },
  linkedin: {
    group: 'social',
    prefix: 'linkedin.com/in/',
    placeholder: 'your-name',
    bg: '#0a66c2',
    mark: 'in',
  },
  aparat: {
    group: 'web',
    prefix: 'aparat.com/',
    placeholder: 'username',
    bg: '#df0f50',
    mark: 'آ',
  },
  website: {
    group: 'web',
    prefix: 'https://',
    placeholder: 'example.com',
    bg: '#475569',
    mark: 'www',
  },
};

export const LINK_GROUPS: LinkGroup[] = ['iran', 'social', 'web'];
