'use client';

import Link from 'next/link';

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-sm mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            SuperClaw Pro
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
            Unlock the Full Power of SuperClaw
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Multi-agent workflows, advanced routing, team collaboration, and priority support.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Smart Router */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Smart Router</h3>
            <p className="text-zinc-400 text-sm">
              Automatically route messages to specialized agents based on keywords, channels, and context. No more manual assignment.
            </p>
          </div>

          {/* Multi-Agent System */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Specialized Agents</h3>
            <p className="text-zinc-400 text-sm">
              Create domain-specific agents (MarTech, CRM Engineer, SEO Specialist) with isolated memory and repo access.
            </p>
          </div>

          {/* Ephemeral Sandboxes */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Ephemeral Sandboxes</h3>
            <p className="text-zinc-400 text-sm">
              Agents work in isolated git worktrees, commit to branches, and auto-cleanup after merge. 10x faster parallel development.
            </p>
          </div>

          {/* Task Management */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Visual Task Management</h3>
            <p className="text-zinc-400 text-sm">
              Create, assign, and track tasks across agents. Monitor progress, view agent workload, and manage priorities from one dashboard.
            </p>
          </div>

          {/* Command Palette */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Command Palette</h3>
            <p className="text-zinc-400 text-sm">
              Quick access to any action with keyboard shortcuts. Search agents, tasks, repos, and commands instantly.
            </p>
          </div>

          {/* Priority Support */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Priority Support</h3>
            <p className="text-zinc-400 text-sm">
              Direct access to the SuperClaw team. Bug fixes, feature requests, and custom integrations prioritized.
            </p>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Free Tier */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <div className="text-4xl font-bold mb-2">$0</div>
              <div className="text-zinc-400 text-sm">Forever free</div>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>5 standard agents</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Basic agent configuration</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Manual message routing</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Memory browser</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Community support</span>
              </li>
            </ul>

            <div className="px-6 py-2 bg-zinc-800 rounded-lg text-center text-zinc-400 text-sm">
              Current Plan
            </div>
          </div>

          {/* Pro Tier - Highlighted */}
          <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-xl border-2 border-orange-500/50 p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full text-xs font-bold text-white">
              LAUNCH OFFER
            </div>
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-2">$5<span className="text-lg text-zinc-400">/month</span></div>
              <div className="text-zinc-400 text-sm">or $99 lifetime</div>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Unlimited specialized agents</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Smart routing engine</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Ephemeral sandboxes</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Advanced task management</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Command palette</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Priority support</span>
              </li>
            </ul>

            <div className="space-y-3">
              <a
                href="https://skunkglobal.com/superclaw-dashboard-pro/checkout?plan=monthly"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg font-semibold text-white text-center transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"
              >
                Get Pro Monthly
              </a>
              <a
                href="https://skunkglobal.com/superclaw-dashboard-pro/checkout?plan=lifetime"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-semibold text-white text-center transition-all"
              >
                Get Pro Lifetime
              </a>
            </div>
          </div>

          {/* Enterprise Tier */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <div className="text-4xl font-bold mb-2">Custom</div>
              <div className="text-zinc-400 text-sm">Contact us</div>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Everything in Pro</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Team collaboration</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>SSO & advanced auth</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Dedicated support</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Custom integrations</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>SLA guarantee</span>
              </li>
            </ul>

            <a
              href="mailto:hello@skunkglobal.com?subject=SuperClaw Enterprise"
              className="block px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold text-white text-center transition-all"
            >
              Contact Sales
            </a>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <details className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
              <summary className="font-semibold cursor-pointer">What's included in the free version?</summary>
              <p className="text-zinc-400 mt-3 text-sm">
                The free version includes the core SuperClaw dashboard, basic agent configuration (5 standard agents), manual message routing, and community support.
              </p>
            </details>
            <details className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
              <summary className="font-semibold cursor-pointer">Can I cancel anytime?</summary>
              <p className="text-zinc-400 mt-3 text-sm">
                Yes! Cancel anytime from your account settings. No questions asked. Your Pro features will remain active until the end of your billing period.
              </p>
            </details>
            <details className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
              <summary className="font-semibold cursor-pointer">How does the sandbox system work?</summary>
              <p className="text-zinc-400 mt-3 text-sm">
                Agents create ephemeral git worktrees (isolated working directories) for each task. They work in parallel, commit to branches, and sandboxes auto-cleanup after PR merge. This enables 5-10x faster development with zero file conflicts.
              </p>
            </details>
            <details className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <summary className="font-semibold cursor-pointer">Do I need OpenClaw?</summary>
              <p className="text-zinc-400 mt-3 text-sm">
                Yes, SuperClaw is a dashboard and management layer for OpenClaw. You need OpenClaw installed and running. SuperClaw makes OpenClaw easier to use with visual tools, multi-agent workflows, and advanced automation.
              </p>
            </details>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="text-center">
          <Link href="/" className="text-zinc-400 hover:text-white transition">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
