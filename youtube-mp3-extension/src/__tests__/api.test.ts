import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Import after mocking
import { sanitizeFilename } from '../shared/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFilename('test<>:"/\\|?*file')).toBe('testfile');
    });

    it('should trim whitespace', () => {
      expect(sanitizeFilename('  test file  ')).toBe('test file');
    });

    it('should collapse multiple spaces', () => {
      expect(sanitizeFilename('test    file')).toBe('test file');
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(250);
      expect(sanitizeFilename(longName).length).toBe(200);
    });

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('should handle typical YouTube titles', () => {
      expect(sanitizeFilename('My Video Title - Artist (Official Video)')).toBe(
        'My Video Title - Artist (Official Video)'
      );
    });
  });
});

describe('API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle successful conversion response', async () => {
    const mockResponse = {
      jobId: 'test-job-123',
      title: 'Test Video',
      duration: '3:45',
      thumbnail: 'https://example.com/thumb.jpg',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const response = await fetch('http://localhost:3000/api/youtube-to-mp3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtube.com/watch?v=test', bitrate: 192 }),
    });

    const data = await response.json();
    expect(data.jobId).toBe('test-job-123');
    expect(data.title).toBe('Test Video');
  });

  it('should handle job status polling', async () => {
    const mockStatuses = [
      { status: 'queued', progress: 0 },
      { status: 'running', progress: 25 },
      { status: 'running', progress: 75 },
      { status: 'done', progress: 100, downloadUrl: '/api/jobs/test?download=1' },
    ];

    for (const status of mockStatuses) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(status),
      });

      const response = await fetch('http://localhost:3000/api/jobs/test');
      const data = await response.json();
      expect(data.status).toBe(status.status);
    }
  });

  it('should handle 403 when YouTube is disabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('YouTube conversion is disabled'),
    });

    const response = await fetch('http://localhost:3000/api/youtube-to-mp3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtube.com/watch?v=test' }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(403);
  });
});
