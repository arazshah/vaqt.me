import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
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
  const storage = {
    save: jest.fn(),
    delete: jest.fn(),
    publicUrl: jest.fn(),
  };
  const service = new AvatarService(storage);

  it('boots (onModuleInit does not throw)', async () => {
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('uploadAvatar answers 503 IMAGE_PROCESSING_UNAVAILABLE and stores nothing', async () => {
    const error: unknown = await service.uploadAvatar('u1', PNG_1X1).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).getStatus()).toBe(503);
    expect((error as AppError).getResponse()).toMatchObject({
      code: ErrorCode.IMAGE_PROCESSING_UNAVAILABLE,
    });
    expect(storage.save).not.toHaveBeenCalled();
  });
});
