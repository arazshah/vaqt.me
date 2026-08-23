import { HttpStatus, Injectable } from '@nestjs/common';
import { OfferStatus, MessageType, prisma, RequestStatus } from '@vaqt/db';
import {
  computeProfileCompleteness,
  type SubmitOfferInput,
} from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';

export interface OfferSummary {
  id: string;
  requestId: string;
  providerId: string;
  providerDisplayName: string;
  proposedStartAt: Date;
  proposedDurationMinutes: number;
  amountRial: number;
  message: string | null;
  status: string;
  createdAt: Date;
}

const offerWithProvider = {
  select: {
    id: true,
    requestId: true,
    providerId: true,
    proposedStartAt: true,
    proposedDurationMinutes: true,
    amountRial: true,
    message: true,
    status: true,
    createdAt: true,
    provider: { select: { displayName: true } },
  },
} as const;

function toSummary(offer: {
  id: string;
  requestId: string;
  providerId: string;
  proposedStartAt: Date;
  proposedDurationMinutes: number;
  amountRial: number;
  message: string | null;
  status: string;
  createdAt: Date;
  provider: { displayName: string };
}): OfferSummary {
  return {
    id: offer.id,
    requestId: offer.requestId,
    providerId: offer.providerId,
    providerDisplayName: offer.provider.displayName,
    proposedStartAt: offer.proposedStartAt,
    proposedDurationMinutes: offer.proposedDurationMinutes,
    amountRial: offer.amountRial,
    message: offer.message,
    status: offer.status,
    createdAt: offer.createdAt,
  };
}

