'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type CommandKind = 'navigate' | 'action' | 'external';

interface Command {
  id: string;
  label: string;
  description?: string;
  category: string;
  kind: CommandKind;
  href?: string;
  action?: string;
  actionPayload?: Record<string, unknown>;
  icon?: string;
  kbd?: string[];
}

// ─── Fuzzy match ──────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // subsequence match
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreMatch(query: string, command: Command): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const label = command.label.toLowerCase();
  const desc = (command.description || '').toLowerCase();

  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  if (desc.includes(q)) return 30;
  return 10;
}

// ─── Static commands ──────────────────────────────────────────────────────────

const STATIC_COMMANDS: Command[] = [
  // Navigate
  { id: 'nav-home', label: 'Dashboard', description: 'Overview and system status', category: 'Navigate', kind: 'navigate', href: '/', icon: '⊞' },
  { id: 'nav-launchpad', label: 'Launchpad', description: 'Onboarding steps and quick start', category: 'Navigate', kind: 'navigate', href: '/launchpad', icon: '⚡' },
  { id: 'nav-chat', label: 'Chat', description: 'Talk to Clawd', category: 'Navigate', kind: 'navigate', href: '/chat', icon: '💬', kbd: ['C'] },
  { id: 'nav-proactivity', label: 'Bridge', description: 'Strategic intelligence hub — now, next, later', category: 'Navigate', kind: 'navigate', href: '/bridge', icon: '◈' },
  { id: 'nav-router', label: 'Router', description: 'Message routing rules', category: 'Navigate', kind: 'navigate', href: '/router', icon: '⇄' },
  { id: 'nav-memory', label: 'Memory', description: 'Workspace memory files', category: 'Navigate', kind: 'navigate', href: '/memory', icon: '◉' },
  { id: 'nav-workspace', label: 'Workspace', description: 'Edit workspace files', category: 'Navigate', kind: 'navigate', href: '/workspace', icon: '◻' },
  { id: 'nav-sessions', label: 'Sessions', description: 'Active agent sessions', category: 'Navigate', kind: 'navigate', href: '/sessions', icon: '◷' },
  { id: 'nav-agents', label: 'Agents', description: 'Agent definitions and status', category: 'Navigate', kind: 'navigate', href: '/agents', icon: '◬' },
  { id: 'nav-settings', label: 'Settings', description: 'Dashboard configuration', category: 'Navigate', kind: 'navigate', href: '/settings', icon: '⚙' },
  { id: 'nav-reports', label: 'Reports', description: 'Sprint, research and analysis reports', category: 'Navigate', kind: 'navigate', href: '/reports', icon: '▤' },
  { id: 'nav-activity', label: 'Activity', description: 'Full activity log from Clawd and agents', category: 'Navigate', kind: 'navigate', href: '/activity', icon: '◎' },
  { id: 'nav-versions', label: 'Versions', description: 'Plugin version tracking', category: 'Navigate', kind: 'navigate', href: '/versions', icon: '⊕' },
  { id: 'nav-jobs', label: 'Jobs', description: 'Scheduled job detail view', category: 'Navigate', kind: 'navigate', href: '/jobs', icon: '◔' },

  // Workspace files
  { id: 'file-soul', label: 'SOUL.md', description: 'Core identity and personality', category: 'Workspace', kind: 'navigate', href: '/workspace?file=SOUL.md', icon: '◈' },
  { id: 'file-memory', label: 'MEMORY.md', description: 'Long-term curated memory', category: 'Workspace', kind: 'navigate', href: '/memory', icon: '◉' },
  { id: 'file-tools', label: 'TOOLS.md', description: 'Tool config and infrastructure notes', category: 'Workspace', kind: 'navigate', href: '/workspace?file=TOOLS.md', icon: '◻' },
  { id: 'file-heartbeat', label: 'HEARTBEAT.md', description: 'Autonomous work loop config', category: 'Workspace', kind: 'navigate', href: '/workspace?file=HEARTBEAT.md', icon: '◷' },
  { id: 'file-agents', label: 'AGENTS.md', description: 'Agent workspace conventions', category: 'Workspace', kind: 'navigate', href: '/workspace?file=AGENTS.md', icon: '◬' },
  { id: 'file-embeddings', label: 'Memory Embeddings', description: 'Configure semantic memory retrieval', category: 'Workspace', kind: 'navigate', href: '/memory/embeddings', icon: '◬' },

  // Actions
  { id: 'action-new-chat', label: 'New Chat', description: 'Start a fresh conversation with Clawd', category: 'Actions', kind: 'action', action: 'new-chat', icon: '＋' },
  { id: 'action-refresh-intel', label: 'Refresh Intelligence Feed', description: 'Run a fresh Brave Search sweep', category: 'Actions', kind: 'action', action: 'refresh-intel', icon: '↻' },
  { id: 'action-overnight-start', label: 'Start Overnight Run', description: 'Execute all queued overnight tasks', category: 'Actions', kind: 'action', action: 'overnight-start', icon: '▶' },
  { id: 'action-overnight-stop', label: 'Stop Overnight Run', description: 'Halt the current overnight execution', category: 'Actions', kind: 'action', action: 'overnight-stop', icon: '◼' },
];

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Recent', 'Navigate', 'Actions', 'Workspace', 'Scheduled Jobs'];

