import { Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import type { StoragePort } from './storage.port';

/**
 * Keeps uploads in Postgres (stored_files). The database is the one thing a
 * redeploy never loses, so an avatar can't outlive its file the way it did
 * on a container disk. Served back by UploadsController at /uploads/<key>.
 */
@Injectable()
export class DbStorageAdapter implements StoragePort {
  constructor(private readonly publicBaseUrl: string) {}

  async save(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    // Prisma's Bytes wants a plain ArrayBuffer-backed Uint8Array.
    const data = new Uint8Array(buffer);
    await prisma.storedFile.upsert({
      where: { key },
      create: { key, contentType, data },
      update: { contentType, data },
    });
    return key;
  }

  async delete(key: string): Promise<void> {
    await prisma.storedFile.deleteMany({ where: { key } });
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
