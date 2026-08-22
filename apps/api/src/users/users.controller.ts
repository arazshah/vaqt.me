import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'nestjs-zod';
import type { PutUserSkillsInput, UpdateUserProfileInput } from '@vaqt/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { AvatarService } from './avatar.service';
import { PutUserSkillsDto } from './dto/put-user-skills.dto';
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

  @Patch('me')
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

  @Put('me/skills')
  putMySkills(
    @CurrentUser() user: AccessTokenPayload,
    // Same bug as updateMe() above, but putUserSkillsSchema has a required
    // field (skillIds), so validating the @CurrentUser() payload against it
    // threw immediately instead of silently corrupting user.sub — this
    // route 400'd on every call, valid input or not.
    @Body(new ZodValidationPipe(PutUserSkillsDto)) body: PutUserSkillsInput,
  ) {
    return this.users.putSkills(user.sub, body.skillIds);
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

  @Delete('me/avatar')
  deleteAvatar(@CurrentUser() user: AccessTokenPayload) {
    return this.avatars.deleteAvatar(user.sub);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.users.getPublicProfile(id);
  }
}
