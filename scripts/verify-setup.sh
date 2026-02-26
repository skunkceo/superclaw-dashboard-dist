#!/bin/bash
# SuperClaw Setup Verification Script
# Checks if SuperClaw is properly connected to OpenClaw

set -e

echo "🔍 SuperClaw Setup Verification"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get dashboard directory (where this script is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DASHBOARD_DIR="$(dirname "$SCRIPT_DIR")"

echo "📁 Dashboard location: $DASHBOARD_DIR"
echo ""

# Check 1: OpenClaw installed
echo "1️⃣  Checking OpenClaw installation..."
if command -v openclaw &> /dev/null; then
    OPENCLAW_VERSION=$(openclaw --version 2>&1 | head -1)
    echo -e "${GREEN}✓${NC} OpenClaw installed: $OPENCLAW_VERSION"
else
    echo -e "${RED}✗${NC} OpenClaw not found"
    echo "   Install: npm install -g openclaw"
    exit 1
fi
echo ""

# Check 2: OpenClaw workspace
echo "2️⃣  Checking OpenClaw workspace..."
WORKSPACE_FROM_STATUS=$(openclaw status --json 2>/dev/null | grep -o '"workspace":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -n "$WORKSPACE_FROM_STATUS" ]; then
    echo -e "${GREEN}✓${NC} OpenClaw workspace: $WORKSPACE_FROM_STATUS"
    OPENCLAW_WORKSPACE="$WORKSPACE_FROM_STATUS"
elif [ -d "$HOME/.openclaw/workspace" ]; then
    echo -e "${YELLOW}⚠${NC} OpenClaw not running, using default: $HOME/.openclaw/workspace"
    OPENCLAW_WORKSPACE="$HOME/.openclaw/workspace"
else
    echo -e "${RED}✗${NC} OpenClaw workspace not found"
    echo "   Start OpenClaw: openclaw gateway start"
    exit 1
fi
echo ""

# Check 3: Dashboard .env file
echo "3️⃣  Checking dashboard configuration..."
if [ -f "$DASHBOARD_DIR/.env" ]; then
    ENV_WORKSPACE=$(grep OPENCLAW_WORKSPACE "$DASHBOARD_DIR/.env" | cut -d'=' -f2)
    if [ -n "$ENV_WORKSPACE" ]; then
        echo -e "${GREEN}✓${NC} Dashboard .env exists: OPENCLAW_WORKSPACE=$ENV_WORKSPACE"
        
        if [ "$ENV_WORKSPACE" != "$OPENCLAW_WORKSPACE" ]; then
            echo -e "${YELLOW}⚠${NC} Warning: .env workspace path doesn't match OpenClaw"
            echo "   .env says: $ENV_WORKSPACE"
            echo "   OpenClaw uses: $OPENCLAW_WORKSPACE"
            echo ""
            read -p "Update .env to match OpenClaw? [Y/n]: " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                echo "OPENCLAW_WORKSPACE=$OPENCLAW_WORKSPACE" > "$DASHBOARD_DIR/.env"
                echo -e "${GREEN}✓${NC} Updated .env file"
            fi
        fi
    else
        echo -e "${RED}✗${NC} .env missing OPENCLAW_WORKSPACE"
        echo "   Creating..."
        echo "OPENCLAW_WORKSPACE=$OPENCLAW_WORKSPACE" > "$DASHBOARD_DIR/.env"
        echo -e "${GREEN}✓${NC} Created .env file"
    fi
else
    echo -e "${YELLOW}⚠${NC} Dashboard .env not found, creating..."
    echo "OPENCLAW_WORKSPACE=$OPENCLAW_WORKSPACE" > "$DASHBOARD_DIR/.env"
    echo -e "${GREEN}✓${NC} Created .env file"
fi
echo ""

# Check 4: Agent workspaces
echo "4️⃣  Checking agent workspaces..."
AGENTS_DIR="$OPENCLAW_WORKSPACE/agents"
if [ -d "$AGENTS_DIR" ]; then
    AGENT_COUNT=$(ls -1 "$AGENTS_DIR" 2>/dev/null | grep -v "^shared$" | wc -l | tr -d ' ')
    echo -e "${GREEN}✓${NC} Agents directory exists: $AGENTS_DIR"
    echo "   Found $AGENT_COUNT agent workspace(s)"
    
    # List agents
    if [ "$AGENT_COUNT" -gt 0 ]; then
        echo "   Agents:"
        ls -1 "$AGENTS_DIR" | grep -v "^shared$" | while read agent; do
            if [ -f "$AGENTS_DIR/$agent/IDENTITY.md" ]; then
                AGENT_NAME=$(grep "Name:" "$AGENTS_DIR/$agent/IDENTITY.md" | sed 's/.*Name:\*\* *//' | sed 's/ *$//')
                echo "     • $agent ($AGENT_NAME)"
            else
                echo "     • $agent"
            fi
        done
    fi
else
    echo -e "${YELLOW}⚠${NC} Agents directory not found: $AGENTS_DIR"
    echo "   Run: superclaw setup agents"
fi
echo ""

# Check 5: Main workspace files
echo "5️⃣  Checking workspace files..."
if [ -f "$OPENCLAW_WORKSPACE/MEMORY.md" ]; then
    SIZE=$(du -h "$OPENCLAW_WORKSPACE/MEMORY.md" | cut -f1)
    echo -e "${GREEN}✓${NC} MEMORY.md exists ($SIZE)"
else
    echo -e "${YELLOW}⚠${NC} MEMORY.md not found"
    echo "   This is normal for new installations"
fi

if [ -f "$OPENCLAW_WORKSPACE/routing-rules.json" ]; then
    echo -e "${GREEN}✓${NC} routing-rules.json exists"
else
    echo -e "${YELLOW}⚠${NC} routing-rules.json not found"
    echo "   Run: superclaw setup agents"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Setup verification complete!${NC}"
echo ""
echo "Dashboard should now be able to:"
echo "  • Load memory files from $OPENCLAW_WORKSPACE"
echo "  • Access agent workspaces in $AGENTS_DIR"
echo "  • Update OpenClaw via the dashboard"
echo ""
echo "If you just created/updated .env, restart the dashboard:"
echo "  cd $DASHBOARD_DIR && npm run dev"
