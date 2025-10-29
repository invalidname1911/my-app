# yt-dlp Auto-Update Implementation

## Problem
YouTube frequently changes their API and bot detection mechanisms, causing downloads to fail with errors like:
```
ERROR: [youtube] Sign in to confirm you're not a bot
Video is age-restricted or requires sign-in
```

## Solution
Implemented automatic yt-dlp updates every 24 hours while the container is running, ensuring the latest version with YouTube API fixes is always available without requiring a rebuild.

## Implementation Details

### 1. Background Update Script (`bin/update-ytdlp.sh`)
- Runs continuously in the background
- Updates yt-dlp every 24 hours using `pip3 install --upgrade yt-dlp`
- Logs update status with `[yt-dlp-updater]` prefix
- Handles update failures gracefully and retries after 24 hours

### 2. Startup Script (`bin/start.sh`)
- Orchestrates container startup
- Displays initial yt-dlp version
- Starts the update script in the background
- Starts Node.js server in the foreground

### 3. Dockerfile Changes
- Copies `bin/` directory to container
- Makes scripts executable
- Changes CMD to use `/app/bin/start.sh` instead of direct `node server.js`

### 4. Documentation Updates
- Updated `DOCKER_RAILWAY_DEPLOYMENT.md` with auto-update information
- Created `bin/README.md` explaining the scripts
- Added cookie support documentation for age-restricted videos

## Benefits

1. **No Rebuild Required**: Updates happen automatically while container runs
2. **Always Current**: Container gets latest yt-dlp fixes within 24 hours
3. **Zero Downtime**: Updates happen in background without restarting the server
4. **Handles Long-Running Containers**: Perfect for Railway deployments that run for days/weeks

## Logs

### Startup
```
[start] Starting services...
[start] Initial yt-dlp version: 2025.10.22
[start] Starting yt-dlp auto-updater in background...
[start] Starting Node.js server...
[yt-dlp-updater] Starting yt-dlp auto-update service...
```

### Every 24 Hours
```
[yt-dlp-updater] Updating yt-dlp to latest version...
[yt-dlp-updater] Successfully updated to version: 2025.10.23
[yt-dlp-updater] Next update in 24 hours...
```

## Testing

Successfully tested locally:
```bash
# Build
docker build -t ffmpeg-web-test:latest .

# Run
docker run -p 3001:3000 ffmpeg-web-test:latest

# Verify yt-dlp version
docker exec <container-id> yt-dlp --version

# Check logs
docker logs <container-id>
```

## Future Enhancements

### Cookie Authentication (For Age-Restricted Videos)
If auto-updates don't solve bot detection:

1. Export YouTube cookies from browser using "Get cookies.txt LOCALLY" extension
2. Mount cookies file in Docker: `-v /path/to/cookies.txt:/app/cookies.txt`
3. Set environment variable: `YT_DLP_COOKIES=/app/cookies.txt`

**Note**: Cookies expire after 30-180 days and need manual refresh.

### OAuth Authentication (Long-Term)
- Run `yt-dlp --username oauth --password ''` to generate OAuth tokens
- Store tokens in volume for persistence
- Tokens auto-refresh and last ~6 months

## Deployment

On Railway:
1. Push changes to GitHub
2. Railway automatically detects Dockerfile changes and rebuilds
3. Container starts with auto-update enabled
4. Monitor logs for `[yt-dlp-updater]` messages

No additional configuration needed - it works out of the box!
