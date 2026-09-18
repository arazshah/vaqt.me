'use client';

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes';

// Thin re-export so apps/web never depends on next-themes directly — same
// pattern as DirectionProvider in index.ts. attribute="class" is required:
// globals.css's dark tokens are gated on a .dark class on an ancestor
// (`@custom-variant dark (&:is(.dark *));`), not a data attribute.
function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { ThemeProvider };
