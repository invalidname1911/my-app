#!/bin/bash

# Entrypoint script that runs both Node.js server and yt-dlp updater

echo "[start] Starting services..."

# Show initial yt-dlp version
YTDLP_VERSION=$(yt-dlp --version 2>/dev/null || echo "not found")
echo "[start] Initial yt-dlp version: $YTDLP_VERSION"

# Start yt-dlp updater in background
if [ -f /app/bin/update-ytdlp.sh ]; then
  echo "[start] Starting yt-dlp auto-updater in background..."
  bash /app/bin/update-ytdlp.sh &
else
  echo "[start] Warning: yt-dlp updater script not found at /app/bin/update-ytdlp.sh"
fi

# Start Node.js server (foreground process)
echo "[start] Starting Node.js server..."
exec node server.js
