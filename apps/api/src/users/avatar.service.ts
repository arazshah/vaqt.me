import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { STORAGE_PORT, type StoragePort } from '../storage/storage.port';
import { detectImageMime } from './image-magic-bytes';
import { loadSharp, type SharpFn } from './load-sharp';

const MAX_BYTES = 2 * 1024 * 1024;
const MAIN_SIZE = 400;
const THUMBNAIL_SIZE = 96;

function thumbnailKeyFor(mainKey: string): string {
  return mainKey.replace(/\.jpg$/, '-thumb.jpg');
}

export interface AvatarUploadResult {
  avatarUrl: string;
  avatarThumbnailUrl: string;
}

@Injectable()
export class AvatarService implements OnModuleInit {
  private readonly logger = new Logger(AvatarService.name);

  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  /** Warns at boot (never fails it) if image processing can't run here. */
  async onModuleInit(): Promise<void> {
    try {
      await loadSharp();
    } catch (error) {
      this.logger.error(
        'image library (sharp) cannot load on this machine — avatar uploads are disabled. ' +
          'On a VM, set the CPU type to "host" (x86-64-v2 or newer).',
        error instanceof Error ? error.message.split('\n')[0] : error,
      );
    }
  }

  async uploadAvatar(
    userId: string,
    buffer: Buffer,
  ): Promise<AvatarUploadResult> {
    if (buffer.length > MAX_BYTES) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        details: { reason: 'FILE_TOO_LARGE' },
      });
    }

    // Detected from the file's actual magic bytes, never from the
    // client-supplied filename extension or Content-Type header — both are
    // attacker-controlled and prove nothing about the real file content.
    const detected = detectImageMime(buffer);
    if (!detected) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        details: { reason: 'UNSUPPORTED_FILE_TYPE' },
      });
    }

    let sharp: SharpFn;
    try {
      sharp = await loadSharp();
    } catch {
      throw new AppError(ErrorCode.IMAGE_PROCESSING_UNAVAILABLE, 503);
    }

    // sharp's default output never carries over source EXIF/ICC/GPS
    // metadata unless .withMetadata() is called — re-encoding through it
    // is what strips it, on top of resizing.
    const mainBuffer = await sharp(buffer)
      .resize(MAIN_SIZE, MAIN_SIZE, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
    const thumbnailBuffer = await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const randomId = randomUUID();
    const mainKey = `avatars/${randomId}.jpg`;
    const thumbnailKey = `avatars/${randomId}-thumb.jpg`;

    await this.storage.save(mainKey, mainBuffer, 'image/jpeg');
    await this.storage.save(thumbnailKey, thumbnailBuffer, 'image/jpeg');

    const previous = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarStorageKey: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: this.storage.publicUrl(mainKey),
        avatarThumbnailUrl: this.storage.publicUrl(thumbnailKey),
        avatarStorageKey: mainKey,
      },
    });

    if (previous?.avatarStorageKey) {
      await this.storage
        .delete(previous.avatarStorageKey)
        .catch(() => undefined);
      await this.storage
        .delete(thumbnailKeyFor(previous.avatarStorageKey))
        .catch(() => undefined);
    }

    return {
      avatarUrl: this.storage.publicUrl(mainKey),
      avatarThumbnailUrl: this.storage.publicUrl(thumbnailKey),
    };
  }

  async deleteAvatar(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarStorageKey: true },
    });

    if (user?.avatarStorageKey) {
      await this.storage.delete(user.avatarStorageKey).catch(() => undefined);
      await this.storage
        .delete(thumbnailKeyFor(user.avatarStorageKey))
        .catch(() => undefined);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
        avatarThumbnailUrl: null,
        avatarStorageKey: null,
      },
    });
  }
}
