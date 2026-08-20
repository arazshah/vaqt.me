/**
 * Masks a canonical +989xxxxxxxxx phone number for logs: keeps the
 * country code + first 2 subscriber digits and the last 4 digits, e.g.
 * "+989123456789" -> "+98912***6789". OTP codes themselves must never be
 * logged in production regardless of this helper.
 */
export function maskPhone(phone: string): string {
  if (phone.length < 10) {
    return '***';
  }
  return `${phone.slice(0, 6)}***${phone.slice(-4)}`;
}
