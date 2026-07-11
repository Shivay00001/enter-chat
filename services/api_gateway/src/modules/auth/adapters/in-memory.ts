import type { OtpSender } from '../ports/repositories.js';
import { logger } from '../../../shared/logger.js';

const authLogger = logger.child({ component: 'stub-auth' });

/**
 * Stub OTP Sender used EXCLUSIVELY for test environments.
 */
export class StubOtpSender implements OtpSender {
  async sendOtp(channel: 'phone' | 'email', identifier: string, otp: string): Promise<void> {
    authLogger.warn({ channel, identifier }, `[STUB OTP SENDER] OTP for testing: ${otp} — THIS MUST BE DISABLED IN PRODUCTION`);
  }
}
