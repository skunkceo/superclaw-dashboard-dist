'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LobsterLogo } from '@/components/LobsterLogo';

interface MemoryFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDirectory: boolean;
}

interface MemoryData {
  workspacePath: string;
  files: MemoryFile[];
}

interface FileContent {
  filename: string;
  content: string;
  size: number;
  modified: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

function MemoryPageContent() {
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const agentId = searchParams.get('agent'); // synchronous — no race condition
  const [embeddingsConfigured, setEmbeddingsConfigured] = useState<boolean | null>(null);

  // Check embeddings configuration status
  useEffect(() => {
    const fetchEmbeddingsStatus = async () => {
      try {
        const res = await fetch('/api/memory/embeddings');
        if (res.ok) {
          const data = await res.json();
          setEmbeddingsConfigured(data.configured);
        }
      } catch {
        // Silently fail - embeddings status is optional
      }
    };

    fetchEmbeddingsStatus();
  }, []);

  // Load memory file list
  useEffect(() => {
    const fetchMemoryData = async () => {
      try {
        const url = agentId ? `/api/memory?agent=${agentId}` : '/api/memory';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch memory data');
        const data = await res.json();
        setMemoryData(data);
        
        // Auto-select MEMORY.md if it exists, otherwise first file
        const memoryMd = data.files.find((f: MemoryFile) => f.name === 'MEMORY.md');
        if (memoryMd) {
          setSelectedFile(memoryMd.path);
        } else if (data.files.length > 0) {
          setSelectedFile(data.files[0].path);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMemoryData();
  }, [agentId]);

  // Load selected file content
  useEffect(() => {
    if (!selectedFile) {
      setFileContent(null);
      return;
    }

    const fetchFileContent = async () => {
      setLoadingContent(true);
      try {
        const url = agentId ? `/api/memory?agent=${agentId}` : '/api/memory';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: selectedFile })
        });
        if (!res.ok) throw new Error('Failed to fetch file content');
        const data: FileContent = await res.json();
        setFileContent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoadingContent(false);
      }
    };

    fetchFileContent();
  }, [selectedFile, agentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LobsterLogo className="w-16 h-16 animate-pulse" />
          <div className="text-white text-xl">Loading memory files...</div>
        </div>
      </div>
    );
  }

  const selectedFileData = memoryData?.files.find(f => f.path === selectedFile);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 mx-6 mt-4 rounded-lg">
          {error}
        </div>
      )}

      {memoryData && memoryData.files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2">No Memory Files Found</h3>
          <p className="text-zinc-400 text-sm max-w-md">
            Create MEMORY.md or add daily memory files to the memory/ directory in your workspace.
          </p>
        </div>
      ) : (
        <div className="flex" style={{ height: 'calc(100vh - 81px)' }}>
          {/* Sidebar - File List */}
          <div className="w-80 bg-zinc-900/30 border-r border-zinc-800 p-4 overflow-y-auto">

            {/* Memory Embeddings Card — pinned at top */}
            <div className="mb-4 bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm text-white">Memory Embeddings</h3>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${embeddingsConfigured ? 'bg-green-400' : 'bg-orange-400'}`} />
                  <span className={`text-xs ${embeddingsConfigured ? 'text-green-400' : 'text-orange-400'}`}>
                    {embeddingsConfigured ? 'Active' : 'Not set up'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed mb-2.5">
                Vector search makes recall significantly more accurate.
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href="/memory/embeddings"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded transition-colors"
                >
                  Configure
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <a
                  href="https://skunkglobal.com/superclaw/read/1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-500 hover:text-orange-400 transition-colors"
                >
                  Learn more
                </a>
              </div>
            </div>

            <div className="mb-3">
              <h2 className="font-semibold text-orange-400 mb-1">Memory Files</h2>
              <p className="text-xs text-zinc-500">{memoryData?.files.length || 0} files</p>
            </div>
            <div className="space-y-2">
              {memoryData?.files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    selectedFile === file.path
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'hover:bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{file.name}</div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{formatDate(file.modified)}</span>
                      </div>
                    </div>
                    {file.name === 'MEMORY.md' && (
                      <div className="flex-shrink-0 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">
                        Main
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content - File Viewer */}
          <div className="flex-1 flex flex-col">
            {selectedFile && fileContent ? (
              <>
                {/* File Header */}
                <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-mono text-sm text-orange-400">{fileContent.filename}</h3>
                        {selectedFileData && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-xs text-zinc-500">
                              {formatFileSize(selectedFileData.size)}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-xs text-zinc-500">
                              Modified {formatDate(selectedFileData.modified)}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {memoryData?.workspacePath}/{fileContent.filename}
                      </p>
                    </div>
                    <Link
                      href={`/workspace?file=${selectedFile?.split('/').pop() ?? selectedFile}${agentId ? `&agent=${agentId}` : ''}`}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-sm"
                    >
                      Edit in Workspace
                    </Link>
                  </div>
                </div>

                {/* File Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loadingContent ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-zinc-400">Loading content...</span>
                      </div>
                    </div>
                  ) : (
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {fileContent.content || '(empty file)'}
                    </pre>
                  )}
                </div>
              </>
            ) : selectedFile && loadingContent ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-zinc-400">Loading content...</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-zinc-400">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p>Select a file to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MemoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="animate-pulse text-zinc-400">Loading...</div></div>}>
      <MemoryPageContent />
    </Suspense>
  );
}
