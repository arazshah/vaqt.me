import type { CardCategory } from '@vaqt/shared';

export type Motif =
  | 'plus'
  | 'lines'
  | 'waves'
  | 'grid'
  | 'hex'
  | 'arcs'
  | 'diamond'
  | 'bars'
  | 'dots';

export interface CardTheme {
  /** Cover gradient, start → end. Always dark enough for white text. */
  from: string;
  to: string;
  /** Highlight colour: primary action, small accents. */
  accent: string;
  /** Text colour that is readable on `accent`. */
  onAccent: string;
  motif: Motif;
}

export const DEFAULT_THEME: CardTheme = {
  from: '#0b5d57',
  to: '#168a7c',
  accent: '#f2b84b',
  onAccent: '#3a2a05',
  motif: 'dots',
};

// Each profession gets its own palette and cover pattern so a physician's
// card and a photographer's card are recognisably different at a glance.
export const CATEGORY_THEMES: Record<CardCategory, CardTheme> = {
  health: {
    from: '#0b6e6a',
    to: '#16a394',
    accent: '#ffd166',
    onAccent: '#3a2a05',
    motif: 'plus',
  },
  legal: {
    from: '#1b2a4e',
    to: '#3a4f86',
    accent: '#e0b45c',
    onAccent: '#2c2008',
    motif: 'lines',
  },
  counseling: {
    from: '#8a4b5f',
    to: '#b86a76',
    accent: '#ffe0b2',
    onAccent: '#4a2a1a',
    motif: 'waves',
  },
  education: {
    from: '#a8540a',
    to: '#c9740f',
    accent: '#fff0c2',
    onAccent: '#4a2c05',
    motif: 'grid',
  },
  tech: {
    from: '#0f172a',
    to: '#1e3a5f',
    accent: '#3de0c4',
    onAccent: '#06322b',
    motif: 'hex',
  },
  creative: {
    from: '#b4380c',
    to: '#c42a6a',
    accent: '#fde68a',
    onAccent: '#4a3205',
    motif: 'arcs',
  },
  beauty: {
    from: '#9d3a62',
    to: '#c35c86',
    accent: '#fff1d6',
    onAccent: '#4a2a1a',
    motif: 'arcs',
  },
  realestate: {
    from: '#1f4d3a',
    to: '#3a7d63',
    accent: '#f2c14e',
    onAccent: '#3a2a05',
    motif: 'diamond',
  },
  business: {
    from: '#1f2937',
    to: '#374151',
    accent: '#f59e0b',
    onAccent: '#2c1a02',
    motif: 'bars',
  },
  fitness: {
    from: '#8c1d1d',
    to: '#c2410c',
    accent: '#ffe066',
    onAccent: '#3a2a05',
    motif: 'bars',
  },
};

export function themeFor(category: CardCategory | null): CardTheme {
  return category ? CATEGORY_THEMES[category] : DEFAULT_THEME;
}

/** Tile of the cover pattern as an SVG data URL (white, very low opacity). */
export function motifUrl(motif: Motif): string {
  const o = 'fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"';
  const shapes: Record<Motif, { size: number; body: string }> = {
    plus: {
      size: 48,
      body: `<path ${o} d="M24 14v20M14 24h20"/>`,
    },
    lines: { size: 28, body: `<path ${o} d="M14 0v28"/>` },
    waves: {
      size: 56,
      body: `<path ${o} d="M0 28q14-18 28 0t28 0"/>`,
    },
    grid: { size: 36, body: `<path ${o} d="M0 0h36v36"/>` },
    hex: {
      size: 56,
      body: `<path ${o} d="M28 4l22 12v24L28 52 6 40V16z"/>`,
    },
    arcs: { size: 60, body: `<path ${o} d="M0 60a60 60 0 0 1 60-60"/>` },
    diamond: { size: 40, body: `<path ${o} d="M20 4l16 16-16 16L4 20z"/>` },
    bars: { size: 32, body: `<path ${o} d="M0 32L32 0"/>` },
    dots: {
      size: 28,
      body: '<circle cx="14" cy="14" r="2.5" fill="#fff" fill-opacity=".2"/>',
    },
  };
  const { size, body } = shapes[motif];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** CSS background for a cover: gradient with the pattern on top. */
export function coverBackground(theme: CardTheme): string {
  return `${motifUrl(theme.motif)}, linear-gradient(135deg, ${theme.from}, ${theme.to})`;
}
