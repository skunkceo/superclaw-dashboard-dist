'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import ActivityHeatmap from '@/components/ActivityHeatmap';

interface Agent {
  label: string;
  name: string;
  description: string;
  status: string;
  messageCount: number;
  lastActive: string;
  model: string | null;
  memory: {
    size: string;
    bytes: number;
    files: string[];
  };
}

interface MemoryData {
  longTerm: string | null;
  today: string | null;
  recentDays: string[];
}

interface ActivityEntry {
  id: string;
  agent_label: string;
  action_type: string;
  summary: string;
  details: string | null;
  links: string;
  timestamp: number;
}

export default function AgentDetailPage() {
  const params = useParams();
  const label = params?.label as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'memory' | 'activity' | 'config'>('overview');
  const [taskText, setTaskText] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ linearIssue?: { identifier: string; url: string } | null; agent?: string; matchedRule?: string } | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [savingModel, setSavingModel] = useState(false);
  const [modelSaved, setModelSaved] = useState(false);

  const AVAILABLE_MODELS = [
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5', description: 'Fast & cheap' },
    { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', description: 'Balanced' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', description: 'Latest Sonnet' },
    { id: 'claude-opus-4-5', label: 'Opus 4.5', description: 'Powerful' },
    { id: 'claude-opus-4', label: 'Opus 4', description: 'Most capable' },
  ];

  const handleModelSave = async () => {
    if (!selectedModel || savingModel) return;
    setSavingModel(true);
    setModelSaved(false);
    try {
      const res = await fetch(`/api/agents/${label}/model`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      if (!res.ok) throw new Error('Failed to save model');
      setModelSaved(true);
      setTimeout(() => setModelSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingModel(false);
    }
  };

  const handleDispatch = async () => {
    if (!taskText.trim() || dispatching) return;
    setDispatching(true);
    setDispatchResult(null);
    setDispatchError(null);
    try {
      const res = await fetch('/api/agents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskText.trim(), agentOverride: label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dispatch failed');
      setDispatchResult(data);
      setTaskText('');
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDispatching(false);
    }
  };

  useEffect(() => {
    if (!label) return;

    fetch(`/api/agents/${label}`)
      .then(res => {
        if (!res.ok) throw new Error('Agent not found');
        return res.json();
      })
      .then(data => {
        setAgent(data.agent);
        if (data.agent?.model) setSelectedModel(data.agent.model);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [label]);

  // Load memory data when Memory tab is active
  useEffect(() => {
    if (activeTab === 'memory' && label && !memoryData) {
      setMemoryLoading(true);
      fetch(`/api/agents/${label}/memory`)
        .then(res => res.json())
        .then(data => {
          setMemoryData(data);
          setMemoryLoading(false);
        })
        .catch(() => setMemoryLoading(false));
    }
  }, [activeTab, label, memoryData]);

  // Load activity when Activity tab is active
  useEffect(() => {
    if (activeTab === 'activity' && label && activityEntries.length === 0) {
      setActivityLoading(true);
      fetch(`/api/activity?agent=${label}&limit=20`)
        .then(res => res.json())
        .then(data => {
          setActivityEntries(data.entries || []);
          setActivityLoading(false);
        })
        .catch(() => setActivityLoading(false));
    }
  }, [activeTab, label, activityEntries.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Loading agent...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Agent not found</h2>
          <Link href="/agents" className="text-orange-400 hover:text-orange-300">
            ← Back to agents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/agents" className="text-zinc-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-sm font-semibold text-white">{agent.name}</h1>
            <span className={`px-2 py-1 rounded text-xs ml-auto ${
              agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
              agent.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-zinc-700 text-zinc-400'
            }`}>
              {agent.status}
            </span>
          </div>
          
          {agent.description && (
            <p className="text-zinc-400 mb-4">{agent.description}</p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span className="px-2 py-1 bg-zinc-800 rounded font-mono">{agent.label}</span>
            {agent.lastActive !== 'never' && (
              <>
                <span>•</span>
                <span>Last active {agent.lastActive}</span>
              </>
            )}
          </div>
        </div>

        {/* Activity Heatmap + Stats Side by Side */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Heatmap - takes most space */}
          <div className="flex-1 min-w-0 bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-6">
            <ActivityHeatmap agentLabel={label} title="Agent Activity" />
          </div>
          {/* Stats - fixed width column on desktop, row of cards on mobile */}
          <div className="flex flex-row md:flex-col gap-3 md:w-48">
            <div className="flex-1 min-w-0 bg-zinc-900 rounded-xl border border-zinc-800 p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-zinc-400 mb-1">Memory</div>
              <div className="text-lg sm:text-2xl font-bold truncate">{agent.memory.size}</div>
              <div className="text-xs text-zinc-500 mt-1">{agent.memory.files.length} files</div>
            </div>
            
            <div className="flex-1 min-w-0 bg-zinc-900 rounded-xl border border-zinc-800 p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-zinc-400 mb-2">Model</div>
              <select
                value={selectedModel}
                onChange={e => { setSelectedModel(e.target.value); setModelSaved(false); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="">— select —</option>
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              {selectedModel && (
                <div className="mt-2">
                  <button
                    onClick={handleModelSave}
                    disabled={savingModel || selectedModel === agent.model}
                    className={`w-full py-1 rounded text-xs font-medium transition-colors ${
                      modelSaved
                        ? 'bg-green-600 text-white'
                        : selectedModel === agent.model
                        ? 'bg-zinc-700 text-zinc-500 cursor-default'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    {modelSaved ? 'Saved' : savingModel ? 'Saving...' : selectedModel === agent.model ? 'Current' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0 bg-zinc-900 rounded-xl border border-zinc-800 p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-zinc-400 mb-1">Status</div>
              <div className="text-sm sm:text-lg font-bold capitalize">{agent.status}</div>
              {agent.lastActive !== 'never' && (
                <div className="text-xs text-zinc-500 mt-1 truncate">{agent.lastActive}</div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="border-b border-zinc-800 flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium transition ${
                activeTab === 'overview'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium transition ${
                activeTab === 'memory' 
                  ? 'text-orange-400 border-b-2 border-orange-400' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Memory
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium transition ${
                activeTab === 'activity' 
                  ? 'text-orange-400 border-b-2 border-orange-400' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium transition ${
                activeTab === 'config' 
                  ? 'text-orange-400 border-b-2 border-orange-400' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Configuration
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  Give {agent.name} a task directly. A Linear issue will be created and the agent will be spawned to handle it.
                </p>
                <textarea
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  placeholder={`Describe the task for ${agent.name}...`}
                  rows={5}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 resize-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDispatch}
                    disabled={!taskText.trim() || dispatching}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
                  >
                    {dispatching ? 'Dispatching...' : 'Dispatch Task'}
                  </button>
                  {dispatchError && (
                    <span className="text-sm text-red-400">{dispatchError}</span>
                  )}
                </div>
                {dispatchResult && (
                  <div className="mt-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-2">
                    <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Task dispatched to {dispatchResult.agent}
                    </div>
                    {dispatchResult.linearIssue && (
                      <a
                        href={dispatchResult.linearIssue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300"
                      >
                        <span className="font-mono">{dispatchResult.linearIssue.identifier}</span>
                        <span>created in Linear</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    <p className="text-xs text-zinc-500">The agent will appear in Live Agents once it picks up the work.</p>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'memory' && (
              <div className="space-y-6">
                {memoryLoading ? (
                  <div className="text-center py-12 text-zinc-400 animate-pulse">
                    Loading memory...
                  </div>
                ) : !memoryData ? (
                  <div className="text-center py-12 text-zinc-500">
                    No memory data available
                  </div>
                ) : (
                  <>
                    {/* Long-term Memory */}
                    {memoryData.longTerm && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Long-Term Memory
                        </h3>
                        <div className="bg-zinc-800/50 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
                          <ReactMarkdown
                            components={{
                              h1: ({children}) => <h1 className="text-lg font-bold text-white mt-4 mb-2 first:mt-0">{children}</h1>,
                              h2: ({children}) => <h2 className="text-base font-semibold text-white mt-4 mb-2 first:mt-0 pb-1 border-b border-zinc-700">{children}</h2>,
                              h3: ({children}) => <h3 className="text-sm font-semibold text-zinc-200 mt-3 mb-1">{children}</h3>,
                              p: ({children}) => <p className="text-zinc-300 mb-2">{children}</p>,
                              ul: ({children}) => <ul className="list-disc list-inside space-y-1 text-zinc-300 mb-2 ml-2">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal list-inside space-y-1 text-zinc-300 mb-2 ml-2">{children}</ol>,
                              li: ({children}) => <li className="text-zinc-300">{children}</li>,
                              code: ({children}) => <code className="px-1.5 py-0.5 bg-zinc-700 rounded text-orange-300 text-xs font-mono">{children}</code>,
                              pre: ({children}) => <pre className="bg-zinc-900 rounded-lg p-3 overflow-x-auto text-xs mb-2 border border-zinc-700">{children}</pre>,
                              strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                              a: ({href, children}) => <a href={href} className="text-orange-400 hover:text-orange-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                              table: ({children}) => <table className="w-full text-xs border-collapse mb-3">{children}</table>,
                              th: ({children}) => <th className="text-left px-3 py-2 bg-zinc-700 text-zinc-200 font-medium border border-zinc-600">{children}</th>,
                              td: ({children}) => <td className="px-3 py-2 text-zinc-300 border border-zinc-700">{children}</td>,
                              blockquote: ({children}) => <blockquote className="border-l-2 border-orange-500/50 pl-4 text-zinc-400 italic my-2">{children}</blockquote>,
                              hr: () => <hr className="border-zinc-700 my-4" />,
                            }}
                          >
                            {memoryData.longTerm}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Today's Memory */}
                    {memoryData.today && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Today
                        </h3>
                        <div className="bg-zinc-800/50 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
                          <ReactMarkdown
                            components={{
                              h1: ({children}) => <h1 className="text-lg font-bold text-white mt-4 mb-2 first:mt-0">{children}</h1>,
                              h2: ({children}) => <h2 className="text-base font-semibold text-white mt-4 mb-2 first:mt-0 pb-1 border-b border-zinc-700">{children}</h2>,
                              h3: ({children}) => <h3 className="text-sm font-semibold text-zinc-200 mt-3 mb-1">{children}</h3>,
                              p: ({children}) => <p className="text-zinc-300 mb-2">{children}</p>,
                              ul: ({children}) => <ul className="list-disc list-inside space-y-1 text-zinc-300 mb-2 ml-2">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal list-inside space-y-1 text-zinc-300 mb-2 ml-2">{children}</ol>,
                              li: ({children}) => <li className="text-zinc-300">{children}</li>,
                              code: ({children}) => <code className="px-1.5 py-0.5 bg-zinc-700 rounded text-orange-300 text-xs font-mono">{children}</code>,
                              pre: ({children}) => <pre className="bg-zinc-900 rounded-lg p-3 overflow-x-auto text-xs mb-2 border border-zinc-700">{children}</pre>,
                              strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                              a: ({href, children}) => <a href={href} className="text-orange-400 hover:text-orange-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                              table: ({children}) => <table className="w-full text-xs border-collapse mb-3">{children}</table>,
                              th: ({children}) => <th className="text-left px-3 py-2 bg-zinc-700 text-zinc-200 font-medium border border-zinc-600">{children}</th>,
                              td: ({children}) => <td className="px-3 py-2 text-zinc-300 border border-zinc-700">{children}</td>,
                              blockquote: ({children}) => <blockquote className="border-l-2 border-orange-500/50 pl-4 text-zinc-400 italic my-2">{children}</blockquote>,
                              hr: () => <hr className="border-zinc-700 my-4" />,
                            }}
                          >
                            {memoryData.today}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Recent Days */}
                    {memoryData.recentDays.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white">Recent Memory Files</h3>
                        <div className="space-y-2">
                          {memoryData.recentDays.map((day: string) => (
                            <div
                              key={day}
                              className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg hover:bg-zinc-800/70 transition"
                            >
                              <div className="flex items-center gap-3">
                                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="font-mono text-sm">{day}.md</span>
                              </div>
                              <Link
                                href={`/memory?agent=${agent.label}&file=${day}.md`}
                                className="text-orange-400 hover:text-orange-300 text-sm"
                              >
                                View →
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {activeTab === 'activity' && (
              <div className="space-y-3">
                {activityLoading ? (
                  <div className="text-center py-12 text-zinc-400 animate-pulse">
                    Loading activity...
                  </div>
                ) : activityEntries.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    No activity logged yet
                  </div>
                ) : (
                  activityEntries.map((entry: ActivityEntry) => {
                    const date = new Date(entry.timestamp);
                    const links = entry.links ? JSON.parse(entry.links) : [];
                    
                    return (
                      <div
                        key={entry.id}
                        className="p-4 bg-zinc-800 rounded-lg space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                                {entry.action_type}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {date.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-white">{entry.summary}</p>
                            {entry.details && (
                              <p className="text-xs text-zinc-400 mt-2">{entry.details}</p>
                            )}
                            {links.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {links.map((link: { label: string; url: string }, i: number) => (
                                  <a
                                    key={i}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                                  >
                                    {link.label}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'config' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-800 rounded-lg">
                  <div className="text-sm text-zinc-400 mb-2">Agent Label</div>
                  <div className="font-mono text-white">{agent.label}</div>
                </div>
                
                <div className="p-4 bg-zinc-800 rounded-lg">
                  <div className="text-sm text-zinc-400 mb-2">Display Name</div>
                  <div className="text-white">{agent.name}</div>
                </div>
                
                <div className="p-4 bg-zinc-800 rounded-lg">
                  <div className="text-sm text-zinc-400 mb-2">Description</div>
                  <div className="text-white">{agent.description || 'No description'}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
