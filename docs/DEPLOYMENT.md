# 🚀 El Oráculo — Deployment Guide

> Complete guide for deploying El Oráculo to production.

---

## 📋 Prerequisites

### Backend
- Node.js 18+
- npm or yarn
- Binance API key + secret
- JWT secret (min 32 chars)

### Optional Services
- OpenRouter API key (free models)
- Stripe API keys (for subscriptions)
- Expo account (for push notifications)

---

## 🐳 Docker Deployment

### 1. Clone and Configure
```bash
git clone https://github.com/your-org/el-oraculo.git
cd el-oraculo

# Copy environment template
cp .env.example .env

# Edit .env with your keys
nano .env
```

### 2. Environment Variables
```bash
# Required
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
JWT_SECRET=your_jwt_secret_min_32_chars

# Optional
OPENROUTER_API_KEY=your_openrouter_key
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 3. Start Services
```bash
# Build and start
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f backend
```

### 4. Verify
```bash
# Health check
curl http://localhost:3001/api/health

# Expected response
{"status":"ok","timestamp":"2026-09-01T10:00:00Z"}
```

---

## 🪁 Fly.io Deployment (Recommended - Free)

### 1. Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Initialize App
```bash
cd backend
fly launch --no-deploy
```

This creates `fly.toml` with:
- App name: el-oraculo-backend
- Region: ar (Buenos Aires)
- VM: shared-cpu-1x (free)
- Memory: 256MB

### 3. Set Secrets
```bash
fly secrets set \
  BINANCE_API_KEY=xxx \
  BINANCE_API_SECRET=xxx \
  JWT_SECRET=xxx \
  OPENROUTER_API_KEY=xxx \
  STRIPE_SECRET_KEY=xxx \
  STRIPE_WEBHOOK_SECRET=xxx \
  --app el-oraculo-backend
```

### 4. Deploy
```bash
# Using deploy script
./scripts/fly-deploy.sh

# Or manually
fly deploy --app el-oraculo-backend
```

### 5. Verify
```bash
fly status --app el-oraculo-backend
fly logs --app el-oraculo-backend
```

### 6. Custom Domain (Optional)
```bash
fly certs add your-domain.com --app el-oraculo-backend
```

---

## 📱 Mobile App Deployment

### iOS (TestFlight)

#### 1. Configure EAS
```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure
```

#### 2. Update app.json
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourogracle.app",
      "buildNumber": "1"
    }
  }
}
```

#### 3. Build
```bash
# Development build
eas build --platform ios --profile development

# Production build
eas build --platform ios --profile production
```

#### 4. Submit to TestFlight
```bash
eas submit --platform ios
```

### Android (APK / Play Store)

#### 1. Configure EAS
```bash
cd mobile
eas build:configure
```

#### 2. Update app.json
```json
{
  "expo": {
    "android": {
      "package": "com.yourogracle.app",
      "versionCode": 1
    }
  }
}
```

#### 3. Build APK (for testing)
```bash
eas build --platform android --profile preview
```

This generates a `.apk` file you can install directly.

#### 4. Build AAB (for Play Store)
```bash
eas build --platform android --profile production
```

#### 5. Submit to Play Store
```bash
eas submit --platform android
```

---

## 🔧 Backend Configuration

### fly.toml
```toml
app = "el-oraculo-backend"
primary_region = "ar"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

  [http_service.concurrency]
    type = "connections"
    hard_limit = 250
    soft_limit = 200

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

---

## 📊 Monitoring

### Health Checks
```bash
# Backend health
curl http://localhost:3001/api/health

# Fly.io health
fly status --app el-oraculo-backend
```

### Logs
```bash
# Docker
docker compose logs -f backend

# Fly.io
fly logs --app el-oraculo-backend
```

### Metrics
```bash
# System stats
curl http://localhost:3001/api/monitoring/stats

# Error stats
curl http://localhost:3001/api/monitoring/errors
```

---

## 🔄 CI/CD with GitHub Actions

### Workflow Files

#### .github/workflows/ci.yml
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm ci
      - run: cd backend && npm test
      - run: cd backend && npx tsc --noEmit
```

#### .github/workflows/deploy.yml
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: fly deploy --app el-oraculo-backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### Setup
1. Add `FLY_API_TOKEN` to GitHub Secrets
2. Push to `main` branch
3. Actions will run tests and deploy

---

## 🛡️ Security Checklist

### Backend
- [ ] JWT_SECRET is strong (min 32 chars)
- [ ] Binance API keys are secure
- [ ] Rate limiting is enabled
- [ ] CORS is configured
- [ ] HTTPS is enforced
- [ ] Error messages don't leak secrets

### Mobile
- [ ] API URL uses HTTPS in production
- [ ] Biometric auth is optional
- [ ] Credentials are stored securely (Keychain/Keystore)
- [ ] App transport security is enabled (iOS)

### Deployment
- [ ] Secrets are not in git
- [ ] Environment variables are set
- [ ] Health checks are passing
- [ ] Logs are being collected

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check logs
docker compose logs backend

# Common issues:
# - Missing environment variables
# - Port already in use
# - Database connection failed
```

### Mobile Can't Connect
```bash
# Check API URL
echo $EXPO_PUBLIC_API_URL

# For local development
EXPO_PUBLIC_API_URL=http://localhost:3001

# For production
EXPO_PUBLIC_API_URL=https://your-app.fly.dev
```

### WebSocket Not Connecting
```bash
# Check if WebSocket is enabled
curl http://localhost:3001/api/health

# Check firewall/proxy settings
# WebSocket needs upgrade header support
```

---

## 📈 Scaling

### Free Tier Limits
- **Fly.io:** 3 shared VMs, 160GB bandwidth/month
- **Expo:** Unlimited builds (community)
- **SQLite:** Single writer, multiple readers

### When to Upgrade
- > 100 concurrent users → Upgrade Fly.io VM
- > 1000 trades/day → Consider PostgreSQL
- > 10 coins → Upgrade CPU/RAM

---

## 🔄 Updates

### Backend
```bash
# Pull changes
git pull

# Rebuild
docker compose build backend

# Restart
docker compose up -d backend
```

### Mobile
```bash
# Pull changes
git pull

# Rebuild
eas build --platform android --profile preview

# Or for iOS
eas build --platform ios --profile preview
```

---

*Generated by El Oráculo 🪙*
