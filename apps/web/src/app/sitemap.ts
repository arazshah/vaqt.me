import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/api-client';
import { WEB_ORIGIN } from '@/lib/site';

const PAGE_SIZE = 50;
// Safety cap on how many pages this walks, mirroring the batch-processing
// guard this project already uses on the API side (CLAUDE.md's
// BATCH_PROCESSING conventions) — a runaway loop here would just mean an
// incomplete sitemap, but an unbounded one risks hammering the API on every
// crawl and never returning.
const MAX_PAGES = 40;

interface PublicListItem {
  id: string;
}

interface PublicListResponse {
  items: PublicListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function fetchAllPublishedRequestIds(): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api/v1/requests/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN },
        body: JSON.stringify({ limit: PAGE_SIZE, cursor }),
        next: { revalidate: 300 },
      });
    } catch {
      break;
    }
    if (!res.ok) {
      break;
    }
    const data = (await res.json()) as PublicListResponse;
    ids.push(...data.items.map((item) => item.id));
    if (!data.hasMore || !data.nextCursor) {
      break;
    }
    cursor = data.nextCursor;
  }

  return ids;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestIds = await fetchAllPublishedRequestIds();

  return [
    { url: WEB_ORIGIN, changeFrequency: 'daily', priority: 1 },
    { url: `${WEB_ORIGIN}/requests`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${WEB_ORIGIN}/pricing`, changeFrequency: 'weekly', priority: 0.5 },
    ...requestIds.map((id): MetadataRoute.Sitemap[number] => ({
      url: `${WEB_ORIGIN}/requests/${id}`,
      changeFrequency: 'daily',
      priority: 0.7,
    })),
  ];
}
