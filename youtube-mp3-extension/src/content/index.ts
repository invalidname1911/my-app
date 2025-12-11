// Content script - Injected into YouTube pages to add MP3 download button

import type { 
  ConversionProgressMessage, 
  ConversionCompleteMessage,
  ExtensionMessage 
} from '@/shared/types';

class YouTubeMP3Button {
  private button: HTMLButtonElement | null = null;
  private currentVideoId: string | null = null;
  private observer: MutationObserver | null = null;
  private isConverting = false;

  init() {
    // YouTube uses SPA navigation, watch for URL changes
    this.observeNavigation();
    this.injectButton();
    this.listenForMessages();
  }

  private observeNavigation() {
    // Watch for YouTube SPA navigation
    let lastUrl = location.href;
    
    this.observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.handleNavigation();
      }
    });
    
    this.observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // Also listen for popstate events
    window.addEventListener('popstate', () => this.handleNavigation());
    
    // Listen for YouTube's custom navigation events
    window.addEventListener('yt-navigate-finish', () => this.handleNavigation());
  }

  private handleNavigation() {
    const videoId = this.getVideoId();
    
    if (videoId && videoId !== this.currentVideoId) {
      this.currentVideoId = videoId;
      this.isConverting = false;
      this.removeButton();
      // Wait for YouTube to render the actions container
      setTimeout(() => this.injectButton(), 500);
    } else if (!videoId) {
      this.removeButton();
      this.currentVideoId = null;
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

  private injectButton() {
    if (!this.getVideoId() || this.button) return;

    // Try multiple selectors for YouTube's action buttons container
    const selectors = [
      '#top-level-buttons-computed',
      '#actions #menu',
      '#actions',
      'ytd-menu-renderer.ytd-watch-metadata',
    ];

    let actionsContainer: Element | null = null;
    for (const selector of selectors) {
      actionsContainer = document.querySelector(selector);
      if (actionsContainer) break;
    }

    if (!actionsContainer) {
      // Retry after a short delay if container not found
      setTimeout(() => this.injectButton(), 1000);
      return;
    }

    this.button = document.createElement('button');
    this.button.className = 'yt-mp3-download-btn';
    this.button.innerHTML = this.getButtonContent('idle');
    this.button.title = 'Download as MP3';
    this.button.onclick = () => this.handleDownload();

    // Insert at the beginning of the actions container
    actionsContainer.insertBefore(this.button, actionsContainer.firstChild);
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new YouTubeMP3Button().init());
} else {
  new YouTubeMP3Button().init();
}
