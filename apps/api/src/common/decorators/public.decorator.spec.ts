import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public decorator', () => {
  it('sets IS_PUBLIC_KEY metadata to true on a method', () => {
    class Controller {
      @Public()
      route() {
        return undefined;
      }
    }
    const reflector = new Reflector();
    expect(reflector.get(IS_PUBLIC_KEY, Controller.prototype.route)).toBe(true);
  });

  it('a route without @Public() has no such metadata', () => {
    class Controller {
      route() {
        return undefined;
      }
    }
    const reflector = new Reflector();
    expect(
      reflector.get(IS_PUBLIC_KEY, Controller.prototype.route),
    ).toBeUndefined();
  });
});
