'use client';

import { useCallback, useEffect, useState } from 'react';
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
): Promise<CursorPage<RequestCardData>> {
  return apiFetch<CursorPage<RequestCardData>>(
    '/requests/list',
    { method: 'POST', body: JSON.stringify({ cursor }) },
    { redirectOnAuthFailure: false },
  );
}

export default function RequestsPage() {
  const [items, setItems] = useState<RequestCardData[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await fetchPage(null);
      setItems(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Load-more failures stay silent on the list itself (the page
      // already has content) — the button just stays put for a retry.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">{fa.requestsPage.title}</h1>

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
            <EmptyTitle>{fa.requestsPage.emptyTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.requestsPage.emptyDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Link key={item.id} href={`/requests/${item.id}`}>
                <RequestCard data={item} />
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
