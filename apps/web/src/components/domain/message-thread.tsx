'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CursorPage } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Textarea } from '@vaqt/ui/components/ui/textarea';
import { cn } from '@vaqt/ui/lib/utils';

import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string | null;
  isMine: boolean;
  type: 'TEXT' | 'SYSTEM';
  body: string;
  readAt: string | null;
  createdAt: string;
}

const PAGE_SIZE = 30;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('fa-IR', { timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function MessageThread({
  conversationId,
  archived,
}: {
  conversationId: string;
  archived: boolean;
}) {
  // Messages are stored oldest-to-newest for display, even though the API
  // returns pages newest-first (see conversations.service.ts) — "load
  // older" fetches the next page with the last-known cursor and prepends
  // it, reversed, to the front of this array.
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnce = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const page = await apiFetch<CursorPage<MessageItem>>(
        '/conversations/messages/list',
        {
          method: 'POST',
          body: JSON.stringify({ conversationId, limit: PAGE_SIZE }),
        },
      );
      setMessages([...page.items].reverse());
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } finally {
      setLoadingInitial(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!loadingInitial && !hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [loadingInitial]);

  async function handleLoadOlder() {
    setLoadingOlder(true);
    try {
      const page = await apiFetch<CursorPage<MessageItem>>(
        '/conversations/messages/list',
        {
          method: 'POST',
          body: JSON.stringify({
            conversationId,
            cursor: nextCursor,
            limit: PAGE_SIZE,
          }),
        },
      );
      setMessages((prev) => [...[...page.items].reverse(), ...prev]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setSendError(null);
    setSending(true);
    try {
      const message = await apiFetch<MessageItem>('/conversations/messages', {
        method: 'POST',
        body: JSON.stringify({ conversationId, body }),
      });
      setMessages((prev) => [...prev, message]);
      setDraft('');
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }),
      );
    } catch (error) {
      setSendError(
        error instanceof ApiError
          ? error.message
          : fa.conversationDetailPage.sendError,
      );
    } finally {
      setSending(false);
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="ms-auto h-12 w-1/2" />
        <Skeleton className="h-12 w-3/5" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hasMore ? (
        <Button
          variant="outline"
          size="sm"
          disabled={loadingOlder}
          onClick={() => void handleLoadOlder()}
          className="self-center"
        >
          {loadingOlder
            ? fa.conversationDetailPage.loadingOlder
            : fa.conversationDetailPage.loadOlder}
        </Button>
      ) : null}

      <div className="flex flex-col gap-2">
        {messages.map((message) =>
          message.type === 'SYSTEM' ? (
            <p
              key={message.id}
              className="text-center text-xs text-muted-foreground"
            >
              {message.body}
            </p>
          ) : (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.isMine ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                  message.isMine
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p className={cn('mt-1 text-end text-[10px] opacity-70')}>
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {archived ? (
        <p className="text-center text-sm text-muted-foreground">
          {fa.conversationDetailPage.archivedNotice}
        </p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {sendError ? (
            <p className="text-sm text-destructive">{sendError}</p>
          ) : null}
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            placeholder={fa.conversationDetailPage.messagePlaceholder}
            rows={2}
            disabled={sending}
          />
          <Button
            className="self-end"
            disabled={sending || draft.trim().length === 0}
            onClick={() => void handleSend()}
          >
            {sending
              ? fa.conversationDetailPage.sending
              : fa.conversationDetailPage.sendButton}
          </Button>
        </div>
      )}
    </div>
  );
}
