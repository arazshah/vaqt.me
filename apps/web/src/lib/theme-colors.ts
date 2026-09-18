// Exact --background token values (packages/ui/src/styles/globals.css),
// computed via oklchStringToLinearRgb (the same math color-contrast.ts
// uses) — not eyeballed. Shared between the static viewport export
// (layout.tsx, the no-JS/pre-hydration fallback) and ThemeColorSync (the
// client-side override once the user's explicit theme choice is known).
export const LIGHT_THEME_COLOR = '#fefdfb';
export const DARK_THEME_COLOR = '#0b0d14';
