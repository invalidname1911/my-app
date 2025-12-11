# Plan: Hybrid YouTube to MP3 Chrome Extension

## Overview

A Chrome extension that provides a seamless YouTube to MP3 conversion experience by combining a lightweight browser extension with your existing backend infrastructure. The extension handles UI/UX and YouTube page integration, while the backend (your deployed Railway app) handles the heavy lifting of audio extraction.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Extension                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Popup UI   │  │  Content    │  │  Background Service     │  │
│  │  (React)    │  │  Script     │  │  Worker                 │  │
│  │             │  │  (YouTube   │  │  (API calls, download   │  │
│  │  - Queue    │  │   page      │  │   management)           │  │
│  │  - History  │  │   inject)   │  │                         │  │
│  │  - Settings │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (Railway) ✅ ALREADY EXISTS           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Next.js API Routes (implemented)                           ││
│  │  - POST /api/youtube-to-mp3   → Start conversion, get jobId ││
│  │  - GET  /api/jobs/[id]        → Check job status & progress ││
│  │  - GET  /api/jobs/[id]?download=1 → Download MP3 file       ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  yt-dlp + ffmpeg (audio extraction & conversion)            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Your Existing Backend API ✅ (what exists today)

Your Next.js app already has:

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/youtube-to-mp3` | POST | `{ url: string, bitrate?: number }` | `{ jobId: string, title?: string, duration?: string, thumbnail?: string }` *(requires `ENABLE_YOUTUBE=true`)* |
| `/api/jobs/[id]` | GET | - | `{ status: JobStatus, progress?: number, downloadUrl?: string, error?: string }` |
| `/api/jobs/[id]?download=1` | GET | - | MP3 file stream with proper headers |

**Job Status Flow:** `queued` → `running` → `done` / `error` (processing starts immediately inside the request; there is no background worker)

**Features:**
- In-memory job tracking with JSON persistence for metadata (completed/error jobs survive restarts, but in-progress work does not resume after a restart)
- Progress tracking (0-50% download, 50-100% conversion)
- Automatic cleanup of old jobs/files (24 hours, production only)
- Video metadata extraction (title, duration, thumbnail)
- Bitrate options: 64-320 kbps (default: 192)
- yt-dlp auto-updates every 24 hours **when started via `bin/start.sh` (Docker entrypoint); not run during `next dev`/`next start`**
- Cookie support for age-restricted videos

## Why Hybrid?

| Approach | Pros | Cons |
|----------|------|------|
| **Client-only** | No server costs, works offline | Can't run yt-dlp/ffmpeg in browser, relies on unstable 3rd-party APIs |
| **Server-only** | Full control, reliable | Requires user to visit web app, no YouTube page integration |
| **Hybrid** ✓ | Best UX, reliable backend, YouTube page integration | Requires server, but you already have one |

## Extension Components

### 1. Manifest (manifest.json)
```json
{
  "manifest_version": 3,
  "name": "YouTube to MP3",
  "version": "1.0.0",
  "description": "Convert YouTube videos to MP3 with one click",
  "permissions": [
    "activeTab",
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://your-app.railway.app/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/watch*"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 2. Content Script (YouTube Page Integration)
Injects a "Download MP3" button directly on YouTube video pages.

```typescript
// content.ts - Injected into YouTube pages
class YouTubeMP3Button {
  private button: HTMLButtonElement | null = null;
  
  init() {
    // YouTube uses SPA navigation, watch for URL changes
    this.observeNavigation();
    this.injectButton();
  }
  
  private observeNavigation() {
    // Re-inject button on YouTube SPA navigation
    const observer = new MutationObserver(() => {
      if (window.location.pathname === '/watch' && !this.button) {
        this.injectButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  private injectButton() {
    const actionsContainer = document.querySelector('#actions');
    if (!actionsContainer || this.button) return;
    
    this.button = document.createElement('button');
    this.button.className = 'yt-mp3-download-btn';
    this.button.innerHTML = '🎵 MP3';
    this.button.onclick = () => this.handleDownload();
    
    actionsContainer.appendChild(this.button);
  }
  
  private async handleDownload() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) return;
    
    this.button!.disabled = true;
    this.button!.innerHTML = '⏳ Converting...';
    
    // Send message to background worker
    chrome.runtime.sendMessage({
      action: 'convert',
      videoId,
      url: window.location.href
    });
  }
}

new YouTubeMP3Button().init();
```

### 3. Background Service Worker
Handles API communication and download management using your existing API.

```typescript
// background.ts
const API_BASE = 'https://your-app.railway.app'; // Your Railway deployment

interface ConversionState {
  jobId: string;
  title?: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number;
}

const activeJobs = new Map<string, ConversionState>();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'convert') {
    handleConversion(message.url, sender.tab?.id);
  }
  return true;
});

async function handleConversion(url: string, tabId?: number) {
  try {
    // 1. Start conversion job using YOUR existing API
    const response = await fetch(`${API_BASE}/api/youtube-to-mp3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, bitrate: 192 })
    });
    
    const { jobId, title, thumbnail } = await response.json();
    activeJobs.set(jobId, { jobId, title, status: 'pending', progress: 0 });
    
    // 2. Poll for completion using YOUR existing jobs API
    const result = await pollJobStatus(jobId);
    
    // 3. Trigger download
    if (result.downloadUrl) {
      const filename = sanitizeFilename(title || jobId) + '.mp3';
      chrome.downloads.download({
        url: `${API_BASE}${result.downloadUrl}`,
        filename
      });
      
      // Notify content script
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { 
          action: 'conversionComplete', 
          success: true,
          title
        });
      }
    }
  } catch (error: any) {
    console.error('Conversion failed:', error);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { 
        action: 'conversionComplete', 
        success: false,
        error: error.message 
      });
    }
  }
}

