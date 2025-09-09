import { NextRequest, NextResponse } from 'next/server';
import Ffmpeg from '@ts-ffmpeg/fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Set ffmpeg path - use ffmpeg-static if available, fallback to local binary
    const FFMPEG_PATH = ffmpegStatic || process.env.FFMPEG_PATH || './bin/ffmpeg.exe';
    Ffmpeg.setFfmpegPath(FFMPEG_PATH);

    // Basic health check
    const health = {
      ok: true,
      timestamp: new Date().toISOString(),
      ffmpeg: {
        path: FFMPEG_PATH,
        available: !!ffmpegStatic || !!process.env.FFMPEG_PATH,
        source: ffmpegStatic ? 'ffmpeg-static' : 'local-binary'
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