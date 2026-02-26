'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LobsterLogo } from '@/components/LobsterLogo';

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Live agent monitoring',
    desc: 'See which agents are active, what they\'re working on, and review completed tasks in real time.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Traffic and Search Console',
    desc: 'GA4 and GSC data in one place — sessions, organic impressions, and per-site breakdowns.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Smart model routing',
    desc: 'Route different tasks to different models automatically based on cost and complexity.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Scheduled jobs',
    desc: 'View and manage all cron jobs running in your OpenClaw gateway — edit, pause, or trigger on demand.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Reports and memory',
    desc: 'Agents write structured reports here. Review, search, and action them with interactive checklists.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Workspace and memory browser',
    desc: 'Browse your agent workspace files, memory logs, and SOUL.md directly from the dashboard.',
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check if setup has been completed since page loaded
    const poll = setInterval(() => {
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          if (d.authenticated) {
            clearInterval(poll);
            router.push('/');
          } else if (!d.needsSetup) {
            // User exists but not logged in — go to login
            clearInterval(poll);
            router.push('/login');
          }
        })
        .catch(() => {});
    }, 3000);

    // Fade in
    setTimeout(() => setReady(true), 50);

    return () => clearInterval(poll);
  }, [router]);

  return (
    <div
      className="min-h-screen bg-zinc-950 text-white flex flex-col"
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.4s ease' }}
    >
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8 text-center">
        <div className="mb-6">
          <LobsterLogo className="w-20 h-20 mx-auto" />
        </div>

        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          Welcome to SuperClaw
        </h1>
        <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
          Your OpenClaw command centre. Monitor agents, review reports, manage jobs,
          and connect your data — all in one place.
        </p>

        {/* Setup instruction */}
        <div className="mt-10 bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full text-left">
          <p className="text-sm font-medium text-zinc-300 mb-3">
            To get started, create your admin account:
          </p>
          <div className="bg-zinc-800 rounded-lg px-4 py-3 font-mono text-sm text-orange-400 mb-3 select-all">
            superclaw setup
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Run this in your terminal, follow the prompts, then come back here.
            This page will update automatically once your account is ready.
          </p>
        </div>

        {/* Or link to login if account exists */}
        <p className="mt-5 text-sm text-zinc-600">
          Already set up?{' '}
          <button
            onClick={() => router.push('/login')}
            className="text-orange-400 hover:text-orange-300 transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>

      {/* Features grid */}
      <div className="max-w-4xl mx-auto w-full px-6 pb-16">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest text-center mb-6">
          What you get
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <div className="text-orange-400 mb-2">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