async function pollJobStatus(jobId: string, maxAttempts = 120): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    // Use YOUR existing /api/jobs/[id] endpoint
    const response = await fetch(`${API_BASE}/api/jobs/${jobId}`);
    const data = await response.json();
    
    // Update local state for UI
    activeJobs.set(jobId, { 
      ...activeJobs.get(jobId)!, 
      status: data.status, 
      progress: data.progress || 0
    });
    
    // Your backend returns: { status: 'queued' | 'running' | 'done' | 'error', progress?, downloadUrl?, error? }
    if (data.status === 'done') return data;
    if (data.status === 'error') throw new Error(data.error || 'Conversion failed');
    
    await new Promise(r => setTimeout(r, 2000)); // Poll every 2s (matches your web app)
  }
  throw new Error('Conversion timeout');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').substring(0, 200);
}
```

### 4. Popup UI
Quick access to conversion queue, history, and settings.

```
extension/
├── popup/
│   ├── popup.html
│   ├── popup.tsx        # React app
│   ├── components/
│   │   ├── Queue.tsx    # Active conversions
│   │   ├── History.tsx  # Past downloads
│   │   └── Settings.tsx # Quality, format options
│   └── styles.css
```

## Backend: Gaps to close

Current state:
- ✅ YouTube download & conversion (`lib/youtube.ts`, `lib/ffmpeg.ts`)
- ✅ Progress tracking (0-100%)
- ✅ File streaming with proper headers
- ✅ Auto-cleanup of old files (production)
- ⚠️ Job handling is in-process; no worker queue and no resume of in-flight jobs after restart (`lib/jobs.ts`)
- ⚠️ `ENABLE_YOUTUBE=true` is required or `/api/youtube-to-mp3` returns 403
- ⚠️ CORS headers are **not yet** configured in `next.config.mjs`
- ⚠️ yt-dlp auto-update runs only when starting via `bin/start.sh` (Docker), not during `next dev`/`next start`

### Add CORS to next.config.mjs (pending)
```javascript
// my-app/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  
  // Add CORS headers for Chrome extension
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Or specific extension ID: chrome-extension://YOUR_EXTENSION_ID
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

## Implementation Phases

### Phase 1: Backend CORS & toggles (~30 min)
- [x] Add CORS headers for extension origin (see above) in `next.config.mjs`
- [x] Ensure `ENABLE_YOUTUBE=true` in your deployment/runtime
- [x] Test API endpoints work from browser console on different origin

### Phase 2: Extension Core ✅ COMPLETE
- [x] Set up extension project structure (Vite + React + TypeScript)
- [x] Create manifest.json with required permissions
- [x] Implement background service worker with API integration
- [x] Implement content script for YouTube page button injection
- [x] Handle YouTube SPA navigation

### Phase 3: Popup UI ✅ COMPLETE (included in Phase 2)
- [x] Build popup with React
- [x] Conversion queue display
- [x] Download history (stored in chrome.storage)
- [x] Settings panel (quality, format preferences)

### Phase 4: Polish & Publish
- [ ] Error handling and user feedback
- [ ] Loading states and progress indicators
- [ ] Extension icons and branding
- [ ] Chrome Web Store listing preparation
- [ ] Privacy policy (required for Web Store)


## Extension Project Structure

