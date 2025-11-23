# 1) Base with ffmpeg and yt-dlp
FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg python3 python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir yt-dlp --break-system-packages

# 2) Install deps with pnpm
FROM base AS deps
WORKDIR /app
RUN npm i -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# 3) Build Next.js (standalone)
FROM base AS builder
WORKDIR /app
RUN npm i -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure next.config.mjs has: export default { output: 'standalone' }
RUN pnpm run build

# 4) Runtime: minimal files + non-root
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
# Copy standalone server and static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
# Copy startup scripts directly from build context
COPY bin ./bin
# Make scripts executable and create temp directory with proper permissions
RUN chmod +x /app/bin/*.sh && \
  mkdir -p /tmp/ffmpeg-web && \
  chmod 777 /tmp/ffmpeg-web
USER node
ENV PORT=3000
ENV ENABLE_YOUTUBE=true
EXPOSE 3000
CMD ["/app/bin/start.sh"]