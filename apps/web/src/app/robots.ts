import type { MetadataRoute } from 'next';
import { WEB_ORIGIN } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Pages behind login or tied to a private booking link.
      disallow: ['/card/', '/wallet', '/admin', '/b/'],
    },
    sitemap: `${WEB_ORIGIN}/sitemap.xml`,
  };
}
