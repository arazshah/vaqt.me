import { prisma } from '@vaqt/db';
import sharp from 'sharp';
import { AppError } from '../common/errors/app-error';
import { cleanupTestUser, createTestUser } from '../test-support/test-db';
import type { StoragePort } from '../storage/storage.port';
import { AvatarService } from './avatar.service';

function makeFakeStorage(): jest.Mocked<StoragePort> {
  const files = new Map<string, Buffer>();
  return {
    save: jest.fn((key: string, buffer: Buffer) => {
      files.set(key, buffer);
      return Promise.resolve(key);
    }),
    delete: jest.fn((key: string) => {
      files.delete(key);
      return Promise.resolve();
    }),
    publicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
  } as unknown as jest.Mocked<StoragePort>;
}

const GPS_IFD_POINTER_TAG = 0x8825;

// Minimal TIFF/IFD0 walker used only to prove the *source* fixture really
// carries a GPS IFD pointer (tag 0x8825) before the strip test claims the
// service removes it — sharp's metadata() only exposes the raw EXIF buffer,
// not parsed tags, so this reads just enough of the TIFF structure
// ("Exif\0\0" header, then a standard IFD0 entry table) to find that one tag.
function exifHasGpsIfdPointer(exif: Buffer): boolean {
  const tiffStart = 6; // past the "Exif\0\0" APP1 prefix
  const byteOrder = exif.subarray(tiffStart, tiffStart + 2).toString('latin1');
  const little = byteOrder === 'II';
  const readU16 = (offset: number) =>
    little ? exif.readUInt16LE(offset) : exif.readUInt16BE(offset);
  const readU32 = (offset: number) =>
    little ? exif.readUInt32LE(offset) : exif.readUInt32BE(offset);

  const ifd0Offset = tiffStart + readU32(tiffStart + 4);
  const entryCount = readU16(ifd0Offset);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    const tagId = readU16(entryOffset);
    if (tagId === GPS_IFD_POINTER_TAG) return true;
  }
  return false;
}

async function makeGpsBearingJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg()
    .withExif({
      IFD0: { Copyright: 'یک عکاس' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '35/1 41/1 5500/100',
        GPSLongitudeRef: 'E',
        GPSLongitude: '51/1 23/1 500/100',
      },
    })
    .toBuffer();
}

describe('AvatarService (real sharp + file-type processing, fake storage)', () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await cleanupTestUser(id);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeUser(): Promise<string> {
    const user = await createTestUser({});
    createdUserIds.push(user.id);
    return user.id;
  }

  it('strips GPS/EXIF metadata from the uploaded image — proof: the source has GPS tags, the re-encoded output has none', async () => {
    const source = await makeGpsBearingJpeg();
    const sourceMeta = await sharp(source).metadata();
    // Sanity check the fixture itself actually carries a GPS IFD pointer
    // before we claim the service strips it — otherwise this test would
    // pass for the wrong reason.
    expect(sourceMeta.exif).toBeDefined();
    expect(exifHasGpsIfdPointer(sourceMeta.exif as Buffer)).toBe(true);

    const storage = makeFakeStorage();
    const service = new AvatarService(storage);
    const userId = await makeUser();

    await service.uploadAvatar(userId, source);

    const savedCalls = storage.save.mock.calls as [string, Buffer, string][];
    expect(savedCalls.length).toBe(2); // main + thumbnail
    for (const [, outputBuffer] of savedCalls) {
      const outputMeta = await sharp(outputBuffer).metadata();
      expect(outputMeta.exif).toBeUndefined();
    }
  });

  it('resizes the main image to 400x400 and the thumbnail to 96x96', async () => {
    const source = await makeGpsBearingJpeg();
    const storage = makeFakeStorage();
    const service = new AvatarService(storage);
    const userId = await makeUser();

    await service.uploadAvatar(userId, source);

    const savedCalls = storage.save.mock.calls as [string, Buffer, string][];
    const sizes = await Promise.all(
      savedCalls.map(async ([, buffer]) => {
        const meta = await sharp(buffer).metadata();
        return { width: meta.width, height: meta.height };
      }),
    );
    expect(sizes).toEqual(
      expect.arrayContaining([
        { width: 400, height: 400 },
        { width: 96, height: 96 },
      ]),
    );
  });

  it('rejects a file whose magic bytes are not a supported image type, even if it were labelled as a jpg', async () => {
    const fakeJpeg = Buffer.from(
      'this is definitely not image bytes, just text pretending to be a jpg',
    );
    const storage = makeFakeStorage();
    const service = new AvatarService(storage);
    const userId = await makeUser();

    await expect(service.uploadAvatar(userId, fakeJpeg)).rejects.toThrow(
      AppError,
    );
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 2MB before ever inspecting its content', async () => {
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 0);
    const storage = makeFakeStorage();
    const service = new AvatarService(storage);
    const userId = await makeUser();

    await expect(service.uploadAvatar(userId, oversized)).rejects.toThrow(
      AppError,
    );
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('persists the public avatar URLs on the user row', async () => {
    const source = await makeGpsBearingJpeg();
    const storage = makeFakeStorage();
    const service = new AvatarService(storage);
    const userId = await makeUser();

    const result = await service.uploadAvatar(userId, source);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.avatarUrl).toBe(result.avatarUrl);
    expect(user.avatarThumbnailUrl).toBe(result.avatarThumbnailUrl);
    expect(user.avatarStorageKey).toMatch(/^avatars\/.+\.jpg$/);
  });

  it('deletes the previous avatar files from storage when a new one is uploaded', async () => {
    const storage = makeFakeStorage();
    const service = new AvatarService(storage);
    const userId = await makeUser();

    await service.uploadAvatar(userId, await makeGpsBearingJpeg());
    storage.delete.mockClear();
    await service.uploadAvatar(userId, await makeGpsBearingJpeg());

    expect(storage.delete).toHaveBeenCalledTimes(2); // old main + old thumbnail
  });

  it('deleteAvatar clears the DB fields and removes the stored files', async () => {
    const storage = makeFakeStorage();
    const service = new AvatarService(storage);
    const userId = await makeUser();
    await service.uploadAvatar(userId, await makeGpsBearingJpeg());
    storage.delete.mockClear();

    await service.deleteAvatar(userId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.avatarUrl).toBeNull();
    expect(user.avatarThumbnailUrl).toBeNull();
    expect(user.avatarStorageKey).toBeNull();
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });
});
