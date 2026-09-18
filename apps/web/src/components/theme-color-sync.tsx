'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

import { DARK_THEME_COLOR, LIGHT_THEME_COLOR } from '@/lib/theme-colors';

// The static `viewport.themeColor` entries in layout.tsx (two
// media-conditioned <meta name="theme-color"> tags) only ever follow OS
// `prefers-color-scheme` — they can't react to setTheme(). So when a user
// explicitly picks dark on a light-system device (or vice versa), the
// browser chrome (address bar, etc.) would keep showing the OS-preference
// color while the page itself renders the opposite theme. This component
// overwrites both tags' `content` with the actually-resolved theme's color
// whenever it changes, so the chrome always matches what's on screen —
// no media query involved once JS has run.
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    const color =
      resolvedTheme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', color);
    });
  }, [resolvedTheme]);

  return null;
}
