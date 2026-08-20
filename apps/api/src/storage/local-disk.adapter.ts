import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { StoragePort } from './storage.port';

/** Dev-only adapter: writes under apps/api/uploads/ (gitignored), served
 * back by a static Express route mounted at /uploads in main.ts. */
@Injectable()
export class LocalDiskAdapter implements StoragePort {
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(root: string, publicBaseUrl: string) {
    this.root = root;
    this.publicBaseUrl = publicBaseUrl;
  }

  async save(
    key: string,
    buffer: Buffer,
    _contentType: string,
  ): Promise<string> {
    const path = join(this.root, key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, buffer);
    return key;
  }

  async delete(key: string): Promise<void> {
    await rm(join(this.root, key), { force: true });
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
