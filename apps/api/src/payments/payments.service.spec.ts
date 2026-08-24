import { randomUUID } from 'node:crypto';
import {
  OrderStatus,
  ProductCode,
  RequestStatus,
  SubscriptionStatus,
  prisma,
} from '@vaqt/db';
import { AuditService } from '../auth/audit/audit.service';
import { fakeConfig } from '../test-support/fake-config';
import { ErrorCode } from '../common/errors/error-codes';
import type {
  PaymentPort,
  PaymentRequestInput,
  PaymentRequestResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
} from './payment.port';
import { PaymentsConfigService } from './payments.config';
import { PaymentsService } from './payments.service';

class FakePaymentPort implements PaymentPort {
  requestCalls: PaymentRequestInput[] = [];
  requestResults: PaymentRequestResult[] = [];
  verifyCalls: PaymentVerifyInput[] = [];
  requestShouldThrow = false;
  verifyResult: PaymentVerifyResult = {
    success: true,
    refId: 'fake-ref-1',
    raw: { ok: true },
  };

  requestPayment(input: PaymentRequestInput): Promise<PaymentRequestResult> {
    this.requestCalls.push(input);
    if (this.requestShouldThrow) {
      return Promise.reject(new Error('provider unreachable'));
    }
    // A real UUID, not a per-instance counter — every test gets a fresh
    // FakePaymentPort but shares the same Postgres database (cleanup is
    // afterAll, not afterEach), so a counter-based authority would collide
    // with an earlier test's order and trip the unique constraint.
    const authority = `fake-authority-${randomUUID()}`;
    const result = {
      authority,
      redirectUrl: `https://gateway.example/${authority}`,
    };
    this.requestResults.push(result);
    return Promise.resolve(result);
  }

  verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    this.verifyCalls.push(input);
    return Promise.resolve(this.verifyResult);
  }
}

