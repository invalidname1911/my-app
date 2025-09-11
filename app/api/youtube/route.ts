import { NextRequest, NextResponse } from 'next/server';
import { downloadYouTubeAudio, getYouTubeVideoInfo } from '@/lib/youtube';
import { createTempPath } from '@/lib/file';
import fs from 'fs';

export const runtime = 'nodejs';

interface YouTubeDownloadRequest {
  url: string;
}

interface YouTubeDownloadResponse {
  fileId: string;
  title?: string;
  duration?: string;
  size?: number;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<YouTubeDownloadResponse | ErrorResponse>> {
  try {
    // Check if YouTube feature is enabled
    if (process.env.ENABLE_YOUTUBE !== 'true') {
      return NextResponse.json(
        { error: 'YouTube download feature is disabled' },
        { status: 403 }
      );
    }

    const body: YouTubeDownloadRequest = await req.json();
    
    if (!body.url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    const url = body.url.trim();
    const youtubeUrlPattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i;
    
    if (!youtubeUrlPattern.test(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      );
    }

    // Create temp path for download
    const tempInfo = await createTempPath('youtube-download.webm');

    let downloadInfo: {
      title?: string;
      duration?: string;
      size?: number;
    } = {};

    try {
      // First get video info
      const videoInfo = await getYouTubeVideoInfo(url);

      // Download YouTube audio
      await downloadYouTubeAudio(url, tempInfo.absPath, (progress) => {
        console.log(`Download progress: ${progress}%`);
      });

      // Get file size
      const stats = fs.statSync(tempInfo.absPath);
      const fileSize = stats.size;

      downloadInfo = {
        title: videoInfo.title,
        duration: videoInfo.duration,
        size: fileSize
      };

    } catch (downloadError: any) {
      console.error('YouTube download error:', downloadError);
      
      // Handle specific error cases
      if (downloadError.message?.includes('Video unavailable')) {
        return NextResponse.json(
          { 
            error: 'Video is unavailable',
            details: 'The video may be private, deleted, or restricted in your region'
          },
          { status: 404 }
        );
      }
      
      if (downloadError.message?.includes('age-restricted')) {
        return NextResponse.json(
          { 
            error: 'Age-restricted content',
            details: 'Cannot download age-restricted videos'
          },
          { status: 403 }
        );
      }
      
      if (downloadError.message?.includes('live')) {
        return NextResponse.json(
          { 
            error: 'Live content not supported',
            details: 'Cannot download live streams or premieres'
          },
          { status: 400 }
        );
      }

      // Generic error
      return NextResponse.json(
        { 
          error: 'Failed to download video',
          details: downloadError.message || 'Unknown download error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fileId: tempInfo.fileId,
      ...downloadInfo
    });

  } catch (error: any) {
    console.error('YouTube API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
