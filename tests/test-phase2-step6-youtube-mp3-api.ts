/**
 * Test Phase 2 Step 6: Implementation of POST /api/youtube-to-mp3 (one-shot job → returns { jobId })
 * 
 * This test ensures that the YouTube to MP3 API endpoint creates jobs correctly,
 * validates input, handles errors appropriately, and starts async processing.
 */

import { NextRequest } from 'next/server';
import { POST } from '../app/api/youtube-to-mp3/route';
import { getJob, getAllJobs, clearAllJobs } from '../lib/jobs';
import * as youtubeLib from '../lib/youtube';
import * as fileLib from '../lib/file';
import * as ffmpegLib from '../lib/ffmpeg';
import fs from 'fs';

// Mock external dependencies
jest.mock('../lib/youtube');
jest.mock('../lib/file');
jest.mock('../lib/ffmpeg');
jest.mock('fs');

const mockedYouTube = jest.mocked(youtubeLib);
const mockedFile = jest.mocked(fileLib);
const mockedFfmpeg = jest.mocked(ffmpegLib);
const mockedFs = jest.mocked(fs);

describe('Phase 2 Step 6: YouTube to MP3 API Route', () => {
  const VALID_YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const VALID_YOUTU_BE_URL = 'https://youtu.be/dQw4w9WgXcQ';

  beforeEach(() => {
    // Clear all jobs before each test
    clearAllJobs();

    // Reset mocks
    jest.clearAllMocks();
    
// Set default environment
    process.env.ENABLE_YOUTUBE = 'true';
    
    // Setup default mock implementations
    mockedYouTube.getYouTubeVideoInfo.mockResolvedValue({
      title: 'Test Video',
      duration: '180',
      author: 'Test Author',
      videoId: 'dQw4w9WgXcQ'
    });
    
    // Mock the validation functions to always return true for valid URLs
    mockedYouTube.isValidYouTubeUrl.mockImplementation((url: string) => {
      const validPatterns = [
        /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/i,
        /^https?:\/\/youtu\.be\//i
      ];
      return validPatterns.some(pattern => pattern.test(url));
    });
    
    mockedYouTube.sanitizeYouTubeUrl.mockImplementation((url: string) => {
      // Simple mock that just returns the URL as-is
      return url;
    });
    
    mockedFile.createTempPath.mockResolvedValue({
      fileId: 'test-file-id-12345',
      absPath: '/temp/test-file-id-12345.webm',
      relPath: 'temp/test-file-id-12345.webm'
    });
    
    mockedFile.createOutputPath.mockResolvedValue('/temp/test-output.mp3');
    
    mockedYouTube.downloadYouTubeAudio.mockImplementation(async (url, path, progressCallback) => {
      // Simulate some progress
      if (progressCallback) {
        progressCallback(0.5);
        progressCallback(1.0);
      }
      // Add a small delay to simulate actual processing
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    mockedFfmpeg.extractAudioMp3.mockImplementation(async (inputPath, outputPath, bitrate, progressCallback) => {
      // Simulate conversion progress
      if (progressCallback) {
        progressCallback(0.5);
        progressCallback(1.0);
      }
      // Add a small delay to simulate actual processing
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    // Mock fs operations
    mockedFs.unlinkSync.mockImplementation(() => {});
    mockedFs.existsSync.mockReturnValue(true);
  });

  describe('Feature flag validation', () => {
    test('should return 403 when YouTube feature is disabled', async () => {
      process.env.ENABLE_YOUTUBE = 'false';
      
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('YouTube download feature is disabled');
    });

    test('should proceed when YouTube feature is enabled', async () => {
      process.env.ENABLE_YOUTUBE = 'true';
      
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();
    });
  });

  describe('Input validation', () => {
    test('should return 400 when URL is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('URL is required');
    });

    test('should return 400 for invalid YouTube URL format', async () => {
      const invalidUrls = [
        'not-a-url',
        'https://example.com/video',
        'https://vimeo.com/123456',
        'ftp://youtube.com/watch?v=123'
      ];

      for (const url of invalidUrls) {
        const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
          method: 'POST',
          body: JSON.stringify({ url })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid YouTube URL format');
      }
    });

    test('should accept valid YouTube URL formats', async () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ'
      ];

      for (const url of validUrls) {
        const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
          method: 'POST',
          body: JSON.stringify({ url })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobId).toBeDefined();
      }
    });

    test('should validate bitrate range', async () => {
      const invalidBitrates = [32, 400, -1, 0];

      for (const bitrate of invalidBitrates) {
        const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
          method: 'POST',
          body: JSON.stringify({ url: VALID_YOUTUBE_URL, bitrate })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Bitrate must be between 64 and 320 kbps');
      }
    });

    test('should accept valid bitrate values', async () => {
      const validBitrates = [64, 128, 192, 256, 320];

      for (const bitrate of validBitrates) {
        const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
          method: 'POST',
          body: JSON.stringify({ url: VALID_YOUTUBE_URL, bitrate })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobId).toBeDefined();
      }
    });

    test('should use default bitrate when not specified', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL })
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      // Wait for async processing to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify extractAudioMp3 was called with default bitrate (192)
      expect(mockedFfmpeg.extractAudioMp3).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        192, // default bitrate
        expect.any(Function)
      );
    });
  });

  describe('Job creation and response', () => {
    test('should create a job and return jobId', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL, bitrate: 256 })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();
      expect(typeof data.jobId).toBe('string');
      expect(data.jobId).toMatch(/^[a-f0-9]+$/); // hex string
    });

    test('should include video info in response when available', async () => {
      const mockVideoInfo = {
        title: 'Amazing Song',
        duration: '240',
        author: 'Great Artist',
        videoId: 'test123'
      };
      
      mockedYouTube.getYouTubeVideoInfo.mockResolvedValue(mockVideoInfo);

      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();
      expect(data.title).toBe(mockVideoInfo.title);
      expect(data.duration).toBe(mockVideoInfo.duration);
    });

    test('should continue without video info if getVideoInfo fails', async () => {
      mockedYouTube.getYouTubeVideoInfo.mockRejectedValue(new Error('Info fetch failed'));

      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();
      expect(data.title).toBeUndefined();
      expect(data.duration).toBeUndefined();
    });

    test('should create job with correct initial status', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Check job was created with correct initial state
      const job = getJob(data.jobId);
      expect(job).toBeDefined();
      expect(job?.status).toMatch(/^(queued|running)$/); // Could be either, depending on timing
      expect(job?.target).toBe('mp3');
      expect(job?.inputPath).toBeDefined();
      expect(job?.outputPath).toBeDefined();
    });
  });

  describe('Async processing initiation', () => {
test('should start async processing after responding', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL, bitrate: 160 })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Allow some time for async processing to complete (since mocks are fast)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify the job status changed to running or completed (since mocks complete quickly)
      const job = getJob(data.jobId);
      expect(job?.status).toMatch(/^(running|done)$/);
    });

    test('should call file helper functions in correct order', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL })
      });

      await POST(request);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify createTempPath was called for download
      expect(mockedFile.createTempPath).toHaveBeenCalledWith('youtube-download.webm');
      
      // Verify createOutputPath was called for conversion
      expect(mockedFile.createOutputPath).toHaveBeenCalledWith(
        expect.any(String),
        'mp3'
      );
    });

    test('should call YouTube download and FFmpeg conversion', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTUBE_URL, bitrate: 256 })
      });

      await POST(request);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify YouTube download was initiated
      expect(mockedYouTube.downloadYouTubeAudio).toHaveBeenCalledWith(
        VALID_YOUTUBE_URL,
        expect.any(String),
        expect.any(Function)
      );

      // Verify FFmpeg conversion was initiated
      expect(mockedFfmpeg.extractAudioMp3).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        256,
        expect.any(Function)
      );
    });

    test('should handle multiple concurrent requests', async () => {
      const urls = [
        'https://www.youtube.com/watch?v=url1',
        'https://www.youtube.com/watch?v=url2',
        'https://www.youtube.com/watch?v=url3'
      ];

      const requests = urls.map(url => 
        new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
          method: 'POST',
          body: JSON.stringify({ url })
        })
      );

      const responses = await Promise.all(requests.map(req => POST(req)));
      
      // Extract job IDs from responses before checking status
      const responseData = await Promise.all(responses.map(r => r.json()));
      
      // All should succeed
      for (let i = 0; i < responses.length; i++) {
        expect(responses[i].status).toBe(200);
        expect(responseData[i].jobId).toBeDefined();
      }

      // All should have unique job IDs
      const jobIds = responseData.map(data => data.jobId);
      const uniqueIds = new Set(jobIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('URL handling edge cases', () => {
    test('should handle URLs with extra whitespace', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: '  ' + VALID_YOUTUBE_URL + '  ' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();
    });

    test('should handle youtu.be short URLs', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: VALID_YOUTU_BE_URL })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();
    });

    test('should handle URLs with additional parameters', async () => {
      const urlWithParams = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&feature=share';
      
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: urlWithParams })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();
    });
  });
});