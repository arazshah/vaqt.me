export interface SmsSendResult {
  delivered: boolean;
}

export const SMS_PORT = Symbol('SMS_PORT');

export interface SmsPort {
  sendOtp(phone: string, code: string): Promise<SmsSendResult>;
  sendNotification(
    phone: string,
    templateId: string,
    params: Record<string, string>,
  ): Promise<SmsSendResult>;
}
