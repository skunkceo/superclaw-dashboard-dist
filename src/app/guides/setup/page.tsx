import Link from 'next/link';

export default function SetupGuide() {
  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <Link href="/guides" className="hover:text-zinc-300 transition-colors">Guides</Link>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-zinc-300">SuperClaw Setup</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">Getting Started</span>
            <span className="text-xs text-zinc-500">10 min read</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">SuperClaw Setup</h1>
          <p className="text-zinc-400 leading-relaxed">
            Get SuperClaw running with OpenClaw, configure your first agent, and start automating your workflow.
          </p>
        </div>

        {/* Prerequisites */}
        <div className="mb-10 bg-zinc-800/50 border border-zinc-700 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-3">Prerequisites</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Node.js 18 or later
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              OpenClaw installed (<code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300">npm install -g openclaw</code>)
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              An Anthropic API key or Claude.ai subscription
            </li>
          </ul>
        </div>

        {/* Steps */}
        <div className="space-y-10">

          {/* Step 1 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h2 className="text-lg font-semibold text-white">Install the SuperClaw CLI</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>The SuperClaw CLI scaffolds and manages your dashboard installation.</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-orange-300">
                npm install -g @skunkceo/cli
              </div>
              <p>Verify it installed correctly:</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-orange-300">
                superclaw --version
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">2</span>
              <h2 className="text-lg font-semibold text-white">Run the setup wizard</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>The setup wizard installs the dashboard, creates your admin account, and connects OpenClaw.</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-orange-300">
                superclaw setup
              </div>
              <p>Follow the prompts. When asked for a port, the default (<code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300">3050</code>) works for most setups.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
              <h2 className="text-lg font-semibold text-white">Configure your first agent</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>Agents are named OpenClaw sessions with their own identity, memory, and skillset. To set them up:</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-orange-300">
                superclaw setup agents
              </div>
              <p>This creates agent config files in your OpenClaw workspace. Each agent gets its own <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300">AGENTS.md</code> and <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300">MEMORY.md</code>.</p>
            </div>
          </div>

          {/* Step 4 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">4</span>
              <h2 className="text-lg font-semibold text-white">Start the dashboard</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>Start SuperClaw in the background (recommended via PM2 for production):</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-orange-300">
                superclaw start
              </div>
              <p>Or manually with PM2:</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-orange-300">
                pm2 start "npm start" --name superclaw-dashboard
              </div>
              <p>Open <strong className="text-zinc-200">http://localhost:3050</strong> (or your configured port) and log in with the admin credentials you created during setup.</p>
            </div>
          </div>

          {/* Step 5 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">5</span>
              <h2 className="text-lg font-semibold text-white">Connect integrations</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>Head to <Link href="/settings" className="text-orange-400 hover:text-orange-300">Settings</Link> to connect:</p>
              <ul className="space-y-2 mt-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                  <span><strong className="text-zinc-300">Google Analytics</strong> — paste your service account JSON key (<Link href="/guides/google-service-account" className="text-orange-400 hover:text-orange-300">setup guide</Link>)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                  <span><strong className="text-zinc-300">Linear</strong> — add your API key to sync issues and sprints</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                  <span><strong className="text-zinc-300">Slack</strong> — configure via the OpenClaw gateway for chat-based commands</span>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Footer nav */}
        <div className="mt-10 pt-6 border-t border-zinc-800 flex items-center justify-between">
          <Link href="/guides" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All guides
          </Link>
          <Link href="/guides/google-service-account" className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors font-medium">
            Next: Google Service Account
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

      </div>
    </div>
  );
}
