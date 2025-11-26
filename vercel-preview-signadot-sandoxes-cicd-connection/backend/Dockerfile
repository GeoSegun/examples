# * Multi-stage Dockerfile for production optimization
# Stage 1: Dependencies installation
FROM node:20-alpine AS deps
WORKDIR /app

# * Copy package files for dependency installation
COPY package.json bun.lock* ./

# * Install dependencies using npm (fallback if bun is not available)
# ? Note: Project has bun.lock but we'll use npm for Docker compatibility
# * Using npm install since package-lock.json is not present
RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force

# Stage 2: Production build
FROM node:20-alpine AS builder
WORKDIR /app

# * Copy package files and install all dependencies (including dev)
COPY package.json bun.lock* ./
RUN npm install --ignore-scripts && \
    npm cache clean --force

# * Copy application source code
COPY server.js ./
COPY config.js ./

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

# * Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# * Copy production dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# * Copy application files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/server.js ./
COPY --from=builder --chown=nodejs:nodejs /app/config.js ./
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# * Switch to non-root user
USER nodejs

# * Expose application port
EXPOSE 3000

# * Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# * Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# * Start the application
CMD ["node", "server.js"]

