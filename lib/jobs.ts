import { createReadStream, stat, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { join } from 'path';
import os from 'os';
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
  originalName?: string;
  createdAt: Date;
  updatedAt: Date;
}

type PersistedJob = Omit<Job, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

const JOBS_DIR = join(os.tmpdir(), 'ffmpeg-web-temp', 'jobs');
const JOB_FILE_EXTENSION = '.json';
const JOB_STORE_GLOBAL_KEY = '__ffmpeg_web_job_store__';

type JobStoreState = {
  map: Map<string, Job>;
  initialized: boolean;
};

type GlobalWithJobStore = typeof globalThis & {
  __ffmpeg_web_job_store__?: JobStoreState;
};

const globalForJobs = globalThis as GlobalWithJobStore;

if (!globalForJobs[JOB_STORE_GLOBAL_KEY]) {
  globalForJobs[JOB_STORE_GLOBAL_KEY] = {
    map: new Map<string, Job>(),
    initialized: false
  };
}

const jobStoreState = globalForJobs[JOB_STORE_GLOBAL_KEY]!;

if (!jobStoreState.initialized) {
  loadPersistedJobs(jobStoreState.map);
  jobStoreState.initialized = true;
}

const jobs = jobStoreState.map;

function ensureJobsDirSync(): void {
  if (!existsSync(JOBS_DIR)) {
    mkdirSync(JOBS_DIR, { recursive: true });
  }
}

function getJobFilePath(id: string): string {
  return join(JOBS_DIR, `${id}${JOB_FILE_EXTENSION}`);
}

function serializeJob(job: Job): PersistedJob {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

function hydrateJob(data: PersistedJob): Job {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt)
  };
}

function loadPersistedJobs(store: Map<string, Job>): void {
  try {
    if (!existsSync(JOBS_DIR)) {
      return;
    }

    const files = readdirSync(JOBS_DIR);
    for (const file of files) {
      if (!file.endsWith(JOB_FILE_EXTENSION)) {
        continue;
      }

      const filePath = join(JOBS_DIR, file);
      try {
        const raw = readFileSync(filePath, 'utf8');
        const persisted = JSON.parse(raw) as PersistedJob;
        const job = hydrateJob(persisted);
        store.set(job.id, job);
      } catch (error) {
        console.warn(`Failed to load job metadata from ${filePath}:`, error);
      }
    }
  } catch (error) {
    // Directory may not exist yet or be inaccessible; ignore
  }
}

function persistJob(job: Job): void {
  try {
    ensureJobsDirSync();
    const filePath = getJobFilePath(job.id);
    writeFileSync(filePath, JSON.stringify(serializeJob(job)));
  } catch (error) {
    console.error(`Failed to persist job ${job.id}:`, error);
  }
}

function deletePersistedJob(id: string): void {
  try {
    const filePath = getJobFilePath(id);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`Failed to delete persisted job ${id}:`, error);
  }
}

/**
 * Get a job by ID
 * @param id Job ID
 * @returns Job object or undefined if not found
 */
export function getJob(id: string): Job | undefined {
  const existingJob = jobs.get(id);
  if (existingJob) {
    return existingJob;
  }

  try {
    const raw = readFileSync(getJobFilePath(id), 'utf8');
    const persisted = JSON.parse(raw) as PersistedJob;
    const job = hydrateJob(persisted);
    jobs.set(id, job);
    return job;
  } catch {
    return undefined;
  }
}

/**
 * Set/create a job in the store
 * @param job Job object to store
 */
export function setJob(job: Job): void {
  job.updatedAt = new Date();
  jobs.set(job.id, job);
  persistJob(job);
}

/**
 * Update a job with partial data
 * @param id Job ID
 * @param patch Partial job data to update
 */
export function updateJob(id: string, patch: Partial<Job>): void {
  const existingJob = getJob(id);
  if (existingJob) {
    const updatedJob = {
      ...existingJob,
      ...patch,
      updatedAt: new Date()
    };
    jobs.set(id, updatedJob);
    persistJob(updatedJob);
  }
}

/**
 * Create a new job
 * @param inputPath Path to input file
 * @param target Target format (mp4 or mp3)
 * @param preset Optional preset for video conversion
 * @param bitrate Optional bitrate for MP3 conversion
 * @param originalName Optional original filename
 * @returns New job object
 */
export function createJob(
  inputPath: string,
  target: 'mp4' | 'mp3',
  preset?: 'web' | 'mobile',
  bitrate?: number,
  originalName?: string
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
    originalName,
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
    let filename = `converted_${job.id}.${extension}`;

    if (job.originalName) {
      // Sanitize original name to be safe for filenames
      // Remove special characters but keep spaces, dashes, underscores
      const safeName = job.originalName.replace(/[^a-zA-Z0-9 \-_]/g, '').trim();
      if (safeName) {
        filename = `${safeName}_converted.${extension}`;
      }
    }

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
      deletePersistedJob(id);
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

  try {
    if (!existsSync(JOBS_DIR)) {
      return;
    }

    const files = readdirSync(JOBS_DIR);
    for (const file of files) {
      if (!file.endsWith(JOB_FILE_EXTENSION)) {
        continue;
      }

      const filePath = join(JOBS_DIR, file);
      try {
        unlinkSync(filePath);
      } catch (error) {
        console.warn(`Failed to remove job metadata file ${filePath}:`, error);
      }
    }
  } catch {
    // Directory may not exist; nothing to clear
  }
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
