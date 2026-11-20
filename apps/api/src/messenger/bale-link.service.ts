import { randomInt } from 'crypto';
import { Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import { KvService } from '../common/kv/kv.service';
import { SettingsService } from '../settings/settings.service';

export const BALE_PLATFORM = 'bale';
const LINK_CODE_TTL_SECONDS = 600;
// No 0/O/1/I so a code read off a screen can be typed without mistakes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export interface BaleLinkOffer {
  code: string;
  url: string | null;
  expiresInSeconds: number;
}

@Injectable()
export class BaleLinkService {
  constructor(
    private readonly kv: KvService,
    private readonly settings: SettingsService,
  ) {}

  private codeKey(code: string): string {
    return this.kv.key('bale-link', code);
  }

  /** One-time code the user sends to the bot (or opens as a deep link). */
  async createLinkCode(userId: string): Promise<BaleLinkOffer> {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    await this.kv.set(this.codeKey(code), userId, LINK_CODE_TTL_SECONDS);
    const bot = await this.settings.get('bale.botUsername');
    return {
      code,
      url: bot ? `https://ble.ir/${bot}?start=${code}` : null,
      expiresInSeconds: LINK_CODE_TTL_SECONDS,
    };
  }

  /**
   * Consumes a code (GETDEL: it works exactly once, even if two chats race
   * for it) and binds that chat to the user. A chat can belong to one user
   * only, so an existing binding of the same chat is replaced.
   */
  async completeLink(code: string, chatId: string): Promise<string | null> {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(normalized)) return null;
    const userId = await this.kv.getAndDelete(this.codeKey(normalized));
    if (!userId) return null;
    await prisma.$transaction([
      prisma.messengerBinding.deleteMany({
        where: { platform: BALE_PLATFORM, chatId, NOT: { userId } },
      }),
      prisma.messengerBinding.upsert({
        where: { userId_platform: { userId, platform: BALE_PLATFORM } },
        create: { userId, platform: BALE_PLATFORM, chatId },
        update: { chatId },
      }),
    ]);
    return userId;
  }

  /**
   * Binds a chat only when neither the chat nor the user already has a
   * binding, so booking by phone can never steal or replace an existing one.
   */
  async bindIfFree(userId: string, chatId: string): Promise<void> {
    await prisma.messengerBinding.createMany({
      data: [{ userId, platform: BALE_PLATFORM, chatId }],
      skipDuplicates: true,
    });
  }

  async isBound(userId: string): Promise<boolean> {
    const binding = await prisma.messengerBinding.findUnique({
      where: { userId_platform: { userId, platform: BALE_PLATFORM } },
    });
    return binding !== null;
  }

  async getChatId(userId: string): Promise<string | null> {
    const binding = await prisma.messengerBinding.findUnique({
      where: { userId_platform: { userId, platform: BALE_PLATFORM } },
    });
    return binding?.chatId ?? null;
  }

  async findUserIdByChat(chatId: string): Promise<string | null> {
    const binding = await prisma.messengerBinding.findUnique({
      where: { platform_chatId: { platform: BALE_PLATFORM, chatId } },
    });
    return binding?.userId ?? null;
  }

  async unlink(userId: string): Promise<void> {
    await prisma.messengerBinding.deleteMany({
      where: { userId, platform: BALE_PLATFORM },
    });
  }
}
