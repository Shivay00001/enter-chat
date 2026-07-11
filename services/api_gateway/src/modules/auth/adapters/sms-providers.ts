import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import twilio from 'twilio';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/logger.js';
import type { OtpSender } from '../ports/repositories.js';

const smsLogger = logger.child({ component: 'sms-provider' });

/**
 * Twilio implementation of the OtpSender port.
 */
export class TwilioSmsProvider implements OtpSender {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(config.auth.twilioAccountSid, config.auth.twilioAuthToken);
  }

  async sendOtp(channel: 'phone' | 'email', identifier: string, otp: string): Promise<void> {
    if (channel !== 'phone') {
      smsLogger.warn({ channel }, 'TwilioSmsProvider only supports phone channel');
      return;
    }

    try {
      await this.client.messages.create({
        body: `Your EnterChat verification code is: ${otp}. Do not share this with anyone.`,
        from: config.auth.twilioFromNumber,
        to: identifier,
      });
      smsLogger.info({ to: identifier }, 'SMS sent via Twilio');
    } catch (err) {
      smsLogger.error({ err, to: identifier }, 'Failed to send SMS via Twilio');
      throw new Error('Failed to send SMS verification code');
    }
  }
}

/**
 * AWS SNS implementation of the OtpSender port.
 */
export class AwsSnsSmsProvider implements OtpSender {
  private client: SNSClient;

  constructor() {
    this.client = new SNSClient({
      region: config.auth.awsRegion,
      credentials: {
        accessKeyId: config.auth.awsAccessKeyId,
        secretAccessKey: config.auth.awsSecretAccessKey,
      },
    });
  }

  async sendOtp(channel: 'phone' | 'email', identifier: string, otp: string): Promise<void> {
    if (channel !== 'phone') {
      smsLogger.warn({ channel }, 'AwsSnsSmsProvider only supports phone channel');
      return;
    }

    try {
      const command = new PublishCommand({
        PhoneNumber: identifier,
        Message: `Your EnterChat verification code is: ${otp}. Do not share this with anyone.`,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
        },
      });

      await this.client.send(command);
      smsLogger.info({ to: identifier }, 'SMS sent via AWS SNS');
    } catch (err) {
      smsLogger.error({ err, to: identifier }, 'Failed to send SMS via AWS SNS');
      throw new Error('Failed to send SMS verification code');
    }
  }
}
