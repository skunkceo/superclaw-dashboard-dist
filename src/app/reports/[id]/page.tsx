'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Report {
  id: string;
  title: string;
  type: string;
  content: string;
  suggestion_id: string | null;
  overnight_run_id: string | null;
  created_at: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Callout config ───────────────────────────────────────────────────────────

const CALLOUT_STYLES: Record<string, { border: string; bg: string; label: string; labelColor: string; icon: string }> = {
  TLDR:       { border: '#f97316', bg: 'rgba(249,115,22,0.08)',  label: 'TL;DR',       labelColor: '#fb923c', icon: '⚡' },
  INSIGHT:    { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  label: 'Key Insight', labelColor: '#60a5fa', icon: '💡' },
  COMPETITOR: { border: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'Competitor',  labelColor: '#f87171', icon: '⚔' },
  OPPORTUNITY:{ border: '#22c55e', bg: 'rgba(34,197,94,0.08)',   label: 'Opportunity', labelColor: '#4ade80', icon: '▲' },
  WARNING:    { border: '#eab308', bg: 'rgba(234,179,8,0.08)',   label: 'Watch',       labelColor: '#facc15', icon: '⚠' },
  ACTION:     { border: '#a855f7', bg: 'rgba(168,85,247,0.08)',  label: 'Action',      labelColor: '#c084fc', icon: '→' },
  NOTE:       { border: '#71717a', bg: 'rgba(113,113,122,0.08)', label: 'Note',        labelColor: '#a1a1aa', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-bottom:1px"><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>' },
  STAT:       { border: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   label: 'Stat',        labelColor: '#22d3ee', icon: '#' },
};

// ─── Report markdown renderer ──────────────────────────────────────────────────
// Reports are trusted internal content — HTML passes through without escaping.

function renderMarkdown(md: string): string {
  // Strip YAML frontmatter
  let src = md.replace(/^---[\s\S]*?---\n*/, '');

  // ── Code blocks (protect before other replacements) ────────────────────────
  const codeBlocks: string[] = [];
  src = src.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(`<pre style="background:#09090b;border:1px solid #27272a;border-radius:0.5rem;padding:1rem;overflow-x:auto;font-size:0.75rem;color:#d4d4d8;margin:1rem 0;"><code>${code}</code></pre>`);
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  // ── GitHub-style callout blocks > [!TYPE] ──────────────────────────────────
  // Fix: removed broken `$` anchor — the old regex never matched multiline blocks
  src = src.replace(
    /^> \[!([A-Z]+)\]\n((?:>[ \t]?.*(?:\n|$))*)/gm,
    (_, type, body) => {
      const cfg = CALLOUT_STYLES[type] || CALLOUT_STYLES.NOTE;
      const content = body.replace(/^>[ \t]?/gm, '').trim();
      return `<div style="border-left:3px solid ${cfg.border};background:${cfg.bg};border-radius:0.5rem;padding:1rem 1.25rem;margin:1.25rem 0;">
<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;color:${cfg.labelColor};text-transform:uppercase;margin-bottom:0.5rem;">${cfg.icon} ${cfg.label}</div>
<div style="color:#e4e4e7;font-size:0.95rem;line-height:1.6;">${content}</div>
</div>\n`;
    }
  );

  // ── Plain blockquotes ─────────────────────────────────────────────────────
  src = src.replace(
    /^((?:> .+\n?)+)/gm,
    (match) => {
      const content = match.replace(/^> ?/gm, '').trim();
      return `<blockquote style="border-left:3px solid #52525b;background:rgba(63,63,70,0.3);border-radius:0 0.5rem 0.5rem 0;padding:0.75rem 1rem;margin:1rem 0;color:#a1a1aa;font-style:italic;">${content}</blockquote>\n`;
    }
  );

  // ── Headings ──────────────────────────────────────────────────────────────
  src = src.replace(/^#### (.+)$/gm, '<h4 style="font-size:1rem;font-weight:600;color:#d4d4d8;margin:1.25rem 0 0.4rem;">$1</h4>');
  src = src.replace(/^### (.+)$/gm, '<h3 style="font-size:1.1rem;font-weight:600;color:#fff;margin:1.75rem 0 0.5rem;">$1</h3>');
  src = src.replace(/^## (.+)$/gm, '<h2 style="font-size:1.4rem;font-weight:700;color:#fff;margin:2.5rem 0 0.75rem;padding-bottom:0.5rem;border-bottom:1px solid #27272a;">$1</h2>');
  src = src.replace(/^# (.+)$/gm, '<h1 style="font-size:1.8rem;font-weight:700;color:#fff;margin:2rem 0 1rem;">$1</h1>');

  // ── Horizontal rules ──────────────────────────────────────────────────────
  src = src.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #27272a;margin:2rem 0;">');

  // ── Tables ────────────────────────────────────────────────────────────────
  src = src.replace(
    /^(\|.+\|[ \t]*\n\|[-| :]+\|[ \t]*\n(?:\|.+\|[ \t]*\n?)+)/gm,
    (match) => {
      const lines = match.trim().split('\n');
      const headerCells = lines[0].split('|').slice(1, -1).map(c => c.trim());
      const bodyLines = lines.slice(2).filter(l => l.trim());
      const thStyle = 'padding:0.6rem 1rem;text-align:left;font-size:0.75rem;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #3f3f46;white-space:nowrap;';
      const tdStyle = 'padding:0.65rem 1rem;font-size:0.9rem;color:#d4d4d8;border-bottom:1px solid #27272a;';
      const thead = `<thead><tr>${headerCells.map(h => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyLines.map(line => {
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        return `<tr style="transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">${cells.map(c => `<td style="${tdStyle}">${c}</td>`).join('')}</tr>`;
      }).join('')}</tbody>`;
      return `<div style="overflow-x:auto;margin:1.5rem 0;border-radius:0.5rem;border:1px solid #27272a;"><table style="width:100%;border-collapse:collapse;">${thead}${tbody}</table></div>\n`;
    }
  );

  // ── Task list checkboxes (must come before general list handling) ─────────
  let checkboxIndex = 0;
  src = src.replace(/^- \[(x| )\] (.+)$/gm, (_, checked, text) => {
    const idx = checkboxIndex++;
    const isChecked = checked === 'x';
    return `<li data-checklist="1" style="list-style:none;margin:0.4rem 0;line-height:1.6;"><label style="display:flex;align-items:flex-start;gap:0.6rem;cursor:pointer;color:#d4d4d8;"><input type="checkbox" data-ck="${idx}" ${isChecked ? 'checked' : ''} style="margin-top:0.25rem;width:1rem;height:1rem;cursor:pointer;accent-color:#fb923c;flex-shrink:0;"><span>${text}</span></label></li>`;
  });

  // ── Lists ─────────────────────────────────────────────────────────────────
  src = src.replace(/^[*-] (.+)$/gm, '<li style="color:#d4d4d8;margin:0.3rem 0;line-height:1.6;">$1</li>');
  src = src.replace(/^\d+\. (.+)$/gm, '<li style="color:#d4d4d8;margin:0.3rem 0;line-height:1.6;">$1</li>');
  src = src.replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, match => {
    // Checklist items get a plain ul (no disc), regular items get disc
    if (match.includes('data-checklist="1"')) {
      return `<ul style="list-style:none;padding-left:0.25rem;margin:0.75rem 0;">${match}</ul>`;
    }
    return `<ul style="list-style:disc;padding-left:1.5rem;margin:0.75rem 0;">${match}</ul>`;
  });

  // ── Inline code ────────────────────────────────────────────────────────────
  src = src.replace(/`([^`]+)`/g, '<code style="background:#27272a;color:#fb923c;padding:0.15rem 0.4rem;border-radius:0.25rem;font-size:0.8em;">$1</code>');

  // ── Special: Reddit thread URL lines (before bold strips **) ─────────────
  src = src.replace(/^\*\*URL:\*\* (https?:\/\/[^\s]+)$/gm, (_, url) => {
    const isReddit = url.includes('reddit.com');
    return `<div style="margin:0.4rem 0 1rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;"${isReddit ? ` data-reddit-url="${url}"` : ''}><a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:0.5rem;background:rgba(255,99,32,0.12);border:1px solid rgba(255,99,32,0.3);color:#ff6314;border-radius:0.4rem;padding:0.35rem 0.8rem;font-size:0.8rem;font-weight:600;text-decoration:none;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>View thread</a></div>`;
  });

  // ── Bold & italic ─────────────────────────────────────────────────────────
  src = src.replace(/\*\*([^*\n]+)\*\*/g, '<strong style="color:#fff;font-weight:600;">$1</strong>');
  src = src.replace(/\*([^*\n]+)\*/g, '<em style="color:#d4d4d8;">$1</em>');

  // ── Links ─────────────────────────────────────────────────────────────────
  src = src.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#fb923c;text-decoration:underline;">$1</a>');

  // ── Bare URLs on their own line (not already inside an anchor/tag) ────────
  // Runs after [text](url) conversion so markdown links are already <a> tags.
  src = src.replace(/^(https?:\/\/[^\s<>"]+)$/gm, (_, url) => {
    const isReddit = url.includes('reddit.com');
    if (isReddit) {
      return `<div style="margin:0.4rem 0 1rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;" data-reddit-url="${url}"><a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:0.5rem;background:rgba(255,99,32,0.12);border:1px solid rgba(255,99,32,0.3);color:#ff6314;border-radius:0.4rem;padding:0.35rem 0.8rem;font-size:0.8rem;font-weight:600;text-decoration:none;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>View thread</a></div>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#fb923c;text-decoration:underline;word-break:break-all;">${url}</a>`;
  });

  // ── Reddit subreddit badges ────────────────────────────────────────────────
  // Use a combined regex: match either an HTML tag (preserve it) or a bare r/subreddit
  // (convert it). This avoids ever touching text inside HTML attribute values.
  src = src.replace(/(<[^>]+>)|\br\/([a-zA-Z0-9_]+)\b/g, (match, tag, sub) => {
    if (tag) return tag; // preserve HTML tags verbatim
    return `<a href="https://reddit.com/r/${sub}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:0.25rem;background:rgba(255,99,32,0.12);border:1px solid rgba(255,99,32,0.3);color:#ff6314;border-radius:9999px;padding:0.12rem 0.6rem;font-size:0.78rem;font-weight:700;text-decoration:none;vertical-align:middle;letter-spacing:0.01em;">r/${sub}</a>`;
  });

  // ── Paragraphs — split by blank lines, wrap plain text blocks ─────────────
  const blocks = src.split(/\n{2,}/);
  src = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Already HTML or a placeholder
    if (trimmed.startsWith('<') || trimmed.startsWith('\x00CODE')) return trimmed;
    // Plain text block — wrap in <p>
    return `<p style="color:#a1a1aa;font-size:1rem;line-height:1.7;margin-bottom:1rem;">${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n\n');

  // ── Restore code blocks ────────────────────────────────────────────────────
  src = src.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]);

  return src;
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteConfirmModal({ title, onConfirm, onCancel, deleting }: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-sm w-full p-6">
        <h2 className="text-base font-semibold text-white mb-2">Delete report?</h2>
        <p className="text-sm text-zinc-400 mb-1 line-clamp-2">{title}</p>
        <p className="text-xs text-zinc-600 mb-6">This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Reset scroll position on mount (unless navigating to anchor/fragment)
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reports/${id}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then(d => { if (d) { setReport(d.report); setLoading(false); } })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  // Restore checkbox state from localStorage and wire up change handlers
  useEffect(() => {
    if (!report) return;
    const storageKey = `report-checks-${report.id}`;
    const saved: Record<string, boolean> = JSON.parse(localStorage.getItem(storageKey) || '{}');

    const boxes = document.querySelectorAll<HTMLInputElement>('input[data-ck]');
    boxes.forEach(box => {
      const key = box.getAttribute('data-ck')!;
      if (key in saved) box.checked = saved[key];

      // Strike-through label text when checked
      const span = box.nextElementSibling as HTMLElement | null;
      if (span) span.style.textDecoration = box.checked ? 'line-through' : '';
      if (span) span.style.color = box.checked ? '#71717a' : '#d4d4d8';

      box.addEventListener('change', () => {
        const latest: Record<string, boolean> = JSON.parse(localStorage.getItem(storageKey) || '{}');
        latest[key] = box.checked;
        localStorage.setItem(storageKey, JSON.stringify(latest));
        if (span) span.style.textDecoration = box.checked ? 'line-through' : '';
        if (span) span.style.color = box.checked ? '#71717a' : '#d4d4d8';
      });
    });
  }, [report]);

  // Inject "Mark as commented" buttons next to Reddit thread links.
  // Persists state in localStorage so done threads stay visually marked on reload.
  useEffect(() => {
    if (!report || !contentRef.current) return;
    const container = contentRef.current;
    const storageKey = `report-reddit-commented-${report.id}`;
    const saved: Record<string, boolean> = JSON.parse(localStorage.getItem(storageKey) || '{}');

    function markDone(div: HTMLElement, url: string) {
      // Style the container as a distinct "done" block
      div.style.cssText += ';background:rgba(74,222,128,0.06);border-left:3px solid #4ade80;border-radius:0 0.4rem 0.4rem 0;padding:0.5rem 0.75rem;transition:all 0.3s;';

      // Grey out the "View thread" link — strip the orange, go muted
      const link = div.querySelector('a');
      if (link) {
        link.style.background = 'rgba(113,113,122,0.12)';
        link.style.borderColor = 'rgba(113,113,122,0.25)';
        link.style.color = '#52525b';
        link.style.textDecoration = 'line-through';
        link.style.textDecorationColor = '#3f3f46';
      }

      // Remove the "Mark as commented" button
      const existing = div.querySelector('[data-mark-commented]');
      if (existing) existing.remove();

      // Insert a solid green "Commented" badge BEFORE the link
      const badge = document.createElement('span');
      badge.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:0.4rem',
        'background:#166534',
        'border:1px solid #16a34a',
        'color:#4ade80',
        'border-radius:0.4rem',
        'padding:0.3rem 0.8rem',
        'font-size:0.78rem',
        'font-weight:700',
        'flex-shrink:0',
        'letter-spacing:0.02em',
      ].join(';');
      badge.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Commented`;
      div.insertBefore(badge, div.firstChild);

      // Persist
      const state: Record<string, boolean> = JSON.parse(localStorage.getItem(storageKey) || '{}');
      state[url] = true;
      localStorage.setItem(storageKey, JSON.stringify(state));
    }

    const redditDivs = container.querySelectorAll<HTMLElement>('[data-reddit-url]');
    redditDivs.forEach(div => {
      const url = div.getAttribute('data-reddit-url')!;

      // Restore done state from localStorage
      if (saved[url]) {
        markDone(div, url);
        return;
      }

      if (div.querySelector('[data-mark-commented]')) return; // already injected

      const btn = document.createElement('button');
      btn.setAttribute('data-mark-commented', 'true');
      btn.textContent = 'Mark as commented';
      btn.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:0.3rem',
        'background:rgba(74,222,128,0.06)',
        'border:1px solid rgba(74,222,128,0.2)',
        'color:#86efac',
        'border-radius:0.4rem',
        'padding:0.3rem 0.7rem',
        'font-size:0.75rem',
        'font-weight:600',
        'cursor:pointer',
        'transition:background 0.15s,border-color 0.15s',
      ].join(';');

      btn.onmouseenter = () => {
        btn.style.background = 'rgba(74,222,128,0.12)';
        btn.style.borderColor = 'rgba(74,222,128,0.35)';
      };
      btn.onmouseleave = () => {
        btn.style.background = 'rgba(74,222,128,0.06)';
        btn.style.borderColor = 'rgba(74,222,128,0.2)';
      };

      btn.onclick = async () => {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.5';
        try {
          await fetch('/api/intel/mark-by-url', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
        } catch (_) { /* best effort */ }
        markDone(div, url);
      };

      div.appendChild(btn);
    });
  }, [report]);

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    window.location.href = '/reports';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-600 text-sm">Loading report...</div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-zinc-500 text-sm mb-4">Report not found</div>
          <Link href="/reports" className="text-orange-400 hover:text-orange-300 text-sm">
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Nav */}
        <div className="flex items-center gap-2 text-sm text-zinc-600 mb-6">
          <Link href="/reports" className="hover:text-zinc-400 transition-colors">Reports</Link>
          <span>/</span>
          <span className="text-zinc-400 truncate">{report.title}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 capitalize">
                {report.type}
              </span>
              <span className="text-xs text-zinc-600">{formatDate(report.created_at)}</span>
            </div>
            <h1 className="text-2xl font-bold text-white leading-tight">{report.title}</h1>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={deleting}
            className="flex-shrink-0 p-2 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Delete report"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Content — strip leading h1 since title is already shown in the header */}
        <div
          ref={contentRef}
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(report.content.replace(/^#[^\n]*\n+/, '')) }}
        />
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          title={report.title}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
