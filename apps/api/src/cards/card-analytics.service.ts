import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import {
  addDaysToKey,
  LinkKindSchema,
  normalizeSource,
  tehranDateKey,
  type CardStatsView,
  type RecordCardEventInput,
} from '@vaqt/shared';
import { KvService } from '../common/kv/kv.service';

const VIEW_DEDUPE_SECONDS = 1800;
const EVENT_LIMIT_PER_HOUR = 120;

// The raw IP never reaches the database; in Redis it only exists hashed and
// with a short TTL, purely to stop reloads and floods from inflating counts.
const fingerprint = (ip: string) =>
  createHash('sha256').update(ip).digest('hex').slice(0, 16);

@Injectable()
export class CardAnalyticsService {
  constructor(private readonly kv: KvService) {}

  /**
   * Records one interaction. Never throws for "soft" reasons (unknown card,
   * rate limited, repeat view) so the public endpoint can't be used to probe
   * which usernames exist or to learn the limits.
   */
  async record(
    username: string,
    input: RecordCardEventInput,
    ip: string,
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') return;

    const who = fingerprint(ip);
    const limitKey = this.kv.key('card-event', user.id, who, input.type);
    const count = await this.kv.increment(limitKey, 3600);
    if (count > EVENT_LIMIT_PER_HOUR) return;

    if (input.type === 'view') {
      const first = await this.kv.setIfAbsent(
        this.kv.key('card-view', user.id, who),
        '1',
        VIEW_DEDUPE_SECONDS,
      );
      if (!first) return; // same visitor reloading
    }

    const linkKind = LinkKindSchema.safeParse(input.linkKind);
    await prisma.cardEvent.create({
      data: {
        userId: user.id,
        type: input.type,
        source: normalizeSource(input.source),
        linkKind:
          input.type === 'link_click' && linkKind.success
            ? linkKind.data
            : null,
      },
    });
  }

  async stats(userId: string, days: number): Promise<CardStatsView> {
    const now = new Date();
    const todayKey = tehranDateKey(now);
    const firstKey = addDaysToKey(todayKey, -(days - 1));
    // Start of the first Iran day in the window, as a UTC instant.
    const since = new Date(
      new Date(`${firstKey}T00:00:00.000Z`).getTime() - 210 * 60_000,
    );

    const [byType, viewsBySource, clicksByLink, daily, bookingRequests] =
      await Promise.all([
        prisma.cardEvent.groupBy({
          by: ['type'],
          where: { userId, createdAt: { gte: since } },
          _count: { _all: true },
        }),
        prisma.cardEvent.groupBy({
          by: ['source'],
          where: { userId, type: 'view', createdAt: { gte: since } },
          _count: { _all: true },
        }),
        prisma.cardEvent.groupBy({
          by: ['linkKind'],
          where: { userId, type: 'link_click', createdAt: { gte: since } },
          _count: { _all: true },
        }),
        prisma.$queryRaw<{ d: string; n: bigint }[]>`
          -- "createdAt" is a naive UTC timestamp: mark it UTC first, then
          -- convert to Tehran wall time (a bare AT TIME ZONE 'Asia/Tehran'
          -- would read it AS Tehran time and shift the day the wrong way).
          SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran', 'YYYY-MM-DD') AS d,
                 count(*) AS n
          FROM card_events
          WHERE "userId" = ${userId} AND type = 'view' AND "createdAt" >= ${since}
          GROUP BY d`,
        prisma.booking.count({
          where: { providerId: userId, createdAt: { gte: since } },
        }),
      ]);

    const total = (type: string) =>
      byType.find((t) => t.type === type)?._count._all ?? 0;
    const perDay = new Map(daily.map((r) => [r.d, Number(r.n)]));

    const bySource = viewsBySource
      .map((r) => ({ source: r.source ?? 'direct', views: r._count._all }))
      .sort((a, b) => b.views - a.views);

    return {
      days,
      views: total('view'),
      qrScans: bySource
        .filter((s) => s.source.startsWith('qr-'))
        .reduce((n, s) => n + s.views, 0),
      contactSaves: total('save_contact'),
      linkClicks: total('link_click'),
      bookClicks: total('book_click'),
      bookingRequests,
      bySource,
      byLink: clicksByLink
        .flatMap((r) => {
          const kind = LinkKindSchema.safeParse(r.linkKind);
          return kind.success
            ? [{ kind: kind.data, clicks: r._count._all }]
            : [];
        })
        .sort((a, b) => b.clicks - a.clicks),
      daily: Array.from({ length: days }, (_, i) => {
        const date = addDaysToKey(firstKey, i);
        return { date, views: perDay.get(date) ?? 0 };
      }),
    };
  }
}
