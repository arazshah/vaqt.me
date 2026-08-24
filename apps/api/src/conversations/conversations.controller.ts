import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { prisma } from '@vaqt/db';
import type { ListMessagesInput, SendMessageInput } from '@vaqt/shared';
import type { AuthenticatedRequest } from '../auth/auth-request';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireOwnership } from '../auth/decorators/require-ownership.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { ConversationsService } from './conversations.service';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';

async function resolveParticipantsById(
  id: string | undefined,
): Promise<string[] | null> {
  if (!id) {
    return null;
  }
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { seekerId: true, providerId: true },
  });
  if (!conversation) {
    return null;
  }
  return [conversation.seekerId, conversation.providerId];
}

// Same lookup as resolveParticipantsById, but the conversationId comes from
// the request body (POST endpoints) instead of a path param.
async function resolveParticipantsFromBody(
  req: AuthenticatedRequest,
): Promise<string[] | null> {
  const body = req.body as { conversationId?: unknown } | undefined;
  const conversationId =
    typeof body?.conversationId === 'string' ? body.conversationId : null;
  return resolveParticipantsById(conversationId ?? undefined);
}

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  // Path param, not a query param — matches the established precedent for
  // single-resource reads in this codebase (GET /requests/:id, GET
  // /users/:id), both of which predate and knowingly deviate from the
  // idealized "no path params" rule in API_DESIGN.md for this exact case.
  @Get(':id')
  @RequireOwnership((req: AuthenticatedRequest) =>
    resolveParticipantsById((req.params as { id?: string }).id),
  )
  getById(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.conversations.getById(id, user.sub);
  }

  @Post('mine')
  mine(@CurrentUser() user: AccessTokenPayload) {
    return this.conversations.listMine(user.sub);
  }

  @Post('messages/list')
  @RequireOwnership(resolveParticipantsFromBody)
  listMessages(
    @Body(new ZodValidationPipe(ListMessagesDto)) body: ListMessagesInput,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.conversations.listMessages(
      body.conversationId,
      user.sub,
      body.cursor,
      body.limit,
    );
  }

  @Post('messages')
  @RequireOwnership(resolveParticipantsFromBody)
  sendMessage(
    @Body(new ZodValidationPipe(SendMessageDto)) body: SendMessageInput,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.conversations.sendMessage(
      body.conversationId,
      user.sub,
      body.body,
    );
  }
}
