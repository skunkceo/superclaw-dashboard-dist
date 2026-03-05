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
  category: string;
}

interface PRItem {
  repo: string;
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  mergedAt?: string;
  author: string;
}

interface Report {
  id: string;
  title: string;
  type: string;
  url: string;
  created_at: number;
}

type Category = "landing-page" | "content" | "paid-product" | "feature" | "saas" | "promotion";

// ─── Bridge Page ──────────────────────────────────────────────────────────────

export default function BridgePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>("landing-page");

  // Work Proposals by category
  const [proposals, setProposals] = useState<Record<string, WorkProposal[]>>({
    "landing-page": [],
    "content": [],
    "paid-product": [],
    "feature": [],
    "saas": [],
  });

  // Promotion tab data
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [recentPRs, setRecentPRs] = useState<PRItem[]>([]);
  const [overnightEnabled, setOvernightEnabled] = useState(false);
  const [overnightQueued, setOvernightQueued] = useState(0);
  const [overnightToggling, setOvernightToggling] = useState(false);

  // Fetch all data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      // Fetch work proposals for each category
      const categories = ["landing-page", "content", "paid-product", "feature", "saas"];
      const proposalData: Record<string, WorkProposal[]> = {};
      
      for (const category of categories) {
        const res = await fetch(`/api/bridge/proposals?category=${category}`);
        if (res.ok) {
          const data = await res.json();
          const HIDDEN_STATUSES = ["completed", "rejected", "dismissed"];
          proposalData[category] = (data.proposals || []).filter((p: WorkProposal) => !HIDDEN_STATUSES.includes(p.status));
        }
      }
      
      setProposals(proposalData);

      // Fetch recent reports (last 7 days)
      const reportsRes = await fetch("/api/reports?limit=50");
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = data.reports
          .filter((r: any) => r.created_at > sevenDaysAgo)
          .map((r: any) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            url: `https://superclaw.skunkglobal.com/reports/${r.id}`,
            created_at: r.created_at,
          }));
        setRecentReports(recent);
      }

      // Fetch recent PRs (last 7 days, merged only)
      const prsRes = await fetch("/api/github-activity/prs");
      if (prsRes.ok) {
        const data = await prsRes.json();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = data.prs
          .filter((pr: PRItem) => 
            pr.mergedAt && new Date(pr.mergedAt).getTime() > sevenDaysAgo
          );
        setRecentPRs(recent);
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

  const handleOvernightToggle = async () => {
    setOvernightToggling(true);
    try {
      const res = await fetch("/api/overnight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: overnightEnabled ? "stop" : "start" }),
      });
      if (res.ok) {
        setOvernightEnabled(!overnightEnabled);
        fetchData(true);
      }
    } catch (e) {
      console.error("Failed to toggle overnight mode", e);
    } finally {
      setOvernightToggling(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
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
      | "dismiss"
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

  const renderProposalCard = (proposal: WorkProposal) => (
    <div key={proposal.id} className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 hover:bg-zinc-800/30 transition-colors">
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
        {(proposal.status === "proposed" || proposal.status === "idea") && (
          <>
            <button onClick={() => handleProposalAction(proposal.id, "queue")} className="px-2.5 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-medium rounded transition-colors">Queue</button>
            <button onClick={() => handleProposalAction(proposal.id, "add_to_backlog")} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded transition-colors">Approve</button>
            <button onClick={() => handleProposalAction(proposal.id, "dismiss")} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded transition-colors">Dismiss</button>
          </>
        )}
        {proposal.status === "backlog" && (
          <button onClick={() => handleProposalAction(proposal.id, "queue")} className="px-2.5 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-medium rounded transition-colors">Queue for tonight</button>
        )}
        {proposal.status === "queued" && (
          <button onClick={() => handleProposalAction(proposal.id, "unqueue")} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded transition-colors">Unqueue</button>
        )}
      </div>
    </div>
  );

  const renderPromotionTab = () => {
    const encodeForReddit = (title: string, url: string) => {
      return `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
    };

    const encodeForTwitter = (text: string, url: string) => {
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    };

    return (
      <div className="divide-y divide-zinc-800/60">
        {recentReports.length === 0 && recentPRs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-zinc-600 text-sm">
            Nothing to promote this week
          </div>
        ) : (
          <>
            {recentReports.length > 0 && (
              <div className="p-5">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Recent Content</h3>
                <div className="space-y-3">
                  {recentReports.map((report) => (
                    <div key={report.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 bg-zinc-800/30 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium leading-snug">{report.title}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(report.created_at).toLocaleDateString()} • {report.type}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 flex-wrap">
                        <a
                          href={encodeForReddit(report.title, report.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-[#FF4500] hover:bg-[#FF5700] text-white text-xs font-medium rounded transition-colors"
                        >
                          Reddit
                        </a>
                        <a
                          href={encodeForTwitter(report.title, report.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-[#1DA1F2] hover:bg-[#1A8CD8] text-white text-xs font-medium rounded transition-colors"
                        >
                          X
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recentPRs.length > 0 && (
              <div className="p-5">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Recent Merges</h3>
                <div className="space-y-3">
                  {recentPRs.map((pr) => (
                    <div key={`${pr.repo}-${pr.number}`} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 bg-zinc-800/30 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium leading-snug">{pr.title}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {pr.repo} #{pr.number} • Merged {pr.mergedAt ? new Date(pr.mergedAt).toLocaleDateString() : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 flex-wrap">
                        <a
                          href={encodeForReddit(`${pr.title} (${pr.repo})`, pr.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-[#FF4500] hover:bg-[#FF5700] text-white text-xs font-medium rounded transition-colors"
                        >
                          Reddit
                        </a>
                        <a
                          href={encodeForTwitter(`Just shipped: ${pr.title}`, pr.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-[#1DA1F2] hover:bg-[#1A8CD8] text-white text-xs font-medium rounded transition-colors"
                        >
                          X
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const categoryConfig = [
    { key: "landing-page", label: "Landing Pages & Lead Magnets", shortLabel: "Landing Pages", count: proposals["landing-page"]?.length || 0 },
    { key: "content", label: "Content Clusters", shortLabel: "Content", count: proposals["content"]?.length || 0 },
    { key: "paid-product", label: "Paid Products", shortLabel: "Paid Products", count: proposals["paid-product"]?.length || 0 },
    { key: "feature", label: "Skunk Suite Features", shortLabel: "Features", count: proposals["feature"]?.length || 0 },
    { key: "saas", label: "New SaaS / Microsites", shortLabel: "SaaS / Microsites", count: proposals["saas"]?.length || 0 },
    { key: "promotion", label: "Promotion", shortLabel: "Promotion", count: recentReports.length + recentPRs.length },
  ];

  const visibleProposals = selectedCategory === "promotion" ? [] : (proposals[selectedCategory] || []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">The Bridge</h1>
            <p className="text-sm text-zinc-500 mt-1">Product work hub</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOvernightToggle}
              disabled={overnightToggling}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center gap-2 ${
                overnightEnabled
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${overnightEnabled ? "bg-orange-400" : "bg-zinc-600"}`} />
              {overnightEnabled ? `Overnight on${overnightQueued > 0 ? ` (${overnightQueued} queued)` : ""}` : "Overnight off"}
            </button>
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

        {/* PRODUCT WORK TABS */}
        <section className="mb-6 sm:mb-10">
          <h2 className="text-xs font-semibold text-white tracking-wide uppercase mb-4">Product Work</h2>

          <div className="flex flex-col sm:flex-row bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden min-h-[300px] sm:min-h-[500px]" >
            {/* Mobile: 2-column grid tabs */}
            <div className="sm:hidden grid grid-cols-2 border-b border-zinc-800 bg-zinc-900/80">
              {categoryConfig.map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key as Category)}
                    className={`flex items-center justify-between px-3 py-2.5 text-left text-xs font-medium transition-colors border-b border-r border-zinc-800/60 last:border-r-0 ${
                      isActive
                        ? "bg-[#E50914]/10 text-white border-b-[#E50914]"
                        : "text-zinc-500"
                    }`}
                  >
                    <span className="leading-tight">{cat.shortLabel}</span>
                    {cat.count > 0 && (
                      <span className={`text-xs tabular-nums ml-1 flex-shrink-0 ${isActive ? "text-white" : "text-zinc-600"}`}>
                        {cat.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Desktop: vertical sidebar */}
            <div className="hidden sm:block w-60 flex-shrink-0 border-r border-zinc-800 py-2">
              {categoryConfig.map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key as Category)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-[#E50914]/10 text-white"
                        : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                    }`}
                  >
                    <span className="text-xs font-medium">{cat.label}</span>
                    {cat.count > 0 && (
                      <span className={`text-xs tabular-nums ${isActive ? "text-white" : "text-zinc-600"}`}>
                        {cat.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Main panel */}
            <div className="flex-1 min-w-0 divide-y divide-zinc-800/60 overflow-y-auto">
              {selectedCategory === "promotion" ? (
                renderPromotionTab()
              ) : visibleProposals.length === 0 ? (
                <div className="flex items-center justify-center h-full py-16 text-zinc-600 text-sm">
                  No proposals yet
                </div>
              ) : (
                visibleProposals.map(renderProposalCard)
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
