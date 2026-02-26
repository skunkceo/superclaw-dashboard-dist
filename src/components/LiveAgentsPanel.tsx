'use client';

import { useEffect, useState } from 'react';

interface SubAgent {
  sessionKey: string;
  label: string;
  status: 'active' | 'idle' | 'done';
  model: string;
  lastMessage: string | null;
  duration: string;
  messageCount: number;
}

interface SpawnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (task: string, label: string, model: string) => void;
  loading: boolean;
}

function SpawnModal({ isOpen, onClose, onSpawn, loading }: SpawnModalProps) {
  const [task, setTask] = useState('');
  const [label, setLabel] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!task.trim() || !label.trim()) return;
    onSpawn(task, label, model);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Spawn Sub-Agent</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., data-analyst, content-writer"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Task</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what the agent should do..."
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              disabled={loading}
            >
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
              <option value="claude-haiku-4-20250307">Claude Haiku 4</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={loading || !task.trim() || !label.trim()}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Spawning...' : 'Spawn Agent'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 text-zinc-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface SteerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  loading: boolean;
  agentLabel: string;
}

function SteerModal({ isOpen, onClose, onSend, loading, agentLabel }: SteerModalProps) {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSend(message);
    setMessage('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold text-white mb-1">Guide Agent</h3>
        <p className="text-sm text-zinc-500 mb-4">{agentLabel}</p>
        
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Send a message to this agent..."
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none mb-4"
          disabled={loading}
          autoFocus
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !message.trim()}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 text-zinc-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface KillConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  agentLabel: string;
}

function KillConfirm({ isOpen, onClose, onConfirm, loading, agentLabel }: KillConfirmProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Stop Agent?</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Are you sure you want to terminate <span className="text-white font-medium">{agentLabel}</span>? This cannot be undone.
        </p>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-red-500/10 hover:bg-red-500/20 disabled:bg-zinc-700 border border-red-500/30 text-red-400 disabled:text-zinc-500 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Stopping...' : 'Stop Agent'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 text-zinc-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveAgentsPanel() {
  const [sessions, setSessions] = useState<SubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [spawnModalOpen, setSpawnModalOpen] = useState(false);
  const [steerModalOpen, setSteerModalOpen] = useState(false);
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SubAgent | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/subagents');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sub-agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleSpawn = async (task: string, label: string, model: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/subagents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, label, model })
      });

      if (res.ok) {
        setSpawnModalOpen(false);
        fetchSessions(); // Refresh list
      } else {
        const data = await res.json();
        setErrorMessage(`Failed to spawn agent: ${data.error || 'Unknown error'}`);
      }
    } catch {
      setErrorMessage('Failed to spawn agent');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSteer = async (message: string) => {
    if (!selectedAgent) return;
    setActionLoading(true);
    
    // TODO: Implement steer API endpoint
    // For now, just close the modal
    setTimeout(() => {
      setSteerModalOpen(false);
      setActionLoading(false);
      setSelectedAgent(null);
    }, 500);
  };

  const handleKill = async () => {
    if (!selectedAgent) return;
    setActionLoading(true);
    
    try {
      const res = await fetch(`/api/subagents?sessionKey=${encodeURIComponent(selectedAgent.sessionKey)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setKillConfirmOpen(false);
        setSelectedAgent(null);
        fetchSessions(); // Refresh list
      } else {
        const data = await res.json();
        setErrorMessage(`Failed to stop agent: ${data.error || 'Unknown error'}`);
      }
    } catch {
      setErrorMessage('Failed to stop agent');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Live Agents</h3>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-800/60 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Error toast */}
      {errorMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3 max-w-md">
          <span className="text-sm flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Live Agents</h3>
        </div>

        {sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-zinc-600">No active agents</span>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((agent) => (
              <div
                key={agent.sessionKey}
                className="flex items-start gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg transition-colors group"
              >
                {/* Status indicator */}
                <div className="flex-shrink-0 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full block ${
                      agent.status === 'active'
                        ? 'bg-orange-400 animate-pulse'
                        : agent.status === 'done'
                        ? 'bg-zinc-600'
                        : 'bg-zinc-500'
                    }`}
                  />
                </div>

                {/* Agent info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">{agent.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        agent.status === 'active'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-zinc-700 text-zinc-500'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  
                  {agent.lastMessage && (
                    <p className="text-xs text-zinc-500 line-clamp-1 mb-1.5">{agent.lastMessage}</p>
                  )}
                  
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                    <span className="font-mono">{agent.model.split('/').pop()?.replace('anthropic/', '')}</span>
                    <span>·</span>
                    <span>{agent.duration}</span>
                    <span>·</span>
                    <span>{agent.messageCount} msgs</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setSelectedAgent(agent);
                      setSteerModalOpen(true);
                    }}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded text-[10px] text-zinc-300 transition-colors"
                    disabled={agent.status === 'done'}
                  >
                    Guide
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAgent(agent);
                      setKillConfirmOpen(true);
                    }}
                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-[10px] text-red-400 transition-colors"
                    disabled={agent.status === 'done'}
                  >
                    Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <SpawnModal
        isOpen={spawnModalOpen}
        onClose={() => setSpawnModalOpen(false)}
        onSpawn={handleSpawn}
        loading={actionLoading}
      />

      <SteerModal
        isOpen={steerModalOpen}
        onClose={() => {
          setSteerModalOpen(false);
          setSelectedAgent(null);
        }}
        onSend={handleSteer}
        loading={actionLoading}
        agentLabel={selectedAgent?.label || ''}
      />

      <KillConfirm
        isOpen={killConfirmOpen}
        onClose={() => {
          setKillConfirmOpen(false);
          setSelectedAgent(null);
        }}
        onConfirm={handleKill}
        loading={actionLoading}
        agentLabel={selectedAgent?.label || ''}
      />
    </>
  );
}
