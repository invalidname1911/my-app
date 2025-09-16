import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import { pipeline } from 'stream/promises';

/**
 * Validates if a URL is from an allowed YouTube host
 */
export function isValidYouTubeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const allowedHosts = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'music.youtube.com'
    ];
    
    return allowedHosts.includes(parsedUrl.hostname.toLowerCase());
  } catch (error) {
    return false;
  }
}

/**
 * Sanitizes a YouTube URL to ensure it's safe to process
 */
export function sanitizeYouTubeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // Remove potentially dangerous query parameters while keeping video ID
    const allowedParams = ['v', 't', 'start', 'end'];
    const sanitizedUrl = new URL(`${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`);
    
    for (const [key, value] of parsedUrl.searchParams) {
      if (allowedParams.includes(key)) {
        sanitizedUrl.searchParams.set(key, value);
      }
    }
    
    return sanitizedUrl.toString();
  } catch (error) {
    throw new Error('Invalid URL format');
  }
}

/**
 * Downloads audio from a YouTube video
 * @param url - YouTube video URL
 * @param outputPath - Path where the audio file will be saved
 * @param onProgress - Optional progress callback (0-100)
 */
export async function downloadYouTubeAudio(
  url: string,
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Validate and sanitize URL
      if (!isValidYouTubeUrl(url)) {
        throw new Error('Invalid YouTube URL or unsupported host');
      }
      
      const sanitizedUrl = sanitizeYouTubeUrl(url);
      
      // Create ytdl stream for audio only
      const stream = ytdl(sanitizedUrl, {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });

      // Create write stream
      const writeStream = fs.createWriteStream(outputPath);
      
      // Track progress
      let downloadedBytes = 0;
      let totalBytes = 0;
      
      stream.on('info', (info) => {
        // Try to get content length from format
        const format = info.formats.find((f: ytdl.videoFormat) => f.hasAudio && !f.hasVideo);
        if (format && format.contentLength) {
          totalBytes = parseInt(format.contentLength, 10);
        }
      });
      
      stream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && onProgress) {
          const progress = Math.min(Math.round((downloadedBytes / totalBytes) * 100), 100);
          onProgress(progress);
        }
      });
      
      stream.on('error', (error) => {
        // Clean up partial file on error
        fs.unlink(outputPath, () => {});
        
        // Provide more specific error messages
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('video unavailable') || errorMessage.includes('private video')) {
          reject(new Error('Video is unavailable, private, or region-locked'));
        } else if (errorMessage.includes('age-restricted') || errorMessage.includes('sign in')) {
          reject(new Error('Video is age-restricted or requires sign-in'));
        } else if (errorMessage.includes('live')) {
          reject(new Error('Live streams are not supported'));
        } else {
          reject(new Error(`Download failed: ${error.message}`));
        }
      });
      
      writeStream.on('error', (error) => {
        // Clean up partial file on error
        fs.unlink(outputPath, () => {});
        reject(new Error(`File write error: ${error.message}`));
      });
      
      writeStream.on('finish', () => {
        if (onProgress) {
          onProgress(100);
        }
        resolve();
      });
      
      // Pipe the stream
      stream.pipe(writeStream);
      
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Unknown error occurred'));
    }
  });
}

/**
 * Gets basic info about a YouTube video without downloading
 */
export async function getYouTubeVideoInfo(url: string): Promise<{
  title: string;
  duration: string;
  author: string;
  videoId: string;
}> {
  try {
    if (!isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL or unsupported host');
    }
    
    const sanitizedUrl = sanitizeYouTubeUrl(url);
    const info = await ytdl.getInfo(sanitizedUrl);
    
    return {
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      author: info.videoDetails.author.name,
      videoId: info.videoDetails.videoId
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
    throw new Error('Failed to get video info: Unknown error');
  }
}
