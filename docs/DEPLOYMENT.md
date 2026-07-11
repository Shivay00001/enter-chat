# EnterChat DNS & Domain Mapping Guide

## Domain Architecture

```
enterchat.app          → Landing page, legal pages (Nginx → static files)
www.enterchat.app      → Redirect to enterchat.app (Nginx 301)
api.enterchat.app      → REST API Gateway (Nginx → Node.js :3000)
ws.enterchat.app       → WebSocket Gateway (Nginx → Node.js :3001)
```

## DNS Configuration

Set the following DNS records pointing to your server's IP address:

| Record Type | Name | Value | TTL |
|---|---|---|---|
| A | enterchat.app | `YOUR_SERVER_IP` | 300 |
| A | www | `YOUR_SERVER_IP` | 300 |
| A | api | `YOUR_SERVER_IP` | 300 |
| A | ws | `YOUR_SERVER_IP` | 300 |
| AAAA | enterchat.app | `YOUR_SERVER_IPV6` | 300 |
| AAAA | www | `YOUR_SERVER_IPV6` | 300 |
| AAAA | api | `YOUR_SERVER_IPV6` | 300 |
| AAAA | ws | `YOUR_SERVER_IPV6` | 300 |

### Email DNS (for support/privacy emails)

| Record Type | Name | Value | TTL |
|---|---|---|---|
| MX | enterchat.app | `mail.provider.com` (priority 10) | 3600 |
| TXT | enterchat.app | `v=spf1 include:_spf.google.com ~all` | 3600 |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:dmarc@enterchat.app` | 3600 |
| CNAME | _domainkey | `domain.key.provider.com` | 3600 |

## Deployment Steps

### 1. Server Setup (Ubuntu 22.04+ recommended)
```bash
# Update system
apt update && apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Clone repository
git clone https://github.com/your-org/enterchat.git
cd enterchat
```

### 2. Configure Environment
```bash
cp infra/env/production.env.example .env
nano .env  # Fill in all CHANGE_ME values
```

### 3. Get SSL Certificates
```bash
# Start Nginx temporarily for ACME challenge
docker compose -f docker-compose.prod.yml up -d nginx

# Run cert setup
bash infra/scripts/setup-ssl.sh

# Restart Nginx with certs
docker compose -f docker-compose.prod.yml restart nginx
```

### 4. Launch Full Stack
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 5. Verify
```bash
# Health check
curl https://api.enterchat.app/health

# WebSocket check
wscat -c wss://ws.enterchat.app

# Legal pages
curl -I https://enterchat.app/privacy-policy
curl -I https://enterchat.app/terms
curl -I https://enterchat.app/delete-account
curl -I https://enterchat.app/contact
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Internet / Cloudflare (optional CDN + DDoS protection) │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
               ┌────────────────────┐
               │   Nginx (Port 443) │
               │   SSL Termination  │
               │   Rate Limiting    │
               │   Security Headers │
               └─────────┬──────────┘
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Static   │   │ API GW   │   │ WS GW    │
   │ Files    │   │ :3000    │   │ :3001    │
   │ (Legal)  │   │ REST API │   │ WebSocket│
   └──────────┘   └────┬─────┘   └────┬─────┘
                       │              │
                       ▼              ▼
              ┌──────────────────────────┐
              │  PostgreSQL 16 (Data)     │
              │  Redis 7 (Sessions/Cache) │
              └──────────────────────────┘
```

## Flutter App Configuration

Update `lib/core/network/api_config.dart` before building release:

```dart
class ApiConfig {
  static const String baseUrl = 'https://api.enterchat.app';
  static const String wsUrl = 'wss://ws.enterchat.app';
  static const String privacyPolicyUrl = 'https://enterchat.app/privacy-policy';
  static const String termsUrl = 'https://enterchat.app/terms';
  static const String deleteAccountUrl = 'https://enterchat.app/delete-account';
}
```

## Play Store Checklist

| # | Requirement | Status | Location |
|---|---|---|---|
| 1 | Terms & Conditions | ✅ | `/terms` |
| 2 | Privacy Policy | ✅ | `/privacy-policy` |
| 3 | Data Privacy | ✅ | In-app Data Privacy sheet |
| 4 | Delete User | ✅ | In-app + `/delete-account` + API |
| 5 | Contact Us | ✅ | `/contact` |
| 6 | Feedback | ✅ | In-app feedback dialog |
| 7 | Test Login | ✅ | Stub OTP sender (dev mode) |
| 8 | Close Testing | ⬜ | Set up in Play Console |
| 9 | 3 AAB versions | ⬜ | Build with `flutter build appbundle` |
| 10 | API 35+ | ✅ | `compileSdkVersion 35` in build.gradle |
| 11 | Website | ✅ | `enterchat.app` with legal pages |

## Security Checklist

- [x] HTTPS everywhere (TLS 1.2+)
- [x] HSTS preload header
- [x] CSP header
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Rate limiting (general, auth, media)
- [x] WebSocket connection limits
- [x] JWT with rotation
- [x] bcrypt password hashing
- [x] SHA-256 token hashing
- [x] SQL injection prevention (parameterized queries)
- [x] CORS restricted to app domain
- [x] Request size limits
- [x] Correlation IDs for tracing
- [x] Structured logging (no PII in logs)
