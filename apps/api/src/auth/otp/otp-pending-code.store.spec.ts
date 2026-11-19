import { randomTestPhone } from '../../test-support/test-db';
import { KvService } from '../../common/kv/kv.service';
import { OtpPendingCodeStore } from './otp-pending-code.store';

function makeStore(): { store: OtpPendingCodeStore; redis: KvService } {
  const redis = new KvService();
  return { store: new OtpPendingCodeStore(redis), redis };
}

describe('OtpPendingCodeStore', () => {
  let phone: string;
  beforeEach(() => {
    phone = randomTestPhone();
  });

  it('set() then get() round-trips the code', async () => {
    const created = makeStore();
    await created.store.set(phone, '12345', 60);
    await expect(created.store.get(phone)).resolves.toBe('12345');
  });

  it('set() with ttlSeconds <= 0 is a no-op (never writes to Redis)', async () => {
    const created = makeStore();
    await created.store.set(phone, '12345', 0);
    await expect(created.store.get(phone)).resolves.toBeNull();
  });

  it('set() with a negative ttlSeconds is also a no-op', async () => {
    const created = makeStore();
    await created.store.set(phone, '12345', -5);
    await expect(created.store.get(phone)).resolves.toBeNull();
  });

  it('get() returns null when nothing was ever set for the phone', async () => {
    const created = makeStore();
    await expect(created.store.get(randomTestPhone())).resolves.toBeNull();
  });

  it('clear() removes the stored code', async () => {
    const created = makeStore();
    await created.store.set(phone, '12345', 60);
    await created.store.clear(phone);
    await expect(created.store.get(phone)).resolves.toBeNull();
  });
});
