export interface OtpSmsJobData {
  phone: string;
  code: string;
}

export interface NotificationSmsJobData {
  phone: string;
  templateId: string;
  params: Record<string, string>;
}

export type SmsJobData = OtpSmsJobData | NotificationSmsJobData;
