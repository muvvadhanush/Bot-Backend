# --- Stage 1: Dependencies ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definition
COPY package*.json ./

# Install ONLY production dependencies
# (If we needed dev deps for build steps like TypeScript, we'd install all, then prune)
RUN npm ci --only=production

# --- Stage 2: Runtime ---
FROM node:20-alpine

WORKDIR /app

# Non-root user for security
RUN chown node:node /app
USER node

# Copy dependencies from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./

# Copy Application Code
COPY --chown=node:node . .

# Expose Port (Documentary, actual mapping happens at runtime)
EXPOSE 5000

# Health check (Optional but good practice)
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-5000}/health || exit 1

# Environment set to production
ENV NODE_ENV=production

# Start command
CMD ["npm", "start"]
