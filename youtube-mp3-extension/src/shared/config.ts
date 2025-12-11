// Extension configuration

export const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const POLL_INTERVAL = 2000; // 2 seconds (matches web app)
export const MAX_POLL_ATTEMPTS = 120; // 4 minutes max
export const DEFAULT_BITRATE = 192; // kbps

export const BITRATE_OPTIONS = [
  { value: 64, label: '64 kbps (Low)' },
  { value: 128, label: '128 kbps (Medium)' },
  { value: 192, label: '192 kbps (High)' },
  { value: 256, label: '256 kbps (Very High)' },
  { value: 320, label: '320 kbps (Best)' },
];
