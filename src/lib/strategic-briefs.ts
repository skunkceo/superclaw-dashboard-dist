/**
 * Strategic Briefs — AI-generated strategic summaries for the business
 */

import { v4 as uuidv4 } from 'uuid';
import db from './db';

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS strategic_briefs (
    id TEXT PRIMARY KEY,
    current_focus TEXT NOT NULL,
    active_bets TEXT NOT NULL,
    risks_blockers TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    created_by TEXT DEFAULT 'clawd'
  );
  CREATE INDEX IF NOT EXISTS idx_briefs_created ON strategic_briefs(created_at);
`);

export interface StrategicBrief {
  id: string;
  current_focus: string;
  active_bets: string; // JSON array of strings
  risks_blockers: string; // JSON array of strings
  created_at: number;
  created_by: string;
}

export function getLatestBrief(): StrategicBrief | null {
  const row = db.prepare('SELECT * FROM strategic_briefs ORDER BY created_at DESC LIMIT 1').get() as StrategicBrief | undefined;
  return row || null;
}

export function getAllBriefs(limit = 10): StrategicBrief[] {
  return db.prepare('SELECT * FROM strategic_briefs ORDER BY created_at DESC LIMIT ?').all(limit) as StrategicBrief[];
}

export function createBrief(brief: Omit<StrategicBrief, 'id' | 'created_at'>): StrategicBrief {
  const id = uuidv4();
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO strategic_briefs (id, current_focus, active_bets, risks_blockers, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, brief.current_focus, brief.active_bets, brief.risks_blockers, brief.created_by);
  
  return {
    id,
    ...brief,
    created_at: now,
  };
}

export function deleteBrief(id: string): void {
  db.prepare('DELETE FROM strategic_briefs WHERE id = ?').run(id);
}

/**
 * Generate a strategic brief based on current intel, suggestions, activity, and business context.
 * Uses business context to create personalized strategic guidance.
 */
export async function generateStrategicBrief(context?: { 
  business_name?: string; 
  products?: string[]; 
  primary_goal?: string;
  competitors?: string[];
}): Promise<StrategicBrief> {
  // In production, this would call Clawd to analyze the current state and synthesize strategy.
  // For now, generate a contextual template based on business context.
  
  const businessName = context?.business_name || 'Your business';
  const products = context?.products?.join(', ') || 'your products';
  const goal = context?.primary_goal || 'growth';
  const competitors = context?.competitors?.slice(0, 3).join(', ') || 'competitors';
  
  const brief = {
    current_focus: `${goal === 'traffic' ? 'SEO content velocity' : goal === 'signups' ? 'Conversion optimization' : 'Revenue growth'} — building authority and visibility for ${products} through targeted content and strategic positioning.`,
    active_bets: JSON.stringify([
      `Content marketing is the primary acquisition channel for ${businessName}`,
      `Comparison content (vs ${competitors}) drives high-intent traffic`,
      `Automating intelligence gathering reduces manual research time`,
    ]),
    risks_blockers: JSON.stringify([
      'Limited bandwidth for manual content production',
      'Need better competitive intelligence on market moves',
      'Content-to-conversion pipeline needs optimization',
    ]),
    created_by: 'clawd',
  };
  
  return createBrief(brief);
}
