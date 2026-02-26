/**
 * Business Context — portable intelligence requires understanding the user's business
 */

import { setProactivitySetting, getProactivitySetting } from './db';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface BusinessContext {
  business_name?: string;
  business_description?: string;
  products?: string[]; // Array of product names/descriptions
  competitors?: string[]; // Competitor names
  content_sites?: string[]; // Domains where content is published
  primary_goal?: 'traffic' | 'signups' | 'revenue' | 'awareness';
  industry?: string;
  source: 'openclaw_workspace' | 'manual' | 'incomplete';
  last_updated: number;
}

const WORKSPACE_PATH = '/root/.openclaw/workspace';

/**
 * Read OpenClaw workspace files to understand the business context
 */
export async function readOpenClawWorkspace(): Promise<Partial<BusinessContext>> {
  const context: Partial<BusinessContext> = {};
  
  try {
    // Try to read MEMORY.md, USER.md, SOUL.md
    const files = ['MEMORY.md', 'USER.md', 'SOUL.md', 'TOOLS.md'];
    let combinedContent = '';
    
    for (const file of files) {
      const path = join(WORKSPACE_PATH, file);
      if (existsSync(path)) {
        const content = await readFile(path, 'utf-8');
        combinedContent += `\n\n=== ${file} ===\n${content}`;
      }
    }
    
    if (!combinedContent) return { source: 'incomplete' };
    
    // Parse business information (simple extraction for now)
    const lower = combinedContent.toLowerCase();
    
    // Extract business name
    const businessMatch = combinedContent.match(/(?:business|company|product)(?:\s+name)?[:\s]+([^\n.]+)/i);
    if (businessMatch) context.business_name = businessMatch[1].trim();
    
    // Extract products (look for product mentions)
    const products: string[] = [];
    const productMatches = combinedContent.matchAll(/(?:product|app|service|plugin)[:\s]+([^\n.]+)/gi);
    for (const match of productMatches) {
      const product = match[1].trim();
      if (product.length < 100 && !products.includes(product)) {
        products.push(product);
      }
    }
    if (products.length > 0) context.products = products.slice(0, 5);
    
    // Extract competitors
    const competitors: string[] = [];
    const compMatches = combinedContent.matchAll(/(?:competitor|versus|vs|alternative to)[:\s]+([^\n.]+)/gi);
    for (const match of compMatches) {
      const comp = match[1].trim();
      if (comp.length < 50 && !competitors.includes(comp)) {
        competitors.push(comp);
      }
    }
    if (competitors.length > 0) context.competitors = competitors.slice(0, 5);
    
    // Extract content sites (look for domain mentions)
    const sites: string[] = [];
    const siteMatches = combinedContent.matchAll(/(?:https?:\/\/)?([a-z0-9-]+\.[a-z]{2,})/gi);
    for (const match of siteMatches) {
      const site = match[1].toLowerCase();
      if (!site.includes('github') && !site.includes('google') && !sites.includes(site)) {
        sites.push(site);
      }
    }
    if (sites.length > 0) context.content_sites = sites.slice(0, 5);
    
    // Determine primary goal (look for keywords)
    if (lower.includes('grow traffic') || lower.includes('seo')) {
      context.primary_goal = 'traffic';
    } else if (lower.includes('signups') || lower.includes('users')) {
      context.primary_goal = 'signups';
    } else if (lower.includes('revenue') || lower.includes('sales')) {
      context.primary_goal = 'revenue';
    }
    
    // Extract industry
    if (lower.includes('wordpress') || lower.includes('plugin')) {
      context.industry = 'WordPress / Plugins';
    } else if (lower.includes('saas')) {
      context.industry = 'SaaS';
    } else if (lower.includes('ecommerce')) {
      context.industry = 'E-commerce';
    }
    
    context.source = 'openclaw_workspace';
    return context;
    
  } catch (error) {
    console.error('Failed to read OpenClaw workspace:', error);
    return { source: 'incomplete' };
  }
}

/**
 * Get stored business context from DB
 */
export function getBusinessContext(): BusinessContext | null {
  const stored = getProactivitySetting('business_context');
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as BusinessContext;
  } catch {
    return null;
  }
}

/**
 * Save business context to DB
 */
export function saveBusinessContext(context: BusinessContext): void {
  context.last_updated = Date.now();
  setProactivitySetting('business_context', JSON.stringify(context));
}

/**
 * Merge OpenClaw workspace data with manual input
 */
export async function initializeBusinessContext(manualInput?: Partial<BusinessContext>): Promise<BusinessContext> {
  // Start with OpenClaw workspace
  const workspaceContext = await readOpenClawWorkspace();
  
  // Merge with manual input (manual input takes precedence)
  const merged: BusinessContext = {
    business_name: manualInput?.business_name || workspaceContext.business_name || 'My Business',
    business_description: manualInput?.business_description || workspaceContext.business_description || '',
    products: manualInput?.products || workspaceContext.products || [],
    competitors: manualInput?.competitors || workspaceContext.competitors || [],
    content_sites: manualInput?.content_sites || workspaceContext.content_sites || [],
    primary_goal: manualInput?.primary_goal || workspaceContext.primary_goal || 'traffic',
    industry: manualInput?.industry || workspaceContext.industry || '',
    source: manualInput ? 'manual' : (workspaceContext.source || 'incomplete'),
    last_updated: Date.now(),
  };
  
  saveBusinessContext(merged);
  return merged;
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(): boolean {
  const setting = getProactivitySetting('onboarding_complete');
  return setting === 'true';
}

/**
 * Mark onboarding as complete
 */
export function completeOnboarding(): void {
  setProactivitySetting('onboarding_complete', 'true');
}

/**
 * Check if business context is sufficiently filled
 */
export function hasMinimalContext(context: BusinessContext | null): boolean {
  if (!context) return false;
  return !!(
    context.business_name &&
    (context.products?.length || context.business_description) &&
    context.primary_goal
  );
}
