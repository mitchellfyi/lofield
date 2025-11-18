# Dockerfile for Lofield FM Scheduler Service
# Node.js service for content generation and queue management
# Note: Build context should be repository root

FROM node:20-alpine AS base
WORKDIR /app

# Stage 1: Dependencies
FROM base AS deps

# Copy package files from scheduler directory
COPY services/scheduler/package.json services/scheduler/package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM base AS builder

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy scheduler source
COPY services/scheduler ./

# Copy Prisma schema from web directory
COPY web/prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Stage 3: Runner
FROM base AS runner

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 scheduler

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/*.json ./
COPY --from=builder /app/prisma ./prisma

# Set ownership
RUN chown -R scheduler:nodejs /app

USER scheduler

# Start the scheduler service
CMD ["npm", "start"]
