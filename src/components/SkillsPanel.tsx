'use client';

import { useState } from 'react';
import Link from 'next/link';

// Skills that require manual setup in the OpenClaw gateway config (can't be toggled freely)
const SETUP_REQUIRED: Record<string, { instructions: string; settingsPath?: string }> = {
  'email': {
    instructions: 'Email requires IMAP/SMTP credentials in your OpenClaw config. Run: openclaw gateway config.get — then add an "email" channel block with your host, port, username, and app password. Restart OpenClaw when done.',
  },
  'calendar': {
    instructions: 'Google Calendar requires OAuth setup in your OpenClaw config. Add a "calendar" channel block with your Google OAuth credentials, or use a service account. Run: openclaw gateway config.get to see current config.',
  },
};

interface Skill {
  name: string;
  enabled: boolean;
  description: string;
}

interface SkillsProps {
  skills: Skill[];
}

interface SetupToast {
  skillName: string;
  instructions: string;
  settingsPath?: string;
}

export function SkillsPanel({ skills: initialSkills }: SkillsProps) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [toggling, setToggling] = useState<string | null>(null);
  const [setupToast, setSetupToast] = useState<SetupToast | null>(null);
  const [toastFading, setToastFading] = useState(false);

  const enabledCount = skills.filter(s => s.enabled).length;

  const handleToggle = async (skill: Skill) => {
    if (toggling) return;
    const key = skill.name.toLowerCase();

    // Check if this skill needs setup to be enabled
    if (!skill.enabled && SETUP_REQUIRED[key]) {
      const setup = SETUP_REQUIRED[key];
      setSetupToast({ skillName: skill.name, ...setup });
      return;
    }

    setToggling(skill.name);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(key)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !skill.enabled }),
      });
      const data = await res.json();

      if (data.needsSetup) {
        setSetupToast({
          skillName: skill.name,
          instructions: data.instructions,
          settingsPath: data.settingsPath,
        });
      } else if (data.success) {
        setSkills(prev => prev.map(s =>
          s.name === skill.name ? { ...s, enabled: data.enabled } : s
        ));
      }
    } catch {
      // fail silently — UI stays as-is
    } finally {
      setToggling(null);
    }
  };

  const closeToast = () => {
    setToastFading(true);
    setTimeout(() => { setSetupToast(null); setToastFading(false); }, 200);
  };

  return (
    <>
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
          <h2 className="text-base sm:text-lg font-semibold">Skills &amp; Capabilities</h2>
          <span className="text-xs sm:text-sm text-zinc-400">
            {enabledCount} of {skills.length} enabled
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {skills.map((skill) => {
            const isToggling = toggling === skill.name;
            const needsSetup = !skill.enabled && SETUP_REQUIRED[skill.name.toLowerCase()];
            return (
              <div
                key={skill.name}
                className={`p-3 sm:p-4 rounded-lg border transition ${
                  skill.enabled
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-zinc-800/50 border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="font-medium text-sm sm:text-base flex-1 truncate">{skill.name}</div>
                  <button
                    onClick={() => handleToggle(skill)}
                    disabled={isToggling}
                    title={needsSetup ? 'Requires setup — click for instructions' : skill.enabled ? 'Disable' : 'Enable'}
                    className={`w-7 h-4 sm:w-8 sm:h-5 rounded-full relative transition flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 focus:ring-offset-zinc-900 ${
                      isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                    } ${skill.enabled ? 'bg-orange-500' : needsSetup ? 'bg-zinc-600 ring-1 ring-zinc-500' : 'bg-zinc-600'}`}
                  >
                    <div className={`absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white top-0.5 transition-all ${
                      skill.enabled ? 'left-3 sm:left-3.5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-zinc-400 line-clamp-2">{skill.description}</div>
                {needsSetup && (
                  <button
                    onClick={() => handleToggle(skill)}
                    className="text-xs text-orange-400 mt-1.5 hover:text-orange-300 transition-colors"
                  >
                    Setup required
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 sm:mt-6 text-center">
          <Link
            href="/skills"
            className="w-full sm:w-auto px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition inline-block text-sm sm:text-base"
          >
            Browse More Skills
          </Link>
        </div>
      </div>

      {/* Setup instructions panel */}
      {setupToast && (
        <div className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 transition-opacity ${toastFading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-sm font-semibold text-white">Enable {setupToast.skillName}</div>
              <button onClick={closeToast} className="text-zinc-500 hover:text-zinc-300 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-zinc-400 mb-3 leading-relaxed">{setupToast.instructions}</p>
            {setupToast.settingsPath && (
              <Link
                href={setupToast.settingsPath}
                onClick={closeToast}
                className="inline-block px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition"
              >
                Go to Settings
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