```
youtube-mp3-extension/
├── src/
│   ├── background/
│   │   └── index.ts          # Service worker
│   ├── content/
│   │   ├── index.ts          # YouTube page injection
│   │   └── styles.css        # Button styling
│   ├── popup/
│   │   ├── index.html
│   │   ├── App.tsx           # React popup UI
│   │   ├── components/
│   │   │   ├── Queue.tsx     # Active conversions
│   │   │   ├── History.tsx   # Past downloads
│   │   │   └── Settings.tsx  # Bitrate/quality settings
│   │   └── hooks/
│   │       └── useJobs.ts    # Job polling hook
│   ├── shared/
│   │   ├── api.ts            # API client for your backend
│   │   ├── storage.ts        # chrome.storage wrapper
│   │   └── types.ts          # Shared types (JobStatus, etc.)
│   └── manifest.json
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── vite.config.ts            # Build config for extension
├── package.json
└── tsconfig.json
```

**Tech Stack:**
- Vite + React 19 + TypeScript (matches your web app)
- @crxjs/vite-plugin for Chrome extension bundling
- Tailwind CSS v4 (to match your web app styling)
- Radix UI components (reuse from your web app)

## Shared Types (Extension & Backend)

```typescript
// shared/types.ts - Matches your backend types
export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface Job {
  id: string;
  status: JobStatus;
  progress?: number;
  inputPath: string;
  outputPath?: string;
  error?: string;
  target: 'mp4' | 'mp3';
  bitrate?: number;
  originalName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface YouTubeConversionRequest {
  url: string;
  bitrate?: number; // 64-320 kbps, default 192
}

export interface YouTubeConversionResponse {
  jobId: string;
  title?: string;
  duration?: string;
  thumbnail?: string;
}

export interface JobStatusResponse {
  status: JobStatus;
  progress?: number;
  downloadUrl?: string; // e.g., "/api/jobs/abc123?download=1"
  error?: string;
}
```

## Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html'
      }
    }
  }
});
```

## Security Considerations

1. **API Authentication**: Consider adding API keys or rate limiting
2. **CORS**: Only allow requests from your extension's origin
3. **Input Validation**: Sanitize all YouTube URLs server-side
4. **Rate Limiting**: Prevent abuse with per-IP or per-user limits
5. **Content Security Policy**: Strict CSP in extension manifest

## Chrome Web Store Requirements

1. **Privacy Policy**: Required - explain data handling
2. **Single Purpose**: Extension must have one clear purpose
3. **Minimal Permissions**: Only request necessary permissions
4. **No Remote Code**: All code must be bundled in extension
5. **Clear Description**: Accurate store listing

## Cost Considerations

| Component | Cost |
|-----------|------|
| Railway Backend | Free tier (500 hours/month) or ~$5/month |
| Chrome Web Store | $5 one-time developer fee |
| Domain (optional) | ~$12/year |

## Environment Configuration

### Extension Config
```typescript
// src/shared/config.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-app.railway.app';
export const POLL_INTERVAL = 2000; // 2 seconds (matches your web app)
export const MAX_POLL_ATTEMPTS = 120; // 4 minutes max
export const DEFAULT_BITRATE = 192; // kbps
```

### Build for Different Environments
```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:prod": "VITE_API_BASE_URL=https://your-app.railway.app vite build",
    "build:local": "VITE_API_BASE_URL=http://localhost:3000 vite build"
  }
}
```

### Alternative: Self-Hosted Backend URL

For users who want to self-host, add a settings option:

```typescript
// In popup settings component
const [backendUrl, setBackendUrl] = useState(
  localStorage.getItem('backendUrl') || API_BASE_URL
);

// Save to chrome.storage.local for persistence
chrome.storage.local.set({ backendUrl });
```

This allows power users to point the extension at their own Railway deployment.

## Testing Your Backend API

Before building the extension, verify your API works cross-origin:

```bash
# Test conversion start
curl -X POST https://your-app.railway.app/api/youtube-to-mp3 \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","bitrate":192}'

# Response: {"jobId":"abc123...","title":"...","duration":"3:33","thumbnail":"..."}

# Test job status
curl https://your-app.railway.app/api/jobs/abc123

# Response: {"status":"running","progress":45}

# Test download (when done)
curl https://your-app.railway.app/api/jobs/abc123?download=1 -o test.mp3
```

## Next Steps

1. **Add CORS headers** to `next.config.mjs` (see above)
2. **Deploy to Railway** and test API with curl
3. **Set up extension project** with Vite + CRXJS + React
4. **Build content script** for YouTube button injection
5. **Build background worker** for API communication
6. **Build popup UI** for queue/history/settings
7. **Test locally** with `chrome://extensions` (Load unpacked)
8. **Publish to Chrome Web Store**

## Reusing Your Web App Components

You can reuse components from your existing web app:
- `components/ui/*` - Radix UI components (Button, Select, Progress, etc.)
- `lib/utils.ts` - Utility functions
- Tailwind config and styling
- TypeScript types for Job, JobStatus, etc.

This ensures consistent UX between web app and extension!

---

*This hybrid approach leverages your existing Railway deployment while providing the best user experience through native YouTube integration.*
