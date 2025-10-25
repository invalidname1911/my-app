# 1) Base with ffmpeg and yt-dlp
FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir yt-dlp==2024.10.22 --break-system-packages

# 2) Install deps with pnpm
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile

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
# Copy standalone server and static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
USER node
ENV PORT=${PORT:-3000}
ENV HOST=0.0.0.0
ENV ENABLE_YOUTUBE=true
CMD ["node", "server.js"]