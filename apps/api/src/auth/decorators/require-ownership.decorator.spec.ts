import { Reflector } from '@nestjs/core';
import {
  RequireOwnership,
  OWNERSHIP_RESOLVER_KEY,
} from './require-ownership.decorator';
import { RequireOwnershipGuard } from '../guards/require-ownership.guard';

describe('RequireOwnership decorator', () => {
  it('attaches RequireOwnershipGuard and stores the resolver as metadata', () => {
    const resolver = () => Promise.resolve('owner-id');
    class Controller {
      @RequireOwnership(resolver)
      route() {
        return undefined;
      }
    }

    const guards = Reflect.getMetadata(
      '__guards__',
      Controller.prototype.route,
    ) as unknown[];
    expect(guards).toContain(RequireOwnershipGuard);

    const reflector = new Reflector();
    expect(
      reflector.get(OWNERSHIP_RESOLVER_KEY, Controller.prototype.route),
    ).toBe(resolver);
  });
});
