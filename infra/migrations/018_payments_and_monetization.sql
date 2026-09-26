-- EnterChat Migration 018: Payments, Wallet & Monetization
-- Complete payment ecosystem: wallet, P2P transfers, subscriptions, sticker store, ads.

-- ============================================================
-- 1. WALLET SYSTEM
-- ============================================================

-- Digital wallet — one per user, balance stored in smallest unit (paisa/cents)
CREATE TABLE IF NOT EXISTS wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance         BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_frozen       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE wallets IS 'Digital wallet per user. Balance in smallest currency unit (paisa for INR, cents for USD).';
COMMENT ON COLUMN wallets.balance IS 'Balance in paisa (INR) or cents (USD). 10000 = ₹100 or $100.';

-- Immutable transaction ledger — every credit/debit
CREATE TYPE wallet_tx_type AS ENUM ('credit', 'debit');
CREATE TYPE wallet_tx_source AS ENUM (
    'add_money', 'withdraw', 'p2p_send', 'p2p_receive',
    'subscription', 'sticker_purchase', 'refund', 'cashback', 'reward'
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID NOT NULL REFERENCES wallets(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    tx_type         wallet_tx_type NOT NULL,
    source          wallet_tx_source NOT NULL,
    amount          BIGINT NOT NULL CHECK (amount > 0),
    balance_after   BIGINT NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    reference_id    UUID,                  -- FK to payment_order / p2p_transfer / subscription
    description     TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions (wallet_id, created_at DESC);

COMMENT ON TABLE wallet_transactions IS 'Immutable ledger of all wallet movements. Never update or delete rows.';

-- ============================================================
-- 2. PAYMENT ORDERS (Gateway integration)
-- ============================================================

CREATE TYPE payment_status AS ENUM ('created', 'pending', 'captured', 'failed', 'refunded', 'expired');
CREATE TYPE payment_provider AS ENUM ('stub', 'razorpay', 'stripe', 'paypal', 'upi_direct');

CREATE TABLE IF NOT EXISTS payment_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    amount          BIGINT NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    provider        payment_provider NOT NULL DEFAULT 'stub',
    provider_order_id TEXT,                -- Razorpay order_id / Stripe PaymentIntent ID
    provider_payment_id TEXT,              -- Payment ID from gateway
    status          payment_status NOT NULL DEFAULT 'created',
    purpose         VARCHAR(50) NOT NULL,  -- 'add_money', 'subscription', 'sticker_purchase'
    reference_id    UUID,                  -- What was purchased (subscription_plan, sticker_pack)
    payment_method  VARCHAR(30),           -- 'upi', 'card', 'netbanking', 'wallet', 'paypal'
    upi_id          TEXT,                  -- VPA for UPI payments
    failure_reason  TEXT,
    metadata        JSONB,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider ON payment_orders (provider, provider_order_id);

-- ============================================================
-- 3. UPI LINKED ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS upi_linked_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upi_id          TEXT NOT NULL,          -- e.g., user@upi, user@ybl, user@paytm
    provider        VARCHAR(30),            -- 'bhim', 'gpay', 'phonepe', 'paytm', 'other'
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    display_name    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, upi_id)
);

CREATE INDEX IF NOT EXISTS idx_upi_accounts_user ON upi_linked_accounts (user_id);

-- ============================================================
-- 4. P2P TRANSFERS
-- ============================================================

CREATE TYPE p2p_status AS ENUM ('pending', 'completed', 'declined', 'expired', 'refunded');

CREATE TABLE IF NOT EXISTS p2p_transfers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES users(id),
    receiver_id     UUID NOT NULL REFERENCES users(id),
    amount          BIGINT NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    status          p2p_status NOT NULL DEFAULT 'completed',
    transfer_type   VARCHAR(20) NOT NULL DEFAULT 'send', -- 'send' or 'request'
    note            TEXT,
    chat_id         UUID REFERENCES chats(id),            -- Associated chat
    -- NOTE: no FK to messages(id): messages is partitioned (PK id, created_at).
    message_id      UUID,                                 -- System message in chat
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_sender ON p2p_transfers (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_p2p_receiver ON p2p_transfers (receiver_id, created_at DESC);

-- ============================================================
-- 5. SUBSCRIPTIONS
-- ============================================================

CREATE TYPE subscription_tier AS ENUM ('free', 'premium', 'business');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'past_due');

