import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, prisma, RequestStatus } from '@vaqt/db';
import {
  decodeCursor,
  encodeCursor,
  normalizeFa,
  type CreateRequestInput,
  type ListRequestsInput,
} from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';

// v1 has no urgent/featured toggle yet (that lands with the offer/payment
// phases) — every published request gets the base tier. Publishing still
// sets it explicitly rather than relying on the column default, so the
// intent is visible at the call site and survives a future default change.
const PUBLISHED_LIST_TIER = 0;

interface RequestListCursor {
  listTier: number;
  // ISO string, not a Date — Date isn't round-trippable through
  // JSON.stringify/parse (encodeCursor/decodeCursor use JSON under the hood).
  listRankAt: string;
  id: string;
}

export interface RequestListItem {
  id: string;
  title: string;
  categoryName: string;
  city: string | null;
  mode: string;
  status: string;
  offerCount: number;
  ownerDisplayName: string;
  // Always null from this endpoint. The budget range never appears in the
  // public list — only on the request detail page (RequestsService.getById),
  // and only for phone-verified viewers. See CLAUDE.md bond 6.
  budgetMinRial: null;
  budgetMaxRial: null;
}

export interface RequestListResult {
  items: RequestListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface RequestDetail {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  mode: string;
  city: string | null;
  durationMinutes: number;
  deadlineAt: Date;
  status: string;
  offerCount: number;
  ownerId: string;
  ownerDisplayName: string;
  isOwner: boolean;
  // Rial. Both null and budgetMasked: true unless the viewer is
  // phone-verified — see CLAUDE.md bond 6. Never masked for the owner
  // themselves (their own budget is never a secret from them).
  budgetMinRial: number | null;
  budgetMaxRial: number | null;
  budgetMasked: boolean;
  // The viewer's own offer on this request, if any (always null for the
  // owner — an owner can't offer on their own request, see
  // OWN_REQUEST_OFFER_FORBIDDEN).
  myOfferId: string | null;
  myOfferStatus: string | null;
}

@Injectable()
export class RequestsService {
  async create(
    ownerId: string,
    input: CreateRequestInput,
  ): Promise<{ id: string; status: string }> {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { isActive: true },
    });
    if (!category || !category.isActive) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, {
        details: { reason: 'CATEGORY_NOT_FOUND' },
      });
    }

    const request = await prisma.request.create({
      data: {
        slug: `req-${randomUUID()}`,
        ownerId,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        mode: input.mode,
        city: input.city ?? null,
        durationMinutes: input.durationMinutes,
        budgetMinRial: input.budgetMinRial,
        budgetMaxRial: input.budgetMaxRial,
        deadlineAt: input.deadlineAt,
        preferredWindows: input.preferredWindows,
        searchText: normalizeFa(`${input.title} ${input.description}`),
        status: RequestStatus.DRAFT,
      },
      select: { id: true, status: true },
    });
    return request;
  }

  // Ownership is already enforced by RequireOwnershipGuard before this
  // runs — this only needs to check the DRAFT invariant.
  async publish(
    id: string,
  ): Promise<{ id: string; status: string; publishedAt: Date | null }> {
    const existing = await prisma.request.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (existing.status !== RequestStatus.DRAFT) {
      throw new AppError(ErrorCode.REQUEST_NOT_DRAFT, HttpStatus.CONFLICT);
    }

    const now = new Date();
    return prisma.request.update({
      where: { id },
      data: {
        status: RequestStatus.PUBLISHED,
        publishedAt: now,
        listTier: PUBLISHED_LIST_TIER,
        listRankAt: now,
      },
      select: { id: true, status: true, publishedAt: true },
    });
  }

  async list(input: ListRequestsInput): Promise<RequestListResult> {
    const cursor = input.cursor
      ? decodeCursor<RequestListCursor>(input.cursor)
      : null;

    // Keyset pagination matching ORDER BY listTier DESC, listRankAt DESC,
    // id DESC (CLAUDE.md bond 5). All three fields must be in the cursor
    // and in this OR chain, or rows sharing a (listTier, listRankAt) tie
    // get skipped or repeated across pages.
    const where: Prisma.RequestWhereInput = {
      status: RequestStatus.PUBLISHED,
      ...(cursor
        ? {
            OR: [
              { listTier: { lt: cursor.listTier } },
              {
                listTier: cursor.listTier,
                listRankAt: { lt: new Date(cursor.listRankAt) },
              },
              {
                listTier: cursor.listTier,
                listRankAt: new Date(cursor.listRankAt),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    };

    const rows = await prisma.request.findMany({
      where,
      orderBy: [{ listTier: 'desc' }, { listRankAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      select: {
        id: true,
        title: true,
        city: true,
        mode: true,
        status: true,
        offerCount: true,
        listTier: true,
        listRankAt: true,
        category: { select: { name: true } },
        owner: { select: { displayName: true } },
      },
    });

    const hasMore = rows.length > input.limit;
    const pageRows = hasMore ? rows.slice(0, input.limit) : rows;

    const items: RequestListItem[] = pageRows.map((row) => ({
      id: row.id,
      title: row.title,
      categoryName: row.category.name,
      city: row.city,
      mode: row.mode,
      status: row.status,
      offerCount: row.offerCount,
      ownerDisplayName: row.owner.displayName,
      budgetMinRial: null,
      budgetMaxRial: null,
    }));

    const last = pageRows.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            listTier: last.listTier,
            listRankAt: last.listRankAt.toISOString(),
            id: last.id,
          } satisfies RequestListCursor)
        : null;

    return { items, nextCursor, hasMore };
  }

  async getById(id: string, viewerId: string): Promise<RequestDetail> {
    const request = await prisma.request.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        categoryId: true,
        mode: true,
        city: true,
        durationMinutes: true,
        deadlineAt: true,
        status: true,
        offerCount: true,
        ownerId: true,
        budgetMinRial: true,
        budgetMaxRial: true,
        category: { select: { name: true } },
        owner: { select: { displayName: true } },
      },
    });
    // A DRAFT is only visible to its own owner — everyone else gets the
    // same NOT_FOUND as a genuinely missing id, so a guess-the-id probe
    // can't distinguish "doesn't exist" from "still a draft".
    if (
      !request ||
      (request.status === RequestStatus.DRAFT && request.ownerId !== viewerId)
    ) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    const isOwner = request.ownerId === viewerId;
    const viewer = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { phoneVerifiedAt: true },
    });
    const canSeeBudget = isOwner || viewer?.phoneVerifiedAt != null;

    const myOffer = isOwner
      ? null
      : await prisma.offer.findUnique({
          where: {
            requestId_providerId: { requestId: id, providerId: viewerId },
          },
          select: { id: true, status: true },
        });

    return {
      id: request.id,
      title: request.title,
      description: request.description,
      categoryId: request.categoryId,
      categoryName: request.category.name,
      mode: request.mode,
      city: request.city,
      durationMinutes: request.durationMinutes,
      deadlineAt: request.deadlineAt,
      status: request.status,
      offerCount: request.offerCount,
      ownerId: request.ownerId,
      ownerDisplayName: request.owner.displayName,
      isOwner,
      budgetMinRial: canSeeBudget ? request.budgetMinRial : null,
      budgetMaxRial: canSeeBudget ? request.budgetMaxRial : null,
      budgetMasked: !canSeeBudget,
      myOfferId: myOffer?.id ?? null,
      myOfferStatus: myOffer?.status ?? null,
    };
  }
}
