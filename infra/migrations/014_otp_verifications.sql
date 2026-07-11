-- 014_otp_verifications.sql
-- OTP verification records for authentication flow.
-- Used by PostgresAuthRepository.

CREATE TABLE IF NOT EXISTS otp_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel         VARCHAR(10) NOT NULL CHECK (channel IN ('phone', 'email')),
    identifier      TEXT NOT NULL,
    otp_hash        TEXT NOT NULL,
    attempts        INT NOT NULL DEFAULT 0,
    max_attempts    INT NOT NULL DEFAULT 5,
    expires_at      TIMESTAMPTZ NOT NULL,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires
    ON otp_verifications (expires_at)
    WHERE verified_at IS NULL;

-- Auto-cleanup: delete expired OTP records older than 24 hours
-- Run via pg_cron or scheduled job
-- DELETE FROM otp_verifications WHERE expires_at < NOW() - INTERVAL '24 hours';

COMMENT ON TABLE otp_verifications IS 'OTP verification records for phone/email auth. Records are short-lived.';
