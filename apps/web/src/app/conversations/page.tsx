'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ConversationStatus } from '@vaqt/shared';

import { Badge } from '@vaqt/ui/components/ui/badge';
import { Card, CardContent, CardHeader } from '@vaqt/ui/components/ui/card';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface ConversationSummary {
  id: string;
  requestId: string;
  requestTitle: string;
  status: ConversationStatus;
  counterpartDisplayName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function ConversationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiFetch<ConversationSummary[]>(
        '/conversations/mine',
        { method: 'POST' },
      );
      setItems(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (!authLoading && user) {
      void load();
    }
  }, [authLoading, user, router, load]);

  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">
        {fa.conversationsPage.title}
      </h1>

      {error ? (
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.conversationsPage.errorTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.conversationsPage.errorDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : items.length === 0 ? (
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.conversationsPage.emptyTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.conversationsPage.emptyDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Link key={item.id} href={`/conversations/${item.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {item.counterpartDisplayName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.requestTitle}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary">
                        {fa.conversationStatus[item.status]}
                      </Badge>
                      {item.lastMessageAt ? (
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(item.lastMessageAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.lastMessagePreview ??
                      fa.conversationsPage.noMessagesYet}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
