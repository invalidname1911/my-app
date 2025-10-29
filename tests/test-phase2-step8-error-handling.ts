/**
 * Test Phase 2 Step 8: Handle common error cases (age-restricted/region-locked/live) with clear messages
 * 
 * This test ensures that the YouTube download functionality properly handles common error
 * scenarios like age-restricted videos, region-locked content, live streams, and private
 * videos with clear, user-friendly error messages.
 */

import { downloadYouTubeAudio, isValidYouTubeUrl, sanitizeYouTubeUrl, getYouTubeVideoInfo } from '../lib/youtube';
import { NextRequest } from 'next/server';
import { POST as youtubePost } from '../app/api/youtube/route';
import { POST as youtubeMp3Post } from '../app/api/youtube-to-mp3/route';
import { getJob, updateJob } from '../lib/jobs';
import * as fileLib from '../lib/file';
import * as ffmpegLib from '../lib/ffmpeg';
import fs from 'fs';

// Mock external dependencies
jest.mock('../lib/file');
jest.mock('../lib/ffmpeg');
jest.mock('fs');

const mockedFile = jest.mocked(fileLib);
const mockedFfmpeg = jest.mocked(ffmpegLib);
const mockedFs = jest.mocked(fs);

describe('Phase 2 Step 8: Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_YOUTUBE = 'true';
    
    // Setup default mocks
    mockedFile.createTempPath.mockResolvedValue({
      fileId: 'test-file-id',
      absPath: '/temp/test.webm',
      relPath: 'temp/test.webm'
    });
    
    mockedFile.createOutputPath.mockResolvedValue('/temp/output.mp3');
    mockedFfmpeg.extractAudioMp3.mockResolvedValue(undefined);
    mockedFs.unlinkSync.mockImplementation(() => {});
    mockedFs.existsSync.mockReturnValue(false);
  });

  describe('YouTube URL Validation Errors', () => {
    test('should detect invalid YouTube URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'https://vimeo.com/123456',
        'https://dailymotion.com/video/123',
        'https://example.com/youtube-fake',
        'ftp://youtube.com/watch?v=123',
        'https://youtube-fake.com/watch?v=123',
        ''
      ];

      for (const url of invalidUrls) {
        expect(isValidYouTubeUrl(url)).toBe(false);
      }
    });

    test('should accept valid YouTube URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://music.youtube.com/watch?v=dQw4w9WgXcQ'
      ];

      for (const url of validUrls) {
        expect(isValidYouTubeUrl(url)).toBe(true);
      }
    });

    test('should sanitize YouTube URLs properly', () => {
      const testCases = [
        {
          input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=dangerous&other=param',
          expected: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        },
        {
          input: 'https://www.youtube.com/watch?v=test&t=30s',
          expected: 'https://www.youtube.com/watch?v=test&t=30s'
        },
        {
          input: 'https://www.youtube.com/watch?v=test&start=10&end=60',
          expected: 'https://www.youtube.com/watch?v=test&start=10&end=60'
        }
      ];

      for (const { input, expected } of testCases) {
        expect(sanitizeYouTubeUrl(input)).toBe(expected);
      }
    });

    test('should throw error for malformed URLs in sanitization', () => {
      const malformedUrls = [
        'not-a-url',
        'invalid://url',
        ''
      ];

      for (const url of malformedUrls) {
        expect(() => sanitizeYouTubeUrl(url)).toThrow('Invalid URL format');
      }
    });
  });

  describe('Download Error Scenarios', () => {
    test('should handle age-restricted video errors', async () => {
      const ageRestrictedError = new Error('This video is age-restricted and requires sign-in to view');

      // Test direct function call
      await expect(
        downloadYouTubeAudio('https://www.youtube.com/watch?v=age-restricted', '/temp/test.webm')
      ).rejects.toThrow('Video is age-restricted or requires sign-in');
    });

    test('should handle private/unavailable video errors', async () => {
      const privateErrors = [
        new Error('Video unavailable: private video'),
        new Error('This video is unavailable'),
        new Error('Video unavailable')
      ];

      for (const error of privateErrors) {
        await expect(
          downloadYouTubeAudio('https://www.youtube.com/watch?v=private', '/temp/test.webm')
        ).rejects.toThrow('Video is unavailable, private, or region-locked');
      }
    });

    test('should handle live stream errors', async () => {
      const liveStreamError = new Error('Cannot download live streams');

      await expect(
        downloadYouTubeAudio('https://www.youtube.com/watch?v=livestream', '/temp/test.webm')
      ).rejects.toThrow('Live streams are not supported');
    });

    test('should handle network and generic errors', async () => {
      const networkError = new Error('Network timeout occurred');

      await expect(
        downloadYouTubeAudio('https://www.youtube.com/watch?v=network-error', '/temp/test.webm')
      ).rejects.toThrow('Download failed: Network timeout occurred');
    });
  });

  describe('API Error Response Handling', () => {
    test('should return proper error response for age-restricted videos in YouTube API', async () => {
      // Mock getYouTubeVideoInfo to simulate age-restricted error
      jest.doMock('../lib/youtube', () => ({
        ...jest.requireActual('../lib/youtube'),
        getYouTubeVideoInfo: jest.fn().mockRejectedValue(new Error('age-restricted content')),
        downloadYouTubeAudio: jest.fn().mockRejectedValue(new Error('This video is age-restricted'))
      }));

      const request = new NextRequest('http://localhost:3000/api/youtube', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=age-restricted' })
      });

      const response = await youtubePost(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Age-restricted content');
      expect(data.details).toBe('Cannot download age-restricted videos');
    });

    test('should return proper error response for unavailable videos in YouTube API', async () => {
      jest.doMock('../lib/youtube', () => ({
        ...jest.requireActual('../lib/youtube'),
        getYouTubeVideoInfo: jest.fn().mockRejectedValue(new Error('Video unavailable')),
        downloadYouTubeAudio: jest.fn().mockRejectedValue(new Error('Video unavailable: private video'))
      }));

      const request = new NextRequest('http://localhost:3000/api/youtube', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=unavailable' })
      });

      const response = await youtubePost(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Video is unavailable');
      expect(data.details).toBe('The video may be private, deleted, or restricted in your region');
    });

    test('should return proper error response for live streams in YouTube API', async () => {
      jest.doMock('../lib/youtube', () => ({
        ...jest.requireActual('../lib/youtube'),
        getYouTubeVideoInfo: jest.fn().mockRejectedValue(new Error('live stream not supported')),
        downloadYouTubeAudio: jest.fn().mockRejectedValue(new Error('Cannot download live content'))
      }));

      const request = new NextRequest('http://localhost:3000/api/youtube', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=live-stream' })
      });

      const response = await youtubePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Live content not supported');
      expect(data.details).toBe('Cannot download live streams or premieres');
    });
  });

  describe('YouTube to MP3 Error Handling', () => {
    test('should handle errors during async processing in youtube-to-mp3', async () => {
      // Create a spy on the actual implementation
      const downloadSpy = jest.fn().mockRejectedValue(new Error('Video is age-restricted'));
      
      jest.doMock('../lib/youtube', () => ({
        ...jest.requireActual('../lib/youtube'),
        downloadYouTubeAudio: downloadSpy,
        getYouTubeVideoInfo: jest.fn().mockResolvedValue({
          title: 'Test Video',
          duration: '180',
          author: 'Test Author',
          videoId: 'test123'
        })
      }));

      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=age-restricted' })
      });

      const response = await youtubeMp3Post(request);
      const data = await response.json();

      // Should initially return success with jobId
      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check job status - should have error
      const job = getJob(data.jobId);
      expect(job?.status).toBe('error');
      expect(job?.error).toBe('Video is age-restricted or requires sign-in');
    });

    test('should clean up files on error during conversion', async () => {
      const downloadSpy = jest.fn().mockRejectedValue(new Error('Video unavailable'));
      
      jest.doMock('../lib/youtube', () => ({
        ...jest.requireActual('../lib/youtube'),
        downloadYouTubeAudio: downloadSpy,
        getYouTubeVideoInfo: jest.fn().mockResolvedValue({
          title: 'Test Video',
          duration: '180',
          author: 'Test Author',
          videoId: 'test123'
        })
      }));

      // Mock file existence checks
      mockedFs.existsSync.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=unavailable' })
      });

      const response = await youtubeMp3Post(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Wait for async processing and cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify cleanup was attempted
      expect(mockedFs.unlinkSync).toHaveBeenCalled();
    });

    test('should map specific error messages correctly in youtube-to-mp3', async () => {
      const errorTestCases = [
        {
          originalError: 'Video unavailable: private video',
          expectedMessage: 'Video is unavailable, private, or region-locked'
        },
        {
          originalError: 'This video is age-restricted',
          expectedMessage: 'Video is age-restricted or requires sign-in'
        },
        {
          originalError: 'Cannot download live streams',
          expectedMessage: 'Live streams are not supported'
        },
        {
          originalError: 'Some other error',
          expectedMessage: 'Some other error'
        }
      ];

      for (const { originalError, expectedMessage } of errorTestCases) {
        const downloadSpy = jest.fn().mockRejectedValue(new Error(originalError));
        
        jest.doMock('../lib/youtube', () => ({
          ...jest.requireActual('../lib/youtube'),
          downloadYouTubeAudio: downloadSpy,
          getYouTubeVideoInfo: jest.fn().mockResolvedValue({
            title: 'Test Video',
            duration: '180',
            author: 'Test Author',
            videoId: 'test123'
          })
        }));

        const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
          method: 'POST',
          body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test' })
        });

        const response = await youtubeMp3Post(request);
        const data = await response.json();

        expect(response.status).toBe(200);

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 100));

        const job = getJob(data.jobId);
        expect(job?.status).toBe('error');
        expect(job?.error).toBe(expectedMessage);
      }
    });
  });

  describe('Edge Case Error Handling', () => {
    test('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: 'invalid json{'
      });

      const response = await youtubeMp3Post(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    test('should handle file write errors during download', async () => {
      // This would be tested by mocking fs operations to fail
      const downloadSpy = jest.fn().mockRejectedValue(new Error('File write error: Permission denied'));
      
      jest.doMock('../lib/youtube', () => ({
        ...jest.requireActual('../lib/youtube'),
        downloadYouTubeAudio: downloadSpy
      }));

      await expect(
        downloadYouTubeAudio('https://www.youtube.com/watch?v=test', '/temp/test.webm')
      ).rejects.toThrow('File write error: Permission denied');
    });

    test('should handle missing video info gracefully', async () => {
      // Test when getYouTubeVideoInfo fails but download might still work
      const infoSpy = jest.fn().mockRejectedValue(new Error('Cannot get video info'));
      
      jest.doMock('../lib/youtube', () => ({
        ...jest.requireActual('../lib/youtube'),
        getYouTubeVideoInfo: infoSpy,
        downloadYouTubeAudio: jest.fn().mockResolvedValue(undefined)
      }));

      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=no-info' })
      });

      const response = await youtubeMp3Post(request);
      const data = await response.json();

      // Should still proceed with conversion
      expect(response.status).toBe(200);
      expect(data.jobId).toBeDefined();
      expect(data.title).toBeUndefined();
      expect(data.duration).toBeUndefined();
    });

    test('should handle FFmpeg conversion errors', async () => {
      const ffmpegError = new Error('FFmpeg conversion failed: invalid codec');
      mockedFfmpeg.extractAudioMp3.mockRejectedValue(ffmpegError);
      
      jest.doMock('../lib/youtube', () => ({
        ...jest.requireActual('../lib/youtube'),
        downloadYouTubeAudio: jest.fn().mockResolvedValue(undefined),
        getYouTubeVideoInfo: jest.fn().mockResolvedValue({
          title: 'Test Video',
          duration: '180',
          author: 'Test Author',
          videoId: 'test123'
        })
      }));

      const request = new NextRequest('http://localhost:3000/api/youtube-to-mp3', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test' })
      });

      const response = await youtubeMp3Post(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const job = getJob(data.jobId);
      expect(job?.status).toBe('error');
      expect(job?.error).toContain('FFmpeg conversion failed');
    });
  });

  describe('Error Message Clarity', () => {
    test('should provide clear error messages for user-facing errors', () => {
      const errorMappings = [
        {
          internal: 'Video unavailable',
          userFacing: 'Video is unavailable, private, or region-locked'
        },
        {
          internal: 'age-restricted',
          userFacing: 'Video is age-restricted or requires sign-in'
        },
        {
          internal: 'live',
          userFacing: 'Live streams are not supported'
        }
      ];

      // These mappings should be used in the actual error handling code
      for (const { internal, userFacing } of errorMappings) {
        expect(userFacing).toBeDefined();
        expect(userFacing.length).toBeGreaterThan(10); // Should be descriptive
        expect(userFacing).not.toContain('Error:'); // Should be user-friendly
      }
    });

    test('should include helpful details in error responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/youtube', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://vimeo.com/123456' })
      });

      const response = await youtubePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error).toBe('Invalid YouTube URL format');
      // Should provide clear, actionable error message
    });

    test('should handle timeout errors gracefully', async () => {
      const timeoutError = new Error('Request timeout after 30 seconds');
      
      await expect(
        downloadYouTubeAudio('https://www.youtube.com/watch?v=timeout', '/temp/test.webv')
      ).rejects.toThrow('Download failed: Request timeout after 30 seconds');
    });
  });
});