import { Logger } from '@nestjs/common';
import type { SmsProvider } from './sms.provider';

/** Development provider: logs the code instead of sending an SMS. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private log = new Logger('ConsoleSms');
  /** last code per number, readable only through the test routes */
  readonly last = new Map<string, string>();

  async sendCode(e164: string, code: string): Promise<void> {
    this.last.set(e164, code);
    this.log.log(`OTP for ${e164.slice(0, 6)}***${e164.slice(-2)}: ${code}`);
  }
}
