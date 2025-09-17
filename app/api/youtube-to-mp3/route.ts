import { NextRequest, NextResponse } from 'next/server';
import { downloadYouTubeAudio, getYouTubeVideoInfo, isValidYouTubeUrl, sanitizeYouTubeUrl } from '@/lib/youtube';
import { createTempPath, createOutputPath } from '@/lib/file';
import { createJob, updateJob } from '@/lib/jobs';
import { extractAudioMp3 } from '@/lib/ffmpeg';
import fs from 'fs';

export const runtime = 'nodejs';

interface YouTubeToMp3Request {
  url: string;
  bitrate?: number; // Optional bitrate in kbps, defaults to 192
}

interface YouTubeToMp3Response {
  jobId: string;
  title?: string;
  duration?: string;
  thumbnail?: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

// Constants for validation
const MIN_BITRATE = 64;
const MAX_BITRATE = 320;
const DEFAULT_BITRATE = 192;
const MAX_URL_LENGTH = 2048;
// const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

export async function POST(req: NextRequest): Promise<NextResponse<YouTubeToMp3Response | ErrorResponse>> {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);

  console.log(`[${requestId}] YouTube to MP3 request started`);

  try {
    // Check if YouTube feature is enabled
    if (process.env.ENABLE_YOUTUBE !== 'true') {
      console.log(`[${requestId}] YouTube feature disabled`);
      return NextResponse.json(
        { error: 'YouTube download feature is disabled' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    let body: YouTubeToMp3Request;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    if (typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'URL must be a string' },
        { status: 400 }
      );
    }

    // Sanitize and validate URL
    const url = body.url.trim();

    if (url.length === 0) {
      return NextResponse.json(
        { error: 'URL cannot be empty' },
        { status: 400 }
      );
    }

    if (url.length > MAX_URL_LENGTH) {
      return NextResponse.json(
        { error: 'URL is too long' },
        { status: 400 }
      );
    }

    // Validate URL format - use both old regex and new validation for compatibility
    const youtubeUrlPattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i;

    if (!youtubeUrlPattern.test(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      );
    }

    // Use the more robust validation from youtube.ts if available
    if (typeof isValidYouTubeUrl === 'function' && !isValidYouTubeUrl(url)) {
      console.log(`[${requestId}] URL failed isValidYouTubeUrl check: ${url}`);
      return NextResponse.json(
        { error: 'Invalid YouTube URL format or unsupported host' },
        { status: 400 }
      );
    }

    // Sanitize the URL to remove potentially dangerous parameters if function is available
    let sanitizedUrl: string;
    try {
      if (typeof sanitizeYouTubeUrl === 'function') {
        sanitizedUrl = sanitizeYouTubeUrl(url);
      } else {
        sanitizedUrl = url; // Fallback to original URL
      }
    } catch (sanitizeError) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate bitrate if provided
    if (body.bitrate !== undefined) {
      if (typeof body.bitrate !== 'number' || !Number.isInteger(body.bitrate)) {
        return NextResponse.json(
          { error: 'Bitrate must be an integer' },
          { status: 400 }
        );
      }

      if (body.bitrate < MIN_BITRATE || body.bitrate > MAX_BITRATE) {
        return NextResponse.json(
          { error: `Bitrate must be between ${MIN_BITRATE} and ${MAX_BITRATE} kbps` },
          { status: 400 }
        );
      }
    }

    const bitrate = body.bitrate && body.bitrate > 0 ? body.bitrate : DEFAULT_BITRATE;
    console.log(`[${requestId}] Processing URL: ${sanitizedUrl}, Bitrate: ${bitrate}kbps`);

    let videoInfo: { title?: string; duration?: string; thumbnail?: string } = {};

    try {
      // Get video info first for response using sanitized URL
      const info = await getYouTubeVideoInfo(sanitizedUrl);
      videoInfo = {
        title: info.title,
        duration: info.duration,
        thumbnail: `https://img.youtube.com/vi/${info.videoId}/mqdefault.jpg`
      };
      console.log(`[${requestId}] Video info retrieved: ${info.title} (${info.duration}s)`);
    } catch (infoError: any) {
      console.warn(`[${requestId}] Could not get video info:`, infoError.message);
      // Continue without video info - this is not critical for the conversion process
    }

    // Create temp path for the intermediate download
    const tempInfo = await createTempPath('youtube-download.webm');

    // Create job for tracking the entire process
    const job = createJob(tempInfo.absPath, 'mp3');
    console.log(`[${requestId}] Created job ${job.id}`);

    // Create output path for final MP3
    const outputPath = await createOutputPath(job.id, 'mp3');
    updateJob(job.id, { outputPath });

    // Start async processing (non-blocking)
    (async () => {
      let tempFileExists = false;
      let outputFileExists = false;

      try {
        updateJob(job.id, { status: 'running', progress: 0 });

        // Phase 1: Download YouTube audio (0-50% progress)
        await downloadYouTubeAudio(sanitizedUrl, tempInfo.absPath, (downloadProgress) => {
          // Map download progress to 0-50%
          const mappedProgress = Math.round(downloadProgress * 0.5);
          updateJob(job.id, { progress: Math.max(0, Math.min(50, mappedProgress)) });
        });

        tempFileExists = fs.existsSync(tempInfo.absPath);
        updateJob(job.id, { progress: 50 });

        // Phase 2: Convert to MP3 (50-100% progress)  
        await extractAudioMp3(tempInfo.absPath, outputPath, bitrate, (conversionProgress) => {
          // Map conversion progress to 50-100%
          const mappedProgress = 50 + Math.round(conversionProgress * 0.5);
          updateJob(job.id, { progress: Math.max(50, Math.min(100, mappedProgress)) });
        });

        outputFileExists = fs.existsSync(outputPath);

        // Clean up intermediate file
        if (tempFileExists) {
          try {
            fs.unlinkSync(tempInfo.absPath);
            if (process.env.NODE_ENV !== 'test') {
              console.log(`Cleaned up intermediate file: ${tempInfo.absPath}`);
            }
          } catch (cleanupError) {
            console.warn('Could not clean up intermediate file:', cleanupError);
          }
        }

        updateJob(job.id, { status: 'done', progress: 100 });
        if (process.env.NODE_ENV !== 'test') {
          console.log(`[${requestId}] YouTube to MP3 conversion completed successfully for job ${job.id}`);
        }

      } catch (error: any) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('YouTube to MP3 conversion error:', error);
        }

        // Clean up files on error
        const cleanupPromises = [];

        if (tempFileExists && fs.existsSync(tempInfo.absPath)) {
          cleanupPromises.push(
            new Promise<void>((resolve) => {
              try {
                fs.unlinkSync(tempInfo.absPath);
                if (process.env.NODE_ENV !== 'test') {
                  console.log(`Cleaned up intermediate file after error: ${tempInfo.absPath}`);
                }
              } catch (cleanupError) {
                console.warn('Could not clean up intermediate file after error:', cleanupError);
              }
              resolve();
            })
          );
        }

        if (outputFileExists && fs.existsSync(outputPath)) {
          cleanupPromises.push(
            new Promise<void>((resolve) => {
              try {
                fs.unlinkSync(outputPath);
                if (process.env.NODE_ENV !== 'test') {
                  console.log(`Cleaned up output file after error: ${outputPath}`);
                }
              } catch (cleanupError) {
                console.warn('Could not clean up output file after error:', cleanupError);
              }
              resolve();
            })
          );
        }

        // Wait for cleanup to complete
        await Promise.all(cleanupPromises);

        // Handle specific error cases with more detailed messages
        let errorMessage = 'Conversion failed';
        let errorDetails = error.message || 'Unknown error';

        if (error.message?.toLowerCase().includes('video unavailable') ||
          error.message?.toLowerCase().includes('private')) {
          errorMessage = 'Video is unavailable, private, or region-locked';
        } else if (error.message?.toLowerCase().includes('age-restricted') ||
          error.message?.toLowerCase().includes('sign in')) {
          errorMessage = 'Video is age-restricted or requires sign-in';
        } else if (error.message?.toLowerCase().includes('live')) {
          errorMessage = 'Live streams are not supported';
        } else if (error.message?.toLowerCase().includes('network') ||
          error.message?.toLowerCase().includes('timeout')) {
          errorMessage = 'Network error or timeout occurred';
        } else if (error.message?.toLowerCase().includes('format not supported')) {
          errorMessage = 'Video format is not supported';
        } else if (error.message) {
          errorMessage = error.message;
        }

        updateJob(job.id, {
          status: 'error',
          error: errorMessage,
          progress: 0
        });

        if (process.env.NODE_ENV !== 'test') {
          console.error(`[${requestId}] Job ${job.id} failed: ${errorMessage}`, { details: errorDetails });
        }
      }
    })();

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] Request completed in ${processingTime}ms, job ${job.id} created`);

    return NextResponse.json({
      jobId: job.id,
      ...videoInfo
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[${requestId}] YouTube to MP3 API error after ${processingTime}ms:`, error);
    }

    // Provide more specific error messages for common issues
    let errorMessage = 'Internal server error';
    let errorDetails = error.message || 'Unknown error occurred';

    if (error.message?.toLowerCase().includes('timeout')) {
      errorMessage = 'Request timeout - please try again';
    } else if (error.message?.toLowerCase().includes('memory')) {
      errorMessage = 'Server memory limit exceeded';
    } else if (error.message?.toLowerCase().includes('disk space')) {
      errorMessage = 'Insufficient disk space';
    } else if (error.message?.toLowerCase().includes('permission')) {
      errorMessage = 'File system permission error';
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}
