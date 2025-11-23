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

# If YT_DLP_COOKIES_B64 is set, materialize it to a file and export YT_DLP_COOKIES
if [ -n "$YT_DLP_COOKIES_B64" ]; then
  echo "[start] Materializing yt-dlp cookies from base64"
  COOKIES_PATH=/tmp/ytdlp-cookies.txt
  echo "$YT_DLP_COOKIES_B64" | base64 -d > "$COOKIES_PATH" || {
    echo "[start] Failed to decode YT_DLP_COOKIES_B64"; exit 1; }
  export YT_DLP_COOKIES="$COOKIES_PATH"
fi

# Start Node.js server (foreground process)
echo "[start] Starting Node.js server..."
exec node server.js
