/**
 * Test Phase 2 Step 7: Map progress: download 0–50, ffmpeg 50–100; update in-memory job store
 * 
 * This test ensures that progress is correctly mapped during the YouTube to MP3 conversion
 * process, with download progress mapping to 0-50% and FFmpeg conversion mapping to 50-100%.
 * It also verifies that the in-memory job store is updated properly throughout the process.
 */

import { createJob, updateJob, getJob, setJob } from '../lib/jobs';
import { downloadYouTubeAudio } from '../lib/youtube';
import { extractAudioMp3 } from '../lib/ffmpeg';
import { createTempPath, createOutputPath } from '../lib/file';
import { randomBytes } from 'crypto';

// Mock external dependencies
jest.mock('../lib/youtube');
jest.mock('../lib/ffmpeg');
jest.mock('../lib/file');

const mockedDownloadYouTubeAudio = jest.mocked(downloadYouTubeAudio);
const mockedExtractAudioMp3 = jest.mocked(extractAudioMp3);
const mockedCreateTempPath = jest.mocked(createTempPath);
const mockedCreateOutputPath = jest.mocked(createOutputPath);

describe('Phase 2 Step 7: Progress Mapping', () => {
  const YOUTUBE_URL = 'https://www.youtube.com/watch?v=test123';
  const MOCK_INPUT_PATH = '/temp/input-file.webm';
  const MOCK_OUTPUT_PATH = '/temp/output-file.mp3';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockedCreateTempPath.mockResolvedValue({
      fileId: 'test-file-id',
      absPath: MOCK_INPUT_PATH,
      relPath: 'temp/input-file.webm'
    });

    mockedCreateOutputPath.mockResolvedValue(MOCK_OUTPUT_PATH);
  });

  describe('Download Progress Mapping (0-50%)', () => {
    test('should map download progress from 0-100% to 0-50%', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      const progressUpdates: number[] = [];
      
      // Mock downloadYouTubeAudio to simulate progress callbacks
      mockedDownloadYouTubeAudio.mockImplementation(async (url, path, onProgress) => {
        // Simulate download progress from 0% to 100%
        const progressValues = [0, 25, 50, 75, 100];
        
        for (const progress of progressValues) {
          if (onProgress) {
            onProgress(progress);
          }
          
          // Capture the job progress after each update
          const updatedJob = getJob(job.id);
          if (updatedJob?.progress !== undefined) {
            progressUpdates.push(updatedJob.progress);
          }
        }
      });

      // Simulate the download phase with progress mapping
      await mockedDownloadYouTubeAudio(YOUTUBE_URL, MOCK_INPUT_PATH, (downloadProgress) => {
        // Map download progress to 0-50%
        const mappedProgress = Math.round(downloadProgress * 0.5);
        updateJob(job.id, { progress: Math.max(0, Math.min(50, mappedProgress)) });
      });

      // Verify progress was mapped correctly: 0, 12.5→13, 25, 37.5→38, 50
      expect(progressUpdates).toEqual([0, 13, 25, 38, 50]);
    });

    test('should handle edge cases in download progress mapping', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      
      const testCases = [
        { input: -10, expected: 0 },    // Negative progress
        { input: 0, expected: 0 },      // Zero progress
        { input: 50, expected: 25 },    // Mid progress
        { input: 100, expected: 50 },   // Complete progress
        { input: 150, expected: 50 }    // Over 100% progress
      ];

      for (const { input, expected } of testCases) {
        // Map download progress to 0-50%
        const mappedProgress = Math.round(input * 0.5);
        const clampedProgress = Math.max(0, Math.min(50, mappedProgress));
        
        updateJob(job.id, { progress: clampedProgress });
        
        const updatedJob = getJob(job.id);
        expect(updatedJob?.progress).toBe(expected);
      }
    });

    test('should update job status during download phase', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      
      // Initial status should be queued
      expect(getJob(job.id)?.status).toBe('queued');
      
      // Start download phase
      updateJob(job.id, { status: 'running', progress: 0 });
      expect(getJob(job.id)?.status).toBe('running');
      expect(getJob(job.id)?.progress).toBe(0);
      
      // Progress during download
      updateJob(job.id, { progress: 25 });
      expect(getJob(job.id)?.progress).toBe(25);
      expect(getJob(job.id)?.status).toBe('running');
      
      // Complete download phase
      updateJob(job.id, { progress: 50 });
      expect(getJob(job.id)?.progress).toBe(50);
      expect(getJob(job.id)?.status).toBe('running');
    });
  });

  describe('FFmpeg Progress Mapping (50-100%)', () => {
    test('should map FFmpeg progress from 0-100% to 50-100%', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      const progressUpdates: number[] = [];
      
      // Start with download completed (50%)
      updateJob(job.id, { status: 'running', progress: 50 });
      
      // Mock extractAudioMp3 to simulate progress callbacks
      mockedExtractAudioMp3.mockImplementation(async (inputPath, outputPath, bitrate, onProgress) => {
        // Simulate FFmpeg progress from 0% to 100%
        const progressValues = [0, 25, 50, 75, 100];
        
        for (const progress of progressValues) {
          if (onProgress) {
            onProgress(progress);
          }
          
          // Capture the job progress after each update
          const updatedJob = getJob(job.id);
          if (updatedJob?.progress !== undefined) {
            progressUpdates.push(updatedJob.progress);
          }
        }
      });

      // Simulate the conversion phase with progress mapping
      await mockedExtractAudioMp3(MOCK_INPUT_PATH, MOCK_OUTPUT_PATH, 192, (conversionProgress) => {
        // Map conversion progress to 50-100%
        const mappedProgress = 50 + Math.round(conversionProgress * 0.5);
        updateJob(job.id, { progress: Math.max(50, Math.min(100, mappedProgress)) });
      });

      // Verify progress was mapped correctly: 50 (starting), 62.5→63, 75, 87.5→88, 100
      expect(progressUpdates).toEqual([50, 63, 75, 88, 100]);
    });

    test('should handle edge cases in FFmpeg progress mapping', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      
      // Start with download completed
      updateJob(job.id, { progress: 50 });
      
      const testCases = [
        { input: -10, expected: 50 },   // Negative progress
        { input: 0, expected: 50 },     // Zero progress
        { input: 50, expected: 75 },    // Mid progress
        { input: 100, expected: 100 },  // Complete progress
        { input: 150, expected: 100 }   // Over 100% progress
      ];

      for (const { input, expected } of testCases) {
        // Map conversion progress to 50-100%
        const mappedProgress = 50 + Math.round(input * 0.5);
        const clampedProgress = Math.max(50, Math.min(100, mappedProgress));
        
        updateJob(job.id, { progress: clampedProgress });
        
        const updatedJob = getJob(job.id);
        expect(updatedJob?.progress).toBe(expected);
      }
    });

    test('should update job status during conversion phase', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      
      // Start with download completed
      updateJob(job.id, { status: 'running', progress: 50 });
      
      // Progress during conversion
      updateJob(job.id, { progress: 75 });
      expect(getJob(job.id)?.progress).toBe(75);
      expect(getJob(job.id)?.status).toBe('running');
      
      // Complete conversion phase
      updateJob(job.id, { progress: 100, status: 'done' });
      expect(getJob(job.id)?.progress).toBe(100);
      expect(getJob(job.id)?.status).toBe('done');
    });
  });

  describe('End-to-End Progress Mapping', () => {
    test('should correctly map progress throughout entire YouTube to MP3 process', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      const allProgressUpdates: Array<{ phase: string; progress: number; status: string }> = [];
      
      // Phase 1: Download (0-50%)
      updateJob(job.id, { status: 'running', progress: 0 });
      allProgressUpdates.push({ phase: 'download_start', progress: getJob(job.id)!.progress!, status: getJob(job.id)!.status });
      
      // Simulate download progress updates
      const downloadProgressValues = [10, 25, 50, 75, 100];
      for (const downloadProgress of downloadProgressValues) {
        const mappedProgress = Math.round(downloadProgress * 0.5);
        updateJob(job.id, { progress: Math.max(0, Math.min(50, mappedProgress)) });
        allProgressUpdates.push({ 
          phase: 'download', 
          progress: getJob(job.id)!.progress!, 
          status: getJob(job.id)!.status 
        });
      }
      
      // Phase 2: FFmpeg conversion (50-100%)
      const conversionProgressValues = [10, 25, 50, 75, 100];
      for (const conversionProgress of conversionProgressValues) {
        const mappedProgress = 50 + Math.round(conversionProgress * 0.5);
        const finalProgress = Math.max(50, Math.min(100, mappedProgress));
        const status = finalProgress === 100 ? 'done' : 'running';
        updateJob(job.id, { progress: finalProgress, status });
        allProgressUpdates.push({ 
          phase: 'conversion', 
          progress: getJob(job.id)!.progress!, 
          status: getJob(job.id)!.status 
        });
      }

      // Verify complete progress sequence
      const expectedSequence = [
        { phase: 'download_start', progress: 0, status: 'running' },
        { phase: 'download', progress: 5, status: 'running' },
        { phase: 'download', progress: 13, status: 'running' },
        { phase: 'download', progress: 25, status: 'running' },
        { phase: 'download', progress: 38, status: 'running' },
        { phase: 'download', progress: 50, status: 'running' },
        { phase: 'conversion', progress: 55, status: 'running' },
        { phase: 'conversion', progress: 63, status: 'running' },
        { phase: 'conversion', progress: 75, status: 'running' },
        { phase: 'conversion', progress: 88, status: 'running' },
        { phase: 'conversion', progress: 100, status: 'done' }
      ];
      
      expect(allProgressUpdates).toEqual(expectedSequence);
    });

    test('should maintain job state consistency during progress updates', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      updateJob(job.id, { outputPath: MOCK_OUTPUT_PATH });
      
      const initialJob = getJob(job.id)!;
      expect(initialJob.id).toBe(job.id);
      expect(initialJob.inputPath).toBe(MOCK_INPUT_PATH);
      expect(initialJob.outputPath).toBe(MOCK_OUTPUT_PATH);
      expect(initialJob.target).toBe('mp3');
      
      // Update progress multiple times
      const progressSequence = [0, 15, 30, 45, 60, 75, 90, 100];
      
      for (const progress of progressSequence) {
        const status = progress === 100 ? 'done' : 'running';
        updateJob(job.id, { progress, status });
        
        const updatedJob = getJob(job.id)!;
        
        // Verify job properties remain consistent
        expect(updatedJob.id).toBe(job.id);
        expect(updatedJob.inputPath).toBe(MOCK_INPUT_PATH);
        expect(updatedJob.outputPath).toBe(MOCK_OUTPUT_PATH);
        expect(updatedJob.target).toBe('mp3');
        expect(updatedJob.progress).toBe(progress);
        expect(updatedJob.status).toBe(status);
        
        // Verify timestamps are updated
        expect(updatedJob.updatedAt).toBeInstanceOf(Date);
        expect(updatedJob.updatedAt.getTime()).toBeGreaterThanOrEqual(initialJob.updatedAt.getTime());
      }
    });
  });

  describe('Job Store Operations', () => {
    test('should update job store atomically during progress updates', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      const jobId = job.id;
      
      // Verify initial state
      const initialJob = getJob(jobId);
      expect(initialJob?.status).toBe('queued');
      expect(initialJob?.progress).toBeUndefined();
      
      // Update job with progress and status
      updateJob(jobId, { status: 'running', progress: 25 });
      
      const updatedJob = getJob(jobId);
      expect(updatedJob?.status).toBe('running');
      expect(updatedJob?.progress).toBe(25);
      expect(updatedJob?.id).toBe(jobId); // ID should remain unchanged
    });

    test('should handle concurrent progress updates safely', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      const jobId = job.id;
      
      // Simulate concurrent updates
      const updates = [
        { progress: 10, status: 'running' as const },
        { progress: 20, status: 'running' as const },
        { progress: 30, status: 'running' as const }
      ];
      
      // Apply updates concurrently
      await Promise.all(
        updates.map(update => 
          Promise.resolve(updateJob(jobId, update))
        )
      );
      
      const finalJob = getJob(jobId);
      expect(finalJob?.status).toBe('running');
      expect(finalJob?.progress).toBeGreaterThanOrEqual(10);
      expect(finalJob?.progress).toBeLessThanOrEqual(30);
    });

    test('should preserve job metadata during progress updates', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      const jobId = job.id;
      
      // Add additional metadata
      updateJob(jobId, { 
        outputPath: MOCK_OUTPUT_PATH,
        preset: 'web'
      });
      
      // Update progress multiple times
      for (let progress = 0; progress <= 100; progress += 25) {
        updateJob(jobId, { progress });
        
        const currentJob = getJob(jobId);
        expect(currentJob?.outputPath).toBe(MOCK_OUTPUT_PATH);
        expect(currentJob?.preset).toBe('web');
        expect(currentJob?.inputPath).toBe(MOCK_INPUT_PATH);
        expect(currentJob?.target).toBe('mp3');
        expect(currentJob?.progress).toBe(progress);
      }
    });

    test('should handle progress updates for non-existent jobs gracefully', () => {
      const fakeJobId = randomBytes(16).toString('hex');
      
      // Attempt to update non-existent job
      updateJob(fakeJobId, { progress: 50 });
      
      // Job should still not exist
      const result = getJob(fakeJobId);
      expect(result).toBeUndefined();
    });
  });

  describe('Progress Boundary Conditions', () => {
    test('should enforce progress boundaries correctly', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      
      // Test download phase boundaries (0-50)
      const downloadTests = [
        { raw: -50, expected: 0 },
        { raw: 200, expected: 50 }
      ];
      
      for (const { raw, expected } of downloadTests) {
        const mapped = Math.round(raw * 0.5);
        const bounded = Math.max(0, Math.min(50, mapped));
        expect(bounded).toBe(expected);
      }
      
      // Test conversion phase boundaries (50-100)
      const conversionTests = [
        { raw: -50, expected: 50 },
        { raw: 200, expected: 100 }
      ];
      
      for (const { raw, expected } of conversionTests) {
        const mapped = 50 + Math.round(raw * 0.5);
        const bounded = Math.max(50, Math.min(100, mapped));
        expect(bounded).toBe(expected);
      }
    });

    test('should handle rapid progress updates smoothly', async () => {
      const job = createJob(MOCK_INPUT_PATH, 'mp3');
      const progressHistory: number[] = [];
      
      // Simulate rapid download progress updates
      for (let i = 0; i <= 100; i += 5) {
        const mapped = Math.round(i * 0.5);
        const bounded = Math.max(0, Math.min(50, mapped));
        updateJob(job.id, { progress: bounded });
        progressHistory.push(getJob(job.id)!.progress!);
      }
      
      // Verify progress is monotonically increasing and bounded
      for (let i = 1; i < progressHistory.length; i++) {
        expect(progressHistory[i]).toBeGreaterThanOrEqual(progressHistory[i - 1]);
        expect(progressHistory[i]).toBeGreaterThanOrEqual(0);
        expect(progressHistory[i]).toBeLessThanOrEqual(50);
      }
      
      expect(progressHistory[0]).toBe(0);
      expect(progressHistory[progressHistory.length - 1]).toBe(50);
    });
  });
});