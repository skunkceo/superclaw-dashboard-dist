'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    channels?: string[];
    keywords?: string[];
    sender?: string;
    hasThread?: boolean;
  };
  action: {
    agent: string;
    model: string;
    spawnNew?: boolean;
  };
  priority: number;
}

interface Agent {
  id: string;
  name: string;
  isDefault?: boolean;
}

export default function RouterPage() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [testMessage, setTestMessage] = useState('');
  const [testChannel, setTestChannel] = useState('#dev');
  const [testResult, setTestResult] = useState<RoutingRule | null>(null);
  const [testPerformed, setTestPerformed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [formData, setFormData] = useState<RoutingRule | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [showAgentSetup, setShowAgentSetup] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rulesRes, agentsRes] = await Promise.all([
          fetch('/api/router/rules'),
          fetch('/api/agents')
        ]);

        if (rulesRes.ok) {
          const data = await rulesRes.json();
          setRules(data.rules || []);
        }

        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAgents(data.agents || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const saveRules = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/router/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: '1.0', rules, fallback: { agent: 'main', notify: true } })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
    } catch (error) {
      console.error('Error saving rules:', error);
      alert('Failed to save routing rules: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = () => {
    setTestPerformed(true);
    
    // Match rules based on priority order
    // KEYWORD-FIRST ROUTING: Keywords can override channel
    const matched = rules
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority) // Lower priority number = higher priority
      .find(rule => {
        // Check keyword match (case-insensitive, partial match) - PRIMARY
        const hasKeywords = rule.conditions.keywords && rule.conditions.keywords.length > 0;
        const keywordMatch = !hasKeywords ||
          rule.conditions.keywords!.some(kw => 
            testMessage.toLowerCase().includes(kw.toLowerCase())
          );
        
        // If keywords are configured and they match, route regardless of channel
        if (hasKeywords && keywordMatch) {
          return true;
        }
        
        // Fallback: check channel match if no keywords or keywords didn't match
        const channelMatch = !rule.conditions.channels || rule.conditions.channels.length === 0 ||
          rule.conditions.channels.some(ch => {
            const normalizedRuleCh = ch.startsWith('#') ? ch : `#${ch}`;
            const normalizedTestCh = testChannel.startsWith('#') ? testChannel : `#${testChannel}`;
            return normalizedRuleCh.toLowerCase() === normalizedTestCh.toLowerCase();
          });
        
        return channelMatch;
      });
    
    setTestResult(matched || null);
  };

  const toggleRule = async (id: string) => {
    const newRules = rules.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    
    // Auto-save after toggle
    setSaving(true);
    try {
      const res = await fetch('/api/router/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: '1.0', rules: newRules, fallback: { agent: 'main', notify: true } })
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      // Only update state after confirmed save
      setRules(newRules);
    } catch (error) {
      console.error('Error saving rules:', error);
      alert('Failed to toggle rule — check server permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-white">Loading routing rules...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="text-zinc-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold">Message Router</h1>
          </div>
          <p className="text-zinc-400">
            Configure how messages are automatically routed to specialized agents
          </p>
        </div>

        {/* No Rules Prompt — only show when there are no routing rules at all */}
        {!loading && rules.length === 0 && (
          <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-8 mb-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">No Routing Rules Configured</h3>
                <p className="text-zinc-400 mb-4">
                  Add routing rules to automatically direct messages to specialized agents (e.g., Lead Developer, Marketing Lead, Support Lead). Agents are spawned on demand — no pre-registration needed.
                </p>
                <button
                  onClick={() => {
                    setShowAddRule(true);
                    setFormData({
                      id: `rule-${Date.now()}`,
                      name: 'New Routing Rule',
                      enabled: true,
                      priority: 1,
                      conditions: { channels: [], keywords: [] },
                      action: { agent: 'lead-developer', model: 'claude-sonnet-4', spawnNew: false }
                    });
                  }}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-medium transition-colors"
                >
                  Add First Rule
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Routing Rules */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="font-semibold">Routing Rules</h2>
                <button 
                  onClick={() => {
                    setShowAddRule(true);
                    setFormData({
                      id: `rule-${Date.now()}`,
                      name: 'New Routing Rule',
                      enabled: true,
                      priority: rules.length + 1,
                      conditions: {
                        channels: [],
                        keywords: []
                      },
                      action: {
                        agent: 'lead-developer',
                        model: 'claude-sonnet-4',
                        spawnNew: false
                      }
                    });
                  }}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm text-white transition"
                >
                  + Add Rule
                </button>
              </div>

              <div className="divide-y divide-zinc-800">
                {rules.map((rule) => (
                  <div key={rule.id} className="px-6 py-4">
                    <div className="flex items-start gap-4">
                      {/* Toggle */}
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className={`relative w-11 h-6 rounded-full transition ${
                          rule.enabled ? 'bg-orange-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          rule.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>

                      {/* Rule Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-white">{rule.name}</h3>
                          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">
                            Priority {rule.priority}
                          </span>
                        </div>

                        {/* Conditions */}
                        <div className="mb-3">
                          <div className="text-xs text-zinc-500 mb-1">When:</div>
                          <div className="flex flex-wrap gap-2">
                            {rule.conditions.channels?.map(ch => (
                              <span key={ch} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                                {ch}
                              </span>
                            ))}
                            {rule.conditions.keywords?.map(kw => (
                              <span key={kw} className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                                {kw}
                              </span>
                            ))}
                            {rule.conditions.sender && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                from: {rule.conditions.sender}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-zinc-500">Then:</div>
                          <div className="flex items-center gap-2">
                            <span className="text-orange-400">→ {rule.action.agent}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded font-mono">
                              {rule.action.model.replace('claude-', '')}
                            </span>
                            {rule.action.spawnNew && (
                              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                                spawn new
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edit */}
                      <button 
                        onClick={() => {
                          setEditingRule(rule);
                          setFormData({...rule});
                        }}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Test Panel */}
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="font-semibold">Test Router</h2>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Channel</label>
                  <select
                    value={testChannel}
                    onChange={(e) => setTestChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  >
                    <option>#dev</option>
                    <option>#marketing</option>
                    <option>#support</option>
                    <option>#product</option>
                    <option>DM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Message</label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Enter a test message..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 resize-none"
                    rows={4}
                  />
                </div>

                <button
                  onClick={handleTest}
                  className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-medium transition"
                >
                  Test Route
                </button>

                {testResult && (
                  <div className="p-4 bg-zinc-800 rounded-lg border border-orange-500/30">
                    <div className="text-xs text-zinc-500 mb-1">Would route to:</div>
                    <div className="font-medium text-orange-400 mb-2">{testResult.action.agent}</div>
                    <div className="text-xs text-zinc-400">
                      Using {testResult.action.model} • Priority {testResult.priority}
                    </div>
                  </div>
                )}

                {testPerformed && !testResult && (
                  <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                    <div className="text-sm text-zinc-400">No matching rule - would go to main session</div>
                  </div>
                )}
              </div>
            </div>

            {/* How Routing Works */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="font-semibold">How Routing Works</h2>
              </div>
              <div className="px-6 py-4 space-y-3 text-sm text-zinc-400">
                <p className="font-medium text-white">Keyword-First Routing:</p>
                <div className="pl-3 space-y-2 text-xs">
                  <div><span className="text-orange-400">Keywords</span> are primary - if message contains keywords, routes to that agent <span className="font-medium text-white">regardless of channel</span></div>
                  <div><span className="text-orange-400">Channels</span> are optional - used when no keywords match</div>
                  <div><span className="text-orange-400">Priority</span> - rules checked in order (1 = first)</div>
                </div>
                <div className="pt-2 border-t border-zinc-800 mt-3 pt-3 text-xs">
                  <p className="text-white mb-1">Example:</p>
                  <p className="text-zinc-500 italic">Message in #dev: "update the marketing copy"</p>
                  <p className="text-green-400 mt-1">→ Routes to Marketing Lead (keywords override channel)</p>
                </div>
                <p className="pt-2 text-xs border-t border-zinc-800 mt-3 pt-3">
                  <span className="text-white">Repo Assignment:</span> Configure via <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-400">superclaw setup agents</code>
                </p>
              </div>
            </div>

            {/* Model Selection */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="font-semibold">Model Selection</h2>
              </div>
              <div className="px-6 py-4 space-y-3 text-sm text-zinc-400">
                <p>Each routing rule specifies which model to use for that agent:</p>
                <div className="pl-3 space-y-1 text-xs">
                  <div>• <span className="text-orange-400">Haiku</span> - Fast, low-cost (data pulls, simple tasks)</div>
                  <div>• <span className="text-orange-400">Sonnet</span> - Balanced (most tasks, default)</div>
                  <div>• <span className="text-orange-400">Opus</span> - Most capable (complex reasoning)</div>
                </div>
                <p className="pt-2">To change an agent's default model, edit the routing rule above.</p>
                <p className="text-xs text-zinc-500">Future: Per-agent model preferences in agent settings</p>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="font-semibold">Router Stats</h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Total Rules</span>
                  <span className="font-medium">{rules.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Active Rules</span>
                  <span className="font-medium text-green-400">{rules.filter(r => r.enabled).length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Messages Routed</span>
                  <span className="font-medium text-zinc-600">—</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Hit Rate</span>
                  <span className="font-medium text-zinc-600">—</span>
                </div>
                <p className="text-xs text-zinc-600 pt-1 border-t border-zinc-800">
                  Routing telemetry coming soon
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Rule Editor Modal */}
        {(editingRule || showAddRule) && formData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 overflow-y-auto">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-3xl w-full p-6 my-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">
                  {editingRule ? 'Edit Routing Rule' : 'Add New Routing Rule'}
                </h3>
                <button 
                  onClick={() => {
                    setEditingRule(null);
                    setShowAddRule(false);
                    setFormData(null);
                  }}
                  className="text-zinc-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Rule Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Rule Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                    placeholder="e.g., Lead Developer - Code & Infrastructure"
                  />
                </div>

                {/* Priority & Enabled */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Priority</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                      min="1"
                    />
                    <div className="text-xs text-zinc-500 mt-1">Lower = higher priority</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Status</label>
                    <label className="flex items-center gap-3 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enabled}
                        onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Enabled</span>
                    </label>
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Keywords (primary routing)</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newKeyword.trim()) {
                          setFormData({
                            ...formData,
                            conditions: {
                              ...formData.conditions,
                              keywords: [...(formData.conditions.keywords || []), newKeyword.trim()]
                            }
                          });
                          setNewKeyword('');
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                      placeholder="Type keyword and press Enter"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.conditions.keywords?.map((kw, i) => (
                      <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm flex items-center gap-2">
                        {kw}
                        <button
                          onClick={() => {
                            setFormData({
                              ...formData,
                              conditions: {
                                ...formData.conditions,
                                keywords: formData.conditions.keywords?.filter((_, idx) => idx !== i)
                              }
                            });
                          }}
                          className="hover:text-purple-300"
                        >×</button>
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">Keywords override channel - message with these keywords routes here regardless of channel</div>
                </div>

                {/* Channels */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Channels (optional)</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newChannel}
                      onChange={(e) => setNewChannel(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newChannel.trim()) {
                          const ch = newChannel.trim().startsWith('#') ? newChannel.trim() : `#${newChannel.trim()}`;
                          setFormData({
                            ...formData,
                            conditions: {
                              ...formData.conditions,
                              channels: [...(formData.conditions.channels || []), ch]
                            }
                          });
                          setNewChannel('');
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                      placeholder="Type channel (e.g., #dev) and press Enter"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.conditions.channels?.map((ch, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm flex items-center gap-2">
                        {ch}
                        <button
                          onClick={() => {
                            setFormData({
                              ...formData,
                              conditions: {
                                ...formData.conditions,
                                channels: formData.conditions.channels?.filter((_, idx) => idx !== i)
                              }
                            });
                          }}
                          className="hover:text-blue-300"
                        >×</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Agent & Model */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Target Agent</label>
                    <select
                      value={formData.action.agent}
                      onChange={(e) => setFormData({...formData, action: {...formData.action, agent: e.target.value}})}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="lead-developer">Lead Developer</option>
                      <option value="lead-designer">Lead Designer</option>
                      <option value="marketing-lead">Marketing Lead</option>
                      <option value="support-lead">Support Lead</option>
                      <option value="product-manager">Product Manager</option>
                      <option value="martech-engineer">MarTech Engineer</option>
                      <option value="crm-engineer">CRM Engineer</option>
                      <option value="seo-specialist">SEO Specialist</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Model</label>
                    <select
                      value={formData.action.model}
                      onChange={(e) => setFormData({...formData, action: {...formData.action, model: e.target.value}})}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="claude-haiku-4">Haiku (fast, cheap)</option>
                      <option value="claude-sonnet-4">Sonnet (balanced)</option>
                      <option value="claude-opus-4">Opus (most capable)</option>
                    </select>
                  </div>
                </div>

                {/* Spawn New */}
                <div>
                  <label className="flex items-center gap-3 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.action.spawnNew || false}
                      onChange={(e) => setFormData({...formData, action: {...formData.action, spawnNew: e.target.checked}})}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="text-white">Spawn New Session</div>
                      <div className="text-xs text-zinc-500">Create fresh agent each time (vs. reuse existing)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setShowAddRule(false);
                    setFormData(null);
                  }}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setSaving(true);
                    let newRules = [...rules];
                    
                    if (editingRule) {
                      // Update existing
                      newRules = newRules.map(r => r.id === formData.id ? formData : r);
                    } else {
                      // Add new
                      newRules.push(formData);
                    }
                    
                    try {
                      const res = await fetch('/api/router/rules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          version: '1.0', 
                          rules: newRules, 
                          fallback: { agent: 'main', notify: true } 
                        })
                      });

                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || `Server error: ${res.status}`);
                      }
                      
                      // Only update state after confirmed save
                      setRules(newRules);
                      setEditingRule(null);
                      setShowAddRule(false);
                      setFormData(null);
                    } catch (error) {
                      console.error('Failed to save:', error);
                      alert('Failed to save rule: ' + (error instanceof Error ? error.message : 'Unknown error'));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 rounded-lg transition font-medium"
                >
                  {saving ? 'Saving...' : (editingRule ? 'Save Changes' : 'Create Rule')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Agent Setup Modal */}
        {showAgentSetup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 overflow-y-auto">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-4xl w-full p-6 my-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Install Specialized Agents</h3>
                <button
                  onClick={() => setShowAgentSetup(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-zinc-400 mb-6">
                Select which specialized agents you want to create. Each agent gets its own workspace and can be assigned to handle specific types of messages.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                {[
                  { id: 'lead-developer', name: 'Lead Developer', desc: 'Handles code, infrastructure, and technical tasks', workspace: '~/agents/lead-developer' },
                  { id: 'lead-designer', name: 'Lead Designer', desc: 'Manages UI/UX design and visual assets', workspace: '~/agents/lead-designer' },
                  { id: 'marketing-lead', name: 'Marketing Lead', desc: 'Handles marketing, content, and campaigns', workspace: '~/agents/marketing-lead' },
                  { id: 'support-lead', name: 'Support Lead', desc: 'Manages customer support and documentation', workspace: '~/agents/support-lead' },
                  { id: 'product-manager', name: 'Product Manager', desc: 'Coordinates features, roadmap, and strategy', workspace: '~/agents/product-manager' },
                  { id: 'martech-engineer', name: 'MarTech Engineer', desc: 'Marketing automation and analytics', workspace: '~/agents/martech-engineer' },
                  { id: 'crm-engineer', name: 'CRM Engineer', desc: 'CRM integrations and customer data', workspace: '~/agents/crm-engineer' },
                  { id: 'seo-specialist', name: 'SEO Specialist', desc: 'Search optimization and content strategy', workspace: '~/agents/seo-specialist' },
                ].map(agent => (
                  <button
                    key={agent.id}
                    onClick={async () => {
                      setCreatingAgent(true);
                      try {
                        const res = await fetch('/api/agents', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: agent.id,
                            workspace: agent.workspace,
                            model: 'anthropic/claude-sonnet-4-6'
                          })
                        });

                        if (!res.ok) {
                          const error = await res.json();
                          throw new Error(error.details || error.error);
                        }

                        // Refresh agents list
                        const agentsRes = await fetch('/api/agents');
                        if (agentsRes.ok) {
                          const data = await agentsRes.json();
                          setAgents(data.agents || []);
                        }

                        alert(`${agent.name} created successfully!`);
                      } catch (error: any) {
                        alert(`Failed to create agent: ${error.message}`);
                      } finally {
                        setCreatingAgent(false);
                      }
                    }}
                    disabled={creatingAgent || agents.some(a => a.id === agent.id)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      agents.some(a => a.id === agent.id)
                        ? 'bg-zinc-800/30 border-zinc-700 cursor-not-allowed opacity-50'
                        : creatingAgent
                        ? 'bg-zinc-800/50 border-zinc-700 cursor-wait'
                        : 'bg-zinc-800 border-zinc-700 hover:border-orange-500 hover:bg-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-white">{agent.name}</h4>
                      {agents.some(a => a.id === agent.id) && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                          Installed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400">{agent.desc}</p>
                    <p className="text-xs text-zinc-600 mt-2 font-mono">{agent.workspace}</p>
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                  {agents.length > 1 ? `${agents.length - 1} agent${agents.length > 2 ? 's' : ''} installed` : 'No agents installed yet'}
                </p>
                <button
                  onClick={() => {
                    setShowAgentSetup(false);
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
