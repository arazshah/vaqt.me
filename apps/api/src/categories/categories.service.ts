import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { prisma, RequestStatus } from '@vaqt/db';
import type { CreateCategoryInput, UpdateCategoryInput } from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { RedisService } from '../common/redis/redis.service';

const CACHE_TTL_SECONDS = 60 * 60;
const CACHE_KEY = 'categories:list';

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  order: number;
}

export interface CategoryListResult {
  items: CategoryListItem[];
  etag: string;
}

const NON_TERMINAL_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.DRAFT,
  RequestStatus.PUBLISHED,
  RequestStatus.OFFER_SELECTED,
];

@Injectable()
export class CategoriesService {
  constructor(private readonly redis: RedisService) {}

  async list(): Promise<CategoryListResult> {
    const cacheKey = this.redis.key(CACHE_KEY);
    const cached = await this.redis.client.get(cacheKey);
    if (cached !== null) {
      return {
        items: JSON.parse(cached) as CategoryListItem[],
        etag: etagFor(cached),
      };
    }

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, parentId: true, order: true },
    });

    const json = JSON.stringify(categories);
    await this.redis.client.set(cacheKey, json, 'EX', CACHE_TTL_SECONDS);
    return { items: categories, etag: etagFor(json) };
  }

  private async invalidateCache(): Promise<void> {
    await this.redis.client.del(this.redis.key(CACHE_KEY));
  }

  async create(input: CreateCategoryInput) {
    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug: input.slug,
        parentId: input.parentId ?? null,
        order: input.order ?? 0,
      },
    });
    await this.invalidateCache();
    return category;
  }

  async update(id: string, input: UpdateCategoryInput) {
    if (input.isActive === false) {
      await this.assertNoActiveRequests(id);
    }
    const category = await prisma.category.update({
      where: { id },
      data: input,
    });
    await this.invalidateCache();
    return category;
  }

  private async assertNoActiveRequests(categoryId: string): Promise<void> {
    const activeCount = await prisma.request.count({
      where: { categoryId, status: { in: NON_TERMINAL_REQUEST_STATUSES } },
    });
    if (activeCount > 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, HttpStatus.CONFLICT, {
        details: { reason: 'CATEGORY_HAS_ACTIVE_REQUESTS' },
      });
    }
  }
}

function etagFor(content: string): string {
  return `"${createHash('sha1').update(content).digest('hex')}"`;
}
