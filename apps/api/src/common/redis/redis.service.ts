import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Atomic sliding-window check: ZREMRANGEBYSCORE + ZADD + ZCARD + EXPIRE +
// (on reject) ZRANGE all happen as one EVAL, so concurrent callers can never
// race between the count read and the decision — the four-round-trip
// version this replaced could let more than `limit` requests through under
// concurrent load.
// KEYS[1] = sorted set key
// ARGV[1] = now (ms)  ARGV[2] = windowMs  ARGV[3] = member
// ARGV[4] = limit      ARGV[5] = windowSeconds (for EXPIRE)
// returns { allowed (1|0), retryAfterSeconds }
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local member = ARGV[3]
local limit = tonumber(ARGV[4])
local windowSeconds = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
redis.call('ZADD', key, now, member)
local count = redis.call('ZCARD', key)
redis.call('EXPIRE', key, windowSeconds)

if count <= limit then
  return {1, 0}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = now
if #oldest >= 2 then
  oldestScore = tonumber(oldest[2])
end
local retryAfter = math.ceil((oldestScore + windowMs - now) / 1000)
if retryAfter < 1 then
  retryAfter = 1
end
return {0, retryAfter}
`;

interface SlidingWindowCommand {
  slidingWindow(
    key: string,
    now: number,
    windowMs: number,
    member: string,
    limit: number,
    windowSeconds: number,
  ): Promise<[number, number]>;
}

type RedisWithCommands = Redis & SlidingWindowCommand;

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: RedisWithCommands;
  private readonly prefix: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.prefix = config.get<string>('REDIS_PREFIX') ?? '';
    this.client = new Redis(url) as RedisWithCommands;
    this.client.defineCommand('slidingWindow', {
      numberOfKeys: 1,
      lua: SLIDING_WINDOW_LUA,
    });
  }

  key(...parts: string[]): string {
    return `${this.prefix}${parts.join(':')}`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
