'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ErrorEntry {
  sessionId: string;
  sessionKey: string;
  timestamp: string;
  tool: string;
  error: string;
  errorType: string;
  severity: 'error' | 'warning';
  canSelfHeal: boolean;
  selfHealAction?: string;
}

interface ErrorsData {
  total: number;
  healable: number;
  summary: Record<string, number>;
  errors: ErrorEntry[];
}

export default function ErrorsPage() {
  const router = useRouter();
  const [data, setData] = useState<ErrorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [healing, setHealing] = useState(false);
  const [hours, setHours] = useState(24);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [showHealModal, setShowHealModal] = useState(false);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/errors?hours=${hours}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch errors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [hours]);

  const healAll = async () => {
    setHealing(true);
    setShowHealModal(false);
    try {
      const res = await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heal_all' }),
      });
      const result = await res.json();
      console.log('Heal results:', result);
      await fetchErrors(); // Refresh
    } catch (err) {
      console.error('Healing failed:', err);
    } finally {
      setHealing(false);
    }
  };

  const healOne = async (entry: ErrorEntry) => {
    setHealing(true);
    try {
      const res = await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heal_one',
          data: {
            errorType: entry.errorType,
            selfHealAction: entry.selfHealAction,
          },
        }),
      });
      const result = await res.json();
      console.log('Heal result:', result);
      await fetchErrors();
    } catch (err) {
      console.error('Healing failed:', err);
    } finally {
      setHealing(false);
    }
  };

  const getErrorColor = (severity: 'error' | 'warning') => {
    return severity === 'error' ? 'text-red-500' : 'text-yellow-500';
  };

  const getErrorIcon = (errorType: string) => {
    // No icons - Sam's preference
    return null;
  };

  const getSeverityBadge = (severity: 'error' | 'warning') => {
    return severity === 'error' 
      ? <span className="px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded font-medium">ERROR</span>
      : <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded font-medium">WARNING</span>;
  };

  // Filter errors by severity
  const filteredErrors = data?.errors.filter(err => 
    severityFilter === 'all' || err.severity === severityFilter
  ) || [];

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Errors</h1>
        <p className="text-gray-400">Loading errors...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Errors</h1>
        <p className="text-gray-400">Failed to load errors.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">System Errors</h1>
        <div className="flex items-center gap-4">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'all' | 'error' | 'warning')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm"
          >
            <option value="all">All</option>
            <option value="error">Errors Only</option>
            <option value="warning">Warnings Only</option>
          </select>
          
          <select
            value={hours}
            onChange={(e) => setHours(parseInt(e.target.value))}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm"
          >
            <option value="1">Last 1 hour</option>
            <option value="6">Last 6 hours</option>
            <option value="24">Last 24 hours</option>
            <option value="72">Last 3 days</option>
            <option value="168">Last week</option>
          </select>
          
          {data.healable > 0 && (
            <button
              onClick={() => setShowHealModal(true)}
              disabled={healing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md text-sm font-medium transition"
            >
              {healing ? 'Healing...' : `Self-Heal All (${data.healable})`}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total</div>
          <div className="text-3xl font-bold">{data.total}</div>
        </div>
        
        <div className="bg-gray-800 border border-red-700/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Errors</div>
          <div className="text-3xl font-bold text-red-500">
            {data.errors.filter(e => e.severity === 'error').length}
          </div>
        </div>
        
        <div className="bg-gray-800 border border-yellow-700/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Warnings</div>
          <div className="text-3xl font-bold text-yellow-500">
            {data.errors.filter(e => e.severity === 'warning').length}
          </div>
        </div>
        
        <div className="bg-gray-800 border border-green-700/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Self-Healable</div>
          <div className="text-3xl font-bold text-green-500">{data.healable}</div>
        </div>
      </div>

      {/* Error Type Summary */}
      {Object.keys(data.summary).length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Error Types</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.summary).map(([type, count]) => (
              <div key={type}>
                <div className="text-sm font-medium">{type.replace(/_/g, ' ')}</div>
                <div className="text-gray-400 text-xs">{count} occurrence{count > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error List */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-750">
                <th className="text-left p-4 font-medium text-sm">Type</th>
                <th className="text-left p-4 font-medium text-sm">Tool</th>
                <th className="text-left p-4 font-medium text-sm">Error</th>
                <th className="text-left p-4 font-medium text-sm">Session</th>
                <th className="text-left p-4 font-medium text-sm">Time</th>
                <th className="text-left p-4 font-medium text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredErrors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-gray-400">
                    {severityFilter === 'all' 
                      ? 'No errors found in the selected time range'
                      : `No ${severityFilter}s found in the selected time range`
                    }
                  </td>
                </tr>
              ) : (
                filteredErrors.map((err, idx) => (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750 transition">
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        <span className={`text-xs font-mono ${getErrorColor(err.severity)}`}>
                          {err.errorType}
                        </span>
                        {getSeverityBadge(err.severity)}
                      </div>
                    </td>
                    <td className="p-4">
                      <code className="text-xs bg-gray-900 px-2 py-1 rounded">{err.tool}</code>
                    </td>
                    <td className="p-4">
                      <div className="max-w-2xl">
                        <div className="text-sm text-gray-300 break-words" title={err.error}>
                          {err.error}
                        </div>
                        {err.selfHealAction && (
                          <div className="text-xs text-green-500 mt-1 font-mono">
                            → {err.selfHealAction}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => router.push(`/sessions/${err.sessionId}`)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                      >
                        {err.sessionKey.split(':').pop() || 'View'}
                      </button>
                    </td>
                    <td className="p-4 text-xs text-gray-400">
                      {new Date(err.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">
                      {err.canSelfHeal ? (
                        <button
                          onClick={() => healOne(err)}
                          disabled={healing}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-xs font-medium transition"
                        >
                          Heal
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">Manual</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showHealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHealModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-white mb-2">Self-heal all errors?</h2>
            <p className="text-sm text-zinc-400 mb-6">This will create missing memory files and attempt to fix all healable errors.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowHealModal(false)} className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors">Cancel</button>
              <button onClick={healAll} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">Self-Heal All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
