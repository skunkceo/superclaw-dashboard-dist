'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ScaffoldResult {
  label: string;
  created: string[];
}

interface ScaffoldResponse {
  success: boolean;
  scaffolded: ScaffoldResult[];
  errors: string[];
  gatewayConnected: boolean;
  workspace: string;
}

export default function SetupWizardPage() {
  const [step, setStep] = useState(1);
  const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleScaffold = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setup/scaffold', {
        method: 'POST',
      });
      const data = await response.json();
      setScaffoldResult(data);
    } catch (error) {
      console.error('Scaffold failed:', error);
      setScaffoldResult({
        success: false,
        scaffolded: [],
        errors: ['Failed to connect to API'],
        gatewayConnected: false,
        workspace: '',
      });
    } finally {
      setLoading(false);
    }
  };

  const getTotalAgentsConfigured = () => {
    if (!scaffoldResult) return 0;
    return scaffoldResult.scaffolded.length;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Step Indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    s === step
                      ? 'bg-orange-500 text-black'
                      : s < step
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {s < step ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-colors ${
                      s < step ? 'bg-orange-500/20' : 'bg-zinc-800'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div>
              <h1 className="text-3xl font-bold mb-4">Welcome to SuperClaw</h1>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Let's make sure everything is configured correctly. This will only take a moment.
              </p>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
              >
                Start Setup
              </button>
            </div>
          )}

          {/* Step 2: Workspace Check */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Workspace Check</h2>
              
              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Workspace Path
                  </label>
                  <div className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg font-mono text-sm text-zinc-300">
                    {process.env.NEXT_PUBLIC_OPENCLAW_WORKSPACE || '/root/.openclaw/workspace'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Gateway Status
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-zinc-500 animate-pulse" />
                    <span className="text-sm text-zinc-400">
                      Will be checked in next step
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setStep(3);
                  handleScaffold();
                }}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 3: Agent Scaffolding */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Agent Scaffolding</h2>

              {loading && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-zinc-400">Setting up agent workspace...</span>
                </div>
              )}

              {!loading && scaffoldResult && (
                <div className="space-y-6 mb-8">
                  {/* Gateway Status */}
                  <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          scaffoldResult.gatewayConnected ? 'bg-green-400' : 'bg-red-400'
                        }`}
                      />
                      <span className="font-medium">
                        Gateway {scaffoldResult.gatewayConnected ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    {!scaffoldResult.gatewayConnected && (
                      <p className="text-sm text-zinc-400 ml-6">
                        OpenClaw gateway not detected — agents won't be able to run tasks
                      </p>
                    )}
                  </div>

                  {/* Scaffolded Agents */}
                  {scaffoldResult.scaffolded.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-3">Agent Configuration</h3>
                      <div className="space-y-3">
                        {scaffoldResult.scaffolded.map((agent) => (
                          <div
                            key={agent.label}
                            className="p-4 bg-zinc-800 rounded-lg border border-zinc-700"
                          >
                            <div className="flex items-start gap-3">
                              <svg
                                className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div className="flex-1">
                                <div className="font-medium mb-1">{agent.label}</div>
                                <div className="text-sm text-zinc-400">
                                  Created: {agent.created.join(', ')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No changes needed */}
                  {scaffoldResult.scaffolded.length === 0 && scaffoldResult.errors.length === 0 && (
                    <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 text-center">
                      <div className="text-zinc-400">Already configured</div>
                      <div className="text-sm text-zinc-500 mt-1">
                        All agent workspaces are set up
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {scaffoldResult.errors.length > 0 && (
                    <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                      <div className="font-medium text-red-400 mb-2">Errors</div>
                      <ul className="text-sm text-red-400 space-y-1">
                        {scaffoldResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!loading && scaffoldResult && (
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
                >
                  Continue
                </button>
              )}
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && scaffoldResult && (
            <div>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold mb-4">You're all set</h2>
                <p className="text-zinc-400">
                  {getTotalAgentsConfigured()} agent{getTotalAgentsConfigured() !== 1 ? 's' : ''}{' '}
                  configured, gateway {scaffoldResult.gatewayConnected ? 'connected' : 'not connected'}
                </p>
              </div>

              <div className="flex gap-4 justify-center">
                <Link
                  href="/"
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/agents"
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition-colors"
                >
                  View Agents
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
