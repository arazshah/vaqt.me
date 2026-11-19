import { prisma } from '@vaqt/db';
import { ServiceModeSchema, type PublicBookingInfo } from '@vaqt/shared';

/**
 * What the public card shows about booking: whether it is on and which
 * session types exist. Never hours, leave days or other people's bookings.
 */
export async function getPublicBookingInfo(
  userId: string,
): Promise<PublicBookingInfo> {
  const [card, services] = await Promise.all([
    prisma.card.findUnique({ where: { userId } }),
    prisma.serviceType.findMany({
      where: { userId, isActive: true },
      orderBy: { order: 'asc' },
    }),
  ]);
  return {
    enabled: Boolean(card?.bookingEnabled) && services.length > 0,
    services: services.map((s) => {
      const mode = ServiceModeSchema.safeParse(s.mode);
      return {
        id: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        mode: mode.success ? mode.data : 'online',
        note: s.note,
      };
    }),
  };
}
