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
 RUN pip3 install --no-cache-dir yt-dlp==2024.10.22

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
 ENV HOSTNAME="0.0.0.0"
 # Copy standalone server and static assets
 COPY --from=builder /app/.next/standalone ./
 COPY --from=builder /app/public ./public
 COPY --from=builder /app/.next/static ./.next/static
 # Copy startup scripts (includes yt-dlp auto-updater)
 COPY --from=builder /app/bin ./bin
 # Make scripts executable and create temp directory with proper permissions
 RUN chmod +x /app/bin/*.sh && \
     mkdir -p /tmp/ffmpeg-web && \
     chmod 777 /tmp/ffmpeg-web
 USER node
 ENV PORT=3000
 ENV ENABLE_YOUTUBE=true
 EXPOSE 3000
 # Start script runs both Node.js server and yt-dlp background updater
 CMD ["/app/bin/start.sh"]
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
 .nyc_output
 *.log
 .env*
 Dockerfile
 pnpm-store
 # Keep bin directory - contains startup scripts
 !bin/
 ```

 ## Railway Setup

### Deployment Methods
**Option 1: GitHub Integration (Recommended)**
1. Push your code to GitHub repository
2. Go to Railway dashboard → New Project → Deploy from GitHub repo
3. Railway automatically detects Dockerfile and builds

**Option 2: CLI Deployment**
```bash
railway login
railway init
railway up
```

### Environment Variables

**Required Railway Variables:**
- `PORT` (automatically provided by Railway)
- `NODE_ENV=production`

**Your App-Specific Variables:**
- `NEXT_PUBLIC_*` variables for client-side usage
- Any custom environment variables your app requires

**YouTube Cookie Support (for age-restricted videos):**
- **Option 1: Base64 cookies (recommended for Railway):**
  1. Export cookies from your browser on your local machine:
     ```bash
     # For Chrome
     yt-dlp --cookies-from-browser chrome --dump-cookies youtube-cookies.txt https://www.youtube.com
     
     # For Brave/Edge/Firefox/Safari, replace 'chrome' with 'brave', 'edge', 'firefox', or 'safari'
     ```
  2. Encode to base64:
     ```bash
     base64 youtube-cookies.txt | tr -d '\n' > youtube-cookies.b64
     ```
  3. In Railway dashboard → Variables, set:
     - `YT_DLP_COOKIES_B64` = contents of `youtube-cookies.b64` file
  4. Redeploy. The startup script will automatically decode and use the cookies.

- **Option 2: Railway Volume (alternative):**
  1. Create a Railway Volume in your project
  2. Upload your cookies file to the volume
  3. In Railway dashboard → Variables, set:
     - `YT_DLP_COOKIES` = path to cookies file in volume (e.g., `/data/youtube-cookies.txt`)

**Note:** Cookies may expire periodically. When videos fail with "sign in to confirm" errors, re-export cookies and update the Railway variable.

**Build-time Configuration:**
- Railway automatically detects and uses your Dockerfile
- No additional build configuration needed beyond the Dockerfile itself

### Persistence & Storage
- **Free tier**: Ephemeral storage only (files deleted on redeploy/restart)
- **Persistent data**: Add Railway Postgres (free tier available) for database storage
- **File uploads**: Consider external storage (AWS S3, Railway Volumes) if needed

### Health Monitoring
- **Health check endpoint**: `/api/health` (already implemented in your app)
- **Cold start behavior**: First request may take 10-30 seconds on Railway free tier
- **Sleeping**: Free tier apps sleep after 15 minutes of inactivity
- **Logs**: Use `railway logs` command or Railway dashboard for debugging

### yt-dlp Auto-Update Feature
- **Background updater**: Runs every 24 hours to keep yt-dlp current
- **YouTube bot detection**: Latest yt-dlp versions include fixes for YouTube's changing API
- **No rebuild needed**: Updates happen automatically while container is running
- **Logging**: Check logs for `[yt-dlp-updater]` messages to verify updates
- **Cookie support**: Both `getYouTubeVideoInfo` and `downloadYouTubeAudio` use cookies when provided via `YT_DLP_COOKIES` (or `YT_DLP_COOKIES_B64`). See Environment Variables section above for setup instructions.

 ## Local Test (optional but recommended)

### Docker Build & Run
```bash
# Build the image
docker build -t ffmpeg-web:latest .

# Test with Railway-like environment (recommended)
docker run -p 3000:3000 -e PORT=3000 -e NODE_ENV=production ffmpeg-web:latest

# Test with default PORT (fallback to 3000)
docker run -p 3000:3000 ffmpeg-web:latest
```

### Verification Steps
- **App loads**: Navigate to `http://localhost:3000`
- **Tools installed**:
 ```bash
 docker exec -it <container-id> ffmpeg -version
 docker exec -it <container-id> yt-dlp --version
 ```
- **API health**: Check `http://localhost:3000/api/health`
- **Next.js standalone**: Verify server.js is running correctly

 ## Next Steps

### Pre-Deployment Checklist
- [ ] Update `next.config.mjs` with `output: 'standalone'`
- [ ] Create Dockerfile based on the provided template
- [ ] Create/Update `.dockerignore` file
- [ ] Test locally with Docker using the provided commands

### Deployment Steps
1. **Create GitHub repository** (if not already done)
2. **Push code** to GitHub repository
3. **Connect to Railway**:
  - Go to [railway.app](https://railway.app)
  - Create new project → "Deploy from GitHub repo"
  - Select your repository
4. **Configure environment variables** in Railway dashboard:
  - `NODE_ENV=production`
  - Any `NEXT_PUBLIC_*` variables your app requires
5. **Deploy and verify**:
  - Railway will automatically build and deploy
  - Check logs: `railway logs`
  - Test health endpoint: `https://your-app.railway.app/api/health`
  - Verify the app loads at the provided URL

### Post-Deployment Monitoring
- Monitor cold start times (may be 10-30 seconds initially)
- Check Railway dashboard for resource usage
- Monitor for any build or runtime errors
- Consider upgrading if you hit free tier limits
