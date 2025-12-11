// API client for backend communication

import type { 
  YouTubeConversionRequest, 
  YouTubeConversionResponse, 
  JobStatusResponse 
} from './types';
import { getSettings } from './storage';

async function getApiBaseUrl(): Promise<string> {
  const settings = await getSettings();
  return settings.backendUrl;
}

export async function startConversion(
  url: string, 
  bitrate?: number
): Promise<YouTubeConversionResponse> {
  const apiBase = await getApiBaseUrl();
  const settings = await getSettings();
  
  const request: YouTubeConversionRequest = {
    url,
    bitrate: bitrate ?? settings.bitrate,
  };

  const response = await fetch(`${apiBase}/api/youtube-to-mp3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403) {
      throw new Error('YouTube conversion is disabled on the server');
    }
    throw new Error(`Conversion failed: ${errorText || response.statusText}`);
  }

  return response.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const apiBase = await getApiBaseUrl();
  
  const response = await fetch(`${apiBase}/api/jobs/${jobId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.statusText}`);
  }

  return response.json();
}

export async function getDownloadUrl(jobId: string): Promise<string> {
  const apiBase = await getApiBaseUrl();
  return `${apiBase}/api/jobs/${jobId}?download=1`;
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}
