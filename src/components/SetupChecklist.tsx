import Link from 'next/link';

interface SetupProps {
  setup: {
    memory: boolean;
    channels: string[];
    skills: string[];
    apiKeys: string[];
  };
}

export function SetupChecklist({ setup }: SetupProps) {
  const items = [
    {
      label: 'Memory System',
      done: setup.memory,
      detail: setup.memory ? 'Configured' : 'Not configured',
      link: '/memory',
    },
    {
      label: 'Channels Connected',
      done: setup.channels.length > 0,
      detail: setup.channels.length > 0 ? setup.channels.join(', ') : 'None',
      link: '/channels',
    },
    {
      label: 'Skills Installed',
      done: setup.skills.length > 0,
      detail: `${setup.skills.length} skills`,
      link: '/skills',
    },
    {
      label: 'API Keys',
      done: setup.apiKeys.length > 0,
      detail: setup.apiKeys.length > 0 ? setup.apiKeys.join(', ') : 'None configured',
      link: null,
    },
  ];

  const completedCount = items.filter(i => i.done).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold">Setup Progress</h2>
        <span className="text-xs sm:text-sm text-zinc-400">
          {completedCount}/{items.length} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-800 rounded-full mb-4 sm:mb-6 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.done ? 'bg-green-500/20' : 'bg-zinc-700'
            }`}>
              {item.done ? (
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-zinc-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm sm:text-base truncate">{item.label}</div>
              <div className="text-xs sm:text-sm text-zinc-400 truncate">{item.detail}</div>
            </div>
            <div className="flex-shrink-0">
              {item.link ? (
                <Link 
                  href={item.link}
                  className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-lg transition whitespace-nowrap ${
                    item.done 
                      ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                  }`}
                >
                  {item.done ? 'Browse' : 'Configure'}
                </Link>
              ) : !item.done && (
                <button className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition whitespace-nowrap">
                  Configure
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
