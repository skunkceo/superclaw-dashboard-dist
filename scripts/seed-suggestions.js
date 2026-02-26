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

const dataDir = process.env.SUPERCLAW_DATA_DIR || path.join(os.homedir(), '.superclaw');
const db = new Database(path.join(dataDir, 'superclaw.db'));

const STANDING_SUGGESTIONS = [
  {
    title: 'Write a SkunkForms vs WPForms comparison post',
    why: "Comparison content drives high-intent traffic. Users searching \"SkunkForms vs WPForms\" are ready to choose — we should own that content.",
    effort: 'medium', impact: 'high', impact_score: 80, category: 'content', priority: 2,
  },
  {
    title: 'Update SkunkCRM homepage H1 and meta description for CRM keywords',
    why: "Current homepage is thin on CRM keyword signals. A targeted H1 and meta could improve ranking for \"WordPress CRM plugin\" searches.",
    effort: 'low', impact: 'high', impact_score: 75, category: 'seo', priority: 2,
  },
  {
    title: 'Audit SkunkForms free plugin features vs WPForms free tier',
    why: "Knowing the gap helps with content and roadmap decisions. Can turn findings into a feature comparison blog post.",
    effort: 'medium', impact: 'medium', impact_score: 60, category: 'product', priority: 3,
  },
  {
    title: 'Write Reddit community post about WordPress form builder frustrations',
    why: "Reddit is our highest potential organic channel. A thoughtful post in r/Wordpress or r/webdev addressing form builder pain points drives traffic and trust.",
    effort: 'low', impact: 'high', impact_score: 70, category: 'marketing', priority: 2,
  },
  {
    title: 'Generate 10 new blog post ideas for skunkcrm.com/resources/',
    why: "Content velocity is our main SEO lever right now. The resources section needs consistent new posts to build topical authority.",
    effort: 'low', impact: 'medium', impact_score: 60, category: 'content', priority: 3,
  },
  {
    title: 'Run PageSpeed audit on SkunkForms and SkunkCRM landing pages',
    why: "Core Web Vitals affect Google rankings. A quick audit tells us if there are quick wins that could boost SEO performance.",
    effort: 'low', impact: 'medium', impact_score: 55, category: 'seo', priority: 3,
  },
  {
    title: 'Research Skunk Global product pricing vs competitors',
    why: "At $50/mo per product, we are significantly above market. Understanding where we sit vs WPForms ($199/yr), FluentCRM ($129/yr) etc. is critical for conversion.",
    effort: 'low', impact: 'high', impact_score: 80, category: 'research', priority: 2,
  },
  {
    title: 'Draft SkunkForms launch announcement for r/Wordpress',
    why: "SkunkForms needs exposure. A well-crafted Show HN or r/Wordpress post when we launch could drive early adopters and feedback.",
    effort: 'medium', impact: 'high', impact_score: 75, category: 'marketing', priority: 2,
  },
  {
    title: 'Build a simple onboarding wizard for new SkunkCRM installs',
    why: "Users who don't activate key features within 3 days rarely do. A post-install wizard guiding them through their first contact and deal would improve retention.",
    effort: 'high', impact: 'high', impact_score: 85, category: 'product', priority: 2,
  },
  {
    title: 'Write \"WordPress CRM plugin: complete guide\" long-form post',
    why: "This is a high-volume search term with commercial intent. A comprehensive 3000-word guide could rank and drive CRM plugin downloads.",
    effort: 'high', impact: 'high', impact_score: 80, category: 'content', priority: 2,
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
