/** Delivery channel for one-time codes. Production providers implement this interface. */
export interface SmsProvider {
  readonly name: string;
  sendCode(e164: string, code: string, locale: 'ar' | 'en'): Promise<void>;
}
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
