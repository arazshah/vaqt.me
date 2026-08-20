import { prisma } from '@vaqt/db';
import { RedisService } from '../common/redis/redis.service';
import { fakeConfig } from '../test-support/fake-config';
import { randomTestRedisPrefix } from '../test-support/test-db';
import { SkillsService } from './skills.service';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

describe('SkillsService (real Postgres + Redis)', () => {
  const createdSkillIds: string[] = [];
  let redis: RedisService;
  let service: SkillsService;

  beforeEach(() => {
    redis = new RedisService(
      fakeConfig({ REDIS_URL, REDIS_PREFIX: randomTestRedisPrefix() }),
    );
    service = new SkillsService(redis);
  });

  afterEach(async () => {
    await redis.client.quit();
  });

  afterAll(async () => {
    for (const id of createdSkillIds.splice(0)) {
      await prisma.skill.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  async function makeSkill(
    overrides: { isActive?: boolean } = {},
  ): Promise<string> {
    const skill = await prisma.skill.create({
      data: {
        name: 'مهارت تست',
        slug: `test-skill-${String(Date.now())}-${String(Math.random())}`,
        isActive: overrides.isActive ?? true,
      },
    });
    createdSkillIds.push(skill.id);
    return skill.id;
  }

  it('list() returns only active skills', async () => {
    const activeId = await makeSkill({ isActive: true });
    const inactiveId = await makeSkill({ isActive: false });

    const { items } = await service.list();
    const ids = items.map((i) => i.id);

    expect(ids).toContain(activeId);
    expect(ids).not.toContain(inactiveId);
  });

  it('list() caches the result in Redis with a stable ETag on repeat calls', async () => {
    await makeSkill();
    const first = await service.list();
    const second = await service.list();

    expect(second.etag).toBe(first.etag);
    const cached = await redis.client.get(redis.key('skills:list'));
    expect(cached).not.toBeNull();
  });

  it('create() invalidates the cache so a subsequent list() reflects the new skill', async () => {
    await service.list();
    const created = await service.create({
      name: 'مهارت تازه',
      slug: `fresh-skill-${String(Date.now())}`,
    });
    createdSkillIds.push(created.id);

    const { items } = await service.list();
    expect(items.map((i) => i.id)).toContain(created.id);
  });

  it('update() can deactivate a skill', async () => {
    const id = await makeSkill();
    const updated = await service.update(id, { isActive: false });
    expect(updated.isActive).toBe(false);

    const { items } = await service.list();
    expect(items.map((i) => i.id)).not.toContain(id);
  });
});
