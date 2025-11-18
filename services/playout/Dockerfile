# Dockerfile for Lofield FM Playout Service
# Node.js service with ffmpeg for audio streaming and playout

FROM node:20-alpine AS base
WORKDIR /app

# Stage 1: Dependencies
FROM base AS deps

# Install ffmpeg and audio processing tools
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM base AS builder

# Install ffmpeg for build (needed by fluent-ffmpeg)
RUN apk add --no-cache ffmpeg

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Note: Prisma schema is expected to be in ../web/prisma relative to build context
# docker-compose should set build context to repo root with dockerfile path specified
RUN npx prisma generate --schema=../web/prisma/schema.prisma

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

# Set ownership
RUN chown -R playout:nodejs /app

USER playout

# Start the playout service
CMD ["npm", "start"]
