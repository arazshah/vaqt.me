'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CursorPage } from '@vaqt/shared';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';
import { Button } from '@vaqt/ui/components/ui/button';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import {
  RequestCard,
  type RequestCardData,
} from '@/components/domain/request-card';
import {
  RequestsFilterBar,
  EMPTY_FILTERS,
  type RequestsFilters,
} from '@/components/domain/requests-filter-bar';
import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

// Client-rendered, not server-rendered. This endpoint is public (no auth
// needed to view it), but it's still a POST route, and the API's
// origin-check middleware (a CSRF defense-in-depth complement to
// SameSite=Lax cookies) rejects any mutating-method request whose Origin
// header doesn't match WEB_ORIGIN. A Next.js Server Component's fetch runs
// in Node, which never sets an Origin header at all — so the original
// server-rendered version of this page always got 403'd and silently fell
// back to the generic error state. See CLAUDE.md bond on this bug for the
// reproduction. A real browser fetch (this component) sets Origin
// automatically and passes. Cursor pagination also needs client-side
// interaction ("load more") that a Server Component can't provide anyway.
async function fetchPage(
  cursor: string | null,
  filters: RequestsFilters,
): Promise<CursorPage<RequestCardData>> {
  return apiFetch<CursorPage<RequestCardData>>(
    '/requests/list',
    {
      method: 'POST',
      body: JSON.stringify({
        cursor,
        categoryId: filters.categoryId ?? undefined,
        mode: filters.mode ?? undefined,
        city: filters.city ?? undefined,
        search: filters.search ?? undefined,
      }),
    },
    { redirectOnAuthFailure: false },
  );
}

export default function RequestsPage() {
  const [filters, setFilters] = useState<RequestsFilters>(EMPTY_FILTERS);
  const [items, setItems] = useState<RequestCardData[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // Incremented on every new first-page load (filter change or initial
  // mount). A response only commits state if it's still the most recent
  // request in flight when it resolves — otherwise a slower response for
  // filters the user has since changed or cleared would land after, and
  // overwrite, a faster response for the current filters.
  const requestGeneration = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(false);
    try {
      const page = await fetchPage(null, filters);
      if (generation !== requestGeneration.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      if (generation !== requestGeneration.current) return;
      setError(true);
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    // Same staleness guard: if the filters change while a "load more" is
    // in flight, loadFirstPage() above already bumped the generation, so
    // this response is discarded instead of appending old-filter items
    // after the new first page has already loaded.
    const generation = requestGeneration.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor, filters);
      if (generation !== requestGeneration.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Load-more failures stay silent on the list itself (the page
      // already has content) — the button just stays put for a retry.
    } finally {
      if (generation === requestGeneration.current) setLoadingMore(false);
    }
  }

  const hasActiveFilters =
    filters.categoryId !== null ||
    filters.mode !== null ||
    filters.city !== null ||
    filters.search !== null;

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{fa.requestsPage.title}</h1>
        <RequestsFilterBar value={filters} onChange={setFilters} />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : error ? (
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.requestsPage.errorTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.requestsPage.errorDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : items.length === 0 ? (
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>
              {hasActiveFilters
                ? fa.requestsPage.noResultsTitle
                : fa.requestsPage.emptyTitle}
            </EmptyTitle>
            <EmptyDescription>
              {hasActiveFilters
                ? fa.requestsPage.noResultsDescription
                : fa.requestsPage.emptyDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/requests/${item.id}`}
                className="group block no-underline transition-transform hover:-translate-y-0.5"
              >
                <RequestCard data={item} className="group-hover:shadow-md" />
              </Link>
            ))}
          </div>
          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => void handleLoadMore()}
              >
                {loadingMore
                  ? fa.requestsPage.loadingMore
                  : fa.requestsPage.loadMore}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
