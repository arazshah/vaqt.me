import { prisma } from '@vaqt/db';
import { cleanupTestUser, createTestUser } from '../test-support/test-db';
import { AvatarService } from './avatar.service';

// Simulates a CPU/OS where the sharp native binary can't load.
jest.mock('./load-sharp', () => ({
  loadSharp: jest
    .fn()
    .mockRejectedValue(
      new Error('Could not load the "sharp" module\nUnsupported CPU'),
    ),
}));

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('AvatarService when sharp cannot load', () => {
  const files = new Map<string, Buffer>();
  const storage = {
    save: jest.fn((key: string, buffer: Buffer) => {
      files.set(key, buffer);
      return Promise.resolve(key);
    }),
    delete: jest.fn(() => Promise.resolve()),
    publicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
  };
  const service = new AvatarService(storage);
  let userId: string;

  beforeAll(async () => {
    userId = (await createTestUser({})).id;
  });
  afterAll(async () => {
    await cleanupTestUser(userId);
    await prisma.$disconnect();
  });

  it('boots (onModuleInit does not throw)', async () => {
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('still stores a re-encoded JPEG avatar through the pure-JS fallback', async () => {
    const result = await service.uploadAvatar(userId, PNG_1X1);
    expect(result.avatarUrl).toMatch(/avatars\/.+\.jpg$/);
    const saved = [...files.values()];
    expect(saved).toHaveLength(2);
    for (const buf of saved) {
      expect(buf.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    }
  });

  it('rejects garbage that has image magic bytes but cannot be decoded', async () => {
    const broken = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(20),
    ]);
    await expect(service.uploadAvatar(userId, broken)).rejects.toMatchObject({
      status: 400,
    });
  });
});
