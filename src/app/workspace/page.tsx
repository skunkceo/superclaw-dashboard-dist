'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LobsterLogo } from '@/components/LobsterLogo';

interface WorkspaceFile {
  name: string;
  exists: boolean;
}

interface WorkspaceData {
  workspacePath: string;
  files: WorkspaceFile[];
}

interface FileContent {
  filename: string;
  content: string;
  exists?: boolean;
}

function WorkspacePageContent() {
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const searchParams = useSearchParams();
  const agentId = searchParams.get('agent'); // synchronous — no race condition
  const [agentName, setAgentName] = useState<string>('');

  // Pre-select file from URL param on mount
  useEffect(() => {
    const file = searchParams.get('file');
    if (file) setSelectedFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load workspace file list
  useEffect(() => {
    const fetchWorkspaceData = async () => {
      try {
        const url = agentId ? `/api/workspace?agent=${agentId}` : '/api/workspace';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch workspace data');
        const data = await res.json();
        setWorkspaceData(data);
        if (data.agentName) setAgentName(data.agentName);
        
        // Auto-select first existing file (unless ?file= param already set a specific one)
        setSelectedFile(prev => {
          if (prev) return prev; // already set via URL param
          const firstExistingFile = data.files.find((f: WorkspaceFile) => f.exists);
          return firstExistingFile ? firstExistingFile.name : null;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [agentId]);

  // Load selected file content
  useEffect(() => {
    if (!selectedFile) return;

    // Clear stale content immediately so we don't show the previous file while loading
    setFileContent('');
    setOriginalContent('');
    setHasChanges(false);
    setError(null);

    const fetchFileContent = async () => {
      try {
        let url: string;
        // Files with a path separator (e.g. memory/2026-02-24.md) must use the
        // /api/workspace/files?path= endpoint — the [file] route only handles
        // top-level filenames from its allowlist.
        if (selectedFile.includes('/')) {
          const encoded = encodeURIComponent(selectedFile);
          url = agentId
            ? `/api/workspace/files?path=${encoded}&agent=${agentId}`
            : `/api/workspace/files?path=${encoded}`;
        } else {
          url = agentId
            ? `/api/workspace/${selectedFile}?agent=${agentId}`
            : `/api/workspace/${selectedFile}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch file content');
        const data = await res.json();
        const content = data.content ?? '';
        setFileContent(content);
        setOriginalContent(content);
        setHasChanges(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    fetchFileContent();
  }, [selectedFile, agentId]);

  // Check for changes
  useEffect(() => {
    setHasChanges(fileContent !== originalContent);
  }, [fileContent, originalContent]);

  const handleSave = async () => {
    if (!selectedFile) return;

    setSaving(true);
    setError(null);

    try {
      let url: string;
      if (selectedFile.includes('/')) {
        const encoded = encodeURIComponent(selectedFile);
        url = agentId
          ? `/api/workspace/files?path=${encoded}&agent=${agentId}`
          : `/api/workspace/files?path=${encoded}`;
      } else {
        url = agentId
          ? `/api/workspace/${selectedFile}?agent=${agentId}`
          : `/api/workspace/${selectedFile}`;
      }
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: fileContent }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save file');
      }

      setOriginalContent(fileContent);
      setHasChanges(false);
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
          <LobsterLogo className="w-16 h-16 animate-pulse" />
          <div className="text-white text-xl">Loading workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="flex items-center gap-2 text-orange-400 px-6 pt-4">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-sm">Unsaved changes</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 mx-6 mt-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex h-[calc(100vh-88px)]">
        {/* Sidebar - File List */}
        <div className="w-64 bg-zinc-900/30 border-r border-zinc-800 p-4">
          <div className="mb-4">
            {agentName ? (
              <>
                <h2 className="font-semibold text-orange-400">{agentName}</h2>
                <p className="text-xs text-zinc-500 mt-1">Agent Workspace</p>
              </>
            ) : (
              <h2 className="font-semibold text-orange-400">Main Workspace</h2>
            )}
          </div>
          <div className="space-y-2">
            {workspaceData?.files.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file.name)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                  selectedFile === file.name
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : file.exists
                    ? 'hover:bg-zinc-800 text-zinc-300'
                    : 'text-zinc-500 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    file.exists ? 'bg-green-400' : 'bg-zinc-600'
                  }`} />
                  {file.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content - Editor */}
        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              {/* Editor */}
              <div className="flex-1 p-6 relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-mono text-sm text-orange-400">{selectedFile}</h3>

                  </div>
                  {
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        hasChanges && !saving
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  }
                </div>
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}

                  className="w-full h-full bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 text-white font-mono text-sm resize-none focus:outline-none focus:border-orange-500"
                  placeholder={`Edit ${selectedFile}...`}
                  style={{ minHeight: 'calc(100vh - 250px)' }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-zinc-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p>Select a file to edit</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="animate-pulse text-zinc-400">Loading...</div></div>}>
      <WorkspacePageContent />
    </Suspense>
  );
}
