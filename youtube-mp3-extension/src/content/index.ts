// Content script - Injected into YouTube pages to add MP3 download button

import type { 
  ConversionProgressMessage, 
  ConversionCompleteMessage,
  ExtensionMessage 
} from '@/shared/types';

const DEBUG = false; // Set to true for debugging
const log = (...args: any[]) => DEBUG && console.log('[YT-MP3]', ...args);

// Inject CSS programmatically to ensure it's always loaded
function injectStyles() {
  if (document.getElementById('yt-mp3-styles')) return; // Already injected
  
  const style = document.createElement('style');
  style.id = 'yt-mp3-styles';
  style.textContent = `
    .yt-mp3-download-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 8px 16px !important;
      margin-right: 8px !important;
      background: linear-gradient(135deg, rgba(37, 37, 37, 0.95) 0%, rgba(23, 23, 23, 0.9) 100%) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      border-radius: 18px !important;
      font-family: 'Geist Sans', 'Roboto', 'Arial', sans-serif !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      height: 36px !important;
      white-space: nowrap !important;
      visibility: visible !important;
      opacity: 1 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2) !important;
    }
    .yt-mp3-download-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, rgba(55, 55, 55, 0.95) 0%, rgba(37, 37, 37, 0.9) 100%) !important;
      border-color: rgba(255, 255, 255, 0.25) !important;
      transform: scale(1.02) !important;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3) !important;
    }
    .yt-mp3-download-btn:disabled {
      cursor: not-allowed !important;
      opacity: 0.6 !important;
    }
    .yt-mp3-icon {
      width: 18px !important;
      height: 18px !important;
      flex-shrink: 0 !important;
    }
    .yt-mp3-spin {
      animation: yt-mp3-spin 1s linear infinite !important;
    }
    @keyframes yt-mp3-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes yt-mp3-pulse-glow {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 0 rgba(34, 197, 94, 0.4) !important;
      }
      50% {
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 0 20px 4px rgba(34, 197, 94, 0.3) !important;
      }
    }
    .yt-mp3-download-btn.yt-mp3-converting {
      background: linear-gradient(135deg, rgba(6, 95, 70, 0.95) 0%, rgba(4, 120, 87, 0.9) 100%) !important;
      border-color: rgba(34, 197, 94, 0.4) !important;
      animation: yt-mp3-pulse-glow 2s ease-in-out infinite !important;
    }
    .yt-mp3-download-btn.yt-mp3-done {
      background: linear-gradient(135deg, rgba(5, 150, 105, 0.95) 0%, rgba(16, 185, 129, 0.9) 100%) !important;
      border-color: rgba(34, 197, 94, 0.5) !important;
    }
    .yt-mp3-download-btn.yt-mp3-error {
      background: linear-gradient(135deg, rgba(153, 27, 27, 0.95) 0%, rgba(185, 28, 28, 0.9) 100%) !important;
      border-color: rgba(248, 113, 113, 0.5) !important;
    }
  `;
  document.head.appendChild(style);
  log('Styles injected');
}

class YouTubeMP3Button {
  private button: HTMLButtonElement | null = null;
  private currentVideoId: string | null = null;
  private observer: MutationObserver | null = null;
  private isConverting = false;

  init() {
    log('init() called, URL:', location.href);
    
    // Inject CSS first - this ensures styles are always available
    injectStyles();
    
    // YouTube uses SPA navigation, watch for URL changes
    this.observeNavigation();
    this.listenForMessages();
    
    // If we're already on a watch page, inject the button
    const videoId = this.getVideoId();
    log('init() videoId:', videoId);
    if (videoId) {
      this.currentVideoId = videoId;
      this.injectButtonWithRetry();
    }
  }

