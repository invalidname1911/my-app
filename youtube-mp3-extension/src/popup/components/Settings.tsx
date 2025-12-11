import { useState } from 'react';
import type { ExtensionSettings } from '@/shared/types';
import { updateSettings } from '@/shared/storage';
import { BITRATE_OPTIONS, DEFAULT_API_BASE_URL } from '@/shared/config';

interface SettingsProps {
  settings: ExtensionSettings;
  onUpdate: () => void;
}

export function Settings({ settings, onUpdate }: SettingsProps) {
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl);
  const [bitrate, setBitrate] = useState(settings.bitrate);
  const [autoDownload, setAutoDownload] = useState(settings.autoDownload);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await updateSettings({
      backendUrl: backendUrl.trim() || DEFAULT_API_BASE_URL,
      bitrate,
      autoDownload,
    });
    setSaved(true);
    onUpdate();
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setBackendUrl(DEFAULT_API_BASE_URL);
    setBitrate(192);
    setAutoDownload(true);
  }

  return (
    <div className="space-y-4">
      {/* Backend URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Backend URL
        </label>
        <input
          type="url"
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          placeholder={DEFAULT_API_BASE_URL}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Your Railway deployment URL
        </p>
      </div>

      {/* Bitrate */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Audio Quality
        </label>
        <select
          value={bitrate}
          onChange={(e) => setBitrate(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          {BITRATE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Auto Download */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Auto-download
          </label>
          <p className="text-xs text-gray-500">
            Automatically download when conversion completes
          </p>
        </div>
        <button
          onClick={() => setAutoDownload(!autoDownload)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            autoDownload ? 'bg-red-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              autoDownload ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Info */}
      <div className="pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">
          YouTube to MP3 Extension v1.0.0
        </p>
      </div>
    </div>
  );
}
