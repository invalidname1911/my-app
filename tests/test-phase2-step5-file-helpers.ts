/**
 * Test Phase 2 Step 5: Integration with file helpers (createTempPath, resolveTempPath)
 * 
 * This test ensur    test('should maintain consistent file paths throughout YouTube download process', async () => {
      // Step 1: Create temp path for YouTube download
      const downloadInfo = await createTempPath('youtube-download.webm');
      
      // Simulate file creation (like YouTube download)
      await fs.writeFile(downloadInfo.absPath, 'test content');
      
      // Step 2: Resolve the same path
      const resolvedPath = resolveTempPath(downloadInfo.fileId);
      
      expect(resolvedPath).toBe(downloadInfo.absPath);
      
      // Step 3: Create output path for conversion
      const outputPath = await createOutputPath('job-' + downloadInfo.fileId, 'mp3');
      
      expect(outputPath).toContain('temp');
      expect(outputPath).toMatch(/_output\.mp3$/);
      
      // Cleanup
      await fs.unlink(downloadInfo.absPath);
    }); downloads properly integrate with the file helper
 * functions and create appropriate temporary file paths.
 */

import { createTempPath, resolveTempPath, ensureTempDir, createOutputPath } from '../lib/file';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

describe('Phase 2 Step 5: File Helpers Integration', () => {
  const TEMP_DIR = join(process.cwd(), 'temp');
  
  beforeAll(async () => {
    // Ensure temp directory exists
    await ensureTempDir();
  });
  
  afterEach(async () => {
    // Clean up any test files
    try {
      const files = await fs.readdir(TEMP_DIR);
      for (const file of files) {
        if (file.includes('test') || file.includes('youtube')) {
          await fs.unlink(join(TEMP_DIR, file)).catch(() => {});
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createTempPath for YouTube downloads', () => {
    test('should create appropriate paths for YouTube download files', async () => {
      const result = await createTempPath('youtube-download.webm');
      
      expect(result.fileId).toBeDefined();
      expect(result.fileId).toMatch(/^[a-f0-9]{32}$/); // 32 hex chars
      expect(result.absPath).toContain(result.fileId);
      expect(result.absPath).toMatch(/\.webm$/);
      expect(result.relPath).toContain('temp');
      expect(result.relPath).toContain(result.fileId);
    });

    test('should handle different YouTube file extensions', async () => {
      const extensions = ['.webm', '.mp4', '.m4a'];
      
      for (const ext of extensions) {
        const result = await createTempPath(`youtube-download${ext}`);
        expect(result.absPath).toMatch(new RegExp(`\\${ext}$`));
      }
    });

    test('should create unique file IDs for multiple downloads', async () => {
      const results = await Promise.all([
        createTempPath('youtube-download.webm'),
        createTempPath('youtube-download.webm'),
        createTempPath('youtube-download.webm')
      ]);
      
      const fileIds = results.map(r => r.fileId);
      const uniqueIds = new Set(fileIds);
      
      expect(uniqueIds.size).toBe(3); // All should be unique
    });
  });

  describe('resolveTempPath for YouTube files', () => {
    test('should resolve existing YouTube download files', async () => {
      // Create a test file
      const tempInfo = await createTempPath('youtube-test.webm');
      await fs.writeFile(tempInfo.absPath, 'test content');
      
      const resolvedPath = resolveTempPath(tempInfo.fileId);
      
      expect(resolvedPath).toBe(tempInfo.absPath);
      
      // Cleanup
      await fs.unlink(tempInfo.absPath);
    });

    test('should return null for non-existent file IDs', () => {
      const fakeId = randomBytes(16).toString('hex');
      const result = resolveTempPath(fakeId);
      
      expect(result).toBeNull();
    });

    test('should handle malformed file IDs gracefully', () => {
      const result = resolveTempPath('invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('createOutputPath for YouTube conversions', () => {
    test('should create appropriate output paths for MP3 conversion', async () => {
      const jobId = randomBytes(16).toString('hex');
      const outputPath = await createOutputPath(jobId, 'mp3');
      
      expect(outputPath).toContain(jobId);
      expect(outputPath).toMatch(/_output\.mp3$/);
      expect(outputPath).toContain('temp');
    });

    test('should create appropriate output paths for MP4 conversion', async () => {
      const jobId = randomBytes(16).toString('hex');
      const outputPath = await createOutputPath(jobId, 'mp4');
      
      expect(outputPath).toContain(jobId);
      expect(outputPath).toMatch(/_output\.mp4$/);
      expect(outputPath).toContain('temp');
    });
  });

  describe('File path consistency', () => {
    test('should maintain consistent file paths throughout YouTube download process', async () => {
      // Step 1: Create temp path for YouTube download
      const downloadInfo = await createTempPath('youtube-download.webm');
      
      // Simulate file creation (like YouTube download)
      await fs.writeFile(downloadInfo.absPath, 'test content');

      // Step 2: Resolve the same path
      const resolvedPath = resolveTempPath(downloadInfo.fileId);
      
      expect(resolvedPath).toBe(downloadInfo.absPath);
      
      // Step 3: Create output path for conversion
      const outputPath = await createOutputPath('job-' + downloadInfo.fileId, 'mp3');
      
      expect(outputPath).toContain('temp');
      expect(outputPath).toMatch(/\.mp3$/);
    });

    test('should handle file operations in correct sequence', async () => {
      const downloadInfo = await createTempPath('youtube-sequence-test.webm');
      
      // Simulate file creation (like YouTube download)
      await fs.writeFile(downloadInfo.absPath, 'mock youtube content');
      
      // Verify file exists and can be resolved
      const resolvedPath = resolveTempPath(downloadInfo.fileId);
      expect(resolvedPath).toBe(downloadInfo.absPath);
      
      const fileExists = await fs.access(downloadInfo.absPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      // Create output path for conversion
      const outputPath = await createOutputPath('conv-' + downloadInfo.fileId, 'mp3');
      
      // Simulate conversion output
      await fs.writeFile(outputPath, 'mock mp3 content');
      
      // Verify both files exist
      const inputExists = await fs.access(downloadInfo.absPath).then(() => true).catch(() => false);
      const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);
      
      expect(inputExists).toBe(true);
      expect(outputExists).toBe(true);
      
      // Cleanup
      await fs.unlink(downloadInfo.absPath);
      await fs.unlink(outputPath);
    });
  });

  describe('Error handling in file operations', () => {
    test('should handle temp directory creation gracefully', async () => {
      // This should not throw
      await expect(ensureTempDir()).resolves.toBeDefined();
    });

    test('should handle file path resolution for deleted files', async () => {
      const tempInfo = await createTempPath('youtube-deleted-test.webm');
      
      // File doesn't exist yet, so resolve should return null
      const result = resolveTempPath(tempInfo.fileId);
      expect(result).toBeNull();
    });

    test('should create valid paths even with unusual filenames', async () => {
      const unusualNames = [
        'youtube-test with spaces.webm',
        'youtube-test-with-unicode-café.webm',
        'youtube-test.with.dots.webm'
      ];
      
      for (const name of unusualNames) {
        const result = await createTempPath(name);
        expect(result.fileId).toBeDefined();
        expect(result.absPath).toContain(result.fileId);
      }
    });
  });
});