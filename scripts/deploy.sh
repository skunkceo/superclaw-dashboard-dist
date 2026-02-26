#!/bin/bash
set -e

echo "🚀 SuperClaw Deployment Script"
echo "================================"

# Navigate to project directory
cd /home/mike/apps/websites/superclaw-dashboard

echo "📦 Pulling latest changes..."
sudo -u mike git pull

echo "🧹 Clearing Next.js cache..."
sudo -u mike rm -rf .next/cache

echo "🔨 Building..."
sudo -u mike NODE_OPTIONS="--max-old-space-size=3072" npm run build

echo "♻️  Restarting PM2..."
sudo -iu mike /home/mike/.nvm/versions/node/v24.13.0/bin/pm2 restart "superclaw.skunkglobal.com"

echo "🔄 Reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deployment complete!"
echo "🌐 Site: https://superclaw.skunkglobal.com"
