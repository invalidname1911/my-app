#!/usr/bin/env -S node
/**
 * Integration-style test for app/api/convert/route.ts
 * - Generates a tiny 1s MP4 using ffmpeg-static
 * - Calls the POST handler directly
 * - Polls the in-memory job store until done
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import fsSync from 'node:fs';

// Import route and job store utilities
import { POST } from '../app/api/convert/route';
import { getJob } from '../lib/jobs';

async function ensureDir(dir: string) {
  try { await fs.access(dir); } catch { await fs.mkdir(dir, { recursive: true }); }
}

function resolveFfmpegPath(): string {
  const candidates = [
    process.env.FFMPEG_PATH,
    (ffmpegStatic as unknown as string) || undefined,
    path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    // final fallback: rely on PATH
    'ffmpeg',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (p === 'ffmpeg') return p;
    try { if (fsSync.existsSync(p)) return p; } catch {}
  }
  return 'ffmpeg';
}

async function generateTinyMp4(outputPath: string): Promise<void> {
  const ffmpegPath = resolveFfmpegPath();
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      // 1s black video 320x240
      '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=1',
      // 1s silent audio
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-shortest',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ];
    const p = spawn(ffmpegPath as string, args, { stdio: 'ignore' });
    p.on('error', reject);
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
}

async function callConvertRoute(body: any) {
  const req = new Request('http://localhost/api/convert', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await POST(req as any);
  const json = await (res as Response).json();
  return json as { jobId?: string; error?: string };
}

async function waitForJob(jobId: string, timeoutMs = 120_000) {
  const start = Date.now();
  let lastStatus = '';
  while (Date.now() - start < timeoutMs) {
    const job = getJob(jobId);
    if (job) {
      if (job.status !== lastStatus) {
        // eslint-disable-next-line no-console
        console.log(`Job ${jobId} status: ${job.status}${job.progress != null ? ` (${job.progress}%)` : ''}`);
        lastStatus = job.status;
      }
      if (job.status === 'done') return job;
      if (job.status === 'error') throw new Error(job.error || 'job error');
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Timeout waiting for job');
}

async function main() {
  const tempDir = path.join(process.cwd(), 'temp');
  await ensureDir(tempDir);

  // Negative test: missing input file
  console.log('🧪 Negative test: missing input fileId...');
  const missing = await callConvertRoute({ fileId: 'missing-file-id', target: 'mp4', preset: 'web' });
  if (!missing.error) throw new Error('Expected error for missing input file');
  console.log('✅ Got expected error:', missing.error);

  const fileId = randomBytes(8).toString('hex');
  const inputPath = path.join(tempDir, `${fileId}.mp4`);

  console.log('Generating tiny input video...');
  await generateTinyMp4(inputPath);
  console.log('✅ Test input created at', inputPath);

  // Test 1: Convert to MP4 (web preset)
  console.log('\n🔁 Starting MP4 conversion via route...');
  const mp4Resp = await callConvertRoute({ fileId, target: 'mp4', preset: 'web' });
  if (!mp4Resp.jobId) throw new Error(`Failed to start MP4 job: ${mp4Resp.error || 'unknown'}`);
  const mp4Job = await waitForJob(mp4Resp.jobId);
  if (!mp4Job.outputPath) throw new Error('MP4 job has no outputPath');
  const mp4Stats = await fs.stat(mp4Job.outputPath);
  console.log('✅ MP4 output created:', mp4Job.outputPath, `${mp4Stats.size} bytes`);

  // Test 2: Extract MP3
  console.log('\n🔁 Starting MP3 extraction via route...');
  const mp3Resp = await callConvertRoute({ fileId, target: 'mp3' });
  if (!mp3Resp.jobId) throw new Error(`Failed to start MP3 job: ${mp3Resp.error || 'unknown'}`);
  const mp3Job = await waitForJob(mp3Resp.jobId);
  if (!mp3Job.outputPath) throw new Error('MP3 job has no outputPath');
  const mp3Stats = await fs.stat(mp3Job.outputPath);
  console.log('✅ MP3 output created:', mp3Job.outputPath, `${mp3Stats.size} bytes`);

  console.log('\n🎉 Conversion route tests passed!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err?.message || err);
  process.exit(1);
});
