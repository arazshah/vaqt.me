'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { CursorPage } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import { Skeleton } from '@vaqt/ui/components/ui/skeleton';
import { Textarea } from '@vaqt/ui/components/ui/textarea';
import { cn } from '@vaqt/ui/lib/utils';

import { apiFetch, ApiError, BASE_URL } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
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

// The gateway's broadcast payload (conversations.gateway.ts) is the same
// shape minus isMine — that field is relative to whoever's asking, so it
// can't be baked in server-side for an event that reaches every
// participant including the sender. Computed locally instead.
type BroadcastMessage = Omit<MessageItem, 'isMine'>;

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
  const { user } = useAuth();
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
  const userId = user?.id;

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

  // Live delivery: connects with the browser's own cookies
  // (withCredentials, same access_token the REST calls use — see
  // conversations.gateway.ts for the server side), joins this
  // conversation's room, and merges any message:new event into state.
  // Archived conversations skip this entirely — sendMessage() rejects
  // writes there anyway, so nothing would ever arrive.
  useEffect(() => {
    if (archived) {
      return;
    }

    const socket: Socket = io(BASE_URL, { withCredentials: true });

    function join() {
      socket.emit('conversation:join', { conversationId });
    }
    socket.on('connect', join);

    function handleIncoming(payload: BroadcastMessage) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) {
          // Already in state — the sender's own handleSend() appended it
          // optimistically from the REST response before this broadcast
          // arrived.
          return prev;
        }
        return [...prev, { ...payload, isMine: payload.senderId === userId }];
      });
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }),
      );
    }
    socket.on('message:new', handleIncoming);

    return () => {
      socket.emit('conversation:leave', { conversationId });
      socket.off('connect', join);
      socket.off('message:new', handleIncoming);
      socket.disconnect();
    };
  }, [archived, conversationId, userId]);

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
      // The gateway broadcasts to the whole room, sender included, before
      // this REST response is even serialized (see sendMessage() in
      // conversations.service.ts) — on low-latency connections the
      // WebSocket event routinely beats this response back, so
      // handleIncoming() may have already appended it.
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
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
