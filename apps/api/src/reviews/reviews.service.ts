import { HttpStatus, Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import { decodeCursor, encodeCursor, type CursorPage } from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';

export interface ReviewSummary {
  id: string;
  conversationId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  reviewer: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface ReviewListCursor {
  // ISO string, not a Date — same reasoning as MessageListCursor in
  // conversations.service.ts (Date isn't round-trippable through
  // encodeCursor/decodeCursor's JSON.stringify/parse).
  createdAt: string;
  id: string;
}

function toSummary(row: {
  id: string;
  conversationId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  reviewer: { id: string; displayName: string; avatarUrl: string | null };
}): ReviewSummary {
  return {
    id: row.id,
    conversationId: row.conversationId,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
    reviewer: row.reviewer,
  };
}

@Injectable()
export class ReviewsService {
  // Participant membership (seeker or provider) is already enforced by
  // RequireOwnershipGuard before this runs. revieweeId is derived from the
  // conversation itself — never trusted from the request — so a self-review
  // is structurally impossible (a conversation's seekerId and providerId
  // can never be the same user; see OWN_REQUEST_OFFER_FORBIDDEN).
  async submit(
    conversationId: string,
    reviewerId: string,
    rating: number,
    comment?: string,
  ): Promise<ReviewSummary> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { seekerId: true, providerId: true },
    });
    if (!conversation) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const revieweeId =
      conversation.seekerId === reviewerId
        ? conversation.providerId
        : conversation.seekerId;

    const existing = await prisma.review.findUnique({
      where: { conversationId_reviewerId: { conversationId, reviewerId } },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(ErrorCode.REVIEW_ALREADY_EXISTS, HttpStatus.CONFLICT);
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: { conversationId, reviewerId, revieweeId, rating, comment },
        select: {
          id: true,
          conversationId: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewer: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      });

      // Recomputed from the live aggregate rather than an incremental
      // running average — review volume per user is small, and this avoids
      // floating-point drift accumulating across many updates.
      const aggregate = await tx.review.aggregate({
        where: { revieweeId, isVisible: true },
        _avg: { rating: true },
        _count: true,
      });
      await tx.user.update({
        where: { id: revieweeId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count,
        },
      });

      return created;
    });

    return toSummary(review);
  }

  async listForUser(
    userId: string,
    cursorInput: string | null | undefined,
    limit: number,
  ): Promise<CursorPage<ReviewSummary>> {
    const cursor = cursorInput
      ? decodeCursor<ReviewListCursor>(cursorInput)
      : null;

    const rows = await prisma.review.findMany({
      where: {
        revieweeId: userId,
        isVisible: true,
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
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        conversationId: true,
        rating: true,
        comment: true,
        createdAt: true,
        reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          } satisfies ReviewListCursor)
        : null;

    return { items: pageRows.map(toSummary), nextCursor, hasMore };
  }

  // Participant membership is already enforced by RequireOwnershipGuard
  // before this runs. Lets the conversation UI know whether to show a
  // review form or a "you already reviewed" state (with what was actually
  // rated, not just a boolean — so a page reload doesn't lose it) without
  // the client having to guess from a failed submit.
  async myReviewStatus(
    conversationId: string,
    viewerId: string,
  ): Promise<{
    reviewed: boolean;
    rating: number | null;
    comment: string | null;
  }> {
    const existing = await prisma.review.findUnique({
      where: {
        conversationId_reviewerId: { conversationId, reviewerId: viewerId },
      },
      select: { rating: true, comment: true },
    });
    return {
      reviewed: existing !== null,
      rating: existing?.rating ?? null,
      comment: existing?.comment ?? null,
    };
  }
}
