// Test setup - mock Chrome APIs

import { vi } from 'vitest';

// Mock chrome.storage.local
const mockStorage: Record<string, any> = {};

const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: mockStorage[keys] });
        }
        const result: Record<string, any> = {};
        keys.forEach(key => {
          result[key] = mockStorage[key];
        });
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, any>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
  },
  downloads: {
    download: vi.fn(),
  },
};

// @ts-ignore
globalThis.chrome = mockChrome;

export { mockChrome, mockStorage };
