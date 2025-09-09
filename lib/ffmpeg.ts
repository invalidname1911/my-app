import Ffmpeg from '@ts-ffmpeg/fluent-ffmpeg';
import { promises as fs } from 'fs';
import { createOutputPath } from './file';
import { getPreset, getAudioBitrate } from './presets';
import { FfprobeData } from '@ts-ffmpeg/fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Set the path to the FFmpeg binary - use ffmpeg-static if available, fallback to local binary
const FFMPEG_PATH = ffmpegStatic || process.env.FFMPEG_PATH || './bin/ffmpeg.exe';
Ffmpeg.setFfmpegPath(FFMPEG_PATH);

/**
 * Convert a video file to MP4 format
 * @param inputPath Path to input video file
 * @param outputPath Path to output MP4 file
 * @param preset Preset to use for conversion
 * @param onProgress Optional progress callback
 * @returns Promise that resolves when conversion is complete
 */
export async function convertToMp4(
  inputPath: string,
  outputPath: string,
  preset: 'web' | 'mobile',
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Get preset configuration
    const presetConfig = getPreset(preset);
    
    Ffmpeg(inputPath)
      .videoCodec(presetConfig.vcodec)
      .audioCodec(presetConfig.acodec)
      .size(presetConfig.scale)
      .format('mp4')
      .addOptions([
        `-crf ${presetConfig.crf}`,
        '-preset fast',  // Speed preset for encoding
        '-movflags +faststart'  // Optimize for web streaming
      ])
      .on('progress', (info: {
        frames: number;
        currentFps: number;
        currentKbps: number;
        targetSize: number;
        timemark: string;
        percent?: number;
      }) => {
        if (onProgress && info.percent !== undefined) {
          onProgress(Math.round(info.percent));
        }
      })
      .on('error', (err: Error) => {
        reject(new Error(`FFmpeg conversion error: ${err.message}`));
      })
      .on('end', () => {
        resolve();
      })
      .save(outputPath);
  });
}

/**
 * Extract audio from a media file to MP3 format
 * @param inputPath Path to input media file
 * @param outputPath Path to output MP3 file
 * @param bitrateKbps Audio bitrate in kbps
 * @param onProgress Optional progress callback
 * @returns Promise that resolves when extraction is complete
 */
export async function extractAudioMp3(
  inputPath: string,
  outputPath: string,
  bitrateKbps: number = 192,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    Ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate(bitrateKbps)
      .format('mp3')
      .on('progress', (info: {
        frames: number;
        currentFps: number;
        currentKbps: number;
        targetSize: number;
        timemark: string;
        percent?: number;
      }) => {
        if (onProgress && info.percent !== undefined) {
          onProgress(Math.round(info.percent));
        }
      })
      .on('error', (err: Error) => {
        reject(new Error(`FFmpeg audio extraction error: ${err.message}`));
      })
      .on('end', () => {
        resolve();
      })
      .save(outputPath);
  });
}

/**
 * Get media file information
 * @param inputPath Path to media file
 * @returns Promise that resolves with media information
 */
export async function getMediaInfo(inputPath: string): Promise<FfprobeData> {
  return new Promise((resolve, reject) => {
    Ffmpeg(inputPath)
      .ffprobe((err: Error | null, data: FfprobeData) => {
        if (err) {
          reject(new Error(`FFprobe error: ${err.message}`));
        } else {
          resolve(data);
        }
      });
  });
}

/**
 * Validate that FFmpeg is properly configured
 * @returns Promise that resolves with validation result
 */
export async function validateFFmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpegPath = FFMPEG_PATH;

    if (!ffmpegPath) {
      resolve(false);
      return;
    }

    // Check if the ffmpeg binary exists and is executable
    fs.access(ffmpegPath, fs.constants.X_OK)
      .then(() => {
        Ffmpeg.getAvailableCodecs((err: Error | null, codecs: any) => {
          if (err) {
            console.warn('FFmpeg codec check failed:', err.message);
            resolve(false);
          } else {
            resolve(Object.keys(codecs).length > 0);
          }
        });
      })
      .catch((error) => {
        console.warn('FFmpeg binary access failed:', error.message);
        resolve(false);
      });
  });
}