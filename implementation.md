# FFmpeg Web – Implementation Guide (MVP)

Use this file to drive the agent to implement a minimal, working MVP: upload a file, convert to mp4/mp3 with simple presets, track status, and download the result. Keep scope tight; add optional YouTube only after MVP works.

## Prerequisites
- Next.js app router project already initialized.
- Node.js 18+.
- Package manager: pnpm (adjust if using npm/yarn).

## Acceptance Criteria (MVP)
- Can upload a media file (< 200MB) via `POST /api/upload` and receive `{ fileId }`.
- Can start a conversion via `POST /api/convert` with `{ fileId, target: 'mp4'|'mp3', preset?: 'web'|'mobile' }` and receive `{ jobId }`.
- Can poll `GET /api/jobs/{jobId}` to see `{ status, progress }` and, when done, a `downloadUrl`.
- Can download the converted file via `GET /api/jobs/{jobId}?download=1`.
- Clear errors for invalid input, missing file, or failed conversion.

## Task Plan

1) Dependencies
- Run: `pnpm add @ts-ffmpeg/fluent-ffmpeg ffmpeg-static`
- Ensure TypeScript interop is fine (tsconfig `esModuleInterop: true`).

2) Temp Directory & Env
- Ensure `./temp` exists and is gitignored.
- Add `.env.local` with:
  - `TEMP_DIR=./temp`
  - `MAX_FILE_SIZE_MB=200`

3) Lib: File Helpers (`lib/file.ts`)
- Export:
  - `ensureTempDir(): Promise<string>`
  - `createTempPath(originalName: string): Promise<{ fileId: string; absPath: string; relPath: string; }>`
  - `resolveTempPath(fileId: string): string | null`
  - `cleanupOldFiles(maxAgeHours: number): Promise<number>`
- Behavior:
  - Use `process.env.TEMP_DIR || './temp'`.
  - Generate `fileId` (crypto random) and map to path.
  - Simple extension and size checks will live in upload route; this module only handles paths and cleanup.

4) Lib: Presets (`lib/presets.ts`)
- Export:
```ts
export const presets = {
  web:  { vcodec: 'libx264', acodec: 'aac', crf: 23, scale: '1280:720' },
  mobile:{ vcodec: 'libx264', acodec: 'aac', crf: 26, scale: '854:480' }
};
export type PresetKey = keyof typeof presets;
```

5) Lib: Jobs (`lib/jobs.ts`)
- Types:
```ts
export type JobStatus = 'queued'|'running'|'done'|'error';
export interface Job { id: string; status: JobStatus; progress?: number; inputPath: string; outputPath?: string; error?: string; target: 'mp4'|'mp3'; preset?: 'web'|'mobile'; }
```
- In-memory store: `const jobs = new Map<string, Job>();`
- Export:
  - `getJob(id: string): Job | undefined`
  - `setJob(job: Job): void`
  - `updateJob(id: string, patch: Partial<Job>): void`
  - `streamOutput(id: string): Promise<Response>` that streams file with appropriate headers.

6) Lib: FFmpeg Wrapper (`lib/ffmpeg.ts`)
- Initialize ffmpeg and set binary path from `ffmpeg-static`.
- Export async functions that return a Promise and accept a progress callback:
  - `convertToMp4(inputPath: string, outputPath: string, preset: PresetKey, onProgress?: (p:number)=>void): Promise<void>`
  - `extractAudioMp3(inputPath: string, outputPath: string, bitrateKbps: number, onProgress?: (p:number)=>void): Promise<void>`
- Use `command.on('progress', info => onProgress?.(info.percent ?? 0))` and handle resolve/reject on `end`/`error`.

7) API: Health (`app/api/health/route.ts`)
- `GET` returns `{ ok: true }` and confirms ffmpeg path is set.
- `export const runtime = 'nodejs'`.

