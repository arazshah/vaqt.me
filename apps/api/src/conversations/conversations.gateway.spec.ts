import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { prisma, RequestStatus } from '@vaqt/db';
import { AppModule } from '../app.module';
import { TokenService } from '../auth/session/token.service';
import { RedisService } from '../common/redis/redis.service';
import { createTestUser, cleanupTestUser } from '../test-support/test-db';
import { OffersService } from '../offers/offers.service';
import { ConversationsGateway } from './conversations.gateway';

// Real HTTP + real WebSocket, through the actual gateway/guard stack — same
// discipline as users.body-validation.e2e.spec.ts, extended to cover the
// Socket.IO layer that only a fully booted app (not a directly-instantiated
// service/gateway) can exercise: cookie parsing on the WS handshake, the
// IoAdapter actually attached to the real HTTP server, and a real
// REST-write -> real-broadcast round trip.
describe('ConversationsGateway (real Postgres/Redis, real WebSocket)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tokens: TokenService;
  let redis: RedisService;
  let offers: OffersService;
  let gateway: ConversationsGateway;

  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdRequestIds: string[] = [];
  const createdOfferIds: string[] = [];
  const createdConversationIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.listen(0);

    const httpServer = app.getHttpServer() as Server;
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${String(address.port)}`;

    tokens = moduleRef.get(TokenService);
    redis = moduleRef.get(RedisService);
    offers = moduleRef.get(OffersService);
    gateway = moduleRef.get(ConversationsGateway);
  });

  afterAll(async () => {
    for (const id of createdConversationIds.splice(0)) {
      await prisma.message.deleteMany({ where: { conversationId: id } });
      await prisma.conversation.deleteMany({ where: { id } });
    }
    for (const id of createdOfferIds.splice(0)) {
      await prisma.offer.deleteMany({ where: { id } });
    }
    for (const id of createdRequestIds.splice(0)) {
      await prisma.request.deleteMany({ where: { id } });
    }
    for (const id of createdSkillIds.splice(0)) {
      await prisma.userSkill.deleteMany({ where: { skillId: id } });
      await prisma.skill.deleteMany({ where: { id } });
    }
    for (const id of createdCategoryIds.splice(0)) {
      await prisma.category.deleteMany({ where: { id } });
    }
    for (const id of createdUserIds.splice(0)) {
      await cleanupTestUser(id);
    }
    // Nest's IoAdapter attaches a socket.io Server to the app's HTTP
    // server, but app.close() alone doesn't reliably tear down engine.io's
    // internal ping timer — close the io Server explicitly first so the
    // process can actually exit after the suite finishes.
    await new Promise<void>((resolve) => {
      void gateway.server.close(() => {
        resolve();
      });
    });
    await app.close();
    await prisma.$disconnect();
  });

  function accessCookieFor(userId: string): string {
    const token = tokens.signAccessToken({ sub: userId, sid: 'test-session' });
    return `access_token=${token}`;
  }

  async function makeCompleteProvider(): Promise<string> {
    const user = await createTestUser({});
    createdUserIds.push(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { bio: 'یک بیوگرافی کامل.' },
    });
    const skill = await prisma.skill.create({
      data: {
        name: 'مهارت تست گیت‌وی',
        slug: `test-skill-gw-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdSkillIds.push(skill.id);
    await prisma.userSkill.create({
      data: { userId: user.id, skillId: skill.id },
    });
    return user.id;
  }

  async function makeOpenConversation(): Promise<{
    seekerId: string;
    providerId: string;
    conversationId: string;
  }> {
    const seeker = await createTestUser({});
    createdUserIds.push(seeker.id);
    const category = await prisma.category.create({
      data: {
        name: 'دسته تست گیت‌وی',
        slug: `test-cat-gw-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdCategoryIds.push(category.id);
    const req = await prisma.request.create({
      data: {
        slug: `req-gw-test-${String(Date.now())}-${String(Math.random())}`,
        ownerId: seeker.id,
        title: 'تست گیت‌وی گفتگو',
        description: 'توضیحات تستی برای بررسی گیت‌وی.',
        categoryId: category.id,
        mode: 'ONLINE',
        durationMinutes: 60,
        budgetMinRial: 1_000_000,
        budgetMaxRial: 2_000_000,
        deadlineAt: new Date(Date.now() + 86_400_000),
        preferredWindows: [],
        status: RequestStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    createdRequestIds.push(req.id);
    const providerId = await makeCompleteProvider();
    const offer = await offers.submit(providerId, {
      requestId: req.id,
      proposedStartAt: new Date(Date.now() + 3 * 86_400_000),
      proposedDurationMinutes: 60,
      amountRial: 1_500_000,
      message: null,
    });
    createdOfferIds.push(offer.id);
    const selected = await offers.select(offer.id);
    createdConversationIds.push(selected.conversationId);
    return {
      seekerId: seeker.id,
      providerId,
      conversationId: selected.conversationId,
    };
  }

  function connect(extraHeaders?: Record<string, string>, auth?: object) {
    return io(baseUrl, {
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      extraHeaders,
      auth,
    });
  }

  function waitConnected(client: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      client.once('connect', () => {
        resolve();
      });
      client.once('connect_error', (err: Error) => {
        reject(err);
      });
    });
  }

  function waitDisconnected(client: ClientSocket): Promise<void> {
    return new Promise((resolve) => {
      client.once('disconnect', () => {
        resolve();
      });
    });
  }

  it('disconnects a socket with no cookie and no ticket', async () => {
    const client = connect();
    await expect(waitDisconnected(client)).resolves.toBeUndefined();
    client.close();
  });

  it('keeps a socket connected when it presents a valid access_token cookie', async () => {
    const { seekerId } = await makeOpenConversation();
    const client = connect({ Cookie: accessCookieFor(seekerId) });
    await expect(waitConnected(client)).resolves.toBeUndefined();
    client.close();
  });

  it('lets a real participant join their conversation room', async () => {
    const { seekerId, conversationId } = await makeOpenConversation();
    const client = connect({ Cookie: accessCookieFor(seekerId) });
    await waitConnected(client);

    const ack = await new Promise((resolve) => {
      client.emit('conversation:join', { conversationId }, resolve);
    });
    expect(ack).toEqual({ ok: true });
    client.close();
  });

  it('refuses to join a conversation for a non-participant', async () => {
    const { conversationId } = await makeOpenConversation();
    const outsider = await createTestUser({});
    createdUserIds.push(outsider.id);
    const client = connect({ Cookie: accessCookieFor(outsider.id) });
    await waitConnected(client);

    const ack = await new Promise((resolve) => {
      client.emit('conversation:join', { conversationId }, resolve);
    });
    expect(ack).toEqual({ ok: false });
    client.close();
  });

  it('broadcasts message:new to a joined participant when the REST endpoint is used to send', async () => {
    const { seekerId, providerId, conversationId } =
      await makeOpenConversation();

    const seekerSocket = connect({ Cookie: accessCookieFor(seekerId) });
    await waitConnected(seekerSocket);
    await new Promise((resolve) => {
      seekerSocket.emit('conversation:join', { conversationId }, resolve);
    });

    const received = new Promise<{ body: string; senderId: string }>(
      (resolve) => {
        seekerSocket.once('message:new', resolve);
      },
    );

    await request(app.getHttpServer() as Server)
      .post('/api/v1/conversations/messages')
      .set(
        'Authorization',
        `Bearer ${tokens.signAccessToken({ sub: providerId, sid: 'test-session' })}`,
      )
      .set('Origin', process.env.WEB_ORIGIN || 'http://localhost:3000')
      .send({ conversationId, body: 'سلام از طریق REST' });

    const message = await received;
    expect(message.body).toBe('سلام از طریق REST');
    expect(message.senderId).toBe(providerId);
    seekerSocket.close();
  });

  it('does not deliver message:new to a socket that never joined the room', async () => {
    const { seekerId, providerId, conversationId } =
      await makeOpenConversation();

    const seekerSocket = connect({ Cookie: accessCookieFor(seekerId) });
    await waitConnected(seekerSocket);
    // Deliberately not joining the conversation room.

    let received = false;
    seekerSocket.on('message:new', () => {
      received = true;
    });

    await request(app.getHttpServer() as Server)
      .post('/api/v1/conversations/messages')
      .set(
        'Authorization',
        `Bearer ${tokens.signAccessToken({ sub: providerId, sid: 'test-session' })}`,
      )
      .set('Origin', process.env.WEB_ORIGIN || 'http://localhost:3000')
      .send({ conversationId, body: 'این نباید برسد' });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toBe(false);
    seekerSocket.close();
  });

  it('authenticates via a one-time ws-ticket when no cookie is presented, and the ticket cannot be reused', async () => {
    const { seekerId } = await makeOpenConversation();
    const ticketResponse = await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/ws-ticket')
      .set(
        'Authorization',
        `Bearer ${tokens.signAccessToken({ sub: seekerId, sid: 'test-session' })}`,
      )
      .set('Origin', process.env.WEB_ORIGIN || 'http://localhost:3000');

    const ticket = (ticketResponse.body as { ticket: string }).ticket;
    expect(typeof ticket).toBe('string');

    const first = connect(undefined, { ticket });
    await expect(waitConnected(first)).resolves.toBeUndefined();
    first.close();

    const second = connect(undefined, { ticket });
    await expect(waitDisconnected(second)).resolves.toBeUndefined();
    second.close();
  });

  it('directly proves the ws-ticket is deleted from Redis on first use (GETDEL semantics)', async () => {
    const { seekerId } = await makeOpenConversation();
    const ticketResponse = await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/ws-ticket')
      .set(
        'Authorization',
        `Bearer ${tokens.signAccessToken({ sub: seekerId, sid: 'test-session' })}`,
      )
      .set('Origin', process.env.WEB_ORIGIN || 'http://localhost:3000');
    const ticket = (ticketResponse.body as { ticket: string }).ticket;

    const before = await redis.client.get(redis.key('ws-ticket', ticket));
    expect(before).toBe(seekerId);

    const client = connect(undefined, { ticket });
    await waitConnected(client);
    client.close();

    const after = await redis.client.get(redis.key('ws-ticket', ticket));
    expect(after).toBeNull();
  });
});
