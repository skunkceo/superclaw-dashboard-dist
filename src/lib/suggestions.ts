/**
 * Suggestion generation module.
 * Analyses recent intel items and generates actionable suggestions for Skunk Global.
 */

import { getAllIntelItems, createSuggestion, getAllSuggestions, IntelItem, setProactivitySetting } from './db';
import { v4 as uuidv4 } from 'uuid';

interface SuggestionTemplate {
  titleFn: (item: IntelItem) => string;
  whyFn: (item: IntelItem) => string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  impact_score: number;
  category: 'content' | 'seo' | 'code' | 'marketing' | 'research' | 'product';
  priority: number;
  matchFn: (item: IntelItem) => boolean;
}

const SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  // Competitor intel → research task
  {
    matchFn: (i) => i.category === 'competitor',
    titleFn: (i) => `Research: ${i.title.slice(0, 60)}`,
    whyFn: (i) => `Competitor move detected: "${i.summary.slice(0, 150)}". Worth understanding if this changes the competitive landscape for SkunkForms or SkunkCRM.`,
    effort: 'low',
    impact: 'medium',
    impact_score: 60,
    category: 'research',
    priority: 2,
  },
  // SEO intel → content task
  {
    matchFn: (i) => i.category === 'seo' && i.relevance_score >= 50,
    titleFn: (i) => `SEO content: Write about "${i.title.slice(0, 50)}"`,
    whyFn: (i) => `High-relevance SEO signal: "${i.summary.slice(0, 150)}". Creating targeted content here could capture search traffic.`,
    effort: 'medium',
    impact: 'high',
    impact_score: 75,
    category: 'content',
    priority: 2,
  },
  // Opportunity intel → product/marketing task
  {
    matchFn: (i) => i.category === 'opportunity' && i.relevance_score >= 55,
    titleFn: (i) => `Opportunity: ${i.title.slice(0, 55)}`,
    whyFn: (i) => `Market opportunity spotted: "${i.summary.slice(0, 150)}". Could shape product positioning or content strategy.`,
    effort: 'low',
    impact: 'medium',
    impact_score: 65,
    category: 'marketing',
    priority: 3,
  },
  // Market intel → strategy review
  {
    matchFn: (i) => i.category === 'market' && i.relevance_score >= 60,
    titleFn: () => 'Market pulse: Review latest WordPress/CRM market signals',
    whyFn: (i) => `Several market signals detected. Latest: "${i.summary.slice(0, 120)}". Worth a quick strategy review to ensure Skunk is positioned correctly.`,
    effort: 'low',
    impact: 'medium',
    impact_score: 55,
    category: 'research',
    priority: 3,
  },
  // WordPress ecosystem → product awareness
  {
    matchFn: (i) => i.category === 'wordpress' && i.relevance_score >= 55,
    titleFn: (i) => `WordPress ecosystem: ${i.title.slice(0, 50)}`,
    whyFn: (i) => `WordPress ecosystem update: "${i.summary.slice(0, 150)}". Check if this affects Skunk plugin compatibility or creates a positioning opportunity.`,
    effort: 'low',
    impact: 'low',
    impact_score: 40,
    category: 'research',
    priority: 4,
  },
];

// Standing suggestions that should appear periodically (not intel-based)
const STANDING_SUGGESTIONS: Array<Omit<ReturnType<typeof createStandingSuggestion>, never>> = [];

function createStandingSuggestion(title: string, why: string, effort: 'low' | 'medium' | 'high', impact: 'low' | 'medium' | 'high', impact_score: number, category: 'content' | 'seo' | 'code' | 'marketing' | 'research' | 'product', priority: number) {
  return { title, why, effort, impact, impact_score, category, priority };
}

// Standing suggestions seeded on first run
const STANDING_DEFAULTS = [
  createStandingSuggestion(
    'Write a SkunkForms vs WPForms comparison post',
    'Comparison content drives high-intent traffic. Users searching "SkunkForms vs WPForms" are ready to choose — we should own that content.',
    'medium', 'high', 80, 'content', 2
  ),
  createStandingSuggestion(
    'Update SkunkCRM homepage H1 and meta description for CRM keywords',
    'Current homepage is thin on CRM keyword signals. A targeted H1 and meta could improve ranking for "WordPress CRM plugin" searches.',
    'low', 'high', 75, 'seo', 2
  ),
  createStandingSuggestion(
    'Audit SkunkForms free plugin for missing features vs WPForms free',
    'Knowing the gap helps with content ("what SkunkForms does that WPForms free doesn\'t") and roadmap decisions.',
    'medium', 'medium', 60, 'product', 3
  ),
  createStandingSuggestion(
    'Write Reddit community post about WordPress form builder frustrations',
    'Reddit is our highest potential organic channel. A thoughtful post in r/Wordpress or r/webdev addressing form builder pain points drives traffic and trust.',
    'low', 'high', 70, 'marketing', 2
  ),
  createStandingSuggestion(
    'Generate 10 new blog post ideas for skunkcrm.com/resources/',
    'Content velocity is our main SEO lever right now. The resources section needs consistent new posts to build topical authority.',
    'low', 'medium', 60, 'content', 3
  ),
  createStandingSuggestion(
    'Run PageSpeed audit on SkunkForms and SkunkCRM landing pages',
    'Core Web Vitals affect Google rankings. A quick audit tells us if there are quick wins that could boost SEO performance.',
    'low', 'medium', 55, 'seo', 3
  ),
];

function isDuplicate(title: string, existing: Array<{ title: string; status: string }>): boolean {
  const norm = title.toLowerCase().slice(0, 60);
  // Respect all statuses — never recreate a suggestion that already exists in any state,
  // including dismissed. This prevents dismissed suggestions from reappearing after a refresh.
  return existing.some(s => s.title.toLowerCase().slice(0, 60) === norm);
}

export interface GenerateResult {
  fromIntel: number;
  standing: number;
  skipped: number;
}

export async function generateSuggestionsFromIntel(): Promise<GenerateResult> {
  const result: GenerateResult = { fromIntel: 0, standing: 0, skipped: 0 };

  // Get recent intel (last 48h)
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recentIntel = getAllIntelItems({ limit: 100 }).filter(i => i.created_at > cutoff);
  const existingSuggestions = getAllSuggestions({ limit: 500 });

  // Generate from intel
  for (const item of recentIntel) {
    for (const template of SUGGESTION_TEMPLATES) {
      if (!template.matchFn(item)) continue;

      const title = template.titleFn(item);
      if (isDuplicate(title, existingSuggestions)) { result.skipped++; continue; }

      createSuggestion({
        id: uuidv4(),
        title,
        why: template.whyFn(item),
        effort: template.effort,
        impact: template.impact,
        impact_score: template.impact_score,
        category: template.category,
        source_intel_ids: JSON.stringify([item.id]),
        status: 'pending',
        priority: template.priority,
        notes: null,
        linear_issue_id: null,
        linear_identifier: null,
        linear_url: null,
      });

      result.fromIntel++;
      break; // one suggestion per intel item
    }
  }

  // Seed standing suggestions if not present
  for (const s of STANDING_DEFAULTS) {
    if (isDuplicate(s.title, existingSuggestions)) { result.skipped++; continue; }
    createSuggestion({
      id: uuidv4(),
      ...s,
      source_intel_ids: '[]',
      status: 'pending',
      notes: null,
      linear_issue_id: null,
      linear_identifier: null,
      linear_url: null,
    });
    result.standing++;
  }

  setProactivitySetting('last_suggestion_run', Date.now().toString());
  return result;
}
