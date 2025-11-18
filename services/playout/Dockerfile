# Dockerfile for Lofield FM Playout Service
# Node.js service with ffmpeg for audio streaming and playout
# Note: Build context should be repository root

FROM node:20-alpine AS base
WORKDIR /app

# Stage 1: Dependencies
FROM base AS deps

# Install ffmpeg and audio processing tools
RUN apk add --no-cache ffmpeg

# Copy package files from playout directory
COPY services/playout/package.json services/playout/package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM base AS builder

# Install ffmpeg for build (needed by fluent-ffmpeg)
RUN apk add --no-cache ffmpeg

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy playout source
COPY services/playout ./

# Copy Prisma schema from web directory
COPY web/prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Stage 3: Runner
FROM base AS runner

ENV NODE_ENV=production

# Install ffmpeg in runner stage (required at runtime)
RUN apk add --no-cache ffmpeg

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 playout

# Create directories for output
RUN mkdir -p /var/lofield/stream /var/lofield/archive
RUN chown -R playout:nodejs /var/lofield

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/*.json ./
COPY --from=builder /app/prisma ./prisma

# Set ownership
RUN chown -R playout:nodejs /app

USER playout

# Start the playout service
CMD ["npm", "start"]
