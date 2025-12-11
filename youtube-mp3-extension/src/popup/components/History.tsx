import type { HistoryItem } from '@/shared/types';
import { clearHistory } from '@/shared/storage';
import { getDownloadUrl } from '@/shared/api';

interface HistoryProps {
  items: HistoryItem[];
  onRefresh: () => void;
}

export function History({ items, onRefresh }: HistoryProps) {
  async function handleClear() {
    if (confirm('Clear all download history?')) {
      await clearHistory();
      onRefresh();
    }
  }

  async function handleRedownload(item: HistoryItem) {
    const url = await getDownloadUrl(item.jobId);
    chrome.downloads.download({
      url,
      filename: `${item.title}.mp3`,
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
        <svg className="w-12 h-12 mb-2 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
        </svg>
        <p className="text-sm">No download history</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={handleClear}
          className="text-xs text-gray-500 hover:text-red-600 transition-colors"
        >
          Clear history
        </button>
      </div>
      
      {items.map((item) => (
        <HistoryCard 
          key={`${item.jobId}-${item.downloadedAt}`} 
          item={item} 
          onRedownload={() => handleRedownload(item)}
        />
      ))}
    </div>
  );
}

function HistoryCard({ 
  item, 
  onRedownload 
}: { 
  item: HistoryItem; 
  onRedownload: () => void;
}) {
  const date = new Date(item.downloadedAt);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex gap-3">
        {item.thumbnail && (
          <img 
            src={item.thumbnail} 
            alt="" 
            className="w-16 h-12 object-cover rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {item.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{timeAgo}</p>
        </div>
        <button
          onClick={onRedownload}
          className="self-center p-2 text-gray-400 hover:text-red-600 transition-colors"
          title="Download again"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}
