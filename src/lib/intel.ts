/**
 * Intelligence gathering module — fetches market signals via Brave Search
 * and stores them as intel_items in the database.
 */

import { createIntelItem, getAllIntelItems, setProactivitySetting, IntelItem } from './db';
import { v4 as uuidv4 } from 'uuid';

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

const SEARCH_QUERIES: Array<{ query: string; category: IntelItem['category']; source: string }> = [
  // ── Keyword opportunities (easy-win SEO angles) ──────────────────────────
  { query: '"WordPress CRM" -hubspot -salesforce plugin alternative', category: 'seo', source: 'brave' },
  { query: 'best free WordPress CRM plugin 2026', category: 'seo', source: 'brave' },
  { query: 'WordPress contact form that saves to CRM', category: 'seo', source: 'brave' },
  { query: 'WPForms alternatives cheaper', category: 'seo', source: 'brave' },
  { query: 'WordPress form builder with lead management', category: 'seo', source: 'brave' },
  { query: 'WordPress CRM deal pipeline small business', category: 'seo', source: 'brave' },
  { query: 'Gravity Forms vs WPForms 2026 comparison', category: 'seo', source: 'brave' },
  { query: 'WordPress landing page builder plugin 2026', category: 'seo', source: 'brave' },

  // ── Product / offer gaps ─────────────────────────────────────────────────
  { query: 'WordPress all-in-one business plugin suite', category: 'opportunity', source: 'brave' },
  { query: 'WordPress plugin replace Kajabi ActiveCampaign', category: 'opportunity', source: 'brave' },
  { query: 'small business WordPress automation plugin', category: 'opportunity', source: 'brave' },
  { query: 'self-hosted CRM SaaS alternative 2026', category: 'opportunity', source: 'brave' },

  // ── Competitor signals ───────────────────────────────────────────────────
  { query: 'WPForms pricing increase 2026', category: 'competitor', source: 'brave' },
  { query: 'FluentCRM FluentForms new features 2026', category: 'competitor', source: 'brave' },
  { query: 'Gravity Forms Ninja Forms update news', category: 'competitor', source: 'brave' },

  // ── Market signals ───────────────────────────────────────────────────────
  { query: 'WordPress plugin market trends 2026', category: 'market', source: 'brave' },
  { query: 'small business SaaS fatigue moving to WordPress', category: 'market', source: 'brave' },

  // ── WordPress ecosystem ──────────────────────────────────────────────────
  { query: 'WordPress blocks Full Site Editing business plugins', category: 'wordpress', source: 'brave' },
];

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

async function searchBrave(query: string): Promise<BraveResult[]> {
  if (!BRAVE_API_KEY) return [];

  try {
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('count', '3');
    url.searchParams.set('freshness', 'pm'); // past month

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
    });

    if (!response.ok) return [];
    const data = await response.json() as { web?: { results?: BraveResult[] } };
    return data?.web?.results || [];
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dedupeTitle(title: string, existing: IntelItem[]): boolean {
  const normalized = title.toLowerCase().slice(0, 80);
  return existing.some(item => item.title.toLowerCase().slice(0, 80) === normalized);
}

function scoreRelevance(title: string, description: string, category: string): number {
  const text = (title + ' ' + description).toLowerCase();
  let score = 40;

  // Boost for Skunk-relevant keywords
  const highValue = ['wordpress', 'crm', 'forms', 'plugin', 'small business', 'saas'];
  const medValue = ['update', 'new', 'launch', 'release', 'growth', 'market'];
  const competitors = ['wpforms', 'gravity forms', 'fluentcrm', 'hubspot', 'fluent forms', 'ninja forms'];

  for (const kw of highValue) if (text.includes(kw)) score += 8;
  for (const kw of medValue) if (text.includes(kw)) score += 4;
  for (const kw of competitors) if (text.includes(kw)) score += 10;
  if (category === 'competitor') score += 5;
  if (category === 'opportunity') score += 5;

  return Math.min(score, 100);
}

export interface RefreshResult {
  queriesRun: number;
  itemsAdded: number;
  itemsSkipped: number;
  errors: string[];
}

export async function runIntelRefresh(): Promise<RefreshResult> {
  const result: RefreshResult = { queriesRun: 0, itemsAdded: 0, itemsSkipped: 0, errors: [] };

  // Load existing items to deduplicate
  const existing = getAllIntelItems({ limit: 500 });

  for (const { query, category, source } of SEARCH_QUERIES) {
    try {
      const results = await searchBrave(query);
      result.queriesRun++;

      for (const r of results) {
        if (!r.title || !r.description) { result.itemsSkipped++; continue; }
        if (dedupeTitle(r.title, existing)) { result.itemsSkipped++; continue; }

        const item: Omit<IntelItem, 'created_at' | 'read_at'> = {
          id: uuidv4(),
          category,
          title: r.title.slice(0, 200),
          summary: r.description.slice(0, 500),
          url: r.url || null,
          source,
          relevance_score: scoreRelevance(r.title, r.description, category),
        };

        createIntelItem(item);
        existing.push({ ...item, created_at: Date.now(), read_at: null });
        result.itemsAdded++;
      }

      // Respect Brave free tier rate limit (1 req/sec)
      await sleep(1100);
    } catch (err) {
      result.errors.push(`Query "${query}" failed: ${err}`);
    }
  }

  setProactivitySetting('last_intel_refresh', Date.now().toString());
  return result;
}

export async function generateSuggestionsFromIntel(): Promise<void> {
  // This is called after an intel refresh to generate suggestions based on fresh data.
  // The actual suggestion generation is done by Clawd (via the cron system calling the
  // proactivity/refresh endpoint with generate=true), so this is a lightweight trigger.
  setProactivitySetting('last_suggestion_run', Date.now().toString());
}
