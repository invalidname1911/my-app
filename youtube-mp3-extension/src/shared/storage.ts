// Chrome storage wrapper for extension data

import type { ConversionState, HistoryItem, ExtensionSettings } from './types';
import { DEFAULT_API_BASE_URL, DEFAULT_BITRATE } from './config';

const STORAGE_KEYS = {
  ACTIVE_JOBS: 'activeJobs',
  HISTORY: 'history',
  SETTINGS: 'settings',
} as const;

const DEFAULT_SETTINGS: ExtensionSettings = {
  backendUrl: DEFAULT_API_BASE_URL,
  bitrate: DEFAULT_BITRATE,
  autoDownload: true,
};

// Active Jobs
export async function getActiveJobs(): Promise<ConversionState[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_JOBS);
  return result[STORAGE_KEYS.ACTIVE_JOBS] || [];
}

export async function setActiveJobs(jobs: ConversionState[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_JOBS]: jobs });
}

export async function addActiveJob(job: ConversionState): Promise<void> {
  const jobs = await getActiveJobs();
  jobs.push(job);
  await setActiveJobs(jobs);
}

export async function updateActiveJob(jobId: string, updates: Partial<ConversionState>): Promise<void> {
  const jobs = await getActiveJobs();
  const index = jobs.findIndex(j => j.jobId === jobId);
  if (index !== -1) {
    jobs[index] = { ...jobs[index], ...updates };
    await setActiveJobs(jobs);
  }
}

export async function removeActiveJob(jobId: string): Promise<void> {
  const jobs = await getActiveJobs();
  await setActiveJobs(jobs.filter(j => j.jobId !== jobId));
}

// History
export async function getHistory(): Promise<HistoryItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
  return result[STORAGE_KEYS.HISTORY] || [];
}

export async function addToHistory(item: HistoryItem): Promise<void> {
  const history = await getHistory();
  // Keep last 50 items
  const updated = [item, ...history].slice(0, 50);
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
}

// Settings
export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

export async function updateSettings(updates: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ 
    [STORAGE_KEYS.SETTINGS]: { ...current, ...updates } 
  });
}
