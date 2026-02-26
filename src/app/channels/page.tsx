'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LobsterLogo } from '@/components/LobsterLogo';

// All available channels
const availableChannels = [
  { 
    id: 'whatsapp', 
    name: 'WhatsApp', 
    description: 'Connect via Baileys (no business account needed)',
    category: 'Messaging',
    docs: 'https://docs.clawd.bot/channels/whatsapp',
    difficulty: 'Easy',
    icon: '💬',
  },
  { 
    id: 'telegram', 
    name: 'Telegram', 
    description: 'Bot API via grammY framework',
    category: 'Messaging',
    docs: 'https://docs.clawd.bot/channels/telegram',
    difficulty: 'Easy',
    icon: '✈️',
  },
  { 
    id: 'slack', 
    name: 'Slack', 
    description: 'Slack app via Bolt SDK',
    category: 'Work',
    docs: 'https://docs.clawd.bot/channels/slack',
    difficulty: 'Medium',
    icon: '💼',
  },
  { 
    id: 'discord', 
    name: 'Discord', 
    description: 'Discord bot via discord.js',
    category: 'Gaming',
    docs: 'https://docs.clawd.bot/channels/discord',
    difficulty: 'Easy',
    icon: '🎮',
  },
  { 
    id: 'googlechat', 
    name: 'Google Chat', 
    description: 'Google Workspace Chat API',
    category: 'Work',
    docs: 'https://docs.clawd.bot/channels/googlechat',
    difficulty: 'Medium',
    icon: '🔵',
  },
  { 
    id: 'signal', 
    name: 'Signal', 
    description: 'End-to-end encrypted via signal-cli',
    category: 'Messaging',
    docs: 'https://docs.clawd.bot/channels/signal',
    difficulty: 'Advanced',
    icon: '🔐',
  },
  { 
    id: 'imessage', 
    name: 'iMessage', 
    description: 'macOS-only via imsg CLI',
    category: 'Apple',
    docs: 'https://docs.clawd.bot/channels/imessage',
    difficulty: 'Medium',
    icon: '🍎',
  },
  { 
    id: 'bluebubbles', 
    name: 'BlueBubbles', 
    description: 'iMessage from any platform (extension)',
    category: 'Apple',
    docs: 'https://docs.clawd.bot/channels/bluebubbles',
    difficulty: 'Advanced',
    icon: '💙',
  },
  { 
    id: 'msteams', 
    name: 'Microsoft Teams', 
    description: 'Teams app integration (extension)',
    category: 'Work',
    docs: 'https://docs.clawd.bot/channels/msteams',
    difficulty: 'Medium',
    icon: '🟣',
  },
  { 
    id: 'matrix', 
    name: 'Matrix', 
    description: 'Decentralized chat protocol (extension)',
    category: 'Open Source',
    docs: 'https://docs.clawd.bot/channels/matrix',
    difficulty: 'Medium',
    icon: '🟢',
  },
  { 
    id: 'zalo', 
    name: 'Zalo', 
    description: 'Vietnam popular messaging (extension)',
    category: 'Regional',
    docs: 'https://docs.clawd.bot/channels/zalo',
    difficulty: 'Medium',
    icon: '🇻🇳',
  },
  { 
    id: 'webchat', 
    name: 'WebChat', 
    description: 'Embed chat widget on any website',
    category: 'Web',
    docs: 'https://docs.clawd.bot/web/webchat',
    difficulty: 'Easy',
    icon: '🌐',
  },
  { 
    id: 'voice', 
    name: 'Voice Calls', 
    description: 'macOS/iOS/Android voice integration',
    category: 'Voice',
    docs: 'https://docs.clawd.bot/channels',
    difficulty: 'Advanced',
    icon: '🎙️',
  },
  { 
    id: 'canvas', 
    name: 'Canvas', 
    description: 'Render live UI on paired devices',
    category: 'Display',
    docs: 'https://docs.clawd.bot/channels',
    difficulty: 'Advanced',
    icon: '🖥️',
  },
];

const categories = ['All', 'Messaging', 'Work', 'Gaming', 'Apple', 'Open Source', 'Regional', 'Web', 'Voice', 'Display'];
const difficulties = ['All', 'Easy', 'Medium', 'Advanced'];

export default function ChannelsPage() {
  const [filter, setFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [connectedChannels, setConnectedChannels] = useState<string[]>([]);

  useEffect(() => {
    // Fetch connected channels from API
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.setup?.channels) {
          setConnectedChannels(data.setup.channels.map((c: string) => c.toLowerCase()));
        }
      })
      .catch(() => {
        // Default to showing Slack as connected for demo
        setConnectedChannels(['slack']);
      });
  }, []);

  const filteredChannels = availableChannels.filter(channel => {
    const matchesCategory = filter === 'All' || channel.category === filter;
    const matchesDifficulty = difficultyFilter === 'All' || channel.difficulty === difficultyFilter;
    return matchesCategory && matchesDifficulty;
  });

  const connectedCount = availableChannels.filter(c => connectedChannels.includes(c.id)).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
              <LobsterLogo className="w-12 h-12" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                  Superclaw
                </h1>
                <p className="text-sm text-zinc-400">Available Channels</p>
              </div>
            </Link>
          </div>
          <Link 
            href="/"
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Connect Your Channels</h2>
              <p className="text-zinc-400">
                OpenClaw can answer you on any of these platforms. Connect multiple channels to reach your AI from anywhere.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-400">{connectedCount}/{availableChannels.length}</div>
              <div className="text-sm text-zinc-500">connected</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <span className="text-zinc-500 py-2">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === cat 
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          <span className="text-zinc-500 py-2">Difficulty:</span>
          {difficulties.map((diff) => (
            <button
              key={diff}
              onClick={() => setDifficultyFilter(diff)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                difficultyFilter === diff 
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChannels.map((channel) => {
            const isConnected = connectedChannels.includes(channel.id);
            return (
              <div 
                key={channel.id}
                className={`p-5 rounded-xl border transition ${
                  isConnected
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{channel.icon}</span>
                    <div>
                      <div className="font-semibold text-lg">{channel.name}</div>
                      <div className="text-xs text-zinc-500">{channel.category}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    isConnected 
                      ? 'bg-green-500/20 text-green-400' 
                      : channel.difficulty === 'Easy'
                        ? 'bg-blue-500/20 text-blue-400'
                        : channel.difficulty === 'Medium'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                  }`}>
                    {isConnected ? 'Connected' : channel.difficulty}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-4">{channel.description}</p>
                <div className="flex gap-2">
                  {!isConnected && (
                    <a 
                      href={channel.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition text-center"
                    >
                      Connect
                    </a>
                  )}
                  <a 
                    href={channel.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition ${isConnected ? 'flex-1 text-center' : ''}`}
                  >
                    Docs
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
