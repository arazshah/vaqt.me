// Single source for this web app's own public origin — used wherever an
// absolute URL is required (metadataBase, sitemap, robots) or where a
// server-side fetch needs to set an Origin header by hand (see
// lib/seo/request-summary.ts for why: origin-check.middleware.ts on the API
// treats every POST as mutating and only a real browser sets Origin
// automatically).
export const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
