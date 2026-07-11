import { v4 as uuidv4 } from 'uuid';
import { logger } from '../shared/logger.js';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import Stripe from 'stripe';

const paymentLogger = logger.child({ component: 'payment-gateway' });

/**
 * Unified Payment Gateway interface.
 * Supports UPI (Razorpay), Cards (Stripe), PayPal, and stub for dev.
 */
export interface PaymentGatewayOrder {
  orderId: string;
  providerOrderId: string;
  amount: number;           // In smallest unit (paisa/cents)
  currency: string;
  status: 'created' | 'pending' | 'captured' | 'failed';
  checkoutUrl?: string;     // URL to redirect user for payment
  upiDeepLink?: string;     // UPI intent URI for mobile
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentVerification {
  verified: boolean;
  providerPaymentId: string;
  status: 'captured' | 'failed';
  method?: string;          // 'upi', 'card', 'netbanking', 'wallet', 'paypal'
  upiId?: string;
  failureReason?: string;
}

export interface PaymentGateway {
  readonly provider: string;
  createOrder(params: {
    amount: number;
    currency: string;
    purpose: string;
    userId: string;
    paymentMethod?: string;
    upiId?: string;
    returnUrl?: string;
  }): Promise<PaymentGatewayOrder>;

  verifyPayment(params: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature?: string;
  }): Promise<PaymentVerification>;

  initiateRefund(params: {
    providerPaymentId: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; status: string }>;
}

// ============================================================
// STUB GATEWAY — Simulated payments for dev/testing
// ============================================================

export class StubPaymentGateway implements PaymentGateway {
  readonly provider = 'stub';

  async createOrder(params: {
    amount: number;
    currency: string;
    purpose: string;
    userId: string;
    paymentMethod?: string;
    upiId?: string;
  }): Promise<PaymentGatewayOrder> {
    const orderId = uuidv4();
    const providerOrderId = `stub_order_${Date.now()}`;

    paymentLogger.info({
      orderId, amount: params.amount, currency: params.currency,
      purpose: params.purpose, method: params.paymentMethod,
    }, '[STUB] Payment order created');

    return {
      orderId,
      providerOrderId,
      amount: params.amount,
      currency: params.currency,
      status: 'created',
      checkoutUrl: `http://localhost:3000/stub-checkout/${providerOrderId}`,
      upiDeepLink: params.paymentMethod === 'upi'
        ? `upi://pay?pa=enterchat@upi&pn=EnterChat&am=${params.amount / 100}&cu=${params.currency}&tn=${params.purpose}`
        : undefined,
      expiresAt: new Date(Date.now() + 900000).toISOString(), // 15 minutes
    };
  }

  async verifyPayment(params: {
    providerOrderId: string;
    providerPaymentId: string;
  }): Promise<PaymentVerification> {
    paymentLogger.info({
      orderId: params.providerOrderId,
      paymentId: params.providerPaymentId,
    }, '[STUB] Payment verified (auto-success)');

    // Stub always succeeds
    return {
      verified: true,
      providerPaymentId: params.providerPaymentId || `stub_pay_${Date.now()}`,
      status: 'captured',
      method: 'stub',
    };
  }

  async initiateRefund(params: {
    providerPaymentId: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; status: string }> {
    paymentLogger.info({
      paymentId: params.providerPaymentId, amount: params.amount,
    }, '[STUB] Refund initiated');

    return { refundId: `stub_refund_${Date.now()}`, status: 'processed' };
  }
}

// ============================================================
// RAZORPAY GATEWAY — UPI + Cards (India)
// ============================================================

export class RazorpayGateway implements PaymentGateway {
  readonly provider = 'razorpay';
  private instance: Razorpay | null = null;

  constructor() {
    const keyId = process.env['RAZORPAY_KEY_ID'];
    const keySecret = process.env['RAZORPAY_KEY_SECRET'];
    if (keyId && keySecret) {
      this.instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    purpose: string;
    userId: string;
    paymentMethod?: string;
    upiId?: string;
    returnUrl?: string;
  }): Promise<PaymentGatewayOrder> {
    if (!this.instance) {
      paymentLogger.warn('Razorpay credentials not configured — falling back to stub');
      return new StubPaymentGateway().createOrder(params);
    }

    const order = await this.instance.orders.create({
      amount: params.amount,
      currency: params.currency,
      receipt: `receipt_${params.userId}_${Date.now()}`,
      notes: { purpose: params.purpose, userId: params.userId },
    });

    paymentLogger.info({ amount: params.amount, method: params.paymentMethod }, 'Razorpay order created');

    return {
      orderId: uuidv4(),
      providerOrderId: order.id,
      amount: params.amount,
      currency: params.currency,
      status: 'created',
      checkoutUrl: `https://api.razorpay.com/v1/checkout/${order.id}`,
      upiDeepLink: params.upiId
        ? `upi://pay?pa=${params.upiId}&pn=EnterChat&am=${params.amount / 100}&cu=${params.currency}`
        : undefined,
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    };
  }

