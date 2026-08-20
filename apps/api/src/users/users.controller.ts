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
  UsePipes,
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
  @UsePipes(new ZodValidationPipe(UpdateUserProfileDto))
  updateMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: UpdateUserProfileInput,
  ) {
    return this.users.updateMe(user.sub, body);
  }

  @Put('me/skills')
  @UsePipes(new ZodValidationPipe(PutUserSkillsDto))
  putMySkills(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: PutUserSkillsInput,
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
