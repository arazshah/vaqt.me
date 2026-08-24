export const PAYMENT_PORT = Symbol('PAYMENT_PORT');

export interface PaymentRequestInput {
  amountRial: number;
  description: string;
  callbackUrl: string;
}

export interface PaymentRequestResult {
  authority: string;
  redirectUrl: string;
}

export interface PaymentVerifyInput {
  authority: string;
  amountRial: number;
}

export interface PaymentVerifyResult {
  success: boolean;
  refId: string | null;
  raw: unknown;
}

export interface PaymentPort {
  requestPayment(input: PaymentRequestInput): Promise<PaymentRequestResult>;
  verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult>;
}