  async verifyPayment(params: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature?: string;
  }): Promise<PaymentVerification> {
    const keySecret = process.env['RAZORPAY_KEY_SECRET'];
    if (!keySecret) {
      return { verified: false, providerPaymentId: params.providerPaymentId, status: 'failed', failureReason: 'No secret' };
    }

    const expectedSignature = crypto.createHmac('sha256', keySecret)
      .update(`${params.providerOrderId}|${params.providerPaymentId}`)
      .digest('hex');
    
    const verified = expectedSignature === params.providerSignature;

    paymentLogger.info({ orderId: params.providerOrderId, verified }, 'Razorpay payment verification');

    return {
      verified,
      providerPaymentId: params.providerPaymentId,
      status: verified ? 'captured' : 'failed',
      method: 'upi',
    };
  }

  async initiateRefund(params: {
    providerPaymentId: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; status: string }> {
    if (!this.instance) return { refundId: '', status: 'failed' };
    
    const refund = await this.instance.payments.refund(params.providerPaymentId, {
      amount: params.amount,
      notes: { reason: params.reason || 'Refund' }
    });
    
    paymentLogger.info({ paymentId: params.providerPaymentId }, 'Razorpay refund initiated');
    return { refundId: refund.id, status: refund.status || 'unknown' };
  }
}

// ============================================================
// STRIPE GATEWAY — Cards + PayPal (International)
// ============================================================

export class StripeGateway implements PaymentGateway {
  readonly provider = 'stripe';
  private stripe: Stripe | null = null;

  constructor() {
    const secretKey = process.env['STRIPE_SECRET_KEY'];
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2024-04-10' as any });
    }
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    purpose: string;
    userId: string;
    returnUrl?: string;
  }): Promise<PaymentGatewayOrder> {
    if (!this.stripe) {
      paymentLogger.warn('Stripe credentials not configured — falling back to stub');
      return new StubPaymentGateway().createOrder(params);
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      metadata: { purpose: params.purpose, userId: params.userId },
    });

    paymentLogger.info({ amount: params.amount }, 'Stripe PaymentIntent created');

    return {
      orderId: uuidv4(),
      providerOrderId: paymentIntent.id,
      amount: params.amount,
      currency: params.currency,
      status: 'created',
      checkoutUrl: `https://checkout.stripe.com/pay/${paymentIntent.id}`, // Or client_secret
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
  }

  async verifyPayment(params: {
    providerOrderId: string;
    providerPaymentId: string;
  }): Promise<PaymentVerification> {
    if (!this.stripe) return { verified: false, providerPaymentId: params.providerPaymentId, status: 'failed' };

    const intent = await this.stripe.paymentIntents.retrieve(params.providerOrderId);
    const verified = intent.status === 'succeeded';

    paymentLogger.info({ orderId: params.providerOrderId, verified }, 'Stripe payment verification');
    return {
      verified,
      providerPaymentId: params.providerPaymentId,
      status: verified ? 'captured' : 'failed',
      method: 'card',
    };
  }

  async initiateRefund(params: {
    providerPaymentId: string;
    amount: number;
  }): Promise<{ refundId: string; status: string }> {
    if (!this.stripe) return { refundId: '', status: 'failed' };

    const refund = await this.stripe.refunds.create({
      payment_intent: params.providerPaymentId,
      amount: params.amount,
    });

    paymentLogger.info({ paymentId: params.providerPaymentId }, 'Stripe refund initiated');
    return { refundId: refund.id, status: refund.status || 'unknown' };
  }
}

// ============================================================
// FACTORY
// ============================================================

let gateway: PaymentGateway | null = null;

export function getPaymentGateway(provider?: string): PaymentGateway {
  const p = provider || process.env['PAYMENT_PROVIDER'] || 'stub';

  if (!gateway || (gateway as any).provider !== p) {
    switch (p) {
      case 'razorpay':
        gateway = new RazorpayGateway();
        break;
      case 'stripe':
        gateway = new StripeGateway();
        break;
      default:
        gateway = new StubPaymentGateway();
    }
    paymentLogger.info({ provider: p }, 'Payment gateway initialized');
  }
  return gateway;
}

/**
 * Get the appropriate gateway based on currency/region.
 * INR → Razorpay (best UPI support)
 * Others → Stripe (best card/PayPal support)
 */
export function getGatewayForCurrency(currency: string): PaymentGateway {
  if (currency === 'INR') {
    return getPaymentGateway('razorpay');
  }
  return getPaymentGateway('stripe');
}
