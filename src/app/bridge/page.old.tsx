"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthWrapper";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkProposal {
  id: string;
  linear_issue_id: string | null;
  linear_identifier: string | null;
  linear_url: string | null;
  title: string;
  why: string | null;
  effort: "low" | "medium" | "high";
  repo: string | null;
  status: "proposed" | "approved" | "idea" | "backlog" | "queued" | "in_progress" | "in_review" | "completed" | "rejected" | "dismissed";
  branch_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  proposed_at: number;
  approved_at: number | null;
  completed_at: number | null;
  rejected_at: number | null;
  notes: string | null;
  intel_id: string | null;
  source: string;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  agent_label: string;
  action_type: string;
  summary: string;
  details: string | null;
  links: string;
}

interface PRItem {
  repo: string;
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  author: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  state: {
    name: string;
    type: string;
  };
  priority: number;
  url: string;
}

interface SynthesisData {
  whatsWorking: string[];
  needsAttention: string[];
  now: string[];
  next: string[];
  later: string[];
}

interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  site: string;
}

interface Suggestion {
  id: string;
  title: string;
  why: string | null;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  status: string;
  priority: number;
  category?: string;
}

// ─── Bridge Page ──────────────────────────────────────────────────────────────

export default function BridgePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Work Proposals grouped by status
  const [proposals, setProposals] = useState<{
    idea: WorkProposal[];
    backlog: WorkProposal[];
    queued: WorkProposal[];
    in_progress: WorkProposal[];
    in_review: WorkProposal[];
    completed: WorkProposal[];
    rejected: WorkProposal[];
  }>({
    idea: [],
    backlog: [],
    queued: [],
    in_progress: [],
    in_review: [],
    completed: [],
    rejected: [],
  });

  const [generating, setGenerating] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("intel");

  // Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [promotingSuggestion, setPromotingSuggestion] = useState<string | null>(null);

  // Other data
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [prs, setPrs] = useState<PRItem[]>([]);
  const [linearIssues, setLinearIssues] = useState<LinearIssue[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(null);
  const [ga4Data, setGa4Data] = useState<any>(null);
  const [gscData, setGscData] = useState<any>(null);
  const [intelData, setIntelData] = useState<any>(null);
  const [commentedIntelIds, setCommentedIntelIds] = useState<Set<string>>(new Set());
  const [addingToListIds, setAddingToListIds] = useState<Set<string>>(new Set());
  const [addedToListIds, setAddedToListIds] = useState<Set<string>>(new Set());

  // Fetch all data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      // Fetch work proposals
      const proposalsRes = await fetch("/api/bridge/proposals");
      if (proposalsRes.ok) {
        const data = await proposalsRes.json();
        setProposals({
          idea: data.idea || [],
          backlog: data.backlog || [],
          queued: data.queued || [],
          in_progress: data.in_progress || [],
          in_review: data.in_review || [],
          completed: data.completed || [],
          rejected: data.rejected || [],
        });
      }

      // Fetch activity
      const activityRes = await fetch("/api/activity?limit=10");
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivity(data.activity || []);
      }

      // Fetch PRs
      const prsRes = await fetch("/api/github-activity/prs");
      if (prsRes.ok) {
        const data = await prsRes.json();
        setPrs(data.prs || []);
      }

      // Fetch Linear issues
      const linearRes = await fetch("/api/linear/issues");
      if (linearRes.ok) {
        const data = await linearRes.json();
        setLinearIssues(data.issues || []);
      }

      // Fetch synthesis
      const synthesisRes = await fetch("/api/bridge/synthesis");
      if (synthesisRes.ok) {
        const data = await synthesisRes.json();
        setSynthesis(data.synthesis || null);
      }

      // Fetch GA4 data
      const ga4Res = await fetch("/api/bridge/ga4");
      if (ga4Res.ok) {
        const data = await ga4Res.json();
        setGa4Data(data);
      }

      // Fetch GSC data
      const gscRes = await fetch("/api/bridge/gsc");
      if (gscRes.ok) {
        const data = await gscRes.json();
        setGscData(data);
      }

      // Fetch intel
      const intelRes = await fetch("/api/bridge/intel");
      if (intelRes.ok) {
        const data = await intelRes.json();
        setIntelData(data);

        // Check which intel items already have proposals
        if (data.intel && data.intel.length > 0) {
          const allProposals = await fetch("/api/bridge/proposals");
          if (allProposals.ok) {
            const proposalsData = await allProposals.json();
            const allProposalsList = [
              ...(proposalsData.idea || []),
              ...(proposalsData.backlog || []),
              ...(proposalsData.queued || []),
              ...(proposalsData.in_progress || []),
              ...(proposalsData.in_review || []),
              ...(proposalsData.completed || []),
              ...(proposalsData.rejected || [])
            ];
            const intelWithProposals = new Set(allProposalsList
              .filter((p: WorkProposal) => p.intel_id)
              .map((p: WorkProposal) => p.intel_id));
            setAddedToListIds(intelWithProposals as Set<string>);
          }
        }
      }

      // Fetch suggestions
      const suggestionsRes = await fetch("/api/suggestions?limit=15&status=pending");
      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Failed to fetch bridge data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleGenerateProposals = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/bridge/proposals/generate", { method: "POST" });
      if (res.ok) {
        fetchData(true);
      }
    } catch (error) {
      console.error("Failed to generate proposals:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleProposalAction = async (
    id: string,
    action:
      | "add_to_backlog"
      | "queue"
      | "unqueue"
      | "move_to_ideas"
      | "start"
      | "mark_review"
      | "mark_complete"
      | "reject"
  ) => {
    try {
      const res = await fetch(`/api/bridge/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchData(true);
      }
    } catch (error) {
      console.error("Failed to update proposal:", error);
    }
  };

  const handleMarkIntelCommented = async (id: string) => {
    setCommentedIntelIds((prev) => new Set([...prev, id]));
    try {
      await fetch(`/api/intel/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commented" }),
      });
    } catch {
      setCommentedIntelIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handlePromoteSuggestion = async (suggestion: Suggestion) => {
    setPromotingSuggestion(suggestion.id);
    try {
      const res = await fetch("/api/bridge/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestion.title,
          why: suggestion.why,
          effort: suggestion.effort,
        }),
      });
      if (res.ok) {
        await fetch(`/api/suggestions/${suggestion.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "actioned" }),
        });
        fetchData(true);
      }
    } catch (error) {
      console.error("Failed to promote suggestion:", error);
    } finally {
      setPromotingSuggestion(null);
    }
  };

  const handleRejectIntel = async (id: string) => {
    setCommentedIntelIds((prev) => new Set([...prev, id]));
    try {
      await fetch(`/api/intel/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
    } catch {
      setCommentedIntelIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

const handleAddIntelToList = async (item: any) => {
    setAddingToListIds((prev) => new Set([...prev, item.id]));
    try {
      const res = await fetch(`/api/intel/${item.id}/add-to-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setAddedToListIds((prev) => new Set([...prev, item.id]));
        fetchData(true); // Refresh data to show new proposal
      } else {
        const error = await res.json();
        if (res.status === 409) {
          // Already exists, mark as added
          setAddedToListIds((prev) => new Set([...prev, item.id]));
        } else {
          console.error("Failed to add intel to list:", error);
        }
      }
    } catch (error) {
      console.error("Failed to add intel to list:", error);
    } finally {
      setAddingToListIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };


  const handleArchiveAllIntel = async () => {
    try {
      const res = await fetch("/api/intel/archive-all", { method: "POST" });
      if (res.ok) {
        setIntelData(null);
        setCommentedIntelIds(new Set());
      }
    } catch (error) {
      console.error("Failed to archive all intel:", error);
    }
  };

  const handleDismissSuggestion = async (id: string) => {
    try {
      await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Failed to dismiss suggestion:", error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-600 text-sm">Loading...</div>
      </div>
    );
  }

  const getEffortBadge = (effort: string) => {
    const colors: Record<string, string> = {
      low: "bg-green-500/10 text-green-400 border-green-500/20",
      medium: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      high: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return colors[effort] || colors.medium;
  };

  const renderProposalCard = (proposal: WorkProposal, actions: React.ReactNode) => (
    <div key={proposal.id} className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {proposal.linear_identifier && (
            <span className="text-xs font-mono text-zinc-500 flex-shrink-0">
              {proposal.linear_identifier}
            </span>
          )}
          {proposal.repo && (
            <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded border border-zinc-700 flex-shrink-0">
              {proposal.repo}
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 text-xs rounded border ${getEffortBadge(proposal.effort)} flex-shrink-0`}
          >
            {proposal.effort}
          </span>
        </div>
        <p className="text-sm text-white font-medium leading-snug">{proposal.title}</p>
        {proposal.why && (
          <p className="text-xs text-zinc-500 mt-1 leading-snug line-clamp-2">{proposal.why}</p>
        )}
        {proposal.pr_url && (
          <a
            href={proposal.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 px-3 py-1.5 bg-[#E50914] hover:bg-[#c40812] text-white text-xs font-medium rounded transition-colors"
          >
            View PR #{proposal.pr_number}
          </a>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5 flex-wrap sm:flex-nowrap">
        {actions}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">The Bridge</h1>
            <p className="text-sm text-zinc-500 mt-1">Operations center</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/bridge/settings"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg text-sm font-medium transition-colors border border-zinc-800"
            >
              Settings
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-[#E50914]/10 hover:bg-[#E50914]/20 text-[#E50914] rounded-lg text-sm font-medium transition-colors border border-[#E50914]/20 flex items-center gap-2"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* UNIFIED INBOX */}
        {(() => {
          const visibleIntel = intelData?.intel?.filter((item: any) => !commentedIntelIds.has(item.id)) || [];
          const categoryColors: Record<string, string> = {
            competitor: "bg-red-500/10 text-red-400 border-red-500/20",
            opportunity: "bg-green-500/10 text-green-400 border-green-500/20",
            wordpress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
            market: "bg-orange-500/10 text-orange-400 border-orange-500/20",
            seo: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            keyword: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
          };
          const cleanSummary = (raw: string) => {
            const stripped = raw.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
            const sentence = stripped.split(/\.\s+/)[0];
            const capped = sentence.length > 200 ? sentence.substring(0, 197) + "..." : sentence;
            return capped || stripped.substring(0, 200);
          };

          const statusConfig = [
            { key: "intel",       label: "Intel",       color: "text-yellow-400",  activeBg: "bg-yellow-500/10", count: visibleIntel.length },
            { key: "idea",        label: "Ideas",       color: "text-zinc-400",    activeBg: "bg-zinc-800",      count: proposals.idea.length },
            { key: "backlog",     label: "Backlog",     color: "text-zinc-400",    activeBg: "bg-zinc-800",      count: proposals.backlog.length },
            { key: "queued",      label: "Queued",      color: "text-green-400",   activeBg: "bg-green-500/10",  count: proposals.queued.length },
            { key: "in_progress", label: "In Progress", color: "text-blue-400",    activeBg: "bg-blue-500/10",   count: proposals.in_progress.length },
            { key: "in_review",   label: "In Review",   color: "text-orange-400",  activeBg: "bg-orange-500/10", count: proposals.in_review.length },
            { key: "completed",   label: "Completed",   color: "text-zinc-500",    activeBg: "bg-zinc-800",      count: proposals.completed.length },
            { key: "rejected",    label: "Rejected",    color: "text-zinc-600",    activeBg: "bg-zinc-800",      count: proposals.rejected.length },
          ];

          const getActionsForProposal = (proposal: WorkProposal) => {
            switch (proposal.status) {
              case "idea":
              case "proposed":
                return (
                  <>
                    <button onClick={() => handleProposalAction(proposal.id, "add_to_backlog")} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded transition-colors">Backlog</button>
                    <button onClick={() => handleProposalAction(proposal.id, "queue")} className="px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition-colors">Queue</button>
                    <button onClick={() => handleProposalAction(proposal.id, "reject")} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded transition-colors">Reject</button>
                  </>
                );
              case "backlog":
                return (
                  <>
                    <button onClick={() => handleProposalAction(proposal.id, "queue")} className="px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition-colors">Queue</button>
                    <button onClick={() => handleProposalAction(proposal.id, "move_to_ideas")} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded transition-colors">Ideas</button>
                    <button onClick={() => handleProposalAction(proposal.id, "reject")} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded transition-colors">Reject</button>
                  </>
                );
              case "queued":
                return (
                  <button onClick={() => handleProposalAction(proposal.id, "unqueue")} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded transition-colors">Unqueue</button>
                );
              case "in_review":
                return (
                  <button onClick={() => handleProposalAction(proposal.id, "mark_complete")} className="px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition-colors">Mark Complete</button>
                );
              default:
                return null;
            }
          };

          const visibleProposals = proposals[selectedStatus as keyof typeof proposals] || [];

          return (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-white tracking-wide uppercase">Inbox</h2>
                <button
                  onClick={handleGenerateProposals}
                  disabled={generating}
                  className="px-3 py-1.5 bg-[#E50914] hover:bg-[#c40812] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Propose Work"}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden" style={{ minHeight: "500px" }}>
                {/* Mobile: horizontal scroll tabs */}
                <div className="sm:hidden flex overflow-x-auto border-b border-zinc-800 bg-zinc-900/80 scrollbar-none">
                  {statusConfig.map((s) => {
                    const isActive = selectedStatus === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setSelectedStatus(s.key)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
                          isActive
                            ? `border-[#E50914] ${s.color}`
                            : "border-transparent text-zinc-500"
                        }`}
                      >
                        {s.label}
                        {s.count > 0 && (
                          <span className={`text-xs tabular-nums ${isActive ? s.color : "text-zinc-600"}`}>
                            {s.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Desktop: vertical sidebar */}
                <div className="hidden sm:block w-44 flex-shrink-0 border-r border-zinc-800 py-2">
                  {statusConfig.map((s) => {
                    const isActive = selectedStatus === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setSelectedStatus(s.key)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                          isActive
                            ? `${s.activeBg} ${s.color}`
                            : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                        }`}
                      >
                        <span className="text-xs font-medium">{s.label}</span>
                        {s.count > 0 && (
                          <span className={`text-xs tabular-nums ${isActive ? s.color : "text-zinc-600"}`}>
                            {s.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Main panel */}
                <div className="flex-1 min-w-0 divide-y divide-zinc-800/60 overflow-y-auto">
                  {selectedStatus === "intel" ? (
                    visibleIntel.length === 0 ? (
                      <div className="flex items-center justify-center h-full py-16 text-zinc-600 text-sm">
                        No new intel
                      </div>
                    ) : (
                      <>
                        {visibleIntel.length > 1 && (
                          <div className="px-5 py-3 flex justify-end">
                            <button
                              onClick={handleArchiveAllIntel}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded transition-colors"
                            >
                              Archive all
                            </button>
                          </div>
                        )}
                        {visibleIntel.map((item: any, idx: number) => {
                          const categoryColor = categoryColors[item.category] || "bg-zinc-800 text-zinc-400 border-zinc-700";
                          const isReddit = item.url?.includes("reddit.com");
                          const source = isReddit
                            ? "Reddit"
                            : item.url
                            ? new URL(item.url).hostname.replace("www.", "")
                            : null;
                          const description = cleanSummary(item.summary || "");
                          return (
                            <div key={item.id} className="px-5 py-4 hover:bg-zinc-800/30 transition-colors">
                              <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-5 text-right text-xs text-zinc-600 pt-0.5 font-mono leading-5">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded border ${categoryColor}`}>
                                      {item.category}
                                    </span>
                                    {source && <span className="text-[10px] text-zinc-600 uppercase tracking-wide">{source}</span>}
                                  </div>
                                  {item.url ? (
                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-[#E50914] transition-colors leading-snug block">
                                      {item.title}
                                    </a>
                                  ) : (
                                    <span className="text-sm font-medium text-white leading-snug block">{item.title}</span>
                                  )}
                                  {description && <p className="text-xs text-zinc-400 leading-relaxed mt-1">{description}</p>}
                                  {item.insight && (
                                    <p className="text-xs text-[#E50914] leading-relaxed mt-1 italic">
                                      For Skunk: {item.insight}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-3">
                                    <button onClick={() => handleRejectIntel(item.id)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-medium rounded transition-colors">
                                      Reject
                                    </button>
                                    {addedToListIds.has(item.id) ? (
                                      <button disabled className="px-3 py-1.5 bg-green-600/80 text-white text-xs font-medium rounded transition-colors cursor-default">
                                        Added ✓
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={() => handleAddIntelToList(item)} 
                                        disabled={addingToListIds.has(item.id)}
                                        className="px-3 py-1.5 bg-[#E50914] hover:bg-[#c40812] text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                                      >
                                      {addingToListIds.has(item.id) ? "Adding..." : "Add to list"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )
                  ) : visibleProposals.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-16 text-zinc-600 text-sm">
                      Nothing here yet
                    </div>
                  ) : (
                    visibleProposals.map((proposal) => renderProposalCard(proposal, getActionsForProposal(proposal)))
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        {/* REST OF PAGE: Growth, Strategic Brief, etc. */}
        {/* Keeping existing sections below... */}
      </div>
    </div>
  );
}
