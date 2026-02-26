'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EmbeddingsConfig {
  enabled: boolean;
  provider: 'openai' | 'gemini' | 'voyage' | 'local' | null;
  apiKey: string | null;
  model: string | null;
  syncOnStart: boolean;
  syncWatch: boolean;
  configured: boolean;
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'text-embedding-3-small',
  gemini: 'text-embedding-004',
  voyage: 'voyage-3',
  local: ''
};

const PROVIDER_INFO: Record<string, { name: string; recommended?: boolean }> = {
  openai: { name: 'OpenAI', recommended: true },
  gemini: { name: 'Google Gemini' },
  voyage: { name: 'Voyage AI' },
  local: { name: 'Local (no API key)' }
};

export default function EmbeddingsPage() {
  const [config, setConfig] = useState<EmbeddingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);

  // Form state
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'voyage' | 'local'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODELS.openai);
  const [enabled, setEnabled] = useState(true);
  const [syncOnStart, setSyncOnStart] = useState(true);
  const [syncWatch, setSyncWatch] = useState(true);

  // Load current config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/memory/embeddings');
        if (!res.ok) throw new Error('Failed to fetch config');
        const data: EmbeddingsConfig = await res.json();
        setConfig(data);
        
        // Populate form
        if (data.provider) setProvider(data.provider);
        if (data.model) setModel(data.model);
        setEnabled(data.enabled);
        setSyncOnStart(data.syncOnStart);
        setSyncWatch(data.syncWatch);
        
        // Don't set apiKey from masked value
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Update model when provider changes
  const handleProviderChange = (newProvider: 'openai' | 'gemini' | 'voyage' | 'local') => {
    setProvider(newProvider);
    setModel(DEFAULT_MODELS[newProvider]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    setRestartRequired(false);

    try {
      const res = await fetch('/api/memory/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          model: model || undefined,
          enabled,
          syncOnStart,
          syncWatch
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save config');
      }

      const data = await res.json();
      setSuccess(true);
      setRestartRequired(data.restartRequired);
      
      // Reload config
      const configRes = await fetch('/api/memory/embeddings');
      if (configRes.ok) {
        const configData: EmbeddingsConfig = await configRes.json();
        setConfig(configData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-white text-xl">Loading configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/memory"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-orange-400 transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Memory
          </Link>
          <h1 className="text-3xl font-bold text-orange-400">Memory Embeddings</h1>
          <p className="text-zinc-400 mt-2">
            Configure vector search to make memory retrieval significantly more accurate.
          </p>
        </div>

        {/* Status Banner */}
        {config && (
          <div className={`mb-6 px-4 py-3 rounded-lg border ${
            config.configured
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${config.configured ? 'bg-green-400' : 'bg-orange-400'}`} />
              <span className="font-medium">
                {config.configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            <p className="text-sm mt-1 opacity-90">
              {config.configured
                ? `Memory embeddings are active using ${PROVIDER_INFO[config.provider || 'openai'].name}.`
                : 'Configure an embedding provider to enable smarter memory search.'}
            </p>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg">
            <div className="font-medium">Configuration saved successfully!</div>
            {restartRequired && (
              <p className="text-sm mt-1">OpenClaw will restart to apply changes.</p>
            )}
          </div>
        )}

        {/* Configuration Form */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Embedding Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => handleProviderChange(key as any)}
                  className={`relative px-4 py-3 rounded-lg border transition-all ${
                    provider === key
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-medium">{info.name}</div>
                  {info.recommended && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">
                      Recommended
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Key (hidden for local) */}
          {provider !== 'local' && (
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config?.apiKey ? `Current: ${config.apiKey}` : 'Enter your API key'}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                >
                  {showApiKey ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Leave blank to keep current API key
              </p>
            </div>
          )}

          {/* Model */}
          <div>
            <label className="block text-sm font-medium mb-2">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Enter model name"
              disabled={provider === 'local'}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Default: {DEFAULT_MODELS[provider]}
            </p>
          </div>

          {/* Sync Options */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Sync Options</label>
            
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={syncOnStart}
                onChange={(e) => setSyncOnStart(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-zinc-900"
              />
              <div>
                <div className="text-sm font-medium">Sync on session start</div>
                <p className="text-xs text-zinc-500">Automatically index new memory files when OpenClaw starts</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={syncWatch}
                onChange={(e) => setSyncWatch(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-zinc-900"
              />
              <div>
                <div className="text-sm font-medium">Watch files for changes</div>
                <p className="text-xs text-zinc-500">Monitor memory files and re-index when they change</p>
              </div>
            </label>
          </div>

          {/* Enable Toggle */}
          <div className="pt-4 border-t border-zinc-800">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium">Enable Memory Embeddings</div>
                <p className="text-sm text-zinc-500">Turn on vector search for memory retrieval</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </div>
            </label>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Learn More */}
        <div className="mt-6 text-center">
          <a
            href="https://skunkglobal.com/superclaw/read/1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-orange-400 transition-colors"
          >
            Learn more about memory embeddings
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
