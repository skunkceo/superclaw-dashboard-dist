'use client';

import { useState } from 'react';

interface ModelUsage {
  input: number;
  output: number;
  cost: number;
}

interface TokenProps {
  tokens: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime?: number;
    estimatedCost: number;
    todayCost?: number;
    weekCost?: number;
    byModel?: {
      today?: Record<string, ModelUsage>;
      thisWeek?: Record<string, ModelUsage>;
      thisMonth?: Record<string, ModelUsage>;
    };
  };
  subscription?: {
    provider: string;
    plan: string;
    isSubscription?: boolean;
  } | null;
}

const modelLabels: Record<string, string> = {
  // Normalized model names (from usage-parser)
  'claude-opus-4.0': 'Claude Opus 4.0',
  'claude-opus-4.5': 'Claude Opus 4.5',
  'claude-opus-4.6': 'Claude Opus 4.6',
  'claude-sonnet-4.0': 'Claude Sonnet 4.0',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'claude-haiku-3.5': 'Claude Haiku 3.5',
  'claude-haiku-4.0': 'Claude Haiku 4.0',
  // Legacy/raw model names (for backwards compatibility)
  'claude-opus-4-5-20250514': 'Claude Opus 4.5',
  'claude-opus-4-20250514': 'Claude Opus 4.0',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4.0',
  'claude-sonnet-4-5-20250514': 'Claude Sonnet 4.5',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-haiku-3-5-20241022': 'Claude Haiku 3.5',
  'claude-haiku-4': 'Claude Haiku 4.0',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'unknown': 'Unknown',
};

function getModelLabel(model: string): string {
  if (modelLabels[model]) return modelLabels[model];
  // Try without provider prefix
  const bare = model.replace('anthropic/', '').replace('openai/', '');
  if (modelLabels[bare]) return modelLabels[bare];
  // Build a readable name: claude-sonnet-4-20250514 → Claude Sonnet 4
  const clean = bare
    .replace(/-\d{8}$/, '') // strip date suffix
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
  return clean;
}

export function TokenUsage({ tokens, subscription }: TokenProps) {
  const [showModal, setShowModal] = useState(false);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCost = (num: number) => {
    if (num < 0.01 && num > 0) return '<$0.01';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Get model breakdown for this month
  const monthModels = tokens.byModel?.thisMonth || {};
  const sortedModels = Object.entries(monthModels)
    .filter(([, u]) => ((u as any).total || (u.input + u.output)) > 0)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 4);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Token Usage</h2>
          {subscription && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                {subscription.provider}
              </span>
              <span className="text-xs text-zinc-500">{subscription.plan}</span>
            </div>
          )}
        </div>
        <div className="text-left sm:text-right">
          <div className={`text-xl sm:text-2xl font-bold ${subscription?.isSubscription ? 'text-zinc-400' : 'text-green-400'}`}>
            {formatCost(tokens.estimatedCost)}
          </div>
          <div className="text-xs text-zinc-500 flex items-center justify-start sm:justify-end gap-1">
            <span>{subscription?.isSubscription ? 'equiv. API cost' : 'this month'}</span>
            {subscription?.isSubscription && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-300 transition-colors"
                aria-label="Explain equivalent API cost"
              >
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-mono font-bold text-orange-400">
            {formatNumber(tokens.today)}
          </div>
          <div className="text-xs sm:text-sm text-zinc-400 mt-1">Today</div>
          {tokens.todayCost !== undefined && (
            <div className="text-xs text-zinc-500">{formatCost(tokens.todayCost)}</div>
          )}
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-mono font-bold text-amber-400">
            {formatNumber(tokens.thisWeek)}
          </div>
          <div className="text-xs sm:text-sm text-zinc-400 mt-1">This Week</div>
          {tokens.weekCost !== undefined && (
            <div className="text-xs text-zinc-500">{formatCost(tokens.weekCost)}</div>
          )}
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-mono font-bold text-yellow-400">
            {formatNumber(tokens.thisMonth)}
          </div>
          <div className="text-xs sm:text-sm text-zinc-400 mt-1">This Month</div>
        </div>
      </div>

      {/* Model Breakdown */}
      {sortedModels.length > 0 && (
        <div className="border-t border-zinc-800 pt-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Usage by Model (Month)</h3>
          <div className="space-y-2">
            {sortedModels.map(([model, usage]) => {
              const label = getModelLabel(model);
              const totalTokens = (usage as any).total || (usage.input + usage.output);
              // Calculate as percentage of thisMonth total tokens (not just max of shown models)
              const widthPercent = tokens.thisMonth > 0 ? (totalTokens / tokens.thisMonth) * 100 : 0;
              
              return (
                <div key={model} className="relative">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-zinc-300">{label}</span>
                    <span className="text-zinc-500 font-mono text-xs">
                      {formatNumber(totalTokens)} tokens · {formatCost(usage.cost)}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Time */}
      {tokens.allTime !== undefined && tokens.allTime > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
          <div className="text-sm text-zinc-500">
            All time: <span className="text-zinc-300 font-mono">{formatNumber(tokens.allTime)}</span> tokens
          </div>
        </div>
      )}

      {/* Explanation Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">About Equivalent API Cost</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-300 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm text-zinc-300">
              <p>
                You&apos;re using <strong className="text-white">{subscription?.plan}</strong>, which is a flat-rate subscription, not pay-per-token API billing.
              </p>
              <p>
                The &quot;equivalent API cost&quot; shown here is <strong className="text-white">calculated for tracking purposes only</strong>. It helps you understand how much your usage would cost if you were using standard API billing.
              </p>
              <p className="text-zinc-400 text-xs border-t border-zinc-800 pt-3">
                Your actual charges are based on your flat subscription rate. This dashboard tracks token usage to help you monitor activity and compare efficiency across different models.
              </p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="mt-6 w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
