import type { AccessTokenPayload } from '../auth/session/token.service';
import type { AvatarService } from './avatar.service';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

function makeUsers(): jest.Mocked<UsersService> {
  return {
    getMe: jest.fn(),
    updateMe: jest.fn(),
    putSkills: jest.fn(),
    getPublicProfile: jest.fn(),
  };
}

function makeAvatars(): jest.Mocked<AvatarService> {
  return {
    uploadAvatar: jest.fn(),
    deleteAvatar: jest.fn(),
  } as unknown as jest.Mocked<AvatarService>;
}

const owner: AccessTokenPayload = { sub: 'owner-1', sid: 'session-1' };

describe('UsersController', () => {
  it('getMe always uses the CurrentUser id from the token, never a client-supplied id', async () => {
    const users = makeUsers();
    const controller = new UsersController(users, makeAvatars());

    await controller.getMe(owner);

    expect(users.getMe).toHaveBeenCalledWith('owner-1');
    expect(users.getMe).toHaveBeenCalledTimes(1);
  });

  it('updateMe writes to the current user, not an id from the request body', async () => {
    const users = makeUsers();
    const controller = new UsersController(users, makeAvatars());

    await controller.updateMe(owner, { displayName: 'نام جدید' });

    expect(users.updateMe).toHaveBeenCalledWith('owner-1', {
      displayName: 'نام جدید',
    });
  });

  it('putMySkills replaces skills for the current user only', async () => {
    const users = makeUsers();
    const controller = new UsersController(users, makeAvatars());

    await controller.putMySkills(owner, { skillIds: ['s1', 's2'] });

    expect(users.putSkills).toHaveBeenCalledWith('owner-1', ['s1', 's2']);
  });

  it('uploadAvatar delegates to AvatarService with the current user id and the file buffer', async () => {
    const avatars = makeAvatars();
    const controller = new UsersController(makeUsers(), avatars);
    const file = {
      buffer: Buffer.from('fake-image-bytes'),
    } as Express.Multer.File;

    await controller.uploadAvatar(owner, file);

    expect(avatars.uploadAvatar).toHaveBeenCalledWith('owner-1', file.buffer);
  });

  it('deleteAvatar delegates to AvatarService with the current user id', async () => {
    const avatars = makeAvatars();
    const controller = new UsersController(makeUsers(), avatars);

    await controller.deleteAvatar(owner);

    expect(avatars.deleteAvatar).toHaveBeenCalledWith('owner-1');
  });

  it('getById reads the public profile for the id in the URL param, regardless of who is asking (any logged-in user, per the global JwtAuthGuard)', async () => {
    const users = makeUsers();
    const controller = new UsersController(users, makeAvatars());

    await controller.getById('other-user-id');

    expect(users.getPublicProfile).toHaveBeenCalledWith('other-user-id');
  });
});
