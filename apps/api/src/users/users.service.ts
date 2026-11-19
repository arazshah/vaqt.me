import { HttpStatus, Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import { normalizeFa, type UpdateUserProfileInput } from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import {
  toPrivateUser,
  toPublicUser,
  type PrivateUser,
  type PublicUser,
} from '../auth/user-view';

@Injectable()
export class UsersService {
  async getMe(userId: string): Promise<PrivateUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }
    return toPrivateUser(user);
  }

  async updateMe(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<PublicUser> {
    const data: Record<string, unknown> = {};
    if (input.displayName !== undefined) {
      // normalizeFa() turns ZWNJ into a plain space, which is right for search
      // text but wrong for a name people read on their own business card
      // (نیک‌پور must not become «نیک پور»). Normalise the letters and digits
      // around each ZWNJ, then put the ZWNJs back.
      data.displayName = input.displayName
        .split('‌')
        .map((part) => normalizeFa(part))
        .join('‌');
    }
    if (input.headline !== undefined) data.headline = input.headline;
    if (input.bio !== undefined) data.bio = input.bio;
    if (input.city !== undefined) data.city = input.city;

    const user = await prisma.user.update({ where: { id: userId }, data });
    return toPublicUser(user);
  }
}
