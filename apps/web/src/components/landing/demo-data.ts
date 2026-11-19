import type { CardCategory } from '@vaqt/shared';

import type { BusinessCardLink } from '@/components/domain/business-card';

/** Latin-only demo identity per category (Persian names live in fa.ts). */
export const DEMO_USERNAME: Record<CardCategory, string> = {
  health: 'sara_ahmadi',
  legal: 'mehdi_kiani',
  counseling: 'negar_mousavi',
  education: 'parastoo_r',
  tech: 'amir_naderi',
  creative: 'melika_s',
  beauty: 'elham_karimi',
  realestate: 'kamran_h',
  business: 'shahram_f',
  fitness: 'yeganeh_a',
};

export const DEMO_PHONE = '0912 345 6789';

export const DEMO_LINKS: BusinessCardLink[] = [
  { kind: 'ble', value: 'vaqt_me' },
  { kind: 'whatsapp', value: '9123456789' },
  { kind: 'instagram', value: 'vaqt.me' },
  { kind: 'website', value: 'vaqt.me' },
];

export const QR_DEMO_URL = 'https://vaqt.me';

/** Brand colours/marks of the messengers in the marquee (same order as fa). */
export const MESSENGER_STYLE: readonly { bg: string; mark: string }[] = [
  { bg: '#2f8f6b', mark: 'ب' },
  { bg: '#e07b22', mark: 'ا' },
  { bg: '#7b3fe4', mark: 'ر' },
  { bg: '#1f9d55', mark: 'W' },
  { bg: '#2a8bd6', mark: 'T' },
  { bg: '#d6336c', mark: 'I' },
  { bg: '#0a66c2', mark: 'in' },
  { bg: '#e23a54', mark: 'آ' },
];
