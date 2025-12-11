# Chrome Extension Quick Start

Quick reference for building the YouTube to MP3 Chrome extension using your existing backend.

## Your Backend is Ready ✅

You already have:
- ✅ `/api/youtube-to-mp3` - Start conversion
- ✅ `/api/jobs/[id]` - Check status & download
- ✅ Job queue with progress tracking
- ✅ yt-dlp + ffmpeg conversion
- ✅ Auto-cleanup & persistence

## What You Need to Build

### 1. Add CORS (~5 min)

```javascript
// my-app/next.config.mjs - Add this:
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
      ],
    },
  ];
},
```

### 2. Create Extension Project (~1 day)

```bash
npm create vite@latest youtube-mp3-extension -- --template react-ts
cd youtube-mp3-extension
npm install @crxjs/vite-plugin
```

### 3. Key Files to Create

**manifest.json** - Extension config
```json
{
  "manifest_version": 3,
  "name": "YouTube to MP3",
  "permissions": ["activeTab", "storage", "downloads"],
  "host_permissions": ["https://www.youtube.com/*", "https://your-app.railway.app/*"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{ "matches": ["https://www.youtube.com/watch*"], "js": ["content.js"] }]
}
```

**background.ts** - API calls
```typescript
// Calls your /api/youtube-to-mp3 and /api/jobs/[id]
// Polls every 2 seconds for status
// Triggers chrome.downloads.download() when done
```

**content.ts** - YouTube button
```typescript
// Injects "🎵 MP3" button on YouTube video pages
// Sends message to background worker on click
```

**popup/** - React UI
```typescript
// Shows active conversions, history, settings
// Reuse your Radix UI components from web app
```

## API Usage Example

```typescript
// 1. Start conversion
const response = await fetch('https://your-app.railway.app/api/youtube-to-mp3', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://youtube.com/watch?v=...', bitrate: 192 })
});
const { jobId, title, duration, thumbnail } = await response.json();

// 2. Poll for status
const status = await fetch(`https://your-app.railway.app/api/jobs/${jobId}`);
const { status, progress, downloadUrl, error } = await status.json();
// status: 'queued' | 'running' | 'done' | 'error'
// progress: 0-100

// 3. Download when done
if (status === 'done') {
  chrome.downloads.download({
    url: `https://your-app.railway.app${downloadUrl}`,
    filename: `${title}.mp3`
  });
}
```

## Timeline

- ✅ Backend: Already done
- 🔧 CORS: 5 minutes
- 📦 Extension setup: 2-3 days
- 🎨 Popup UI: 1-2 days
- 🧪 Testing & polish: 1-2 days
- 📤 Chrome Web Store: 1 day

**Total: ~5-7 days**

## Resources

- Full plan: `CHROME_EXTENSION_HYBRID_PLAN.md`
- Your backend code: `app/api/youtube-to-mp3/route.ts`, `app/api/jobs/[id]/route.ts`
- Job system: `lib/jobs.ts`
- Chrome Extension docs: https://developer.chrome.com/docs/extensions/
- @crxjs/vite-plugin: https://crxjs.dev/vite-plugin/
