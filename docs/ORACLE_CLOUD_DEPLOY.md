# 🚀 Oracle Cloud Always Free — Deployment Guide

## 1. Create Oracle Cloud Account

1. Go to https://cloud.oracle.com/free
2. Click **"Start for free"**
3. Fill in your details (name, email, country)
4. **Credit card required** for identity verification (you won't be charged)
5. Verify your email
6. Complete the signup

## 2. Create an ARM VM Instance

1. Login to https://cloud.oracle.com
2. Go to **Compute → Instances → Create Instance**
3. Configure:
   - **Name:** `el-oraculo-backend`
   - **Image:** Oracle Linux 8 (or Ubuntu 22.04)
   - **Shape:** VM.Standard.A1.Flex (ARM)
     - **OCPU:** 4 (max free)
     - **RAM:** 24 GB (max free)
   - **VPUw:** 50 GB (free tier)
4. **SSH Keys:** Generate new key pair or upload yours
5. **Subnet:** Keep default (public subnet)
6. **Assign Public IP:** Yes
7. Click **Create**

## 3. Connect to Your Instance

```bash
# Download your private key from Oracle Cloud dashboard
# Then connect:
ssh -i ~/.ssh/your-key.pem opc@<PUBLIC_IP>
```

## 4. Install Docker

```bash
# On Oracle Linux 8:
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker opc

# On Ubuntu 22.04:
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker opc

# Log out and back in for group changes
exit
```

## 5. Clone and Deploy

```bash
# Clone your repo
cd /home/opc
git clone https://github.com/your-username/el-oraculo-app.git
cd el-oraculo-app

# Create .env file with your secrets
nano .env
```

### .env file content:
```env
# Exchange
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here

# Auth
JWT_SECRET=your_jwt_secret_here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# AI
OPENROUTER_API_KEY=your_key

# Stripe
STRIPE_SECRET_KEY=your_key
STRIPE_WEBHOOK_SECRET=your_secret

# Database
DB_PATH=/data/oraculo.db

# Server
PORT=3001
NODE_ENV=production
CORS_ORIGIN=*
```

## 6. Deploy with Docker

```bash
# Build and start
docker compose up -d --build

# Check logs
docker compose logs -f

# Check health
curl http://localhost:3001/api/health
```

## 7. Open Firewall Port

```bash
# Open port 3001 (or use nginx on port 80)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload

# Or install nginx for port 80:
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 8. Access Your Backend

```
http://<PUBLIC_IP>:3001/api/health
http://<PUBLIC_IP>:3001/dashboard
http://<PUBLIC_IP>:3001/api-docs
```

## 9. Update Mobile App

Update `mobile/eas.json` and `mobile/src/services/api.ts`:
```typescript
const API_URL = 'http://<PUBLIC_IP>:3001';
```

## 10. Set Up SSL (Optional)

```bash
# Install certbot
sudo dnf install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

## Monitoring

```bash
# Check Docker status
docker compose ps

# View logs
docker compose logs -f backend

# Restart
docker compose restart

# Update
git pull
docker compose up -d --build
```

## Oracle Cloud Always Free Limits

| Resource | Free Limit |
|----------|-----------|
| AMD VMs | 2 (1/8 OCPU, 1GB RAM each) |
| ARM VMs | 4 (up to 4 OCPU, 24GB RAM total) |
| Block Storage | 200 GB |
| Object Storage | 10 GB |
| Bandwidth | 10 TB/month |
| Load Balancer | 1 instance |
| Database | 2 Autonomous DB (20GB each) |

## Tips

- **Use ARM VMs** — More powerful than AMD for the same free tier
- **Persistent storage** — Block volumes survive VM restarts
- **No sleep** — Unlike Render/Railway, your app stays on 24/7
- **Docker Compose** — Easiest way to deploy with SQLite
- **Firewall** — Oracle Cloud has security lists + OS firewall (double check both)

---

*Last updated: September 4, 2026*
