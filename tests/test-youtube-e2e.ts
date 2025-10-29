#!/usr/bin/env -S node
import { NextRequest } from 'next/server';
import { POST } from '../app/api/youtube-to-mp3/route';
import { getJob } from '../lib/jobs';

async function waitForJob(jobId: string, timeoutMs = 180_000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const job = getJob(jobId);
    if (job && job.status !== last) {
      // eslint-disable-next-line no-console
      console.log(`Job ${jobId}: ${job.status}${job.progress != null ? ` (${job.progress}%)` : ''}`);
      last = job.status;
    }
    if (job?.status === 'done' || job?.status === 'error') return job;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Timeout waiting for job');
}

async function main() {
  const url = process.argv[2];
  const bitrate = Number(process.argv[3]) || 320;
  if (!url) throw new Error('Usage: tsx tests/test-youtube-e2e.ts <youtube_url> [bitrate]');
  process.env.ENABLE_YOUTUBE = 'true';

  const req = new NextRequest('http://localhost/api/youtube-to-mp3', {
    method: 'POST',
    body: JSON.stringify({ url, bitrate })
  });

  const res = await POST(req as any);
  const data: any = await (res as any).json();
  if (res.status !== 200) {
    console.error('Start failed:', data);
    process.exit(1);
  }
  console.log('Started job', data.jobId, 'title:', data.title, 'duration:', data.duration);
  const job = await waitForJob(data.jobId);
  console.log('Final:', job.status, job.error || job.outputPath);
}

main().catch((e) => {
  console.error('E2E failed:', e?.message || e);
  process.exit(1);
});