describe('PaymentsService (real Postgres)', () => {
  const createdOrderIds: string[] = [];
  const createdRequestIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdUserIds: string[] = [];
  let port: FakePaymentPort;
  let service: PaymentsService;

  beforeEach(() => {
    port = new FakePaymentPort();
    service = new PaymentsService(
      port,
      new PaymentsConfigService(
        fakeConfig({ WEB_ORIGIN: 'http://localhost:3000' }),
      ),
      new AuditService(),
    );
  });

  afterAll(async () => {
    for (const id of createdOrderIds.splice(0)) {
      await prisma.entitlement.deleteMany({ where: { orderId: id } });
      await prisma.subscription.deleteMany({ where: { orderId: id } });
      await prisma.order.deleteMany({ where: { id } });
    }
    for (const id of createdRequestIds.splice(0)) {
      await prisma.request.deleteMany({ where: { id } });
    }
    for (const id of createdCategoryIds.splice(0)) {
      await prisma.category.deleteMany({ where: { id } });
    }
    for (const id of createdUserIds.splice(0)) {
      await prisma.auditLog.deleteMany({ where: { actorId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  function uniquePhone(): string {
    return `+9897${String(Date.now()).slice(-4)}${String(
      Math.floor(Math.random() * 10000),
    ).padStart(4, '0')}`;
  }

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({
      data: { phone: uniquePhone(), displayName: 'کاربر تست پرداخت' },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function makeRequest(
    ownerId: string,
    overrides: { listTier?: number } = {},
  ): Promise<string> {
    const category = await prisma.category.create({
      data: {
        name: 'دسته تست پرداخت',
        slug: `test-cat-payment-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdCategoryIds.push(category.id);
    const request = await prisma.request.create({
      data: {
        slug: `req-payment-test-${String(Date.now())}-${String(Math.random())}`,
        ownerId,
        title: 'درخواست تست پرداخت',
        description: 'توضیحات تستی برای بررسی جریان پرداخت.',
        categoryId: category.id,
        mode: 'ONLINE',
        durationMinutes: 60,
        budgetMinRial: 1_000_000,
        budgetMaxRial: 2_000_000,
        deadlineAt: new Date(Date.now() + 86_400_000),
        preferredWindows: [],
        status: RequestStatus.PUBLISHED,
        publishedAt: new Date(),
        listTier: overrides.listTier ?? 0,
      },
    });
    createdRequestIds.push(request.id);
    return request.id;
  }

  describe('checkout', () => {
    it('creates a PENDING order priced from the product and returns the gateway redirect', async () => {
      const userId = await makeUser();
      const result = await service.checkout(userId, {
        productCode: ProductCode.URGENT_BADGE,
      });
      createdOrderIds.push(result.orderId);

      expect(result.redirectUrl).toContain('https://gateway.example/');
      expect(port.requestCalls[0].amountRial).toBe(490_000);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: result.orderId },
      });
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.amountRial).toBe(490_000);
      expect(order.authority).toBe(port.requestResults[0].authority);
    });

    it('attaches requestId when the caller owns the request', async () => {
      const userId = await makeUser();
      const requestId = await makeRequest(userId);
      const result = await service.checkout(userId, {
        productCode: ProductCode.URGENT_BADGE,
        requestId,
      });
      createdOrderIds.push(result.orderId);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: result.orderId },
      });
      expect(order.requestId).toBe(requestId);
    });

    it('rejects a requestId owned by a different user (404, no leak)', async () => {
      const ownerId = await makeUser();
      const otherUserId = await makeUser();
      const requestId = await makeRequest(ownerId);

      await expect(
        service.checkout(otherUserId, {
          productCode: ProductCode.URGENT_BADGE,
          requestId,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

    it('wraps a provider failure as PAYMENT_PROVIDER_ERROR without creating an order', async () => {
      const userId = await makeUser();
      port.requestShouldThrow = true;

      await expect(
        service.checkout(userId, { productCode: ProductCode.URGENT_BADGE }),
      ).rejects.toMatchObject({ code: ErrorCode.PAYMENT_PROVIDER_ERROR });

      const orders = await prisma.order.findMany({ where: { userId } });
      expect(orders).toHaveLength(0);
    });
  });

  describe('handleZarinpalCallback', () => {
    it('marks the order PAID, applies the URGENT_BADGE effect, and redirects to success', async () => {
      const userId = await makeUser();
      const requestId = await makeRequest(userId);
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.URGENT_BADGE,
        requestId,
      });
      createdOrderIds.push(orderId);

      const redirectUrl = await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'OK',
      );
      expect(redirectUrl).toBe(
        `http://localhost:3000/payment/result?status=success&order=${orderId}`,
      );

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.refId).toBe('fake-ref-1');
      expect(order.paidAt).not.toBeNull();

      const request = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(request.isUrgent).toBe(true);
      expect(request.listTier).toBe(1);

      const entitlement = await prisma.entitlement.findFirstOrThrow({
        where: { orderId },
      });
      expect(entitlement.type).toBe(ProductCode.URGENT_BADGE);
      expect(entitlement.requestId).toBe(requestId);
      expect(entitlement.expiresAt).not.toBeNull();
    });

    it('does not downgrade an already-FEATURE request when URGENT_BADGE is purchased afterward', async () => {
      const userId = await makeUser();
      const requestId = await makeRequest(userId, { listTier: 2 });
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.URGENT_BADGE,
        requestId,
      });
      createdOrderIds.push(orderId);

      await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'OK',
      );

      const request = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(request.listTier).toBe(2);
      expect(request.isUrgent).toBe(true);
    });

    it('sets isFeatured and listTier 2 for the FEATURE product', async () => {
      const userId = await makeUser();
      const requestId = await makeRequest(userId);
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.FEATURE,
        requestId,
      });
      createdOrderIds.push(orderId);

      await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'OK',
      );

      const request = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(request.isFeatured).toBe(true);
      expect(request.listTier).toBe(2);
    });

    it('re-ranks the request to now for the BUMP product', async () => {
      const userId = await makeUser();
      const requestId = await makeRequest(userId);
      const before = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.BUMP,
        requestId,
      });
      createdOrderIds.push(orderId);

      await new Promise((r) => setTimeout(r, 5));
      await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'OK',
      );

      const after = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(after.bumpedAt).not.toBeNull();
      expect(after.listRankAt.getTime()).toBeGreaterThan(
        before.listRankAt.getTime(),
      );
    });

    it('creates an ACTIVE Subscription for PRO_MONTHLY', async () => {
      const userId = await makeUser();
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.PRO_MONTHLY,
      });
      createdOrderIds.push(orderId);

      await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'OK',
      );

      const subscription = await prisma.subscription.findUniqueOrThrow({
        where: { orderId },
      });
      expect(subscription.plan).toBe(ProductCode.PRO_MONTHLY);
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.userId).toBe(userId);
    });

    it('marks the order FAILED on Status=NOK without touching the request', async () => {
      const userId = await makeUser();
      const requestId = await makeRequest(userId);
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.URGENT_BADGE,
        requestId,
      });
      createdOrderIds.push(orderId);

      const redirectUrl = await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'NOK',
      );
      expect(redirectUrl).toContain('status=failed');

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe(OrderStatus.FAILED);
      expect(port.verifyCalls).toHaveLength(0);

      const request = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(request.isUrgent).toBe(false);
    });

    it('marks the order FAILED and logs a high-severity audit entry when verify fails', async () => {
      const userId = await makeUser();
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.URGENT_BADGE,
      });
      createdOrderIds.push(orderId);
      port.verifyResult = { success: false, refId: null, raw: { code: 101 } };

      const redirectUrl = await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'OK',
      );
      expect(redirectUrl).toContain('status=failed');

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe(OrderStatus.FAILED);

      const auditLog = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: orderId, action: 'payment.verify_failed' },
      });
      expect(auditLog.meta).toMatchObject({ severity: 'high' });
    });

    it('is idempotent: a second OK callback for an already-PAID order does not re-verify or duplicate the entitlement', async () => {
      const userId = await makeUser();
      const requestId = await makeRequest(userId);
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.URGENT_BADGE,
        requestId,
      });
      createdOrderIds.push(orderId);

      await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'OK',
      );
      expect(port.verifyCalls).toHaveLength(1);

      const redirectUrl = await service.handleZarinpalCallback(
        port.requestResults[0].authority,
        'OK',
      );
      expect(redirectUrl).toContain('status=success');
      expect(port.verifyCalls).toHaveLength(1); // not called again

      const entitlements = await prisma.entitlement.findMany({
        where: { orderId },
      });
      expect(entitlements).toHaveLength(1);
    });

    it('redirects with status=not_found for an unknown authority', async () => {
      const redirectUrl = await service.handleZarinpalCallback(
        'does-not-exist',
        'OK',
      );
      expect(redirectUrl).toBe(
        'http://localhost:3000/payment/result?status=not_found',
      );
    });
  });

  describe('getOrder', () => {
    it('returns the order for its owner', async () => {
      const userId = await makeUser();
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.BUMP,
      });
      createdOrderIds.push(orderId);

      const view = await service.getOrder(userId, orderId);
      expect(view.productCode).toBe(ProductCode.BUMP);
      expect(view.status).toBe(OrderStatus.PENDING);
    });

    it('rejects a different user (404, no leak)', async () => {
      const ownerId = await makeUser();
      const otherUserId = await makeUser();
      const { orderId } = await service.checkout(ownerId, {
        productCode: ProductCode.BUMP,
      });
      createdOrderIds.push(orderId);

      await expect(
        service.getOrder(otherUserId, orderId),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

    it('rejects an unknown order id', async () => {
      const userId = await makeUser();
      await expect(
        service.getOrder(userId, 'does-not-exist'),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });
  });

  describe('reconcileStaleOrders', () => {
    it('finalizes a stale PENDING order by re-verifying with the provider', async () => {
      const userId = await makeUser();
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.BUMP,
      });
      createdOrderIds.push(orderId);
      await prisma.order.update({
        where: { id: orderId },
        data: { createdAt: new Date(Date.now() - 40 * 60_000) },
      });

      const processed = await service.reconcileStaleOrders();
      expect(processed).toBeGreaterThanOrEqual(1);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe(OrderStatus.PAID);
    });

    it('marks a stale order with no authority as FAILED without calling verify', async () => {
      const userId = await makeUser();
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.BUMP,
      });
      createdOrderIds.push(orderId);
      await prisma.order.update({
        where: { id: orderId },
        data: {
          authority: null,
          createdAt: new Date(Date.now() - 40 * 60_000),
        },
      });

      await service.reconcileStaleOrders();

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe(OrderStatus.FAILED);
      expect(port.verifyCalls).toHaveLength(0);
    });

    it('leaves a fresh PENDING order untouched', async () => {
      const userId = await makeUser();
      const { orderId } = await service.checkout(userId, {
        productCode: ProductCode.BUMP,
      });
      createdOrderIds.push(orderId);

      await service.reconcileStaleOrders();

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe(OrderStatus.PENDING);
    });
  });
});
