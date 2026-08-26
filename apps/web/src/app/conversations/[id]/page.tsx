'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { ConversationStatus } from '@vaqt/shared';

import { Badge } from '@vaqt/ui/components/ui/badge';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@vaqt/ui/components/ui/empty';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { MessageThread } from '@/components/domain/message-thread';
import { ReviewPanel } from '@/components/domain/review-panel';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface ConversationDetailData {
  id: string;
  requestId: string;
  requestTitle: string;
  status: ConversationStatus;
  counterpartId: string;
  counterpartDisplayName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [detail, setDetail] = useState<ConversationDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      const data = await apiFetch<ConversationDetailData>(
        `/conversations/${params.id}`,
      );
      setDetail(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

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
        <Skeleton className="h-96 w-full max-w-2xl" />
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell>
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.conversationDetailPage.notFoundTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.conversationDetailPage.notFoundDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  if (error || !detail) {
    return (
      <AppShell>
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyTitle>{fa.conversationDetailPage.errorTitle}</EmptyTitle>
            <EmptyDescription>
              {fa.conversationDetailPage.errorDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link
          href="/conversations"
          className="text-sm text-muted-foreground hover:underline"
        >
          {fa.conversationDetailPage.backLink}
        </Link>

        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <Link
              href={`/users/${detail.counterpartId}`}
              className="text-xl font-semibold hover:underline"
            >
              {detail.counterpartDisplayName}
            </Link>
            <Link
              href={`/requests/${detail.requestId}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {detail.requestTitle}
            </Link>
          </div>
          <Badge variant="secondary">
            {fa.conversationStatus[detail.status]}
          </Badge>
        </div>

        <MessageThread
          conversationId={detail.id}
          archived={detail.status !== 'OPEN'}
        />

        <ReviewPanel conversationId={detail.id} />
      </div>
    </AppShell>
  );
}
