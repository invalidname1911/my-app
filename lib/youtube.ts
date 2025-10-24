import ytdlDistube from '@distube/ytdl-core';
import ytdlCore from 'ytdl-core';
import fs from 'fs';
import { spawn } from 'child_process';
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
      
      const commonOptions = {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
          }
        },
        // Improve stability for large responses
        highWaterMark: 1 << 25 as any
      } as const;

      // Try distube first; on decipher/transform/403 failures, fall back to ytdl-core
      let stream: NodeJS.ReadableStream;
      let currentWriteStream: fs.WriteStream | null = null;
      let triedCore = false;
      const tryDistube = async () => {
        try {
          await ytdlDistube.getInfo(sanitizedUrl);
          // @ts-ignore types align sufficiently for runtime
          return ytdlDistube(sanitizedUrl, commonOptions as any);
        } catch (e: any) {
          const msg = String(e?.message || '').toLowerCase();
          const isDecipherIssue = msg.includes('could not parse decipher') || msg.includes('n transform function');
          const is403 = msg.includes('status code: 403');
          if (!isDecipherIssue && !is403) throw e;
          throw Object.assign(new Error('distube-failed'), { cause: e });
        }
      };
      const tryCore = async () => {
        // @ts-ignore ytdl-core API mirrors distube
        await ytdlCore.getInfo(sanitizedUrl);
        // @ts-ignore
        return ytdlCore(sanitizedUrl, commonOptions as any);
      };
      
      const tryYtDlp = async (): Promise<void> => {
        return new Promise((res, rej) => {
          const args = [
            '-m', 'yt_dlp',
            '-f', 'bestaudio',
            '-o', outputPath,
            '--no-playlist',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            sanitizedUrl
          ];
          const p = spawn('python3', args, { stdio: ['ignore', 'pipe', 'pipe'] });
          let stderr = '';
          p.stderr.on('data', d => { stderr += d.toString(); });
          p.on('error', (err) => rej(new Error(`yt-dlp spawn failed: ${err.message}`)));
          p.on('close', (code) => {
            if (code === 0) res();
            else rej(new Error(`yt-dlp failed (code ${code}): ${stderr.trim().split('\n').slice(-1)[0] || 'unknown error'}`));
          });
        });
      };

      const startWith = async (provider: 'distube' | 'core') => {
        try {
          stream = provider === 'distube' ? await tryDistube() : await tryCore();
          wireStream(stream, provider);
        } catch (err) {
          if (provider === 'distube') {
            triedCore = true;
            startWith('core').catch(reject);
          } else {
            // Last resort: yt-dlp fallback
            tryYtDlp().then(resolve).catch(reject);
          }
        }
      };
      startWith('distube').catch(reject);

      // Create write stream
      const writeStream = fs.createWriteStream(outputPath);
      
      // Track progress
      let downloadedBytes = 0;
      let totalBytes = 0;
      
      function wireStream(s: NodeJS.ReadableStream, provider: 'distube' | 'core') {
        if (currentWriteStream) {
          try { currentWriteStream.destroy(); } catch {}
        }
        currentWriteStream = fs.createWriteStream(outputPath);
        attachWriteListeners();
        downloadedBytes = 0;
        totalBytes = 0;
        // @ts-ignore distube/core emit 'info'
        s.on('info', (info: any) => {
          const format = info.formats?.find((f: any) => f.hasAudio && !f.hasVideo);
          if (format && format.contentLength) {
            totalBytes = parseInt(format.contentLength, 10);
          }
        });

        s.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0 && onProgress) {
            const progress = Math.min(Math.round((downloadedBytes / totalBytes) * 100), 100);
            onProgress(progress);
          }
        });

        s.on('error', (error: any) => {
          try { if (currentWriteStream) currentWriteStream.destroy(); } catch {}
          fs.unlink(outputPath, () => {});
          const errorMessage = String(error?.message || '').toLowerCase();
          const canFallback = provider === 'distube' && !triedCore && (errorMessage.includes('403') || errorMessage.includes('could not parse decipher') || errorMessage.includes('n transform function'));
          if (canFallback) {
            triedCore = true;
            startWith('core').catch(reject);
            return;
          }
          if (provider === 'core' && (errorMessage.includes('403') || errorMessage.includes('could not parse decipher') || errorMessage.includes('n transform function'))) {
            // Final fallback
            tryYtDlp().then(resolve).catch(reject);
            return;
          }
          if (errorMessage.includes('video unavailable') || errorMessage.includes('private video')) {
            reject(new Error('Video is unavailable, private, or region-locked'));
          } else if (errorMessage.includes('age-restricted') || errorMessage.includes('sign in')) {
            reject(new Error('Video is age-restricted or requires sign-in'));
          } else if (errorMessage.includes('live')) {
            reject(new Error('Live streams are not supported'));
          } else if (errorMessage.includes('403')) {
            reject(new Error('Download failed: Status code: 403'));
          } else {
            reject(new Error(`Download failed: ${error?.message || 'unknown error'}`));
          }
        });

        s.pipe(currentWriteStream);
      }
      
      const onWriteError = (error: any) => {
        // Clean up partial file on error
        fs.unlink(outputPath, () => {});
        reject(new Error(`File write error: ${error.message}`));
      };
      
      const onWriteFinish = () => {
        if (onProgress) {
          onProgress(100);
        }
        resolve();
      };

      // Attach write stream events dynamically when created
      const attachWriteListeners = () => {
        if (!currentWriteStream) return;
        currentWriteStream.once('error', onWriteError);
        currentWriteStream.once('finish', onWriteFinish);
      };
      // Initial attach for first stream
      setImmediate(attachWriteListeners);
      
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
    let info: any;
    try {
      info = await ytdlDistube.getInfo(sanitizedUrl);
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      const isDecipherIssue = msg.includes('could not parse decipher') || msg.includes('n transform function');
      const is403 = msg.includes('status code: 403');
      if (isDecipherIssue || is403) {
        info = await ytdlCore.getInfo(sanitizedUrl);
      } else {
        throw e;
      }
    }
    
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
