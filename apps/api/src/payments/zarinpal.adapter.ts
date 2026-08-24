import { Injectable, Logger } from '@nestjs/common';
import type {
  PaymentPort,
  PaymentRequestInput,
  PaymentRequestResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
} from './payment.port';

interface ZarinpalRequestResponse {
  data: { code: number; authority?: string };
  errors: unknown;
}

interface ZarinpalVerifyResponse {
  data: { code: number; ref_id?: number | string };
  errors: unknown;
}

const ZARINPAL_SUCCESS_CODE = 100;
// Returned by /verify when the same authority was already verified once —
// still a success, not an error, per Zarinpal's docs.
const ZARINPAL_ALREADY_VERIFIED_CODE = 101;

/**
 * Zarinpal's v4 IPG API — https://www.zarinpal.com/docs/paymentGateway/.
 * Uses raw fetch (same as SmsIrAdapter/AnthropicAiAdapter — no SDK
 * dependency added for a single gateway integration). NEVER live-tested
 * against a real merchant account in this environment; see CLAUDE.md for
 * the honest caveat before relying on this in production.
 */
@Injectable()
export class ZarinpalAdapter implements PaymentPort {
  private readonly logger = new Logger(ZarinpalAdapter.name);
  private readonly baseUrl: string;
  private readonly startPayBaseUrl: string;

  constructor(
    private readonly merchantId: string,
    sandbox: boolean,
  ) {
    this.baseUrl = sandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://api.zarinpal.com/pg/v4/payment';
    this.startPayBaseUrl = sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://www.zarinpal.com/pg/StartPay';
  }

  async requestPayment(
    input: PaymentRequestInput,
  ): Promise<PaymentRequestResult> {
    const response = await fetch(`${this.baseUrl}/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: input.amountRial,
        callback_url: input.callbackUrl,
        description: input.description,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Zarinpal request error ${String(response.status)}: ${body}`,
      );
      throw new Error(`Zarinpal request error: ${String(response.status)}`);
    }

    const data = (await response.json()) as ZarinpalRequestResponse;
    if (data.data.code !== ZARINPAL_SUCCESS_CODE || !data.data.authority) {
      this.logger.error(
        `Zarinpal request rejected: code=${String(data.data.code)}`,
      );
      throw new Error(
        `Zarinpal request rejected: code ${String(data.data.code)}`,
      );
    }

    return {
      authority: data.data.authority,
      redirectUrl: `${this.startPayBaseUrl}/${data.data.authority}`,
    };
  }

  async verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    const response = await fetch(`${this.baseUrl}/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: input.amountRial,
        authority: input.authority,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Zarinpal verify error ${String(response.status)}: ${body}`,
      );
      return { success: false, refId: null, raw: body };
    }

    const data = (await response.json()) as ZarinpalVerifyResponse;
    const success =
      data.data.code === ZARINPAL_SUCCESS_CODE ||
      data.data.code === ZARINPAL_ALREADY_VERIFIED_CODE;

    return {
      success,
      refId:
        success && data.data.ref_id != null ? String(data.data.ref_id) : null,
      raw: data,
    };
  }
}