  private observeNavigation() {
    log('observeNavigation() setting up listeners');
    // Watch for YouTube SPA navigation
    let lastUrl = location.href;
    
    this.observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        log('MutationObserver detected URL change:', lastUrl, '->', currentUrl);
        lastUrl = currentUrl;
        this.handleNavigation();
      }
    });
    
    this.observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // Also listen for popstate events
    window.addEventListener('popstate', () => {
      log('popstate event fired');
      this.handleNavigation();
    });
    
    // Listen for YouTube's custom navigation events
    window.addEventListener('yt-navigate-finish', () => {
      log('yt-navigate-finish event fired');
      this.handleNavigation();
    });
    
    // Also listen for yt-navigate-start to prepare for navigation
    window.addEventListener('yt-navigate-start', () => {
      log('yt-navigate-start event fired');
      // Pre-emptively remove button to avoid duplicates
      this.removeButton();
    });
    
    // Handle YouTube's page data updates (for initial SPA loads)
    window.addEventListener('yt-page-data-updated', () => {
      log('yt-page-data-updated event fired');
      this.handleNavigation();
    });
  }

  private handleNavigation() {
    const videoId = this.getVideoId();
    log('handleNavigation() videoId:', videoId, 'currentVideoId:', this.currentVideoId);
    
    // Always ensure styles are injected
    injectStyles();
    
    if (videoId && videoId !== this.currentVideoId) {
      log('New video detected, will inject button');
      this.currentVideoId = videoId;
      this.isConverting = false;
      this.removeButton();
      // Use robust injection with multiple retries
      this.injectButtonWithRetry();
    } else if (!videoId) {
      log('Not on watch page, removing button');
      this.removeButton();
      this.currentVideoId = null;
    } else {
      log('Same video, no action needed');
    }
  }

  private injectButtonWithRetry(attempts = 0, maxAttempts = 20) {
    log(`injectButtonWithRetry() attempt ${attempts}/${maxAttempts}`);
    // Stop if we've exceeded max attempts or video changed
    if (attempts >= maxAttempts || !this.getVideoId()) {
      log('Stopping retry: maxAttempts reached or no videoId');
      return;
    }
    
    const injected = this.injectButton();
    if (!injected) {
      const delay = 100 + attempts * 100;
      log(`Injection failed, retrying in ${delay}ms`);
      // Retry with increasing delay (100ms, 200ms, 300ms, etc.)
      setTimeout(() => this.injectButtonWithRetry(attempts + 1, maxAttempts), delay);
    } else {
      log('Button injected successfully!');
    }
  }

  private getVideoId(): string | null {
    if (window.location.pathname !== '/watch') return null;
    return new URLSearchParams(window.location.search).get('v');
  }

  private removeButton() {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
  }

  private isElementInViewport(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    // Check if element is reasonably positioned (not way off screen)
    // YouTube video player area is typically in the top portion of the page
    return rect.top >= 0 && rect.top < window.innerHeight && rect.width > 0;
  }

  private injectButton(): boolean {
    if (!this.getVideoId()) {
      log('injectButton(): no videoId');
      return false;
    }
    if (this.button) {
      log('injectButton(): button already exists');
      return true; // Already injected
    }

    // Try multiple selectors for YouTube's action buttons container
    // Look for containers that are actually visible in the viewport
    const selectors = [
      '#top-level-buttons-computed',
      'ytd-watch-metadata #actions-inner #menu',
      'ytd-watch-metadata #actions #menu',
      '#actions-inner #menu',
      '#actions #menu',
      '#actions',
      'ytd-menu-renderer.ytd-watch-metadata',
    ];

    let actionsContainer: Element | null = null;
    let matchedSelector = '';
    
    for (const selector of selectors) {
      // Get ALL matching elements and find one that's in viewport
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (this.isElementInViewport(el)) {
          actionsContainer = el;
          matchedSelector = selector;
          break;
        }
      }
      if (actionsContainer) break;
    }

    if (!actionsContainer) {
      log('injectButton(): no visible container found. Checking what exists...');
      const allContainers = document.querySelectorAll('#top-level-buttons-computed');
      log('  #top-level-buttons-computed count:', allContainers.length);
      allContainers.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        log(`    [${i}] y: ${rect.top}, inViewport: ${this.isElementInViewport(el)}`);
      });
      return false; // Container not found yet or not in viewport
    }

    log('injectButton(): found visible container with selector:', matchedSelector);
    log('injectButton(): container rect:', actionsContainer.getBoundingClientRect());

    this.button = document.createElement('button');
    this.button.className = 'yt-mp3-download-btn';
    this.button.innerHTML = this.getButtonContent('idle');
    this.button.title = 'Download as MP3';
    this.button.onclick = () => this.handleDownload();

    // Insert at the beginning of the actions container
    actionsContainer.insertBefore(this.button, actionsContainer.firstChild);
    
    // Debug: check if button is visible after insertion
    setTimeout(() => {
      if (this.button) {
        const rect = this.button.getBoundingClientRect();
        const styles = window.getComputedStyle(this.button);
        log('Button after insertion:');
        log('  rect:', rect);
        log('  display:', styles.display);
        log('  visibility:', styles.visibility);
        log('  opacity:', styles.opacity);
        log('  width/height:', styles.width, styles.height);
        log('  styles element exists:', !!document.getElementById('yt-mp3-styles'));
      }
    }, 100);
    
    return true;
  }

  private getButtonContent(state: 'idle' | 'converting' | 'done' | 'error', progress?: number): string {
    switch (state) {
      case 'idle':
        return `
          <svg class="yt-mp3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <span>MP3</span>
        `;
      case 'converting':
        return `
          <svg class="yt-mp3-icon yt-mp3-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
          </svg>
          <span>${progress !== undefined ? `${progress}%` : 'Converting...'}</span>
        `;
      case 'done':
        return `
          <svg class="yt-mp3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span>Done!</span>
        `;
      case 'error':
        return `
          <svg class="yt-mp3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>Retry</span>
        `;
    }
  }

  private async handleDownload() {
    const videoId = this.getVideoId();
    if (!videoId || !this.button) return;

    // If there was an error, allow retry
    if (this.isConverting) return;

    this.isConverting = true;
    this.button.disabled = true;
    this.button.innerHTML = this.getButtonContent('converting');
    this.button.classList.add('yt-mp3-converting');

    // Send message to background worker
    chrome.runtime.sendMessage({
      action: 'convert',
      videoId,
      url: window.location.href,
    });
  }

  private listenForMessages() {
    chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
      if (!this.button) return;

      if (message.action === 'conversionProgress') {
        const progressMsg = message as ConversionProgressMessage;
        this.button.innerHTML = this.getButtonContent('converting', progressMsg.progress);
      }

      if (message.action === 'conversionComplete') {
        const completeMsg = message as ConversionCompleteMessage;
        
        if (completeMsg.success) {
          this.button.innerHTML = this.getButtonContent('done');
          this.button.classList.remove('yt-mp3-converting');
          this.button.classList.add('yt-mp3-done');
          
          // Reset after 3 seconds
          setTimeout(() => {
            if (this.button) {
              this.button.innerHTML = this.getButtonContent('idle');
              this.button.classList.remove('yt-mp3-done');
              this.button.disabled = false;
              this.isConverting = false;
            }
          }, 3000);
        } else {
          this.button.innerHTML = this.getButtonContent('error');
          this.button.classList.remove('yt-mp3-converting');
          this.button.classList.add('yt-mp3-error');
          this.button.disabled = false;
          this.isConverting = false;
          
          // Show error tooltip
          this.button.title = completeMsg.error || 'Conversion failed';
        }
      }
    });
  }
}

// Inject styles IMMEDIATELY when script loads - don't wait for anything
log('Content script loaded, readyState:', document.readyState);
injectStyles();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  log('Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded fired');
    injectStyles(); // Ensure styles are injected after DOM is ready
    new YouTubeMP3Button().init();
  });
} else {
  log('DOM already ready, initializing immediately');
  new YouTubeMP3Button().init();
}
