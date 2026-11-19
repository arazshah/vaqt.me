import { HttpStatus, Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import type { WalletEntryView, WalletStatusView } from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { RedisService } from '../common/redis/redis.service';

const EXCHANGES_PER_DAY = 20;

const notFound = () => new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

@Injectable()
export class WalletService {
  constructor(private readonly redis: RedisService) {}

  private async findCardOwner(username: string) {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') throw notFound();
    return user;
  }

  async list(userId: string): Promise<WalletEntryView[]> {
    const rows = await prisma.savedCard.findMany({
      where: {
        ownerId: userId,
        cardUser: { status: 'ACTIVE', username: { not: null } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        cardUser: {
          select: {
            username: true,
            displayName: true,
            headline: true,
            city: true,
            avatarUrl: true,
          },
        },
      },
    });
    return rows.flatMap((r) =>
      r.cardUser.username
        ? [
            {
              username: r.cardUser.username,
              displayName: r.cardUser.displayName,
              headline: r.cardUser.headline,
              city: r.cardUser.city,
              avatarUrl: r.cardUser.avatarUrl,
              source:
                r.source === 'exchanged'
                  ? ('exchanged' as const)
                  : ('saved' as const),
              savedAt: r.createdAt.toISOString(),
            },
          ]
        : [],
    );
  }

  async status(userId: string, username: string): Promise<WalletStatusView> {
    const target = await this.findCardOwner(username);
    const row = await prisma.savedCard.findUnique({
      where: { ownerId_cardUserId: { ownerId: userId, cardUserId: target.id } },
    });
    return { saved: row !== null, exchanged: row?.source === 'exchanged' };
  }

  /** Keep someone's card in my wallet. Idempotent. */
  async save(userId: string, username: string): Promise<WalletStatusView> {
    const target = await this.findCardOwner(username);
    if (target.id === userId) {
      throw new AppError(ErrorCode.WALLET_OWN_CARD, HttpStatus.FORBIDDEN);
    }
    await prisma.savedCard.upsert({
      where: { ownerId_cardUserId: { ownerId: userId, cardUserId: target.id } },
      create: { ownerId: userId, cardUserId: target.id },
      update: {},
    });
    return this.status(userId, username);
  }

  /**
   * Two-way swap: each ends up with the other's card. Needs the caller to
   * have a public card of their own (otherwise there is nothing to give) and
   * is capped per day so it can't be used to push a card into many wallets.
   */
  async exchange(userId: string, username: string): Promise<WalletStatusView> {
    const target = await this.findCardOwner(username);
    if (target.id === userId) {
      throw new AppError(ErrorCode.WALLET_OWN_CARD, HttpStatus.FORBIDDEN);
    }
    const me = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true },
    });
    if (!me.username) {
      throw new AppError(
        ErrorCode.CARD_REQUIRED_FOR_EXCHANGE,
        HttpStatus.CONFLICT,
      );
    }

    const already = await prisma.savedCard.findUnique({
      where: { ownerId_cardUserId: { ownerId: target.id, cardUserId: userId } },
    });
    // Re-sending to someone who already holds my card costs nothing and
    // doesn't count against the cap.
    if (already?.source !== 'exchanged') {
      const day = new Date().toISOString().slice(0, 10);
      const key = this.redis.key('card-exchange', userId, day);
      const used = await this.redis.client.incr(key);
      if (used === 1) await this.redis.client.expire(key, 86_400);
      if (used > EXCHANGES_PER_DAY) {
        throw new AppError(
          ErrorCode.EXCHANGE_LIMIT_REACHED,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await prisma.$transaction([
      prisma.savedCard.upsert({
        where: {
          ownerId_cardUserId: { ownerId: userId, cardUserId: target.id },
        },
        create: { ownerId: userId, cardUserId: target.id, source: 'exchanged' },
        update: { source: 'exchanged' },
      }),
      prisma.savedCard.upsert({
        where: {
          ownerId_cardUserId: { ownerId: target.id, cardUserId: userId },
        },
        create: { ownerId: target.id, cardUserId: userId, source: 'exchanged' },
        update: { source: 'exchanged' },
      }),
    ]);
    return this.status(userId, username);
  }

  /** Removes only MY copy; the other person's wallet is never touched. */
  async remove(userId: string, username: string): Promise<void> {
    const target = await this.findCardOwner(username);
    await prisma.savedCard.deleteMany({
      where: { ownerId: userId, cardUserId: target.id },
    });
  }
}
