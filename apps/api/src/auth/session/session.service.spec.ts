import type { ConfigService } from '@nestjs/config';
import { prisma } from '@vaqt/db';
import { AuthConfigService } from '../auth.config';
import { AuditService } from '../audit/audit.service';
import {
  cleanupTestUser,
  createTestUser,
  requireNonNull,
} from '../../test-support/test-db';
import { fakeConfig } from '../../test-support/fake-config';
import {
  SessionInvalidError,
  SessionReuseDetectedError,
  SessionService,
} from './session.service';
import { TokenService } from './token.service';
import { JwtService } from '@nestjs/jwt';

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return fakeConfig({
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    ...overrides,
  });
}

function makeService(configOverrides: Record<string, string> = {}): {
  service: SessionService;
  tokens: TokenService;
} {
  const config = makeConfig(configOverrides);
  const authConfig = new AuthConfigService(config);
  const tokens = new TokenService(new JwtService(), config, authConfig);
  const service = new SessionService(tokens, authConfig, new AuditService());
  return { service, tokens };
}

const DEVICE = { userAgent: 'jest-test-agent', ip: '203.0.113.9' };

describe('SessionService', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    for (const id of createdUserIds.splice(0)) {
      await cleanupTestUser(id);
    }
    await prisma.$disconnect();
  });

  async function makeUser(): Promise<string> {
    const user = await createTestUser({});
    createdUserIds.push(user.id);
    return user.id;
  }

  it('createSession issues an access and refresh token for a fresh family', async () => {
    const { service, tokens } = makeService();
    const userId = await makeUser();

    const issued = await service.createSession(userId, DEVICE);
    const access = tokens.verifyAccessToken(issued.accessToken);
    const refresh = tokens.verifyRefreshToken(issued.refreshToken);

    expect(access.sub).toBe(userId);
    expect(refresh.sub).toBe(userId);
    expect(access.sid).toBe(refresh.sid);

    const row = await prisma.session.findUnique({ where: { id: access.sid } });
    expect(row?.userId).toBe(userId);
    expect(row?.revokedAt).toBeNull();
  });

  it('rotateSession issues a new token pair and revokes the old session row', async () => {
    const { service, tokens } = makeService();
    const userId = await makeUser();

    const first = await service.createSession(userId, DEVICE);
    const rotated = await service.rotateSession(first.refreshToken, DEVICE);

    const firstPayload = tokens.verifyRefreshToken(first.refreshToken);
    const rotatedPayload = tokens.verifyRefreshToken(rotated.refreshToken);

    expect(rotatedPayload.sid).not.toBe(firstPayload.sid);

    const oldRow = await prisma.session.findUnique({
      where: { id: firstPayload.sid },
    });
    expect(oldRow?.revokedAt).not.toBeNull();
    expect(oldRow?.replacedById).toBe(rotatedPayload.sid);

    const newRow = await prisma.session.findUnique({
      where: { id: rotatedPayload.sid },
    });
    expect(newRow?.revokedAt).toBeNull();
  });

  it('preserves the same familyId across a rotation', async () => {
    const { service, tokens } = makeService();
    const userId = await makeUser();

    const first = await service.createSession(userId, DEVICE);
    const rotated = await service.rotateSession(first.refreshToken, DEVICE);

    const firstPayload = tokens.verifyRefreshToken(first.refreshToken);
    const rotatedPayload = tokens.verifyRefreshToken(rotated.refreshToken);

    const oldRow = await prisma.session.findUnique({
      where: { id: firstPayload.sid },
    });
    const newRow = await prisma.session.findUnique({
      where: { id: rotatedPayload.sid },
    });
    expect(newRow?.familyId).toBe(oldRow?.familyId);
  });

  it('replaying an already-rotated (revoked) refresh token detects reuse and revokes the whole family', async () => {
    const { service, tokens } = makeService();
    const userId = await makeUser();

    const first = await service.createSession(userId, DEVICE);
    const second = await service.rotateSession(first.refreshToken, DEVICE);
    const secondPayload = tokens.verifyRefreshToken(second.refreshToken);

    await expect(
      service.rotateSession(first.refreshToken, DEVICE),
    ).rejects.toThrow(SessionReuseDetectedError);

    const secondRow = requireNonNull(
      await prisma.session.findUnique({ where: { id: secondPayload.sid } }),
      'expected the rotated session row to exist',
    );
    const familyRows = await prisma.session.findMany({
      where: { familyId: secondRow.familyId },
    });
    expect(familyRows.length).toBeGreaterThanOrEqual(2);
    expect(familyRows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('writes a high-severity AuditLog entry when reuse is detected', async () => {
    const { service } = makeService();
    const userId = await makeUser();

    const first = await service.createSession(userId, DEVICE);
    await service.rotateSession(first.refreshToken, DEVICE);
    await expect(
      service.rotateSession(first.refreshToken, DEVICE),
    ).rejects.toThrow(SessionReuseDetectedError);

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: userId, action: 'auth.session.reuse_detected' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).not.toBeNull();
    expect((entry?.meta as Record<string, unknown> | null)?.severity).toBe(
      'high',
    );
  });

  it('rejects a refresh token with a bad signature', async () => {
    const { service } = makeService();
    await expect(
      service.rotateSession('not-a-real-token', DEVICE),
    ).rejects.toThrow(SessionInvalidError);
  });

  it('rejects a refresh token whose session id does not exist', async () => {
    const { service, tokens } = makeService();
    const userId = await makeUser();
    const forged = tokens.signRefreshToken({
      sub: userId,
      sid: 'nonexistent-session-id',
    });
    await expect(service.rotateSession(forged, DEVICE)).rejects.toThrow(
      SessionInvalidError,
    );
  });

  it('rejects a refresh token whose sub does not match the session owner', async () => {
    const { service, tokens } = makeService();
    const userId = await makeUser();
    const otherUserId = await makeUser();

    const issued = await service.createSession(userId, DEVICE);
    const payload = tokens.verifyRefreshToken(issued.refreshToken);
    const mismatched = tokens.signRefreshToken({
      sub: otherUserId,
      sid: payload.sid,
    });

    await expect(service.rotateSession(mismatched, DEVICE)).rejects.toThrow(
      SessionInvalidError,
    );
  });

  it('rejects a validly-signed, non-expired, non-revoked token whose bytes do not match the stored hash', async () => {
    // Simulates the stored hash going stale relative to what was actually
    // issued (defense in depth beyond signature + sid lookup) by
    // corrupting the row directly rather than racing JWT's 1-second `iat`
    // resolution, which would otherwise make two same-payload tokens
    // signed in the same second byte-identical.
    const { service, tokens } = makeService();
    const userId = await makeUser();

    const issued = await service.createSession(userId, DEVICE);
    const payload = tokens.verifyRefreshToken(issued.refreshToken);
    await prisma.session.update({
      where: { id: payload.sid },
      data: { refreshTokenHash: '0'.repeat(64) },
    });

    await expect(
      service.rotateSession(issued.refreshToken, DEVICE),
    ).rejects.toThrow(SessionInvalidError);
  });

  it('rejects an expired (but not revoked) session', async () => {
    const { service, tokens } = makeService({ JWT_REFRESH_TTL_SECONDS: '1' });
    const userId = await makeUser();

    const issued = await service.createSession(userId, DEVICE);
    const payload = tokens.verifyRefreshToken(issued.refreshToken);
    await prisma.session.update({
      where: { id: payload.sid },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      service.rotateSession(issued.refreshToken, DEVICE),
    ).rejects.toThrow(SessionInvalidError);
  });

  it('revokeSession revokes exactly the targeted session', async () => {
    const { service, tokens } = makeService();
    const userId = await makeUser();

    const issued = await service.createSession(userId, DEVICE);
    const payload = tokens.verifyRefreshToken(issued.refreshToken);

    await service.revokeSession(payload.sid);
    const row = await prisma.session.findUnique({ where: { id: payload.sid } });
    expect(row?.revokedAt).not.toBeNull();
  });

  it('revokeSession is a no-op on an already-revoked session (idempotent)', async () => {
    const { service, tokens } = makeService();
    const userId = await makeUser();

    const issued = await service.createSession(userId, DEVICE);
    const payload = tokens.verifyRefreshToken(issued.refreshToken);

    await service.revokeSession(payload.sid);
    const firstRevokedAt = (
      await prisma.session.findUnique({ where: { id: payload.sid } })
    )?.revokedAt;

    await service.revokeSession(payload.sid);
    const secondRevokedAt = (
      await prisma.session.findUnique({ where: { id: payload.sid } })
    )?.revokedAt;

    expect(secondRevokedAt?.getTime()).toBe(firstRevokedAt?.getTime());
  });

  it('revokeAllSessionsForUser revokes every active session across families', async () => {
    const { service } = makeService();
    const userId = await makeUser();

    const a = await service.createSession(userId, DEVICE);
    const b = await service.createSession(userId, {
      ...DEVICE,
      userAgent: 'second-device',
    });

    await service.revokeAllSessionsForUser(userId);

    const rows = await prisma.session.findMany({ where: { userId } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    void a;
    void b;
  });
});
