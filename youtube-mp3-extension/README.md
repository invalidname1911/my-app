# YouTube to MP3 Chrome Extension

A Chrome extension that adds a one-click MP3 download button to YouTube videos.

## Features

- 🎵 One-click MP3 download button on YouTube video pages
- 📊 Real-time conversion progress tracking
- 📜 Download history
- ⚙️ Configurable audio quality (64-320 kbps)
- 🔧 Custom backend URL support

## Development

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

### Setup

```bash
cd youtube-mp3-extension
pnpm install
```

### Development Mode

```bash
pnpm dev
```

Then load the extension in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

### Build for Production

```bash
# Build with default localhost backend
pnpm build

# Build with production backend
pnpm build:prod
```

## Project Structure

```
youtube-mp3-extension/
├── src/
│   ├── background/       # Service worker (API calls, downloads)
│   ├── content/          # YouTube page injection
│   ├── popup/            # Extension popup UI
│   └── shared/           # Shared types, API client, storage
├── public/
│   └── icons/            # Extension icons
└── dist/                 # Built extension (load this in Chrome)
```

## Configuration

The extension connects to your backend API. Configure the backend URL in the extension settings or set the `VITE_API_BASE_URL` environment variable during build.

## Icons

Add your extension icons to `public/icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## Testing

```bash
pnpm test
```
