'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function SetupBanner() {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.needsSetup) {
          setNeedsSetup(true);
        }
      })
      .catch(() => {
        // Silently fail - don't show banner if we can't determine status
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading || !needsSetup) {
    return null;
  }

  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <div className="text-sm font-medium text-orange-300 mb-1">
            Agent workspace not configured
          </div>
          <div className="text-xs text-orange-400/80">
            Run setup to get started and configure your agent directories.
          </div>
        </div>
        <Link
          href="/setup"
          className="flex-shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black font-medium text-sm rounded-lg transition-colors"
        >
          Run Setup
        </Link>
      </div>
    </div>
  );
}
