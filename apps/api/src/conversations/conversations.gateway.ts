import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { prisma } from '@vaqt/db';
import { RedisService } from '../common/redis/redis.service';
import { TokenService } from '../auth/session/token.service';

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key) {
      out[key] = decodeURIComponent(value);
    }
  }
  return out;
}

function roomName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

// Real-time delivery layer on top of the REST Conversations API (see
// conversations.controller.ts) — the REST endpoints remain the only write
// path (persistence, validation, the CONVERSATION_ARCHIVED guard all stay
// there); this gateway only authenticates sockets, gates room membership to
// actual participants, and re-broadcasts what ConversationsService already
// persisted. No message can be sent through the socket alone.
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class ConversationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
  ) {}

  // Cookie-based auth is primary (CLAUDE.md bond 4: same access_token
  // cookie the REST API trusts). The one-time ws-ticket
  // (POST /auth/ws-ticket, 60s TTL in Redis, consumed atomically via
  // GETDEL) is the fallback for a future cross-domain deployment where the
  // browser wouldn't send the cookie on the socket handshake. Anything
  // that resolves neither path gets disconnected immediately — there is no
  // "connected but anonymous" state.
  async handleConnection(client: Socket): Promise<void> {
    const userId = await this.authenticate(client);
    if (!userId) {
      client.disconnect(true);
      return;
    }
    (client.data as { userId: string }).userId = userId;
  }

  @SubscribeMessage('conversation:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: unknown },
  ): Promise<{ ok: boolean }> {
    const conversationId =
      typeof body.conversationId === 'string' ? body.conversationId : null;
    const userId = (client.data as { userId?: string }).userId;
    if (!conversationId || !userId) {
      return { ok: false };
    }
    const isParticipant = await this.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return { ok: false };
    }
    await client.join(roomName(conversationId));
    return { ok: true };
  }

  @SubscribeMessage('conversation:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: unknown },
  ): Promise<void> {
    const conversationId =
      typeof body.conversationId === 'string' ? body.conversationId : null;
    if (conversationId) {
      await client.leave(roomName(conversationId));
    }
  }

  // Called by ConversationsService.sendMessage() after a message is
  // actually persisted — never triggered directly by a client event. A
  // direct method call, not an event bus: this app has no existing
  // EventEmitter2 dependency, and there is exactly one call site.
  broadcastMessage(conversationId: string, message: unknown): void {
    this.server.to(roomName(conversationId)).emit('message:new', message);
  }

  private async authenticate(client: Socket): Promise<string | null> {
    const cookies = parseCookies(client.handshake.headers.cookie);
    const accessToken = cookies.access_token;
    if (accessToken) {
      try {
        return this.tokens.verifyAccessToken(accessToken).sub;
      } catch {
        // Falls through to the ticket path below.
      }
    }

    const ticket = client.handshake.auth.ticket as unknown;
    if (typeof ticket === 'string' && ticket) {
      const userId = await this.redis.client.getdel(
        this.redis.key('ws-ticket', ticket),
      );
      if (userId) {
        return userId;
      }
    }

    return null;
  }

  private async isParticipant(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { seekerId: true, providerId: true },
    });
    if (!conversation) {
      return false;
    }
    return (
      conversation.seekerId === userId || conversation.providerId === userId
    );
  }
}