@Injectable()
export class OffersService {
  async submit(
    providerId: string,
    input: SubmitOfferInput,
  ): Promise<{ id: string; status: string; revisionCount: number }> {
    const request = await prisma.request.findUnique({
      where: { id: input.requestId },
      select: { id: true, ownerId: true, status: true },
    });
    if (!request) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (request.status !== RequestStatus.PUBLISHED) {
      throw new AppError(ErrorCode.REQUEST_NOT_PUBLISHED, HttpStatus.CONFLICT);
    }
    if (request.ownerId === providerId) {
      throw new AppError(
        ErrorCode.OWN_REQUEST_OFFER_FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    // canSubmitOffer is checked server-side only — never trust a client
    // claim about its own profile completeness. Note this deliberately
    // does NOT require phoneVerified (see packages/shared/domain/
    // completeness.ts): only publishing a request needs a verified phone,
    // not submitting an offer on someone else's.
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: {
        displayName: true,
        bio: true,
        phoneVerifiedAt: true,
        skills: { select: { skillId: true } },
      },
    });
    if (!provider) {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }
    const completeness = computeProfileCompleteness({
      phoneVerified: provider.phoneVerifiedAt !== null,
      displayName: provider.displayName,
      bio: provider.bio,
      skillCount: provider.skills.length,
    });
    if (!completeness.canSubmitOffer) {
      throw new AppError(
        ErrorCode.PROFILE_INCOMPLETE_FOR_OFFER,
        HttpStatus.FORBIDDEN,
      );
    }

    const existing = await prisma.offer.findUnique({
      where: {
        requestId_providerId: { requestId: input.requestId, providerId },
      },
      select: { id: true, status: true, revisionCount: true },
    });

    if (existing) {
      // Only a WITHDRAWN offer can be re-submitted (CLAUDE.md bond 14).
      // Any other existing status (PENDING/SELECTED/REJECTED/EXPIRED) means
      // the hard @@unique([requestId, providerId]) already has an active
      // or decided row — reject rather than silently reactivating it,
      // since bond 14 only defines re-submit behavior for WITHDRAWN.
      if (existing.status !== OfferStatus.WITHDRAWN) {
        throw new AppError(ErrorCode.OFFER_ALREADY_EXISTS, HttpStatus.CONFLICT);
      }
      return prisma.offer.update({
        where: { id: existing.id },
        data: {
          status: OfferStatus.PENDING,
          proposedStartAt: input.proposedStartAt,
          proposedDurationMinutes: input.proposedDurationMinutes,
          amountRial: input.amountRial,
          message: input.message ?? null,
          revisionCount: { increment: 1 },
        },
        select: { id: true, status: true, revisionCount: true },
      });
    }

    return prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          requestId: input.requestId,
          providerId,
          proposedStartAt: input.proposedStartAt,
          proposedDurationMinutes: input.proposedDurationMinutes,
          amountRial: input.amountRial,
          message: input.message ?? null,
          status: OfferStatus.PENDING,
        },
        select: { id: true, status: true, revisionCount: true },
      });
      // offerCount is a cumulative "how many offers has this request ever
      // received" counter shown in the public list — it only increments on
      // the first submission, not on a WITHDRAWN -> PENDING re-submit
      // (that's the same offer reactivating, not a new one).
      await tx.request.update({
        where: { id: input.requestId },
        data: { offerCount: { increment: 1 } },
      });
      return offer;
    });
  }

  // Ownership (offer.request.ownerId === current user) is already enforced
  // by RequireOwnershipGuard before this runs.
  async select(
    offerId: string,
  ): Promise<{ offerId: string; requestId: string; conversationId: string }> {
    return prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        select: {
          id: true,
          requestId: true,
          providerId: true,
          status: true,
          request: { select: { id: true, ownerId: true, status: true } },
        },
      });
      if (!offer) {
        throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (offer.status !== OfferStatus.PENDING) {
        throw new AppError(ErrorCode.OFFER_NOT_PENDING, HttpStatus.CONFLICT);
      }
      if (offer.request.status !== RequestStatus.PUBLISHED) {
        throw new AppError(
          ErrorCode.REQUEST_NOT_PUBLISHED,
          HttpStatus.CONFLICT,
        );
      }

      await tx.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.SELECTED },
      });
      // Selecting one offer means the others no longer have a chance —
      // reject them explicitly so providers see a clear outcome instead of
      // being left PENDING forever on a request that already moved on.
      await tx.offer.updateMany({
        where: {
          requestId: offer.requestId,
          id: { not: offerId },
          status: OfferStatus.PENDING,
        },
        data: { status: OfferStatus.REJECTED },
      });
      await tx.request.update({
        where: { id: offer.requestId },
        data: { status: RequestStatus.OFFER_SELECTED },
      });
      const conversation = await tx.conversation.create({
        data: {
          requestId: offer.requestId,
          offerId: offer.id,
          seekerId: offer.request.ownerId,
          providerId: offer.providerId,
        },
        select: { id: true },
      });
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: null,
          type: MessageType.SYSTEM,
          body: 'این گفتگو به‌دلیل انتخاب پیشنهاد شما آغاز شد.',
        },
      });

      return {
        offerId: offer.id,
        requestId: offer.requestId,
        conversationId: conversation.id,
      };
    });
  }

  // Ownership (offer.providerId === current user) is already enforced by
  // RequireOwnershipGuard before this runs.
  async withdraw(offerId: string): Promise<{ id: string; status: string }> {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, status: true },
    });
    if (!offer) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (offer.status !== OfferStatus.PENDING) {
      throw new AppError(ErrorCode.OFFER_NOT_PENDING, HttpStatus.CONFLICT);
    }
    return prisma.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.WITHDRAWN },
      select: { id: true, status: true },
    });
  }

  // Ownership (request.ownerId === current user) is already enforced by
  // RequireOwnershipGuard before this runs.
  async listForRequest(requestId: string): Promise<OfferSummary[]> {
    const offers = await prisma.offer.findMany({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
      ...offerWithProvider,
    });
    return offers.map(toSummary);
  }

  async listMine(providerId: string): Promise<OfferSummary[]> {
    const OWN_OFFERS_LIMIT = 50;
    const offers = await prisma.offer.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
      take: OWN_OFFERS_LIMIT,
      ...offerWithProvider,
    });
    return offers.map(toSummary);
  }
}