CREATE TABLE IF NOT EXISTS subscription_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier            subscription_tier NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT,
    price_inr       BIGINT NOT NULL DEFAULT 0,     -- Monthly price in paisa
    price_usd       BIGINT NOT NULL DEFAULT 0,     -- Monthly price in cents
    features        JSONB NOT NULL DEFAULT '[]',
    max_devices     INT NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO subscription_plans (tier, name, description, price_inr, price_usd, features, max_devices) VALUES
    ('free', 'Free', 'Core messaging with standard features', 0, 0,
     '["Unlimited messaging", "1 device", "Standard stickers", "Context ads"]'::jsonb, 1),
    ('premium', 'Premium', 'Ad-free with premium features', 9900, 299,
     '["Ad-free experience", "5 devices", "Premium stickers", "Read receipt toggle", "Custom themes", "2GB file uploads"]'::jsonb, 5),
    ('business', 'Business', 'Everything + business tools', 49900, 999,
     '["All Premium features", "Unlimited devices", "Channels & bots", "Priority support", "Analytics dashboard", "5GB file uploads"]'::jsonb, 100)
ON CONFLICT (tier) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id         UUID NOT NULL REFERENCES subscription_plans(id),
    tier            subscription_tier NOT NULL DEFAULT 'free',
    status          subscription_status NOT NULL DEFAULT 'active',
    payment_order_id UUID REFERENCES payment_orders(id),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
    ON subscriptions (user_id) WHERE status = 'active';

-- ============================================================
-- 6. STICKER STORE
-- ============================================================

CREATE TABLE IF NOT EXISTS sticker_packs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    artist          TEXT,
    thumbnail_url   TEXT,
    preview_urls    JSONB NOT NULL DEFAULT '[]',     -- Array of sticker preview URLs
    sticker_count   INT NOT NULL DEFAULT 0,
    price_inr       BIGINT NOT NULL DEFAULT 0,       -- 0 = free
    price_usd       BIGINT NOT NULL DEFAULT 0,
    is_animated     BOOLEAN NOT NULL DEFAULT FALSE,
    is_premium      BOOLEAN NOT NULL DEFAULT FALSE,  -- Requires premium subscription
    category        VARCHAR(50) DEFAULT 'general',
    download_count  BIGINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sticker_packs_category ON sticker_packs (category, is_active);

CREATE TABLE IF NOT EXISTS sticker_pack_purchases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_id         UUID NOT NULL REFERENCES sticker_packs(id),
    payment_order_id UUID REFERENCES payment_orders(id),
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, pack_id)
);

-- ============================================================
-- 7. ADS (Non-Intrusive)
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_placements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    body            TEXT,
    image_url       TEXT,
    action_url      TEXT NOT NULL,
    advertiser      TEXT NOT NULL,
    placement_zone  VARCHAR(30) NOT NULL,   -- 'channel_post', 'stories_between', 'sticker_suggestions'
    target_regions  JSONB DEFAULT '[]',     -- ["IN", "US"] or empty for all
    target_tiers    JSONB DEFAULT '["free"]', -- Only show to free users by default
    budget_daily    BIGINT DEFAULT 0,
    impressions     BIGINT NOT NULL DEFAULT 0,
    clicks          BIGINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_impressions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id           UUID NOT NULL REFERENCES ad_placements(id),
    user_id         UUID REFERENCES users(id),
    placement_zone  VARCHAR(30) NOT NULL,
    action          VARCHAR(10) NOT NULL DEFAULT 'view', -- 'view' or 'click'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad ON ad_impressions (ad_id, created_at DESC);

COMMENT ON TABLE ad_placements IS 'Non-intrusive ads shown only in channels/stories. Premium users never see ads.';
