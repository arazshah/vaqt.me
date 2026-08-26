import { Body, Controller, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { prisma } from '@vaqt/db';
import type {
  ListReviewsForUserInput,
  ReviewStatusInput,
  SubmitReviewInput,
} from '@vaqt/shared';
import type { AuthenticatedRequest } from '../auth/auth-request';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireOwnership } from '../auth/decorators/require-ownership.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { ListReviewsForUserDto } from './dto/list-reviews-for-user.dto';
import { ReviewStatusDto } from './dto/review-status.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { ReviewsService } from './reviews.service';

// Same shape as the equivalent resolver in conversations.controller.ts —
// not shared/exported from there since it's a private controller-local
// helper, not a public API of that module.
async function resolveParticipantsFromBody(
  req: AuthenticatedRequest,
): Promise<string[] | null> {
  const body = req.body as { conversationId?: unknown } | undefined;
  const conversationId =
    typeof body?.conversationId === 'string' ? body.conversationId : null;
  if (!conversationId) {
    return null;
  }
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { seekerId: true, providerId: true },
  });
  if (!conversation) {
    return null;
  }
  return [conversation.seekerId, conversation.providerId];
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @RequireOwnership(resolveParticipantsFromBody)
  submit(
    @Body(new ZodValidationPipe(SubmitReviewDto)) body: SubmitReviewInput,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.reviews.submit(
      body.conversationId,
      user.sub,
      body.rating,
      body.comment,
    );
  }

  @Post('status')
  @RequireOwnership(resolveParticipantsFromBody)
  status(
    @Body(new ZodValidationPipe(ReviewStatusDto)) body: ReviewStatusInput,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.reviews.myReviewStatus(body.conversationId, user.sub);
  }

  @Post('list')
  list(
    @Body(new ZodValidationPipe(ListReviewsForUserDto))
    body: ListReviewsForUserInput,
  ) {
    return this.reviews.listForUser(body.userId, body.cursor, body.limit);
  }
}
