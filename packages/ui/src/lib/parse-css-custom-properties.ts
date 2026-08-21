/**
 * Extracts `--name: value;` custom property declarations from a single
 * top-level CSS selector block (e.g. `:root { ... }` or `.dark { ... }`).
 * Only supports the flat, single-level blocks this design system's
 * globals.css actually uses — not a general CSS parser.
 */
export function parseCssCustomProperties(
  css: string,
  selector: string,
): Record<string, string> {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockPattern = new RegExp(`${escapedSelector}\\s*{([^}]*)}`);
  const blockMatch = blockPattern.exec(css);
  if (!blockMatch) {
    throw new Error(`Selector not found in CSS: ${selector}`);
  }

  const properties: Record<string, string> = {};
  const declarationPattern = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let declarationMatch: RegExpExecArray | null;
  while ((declarationMatch = declarationPattern.exec(blockMatch[1])) !== null) {
    properties[declarationMatch[1]] = declarationMatch[2].trim();
  }
  return properties;
}
