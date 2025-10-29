import { NextRequest, NextResponse } from 'next/server';
import Ffmpeg from '@ts-ffmpeg/fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Resolve ffmpeg path robustly
    const candidates = [
      process.env.FFMPEG_PATH,
      (ffmpegStatic as unknown as string) || undefined,
      path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    ].filter(Boolean) as string[];

    let FFMPEG_PATH: string | null = null;
    for (const p of candidates) {
      try { if (fs.existsSync(p)) { FFMPEG_PATH = p; break; } } catch {}
    }

    if (FFMPEG_PATH) {
      Ffmpeg.setFfmpegPath(FFMPEG_PATH);
    }

    // Basic health check
    const health = {
      ok: true,
      timestamp: new Date().toISOString(),
      ffmpeg: {
        path: FFMPEG_PATH || 'PATH',
        available: !!FFMPEG_PATH,
        source: FFMPEG_PATH && FFMPEG_PATH.includes('node_modules') ? 'ffmpeg-static' : (FFMPEG_PATH ? 'local-binary' : 'system-path')
      }
    };

    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
