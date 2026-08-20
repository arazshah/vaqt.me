import { RequireVerifiedPhone } from './require-verified-phone.decorator';
import { RequireVerifiedPhoneGuard } from '../guards/require-verified-phone.guard';

describe('RequireVerifiedPhone decorator', () => {
  it('attaches RequireVerifiedPhoneGuard via @UseGuards metadata', () => {
    class Controller {
      @RequireVerifiedPhone()
      route() {
        return undefined;
      }
    }
    const guards = Reflect.getMetadata(
      '__guards__',
      Controller.prototype.route,
    ) as unknown[];
    expect(guards).toContain(RequireVerifiedPhoneGuard);
  });
});
