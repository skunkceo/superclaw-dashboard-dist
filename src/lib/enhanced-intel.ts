/**
 * Enhanced intelligence gathering — smarter keyword and product radar signals
 */

import { createIntelItem, getAllIntelItems, IntelItem } from './db';
import { v4 as uuidv4 } from 'uuid';

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

async function searchBrave(query: string, count = 5): Promise<BraveResult[]> {
  if (!BRAVE_API_KEY) return [];

  try {
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('count', count.toString());
    url.searchParams.set('freshness', 'pm');

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

/**
 * Classify a search result as keyword opportunity or product radar
 */
function classifySignal(result: BraveResult, query: string, contentSites?: string[]): { 
  type: 'keyword' | 'product' | 'skip'; 
  category: IntelItem['category'];
  angle?: string;
  targetSite?: string;
} {
  const title = result.title.toLowerCase();
  const desc = result.description.toLowerCase();
  const combined = title + ' ' + desc;
  
  // Skip if it's just a generic listicle blog post being shown as a "product idea"
  if (
    (title.includes('best ') || title.includes('top ')) &&
    (combined.includes('list') || combined.includes('comparison') || combined.includes('review')) &&
    !contentSites?.some(site => combined.includes(site.toLowerCase()))
  ) {
    return { type: 'skip', category: 'market' };
  }
  
  // Keyword opportunity signals
  if (
    query.includes('free') ||
    query.includes('alternative') ||
    query.includes('vs') ||
    query.includes('comparison') ||
    query.includes('how to')
  ) {
    // Use first content site as default target, or domain-derived logic
    const targetSite = contentSites?.[0] || 'your-site.com';
    
    let angle = 'tutorial';
    if (query.includes('vs') || query.includes('comparison')) angle = 'comparison post';
    if (query.includes('best') || query.includes('alternative')) angle = 'listicle';
    if (query.includes('how to')) angle = 'tutorial';
    
    return { type: 'keyword', category: 'keyword', angle, targetSite };
  }
  
  // Product radar signals — real feature requests, frustrations, gaps
  if (
    combined.includes('frustrated') ||
    combined.includes('missing') ||
    combined.includes('wish') ||
    combined.includes('need') ||
    combined.includes('alternative') ||
    combined.includes('disappointed')
  ) {
    return { type: 'product', category: 'opportunity' };
  }
  
  // Reddit/forum discussions
  if (result.url.includes('reddit.com') || result.url.includes('forum')) {
    return { type: 'product', category: 'opportunity' };
  }
  
  // Competitor updates
  if (
    (combined.includes('wpforms') || combined.includes('gravity forms') || combined.includes('fluentcrm')) &&
    (combined.includes('update') || combined.includes('release') || combined.includes('new'))
  ) {
    return { type: 'product', category: 'competitor' };
  }
  
  // Default to market signal
  return { type: 'skip', category: 'market' };
}

/**
 * Generate dynamic keyword queries based on business context
 */
function generateKeywordQueries(context?: {
  products?: string[];
  competitors?: string[];
  industry?: string;
}): string[] {
  const products = context?.products || [];
  const competitors = context?.competitors || [];
  const industry = context?.industry || '';
  
  const queries: string[] = [];
  
  // Generic high-value queries
  queries.push('best alternative cheaper pricing', 'free vs paid comparison 2026');
  
  // Product-specific queries
  for (const product of products.slice(0, 3)) {
    queries.push(`${product} alternative`, `how to use ${product}`, `${product} review`);
  }
  
  // Competitor comparison queries
  for (const comp of competitors.slice(0, 3)) {
    queries.push(`vs ${comp} comparison`, `${comp} alternative`);
  }
  
  // Industry-specific queries
  if (industry.toLowerCase().includes('wordpress')) {
    queries.push('WordPress plugin tutorial', 'best WordPress tools 2026');
  } else if (industry.toLowerCase().includes('saas')) {
    queries.push('SaaS comparison', 'self-hosted alternative');
  }
  
  return queries.slice(0, 10);
}

/**
 * Generate dynamic product radar queries based on business context
 */
function generateProductRadarQueries(context?: {
  products?: string[];
  competitors?: string[];
  industry?: string;
}): string[] {
  const products = context?.products || [];
  const competitors = context?.competitors || [];
  const industry = context?.industry || '';
  
  const queries: string[] = [];
  
  // Reddit signals for products
  for (const product of products.slice(0, 2)) {
    queries.push(`site:reddit.com ${product} frustrated`, `site:reddit.com ${product} alternative`);
  }
  
  // Competitor frustration signals
  for (const comp of competitors.slice(0, 2)) {
    queries.push(`site:reddit.com ${comp} disappointed`, `${comp} missing features`);
  }
  
  // Industry-specific radar
  if (industry) {
    queries.push(`site:reddit.com ${industry} needs`, `${industry} automation`);
  }
  
  return queries.slice(0, 6);
}

interface EnhancedRefreshResult {
  keywords: { added: number; skipped: number };
  productRadar: { added: number; skipped: number };
  errors: string[];
}

export async function runEnhancedIntelRefresh(context?: {
  products?: string[];
  competitors?: string[];
  industry?: string;
  content_sites?: string[];
}): Promise<EnhancedRefreshResult> {
  const result: EnhancedRefreshResult = {
    keywords: { added: 0, skipped: 0 },
    productRadar: { added: 0, skipped: 0 },
    errors: [],
  };
  
  const existing = getAllIntelItems({ limit: 500 });
  
  function isDupe(title: string): boolean {
    const norm = title.toLowerCase().slice(0, 80);
    return existing.some(i => i.title.toLowerCase().slice(0, 80) === norm);
  }
  
  // Generate dynamic queries based on business context
  const keywordQueries = generateKeywordQueries(context);
  const productRadarQueries = generateProductRadarQueries(context);
  
  // Fetch keyword opportunities
  for (const query of keywordQueries) {
    try {
      const results = await searchBrave(query, 5);
      
      for (const r of results) {
        if (!r.title || !r.description) continue;
        
        const classification = classifySignal(r, query, context?.content_sites);
        if (classification.type === 'skip') {
          result.keywords.skipped++;
          continue;
        }
        
        if (classification.type === 'keyword') {
          if (isDupe(r.title)) {
            result.keywords.skipped++;
            continue;
          }
          
          const summary = `${r.description.slice(0, 300)}. Suggested angle: ${classification.angle}. Target site: ${classification.targetSite}.`;
          
          createIntelItem({
            id: uuidv4(),
            category: 'keyword',
            title: r.title.slice(0, 200),
            summary,
            url: r.url || null,
            source: 'brave',
            relevance_score: 70,
            insight: null,
          });
          
          existing.push({
            id: uuidv4(),
            category: 'keyword',
            title: r.title,
            summary,
            url: r.url,
            source: 'brave',
            relevance_score: 70,
            created_at: Date.now(),
            read_at: null,
            insight: null,
          });
          
          result.keywords.added++;
        }
      }
      
      await sleep(1100);
    } catch (err) {
      result.errors.push(`Keyword query "${query}" failed: ${err}`);
    }
  }
  
  // Fetch product radar signals
  for (const query of productRadarQueries) {
    try {
      const results = await searchBrave(query, 3);
      
      for (const r of results) {
        if (!r.title || !r.description) continue;
        if (isDupe(r.title)) {
          result.productRadar.skipped++;
          continue;
        }
        
        const isReddit = r.url.includes('reddit.com');
        const source = isReddit ? 'Reddit' : 'Web';
        const summary = `${source} signal: ${r.description.slice(0, 300)}`;
        
        createIntelItem({
          id: uuidv4(),
          category: 'opportunity',
          title: r.title.slice(0, 200),
          summary,
          url: r.url || null,
          source: 'brave',
          relevance_score: isReddit ? 75 : 60,
          insight: null,
        });
        
        existing.push({
          id: uuidv4(),
          category: 'opportunity',
          title: r.title,
          summary,
          url: r.url,
          source: 'brave',
          relevance_score: isReddit ? 75 : 60,
          created_at: Date.now(),
          read_at: null,
          insight: null,
        });
        
        result.productRadar.added++;
      }
      
      await sleep(1100);
    } catch (err) {
      result.errors.push(`Product radar query "${query}" failed: ${err}`);
    }
  }
  
  return result;
}
