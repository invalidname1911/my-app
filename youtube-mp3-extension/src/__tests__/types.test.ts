import { describe, it, expect } from 'vitest';
import type {
  JobStatus,
  ConversionState,
  HistoryItem,
  ExtensionSettings,
  YouTubeConversionRequest,
  YouTubeConversionResponse,
  JobStatusResponse,
} from '../shared/types';

describe('Types', () => {
  describe('JobStatus', () => {
    it('should accept valid status values', () => {
      const statuses: JobStatus[] = ['queued', 'running', 'done', 'error'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('ConversionState', () => {
    it('should have required properties', () => {
      const state: ConversionState = {
        jobId: 'test-123',
        videoId: 'abc',
        status: 'running',
        progress: 50,
        createdAt: Date.now(),
      };

      expect(state.jobId).toBeDefined();
      expect(state.videoId).toBeDefined();
      expect(state.status).toBeDefined();
      expect(state.progress).toBeDefined();
      expect(state.createdAt).toBeDefined();
    });

    it('should allow optional properties', () => {
      const state: ConversionState = {
        jobId: 'test-123',
        videoId: 'abc',
        title: 'Test Video',
        thumbnail: 'https://example.com/thumb.jpg',
        status: 'done',
        progress: 100,
        error: undefined,
        createdAt: Date.now(),
      };

      expect(state.title).toBe('Test Video');
      expect(state.thumbnail).toBeDefined();
    });
  });

  describe('HistoryItem', () => {
    it('should have required properties', () => {
      const item: HistoryItem = {
        jobId: 'test-123',
        videoId: 'abc',
        title: 'Test Video',
        downloadedAt: Date.now(),
      };

      expect(item.jobId).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.downloadedAt).toBeDefined();
    });
  });

  describe('ExtensionSettings', () => {
    it('should have all settings properties', () => {
      const settings: ExtensionSettings = {
        backendUrl: 'http://localhost:3000',
        bitrate: 192,
        autoDownload: true,
      };

      expect(settings.backendUrl).toBeDefined();
      expect(settings.bitrate).toBeDefined();
      expect(settings.autoDownload).toBeDefined();
    });
  });

  describe('YouTubeConversionRequest', () => {
    it('should require url', () => {
      const request: YouTubeConversionRequest = {
        url: 'https://youtube.com/watch?v=test',
      };

      expect(request.url).toBeDefined();
    });

    it('should allow optional bitrate', () => {
      const request: YouTubeConversionRequest = {
        url: 'https://youtube.com/watch?v=test',
        bitrate: 320,
      };

      expect(request.bitrate).toBe(320);
    });
  });

  describe('YouTubeConversionResponse', () => {
    it('should have jobId', () => {
      const response: YouTubeConversionResponse = {
        jobId: 'test-123',
        title: 'Test Video',
        duration: '3:45',
        thumbnail: 'https://example.com/thumb.jpg',
      };

      expect(response.jobId).toBeDefined();
    });
  });

  describe('JobStatusResponse', () => {
    it('should have status', () => {
      const response: JobStatusResponse = {
        status: 'running',
        progress: 50,
      };

      expect(response.status).toBe('running');
    });

    it('should include downloadUrl when done', () => {
      const response: JobStatusResponse = {
        status: 'done',
        progress: 100,
        downloadUrl: '/api/jobs/test?download=1',
      };

      expect(response.downloadUrl).toBeDefined();
    });

    it('should include error when failed', () => {
      const response: JobStatusResponse = {
        status: 'error',
        error: 'Conversion failed',
      };

      expect(response.error).toBeDefined();
    });
  });
});
