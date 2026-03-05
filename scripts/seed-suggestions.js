#!/usr/bin/env node
/**
 * seed-suggestions.js
 * Seed the initial standing suggestions into the SuperClaw database.
 * Safe to run multiple times — skips existing.
 *
 * Usage: node scripts/seed-suggestions.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
const db = new Database(path.join(dataDir, 'superclaw.db'));

const STANDING_SUGGESTIONS = [

  // ─── Micro Sites ─────────────────────────────────────────────────────────────

  {
    title: 'Build wpformcost.com — WordPress form plugin pricing comparison tool',
    why: 'People Google "how much does WPForms cost" thousands of times a month. A micro site that compares WPForms, Gravity Forms, Ninja Forms, and SkunkForms pricing side-by-side captures that intent and funnels to us. One page, no CMS, pure HTML — build in a day.',
    effort: 'low', impact: 'high', impact_score: 82, category: 'micro-site', priority: 2,
  },
  {
    title: 'Build a free "WordPress CRM fit finder" quiz micro site',
    why: 'Quiz funnels convert at 2-3x standard landing pages. A 5-question quiz ("How many contacts? Do you need deals? Email campaigns?") that ends with a recommendation for SkunkCRM, FluentCRM, or HubSpot — with SkunkForms/SkunkCRM always in the mix. Collect emails as part of the result delivery.',
    effort: 'medium', impact: 'high', impact_score: 85, category: 'micro-site', priority: 2,
  },
  {
    title: 'Build wpcrmcost.com — CRM pricing comparison calculator',
    why: 'Same play as the form cost site but for CRMs. Show real monthly cost at 500, 1000, 5000 contacts for HubSpot, ActiveCampaign, FluentCRM, and SkunkCRM. SkunkCRM wins the comparison at every tier. Rank for "WordPress CRM pricing" with zero content effort.',
    effort: 'low', impact: 'high', impact_score: 80, category: 'micro-site', priority: 2,
  },
  {
    title: 'Build a "WordPress plugin stack calculator" — show monthly SaaS spend vs WordPress plugins',
    why: 'The whole Skunk pitch is "stop paying SaaS tax." Visualise it. Let someone enter their current tools (HubSpot, Typeform, Kajabi etc.) and show exactly what they are spending vs what the Skunk suite costs. Shareable, embeddable, goes viral in WP communities.',
    effort: 'medium', impact: 'high', impact_score: 88, category: 'micro-site', priority: 1,
  },

  // ─── Mini SaaS / Standalone Products ─────────────────────────────────────────

  {
    title: 'Ship a free "WordPress form spam detector" — standalone tool',
    why: 'Spam in contact forms is one of the most Googled WordPress problems. A free tool that analyses a form submission log (paste in) and scores spam likelihood builds goodwill and drives SkunkForms discovery. Can be a page on skunkforms.com/tools/spam-detector.',
    effort: 'medium', impact: 'high', impact_score: 78, category: 'mini-saas', priority: 2,
  },
  {
    title: 'Launch a free WordPress lead score calculator',
    why: 'SkunkCRM angle: "not all leads are equal." Build a tool where someone defines their scoring criteria (job title, company size, pages visited) and we generate the scoring logic as a JSON snippet they can paste into SkunkCRM. Creates a tight loop from the tool to the product.',
    effort: 'medium', impact: 'medium', impact_score: 70, category: 'mini-saas', priority: 3,
  },
  {
    title: 'Build a "WordPress plugin conflict checker" tool',
    why: 'Plugin conflicts are the #1 WordPress headache. A tool that takes two plugin slugs and checks their known conflict history (from the WordPress.org support forums via API) could get massive organic traction. Low build cost, high shareability, builds brand trust.',
    effort: 'high', impact: 'high', impact_score: 82, category: 'mini-saas', priority: 2,
  },
  {
    title: 'Build a free "form abandonment estimator" — show the revenue leaking through bad forms',
    why: 'Most businesses have no idea how much revenue their broken/ugly forms cost them. Build a calculator: "Your form gets X visits, converts at Y%, average order $Z — here is what you are losing." Output: a dollar figure and a CTA to SkunkForms. Compelling and shareable.',
    effort: 'low', impact: 'high', impact_score: 83, category: 'mini-saas', priority: 1,
  },

  // ─── Chunkier Product Moves ───────────────────────────────────────────────────

  {
    title: 'Build a public Skunk product roadmap with upvoting — let users drive prioritisation',
    why: 'Public roadmaps build trust, create content, and generate email signups. Every user who votes is a warm lead. Pairs perfectly with the "cofounder-level transparency" positioning. Can live at skunkglobal.com/roadmap — already exists but needs activation.',
    effort: 'medium', impact: 'high', impact_score: 80, category: 'product', priority: 2,
  },
  {
    title: 'Ship SkunkForms "Webhook Recipes" — pre-built webhook templates for Slack, Notion, Airtable',
    why: 'The webhook feature exists but nobody knows what to do with it. 10 pre-built templates (e.g. "send form submission to Slack #leads", "add to Airtable CRM") turn a developer feature into a no-code power feature. Each template is also an SEO landing page.',
    effort: 'medium', impact: 'high', impact_score: 79, category: 'product', priority: 2,
  },
  {
    title: 'Build a "Contact Form 7 migration wizard" — one-click import into SkunkForms',
    why: 'CF7 has 5M+ active installs and is notoriously painful to extend. The importer code is already built at code/cf7-importer/. Ship it as a proper in-plugin wizard with a "migrate from CF7" CTA. This is the single best acquisition move for SkunkForms.',
    effort: 'medium', impact: 'high', impact_score: 92, category: 'product', priority: 1,
  },
  {
    title: 'Build SkunkForms "Form Analytics" — conversion rate, drop-off per field, time-to-complete',
    why: 'No WordPress form plugin has decent built-in analytics. Showing users which fields cause abandonment is a Pro-tier killer feature. Build a lightweight JS snippet that fires on field blur and completion, stores to WP, renders in a dashboard panel.',
    effort: 'high', impact: 'high', impact_score: 90, category: 'product', priority: 1,
  },

  // ─── Creative Marketing ───────────────────────────────────────────────────────

  {
    title: 'Launch a "Skunk vs Big SaaS" campaign — honest teardown series',
    why: 'Record a 5-min screen recording: "I cancelled my $X/month HubSpot and set this up in WordPress for $50/year." Post to YouTube, Reddit, LinkedIn. No production value needed — authenticity is the point. This is the Skunk brand in action.',
    effort: 'medium', impact: 'high', impact_score: 85, category: 'marketing', priority: 2,
  },
  {
    title: 'Write a "Founders Club" case study series — real users, real installs, real results',
    why: 'Social proof is our biggest gap. Even 3-5 early installers with a short Q+A case study transforms the site. Reach out to the early downloader contacts already in SkunkCRM. A single authentic case study is worth 100 blog posts.',
    effort: 'medium', impact: 'high', impact_score: 88, category: 'marketing', priority: 1,
  },

];

let added = 0;
let skipped = 0;

for (const s of STANDING_SUGGESTIONS) {
  const existing = db.prepare('SELECT id FROM suggestions WHERE title = ? AND status NOT IN (?, ?)').get(s.title, 'dismissed', 'completed');
  if (existing) { skipped++; continue; }

  db.prepare(`
    INSERT INTO suggestions (id, title, why, effort, impact, impact_score, category, source_intel_ids, status, priority, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'pending', ?, NULL, ?)
  `).run(randomUUID(), s.title, s.why, s.effort, s.impact, s.impact_score, s.category, s.priority, Date.now());

  added++;
}

console.log(`Seeded ${added} suggestions (${skipped} already existed).`);
