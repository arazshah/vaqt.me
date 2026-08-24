import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  OrderStatus,
  PaymentProvider,
  Prisma,
  ProductCode,
  SubscriptionStatus,
  prisma,
} from '@vaqt/db';
import type { CheckoutInput } from '@vaqt/shared';
import { AuditService } from '../auth/audit/audit.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { PAYMENT_PORT, type PaymentPort } from './payment.port';
import { PaymentsConfigService } from './payments.config';

const MS_PER_HOUR = 3_600_000;

interface OrderRow {
  id: string;
  userId: string;
  productId: string;
  requestId: string | null;
  amountRial: number;
  status: string;
}

export interface CheckoutResult {
  orderId: string;
  redirectUrl: string;
}

export interface OrderView {
  id: string;
  status: string;
  amountRial: number;
  productCode: string;
  productTitle: string;
  refId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

type CallbackStatus = 'success' | 'failed' | 'not_found';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_PORT) private readonly paymentPort: PaymentPort,
    private readonly config: PaymentsConfigService,
    private readonly audit: AuditService,
  ) {}

  async checkout(
    userId: string,
    input: CheckoutInput,
  ): Promise<CheckoutResult> {
    const product = await prisma.product.findUnique({
      where: { code: input.productCode },
    });
    if (!product) {
      throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    let requestId: string | null = null;
    if (input.requestId) {
      const request = await prisma.request.findUnique({
        where: { id: input.requestId },
        select: { id: true, ownerId: true },
      });
      if (!request || request.ownerId !== userId) {
        throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      requestId = request.id;
    }

    let requested;
    try {
      requested = await this.paymentPort.requestPayment({
        amountRial: product.priceRial,
        description: product.title,
        callbackUrl: this.config.callbackUrl,
      });
    } catch (error) {
      this.logger.error('payment provider requestPayment failed', error);
      throw new AppError(
        ErrorCode.PAYMENT_PROVIDER_ERROR,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const order = await prisma.order.create({
      data: {
        userId,
        productId: product.id,
        requestId,
        amountRial: product.priceRial,
        status: OrderStatus.PENDING,
        provider:
          this.config.provider === 'zarinpal'
            ? PaymentProvider.ZARINPAL
            : PaymentProvider.MOCK,
        authority: requested.authority,
      },
      select: { id: true },
    });

    return { orderId: order.id, redirectUrl: requested.redirectUrl };
  }

  /**
   * Handles the gateway's callback and returns the URL to 302-redirect the
   * browser to — this endpoint must never render anything itself (see
   * CLAUDE.md's payment idempotency decision).
   */
  async handleZarinpalCallback(
    authority: string,
    status: string,
  ): Promise<string> {
    const outcome = await this.processCallback(authority, status);
    const orderQuery = outcome.orderId ? `&order=${outcome.orderId}` : '';
    return `${this.config.webOrigin}/payment/result?status=${outcome.status}${orderQuery}`;
  }

  private async processCallback(
    authority: string,
    status: string,
  ): Promise<{ orderId: string; status: CallbackStatus }> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        OrderRow[]
      >`SELECT "id", "userId", "productId", "requestId", "amountRial", "status" FROM "orders" WHERE "authority" = ${authority} FOR UPDATE`;
      if (rows.length === 0) {
        return { orderId: '', status: 'not_found' as const };
      }
      const order = rows[0];

      // Idempotent replay: a gateway can hit the callback more than once
      // for the same authority (retries, user double-navigating back) —
      // never re-verify or re-create entitlements for an order already
      // marked PAID.
      if (order.status === OrderStatus.PAID) {
        return { orderId: order.id, status: 'success' as const };
      }

      if (status !== 'OK') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED },
        });
        return { orderId: order.id, status: 'failed' as const };
      }

      const finalStatus = await this.verifyAndFinalize(tx, order, authority);
      return { orderId: order.id, status: finalStatus };
    });
  }

  // Shared between the gateway callback and the stale-order reconciliation
  // job: calls the provider's verify, then either applies the purchased
  // product's effect (PAID) or marks the order FAILED with a high-severity
  // audit entry. Caller must already hold the row lock (FOR UPDATE) and be
  // certain the order isn't already PAID.
  private async verifyAndFinalize(
    tx: Prisma.TransactionClient,
    order: OrderRow,
    authority: string,
  ): Promise<'success' | 'failed'> {
    const verify = await this.paymentPort.verifyPayment({
      authority,
      amountRial: order.amountRial,
    });
    if (!verify.success) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.FAILED,
          raw: verify.raw as Prisma.InputJsonValue,
        },
      });
      await this.audit.log({
        actorId: order.userId,
        action: 'payment.verify_failed',
        entityType: 'Order',
        entityId: order.id,
        meta: { authority },
        severity: 'high',
      });
      return 'failed';
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
        refId: verify.refId,
        paidAt: new Date(),
        raw: verify.raw as Prisma.InputJsonValue,
      },
    });

    await this.applyProductEffect(tx, order);

    return 'success';
  }

  // Applies what the purchased product actually does. TARGETED_NOTIFY
  // intentionally only gets the generic Entitlement row below — there is
  // no notification-dispatch infrastructure yet to actually send anything,
  // out of scope for this phase (documented in CLAUDE.md).
  private async applyProductEffect(
    tx: Prisma.TransactionClient,
    order: OrderRow,
  ): Promise<void> {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: order.productId },
    });
    const startsAt = new Date();
    const expiresAt =
      product.durationHours != null
        ? new Date(startsAt.getTime() + product.durationHours * MS_PER_HOUR)
        : null;

    await tx.entitlement.create({
      data: {
        userId: order.userId,
        requestId: order.requestId,
        orderId: order.id,
        type: product.code,
        startsAt,
        expiresAt,
      },
    });

    if (product.code === ProductCode.URGENT_BADGE && order.requestId) {
      const request = await tx.request.findUniqueOrThrow({
        where: { id: order.requestId },
        select: { listTier: true },
      });
      await tx.request.update({
        where: { id: order.requestId },
        data: { isUrgent: true, listTier: Math.max(request.listTier, 1) },
      });
    } else if (product.code === ProductCode.FEATURE && order.requestId) {
      const request = await tx.request.findUniqueOrThrow({
        where: { id: order.requestId },
        select: { listTier: true },
      });
      await tx.request.update({
        where: { id: order.requestId },
        data: { isFeatured: true, listTier: Math.max(request.listTier, 2) },
      });
    } else if (product.code === ProductCode.BUMP && order.requestId) {
      await tx.request.update({
        where: { id: order.requestId },
        data: { bumpedAt: startsAt, listRankAt: startsAt },
      });
    } else if (product.code === ProductCode.PRO_MONTHLY && expiresAt) {
      await tx.subscription.create({
        data: {
          userId: order.userId,
          plan: product.code,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: expiresAt,
          orderId: order.id,
        },
      });
    }
  }

  /**
   * Closes out orders stuck in PENDING past the staleness window (default
   * 30 minutes — see CLAUDE.md's payment idempotency decision): the user
   * may have actually completed payment at the gateway but never
   * navigated back for the callback to fire, so this re-verifies with the
   * provider rather than assuming failure outright. An order with no
   * authority at all (the provider call itself failed at checkout time)
   * is marked FAILED directly — there's nothing to verify.
   */
  async reconcileStaleOrders(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - this.config.reconciliationStaleMinutes * 60_000,
    );
    const stale = await prisma.order.findMany({
      where: { status: OrderStatus.PENDING, createdAt: { lt: cutoff } },
      select: { id: true, authority: true },
    });

    let processed = 0;
    for (const { id, authority } of stale) {
      await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          OrderRow[]
        >`SELECT "id", "userId", "productId", "requestId", "amountRial", "status" FROM "orders" WHERE "id" = ${id} FOR UPDATE`;
        // Already resolved by a concurrent callback between the SELECT
        // above and this lock — nothing to do.
        if (rows.length === 0 || rows[0].status !== OrderStatus.PENDING) {
          return;
        }
        const order = rows[0];
        if (!authority) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.FAILED },
          });
          return;
        }
        await this.verifyAndFinalize(tx, order, authority);
      });
      processed += 1;
    }

    this.logger.log(
      `payment reconciliation processed ${String(processed)} stale orders`,
    );
    return processed;
  }

  async getOrder(userId: string, orderId: string): Promise<OrderView> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        amountRial: true,
        refId: true,
        paidAt: true,
        createdAt: true,
        product: { select: { code: true, title: true } },
      },
    });
    if (!order || order.userId !== userId) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    return {
      id: order.id,
      status: order.status,
      amountRial: order.amountRial,
      productCode: order.product.code,
      productTitle: order.product.title,
      refId: order.refId,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    };
  }
}
