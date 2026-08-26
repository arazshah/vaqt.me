import type { MetadataRoute } from 'next';
import { WEB_ORIGIN } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Every one of these requires a login session a crawler never has —
      // JwtAuthGuard is global and none of these routes are @Public() (see
      // CLAUDE.md bond 27 for /users/:id, and the Phase 6/8 notes for
      // /requests/:id and /conversations/*) — so a bot only ever gets
      // redirected to /login or hits an authenticated 401/403 there. /pricing
      // and /requests (the public list) stay crawlable; the request detail
      // page's own metadata comes from the public list endpoint instead of
      // this authenticated route (see lib/seo/request-summary.ts).
      disallow: [
        '/requests/new',
        '/requests/new/ai',
        '/conversations',
        '/conversations/*',
        '/users/*',
        '/payment/result',
        '/dev/ui',
      ],
    },
    sitemap: `${WEB_ORIGIN}/sitemap.xml`,
  };
}
