import youtubedlBase from 'youtube-dl-exec';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Get the path to yt-dlp binary
const getYtDlpPath = (): string => {
  // Try common installation paths
  const possiblePaths = [
    process.env.YT_DLP_PATH || '',
    path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
    path.join(os.homedir(), '.local', 'bin', 'yt-dlp'), // Linux/Mac (per-user)
    '/opt/homebrew/bin/yt-dlp', // macOS (Apple Silicon Homebrew)
    '/usr/local/bin/yt-dlp',    // macOS/Unix (Intel Homebrew or manual install)
    '/usr/bin/yt-dlp',          // Linux
    'yt-dlp', // If in PATH
  ];
  
  for (const ytdlPath of possiblePaths) {
    if (ytdlPath && fs.existsSync(ytdlPath)) {
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
    
    const uaDesktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
    const uaAndroid = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36';
    const uaIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

    const cookiesFile = (process.env.YT_DLP_COOKIES || '').trim();

    const baseOpts: any = {
      format: 'bestaudio[ext=webm]/bestaudio/best',
      output: outputTemplate + '.%(ext)s',
      noPlaylist: true,
      'geo-bypass': true,
      'retries': 10,
      'fragment-retries': 10,
      'concurrent-fragments': 1,
      'http-chunk-size': '10M',
    };
    if (cookiesFile) {
      baseOpts.cookies = cookiesFile; // Provide cookies if supplied via env
    }

    const strategies: Array<{ name: string; opts: any }> = [
      {
        name: 'android-ipv4',
        opts: {
          'force-ipv4': true,
          'extractor-args': 'youtube:player_client=android',
          'add-header': [`User-Agent: ${uaAndroid}`, 'Referer: https://m.youtube.com'],
        },
      },
      {
        name: 'tv_embedded-ipv4',
        opts: {
          'force-ipv4': true,
          'extractor-args': 'youtube:player_client=tv_embedded',
          'add-header': [`User-Agent: ${uaDesktop}`, 'Referer: https://www.youtube.com'],
        },
      },
      {
        name: 'ios-ipv4',
        opts: {
          'force-ipv4': true,
          'extractor-args': 'youtube:player_client=ios',
          'add-header': [`User-Agent: ${uaIOS}`, 'Referer: https://m.youtube.com'],
        },
      },
      {
        name: 'desktop-ipv6',
        opts: {
          'force-ipv6': true,
          'add-header': [`User-Agent: ${uaDesktop}`, 'Referer: https://www.youtube.com'],
        },
      },
      {
        name: 'format-fallback',
        opts: {
          'force-ipv4': true,
          format: 'bestaudio/best',
          'add-header': [`User-Agent: ${uaDesktop}`, 'Referer: https://www.youtube.com'],
        },
      },
    ];

    let last403Message = '';
    for (const strat of strategies) {
      try {
        const opts: any = { ...baseOpts, ...strat.opts };
        await youtubedl(sanitizedUrl, opts);
        if (onProgress) {
          onProgress(100);
        }
        last403Message = '';
        break; // success
      } catch (error: any) {
        // Clean up partial file on error
        try {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        } catch {}

        const rawMsg = [error?.message, error?.shortMessage, error?.stderr]
          .filter(Boolean)
          .join(' ');
        const errorMessage = String(rawMsg || error || '').toLowerCase();

        // Environment/binary issues should not continue strategies
        if (error?.code === 'ENOENT' || errorMessage.includes('enoent') || errorMessage.includes('not found')) {
          throw new Error('yt-dlp binary not found. Please install yt-dlp and ensure it is in PATH');
        }
        if (errorMessage.includes('video unavailable') || errorMessage.includes('private video')) {
          throw new Error('Video is unavailable, private, or region-locked');
        }
        if (errorMessage.includes('sign in to confirm') || errorMessage.includes('confirm your age')) {
          throw new Error('Video is age-restricted or requires sign-in');
        }
        if (errorMessage.includes('live')) {
          throw new Error('Live streams are not supported');
        }

        // If 403/forbidden, try next strategy, else throw immediately
        if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
          last403Message = rawMsg || 'Access forbidden';
          continue;
        }

        const finalMsg = (rawMsg && String(rawMsg).trim()) || 'unknown error';
        throw new Error(`Download failed: ${finalMsg}`);
      }
    }

    if (last403Message) {
      throw new Error('Download failed: Access forbidden');
    }
    
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
    
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
    
    const cookiesFile = (process.env.YT_DLP_COOKIES || '').trim();
    
    const opts: any = {
      dumpSingleJson: true,
      noWarnings: true,
      skipDownload: true,
      'force-ipv4': true,
      'geo-bypass': true,
      'extractor-args': 'youtube:player_client=android',
      'add-header': [
        `User-Agent: ${ua}`,
        'Referer: https://www.youtube.com'
      ],
    };
    
    if (cookiesFile) {
      opts.cookies = cookiesFile;
    }
    
    const info: any = await youtubedl(sanitizedUrl, opts);
    
    return {
      title: info.title || 'Unknown',
      duration: String(info.duration || '0'),
      author: info.uploader || info.channel || 'Unknown',
      videoId: info.id || ''
    };
  } catch (error: any) {
    const rawMsg = [error?.message, error?.shortMessage, error?.stderr].filter(Boolean).join(' ');
    const lower = String(rawMsg || error || '').toLowerCase();
    if (error?.code === 'ENOENT' || lower.includes('enoent') || lower.includes('not found')) {
      throw new Error('Failed to get video info: yt-dlp binary not found');
    }
    const finalMsg = (rawMsg && String(rawMsg).trim()) || 'Unknown error';
    throw new Error(`Failed to get video info: ${finalMsg}`);
  }
}
