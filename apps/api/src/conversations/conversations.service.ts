import { HttpStatus, Injectable } from '@nestjs/common';
import { ConversationStatus, MessageType, Prisma, prisma } from '@vaqt/db';
import { decodeCursor, encodeCursor, type CursorPage } from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { ConversationsGateway } from './conversations.gateway';

export interface ConversationSummary {
  id: string;
  requestId: string;
  requestTitle: string;
  status: string;
  counterpartDisplayName: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
}

export interface MessageSummary {
  id: string;
  conversationId: string;
  senderId: string | null;
  isMine: boolean;
  type: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

interface MessageListCursor {
  // ISO string, not a Date — Date isn't round-trippable through
  // JSON.stringify/parse (encodeCursor/decodeCursor use JSON under the hood).
  createdAt: string;
  id: string;
}

const conversationWithParticipants = {
  select: {
    id: true,
    requestId: true,
    status: true,
    lastMessageAt: true,
    seekerId: true,
    providerId: true,
    request: { select: { title: true } },
    seeker: { select: { displayName: true } },
    providerUser: { select: { displayName: true } },
  },
} as const;

function toSummary(
  row: {
    id: string;
    requestId: string;
    status: string;
    lastMessageAt: Date | null;
    seekerId: string;
    providerId: string;
    request: { title: string };
    seeker: { displayName: string };
    providerUser: { displayName: string };
  },
  viewerId: string,
  lastMessagePreview: string | null,
): ConversationSummary {
  const isSeeker = row.seekerId === viewerId;
  return {
    id: row.id,
    requestId: row.requestId,
    requestTitle: row.request.title,
    status: row.status,
    counterpartDisplayName: isSeeker
      ? row.providerUser.displayName
      : row.seeker.displayName,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview,
  };
}

@Injectable()
export class ConversationsService {
  // Optional (not @Inject'd as required) so existing tests can keep doing
  // `new ConversationsService()` without a gateway — real callers always
  // get one through Nest DI, since ConversationsGateway is a provider in
  // the same module.
  constructor(private readonly gateway?: ConversationsGateway) {}

  // Participant membership (seeker or provider) is already enforced by
  // RequireOwnershipGuard before this runs.
  async getById(id: string, viewerId: string): Promise<ConversationSummary> {
    const row = await prisma.conversation.findUnique({
      where: { id },
      ...conversationWithParticipants,
    });
    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return toSummary(row, viewerId, null);
  }

  async listMine(userId: string): Promise<ConversationSummary[]> {
    const rows = await prisma.conversation.findMany({
      where: { OR: [{ seekerId: userId }, { providerId: userId }] },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      select: {
        ...conversationWithParticipants.select,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true },
        },
      },
    });

    return rows.map((row) =>
      toSummary(row, userId, row.messages[0]?.body ?? null),
    );
  }

  // Participant membership is already enforced by RequireOwnershipGuard
  // before this runs.
  async listMessages(
    conversationId: string,
    viewerId: string,
    cursorInput: string | null | undefined,
    limit: number,
  ): Promise<CursorPage<MessageSummary>> {
    const cursor = cursorInput
      ? decodeCursor<MessageListCursor>(cursorInput)
      : null;

    // Newest-first keyset pagination (createdAt DESC, id DESC as tiebreak,
    // same shape as the request list's cursor in requests.service.ts). The
    // web client reverses the page for display so the thread reads
    // oldest-to-newest, with "load more" walking further into the past.
    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    };

    const rows = await prisma.message.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        type: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    // Fetching a page marks the counterpart's unread messages in it as
    // read — a side effect of viewing, not a standalone "mark read"
    // feature. No unread-count or notification system exists yet (that's
    // a product decision deliberately left open, see CLAUDE.md); this only
    // persists the existing readAt field for messages the viewer actually
    // just saw.
    const unreadIds = pageRows
      .filter(
        (m) => m.senderId !== null && m.senderId !== viewerId && !m.readAt,
      )
      .map((m) => m.id);
    const readNowAt = new Date();
    if (unreadIds.length > 0) {
      await prisma.message.updateMany({
        where: { id: { in: unreadIds } },
        data: { readAt: readNowAt },
      });
    }
    const justRead = new Set(unreadIds);

    const items: MessageSummary[] = pageRows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      isMine: row.senderId === viewerId,
      type: row.type,
      body: row.body,
      readAt: justRead.has(row.id) ? readNowAt : row.readAt,
      createdAt: row.createdAt,
    }));

    const last = pageRows.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          } satisfies MessageListCursor)
        : null;

    return { items, nextCursor, hasMore };
  }

  // Participant membership is already enforced by RequireOwnershipGuard
  // before this runs.
  async sendMessage(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<MessageSummary> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true },
    });
    if (!conversation) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (conversation.status !== ConversationStatus.OPEN) {
      throw new AppError(ErrorCode.CONVERSATION_ARCHIVED, HttpStatus.CONFLICT);
    }

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderId,
          type: MessageType.TEXT,
          body,
        },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          type: true,
          body: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // The broadcast payload deliberately omits isMine: that field is
    // relative to whoever is asking (see toSummary/listMessages above), but
    // this same event reaches every participant in the room, sender
    // included. Each client computes it locally against its own user id.
    this.gateway?.broadcastMessage(conversationId, {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type,
      body: message.body,
      readAt: message.readAt,
      createdAt: message.createdAt,
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      isMine: true,
      type: message.type,
      body: message.body,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }
}
