#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# EL ORÁCULO — Fly.io Deployment Script
# ═══════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🪙 El Oráculo — Fly.io Deploy${NC}"
echo "──────────────────────────────────────"

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
  echo -e "${YELLOW}⚠️  fly CLI not found.${NC}"
  echo "   Install it:"
  echo "   curl -L https://fly.io/install.sh | sh"
  echo ""
  echo "   Or on macOS:"
  echo "   brew install flyctl"
  echo ""
  exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
  echo -e "${YELLOW}🔐 Not logged in to Fly.io${NC}"
  echo "   Running: fly auth login"
  fly auth login
fi

echo -e "${GREEN}📋 Step 1: Checking app status...${NC}"
if fly status --app el-oraculo-backend &> /dev/null; then
  echo "   ✅ App 'el-oraculo-backend' exists"
else
  echo -e "${YELLOW}   Creating new app...${NC}"
  fly launch --no-deploy --copy-config --name el-oraculo-backend
  echo "   ✅ App created"
fi

echo -e "${GREEN}💾 Step 2: Setting up persistent volume...${NC}"
# Check if volume exists
if fly volumes list --app el-oraculo-backend 2>/dev/null | grep -q "oraculo_data"; then
  echo "   ✅ Volume 'oraculo_data' already exists"
else
  echo "   Creating volume in bog (Bogotá)..."
  fly volumes create oraculo_data --region bog --app el-oraculo-backend --size 1
  echo "   ✅ Volume created (1GB)"
fi

echo -e "${GREEN}🔑 Step 3: Setting environment variables...${NC}"
echo "   You need to set these secrets:"
echo ""
echo "   fly secrets set BINANCE_API_KEY=your_key --app el-oraculo-backend"
echo "   fly secrets set BINANCE_API_SECRET=your_secret --app el-oraculo-backend"
echo "   fly secrets set JWT_SECRET=$(openssl rand -hex 32) --app el-oraculo-backend"
echo ""
echo "   Optional:"
echo "   fly secrets set TELEGRAM_BOT_TOKEN=your_token --app el-oraculo-backend"
echo "   fly secrets set TELEGRAM_CHAT_ID=your_chat_id --app el-oraculo-backend"
echo ""

read -p "   Have you set the secrets? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}   ⚠️  Set secrets before deploying. Run:${NC}"
  echo "   fly secrets set BINANCE_API_KEY=xxx BINANCE_API_SECRET=xxx JWT_SECRET=xxx --app el-oraculo-backend"
  exit 1
fi

echo -e "${GREEN}🚀 Step 4: Deploying...${NC}"
fly deploy --app el-oraculo-backend

echo -e "${GREEN}🏥 Step 5: Checking health...${NC}"
sleep 10
if fly status --app el-oraculo-backend | grep -q "running"; then
  echo -e "${GREEN}   ✅ App is running!${NC}"
else
  echo -e "${YELLOW}   ⚠️  App may still be starting...${NC}"
  echo "   Check: fly logs --app el-oraculo-backend"
fi

# Get the app URL
APP_URL=$(fly info --app el-oraculo-backend 2>/dev/null | grep "Hostname" | awk '{print $2}' || echo "el-oraculo-backend.fly.dev")

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "📡 API:       https://${APP_URL}/api/health"
echo "🔌 WebSocket: wss://${APP_URL}"
echo ""
echo " Useful commands:"
echo "   fly logs --app el-oraculo-backend              # View logs"
echo "   fly status --app el-oraculo-backend            # Check status"
echo "   fly ssh console --app el-oraculo-backend       # SSH into container"
echo "   fly secrets list --app el-oraculo-backend      # List secrets"
echo "   fly redeploy --app el-oraculo-backend          # Redeploy"
echo "   fly scale count 0 --app el-oraculo-backend     # Stop (save free credits)"
echo "   fly scale count 1 --app el-oraculo-backend     # Restart"
echo ""
echo "📱 Update mobile app:"
echo "   EXPO_PUBLIC_API_URL=https://${APP_URL}"
echo "   EXPO_PUBLIC_WS_URL=https://${APP_URL}"
echo ""
