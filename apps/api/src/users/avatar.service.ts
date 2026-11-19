import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { STORAGE_PORT, type StoragePort } from '../storage/storage.port';
import { detectImageMime } from './image-magic-bytes';
import { loadSharp } from './load-sharp';
import {
  processAvatar,
  UnsupportedWithoutSharpError,
  type ProcessedAvatar,
} from './process-avatar';

const MAX_BYTES = 2 * 1024 * 1024;

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

  /** Warns at boot (never fails it) if the fast image path can't run here. */
  async onModuleInit(): Promise<void> {
    try {
      await loadSharp();
    } catch (error) {
      this.logger.error(
        'image library (sharp) cannot load on this machine — using the slower pure-JS fallback (pure JS). ' +
          'On a VM, set the CPU type to "host" (x86-64-v2 or newer) for the fast path.',
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

    let processed: ProcessedAvatar;
    try {
      processed = await processAvatar(buffer, detected);
    } catch (error) {
      if (error instanceof UnsupportedWithoutSharpError) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
          details: { reason: 'UNSUPPORTED_FILE_TYPE' },
        });
      }
      this.logger.warn(
        `avatar processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // A corrupt/undecodable image is the sender's problem, not an outage.
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        details: { reason: 'UNSUPPORTED_FILE_TYPE' },
      });
    }
    const mainBuffer = processed.main;
    const thumbnailBuffer = processed.thumbnail;

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
