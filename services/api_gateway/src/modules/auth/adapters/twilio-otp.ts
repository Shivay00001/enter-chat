import type { OtpSender } from '../ports/repositories.js';
import { logger } from '../../../shared/logger.js';

const authLogger = logger.child({ component: 'twilio-otp' });

export class TwilioOtpSender implements OtpSender {
  async sendOtp(channel: 'phone' | 'email', identifier: string, otp: string): Promise<void> {
    if (channel !== 'phone') {
      throw new Error(`TwilioOtpSender only supports phone channels, got ${channel}`);
    }
    
    // In a fully functional production app, this would use the Twilio SDK:
    // const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    // await client.messages.create({ body: `Your OTP is ${otp}`, from: config.twilio.sender, to: identifier });
    
    authLogger.info({ identifier }, 'Sending OTP via Twilio SMS');
    
    // Since we don't have real API keys, we log it to console but DO NOT log the OTP itself in production
    if (process.env.NODE_ENV !== 'production') {
       authLogger.info(`[DEV ONLY] OTP for ${identifier} is: ${otp}`);
    }
  }
}
