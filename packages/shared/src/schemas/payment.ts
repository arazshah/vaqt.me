import { z } from 'zod';
import { ProductCodeSchema } from '../constants/enums';

export const checkoutSchema = z.object({
  productCode: ProductCodeSchema,
  // Only meaningful for request-scoped products (URGENT_BADGE, BUMP,
  // FEATURE) — null/omitted for account-level products (PRO_MONTHLY,
  // TARGETED_NOTIFY). PaymentsService validates ownership server-side.
  requestId: z.string().min(1).nullable().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const getOrderSchema = z.object({
  id: z.string().min(1, 'شناسه‌ی سفارش الزامی است'),
});
export type GetOrderInput = z.infer<typeof getOrderSchema>;
