# ═══════════════════════════════════════════════════════════════════
# EL ORÁCULO — Backend Dockerfile (Multi-Stage Build)
# Compatible with: Docker Compose, Fly.io, Railway, Render
# ═══════════════════════════════════════════════════════════════════

# ─── Stage 1: Install Dependencies ──────────────────────────────
FROM node:22-alpine AS deps

# Install Python and build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace root package.json
COPY package.json package-lock.json ./

# Copy shared package (needed for workspace linking)
COPY shared/package.json ./shared/

# Copy backend package.json
COPY backend/package.json ./backend/

# Install all workspace dependencies
RUN npm ci --workspaces --include-workspace-root

# ─── Stage 2: Build ─────────────────────────────────────────────
FROM node:22-alpine AS build

# Install Python and build tools for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy source files
COPY package.json package-lock.json ./
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared package first (backend depends on it)
RUN cd shared && npx tsc
# Build backend
RUN cd backend && npx tsc

# ─── Stage 3: Production ────────────────────────────────────────
FROM node:22-alpine AS production

# Install Python and build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Security: run as non-root
RUN addgroup -g 1001 -S oraculo && \
    adduser -S oraculo -u 1001

WORKDIR /app

# Copy package files for production install
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install production dependencies only
RUN npm ci --workspaces --include-workspace-root --omit=dev

# Copy built output
COPY --from=build /app/backend/dist ./backend/dist

# Copy shared built output (runtime dependency)
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json

# Fix shared package.json to point to compiled output
RUN sed -i 's|"src/index.ts"|"dist/index.js"|' shared/package.json

# Copy Drizzle migrations
COPY --from=build /app/backend/drizzle ./backend/drizzle

# Copy drizzle.config.ts
COPY --from=build /app/backend/drizzle.config.ts ./backend/drizzle.config.ts

# Create data directory for SQLite (writable by non-root)
# For Docker Compose: mounted volume
# For Fly.io: mounted volume at /data
RUN mkdir -p /data && chown -R oraculo:oraculo /data

# Also create logs directory
RUN mkdir -p /app/backend/logs && chown -R oraculo:oraculo /app/backend/logs

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Switch to non-root user
USER oraculo

# Start the application
CMD ["node", "dist/index.js"]
