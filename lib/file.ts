import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';

const TEMP_DIR = join(process.cwd(), 'temp');

/**
 * Ensures the temporary directory exists
 * @returns Promise resolving to the absolute temp directory path
 */
export async function ensureTempDir(): Promise<string> {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
}

/**
 * Creates a unique temp file path for an uploaded file
 * @param originalName Original filename from upload
 * @returns Promise resolving to file paths and ID
 */
export async function createTempPath(originalName: string): Promise<{
  fileId: string;
  absPath: string;
  relPath: string;
}> {
  await ensureTempDir();
  
  const fileId = randomBytes(16).toString('hex');
  const extension = extname(originalName);
  const filename = `${fileId}${extension}`;
  const absPath = join(TEMP_DIR, filename);
  const relPath = join('temp', filename);
  return {
    fileId,
    absPath,
    relPath
  };
}

/**
 * Resolves a fileId back to its absolute path
 * @param fileId The file ID to resolve
 * @returns Absolute path if file exists, null otherwise
 */
export function resolveTempPath(fileId: string): string | null {
  try {
    // Find files in temp dir that start with fileId
    const files = require('fs').readdirSync(TEMP_DIR);
    const matchingFile = files.find((file: string) => file.startsWith(fileId));
    
    if (matchingFile) {
      return join(TEMP_DIR, matchingFile);
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Cleans up old files in the temp directory
 * @param maxAgeHours Maximum age in hours before deletion
 * @returns Promise resolving to number of files deleted
 */
export async function cleanupOldFiles(maxAgeHours: number = 24): Promise<number> {
  try {
    await ensureTempDir();
    const files = await fs.readdir(TEMP_DIR);
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = join(TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      } catch {
        // Ignore errors for individual files
      }
    }
    
    return deletedCount;
  } catch {
    return 0;
  }
}

/**
 * Creates a temp path for output files (conversions)
 * @param fileId Original file ID
 * @param targetFormat Target format (mp4, mp3, etc.)
 * @returns Output file path
 */
export async function createOutputPath(fileId: string, targetFormat: string): Promise<string> {
  await ensureTempDir();
  const outputFilename = `${fileId}_output.${targetFormat}`;
  return join(TEMP_DIR, outputFilename);
}
