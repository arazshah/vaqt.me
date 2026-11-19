import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'nestjs-zod';
import type { UpdateUserProfileInput } from '@vaqt/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { AvatarService } from './avatar.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly avatars: AvatarService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: AccessTokenPayload) {
    return this.users.getMe(user.sub);
  }

  // RPC-style (@Post only), matching the convention set from
  // RequestsController onward — PATCH/PUT/DELETE here predate that decision
  // (phase 3) and were converted in the phase-11 cleanup (see CLAUDE.md
  // "بدهی فنی").
  @Post('me/update')
  updateMe(
    @CurrentUser() user: AccessTokenPayload,
    // A method-scoped @UsePipes() runs its pipe against every resolved
    // parameter, not just @Body() — nestjs-zod's ZodValidationPipe.transform()
    // has no check on ArgumentMetadata.type, so it validated the
    // @CurrentUser() payload too, against this same schema. Every field in
    // updateUserProfileSchema is optional, so validating {sub, sid} against
    // it silently succeeded and produced {} (zod strips unrecognized keys
    // by default) — user.sub became undefined, and every write silently
    // targeted no row. Scoping the pipe to just this parameter fixes it.
    @Body(new ZodValidationPipe(UpdateUserProfileDto))
    body: UpdateUserProfileInput,
  ) {
    return this.users.updateMe(user.sub, body);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  uploadAvatar(
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.avatars.uploadAvatar(user.sub, file.buffer);
  }

  @Post('me/avatar/delete')
  deleteAvatar(@CurrentUser() user: AccessTokenPayload) {
    return this.avatars.deleteAvatar(user.sub);
  }
}
