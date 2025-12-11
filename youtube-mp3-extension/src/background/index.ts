// Background service worker - handles API communication and download management

import type { 
  ConversionState, 
  ConvertMessage, 
  JobStatus,
  ExtensionMessage 
} from '@/shared/types';
import { startConversion, getJobStatus, getDownloadUrl, sanitizeFilename } from '@/shared/api';
import { 
  addActiveJob, 
  updateActiveJob, 
  removeActiveJob, 
  addToHistory,
  getSettings 
} from '@/shared/storage';
import { POLL_INTERVAL, MAX_POLL_ATTEMPTS } from '@/shared/config';

// Track active polling intervals
const pollingIntervals = new Map<string, number>();

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.action === 'convert') {
    handleConversion(message as ConvertMessage, sender.tab?.id);
    sendResponse({ received: true });
  }
  return true; // Keep message channel open for async response
});

async function handleConversion(message: ConvertMessage, tabId?: number) {
  const { videoId, url } = message;
  
  try {
    // 1. Start conversion job
    const response = await startConversion(url);
    const { jobId, title, thumbnail } = response;
    
    // 2. Create initial job state
    const jobState: ConversionState = {
      jobId,
      videoId,
      title,
      thumbnail,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
    };
    
    await addActiveJob(jobState);
    
    // Notify content script that conversion started
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'conversionProgress',
        jobId,
        progress: 0,
        status: 'queued',
      });
    }
    
    // 3. Start polling for job status
    await pollJobStatus(jobId, videoId, title, thumbnail, tabId);
    
  } catch (error: any) {
    console.error('Conversion failed:', error);
    
    // Notify content script of error
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'conversionComplete',
        success: false,
        error: error.message || 'Conversion failed',
      });
    }
  }
}

async function pollJobStatus(
  jobId: string, 
  videoId: string,
  title?: string,
  thumbnail?: string,
  tabId?: number
): Promise<void> {
  let attempts = 0;
  
  const poll = async () => {
    attempts++;
    
    if (attempts > MAX_POLL_ATTEMPTS) {
      await handleJobError(jobId, 'Conversion timeout - please try again', tabId);
      return;
    }
    
    try {
      const status = await getJobStatus(jobId);
      
      // Update stored job state
      await updateActiveJob(jobId, {
        status: status.status,
        progress: status.progress || 0,
        error: status.error,
      });
      
      // Notify content script of progress
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          action: 'conversionProgress',
          jobId,
          progress: status.progress || 0,
          status: status.status,
        });
      }
      
      if (status.status === 'done') {
        await handleJobComplete(jobId, videoId, title, thumbnail, tabId);
        return;
      }
      
      if (status.status === 'error') {
        await handleJobError(jobId, status.error || 'Conversion failed', tabId);
        return;
      }
      
      // Continue polling
      const intervalId = window.setTimeout(poll, POLL_INTERVAL);
      pollingIntervals.set(jobId, intervalId);
      
    } catch (error: any) {
      console.error('Polling error:', error);
      await handleJobError(jobId, error.message || 'Failed to check status', tabId);
    }
  };
  
  // Start polling
  poll();
}

async function handleJobComplete(
  jobId: string,
  videoId: string,
  title?: string,
  thumbnail?: string,
  tabId?: number
): Promise<void> {
  // Stop polling
  const intervalId = pollingIntervals.get(jobId);
  if (intervalId) {
    clearTimeout(intervalId);
    pollingIntervals.delete(jobId);
  }
  
  // Remove from active jobs
  await removeActiveJob(jobId);
  
  // Add to history
  await addToHistory({
    jobId,
    videoId,
    title: title || videoId,
    thumbnail,
    downloadedAt: Date.now(),
  });
  
  // Get settings to check if auto-download is enabled
  const settings = await getSettings();
  
  if (settings.autoDownload) {
    // Trigger download
    const downloadUrl = await getDownloadUrl(jobId);
    const filename = sanitizeFilename(title || videoId) + '.mp3';
    
    chrome.downloads.download({
      url: downloadUrl,
      filename,
    });
  }
  
  // Notify content script
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: 'conversionComplete',
      success: true,
      jobId,
      title,
    });
  }
}

async function handleJobError(
  jobId: string,
  error: string,
  tabId?: number
): Promise<void> {
  // Stop polling
  const intervalId = pollingIntervals.get(jobId);
  if (intervalId) {
    clearTimeout(intervalId);
    pollingIntervals.delete(jobId);
  }
  
  // Update job state with error
  await updateActiveJob(jobId, {
    status: 'error',
    error,
  });
  
  // Notify content script
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: 'conversionComplete',
      success: false,
      jobId,
      error,
    });
  }
}

// Clean up on extension unload
self.addEventListener('unload', () => {
  pollingIntervals.forEach((intervalId) => clearTimeout(intervalId));
  pollingIntervals.clear();
});

console.log('YouTube to MP3 background service worker loaded');
