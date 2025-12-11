// Shared types matching backend types

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface Job {
  id: string;
  status: JobStatus;
  progress?: number;
  inputPath: string;
  outputPath?: string;
  error?: string;
  target: 'mp4' | 'mp3';
  bitrate?: number;
  originalName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface YouTubeConversionRequest {
  url: string;
  bitrate?: number; // 64-320 kbps, default 192
}

export interface YouTubeConversionResponse {
  jobId: string;
  title?: string;
  duration?: string;
  thumbnail?: string;
}

export interface JobStatusResponse {
  status: JobStatus;
  progress?: number;
  downloadUrl?: string; // e.g., "/api/jobs/abc123?download=1"
  error?: string;
}

// Extension-specific types
export interface ConversionState {
  jobId: string;
  videoId: string;
  title?: string;
  thumbnail?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
}

export interface HistoryItem {
  jobId: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  downloadedAt: number;
}

export interface ExtensionSettings {
  backendUrl: string;
  bitrate: number;
  autoDownload: boolean;
}

// Message types for communication between extension components
export type MessageAction = 
  | 'convert'
  | 'conversionComplete'
  | 'conversionProgress'
  | 'conversionError'
  | 'getActiveJobs'
  | 'cancelJob';

export interface ConvertMessage {
  action: 'convert';
  videoId: string;
  url: string;
}

export interface ConversionCompleteMessage {
  action: 'conversionComplete';
  success: boolean;
  jobId?: string;
  title?: string;
  error?: string;
}

export interface ConversionProgressMessage {
  action: 'conversionProgress';
  jobId: string;
  progress: number;
  status: JobStatus;
}

export interface ConversionErrorMessage {
  action: 'conversionError';
  jobId?: string;
  error: string;
}

export type ExtensionMessage = 
  | ConvertMessage 
  | ConversionCompleteMessage 
  | ConversionProgressMessage
  | ConversionErrorMessage;
