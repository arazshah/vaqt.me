// Single source of truth for every enum in the system.
// prisma/schema.prisma mirrors these value-for-value; packages/db has a unit
// test asserting the two never drift apart. This package must never depend
// on @prisma/client — enums flow shared -> prisma schema, not the other way.
import { z } from 'zod';

function createEnum<const T extends readonly [string, ...string[]]>(values: T) {
  const obj = Object.fromEntries(values.map((v) => [v, v])) as {
    [K in T[number]]: K;
  };
  const schema = z.enum(values);
  return [obj, schema] as const;
}

export const [RoleIntent, RoleIntentSchema] = createEnum([
  'SEEKER',
  'PROVIDER',
  'BOTH',
] as const);
export type RoleIntent = (typeof RoleIntent)[keyof typeof RoleIntent];

export const [UserStatus, UserStatusSchema] = createEnum([
  'ACTIVE',
  'SUSPENDED',
] as const);
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const [OtpPurpose, OtpPurposeSchema] = createEnum(['AUTH'] as const);
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

export const [RequestMode, RequestModeSchema] = createEnum([
  'ONLINE',
  'IN_PERSON',
  'HYBRID',
] as const);
export type RequestMode = (typeof RequestMode)[keyof typeof RequestMode];

export const [RequestStatus, RequestStatusSchema] = createEnum([
  'DRAFT',
  'PUBLISHED',
  'OFFER_SELECTED',
  'CLOSED',
  'EXPIRED',
  'REMOVED',
] as const);
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const [Currency, CurrencySchema] = createEnum(['IRT'] as const);
export type Currency = (typeof Currency)[keyof typeof Currency];

export const [OfferStatus, OfferStatusSchema] = createEnum([
  'PENDING',
  'SELECTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
] as const);
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

export const [ConversationStatus, ConversationStatusSchema] = createEnum([
  'OPEN',
  'ARCHIVED',
] as const);
export type ConversationStatus =
  (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const [MessageType, MessageTypeSchema] = createEnum([
  'TEXT',
  'SYSTEM',
] as const);
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const [ProductCode, ProductCodeSchema] = createEnum([
  'URGENT_BADGE',
  'BUMP',
  'FEATURE',
  'PRO_MONTHLY',
  'TARGETED_NOTIFY',
] as const);
export type ProductCode = (typeof ProductCode)[keyof typeof ProductCode];

export const [OrderStatus, OrderStatusSchema] = createEnum([
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELED',
  'REFUNDED',
] as const);
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const [PaymentProvider, PaymentProviderSchema] = createEnum([
  'ZARINPAL',
  'MOCK',
] as const);
export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const [SubscriptionStatus, SubscriptionStatusSchema] = createEnum([
  'ACTIVE',
  'CANCELED',
  'EXPIRED',
] as const);
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const [NotificationChannel, NotificationChannelSchema] = createEnum([
  'IN_APP',
  'SMS',
] as const);
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const [ReportStatus, ReportStatusSchema] = createEnum([
  'OPEN',
  'REVIEWED',
  'DISMISSED',
] as const);
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

// Permission level — distinct from RoleIntent (SEEKER/PROVIDER/BOTH is
// product intent a user can freely change, never a permission grant).
export const [SystemRole, SystemRoleSchema] = createEnum([
  'USER',
  'ADMIN',
] as const);
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];
