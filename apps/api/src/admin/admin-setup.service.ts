import { randomBytes } from 'crypto';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@vaqt/db';
import { ADMIN_LOGIN, passwordSchema } from '@vaqt/shared';
import { AuditService } from '../auth/audit/audit.service';
import { PasswordService } from '../auth/password/password.service';
import { KvService } from '../common/kv/kv.service';

/** Letters and digits only, so it can't be misread when copied from a log. */
function randomTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  // passwordSchema wants at least one letter and one digit.
  return `${out.slice(0, 7)}${String(bytes[0] % 10)}${out.slice(7)}`;
}

/**
 * The built-in administrator account: login name "admin".
 *
 * On every boot, while that account has no password of its owner's
 * choosing (it does not exist yet, or still has its temporary password), a
 * temporary password is set and printed in the server log — readable only
 * by whoever operates the server. ADMIN_INITIAL_PASSWORD, when set to a
 * valid password, is used instead of a random one. The first sign-in must
 * replace it (RolesGuard keeps the panel closed until then). Once replaced,
 * this does nothing.
 */
@Injectable()
export class AdminSetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSetupService.name);

  constructor(
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly kv: KvService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureAdminAccount();
    } catch (err) {
      this.logger.error(
        `could not prepare the admin account: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Returns the temporary password it set, or null if nothing changed. */
  async ensureAdminAccount(): Promise<string | null> {
    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_LOGIN },
    });
    if (existing?.passwordHash && !existing.mustChangePassword) return null;

    const fromEnv = this.config.get<string>('ADMIN_INITIAL_PASSWORD');
    const envOk = !!fromEnv && passwordSchema.safeParse(fromEnv).success;
    if (fromEnv && !envOk) {
      this.logger.warn(
        'ADMIN_INITIAL_PASSWORD is too weak (8+ chars, letters and digits); using a random one',
      );
    }
    const password = envOk ? fromEnv : randomTempPassword();
    const passwordHash = await this.passwords.hash(password);

    const user = await prisma.user.upsert({
      where: { email: ADMIN_LOGIN },
      create: {
        email: ADMIN_LOGIN,
        displayName: 'مدیر سامانه',
        systemRole: 'ADMIN',
        passwordHash,
        mustChangePassword: true,
      },
      update: {
        systemRole: 'ADMIN',
        status: 'ACTIVE',
        passwordHash,
        mustChangePassword: true,
      },
    });
    // A previous temporary password's sessions must not survive the reset.
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.kv.del(this.kv.key('system-role', user.id));
    await this.audit.log({
      actorId: null,
      action: existing ? 'admin.account.reset' : 'admin.account.created',
      entityType: 'User',
      entityId: user.id,
      severity: 'high',
    });

    const origin =
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    this.logger.warn(
      [
        '',
        '==================== ADMIN SIGN-IN ====================',
        `  Open:      ${origin}/login`,
        `  Login:     ${ADMIN_LOGIN}`,
        envOk
          ? '  Password:  the value of ADMIN_INITIAL_PASSWORD'
          : `  Password:  ${password}`,
        '  This password is temporary: you must change it at first',
        '  sign-in. Until then a new one is printed on every start.',
        '=======================================================',
      ].join('\n'),
    );
    return password;
  }
}
