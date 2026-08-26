import type { RequestMode } from '@vaqt/shared';
import { BASE_URL } from '@/lib/api-client';
import { WEB_ORIGIN } from '@/lib/site';
import { fa } from '@/messages/fa';

// origin-check.middleware.ts on the API treats every POST as mutating and
// rejects it without a matching Origin header (see CLAUDE.md's Phase 5/PR2
// bug writeup — the exact same trap that broke the server-rendered /requests
// list page). A browser sets Origin automatically; this runs on the server
// (generateMetadata / opengraph-image, never a browser), so it has to be set
// by hand. This is a legitimate same-system call, not a spoof: the value is
// our own configured web origin, matching WEB_ORIGIN on the API side.

export interface PublicRequestSummary {
  id: string;
  title: string;
  categoryName: string;
  city: string | null;
  mode: RequestMode;
  ownerDisplayName: string;
}

// Deliberately reuses POST /requests/list (already @Public()) with its `id`
// filter instead of the authenticated GET /requests/:id — this only ever
// needs the same safe, budget-free fields already shown on the public list,
// and must work for anonymous crawlers/link-unfurl bots that never carry a
// session cookie. Returns null for anything the public list would also
// exclude (DRAFT, non-existent) so callers fall back to generic site
// metadata rather than leaking existence of a draft.
export async function fetchPublicRequestSummary(
  id: string,
): Promise<PublicRequestSummary | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/requests/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN },
      body: JSON.stringify({ id, limit: 1 }),
      // Bots re-crawl the same links repeatedly; a short revalidate window
      // keeps metadata fresh without hitting the API on every single fetch.
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        title: string;
        categoryName: string;
        city: string | null;
        mode: RequestMode;
        ownerDisplayName: string;
      }>;
    };
    return data.items?.[0] ?? null;
  } catch {
    return null;
  }
}

export function requestSummaryDescription(
  summary: PublicRequestSummary,
): string {
  const modeLabel = fa.requestMode[summary.mode];
  const location = summary.city ? `در ${summary.city}` : '';
  return `${summary.categoryName} — ${modeLabel} ${location}؛ ثبت‌شده توسط ${summary.ownerDisplayName} در Vaqt.me.`.replace(
    /\s+/g,
    ' ',
  );
}
