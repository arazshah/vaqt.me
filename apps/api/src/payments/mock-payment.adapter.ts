import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  PaymentPort,
  PaymentRequestInput,
  PaymentRequestResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
} from './payment.port';

/**
 * No real gateway involved (see PROJECT_SPEC.md: "پیش‌فرض لوکال: mock").
 * requestPayment's redirectUrl points straight back at our own callback
 * with Status=OK already appended — simulating an instant successful
 * gateway round-trip, so the full checkout->callback->verify pipeline is
 * exercisable locally (curl the redirectUrl, or a browser follows it)
 * without a second service. A failure can still be simulated by hitting
 * the callback directly with Status=NOK — that branch doesn't depend on
 * the adapter at all.
 */
@Injectable()
export class MockPaymentAdapter implements PaymentPort {
  requestPayment(input: PaymentRequestInput): Promise<PaymentRequestResult> {
    const authority = `mock-${randomUUID()}`;
    const separator = input.callbackUrl.includes('?') ? '&' : '?';
    return Promise.resolve({
      authority,
      redirectUrl: `${input.callbackUrl}${separator}Authority=${authority}&Status=OK`,
    });
  }

  verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    return Promise.resolve({
      success: true,
      refId: `mock-ref-${input.authority}`,
      raw: { mock: true },
    });
  }
}
