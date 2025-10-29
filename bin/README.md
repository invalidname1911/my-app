# Docker Startup Scripts

This directory contains scripts used by the Docker container to manage services.

## Scripts

### `start.sh`
Main entrypoint script that orchestrates the container startup:
- Starts the yt-dlp auto-updater in the background
- Starts the Node.js server (Next.js standalone) in the foreground
- Displays the initial yt-dlp version on startup

### `update-ytdlp.sh`
Background service that keeps yt-dlp up-to-date:
- Runs continuously in the background
- Updates yt-dlp every 24 hours
- Helps bypass YouTube's bot detection changes
- Logs update status with `[yt-dlp-updater]` prefix

## Why Auto-Update yt-dlp?

YouTube frequently changes their API and bot detection mechanisms to block automated downloads. The yt-dlp project is very active and releases updates to counter these changes. By automatically updating yt-dlp every 24 hours, the container stays current without requiring a full rebuild.

## Logs

When the container starts, you'll see:
```
[start] Starting services...
[start] Initial yt-dlp version: 2024.10.29
[start] Starting yt-dlp auto-updater in background...
[start] Starting Node.js server...
[yt-dlp-updater] Starting yt-dlp auto-update service...
```

Every 24 hours, you'll see:
```
[yt-dlp-updater] Updating yt-dlp to latest version...
[yt-dlp-updater] Successfully updated to version: 2024.10.30
[yt-dlp-updater] Next update in 24 hours...
```

## Manual Updates

If you need to manually update yt-dlp inside a running container:
```bash
# Enter the container
docker exec -it <container-id> bash

# Update yt-dlp
pip3 install --upgrade yt-dlp --break-system-packages

# Verify version
yt-dlp --version
```
