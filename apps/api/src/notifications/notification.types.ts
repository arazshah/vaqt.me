export type NotificationEvent =
  | { type: 'booking.created'; bookingId: string }
  | { type: 'booking.decided'; bookingId: string }
  | { type: 'booking.canceled'; bookingId: string; by: 'booker' | 'provider' }
  | { type: 'reminder.scan' };
