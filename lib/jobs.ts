import { promises as fs } from 'fs';
import { createReadStream, stat } from 'fs';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { cleanupOldFiles } from './file';

const statAsync = promisify(stat);

/**
 * Possible job statuses
 */
export type JobStatus = 'queued' | 'running' | 'done' | 'error';

/**
 * Job interface defining the structure of conversion jobs
 */
export interface Job {
  id: string;
  status: JobStatus;
  progress?: number;
  inputPath: string;
  outputPath?: string;
  error?: string;
  target: 'mp4' | 'mp3';
  preset?: 'web' | 'mobile';
  bitrate?: number; // For MP3 conversion
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory job store
 * Note: This is ephemeral and will be lost on server restart
 */
const jobs = new Map<string, Job>();

/**
 * Get a job by ID
 * @param id Job ID
 * @returns Job object or undefined if not found
 */
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Set/create a job in the store
 * @param job Job object to store
 */
export function setJob(job: Job): void {
  job.updatedAt = new Date();
  jobs.set(job.id, job);
}

/**
 * Update a job with partial data
 * @param id Job ID
 * @param patch Partial job data to update
 */
export function updateJob(id: string, patch: Partial<Job>): void {
  const existingJob = jobs.get(id);
  if (existingJob) {
    const updatedJob = {
      ...existingJob,
      ...patch,
      updatedAt: new Date()
    };
    jobs.set(id, updatedJob);
  }
}

/**
 * Create a new job
 * @param inputPath Path to input file
 * @param target Target format (mp4 or mp3)
 * @param preset Optional preset for video conversion
 * @param bitrate Optional bitrate for MP3 conversion
 * @returns New job object
 */
export function createJob(
  inputPath: string,
  target: 'mp4' | 'mp3',
  preset?: 'web' | 'mobile',
  bitrate?: number
): Job {
  const jobId = randomBytes(16).toString('hex');
  const now = new Date();

  const job: Job = {
    id: jobId,
    status: 'queued',
    inputPath,
    target,
    preset,
    bitrate,
    createdAt: now,
    updatedAt: now
  };

  setJob(job);
  return job;
}

/**
 * Stream output file as HTTP response
 * @param id Job ID
 * @returns Promise resolving to Response object
 */
export async function streamOutput(id: string): Promise<Response> {
  const job = getJob(id);
  
  if (!job) {
    return new Response('Job not found', { status: 404 });
  }
  
  if (job.status !== 'done' || !job.outputPath) {
    return new Response('File not ready', { status: 400 });
  }
  
  try {
    // Check if file exists and get stats
    const stats = await statAsync(job.outputPath);
    
    // Create readable stream
    const stream = createReadStream(job.outputPath);
    
    // Determine content type based on target format
    const contentType = job.target === 'mp4' 
      ? 'video/mp4' 
      : 'audio/mpeg';
    
    // Generate filename for download
    const extension = job.target;
    const filename = `converted_${job.id}.${extension}`;
    
    // Create response with appropriate headers
    const response = new Response(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });
    
    return response;
  } catch (error) {
    return new Response('File not found', { status: 404 });
  }
}

/**
 * Get all jobs (for debugging/monitoring)
 * @returns Array of all jobs
 */
export function getAllJobs(): Job[] {
  return Array.from(jobs.values());
}

/**
 * Remove completed jobs older than specified hours
 * @param maxAgeHours Maximum age in hours
 * @returns Number of jobs removed
 */
export function cleanupOldJobs(maxAgeHours: number = 24): number {
  const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
  let removedCount = 0;
  
  for (const [id, job] of jobs.entries()) {
    if (job.status === 'done' && job.updatedAt < cutoffTime) {
      jobs.delete(id);
      removedCount++;
    }
  }
  
  return removedCount;
}

/**
 * Clear all jobs (for testing purposes)
 */
export function clearAllJobs(): void {
  jobs.clear();
}

/**
 * Get job statistics
 * @returns Object with job counts by status
 */
export function getJobStats() {
  const stats = {
    total: jobs.size,
    queued: 0,
    running: 0,
    done: 0,
    error: 0
  };
  
  for (const job of jobs.values()) {
    stats[job.status]++;
  }
  
  return stats;
}

// Cleanup scheduler for production
if (process.env.NODE_ENV === 'production') {
  const cleanup = async () => {
    console.log('Running cleanup task...');
    
    const cleanedJobs = cleanupOldJobs(24);
    if (cleanedJobs > 0) {
      console.log(`Cleaned up ${cleanedJobs} old jobs.`);
    }
    
    const cleanedFiles = await cleanupOldFiles(24);
    if (cleanedFiles > 0) {
      console.log(`Cleaned up ${cleanedFiles} old files.`);
    }
    
    console.log('Cleanup task finished.');
  };

  // Run cleanup every hour
  setInterval(cleanup, 60 * 60 * 1000);

  // Initial cleanup on module load after a short delay
  setTimeout(cleanup, 5000);
  
  console.log('Production cleanup scheduler initialized.');
}
