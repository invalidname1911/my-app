# FFmpeg Web – Small Project Plan (MVP‑First)

## Overview
This refines the original plan for a small project. It focuses on the shortest path to a useful MVP: upload a media file, convert it to a couple of common formats with FFmpeg, and download the result. YouTube support and other production concerns are optional follow‑ups, not part of the MVP.

## Scope
- In scope (MVP):
  - Upload local file (video/audio)
  - Convert to `mp4` (H.264/AAC) or `mp3` with 2 presets (web, mobile)
  - Pollable job status + download the output
  - Basic limits and validation
- Nice to have (Phase 2):
  - YouTube URL download (toggleable/optional)
  - Simple temp file cleanup
- Out of scope (for now):
  - SSE/WebSockets, OpenAPI, Redis/queues, GPU accel, advanced editing (trim/merge/watermark), rate limiting/analytics, Docker/K8s, multi‑service architecture

## Tech Stack
- Framework: Next.js (App Router) with Route Handlers in Node runtime
- Media: `fluent-ffmpeg` + `ffmpeg-static`
- Uploads: use `await request.formData()` (no `multer`) for simplicity
- Storage: local temp dir (e.g., `./temp`), in‑memory job map
- Language: TypeScript

## Minimal Dependencies
```bash
pnpm add fluent-ffmpeg ffmpeg-static
```
Optional (Phase 2):
```bash
pnpm add ytdl-core
```

## Directory Structure (Lean)
```
my-app/
├── app/
│   └── api/
│       ├── upload/route.ts        # POST: accepts file via formData
│       ├── convert/route.ts       # POST: start conversion job
│       ├── jobs/[id]/route.ts     # GET: job status (+ download URL when done)
│       └── health/route.ts        # GET: basic health check
├── lib/
│   ├── ffmpeg.ts                  # tiny wrapper around fluent-ffmpeg
│   ├── jobs.ts                    # in-memory jobs registry
│   ├── presets.ts                 # 2-3 simple presets
│   └── file.ts                    # temp path helpers + cleanup
├── temp/                          # local temp files (gitignored)
└── types/
    └── index.ts                   # minimal types
```

## MVP Plan

### 1) Setup & Guardrails
- Create `./temp` and ensure writable; `.gitignore` it.
- Env vars (minimal):
  - `TEMP_DIR=./temp`
  - `MAX_FILE_SIZE_MB=200`
- Force Node runtime for routes: `export const runtime = 'nodejs'`.

### 2) Upload Endpoint (`POST /api/upload`)
- Accept `multipart/form-data` via `await request.formData()`
- Validate extension + mime, check size against `MAX_FILE_SIZE_MB`
- Persist to `TEMP_DIR` with a random `fileId`
- Return `{ fileId, originalName, size }`

Example skeleton:
```ts
// app/api/upload/route.ts
import { writeFile } from "node:fs/promises";
import { createTempPath } from "@/lib/file";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  // basic validation here (size/mime)
  const array = new Uint8Array(await file.arrayBuffer());
  const { fileId, absPath } = await createTempPath(file.name);
  await writeFile(absPath, array);
  return Response.json({ fileId, originalName: file.name, size: array.byteLength });
}
```

### 3) Convert Endpoint (`POST /api/convert`)
- Body: `{ fileId, target: 'mp4'|'mp3', preset?: 'web'|'mobile' }`
- Create a job in an in‑memory map: `{ id, status: 'queued'|'running'|'done'|'error', progress, inputPath, outputPath }`
- Kick off conversion (simple inline execution is fine; for larger files use a minimal queue with concurrency 1–2)
- Return `{ jobId }`

Skeleton:
```ts
// app/api/convert/route.ts
import { startJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const payload = await req.json();
  const job = await startJob(payload);
  return Response.json({ jobId: job.id });
}
```

### 4) Job Status (`GET /api/jobs/[id]`)
- Returns `{ status, progress, downloadUrl? }`
- When `done`, expose a signed-ish opaque id or simply `/api/jobs/[id]?download=1` for small project simplicity.

Skeleton:
```ts
// app/api/jobs/[id]/route.ts
import { getJob, streamOutput } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  if (url.searchParams.get("download") === "1") {
    return streamOutput(params.id); // sets headers + returns file stream
  }
  const job = getJob(params.id);
  if (!job) return Response.json({ error: "not found" }, { status: 404 });
  const body: any = { status: job.status, progress: job.progress ?? 0 };
  if (job.status === "done") body.downloadUrl = `/api/jobs/${params.id}?download=1`;
  return Response.json(body);
}
```

### 5) FFmpeg Wrapper (`lib/ffmpeg.ts`)
- Set `ffmpeg.setFfmpegPath(ffmpegStatic)`
- Provide `convertToMp4(input, output, preset)` and `extractAudioMp3(input, output, bitrate)`
- Attach progress via `command.on('progress', ...)` to update the in‑memory job

### 6) Presets (`lib/presets.ts`)
```ts
export const presets = {
  web:  { vcodec: "libx264", acodec: "aac", crf: 23, scale: "1280:720" },
  mobile:{ vcodec: "libx264", acodec: "aac", crf: 26, scale: "854:480" }
};
```

### 7) Basic Cleanup (`lib/file.ts`)
- Helper to create temp paths and a tiny cleanup that deletes files older than N hours; run on an interval (e.g., 30–60 minutes). Keep it off in dev by default.

## Phase 2 (Optional)

### YouTube Download (Opt‑In)
- Use `ytdl-core` to fetch and pipe to a temp file; return a `fileId` for conversion.
- Add `POST /api/youtube` with `{ url }` → `{ fileId }`.
- Document that YouTube frequently changes; treat this as best‑effort only.

### Small Improvements
- Minimal client‑side polling every 1s for job status
- Simple size/mime whitelist and extension checks
- Very light per‑IP request counter in memory (reset every minute) if abuse is a concern

## Non‑Goals (Why We Trimmed)
- No SSE/WebSockets: polling is simpler and good enough
- No Redis/queues/workers: single‑process is fine for small usage
- No OpenAPI/metrics: maintain by README and examples
- No GPU/NVENC: complexity outweighs benefit for MVP
- No Docker/K8s scaling: run locally or on a single Node host

## Testing (Right‑Sized)
- Unit: file helpers, preset selection
- Integration: upload → convert(mp4) → download flow with a tiny sample asset
- Manual: try a few common formats, confirm errors are readable

## Deployment Notes
- Ensure Node runtime, not Edge
- If deploying to platforms with body size limits, keep files small or self‑host
- Add `TEMP_DIR` to a writable path on the host

## Success Criteria (MVP)
- Upload a file < 200MB
- Convert to mp4 and mp3 with 2 presets
- Poll job to completion and download output
- Clear, actionable errors on bad input or failures

---

If you want, I can scaffold the minimal files (`lib/*` and `app/api/*`) next.

