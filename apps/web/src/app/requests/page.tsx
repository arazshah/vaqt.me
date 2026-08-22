import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';

import { AppShell } from '@/components/app-shell';
import {
  RequestCard,
  type RequestCardData,
} from '@/components/domain/request-card';
import { fa } from '@/messages/fa';

// Server-rendered on every request — no client fetch, no auth plumbing.
// This is the public list: everyone (including guests) sees it, and the
// budget is always masked here regardless of who's viewing (see
// RequestsService.list on the API side / CLAUDE.md bond 6).
async function fetchPublishedRequests(): Promise<RequestCardData[] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${baseUrl}/api/v1/requests/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { items: RequestCardData[] };
    return data.items;
  } catch {
    return null;
  }
}

export default async function RequestsPage() {
  const items = await fetchPublishedRequests();

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">{fa.requestsPage.title}</h1>

      {items === null ? (
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <RequestCard key={item.id} data={item} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
