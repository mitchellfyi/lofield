# Dockerfile for Lofield FM Scheduler Service
# Node.js service for content generation and queue management

FROM node:20-alpine AS base
WORKDIR /app

# Stage 1: Dependencies
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM base AS builder

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Note: Prisma schema is expected to be in ../web/prisma relative to build context
# docker-compose should set build context to repo root with dockerfile path specified
RUN npx prisma generate --schema=../web/prisma/schema.prisma

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

# Set ownership
RUN chown -R scheduler:nodejs /app

USER scheduler

# Start the scheduler service
CMD ["npm", "start"]
