import { useState, useEffect } from 'react';
import { Queue } from './components/Queue';
import { History } from './components/History';
import { Settings } from './components/Settings';
import type { ConversionState, HistoryItem, ExtensionSettings } from '@/shared/types';
import { getActiveJobs, getHistory, getSettings } from '@/shared/storage';

type Tab = 'queue' | 'history' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [jobs, setJobs] = useState<ConversionState[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);

  useEffect(() => {
    loadData();
    
    // Refresh data periodically
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const [activeJobs, historyItems, currentSettings] = await Promise.all([
      getActiveJobs(),
      getHistory(),
      getSettings(),
    ]);
    setJobs(activeJobs);
    setHistory(historyItems);
    setSettings(currentSettings);
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'queue', label: 'Queue', count: jobs.length },
    { id: 'history', label: 'History', count: history.length },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-red-600 text-white px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <h1 className="text-lg font-semibold">YouTube to MP3</h1>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-gray-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">
        {activeTab === 'queue' && <Queue jobs={jobs} />}
        {activeTab === 'history' && <History items={history} onRefresh={loadData} />}
        {activeTab === 'settings' && settings && (
          <Settings settings={settings} onUpdate={loadData} />
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-200">
        Visit a YouTube video and click the MP3 button
      </footer>
    </div>
  );
}
