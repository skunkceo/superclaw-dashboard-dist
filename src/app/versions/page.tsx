'use client';

import { useEffect, useState } from 'react';

interface VersionData {
  dashboard: {
    current: string;
    latest: string;
    updateAvailable: boolean;
    updateCommand: string;
    changelog: string | null;
    releaseNotes: string | null;
  };
  openclaw: {
    current: string;
    latest: string;
    updateAvailable: boolean;
    command: string;
    updateCommand: string;
    isLegacy: boolean;
    releaseUrl: string | null;
    changelog: string | null;
    releaseNotes: string | null;
  };
  node: {
    version: string;
  };
  checkedAt: string;
}

interface Summaries {
  dashboard: string | null;
  openclaw: string | null;
  dashboardLoading: boolean;
  openclawLoading: boolean;
}

export default function VersionsPage() {
  const [data, setData] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string; debug?: string } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [runningSubAgents, setRunningSubAgents] = useState(0);
  const [openSessions, setOpenSessions] = useState(0);
  const [summaries, setSummaries] = useState<Summaries>({
    dashboard: null,
    openclaw: null,
    dashboardLoading: false,
    openclawLoading: false,
  });

  const fetchSummary = async (
    product: 'dashboard' | 'openclaw',
    notes: string,
    productName: string,
    version: string
  ) => {
    setSummaries(prev => ({
      ...prev,
      [`${product}Loading`]: true,
    }));
    try {
      const res = await fetch('/api/versions/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, product: productName, version }),
      });
      if (res.ok) {
        const { summary } = await res.json();
        setSummaries(prev => ({
          ...prev,
          [product]: summary,
          [`${product}Loading`]: false,
        }));
      } else {
        setSummaries(prev => ({ ...prev, [`${product}Loading`]: false }));
      }
    } catch {
      setSummaries(prev => ({ ...prev, [`${product}Loading`]: false }));
    }
  };

  useEffect(() => {
    fetch('/api/versions')
      .then(res => res.json())
      .then((versionData: VersionData) => {
        setData(versionData);
        // Kick off AI summary fetches for products with release notes
        if (versionData.dashboard.updateAvailable && versionData.dashboard.releaseNotes) {
          fetchSummary(
            'dashboard',
            versionData.dashboard.releaseNotes,
            'SuperClaw Dashboard',
            versionData.dashboard.latest
          );
        }
        if (
          (versionData.openclaw.updateAvailable || versionData.openclaw.isLegacy) &&
          versionData.openclaw.releaseNotes
        ) {
          fetchSummary(
            'openclaw',
            versionData.openclaw.releaseNotes,
            'OpenClaw',
            versionData.openclaw.latest
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const copyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const openUpdateModal = async () => {
    // Fetch actual running work count
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const status = await res.json();
        setRunningSubAgents(status.tasks?.runningSubAgents || 0);
        setOpenSessions(status.tasks?.openSessions || 0);
      }
    } catch {
      setRunningSubAgents(0);
      setOpenSessions(0);
    }
    setShowUpdateModal(true);
  };

  const pollForReconnection = async (maxAttempts = 20): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between attempts
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch('/api/status', { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) return true;
      } catch {
        // Continue polling
      }
    }
    return false;
  };

  const runUpdate = async () => {
    setShowUpdateModal(false);
    setUpdating(true);
    setUpdateResult(null);

    const oldVersion = data?.openclaw.current;

    try {
      const response = await fetch('/api/gateway/update', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success && result.restarting) {
        // Gateway is restarting - wait for reconnection
        setUpdateResult({
          success: true,
          message: 'Gateway restarting... waiting for reconnection'
        });

        const reconnected = await pollForReconnection();
        
        if (reconnected) {
          // Check new version
          const versionRes = await fetch('/api/versions');
          if (versionRes.ok) {
            const versionData = await versionRes.json();
            setData(versionData);
            
            if (versionData.openclaw.current !== oldVersion) {
              setUpdateResult({
                success: true,
                message: `Successfully updated from ${oldVersion} to ${versionData.openclaw.current}`
              });
            } else {
              setUpdateResult({
                success: true,
                message: 'Gateway restarted (already on latest version)'
              });
            }
          }
        } else {
          setUpdateResult({
            success: false,
            message: 'Update may have succeeded but gateway did not reconnect. Please refresh manually.'
          });
        }
      } else if (result.success) {
        setUpdateResult({
          success: true,
          message: result.message || 'Update completed successfully'
        });
        // Reload version data
        setTimeout(() => {
          fetch('/api/versions')
            .then(res => res.json())
            .then(setData)
            .catch(console.error);
        }, 2000);
      } else {
        setUpdateResult({
          success: false,
          message: result.message || 'Update failed',
          debug: result.debug
        });
      }
    } catch (error: any) {
      setUpdateResult({
        success: false,
        message: error.message || 'Failed to trigger update'
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Checking versions...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Failed to load version information</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Versions</h1>
        <p className="text-zinc-400 mb-8">Check for updates and manage your installation</p>

        <div className="space-y-6">
          {/* Dashboard Version */}
          <div className={`bg-zinc-900 border rounded-xl p-4 sm:p-6 ${
            data.dashboard.updateAvailable ? 'border-orange-500/50' : 'border-zinc-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-white flex flex-wrap items-center gap-2">
                  SuperClaw Dashboard
                  {data.dashboard.updateAvailable && (
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full whitespace-nowrap">
                      Update available
                    </span>
                  )}
                </h2>
                <p className="text-zinc-500 text-sm mt-1">Web dashboard UI</p>
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                <div className="text-xl sm:text-2xl font-mono text-white">v{data.dashboard.current}</div>
                {data.dashboard.updateAvailable && (
                  <a 
                    href={`https://github.com/skunkceo/superclaw-dashboard/releases/tag/v${data.dashboard.latest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-400 hover:text-orange-300 hover:underline"
                  >
                    v{data.dashboard.latest} available
                  </a>
                )}
              </div>
            </div>

            {data.dashboard.updateAvailable && (
              <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                <code className="block bg-zinc-800 px-3 py-2 rounded-lg text-xs sm:text-sm text-zinc-300 font-mono overflow-x-auto">
                  {data.dashboard.updateCommand}
                </code>
                {/* AI release summary */}
                {(summaries.dashboardLoading || summaries.dashboard) && (
                  <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2.5">
                    {summaries.dashboardLoading ? (
                      <div className="flex items-center gap-2 text-zinc-500 text-sm">
                        <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Summarising release notes...
                      </div>
                    ) : (
                      <p className="text-zinc-400 text-sm leading-relaxed">{summaries.dashboard}</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {data.dashboard.changelog && (
                    <a
                      href={data.dashboard.changelog}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-orange-400 hover:text-orange-300"
                    >
                      Full changelog
                    </a>
                  )}
                  <button
                    onClick={() => copyCommand(data.dashboard.updateCommand, 'dashboard')}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg"
                  >
                    {copied === 'dashboard' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {!data.dashboard.updateAvailable && (
              <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">You're on the latest version</span>
              </div>
            )}
          </div>

          {/* OpenClaw Version */}
          <div className={`bg-zinc-900 border rounded-xl p-4 sm:p-6 ${
            data.openclaw.updateAvailable || data.openclaw.isLegacy ? 'border-orange-500/50' : 'border-zinc-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-white flex flex-wrap items-center gap-2">
                  OpenClaw
                  {data.openclaw.isLegacy && (
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full whitespace-nowrap">
                      Legacy install (clawdbot)
                    </span>
                  )}
                  {data.openclaw.updateAvailable && !data.openclaw.isLegacy && (
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full whitespace-nowrap">
                      Update available
                    </span>
                  )}
                </h2>
                <p className="text-zinc-500 text-sm mt-1">AI gateway and agent runtime</p>
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                <div className="text-xl sm:text-2xl font-mono text-white">{data.openclaw.current}</div>
                {(data.openclaw.updateAvailable || data.openclaw.isLegacy) && (
                  <a 
                    href={data.openclaw.releaseUrl ?? `https://github.com/openclaw/openclaw/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-400 hover:text-orange-300 hover:underline"
                  >
                    v{data.openclaw.latest} available
                  </a>
                )}
              </div>
            </div>

            {data.openclaw.isLegacy && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  You're running the legacy <code className="bg-zinc-800 px-1 rounded">clawdbot</code> package. 
                  Migrate to <code className="bg-zinc-800 px-1 rounded">openclaw</code> for the latest features.
                </p>
              </div>
            )}

            {(data.openclaw.updateAvailable || data.openclaw.isLegacy) && (
              <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                <code className="block bg-zinc-800 px-3 py-2 rounded-lg text-xs sm:text-sm text-zinc-300 font-mono overflow-x-auto">
                  {data.openclaw.updateCommand}
                </code>
                {/* AI release summary */}
                {(summaries.openclawLoading || summaries.openclaw) && (
                  <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2.5">
                    {summaries.openclawLoading ? (
                      <div className="flex items-center gap-2 text-zinc-500 text-sm">
                        <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Summarising release notes...
                      </div>
                    ) : (
                      <p className="text-zinc-400 text-sm leading-relaxed">{summaries.openclaw}</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {data.openclaw.changelog && (
                    <a
                      href={data.openclaw.changelog}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-orange-400 hover:text-orange-300 whitespace-nowrap"
                    >
                      Full changelog
                    </a>
                  )}
                  <button
                    onClick={() => copyCommand(data.openclaw.updateCommand, 'openclaw')}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg whitespace-nowrap"
                  >
                    {copied === 'openclaw' ? 'Copied!' : 'Copy'}
                  </button>
                  {!data.openclaw.isLegacy && (
                    <button
                      onClick={openUpdateModal}
                      disabled={updating}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:cursor-not-allowed text-white text-sm rounded-lg whitespace-nowrap"
                    >
                      {updating ? 'Updating...' : 'Run Update'}
                    </button>
                  )}
                </div>
                {updateResult && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    updateResult.success 
                      ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                      : 'bg-red-500/10 border border-red-500/30 text-red-400'
                  }`}>
                    <p className="text-sm">{updateResult.message}</p>
                    {!updateResult.success && updateResult.debug && (
                      <pre className="mt-2 text-xs text-red-300/70 whitespace-pre-wrap break-all font-mono">{updateResult.debug}</pre>
                    )}
                  </div>
                )}
                {data.openclaw.isLegacy && (
                  <p className="mt-3 text-zinc-500 text-xs">
                    Legacy installations require manual migration. Copy the command above and run it manually.
                  </p>
                )}
              </div>
            )}

            {!data.openclaw.updateAvailable && !data.openclaw.isLegacy && (
              <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">You're on the latest version</span>
              </div>
            )}
          </div>

          {/* System Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-4">System</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <div className="text-zinc-500 text-sm">Node.js</div>
                <div className="text-white font-mono text-sm sm:text-base">{data.node.version}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-sm">Last checked</div>
                <div className="text-white font-mono text-sm">
                  {new Date(data.checkedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Update Confirmation Modal */}
      {showUpdateModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowUpdateModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Update OpenClaw Gateway
                  </h3>
                  <p className="text-zinc-400 text-sm mb-3">
                    This will update OpenClaw to the latest version and restart the gateway.
                  </p>
                  
                  {runningSubAgents > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="text-yellow-400 font-medium text-sm mb-1">
                            {runningSubAgents} sub-agent{runningSubAgents !== 1 ? 's' : ''} actively working
                          </p>
                          <p className="text-yellow-400/80 text-xs">
                            Running tasks may be interrupted. Consider waiting for them to finish.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {runningSubAgents === 0 && openSessions > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-blue-400 font-medium text-sm mb-1">
                            {openSessions} open session{openSessions !== 1 ? 's' : ''}
                          </p>
                          <p className="text-blue-400/80 text-xs">
                            Chat sessions will reconnect automatically after restart. No active work in progress.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
                    <p className="text-zinc-300 text-sm font-medium mb-2">What will happen:</p>
                    <ul className="text-zinc-400 text-sm space-y-1">
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span>npm will update OpenClaw globally</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span>Gateway will restart (~5-10 seconds downtime)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span>Sessions and agents will reconnect automatically</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={runUpdate}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Continue Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
