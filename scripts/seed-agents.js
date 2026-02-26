#!/usr/bin/env node

/**
 * Seed default agent definitions
 * Run this once to populate the team with Porter + core specialists
 */

const Database = require('better-sqlite3');
const { join } = require('path');
const { existsSync, mkdirSync, writeFileSync } = require('fs');

const dbPath = join(process.env.HOME || '/root', '.superclaw/superclaw.db');
const db = new Database(dbPath);

// Check if agents already exist
const existing = db.prepare('SELECT COUNT(*) as count FROM agent_definitions').get();
if (existing.count > 0) {
  console.log(`✓ Agents already exist (${existing.count} found). Skipping seed.`);
  process.exit(0);
}

console.log('Creating default agent team...');

const agents = [
  {
    id: 'porter',
    name: 'Porter',
    description: 'Task Orchestrator - Routes tasks to specialist agents',
    model: 'claude-sonnet-4-20250514',
    skills: JSON.stringify(['task-routing', 'agent-coordination', 'workflow-management']),
    color: '#10b981', // green
    icon: 'porter',
    handoff_rules: JSON.stringify([]), // Porter doesn't need handoff rules
    enabled: 1,
    thinking: 'low',
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Code features, fix bugs, deploy updates',
    model: 'claude-sonnet-4-20250514',
    skills: JSON.stringify(['github', 'wp-cli', 'coding-agent', 'deployment', 'debugging']),
    color: '#3b82f6', // blue
    icon: 'code',
    handoff_rules: JSON.stringify([
      'code', 'bug', 'feature', 'deploy', 'fix', 'build', 'git', 'github',
      'npm', 'install', 'update dependencies', 'merge', 'pull request'
    ]),
    enabled: 1,
    thinking: 'low',
  },
  {
    id: 'seo',
    name: 'SEO Specialist',
    description: 'Rankings, traffic, keyword research, and content optimization',
    model: 'claude-haiku-3-5-20241022',
    skills: JSON.stringify(['google-service-account', 'twitter', 'content-strategy', 'analytics']),
    color: '#8b5cf6', // purple
    icon: 'chart',
    handoff_rules: JSON.stringify([
      'seo', 'ranking', 'keyword', 'google search console', 'gsc',
      'organic traffic', 'search', 'sitemap', 'indexing', 'meta'
    ]),
    enabled: 1,
    thinking: 'low',
  },
  {
    id: 'marketing',
    name: 'Marketing Specialist',
    description: 'Growth, campaigns, community, and promotion',
    model: 'claude-haiku-3-5-20241022',
    skills: JSON.stringify(['twitter', 'reddit', 'content-marketing', 'email-campaigns']),
    color: '#ec4899', // pink
    icon: 'megaphone',
    handoff_rules: JSON.stringify([
      'reddit', 'social media', 'twitter', 'community', 'marketing',
      'campaign', 'promotion', 'outreach', 'email', 'newsletter'
    ]),
    enabled: 1,
    thinking: 'low',
  },
  {
    id: 'content-writer',
    name: 'Content Writer',
    description: 'Blog posts, guides, landing pages, and documentation',
    model: 'claude-sonnet-4-20250514',
    skills: JSON.stringify(['seo-writing', 'content-strategy', 'copywriting']),
    color: '#f59e0b', // orange
    icon: 'pencil',
    handoff_rules: JSON.stringify([
      'blog post', 'article', 'write', 'content', 'guide', 'tutorial',
      'documentation', 'landing page', 'copy', 'draft'
    ]),
    enabled: 1,
    thinking: 'medium',
  },
];

const insert = db.prepare(`
  INSERT INTO agent_definitions (
    id, name, description, model, skills, tools, color, icon, 
    handoff_rules, enabled, thinking, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?
  )
`);

const now = Date.now();

agents.forEach((agent) => {
  insert.run(
    agent.id,
    agent.name,
    agent.description,
    agent.model,
    agent.skills,
    agent.color,
    agent.icon,
    agent.handoff_rules,
    agent.enabled,
    agent.thinking,
    now,
    now
  );
  console.log(`✓ Created: ${agent.name}`);
});

// Create memory directories
const memoryRoot = '/root/clawd/memory/agents';
if (!existsSync(memoryRoot)) {
  mkdirSync(memoryRoot, { recursive: true });
}

console.log('\n✓ Agent team seeded successfully!');
console.log('  - Porter (Orchestrator)');
console.log('  - Developer');
console.log('  - SEO Specialist');
console.log('  - Marketing Specialist');
console.log('  - Content Writer');
console.log('\nNext: Visit /command to see your team');

db.close();
