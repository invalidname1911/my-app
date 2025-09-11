import { getJob, streamOutput } from "@/lib/jobs";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const { searchParams } = new URL(req.url);
  const download = searchParams.get('download');

  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (download === '1') {
    if (job.status === 'done' && job.outputPath) {
      try {
        return await streamOutput(id);
      } catch (error) {
        console.error(`Error streaming file for job ${id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: "Failed to stream file", details: errorMessage }, { status: 500 });
      }
    } else if (job.status !== 'done') {
        return NextResponse.json({ error: "Job is not yet complete.", status: job.status }, { status: 400 });
    } else {
      return NextResponse.json({ error: "File not available for download" }, { status: 404 });
    }
  } else {
    const response: { status: string; progress?: number; downloadUrl?: string; error?: string } = {
      status: job.status,
      progress: job.progress,
    };

    if (job.status === 'done') {
      response.downloadUrl = `/api/jobs/${id}?download=1`;
    }
    if (job.status === 'error') {
        response.error = job.error;
    }

    return NextResponse.json(response);
  }
}
