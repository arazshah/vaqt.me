// Single cursor-pagination envelope for every list endpoint from Phase 3
// onward — one shape, one cursor encoding, shared by API and web. Uses
// TextEncoder/TextDecoder + btoa/atob (not Buffer) so this works unchanged
// in a browser bundle, not just under Node.
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

function toBase64Url(binary: string): string {
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding =
    padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return atob(padded + padding);
}

export function encodeCursor(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return toBase64Url(binary);
}

// T is only used in the return position on purpose — this is a call-site
// convenience cast (`decodeCursor<Cursor>(str)`), the same pattern as
// JSON.parse's own typing; there's no way to validate the shape generically
// here without a per-call schema, which would defeat the point.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function decodeCursor<T>(cursor: string): T | null {
  try {
    const binary = fromBase64Url(cursor);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
