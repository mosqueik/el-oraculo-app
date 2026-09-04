#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# EL ORÁCULO — Deployment Script
# ═══════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🪙 El Oráculo — Deploy Script${NC}"
echo "──────────────────────────────────────"

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  No .env file found.${NC}"
  echo "   Copy .env.example to .env and fill in your values:"
  echo "   cp .env.example .env"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Step 1: Validate
echo -e "${GREEN}📋 Step 1: Validating...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed${NC}"
  exit 1
fi
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo -e "${RED}❌ Docker Compose is not installed${NC}"
  exit 1
fi
echo "   ✅ Docker and Docker Compose found"

# Step 2: Create data directory
echo -e "${GREEN}📁 Step 2: Creating data directory...${NC}"
mkdir -p backend/data
echo "   ✅ backend/data/ ready"

# Step 3: Build
echo -e "${GREEN}🔨 Step 3: Building Docker images...${NC}"
docker compose build --no-cache
echo "   ✅ Build complete"

# Step 4: Stop existing containers
echo -e "${GREEN}🛑 Step 4: Stopping existing containers...${NC}"
docker compose down --remove-orphans 2>/dev/null || true
echo "   ✅ Previous containers stopped"

# Step 5: Start
echo -e "${GREEN}🚀 Step 5: Starting containers...${NC}"
docker compose up -d
echo "   ✅ Containers started"

# Step 6: Health check
echo -e "${GREEN}🏥 Step 6: Waiting for health check...${NC}"
sleep 10
if docker compose ps | grep -q "healthy"; then
  echo -e "${GREEN}   ✅ Backend is healthy!${NC}"
else
  echo -e "${YELLOW}   ⚠️  Backend may still be starting up...${NC}"
  echo "   Check logs: docker compose logs -f backend"
fi

# Summary
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "📡 Backend:  http://localhost:3001/api/health"
echo "🌐 Nginx:    http://localhost:80"
echo ""
echo " Useful commands:"
echo "   docker compose logs -f backend    # View backend logs"
echo "   docker compose logs -f nginx      # View nginx logs"
echo "   docker compose ps                 # Check status"
echo "   docker compose restart backend    # Restart backend"
echo "   docker compose down               # Stop all"
echo ""