// ─── Local storage for recents ────────────────────────────────────────────────

function getRecentIds(): string[] {
  try { return JSON.parse(localStorage.getItem('cmd-recent') || '[]'); } catch { return []; }
}

function pushRecent(id: string) {
  try {
    const prev = getRecentIds().filter(r => r !== id);
    localStorage.setItem('cmd-recent', JSON.stringify([id, ...prev].slice(0, 5)));
  } catch { /* ignore */ }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dynamicCommands, setDynamicCommands] = useState<Command[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load dynamic commands (cron jobs) when palette opens
  const loadDynamic = useCallback(async () => {
    try {
      const res = await fetch('/api/command');
      if (!res.ok) return;
      const data = await res.json();
      const jobCommands: Command[] = (data.recurring || []).map((job: any) => ({
        id: `job-toggle-${job.id}`,
        label: `${job.enabled ? 'Disable' : 'Enable'}: ${job.name}`,
        description: `${job.schedule} — ${job.enabled ? 'Currently active' : 'Currently disabled'}`,
        category: 'Scheduled Jobs',
        kind: 'action',
        action: 'toggle-job',
        actionPayload: { jobId: job.id, enabled: !job.enabled },
        icon: job.enabled ? '◼' : '▶',
      }));
      setDynamicCommands(jobCommands);
    } catch { /* ignore */ }
  }, []);

  // Open/close
  const openPalette = useCallback(() => {
    setQuery('');
    setSelectedIdx(0);
    setRecentIds(getRecentIds());
    setOpen(true);
    loadDynamic();
  }, [loadDynamic]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setExecuting(null);
  }, []);

  // Global keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => {
          if (prev) { closePalette(); return false; }
          openPalette();
          return false; // openPalette sets it to true via setTimeout
        });
        openPalette();
      }
      if (e.key === 'Escape' && open) {
        closePalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, openPalette, closePalette]);

  // Custom event trigger (e.g. header pill click)
  useEffect(() => {
    const handler = () => openPalette();
    window.addEventListener('superclaw:open-palette', handler);
    return () => window.removeEventListener('superclaw:open-palette', handler);
  }, [openPalette]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build filtered + grouped command list
  const allCommands = [...STATIC_COMMANDS, ...dynamicCommands];

  // Recent commands
  const recentCommands: Command[] = !query
    ? recentIds.flatMap(id => {
        const cmd = allCommands.find(c => c.id === id);
        return cmd ? [{ ...cmd, category: 'Recent' }] : [];
      })
    : [];

  const filteredStatic = query
    ? allCommands.filter(c =>
        fuzzyMatch(query, c.label) || fuzzyMatch(query, c.description || '') || fuzzyMatch(query, c.category)
      ).sort((a, b) => scoreMatch(query, b) - scoreMatch(query, a))
    : allCommands;

  const grouped: Array<{ category: string; commands: Command[] }> = [];

  if (recentCommands.length > 0) {
    grouped.push({ category: 'Recent', commands: recentCommands });
  }

  if (query) {
    // Flat results when searching
    if (filteredStatic.length > 0) {
      grouped.push({ category: 'Results', commands: filteredStatic.slice(0, 12) });
    }
  } else {
    // Grouped results when browsing
    for (const cat of CATEGORY_ORDER) {
      const cmds = filteredStatic.filter(c => c.category === cat);
      if (cmds.length > 0) {
        grouped.push({ category: cat, commands: cmds });
      }
    }
  }

  const flatList = grouped.flatMap(g => g.commands);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(prev => Math.min(prev + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIdx]) executeCommand(flatList[selectedIdx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, selectedIdx, flatList]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  // Execute a command
  const executeCommand = async (cmd: Command) => {
    pushRecent(cmd.id);

    if (cmd.kind === 'navigate' && cmd.href) {
      closePalette();
      router.push(cmd.href);
      return;
    }

    if (cmd.kind === 'external' && cmd.href) {
      closePalette();
      window.open(cmd.href, '_blank');
      return;
    }

    if (cmd.kind === 'action' && cmd.action) {
      setExecuting(cmd.id);
      try {
        await runAction(cmd.action, cmd.actionPayload);
      } finally {
        setTimeout(() => {
          setExecuting(null);
          closePalette();
        }, 800);
      }
    }
  };

  // Action executor
  const runAction = async (action: string, payload?: Record<string, unknown>) => {
    switch (action) {
      case 'new-chat':
        closePalette();
        router.push('/chat');
        break;

      case 'refresh-intel':
        await fetch('/api/proactivity/refresh', { method: 'POST' });
        break;

      case 'overnight-start':
        await fetch('/api/overnight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });
        break;

      case 'overnight-stop':
        await fetch('/api/overnight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop' }),
        });
        break;

      case 'toggle-job':
        if (payload?.jobId !== undefined) {
          await fetch('/api/cron', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: payload.jobId, enabled: payload.enabled }),
          });
          // Reload dynamic commands to reflect new state
          await loadDynamic();
        }
        break;

      default:
        break;
    }
  };

  if (!open) return null;

  // Render
  let listIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={closePalette}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl mx-4 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[60vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
          <svg className="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1">
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-600">
              No commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="py-2">
              {grouped.map(group => (
                <div key={group.category}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    {group.category}
                  </div>
                  {group.commands.map(cmd => {
                    const idx = listIdx++;
                    const isSelected = idx === selectedIdx;
                    const isExecuting = executing === cmd.id;

                    return (
                      <button
                        key={`${group.category}-${cmd.id}`}
                        data-idx={idx}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                          isSelected
                            ? 'bg-orange-500/10 border-l-2 border-orange-500'
                            : 'border-l-2 border-transparent hover:bg-zinc-800/50'
                        }`}
                      >
                        {/* Icon */}
                        <span className={`w-6 text-center text-base flex-shrink-0 ${isSelected ? 'text-orange-400' : 'text-zinc-500'}`}>
                          {cmd.icon || '›'}
                        </span>

                        {/* Label + description */}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                            {isExecuting ? (
                              <span className="text-orange-400">Running...</span>
                            ) : cmd.label}
                          </div>
                          {cmd.description && (
                            <div className="text-xs text-zinc-600 truncate mt-0.5">{cmd.description}</div>
                          )}
                        </div>

                        {/* Kbd hints */}
                        {cmd.kbd && (
                          <div className="flex gap-1 flex-shrink-0">
                            {cmd.kbd.map(k => (
                              <kbd key={k} className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                                {k}
                              </kbd>
                            ))}
                          </div>
                        )}

                        {/* Action indicator */}
                        {cmd.kind === 'action' && !cmd.kbd && (
                          <span className="flex-shrink-0 text-[10px] text-zinc-700 font-mono">run</span>
                        )}
                        {cmd.kind === 'external' && (
                          <svg className="w-3 h-3 text-zinc-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center gap-4 text-[11px] text-zinc-600">
          <span className="flex items-center gap-1.5">
            <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded font-mono text-[10px]">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded font-mono text-[10px]">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded font-mono text-[10px]">esc</kbd>
            close
          </span>
          <span className="ml-auto flex items-center gap-1.5 opacity-60">
            <kbd className="bg-zinc-800 border border-zinc-700 px-1 py-0.5 rounded font-mono text-[10px]">⌘K</kbd>
            anywhere
          </span>
        </div>
      </div>
    </div>
  );
}
