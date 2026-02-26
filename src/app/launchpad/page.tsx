'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface LaunchpadData {
  steps: {
    businessProfile: boolean;
    wpSkill: boolean;
    linear: boolean;
    cronJobs: boolean;
    embeddings: boolean;
  };
  cronJobCount: number;
  workspaceFiles: string[];
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepBadge({ number, done }: { number: number; done?: boolean }) {
  return (
    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm border transition-all ${
      done
        ? 'bg-green-500/20 border-green-500/40 text-green-400'
        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
    }`}>
      {done ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        String(number).padStart(2, '0')
      )}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm text-orange-300 max-w-sm">
      <span className="flex-1 truncate">{code}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex-shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

function CTAButton({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-sm font-medium hover:bg-orange-500/20 transition-colors"
      >
        {children}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  }
  return (
    <Link href={href}
      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-sm font-medium hover:bg-orange-500/20 transition-colors"
    >
      {children}
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ─── Business Profile Form ────────────────────────────────────────────────────

function BusinessProfileForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ business: '', whatYouDo: '', painPoints: '', icp: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.business.trim() || !form.whatYouDo.trim()) {
      setError('Business name and description are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const content = `# Business Profile

## Business Name
${form.business}

## What We Do
${form.whatYouDo}

## Pain Points
${form.painPoints || '(not specified)'}

## Ideal Customer Profile (ICP)
${form.icp || '(not specified)'}

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
      const res = await fetch('/api/workspace/business-profile.md', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        onDone();
      } else {
        setError('Failed to save. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 max-w-lg">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Business / product name</label>
        <input
          type="text" value={form.business}
          onChange={e => setForm(p => ({ ...p, business: e.target.value }))}
          placeholder="e.g. Skunk Global"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">What you do (1-2 sentences)</label>
        <textarea
          value={form.whatYouDo}
          onChange={e => setForm(p => ({ ...p, whatYouDo: e.target.value }))}
          placeholder="e.g. We build WordPress plugins that replace expensive SaaS tools..."
          rows={2}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Key pain points you solve</label>
        <textarea
          value={form.painPoints}
          onChange={e => setForm(p => ({ ...p, painPoints: e.target.value }))}
          placeholder="e.g. Small businesses pay too much for disconnected SaaS tools..."
          rows={2}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Ideal Customer Profile (ICP)</label>
        <textarea
          value={form.icp}
          onChange={e => setForm(p => ({ ...p, icp: e.target.value }))}
          placeholder="e.g. Indie WordPress developers, small agencies, solopreneurs..."
          rows={2}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-orange-500 text-black font-semibold rounded-lg text-sm hover:bg-orange-400 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LaunchpadPage() {
  const [data, setData] = useState<LaunchpadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [profileDone, setProfileDone] = useState(false);

  const fetchData = async () => {
    const res = await fetch('/api/launchpad');
    if (res.ok) {
      const d = await res.json();
      setData(d);
      if (d.steps.businessProfile) setProfileDone(true);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (n: number) => setExpandedStep(prev => prev === n ? null : n);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-600 text-sm">Loading launchpad...</div>
      </div>
    );
  }

  const s = data?.steps;
  const completedCount = [
    profileDone || s?.businessProfile,
    s?.wpSkill,
    s?.linear,
    false, // step 4 — manual
    s?.cronJobs,
    s?.embeddings,
    false, // step 7 — manual
    false, // step 8 — always a link
  ].filter(Boolean).length;

  const steps = [
    {
      n: 1,
      title: 'Tell Clawd about your business',
      subtitle: 'Sets the context for proactivity, suggestions, and briefings',
      done: profileDone || !!s?.businessProfile,
      content: (profileDone || s?.businessProfile) ? (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Business profile saved. Clawd has the context it needs.
          </div>
          <button
            onClick={() => setProfileDone(false)}
            className="mt-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Update profile
          </button>
        </div>
      ) : (
        <BusinessProfileForm onDone={() => { setProfileDone(true); fetchData(); }} />
      ),
    },
    {
      n: 2,
      title: 'Install the WordPress Studio skill',
      subtitle: 'Gives Clawd the ability to manage your WordPress sites directly from the CLI',
      done: !!s?.wpSkill,
      content: (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-zinc-500">Run this in your terminal to install the skill:</p>
          <CodeBlock code="skunk install wp-studio" />
          <p className="text-xs text-zinc-600 mt-2">
            Or use the full CLI: <span className="font-mono">openclaw skills install wp-cli</span>
          </p>
          {s?.wpSkill && (
            <p className="text-xs text-green-400 mt-1">Skill detected — you are good to go.</p>
          )}
        </div>
      ),
    },
    {
      n: 3,
      title: 'Connect Linear for project management',
      subtitle: 'Free to connect. Clawd can create issues, update sprints, and track initiatives automatically',
      done: !!s?.linear,
      content: (
        <div className="mt-3 space-y-2">
          {s?.linear ? (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Linear is connected.
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-500">Install the Linear skill then add your API key:</p>
              <CodeBlock code="skunk install linear" />
              <p className="text-xs text-zinc-600 mt-1">
                Get your API key at <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">linear.app/settings/api</a>
              </p>
            </>
          )}
          {s?.linear && (
            <CTAButton href="/agents">View your team in Agents</CTAButton>
          )}
        </div>
      ),
    },
    {
      n: 4,
      title: 'Chat with Clawd to populate your project board',
      subtitle: 'Describe your goals and Clawd will create initiatives, projects, and first issues in Linear',
      done: false,
      content: (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-zinc-500">Start a conversation and tell Clawd what you are building and where you want to be in 90 days.</p>
          <CTAButton href="/chat">Open Chat</CTAButton>
        </div>
      ),
    },
    {
      n: 5,
      title: 'Configure your scheduled jobs',
      subtitle: 'Tell Clawd in plain English what you want automated — briefings, reports, research, monitoring',
      done: !!s?.cronJobs,
      content: (
        <div className="mt-3 space-y-2">
          {s?.cronJobs ? (
            <>
              <p className="text-xs text-green-400">{data?.cronJobCount} active job{data?.cronJobCount !== 1 ? 's' : ''} running.</p>
              <CTAButton href="/bridge">View Scheduled Jobs</CTAButton>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-500">
                Ask Clawd to set up a daily brief, SEO report, or competitor monitor. You can also edit jobs directly from the dashboard.
              </p>
              <div className="flex gap-3 mt-1">
                <CTAButton href="/chat">Ask Clawd to set up jobs</CTAButton>
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      n: 6,
      title: 'Decide how Clawd retrieves memory',
      subtitle: 'Simple file scanning works out of the box. Memory embeddings make recall significantly more accurate',
      done: !!s?.embeddings,
      content: (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-zinc-500">
            By default, Clawd scans memory files with keyword matching. Embeddings give it semantic recall — it finds what you mean, not just what you typed.
          </p>
          <CTAButton href="/memory/embeddings">Configure Memory Embeddings</CTAButton>
        </div>
      ),
    },
    {
      n: 7,
      title: 'Build your first landing page in natural language',
      subtitle: 'Describe the page you want and Clawd will generate it, ready to publish on your WordPress site',
      done: false,
      content: (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-zinc-500">
            Try something like: <em className="text-zinc-400">"Create a landing page for SkunkForms with a hero, features section, and pricing table"</em>
          </p>
          <CTAButton href="/chat">Open Chat</CTAButton>
        </div>
      ),
    },
    {
      n: 8,
      title: 'Go deeper with the SuperClaw guide',
      subtitle: 'Not a full guide — just the next steps to get the most out of your setup',
      done: false,
      content: (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-zinc-500">
            The guide covers memory tuning, agent routing, overnight mode strategy, and using SuperClaw to run autonomous growth tasks while you are at your day job.
          </p>
          <CTAButton href="https://skunkglobal.com/superclaw/read/1" external>
            Read the SuperClaw Guide
          </CTAButton>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/" className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-white">Launchpad</h1>
          </div>
          <p className="text-sm text-zinc-500 mb-5 ml-7">
            Everything you need to start, scale, and grow with Clawd.
          </p>

          {/* Progress bar */}
          <div className="ml-7">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
              <span>{completedCount} of {steps.length} steps complete</span>
              <span>{Math.round((completedCount / steps.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.n}
              className={`border rounded-xl transition-all ${
                step.done
                  ? 'border-zinc-800 bg-zinc-900/30'
                  : expandedStep === step.n
                  ? 'border-orange-500/30 bg-orange-500/5'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              }`}
            >
              <button
                onClick={() => toggle(step.n)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <StepBadge number={step.n} done={step.done} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${step.done ? 'text-zinc-500 line-through' : 'text-white'}`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{step.subtitle}</div>
                </div>
                <svg
                  className={`w-4 h-4 flex-shrink-0 text-zinc-600 transition-transform ${expandedStep === step.n ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedStep === step.n && (
                <div className="px-5 pb-5 ml-14">
                  {step.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-8 border-t border-zinc-800 text-center">
          <p className="text-xs text-zinc-600">
            Need help with any step? <Link href="/chat" className="text-orange-400 hover:underline">Ask Clawd in chat</Link> or{' '}
            <a href="https://skunkglobal.com/superclaw/read/1" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">read the guide</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
