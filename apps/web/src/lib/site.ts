// Single source for this web app's own public origin — used wherever an
// absolute URL is required (metadataBase, sitemap, robots) or where a
// server-side fetch needs to set an Origin header by hand (see
// lib/seo/request-summary.ts for why: origin-check.middleware.ts on the API
// treats every POST as mutating and only a real browser sets Origin
// automatically).
export const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

/**
 * Origin for server components. An explicitly configured WEB_ORIGIN wins
 * (production); without it (local dev) the request's own host is used so the
 * QR and links never say localhost when the visitor came in another way.
 */
export async function getRequestOrigin(): Promise<string> {
  if (process.env.WEB_ORIGIN) return process.env.WEB_ORIGIN;
  const { headers } = await import('next/headers');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return WEB_ORIGIN;
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}
