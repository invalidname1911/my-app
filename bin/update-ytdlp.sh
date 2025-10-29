#!/bin/bash

# Background script to keep yt-dlp updated
# Runs every 24 hours to ensure latest version

echo "[yt-dlp-updater] Starting yt-dlp auto-update service..."

while true; do
  echo "[yt-dlp-updater] Updating yt-dlp to latest version..."
  
  # Update yt-dlp
  if pip3 install --upgrade --no-cache-dir yt-dlp --break-system-packages 2>&1; then
    NEW_VERSION=$(yt-dlp --version 2>/dev/null || echo "unknown")
    echo "[yt-dlp-updater] Successfully updated to version: $NEW_VERSION"
  else
    echo "[yt-dlp-updater] Failed to update yt-dlp, will retry in 24 hours"
  fi
  
  # Wait 24 hours before next update
  echo "[yt-dlp-updater] Next update in 24 hours..."
  sleep 86400
done
