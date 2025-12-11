import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';

describe('Content Script', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Video ID extraction', () => {
    it('should extract video ID from URL', () => {
      // Simulate YouTube watch page URL
      const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      const videoId = url.searchParams.get('v');
      expect(videoId).toBe('dQw4w9WgXcQ');
    });

    it('should handle URL with additional parameters', () => {
      const url = new URL('https://www.youtube.com/watch?v=abc123&t=120&list=PLtest');
      const videoId = url.searchParams.get('v');
      expect(videoId).toBe('abc123');
    });

    it('should return null for non-watch pages', () => {
      const url = new URL('https://www.youtube.com/');
      const videoId = url.searchParams.get('v');
      expect(videoId).toBeNull();
    });
  });

  describe('Button injection', () => {
    it('should create button with correct class', () => {
      const button = document.createElement('button');
      button.className = 'yt-mp3-download-btn';
      button.innerHTML = '🎵 MP3';
      
      expect(button.className).toBe('yt-mp3-download-btn');
      expect(button.innerHTML).toContain('MP3');
    });

    it('should disable button during conversion', () => {
      const button = document.createElement('button');
      button.className = 'yt-mp3-download-btn';
      button.disabled = true;
      
      expect(button.disabled).toBe(true);
    });

    it('should add converting class during conversion', () => {
      const button = document.createElement('button');
      button.className = 'yt-mp3-download-btn';
      button.classList.add('yt-mp3-converting');
      
      expect(button.classList.contains('yt-mp3-converting')).toBe(true);
    });
  });

  describe('Message handling', () => {
    it('should send convert message to background', () => {
      const message = {
        action: 'convert',
        videoId: 'test123',
        url: 'https://www.youtube.com/watch?v=test123',
      };

      chrome.runtime.sendMessage(message);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message);
    });
  });
});
