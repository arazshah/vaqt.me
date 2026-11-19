import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { prisma } from '@vaqt/db';
import { DbStorageAdapter } from './db-storage.adapter';
import { UploadsController } from './uploads.controller';

function fakeRes() {
  const headers: Record<string, string> = {};
  let body: Buffer | undefined;
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    end: (b: Buffer) => {
      body = b;
    },
  } as unknown as Response;
  return { res, headers, body: () => body };
}

describe('DbStorageAdapter + UploadsController (real Postgres)', () => {
  const storage = new DbStorageAdapter('https://vaqt.me/uploads');
  const controller = new UploadsController();
  const keys: string[] = [];
  afterAll(async () => {
    await prisma.storedFile.deleteMany({ where: { key: { in: keys } } });
  });

  it('stores a file in Postgres and serves it back with long-lived caching', async () => {
    const name = `${randomUUID()}.jpg`;
    const key = `avatars/${name}`;
    keys.push(key);
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x01, 0x02]);
    await storage.save(key, bytes, 'image/jpeg');
    expect(storage.publicUrl(key)).toBe(`https://vaqt.me/uploads/${key}`);

    const out = fakeRes();
    await controller.avatar(name, out.res);
    expect(out.headers['Content-Type']).toBe('image/jpeg');
    expect(out.headers['Cache-Control']).toContain('immutable');
    expect(out.body()?.equals(bytes)).toBe(true);
  });

  it('404s after delete, for unknown keys and for anything not shaped like an avatar', async () => {
    const name = `${randomUUID()}-thumb.jpg`;
    const key = `avatars/${name}`;
    keys.push(key);
    await storage.save(key, Buffer.from([1]), 'image/jpeg');
    await storage.delete(key);
    for (const n of [name, `${randomUUID()}.jpg`, '../secret', 'x.png']) {
      await expect(controller.avatar(n, fakeRes().res)).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    }
  });
});
