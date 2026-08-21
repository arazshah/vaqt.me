export type LinearRgb = { r: number; g: number; b: number };

const OKLCH_PATTERN =
  /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/[^)]*)?\)/;

/**
 * Parses a CSS `oklch(L C H)` string (alpha, if present, is ignored — it
 * does not affect the luminance of the color itself) into linear-light
 * sRGB, using the matrices from the CSS Color 4 spec / Björn Ottosson's
 * OKLab reference. Values are not clamped to [0, 1]; every color actually
 * used in this design system's tokens is in-gamut.
 */
export function oklchStringToLinearRgb(oklch: string): LinearRgb {
  const match = OKLCH_PATTERN.exec(oklch);
  if (!match) {
    throw new Error(`Not a valid oklch() string: ${oklch}`);
  }
  const l = Number(match[1]);
  const c = Number(match[2]);
  const hDeg = Number(match[3]);

  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lCubed = l_ ** 3;
  const mCubed = m_ ** 3;
  const sCubed = s_ ** 3;

  return {
    r: 4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed,
    g: -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed,
    b: -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed,
  };
}

/**
 * WCAG relative luminance, computed directly from linear-light RGB
 * (no sRGB gamma decode needed — oklchStringToLinearRgb already returns
 * linear values).
 */
export function relativeLuminance({ r, g, b }: LinearRgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two colors, in the range [1, 21]. */
export function contrastRatio(a: LinearRgb, b: LinearRgb): number {
  const lA = relativeLuminance(a);
  const lB = relativeLuminance(b);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}
