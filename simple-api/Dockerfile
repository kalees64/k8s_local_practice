# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only manifest files first (better layer caching)
COPY package*.json ./

COPY .env .env

# Install production dependencies only
RUN npm ci --omit=dev


# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production

# Set NODE_ENV
ENV NODE_ENV=production

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the port (reads from .env at runtime; default 3000)
EXPOSE 3000

# Healthcheck — hits the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

# Start the server
CMD ["node", "server.js"]
