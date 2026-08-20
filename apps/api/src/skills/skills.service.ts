import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import type { CreateSkillInput, UpdateSkillInput } from '@vaqt/shared';
import { RedisService } from '../common/redis/redis.service';

const CACHE_TTL_SECONDS = 60 * 60;
const CACHE_KEY = 'skills:list';

export interface SkillListItem {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
}

export interface SkillListResult {
  items: SkillListItem[];
  etag: string;
}

@Injectable()
export class SkillsService {
  constructor(private readonly redis: RedisService) {}

  async list(): Promise<SkillListResult> {
    const cacheKey = this.redis.key(CACHE_KEY);
    const cached = await this.redis.client.get(cacheKey);
    if (cached !== null) {
      return {
        items: JSON.parse(cached) as SkillListItem[],
        etag: etagFor(cached),
      };
    }

    const skills = await prisma.skill.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, categoryId: true },
    });

    const json = JSON.stringify(skills);
    await this.redis.client.set(cacheKey, json, 'EX', CACHE_TTL_SECONDS);
    return { items: skills, etag: etagFor(json) };
  }

  private async invalidateCache(): Promise<void> {
    await this.redis.client.del(this.redis.key(CACHE_KEY));
  }

  async create(input: CreateSkillInput) {
    const skill = await prisma.skill.create({
      data: {
        name: input.name,
        slug: input.slug,
        categoryId: input.categoryId ?? null,
      },
    });
    await this.invalidateCache();
    return skill;
  }

  async update(id: string, input: UpdateSkillInput) {
    const skill = await prisma.skill.update({ where: { id }, data: input });
    await this.invalidateCache();
    return skill;
  }
}

function etagFor(content: string): string {
  return `"${createHash('sha1').update(content).digest('hex')}"`;
}