8) API: Upload (`app/api/upload/route.ts`)
- `export const runtime = 'nodejs'`.
- Parse `await req.formData()`; expect a `file` field.
- Validate size against `MAX_FILE_SIZE_MB`; basic mime/extension allowlist: video/*, audio/* (mp4, mov, mkv, webm, mp3, wav, m4a, aac, flac).
- Write file bytes to `createTempPath(originalName).absPath`.
- Return `{ fileId, originalName, size }`.

9) API: Convert (`app/api/convert/route.ts`)
- `export const runtime = 'nodejs'`.
- Body JSON: `{ fileId, target: 'mp4'|'mp3', preset?: 'web'|'mobile' }`.
- Resolve input path from `fileId`. Create a new job with `status: 'queued'` and add to store.
- Kick off processing asynchronously:
  - For `mp4`: determine output name/path, call `convertToMp4` with selected preset.
  - For `mp3`: call `extractAudioMp3` with a sensible bitrate (e.g., 192 kbps).
  - Update job status and progress as callbacks fire.
- Return `{ jobId }`.

10) API: Jobs (`app/api/jobs/[id]/route.ts`)
- `export const runtime = 'nodejs'`.
- If `?download=1` present, call `streamOutput(id)` and return the Response.
- Otherwise, return `{ status, progress, downloadUrl? }` where `downloadUrl` is `/api/jobs/{id}?download=1` if `status==='done'`.

11) Basic Cleanup
- In `lib/file.ts`, implement `cleanupOldFiles` that removes files older than N hours.
- Register a lightweight interval (e.g., from `lib/jobs.ts` module init) to run cleanup every 60 minutes if `process.env.NODE_ENV==='production'`.

12) Developer Experience
- Add curl examples to README or this doc:
```bash
# Upload
curl -F "file=@/path/to/sample.mp4" http://localhost:3000/api/upload

# Convert to mp4
curl -X POST http://localhost:3000/api/convert \
  -H 'content-type: application/json' \
  -d '{"fileId":"<id>","target":"mp4","preset":"web"}'

# Poll status
curl http://localhost:3000/api/jobs/<jobId>

# Download when done
curl -L "http://localhost:3000/api/jobs/<jobId>?download=1" -o output.mp4
```

13) Optional Phase 2: YouTube (Opt-in)
- Dependency: `pnpm add ytdl-core`.
- Add `app/api/youtube/route.ts` with `POST { url }` → download to temp file via `ytdl-core`, return `{ fileId }`.
- Make it feature-flagged via `ENABLE_YOUTUBE=true`.

## File Checklist for Agent
- [x] Create `temp/` and add to `.gitignore` if missing
- [x] Add `.env.local` with `TEMP_DIR` and `MAX_FILE_SIZE_MB`
- [x] Add `lib/file.ts`
- [x] Add `lib/presets.ts`
- [x] Add `lib/jobs.ts`
- [x] Add `lib/ffmpeg.ts`
- [ ] Add `app/api/health/route.ts`
- [ ] Add `app/api/upload/route.ts`
- [ ] Add `app/api/convert/route.ts`
- [ ] Add `app/api/jobs/[id]/route.ts`
- [ ] Verify end-to-end via curl commands

## Notes & Constraints
- Force Node runtime for all routes; avoid Edge runtime.
- Keep concurrency low (1–2) to prevent resource exhaustion.
- In-memory job store is ephemeral; acceptable for MVP. Document this.
- Large platforms may cap request size; for MVP, test locally or self-host.

---

When you’re ready, ask me to scaffold these files and I’ll implement them as per this guide.

## Progress Tracker
- [x] 1) Dependencies — install `@ts-ffmpeg/fluent-ffmpeg` and `ffmpeg-static`
- [x] 2) Temp Directory & Env — create `temp/`, add to `.gitignore`, add `.env.local`
- [x] 3) Lib: File Helpers (`lib/file.ts`)
- [x] 4) Lib: Presets (`lib/presets.ts`)
- [x] 5) Lib: Jobs (`lib/jobs.ts`)
- [x] 6) Lib: FFmpeg Wrapper (`lib/ffmpeg.ts`)
- [x] 7) API: Health (`app/api/health/route.ts`)
- [x] 8) API: Upload (`app/api/upload/route.ts`)
- [ ] 9) API: Convert (`app/api/convert/route.ts`)
- [x] 9) API: Convert (`app/api/convert/route.ts`)
- [ ] 10) API: Jobs (`app/api/jobs/[id]/route.ts`)
- [ ] 11) Basic Cleanup — scheduled old file cleanup
- [ ] 12) Developer Experience — curl examples verified locally
- [ ] 13) Optional Phase 2: YouTube (feature-flagged)

- [ ] MVP end-to-end verified (upload → convert → poll → download)
