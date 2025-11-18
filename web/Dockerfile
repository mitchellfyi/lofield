# Multi-stage Dockerfile for Lofield FM Web Service (Next.js 16)
# Build optimized production image with non-root user
# Note: Build context should be repository root

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files from web directory
COPY web/package.json web/package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy web source
COPY web ./

# Copy config directory (needed for build-time static generation)
COPY config ../config

# Set dummy DATABASE_URL for Prisma Client generation (not used at build time)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy config directory for runtime access
COPY --from=builder /config ../config

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
