import type { ConversionState } from '@/shared/types';

interface QueueProps {
  jobs: ConversionState[];
}

export function Queue({ jobs }: QueueProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
        <svg className="w-12 h-12 mb-2 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <p className="text-sm">No active conversions</p>
        <p className="text-xs mt-1">Go to YouTube and click the MP3 button</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.jobId} job={job} />
      ))}
    </div>
  );
}

function JobCard({ job }: { job: ConversionState }) {
  const statusColors = {
    queued: 'bg-yellow-100 text-yellow-800',
    running: 'bg-blue-100 text-blue-800',
    done: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    queued: 'Queued',
    running: 'Converting',
    done: 'Complete',
    error: 'Failed',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex gap-3">
        {job.thumbnail && (
          <img 
            src={job.thumbnail} 
            alt="" 
            className="w-16 h-12 object-cover rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {job.title || job.videoId}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[job.status]}`}>
              {statusLabels[job.status]}
            </span>
            {job.status === 'running' && (
              <span className="text-xs text-gray-500">{job.progress}%</span>
            )}
          </div>
          {job.status === 'running' && (
            <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          )}
          {job.error && (
            <p className="text-xs text-red-600 mt-1 truncate">{job.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
