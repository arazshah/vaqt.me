import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthenticatedRequest } from '../auth-request';
import {
  OWNERSHIP_RESOLVER_KEY,
  type OwnershipResolver,
} from '../decorators/require-ownership.decorator';
import { RequireOwnershipGuard } from './require-ownership.guard';

function setup(
  request: Partial<AuthenticatedRequest>,
  resolver: OwnershipResolver | undefined,
): { guard: RequireOwnershipGuard; context: ExecutionContext } {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'get').mockReturnValue(resolver);
  const guard = new RequireOwnershipGuard(reflector);
  const context = {
    getHandler: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe('RequireOwnershipGuard', () => {
  it('throws when used without a resolver (decorator misuse)', async () => {
    const { guard, context } = setup(
      { user: { sub: 'user-1', sid: 's' } },
      undefined,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      '@RequireOwnership() guard active without a resolver — did you forget the decorator argument?',
    );
  });

  it('throws UNAUTHORIZED when there is no authenticated user', async () => {
    const resolver: OwnershipResolver = jest.fn().mockResolvedValue('owner-1');
    const { guard, context } = setup({}, resolver);
    await expect(guard.canActivate(context)).rejects.toThrow(AppError);
  });

  it('throws NOT_FOUND when the resolver returns null', async () => {
    const resolver: OwnershipResolver = jest.fn().mockResolvedValue(null);
    const { guard, context } = setup(
      { user: { sub: 'user-1', sid: 's' } },
      resolver,
    );
    try {
      await guard.canActivate(context);
      throw new Error('expected canActivate to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.NOT_FOUND);
    }
  });

  it('throws FORBIDDEN when the resolved owner differs from the authenticated user', async () => {
    const resolver: OwnershipResolver = jest
      .fn()
      .mockResolvedValue('someone-else');
    const { guard, context } = setup(
      { user: { sub: 'user-1', sid: 's' } },
      resolver,
    );
    try {
      await guard.canActivate(context);
      throw new Error('expected canActivate to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('allows when the resolved owner matches the authenticated user', async () => {
    const resolver: OwnershipResolver = jest.fn().mockResolvedValue('user-1');
    const { guard, context } = setup(
      { user: { sub: 'user-1', sid: 's' } },
      resolver,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('OWNERSHIP_RESOLVER_KEY is a stable, importable metadata key', () => {
    expect(typeof OWNERSHIP_RESOLVER_KEY).toBe('string');
  });
});
