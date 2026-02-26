'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  type: string;
  model?: string;
  usage?: { input: number; output: number; total: number; cost: number };
  toolCalls?: Array<{ name?: string; id?: string; tool_use_id?: string; content?: string }>;
}

interface SessionData {
  sessionId: string;
  sessionKey: string;
  displayName: string;
  model: string;
  thinkingLevel: string;
  status: string;
  updatedAt: number;
  messageCount: number;
  messages: Message[];
}

const modelNames: Record<string, string> = {
  'claude-opus-4-6': 'Claude Opus 4',
  'claude-opus-4-20250514': 'Claude Opus 4',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-haiku-3-5-20241022': 'Claude Haiku 3.5',
};

function formatModel(raw: string): string {
  const bare = raw.replace('anthropic/', '');
  return modelNames[bare] || bare;
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) throw new Error('Session not found');
        setSession(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading session...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error || 'Session not found'}</div>
          <Link href="/" className="text-orange-400 hover:text-orange-300">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Filter messages based on showTools toggle
  const displayMessages = showTools
    ? session.messages
    : session.messages.filter(m => m.content.trim().length > 0);

  // Calculate total tokens for this session
  const totalTokens = session.messages.reduce((sum, m) => sum + (m.usage?.total || 0), 0);
  const totalCost = session.messages.reduce((sum, m) => sum + (m.usage?.cost || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-950">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{session.displayName}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                session.status === 'active' ? 'bg-green-500/20 text-green-400' :
                session.status === 'idle' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-zinc-700/30 text-zinc-500'
              }`}>
                {session.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1">
              <span>{formatModel(session.model)}</span>
              {session.thinkingLevel && <span>Thinking: {session.thinkingLevel}</span>}
              <span>{session.messageCount} messages</span>
              {totalTokens > 0 && <span>{formatTokens(totalTokens)} tokens</span>}
              {totalCost > 0 && <span>${totalCost.toFixed(2)}</span>}
            </div>
          </div>
          <button
            onClick={() => setShowTools(!showTools)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showTools
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {showTools ? 'Hide Tools' : 'Show Tools'}
          </button>
        </div>

        {/* Messages */}
        <div className="space-y-1">
          {displayMessages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={`rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-zinc-800/60 border-l-2 border-blue-500/50'
                  : msg.role === 'assistant'
                  ? 'bg-zinc-900/60 border-l-2 border-orange-500/50'
                  : 'bg-zinc-900/30 border-l-2 border-zinc-700/50'
              }`}
            >
              {/* Message header */}
              <div className="flex items-center gap-2 mb-2 text-xs">
                <span className={`font-medium ${
                  msg.role === 'user' ? 'text-blue-400' :
                  msg.role === 'assistant' ? 'text-orange-400' :
                  'text-zinc-500'
                }`}>
                  {msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Clawd' : msg.role}
                </span>
                <span className="text-zinc-600">{formatTime(msg.timestamp)}</span>
                {msg.usage && (
                  <span className="text-zinc-600 ml-auto font-mono">
                    {formatTokens(msg.usage.total)} tokens
                  </span>
                )}
              </div>

              {/* Tool calls */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.toolCalls.map((tc, j) => (
                    <span key={j} className="px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded text-xs font-mono">
                      {tc.name || `result:${tc.tool_use_id?.substring(0, 8)}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Message content */}
              {msg.content && (
                <div className="text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
                  {msg.content.length > 2000 ? msg.content.substring(0, 2000) + '\n\n[...truncated]' : msg.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Auto-scroll indicator for active sessions */}
        {session.status === 'active' && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center gap-2 text-xs text-green-400/60">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live — refreshing every 5s
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
