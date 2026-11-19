import type { MetadataRoute } from 'next';
import { WEB_ORIGIN } from '@/lib/site';

// Cards are deliberately not listed: a specialist shares their own link, we
// don't publish a directory of everyone.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: WEB_ORIGIN, changeFrequency: 'weekly', priority: 1 }];
}
