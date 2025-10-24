 # Plan: Dockerized Deployment on Railway (Free Tier)

 ## Overview
 - Package the Next.js app into a Docker image that includes ffmpeg and yt-dlp, build with pnpm, and run the standalone Next.js server binding to Railway’s `$PORT`.
 - Deploy via Railway by connecting the GitHub repo (preferred) or using the CLI; configure env vars and optional persistence.

 ## Dockerfile (multi-stage, small, with ffmpeg + yt-dlp)
 ```Dockerfile
 # 1) Base with ffmpeg and yt-dlp
 FROM node:20-bookworm-slim AS base
 ENV NODE_ENV=production
 RUN apt-get update && apt-get install -y --no-install-recommends \
     ffmpeg python3 python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/*
 RUN pip3 install --no-cache-dir yt-dlp

 # 2) Install deps with pnpm
 FROM base AS deps
 WORKDIR /app
 COPY package.json pnpm-lock.yaml ./
 RUN npm i -g pnpm && pnpm install --frozen-lockfile

 # 3) Build Next.js (standalone)
 FROM base AS builder
 WORKDIR /app
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
 ENV PORT=3000 HOST=0.0.0.0
 EXPOSE 3000
 CMD ["node", "server.js"]
 ```

 ## .dockerignore
 ```gitignore
 .git
 node_modules
 .next/cache
 dist
 tests
 temp
 coverage
 *.log
 Dockerfile
 pnpm-store
 ```

 ## Railway Setup
 - Connect repo with Dockerfile to Railway (New Project → Deploy from GitHub), or use CLI: `railway login`, `railway init`, `railway up`.
 - Railway sets `PORT`; the image binds to `0.0.0.0:$PORT` via `server.js` automatically.
 - Set environment variables as needed: `NODE_ENV=production` and any `NEXT_PUBLIC_*` your app uses.
 - Persistence: Free tier storage is ephemeral; if you need durable history, add a Railway Postgres (free) and point your app to it. Volumes may not be available/ideal on free.
 - Health check: use `/` (default) and verify cold start behavior; free tier can sleep when idle.

 ## Local Test (optional but recommended)
 - Build: `docker build -t ffmpeg-web:latest .`
 - Run: `docker run -p 3000:3000 -e PORT=3000 ffmpeg-web:latest`
 - Verify: app loads; `ffmpeg -version` and `yt-dlp --version` work inside container if needed.

 ## Next Steps
 - Implement the Dockerfile and .dockerignore, update `next.config.mjs` to `output: 'standalone'`, then deploy via Railway and verify end-to-end.
