#!/usr/bin/env node
/**
 * migrate-add-category.js
 * Add `category` column to work_proposals table
 * 
 * Usage: node scripts/migrate-add-category.js
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
const dbPath = path.join(dataDir, 'superclaw.db');

console.log(`[migrate] Opening database: ${dbPath}`);
const db = new Database(dbPath);

try {
  // Check if column already exists
  const columns = db.prepare("PRAGMA table_info(work_proposals)").all();
  const hasCategory = columns.some(col => col.name === 'category');
  
  if (hasCategory) {
    console.log('[migrate] ✓ Category column already exists — skipping');
    process.exit(0);
  }
  
  // Add category column with default 'uncategorised'
  console.log('[migrate] Adding category column...');
  db.prepare(`
    ALTER TABLE work_proposals 
    ADD COLUMN category TEXT NOT NULL DEFAULT 'uncategorised'
  `).run();
  
  console.log('[migrate] ✓ Category column added successfully');
  console.log('[migrate] Valid categories: landing-page, content, paid-product, feature, saas, uncategorised');
  
} catch (error) {
  console.error('[migrate] ERROR:', error.message);
  process.exit(1);
} finally {
  db.close();
}
