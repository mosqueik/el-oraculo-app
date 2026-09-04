# ═══════════════════════════════════════════════════════════════════
# EL ORÁCULO — Backend Dockerfile (Self-Contained)
# Docker context: ./backend/ (shared/ is included inside backend/)
# ═══════════════════════════════════════════════════════════════════

FROM node:22-alpine

# Install Python and build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Security: run as non-root
RUN addgroup -g 1001 -S oraculo && \
    adduser -S oraculo -u 1001

WORKDIR /app

# Copy package files first (for Docker layer caching)
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/

# Install all dependencies (including shared via file:./shared)
RUN npm install --omit=dev 2>/dev/null || npm install

# Copy source files
COPY shared/ ./shared/
COPY src/ ./src/
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY public/ ./public/

# Build shared package first
RUN cd shared && npx tsc 2>/dev/null || true

# Fix shared package.json to point to compiled output
RUN sed -i 's|"src/index.ts"|"dist/index.js"|' shared/package.json 2>/dev/null || true

# Build backend
RUN npx tsc 2>/dev/null || true

# Create data directory for SQLite (writable by non-root)
RUN mkdir -p /data && chown -R oraculo:oraculo /data

# Create logs directory
RUN mkdir -p /app/logs && chown -R oraculo:oraculo /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Switch to non-root user
USER oraculo

# Start the application
CMD ["node", "dist/index.js"]
