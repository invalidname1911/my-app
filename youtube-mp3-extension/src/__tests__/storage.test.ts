import { describe, it, expect, beforeEach } from 'vitest';
import { mockStorage } from './setup';
import {
  getActiveJobs,
  addActiveJob,
  updateActiveJob,
  removeActiveJob,
  getHistory,
  addToHistory,
  clearHistory,
  getSettings,
  updateSettings,
} from '../shared/storage';
import type { ConversionState, HistoryItem } from '../shared/types';

describe('Storage', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  describe('Active Jobs', () => {
    it('should return empty array when no jobs', async () => {
      const jobs = await getActiveJobs();
      expect(jobs).toEqual([]);
    });

    it('should add and retrieve active jobs', async () => {
      const job: ConversionState = {
        jobId: 'test-123',
        videoId: 'abc',
        status: 'running',
        progress: 50,
        createdAt: Date.now(),
      };

      await addActiveJob(job);
      const jobs = await getActiveJobs();
      
      expect(jobs).toHaveLength(1);
      expect(jobs[0].jobId).toBe('test-123');
    });

    it('should update active job', async () => {
      const job: ConversionState = {
        jobId: 'test-123',
        videoId: 'abc',
        status: 'running',
        progress: 50,
        createdAt: Date.now(),
      };

      await addActiveJob(job);
      await updateActiveJob('test-123', { progress: 75, status: 'running' });
      
      const jobs = await getActiveJobs();
      expect(jobs[0].progress).toBe(75);
    });

    it('should remove active job', async () => {
      const job: ConversionState = {
        jobId: 'test-123',
        videoId: 'abc',
        status: 'done',
        progress: 100,
        createdAt: Date.now(),
      };

      await addActiveJob(job);
      await removeActiveJob('test-123');
      
      const jobs = await getActiveJobs();
      expect(jobs).toHaveLength(0);
    });
  });

  describe('History', () => {
    it('should return empty array when no history', async () => {
      const history = await getHistory();
      expect(history).toEqual([]);
    });

    it('should add items to history', async () => {
      const item: HistoryItem = {
        jobId: 'test-123',
        videoId: 'abc',
        title: 'Test Video',
        downloadedAt: Date.now(),
      };

      await addToHistory(item);
      const history = await getHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0].title).toBe('Test Video');
    });

    it('should keep newest items first', async () => {
      const item1: HistoryItem = {
        jobId: 'test-1',
        videoId: 'abc',
        title: 'First Video',
        downloadedAt: Date.now() - 1000,
      };
      const item2: HistoryItem = {
        jobId: 'test-2',
        videoId: 'def',
        title: 'Second Video',
        downloadedAt: Date.now(),
      };

      await addToHistory(item1);
      await addToHistory(item2);
      
      const history = await getHistory();
      expect(history[0].title).toBe('Second Video');
    });

    it('should limit history to 50 items', async () => {
      for (let i = 0; i < 60; i++) {
        await addToHistory({
          jobId: `test-${i}`,
          videoId: `vid-${i}`,
          title: `Video ${i}`,
          downloadedAt: Date.now() + i,
        });
      }

      const history = await getHistory();
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should clear history', async () => {
      await addToHistory({
        jobId: 'test-1',
        videoId: 'abc',
        title: 'Test',
        downloadedAt: Date.now(),
      });

      await clearHistory();
      const history = await getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Settings', () => {
    it('should return default settings when none saved', async () => {
      const settings = await getSettings();
      
      expect(settings.bitrate).toBe(192);
      expect(settings.autoDownload).toBe(true);
      expect(settings.backendUrl).toBeDefined();
    });

    it('should update settings', async () => {
      await updateSettings({ bitrate: 320 });
      const settings = await getSettings();
      
      expect(settings.bitrate).toBe(320);
      expect(settings.autoDownload).toBe(true); // Default preserved
    });

    it('should merge settings updates', async () => {
      await updateSettings({ bitrate: 256 });
      await updateSettings({ autoDownload: false });
      
      const settings = await getSettings();
      expect(settings.bitrate).toBe(256);
      expect(settings.autoDownload).toBe(false);
    });
  });
});
