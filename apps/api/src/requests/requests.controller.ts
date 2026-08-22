import { Body, Controller, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { prisma } from '@vaqt/db';
import type {
  CreateRequestInput,
  ListRequestsInput,
  PublishRequestInput,
} from '@vaqt/shared';
import type { AuthenticatedRequest } from '../auth/auth-request';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireOwnership } from '../auth/decorators/require-ownership.decorator';
import { RequireVerifiedPhone } from '../auth/decorators/require-verified-phone.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { Public } from '../common/decorators/public.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { ListRequestsDto } from './dto/list-requests.dto';
import { PublishRequestDto } from './dto/publish-request.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @RequireVerifiedPhone()
  create(
    @CurrentUser() user: AccessTokenPayload,
    // A method-scoped @UsePipes() runs its pipe against every resolved
    // parameter, not just @Body() — with @CurrentUser() also present here,
    // that meant ZodValidationPipe ran against the token payload too and
    // the real body never reached the handler (silently manifested as
    // every field being "Required"). Scoping the pipe to just this
    // parameter avoids that entirely; publish()/list() never had the
    // problem since they take no other resolved parameter.
    @Body(new ZodValidationPipe(CreateRequestDto)) body: CreateRequestInput,
  ) {
    return this.requests.create(user.sub, body);
  }

  @Post('publish')
  @RequireVerifiedPhone()
  @RequireOwnership(async (req: AuthenticatedRequest) => {
    const body = req.body as { id?: unknown } | undefined;
    const id = typeof body?.id === 'string' ? body.id : null;
    if (!id) {
      return null;
    }
    const request = await prisma.request.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    return request?.ownerId ?? null;
  })
  publish(
    @Body(new ZodValidationPipe(PublishRequestDto)) body: PublishRequestInput,
  ) {
    return this.requests.publish(body.id);
  }

  // Public: guests and phone-unverified users can browse the list too — the
  // budget just never appears here for anyone (see RequestsService.list).
  @Post('list')
  @Public()
  list(@Body(new ZodValidationPipe(ListRequestsDto)) body: ListRequestsInput) {
    return this.requests.list(body);
  }
}
