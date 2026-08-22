import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { prisma } from '@vaqt/db';
import { AppModule } from '../app.module';
import { createOriginCheckMiddleware } from '../common/middleware/origin-check.middleware';
import { TokenService } from '../auth/session/token.service';
import { createTestUser, cleanupTestUser } from '../test-support/test-db';

// Real HTTP, through the actual guard/pipe/filter stack the app boots with
// in main.ts — every other "controller test" in this repo calls the
// controller method directly, bypassing all of that, which is exactly how
// a method-scoped @UsePipes() silently corrupting @CurrentUser() (see
// users.controller.ts) went undetected. This mirrors bootstrap() closely
// enough to exercise the real bug: cookieParser, origin-check middleware,
// the global prefix, and the global ValidationPipe are all still wired up
// here exactly as main.ts wires them today.
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';

describe('UsersController body validation (real HTTP, real Postgres + Redis)', () => {
  let app: INestApplication;
  let userId: string;
  let accessToken: string;
  const createdSkillIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(createOriginCheckMiddleware(WEB_ORIGIN));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const user = await createTestUser({});
    userId = user.id;

    const tokens = moduleRef.get(TokenService);
    accessToken = tokens.signAccessToken({ sub: userId, sid: 'test-session' });
  });

  afterAll(async () => {
    for (const id of createdSkillIds.splice(0)) {
      await prisma.userSkill.deleteMany({ where: { userId, skillId: id } });
      await prisma.skill.deleteMany({ where: { id } });
    }
    await cleanupTestUser(userId);
    await app.close();
  });

  it('PATCH /users/me actually persists displayName to Postgres (not just a non-error response)', async () => {
    const distinctiveName = `کاربر-تست-${String(Date.now())}-${String(Math.random()).slice(2, 8)}`;

    const response = await request(app.getHttpServer() as Server)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Origin', WEB_ORIGIN)
      .send({ displayName: distinctiveName });

    expect(response.status).toBe(200);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.displayName).toBe(distinctiveName);
  });

  it('PUT /users/me/skills actually persists the UserSkill rows to Postgres (not just a non-error response)', async () => {
    const skill = await prisma.skill.create({
      data: {
        name: `مهارت تست ${String(Date.now())}`,
        slug: `test-skill-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdSkillIds.push(skill.id);

    const response = await request(app.getHttpServer() as Server)
      .put('/api/v1/users/me/skills')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Origin', WEB_ORIGIN)
      .send({ skillIds: [skill.id] });

    expect(response.status).toBe(200);

    const linked = await prisma.userSkill.findMany({ where: { userId } });
    expect(linked.map((l) => l.skillId)).toEqual([skill.id]);
  });
});
