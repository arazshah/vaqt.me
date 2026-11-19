import { prisma } from '@vaqt/db';
import { ADMIN_LOGIN } from '@vaqt/shared';
import { AuditService } from '../auth/audit/audit.service';
import { PasswordService } from '../auth/password/password.service';
import { KvService } from '../common/kv/kv.service';
import { fakeConfig } from '../test-support/fake-config';
import { AdminSetupService } from './admin-setup.service';

// The "admin" account is a single global row, so these tests own it: they
// run serially in this file and remove it afterwards.
describe('AdminSetupService — built-in admin account (real Postgres)', () => {
  const passwords = new PasswordService();
  const make = (env: Record<string, string> = {}) =>
    new AdminSetupService(
      passwords,
      new AuditService(),
      new KvService(),
      fakeConfig({ WEB_ORIGIN: 'https://vaqt.me', ...env }),
    );

  async function adminRow() {
    return prisma.user.findUnique({ where: { email: ADMIN_LOGIN } });
  }
  async function removeAdmin() {
    const row = await adminRow();
    if (!row) return;
    await prisma.session.deleteMany({ where: { userId: row.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: row.id } });
    await prisma.user.delete({ where: { id: row.id } });
  }

  beforeEach(removeAdmin);
  afterAll(removeAdmin);

  it('creates the admin account with a temporary password that must be changed', async () => {
    const temp = await make().ensureAdminAccount();
    expect(temp).toMatch(/^[a-z0-9]{15}$/);
    const row = await adminRow();
    expect(row).toMatchObject({
      systemRole: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: true,
    });
    expect(await passwords.verify(temp ?? '', row?.passwordHash ?? null)).toBe(
      true,
    );
  });

  it('issues a fresh temporary password on every boot until it is changed', async () => {
    const first = await make().ensureAdminAccount();
    const second = await make().ensureAdminAccount();
    expect(second).not.toBe(first);
    const row = await adminRow();
    expect(await passwords.verify(first ?? '', row?.passwordHash ?? null)).toBe(
      false,
    );
  });

  it('does nothing once the owner has chosen a password', async () => {
    await make().ensureAdminAccount();
    await prisma.user.update({
      where: { email: ADMIN_LOGIN },
      data: { mustChangePassword: false },
    });
    expect(await make().ensureAdminAccount()).toBeNull();
  });

  it('uses ADMIN_INITIAL_PASSWORD when it is strong enough', async () => {
    await make({ ADMIN_INITIAL_PASSWORD: 'Start1234x' }).ensureAdminAccount();
    const row = await adminRow();
    expect(
      await passwords.verify('Start1234x', row?.passwordHash ?? null),
    ).toBe(true);
  });

  it('ignores a weak ADMIN_INITIAL_PASSWORD', async () => {
    const temp = await make({
      ADMIN_INITIAL_PASSWORD: 'admin',
    }).ensureAdminAccount();
    expect(temp).not.toBe('admin');
    const row = await adminRow();
    expect(await passwords.verify('admin', row?.passwordHash ?? null)).toBe(
      false,
    );
  });

  it('re-promotes and reactivates a demoted or suspended admin row on reset', async () => {
    await make().ensureAdminAccount();
    await prisma.user.update({
      where: { email: ADMIN_LOGIN },
      data: { systemRole: 'USER', status: 'SUSPENDED' },
    });
    await make().ensureAdminAccount();
    expect(await adminRow()).toMatchObject({
      systemRole: 'ADMIN',
      status: 'ACTIVE',
    });
  });
});
