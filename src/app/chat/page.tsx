'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { LobsterLogo } from '@/components/LobsterLogo';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed on mobile
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [currentSessionId]);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Set sidebar open on desktop by default
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      }
    };
    handleResize(); // Check on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/chat');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  };

  const openDeleteModal = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the chat
    setSessionToDelete(sessionId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      const response = await fetch(`/api/chat?sessionId=${sessionToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from sessions list
        setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
        
        // If this was the current session, clear it
        if (currentSessionId === sessionToDelete) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        
        // Close modal
        setDeleteModalOpen(false);
        setSessionToDelete(null);
      } else {
        // Could add error state here instead of alert
        setDeleteModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      setDeleteModalOpen(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const messageText = input.trim();
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: messageText,
          sessionId: currentSessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Update session ID if this was a new chat
      if (!currentSessionId && data.sessionId) {
        setCurrentSessionId(data.sessionId);
        loadSessions(); // Refresh session list
      }
      
      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.message || 'No response received',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      // Add error message to chat
      const errorResponse: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `❌ Error: ${errorMessage}`,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-[100dvh] md:h-[calc(100vh-3.5rem)] bg-zinc-950 text-white flex overflow-hidden relative pt-0 md:pt-0">
      {/* Sidebar - Chat History */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed md:relative inset-y-0 left-0 z-30 w-80 md:w-64 lg:w-80 border-r border-zinc-800 bg-zinc-900 md:bg-zinc-900/50 flex-shrink-0 transition-transform duration-300 flex flex-col h-full`}>
        <div className="p-4 border-b border-zinc-800 flex-shrink-0">
          <button
            onClick={startNewChat}
            className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg font-medium transition-all"
          >
            + New Chat
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">
              No chat history yet
            </div>
          ) : (
            <div className="p-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative rounded-lg mb-1 transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-orange-500/20 border border-orange-500/30'
                      : 'hover:bg-zinc-800'
                  }`}
                >
                  <button
                    onClick={() => {
                      setCurrentSessionId(session.id);
                      // Auto-close sidebar on mobile after selection
                      if (window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 pr-10"
                  >
                    <div className="text-sm text-zinc-200 truncate">{session.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                      <span>{formatDate(session.updated_at)}</span>
                      <span>•</span>
                      <span>{session.message_count} msgs</span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => openDeleteModal(session.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                    title="Delete chat"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="border-t border-zinc-800 p-4 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-orange-400 transition-colors text-sm">
            <LobsterLogo className="w-5 h-5" />
            <span>← Back to Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header - Hidden on mobile (main site header is enough) */}
        <header className="hidden md:flex border-b border-zinc-800 px-3 sm:px-4 md:px-6 py-3 md:py-4 bg-zinc-900/50 flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                  Chat with Clawd
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 hidden sm:block">
                  {currentSessionId ? 'Continuing conversation' : 'Start a new conversation'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs sm:text-sm text-zinc-400 hidden sm:inline">Connected</span>
            </div>
          </div>
        </header>
        
        {/* Mobile: Sidebar toggle button (floating) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden fixed top-20 left-4 z-40 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors shadow-lg"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
            {messages.length === 0 ? (
              <div className="text-center py-8 sm:py-12 md:py-16">
                <LobsterLogo className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
                <h2 className="text-lg sm:text-xl text-zinc-400 mb-2 px-4">Start a conversation</h2>
                <p className="text-sm sm:text-base text-zinc-500 px-4">Ask me anything about your OpenClaw setup, or just chat!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] sm:max-w-[80%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white ml-4 sm:ml-8 md:ml-12'
                          : 'bg-zinc-800 text-zinc-100 mr-4 sm:mr-8 md:mr-12'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <div className="whitespace-pre-wrap break-words text-sm sm:text-base">{message.content}</div>
                      ) : (
                        <div className="text-sm sm:text-base prose-chat">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                              h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-3 mb-1 first:mt-0">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold text-white mt-3 mb-1 first:mt-0">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-semibold text-white mt-2 mb-1 first:mt-0">{children}</h3>,
                              ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 ml-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 ml-1">{children}</ol>,
                              li: ({ children }) => <li className="text-zinc-200 leading-snug">{children}</li>,
                              code: ({ children, className }) => {
                                const isBlock = className?.includes('language-');
                                return isBlock ? (
                                  <code className="block bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 my-2 text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre">{children}</code>
                                ) : (
                                  <code className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-xs font-mono text-orange-300">{children}</code>
                                );
                              },
                              pre: ({ children }) => <div className="my-2">{children}</div>,
                              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                              em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors">
                                  {children}
                                </a>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-zinc-600 pl-3 my-2 text-zinc-400 italic">{children}</blockquote>
                              ),
                              hr: () => <hr className="border-zinc-700 my-3" />,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                      <div className={`text-[10px] sm:text-xs mt-1.5 sm:mt-2 ${
                        message.role === 'user' ? 'text-orange-100' : 'text-zinc-400'
                      }`}>
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 text-zinc-100 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg mr-4 sm:mr-8 md:mr-12">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                        <span className="text-zinc-400">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-800 px-3 sm:px-4 md:px-6 py-3 md:py-4 bg-zinc-900/50 flex-shrink-0 sticky bottom-0">
          <div className="max-w-4xl mx-auto">
            {error && (
              <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-xs sm:text-sm flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2 sm:gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-zinc-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-sm sm:text-base text-white transition-all duration-200 min-w-[70px] sm:min-w-[80px]"
              >
                {isLoading ? (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" 
            onClick={() => setDeleteModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Delete Chat?
                    </h3>
                    <p className="text-zinc-400 text-sm">
                      This will permanently delete this conversation and all its messages. This action cannot be undone.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    Delete Chat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
