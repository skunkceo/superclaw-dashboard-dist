'use client';

import { useState, useEffect } from 'react';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  nextRun?: string;
  description?: string;
  model?: string | null;
}

interface CronJobModalProps {
  job: CronJob | null;
  onClose: () => void;
  onSave: (jobId: string, updates: Partial<CronJob>) => Promise<void>;
}

export function CronJobModal({ job, onClose, onSave }: CronJobModalProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [model, setModel] = useState('');

  useEffect(() => {
    if (job) {
      setName(job.name || '');
      setDescription(job.description || '');
      setSchedule(job.schedule || '');
      setEnabled(job.enabled !== false);
      setModel(job.model || '');
      setEditing(false);
    }
  }, [job]);

  if (!job) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(job.id, {
        name,
        description,
        schedule,
        enabled,
        model: model || undefined,
      });
      setEditing(false);
    } catch (err) {
      console.error('Failed to save job:', err);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800">
            <h2 className="text-xl font-bold text-white">
              {editing ? 'Edit' : 'View'} Scheduled Job
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Job Name
              </label>
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                  placeholder="e.g., Daily Morning Brief"
                />
              ) : (
                <div className="text-white font-medium">{name}</div>
              )}
            </div>

            {/* Description/Prompt */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Prompt / Message
              </label>
              {editing ? (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500 font-mono text-sm"
                  placeholder="The message or prompt to run..."
                />
              ) : (
                <div className="text-zinc-300 bg-zinc-800 p-3 rounded-lg font-mono text-sm whitespace-pre-wrap">
                  {description || '(No description)'}
                </div>
              )}
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Schedule
              </label>
              {editing ? (
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500 font-mono"
                  placeholder="e.g., 0 7 * * * or Every 30m"
                />
              ) : (
                <div className="text-white font-mono">{schedule}</div>
              )}
              {editing && (
                <p className="text-xs text-zinc-500 mt-1">
                  Cron expression (e.g., <code>0 7 * * *</code> for 7am daily) or interval (e.g., <code>Every 30m</code>)
                </p>
              )}
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Model (Optional)
              </label>
              {editing ? (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500 font-mono"
                  placeholder="e.g., claude-sonnet-4-20250514"
                />
              ) : (
                <div className="text-zinc-400 font-mono">{model || '(use default)'}</div>
              )}
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  disabled={!editing}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-orange-500 focus:ring-orange-500 disabled:opacity-50"
                />
                <span className="text-sm text-zinc-300">Enabled</span>
              </label>
            </div>

            {/* Next Run */}
            {job.nextRun && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Next Run
                </label>
                <div className="text-zinc-400">{job.nextRun}</div>
              </div>
            )}

            {/* Job ID */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Job ID
              </label>
              <div className="text-zinc-500 font-mono text-xs">{job.id}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-zinc-800">
            <div>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-lg font-medium transition-colors"
                >
                  Edit Job
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="px-4 py-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
