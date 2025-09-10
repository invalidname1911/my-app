import { NextRequest, NextResponse } from 'next/server';
import { resolveTempPath, createOutputPath } from '@/lib/file';
import { createJob, updateJob } from '@/lib/jobs';
import { convertToMp4, extractAudioMp3 } from '@/lib/ffmpeg';

export const runtime = 'nodejs';

type Target = 'mp4' | 'mp3';
type Preset = 'web' | 'mobile';

interface ConvertBody {
  fileId?: string;
  target?: Target;
  preset?: Preset;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConvertBody;
    const fileId = body.fileId?.trim();
    const target = body.target as Target | undefined;
    const preset = (body.preset as Preset | undefined) ?? 'web';

    if (!fileId || !target) {
      return NextResponse.json(
        { error: 'Missing required fields: fileId, target' },
        { status: 400 }
      );
    }

    if (target !== 'mp4' && target !== 'mp3') {
      return NextResponse.json(
        { error: "Invalid target. Must be 'mp4' or 'mp3'" },
        { status: 400 }
      );
    }

    if (target === 'mp4' && preset !== 'web' && preset !== 'mobile') {
      return NextResponse.json(
        { error: "Invalid preset. Must be 'web' or 'mobile'" },
        { status: 400 }
      );
    }

    const inputPath = resolveTempPath(fileId);
    if (!inputPath) {
      return NextResponse.json(
        { error: 'Input file not found' },
        { status: 404 }
      );
    }

    // Create job in queued state
    const job = createJob(inputPath, target, target === 'mp4' ? preset : undefined);

    // Kick off processing asynchronously (non-blocking)
    (async () => {
      try {
        updateJob(job.id, { status: 'running', progress: 0 });

        // Use job id for output filename uniqueness
        const outputPath = await createOutputPath(job.id, target);
        updateJob(job.id, { outputPath });

        if (target === 'mp4') {
          const usePreset: Preset = (job.preset === 'mobile' ? 'mobile' : 'web');
          await convertToMp4(inputPath, outputPath, usePreset, (p) => {
            try { updateJob(job.id, { progress: Math.max(0, Math.min(100, Math.round(p))) }); } catch {}
          });
        } else {
          const bitrateKbps = 192; // sensible default
          await extractAudioMp3(inputPath, outputPath, bitrateKbps, (p) => {
            try { updateJob(job.id, { progress: Math.max(0, Math.min(100, Math.round(p))) }); } catch {}
          });
        }

        updateJob(job.id, { status: 'done', progress: 100 });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        updateJob(job.id, { status: 'error', error: message });
      }
    })();

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to start conversion',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

