import youtubedlBase from 'youtube-dl-exec';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Get the path to yt-dlp binary
const getYtDlpPath = (): string => {
  // Try common installation paths
  const possiblePaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
    path.join(os.homedir(), '.local', 'bin', 'yt-dlp'), // Linux/Mac
    'yt-dlp', // If in PATH
  ];
  
  for (const ytdlPath of possiblePaths) {
    if (fs.existsSync(ytdlPath)) {
      return ytdlPath;
    }
  }
  
  return 'yt-dlp'; // Fallback to default
};

// Create youtubedl instance with custom binary path
const ytdlpPath = getYtDlpPath();
const youtubedl = youtubedlBase.create(ytdlpPath);

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
 * Downloads audio from a YouTube video using yt-dlp
 * @param url - YouTube video URL
 * @param outputPath - Path where the audio file will be saved
 * @param onProgress - Optional progress callback (0-100)
 */
export async function downloadYouTubeAudio(
  url: string,
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    // Validate and sanitize URL
    if (!isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL or unsupported host');
    }
    
    const sanitizedUrl = sanitizeYouTubeUrl(url);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Remove extension from outputPath as yt-dlp will add it
    const outputTemplate = outputPath.replace(/\.[^.]+$/, '');
    
    await youtubedl(sanitizedUrl, {
      format: 'bestaudio[ext=webm]/bestaudio/best',
      output: outputTemplate + '.%(ext)s',
      noPlaylist: true,
    }).then(() => {
      if (onProgress) {
        onProgress(100);
      }
    }).catch((error: any) => {
      // Clean up partial file on error
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch {}
      
      const errorMessage = String(error?.message || error || '').toLowerCase();
      
      if (errorMessage.includes('video unavailable') || errorMessage.includes('private video')) {
        throw new Error('Video is unavailable, private, or region-locked');
      } else if (errorMessage.includes('sign in to confirm') || errorMessage.includes('confirm your age')) {
        throw new Error('Video is age-restricted or requires sign-in');
      } else if (errorMessage.includes('live')) {
        throw new Error('Live streams are not supported');
      } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        throw new Error('Download failed: Access forbidden');
      } else {
        throw new Error(`Download failed: ${error?.message || 'unknown error'}`);
      }
    });
    
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Gets basic info about a YouTube video without downloading using yt-dlp
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
    
    const info: any = await youtubedl(sanitizedUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      skipDownload: true,
    });
    
    return {
      title: info.title || 'Unknown',
      duration: String(info.duration || '0'),
      author: info.uploader || info.channel || 'Unknown',
      videoId: info.id || ''
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
    throw new Error('Failed to get video info: Unknown error');
  }
}
