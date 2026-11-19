import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, prisma } from '@vaqt/db';
import {
  buildLinkHref,
  CardTemplateSchema,
  CardCategorySchema,
  LinkKindSchema,
  type CardLinkView,
  type GeoPoint,
  type MyCard,
  type PublicCard,
  type UpdateCardInput,
} from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { getPublicBookingInfo } from '../booking/public-info';

// +989123456747 -> 09123456747 (the form people dial and recognise).
function toLocalPhone(canonical: string | null): string {
  if (!canonical) return '';
  return canonical.startsWith('+98') ? `0${canonical.slice(3)}` : canonical;
}

function toLinkViews(
  links: { kind: string; value: string; order: number }[],
): CardLinkView[] {
  return [...links]
    .sort((a, b) => a.order - b.order)
    .flatMap((l) => {
      const kind = LinkKindSchema.safeParse(l.kind);
      return kind.success
        ? [
            {
              kind: kind.data,
              value: l.value,
              href: buildLinkHref(kind.data, l.value),
            },
          ]
        : [];
    });
}

function toLocation(
  card:
    { latitude: number | null; longitude: number | null } | null | undefined,
): GeoPoint | null {
  return card?.latitude != null && card.longitude != null
    ? { lat: card.latitude, lng: card.longitude }
    : null;
}

function toCategory(raw: string | null | undefined) {
  const parsed = CardCategorySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function toTemplate(raw: string | undefined) {
  const parsed = CardTemplateSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'tile';
}

function escapeVCard(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

@Injectable()
export class CardsService {
  /**
   * The ONLY shape a card leaves the API in for anonymous visitors. Built
   * field by field (never by spreading the User row) so a new User column
   * can't leak by accident; the phone appears only with the owner's consent.
   */
  async getPublic(username: string): Promise<PublicCard> {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: {
        card: true,
        contactLinks: true,
      },
    });
    if (!user || user.status !== 'ACTIVE' || !user.username) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return {
      username: user.username,
      displayName: user.displayName,
      headline: user.headline,
      bio: user.bio,
      city: user.city,
      avatarUrl: user.avatarUrl,
      template: toTemplate(user.card?.template),
      category: toCategory(user.card?.category),
      // The phone typed on purpose for the card wins; the account phone is
      // only ever shown if the owner turned showPhone on.
      phone:
        user.card?.contactPhone ??
        (user.card?.showPhone && user.phone ? toLocalPhone(user.phone) : null),
      address: user.card?.address ?? null,
      location: toLocation(user.card),
      links: toLinkViews(user.contactLinks),
      booking: await getPublicBookingInfo(user.id),
    };
  }

  async getVCard(username: string, cardUrl: string): Promise<string> {
    const card = await this.getPublic(username);
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCard(card.displayName)}`,
      `N:;${escapeVCard(card.displayName)};;;`,
    ];
    if (card.headline) lines.push(`TITLE:${escapeVCard(card.headline)}`);
    if (card.phone) lines.push(`TEL;TYPE=CELL:${card.phone}`);
    lines.push(`URL:${cardUrl}`);
    for (const link of card.links) {
      lines.push(`URL;TYPE=${link.kind}:${link.href}`);
    }
    if (card.address || card.city) {
      lines.push(
        `ADR;TYPE=WORK:;;${escapeVCard(card.address ?? '')};${escapeVCard(card.city ?? '')};;;IR`,
      );
    }
    if (card.location) {
      lines.push(
        `GEO:${String(card.location.lat)};${String(card.location.lng)}`,
      );
    }
    lines.push(`NOTE:${escapeVCard(`کارت ویزیت آنلاین: ${cardUrl}`)}`);
    lines.push('END:VCARD');
    return lines.join('\r\n') + '\r\n';
  }

  async getMine(userId: string): Promise<MyCard> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { card: true, contactLinks: true },
    });
    return {
      username: user.username,
      displayName: user.displayName,
      headline: user.headline,
      bio: user.bio,
      city: user.city,
      template: toTemplate(user.card?.template),
      category: toCategory(user.card?.category),
      avatarUrl: user.avatarUrl,
      showPhone: user.card?.showPhone ?? false,
      contactPhone: user.card?.contactPhone ?? null,
      address: user.card?.address ?? null,
      location: toLocation(user.card),
      links: toLinkViews(user.contactLinks),
    };
  }

  async update(userId: string, input: UpdateCardInput): Promise<MyCard> {
    const fields = {
      ...(input.template !== undefined && { template: input.template }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.showPhone !== undefined && { showPhone: input.showPhone }),
      ...(input.contactPhone !== undefined && {
        contactPhone: input.contactPhone,
      }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.location !== undefined && {
        latitude: input.location?.lat ?? null,
        longitude: input.location?.lng ?? null,
      }),
    };
    await prisma.$transaction(async (tx) => {
      await tx.card.upsert({
        where: { userId },
        create: { userId, ...fields },
        update: fields,
      });
      if (input.links) {
        await tx.contactLink.deleteMany({ where: { userId } });
        await tx.contactLink.createMany({
          data: input.links.map((l, order) => ({
            userId,
            kind: l.kind,
            value: l.value,
            order,
          })),
        });
      }
    });
    return this.getMine(userId);
  }

  async setUsername(userId: string, username: string): Promise<MyCard> {
    try {
      await prisma.user.update({ where: { id: userId }, data: { username } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new AppError(ErrorCode.USERNAME_TAKEN, HttpStatus.CONFLICT);
      }
      throw err;
    }
    return this.getMine(userId);
  }
}
