import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { prisma } from '@vaqt/db';
import { Public } from '../common/decorators/public.decorator';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';

// Only the exact shape AvatarService writes: avatars/<uuid>[-thumb].jpg.
const AVATAR_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-thumb)?\.jpg$/;

/**
 * Serves uploads kept in Postgres (DbStorageAdapter). Mounted at /uploads,
 * outside the /api/v1 prefix, because the web app proxies /uploads here and
 * stored avatar URLs already point at it. Public: avatars are shown on
 * public cards; the random UUID key is the only "secret".
 */
@Controller('uploads')
export class UploadsController {
  @Public()
  @Get('avatars/:name')
  async avatar(@Param('name') name: string, @Res() res: Response) {
    if (!AVATAR_NAME.test(name)) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const file = await prisma.storedFile.findUnique({
      where: { key: `avatars/${name}` },
      select: { contentType: true, data: true },
    });
    if (!file) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Keys are random and never reused, so a cached copy can never be stale.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(file.data));
  }
}
