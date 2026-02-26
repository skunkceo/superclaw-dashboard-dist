#!/bin/bash
# Log agent activity to SuperClaw activity feed
# Usage: log-activity.sh <action_type> <summary> [agent_label] [details] [links_json]
#
# action_type: started|completed|blocked|commit|pr_opened|research|report|analysis|
#              content|outreach|audit|sync|writing|deploy|error|info
#
# Examples:
#   log-activity.sh "started" "Building CRM pricing page" "coding-agent"
#   log-activity.sh "completed" "PR #5 opened for router fix" "main" "" '[{"label":"PR #5","url":"https://github.com/..."}]'
#   log-activity.sh "research" "Analysed WPForms competitor pricing" "main" "Found 3 tiers..."
#   log-activity.sh "commit" "Fixed file permission ACL bug" "main" "" '[{"label":"commit","url":"https://github.com/..."}]'

DB="${SUPERCLAW_DATA_DIR:-/home/mike/.superclaw}/superclaw.db"

ACTION_TYPE="${1:-info}"
SUMMARY="${2:-Activity logged}"
AGENT_LABEL="${3:-main}"
DETAILS="${4:-}"
LINKS="${5:-[]}"

if [ ! -f "$DB" ]; then
  echo "ERROR: SuperClaw DB not found at $DB" >&2
  exit 1
fi

ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null || date +%s%N)
TIMESTAMP=$(($(date +%s) * 1000))

# Escape single quotes for SQLite
SUMMARY_ESC=$(echo "$SUMMARY" | sed "s/'/''/g")
DETAILS_ESC=$(echo "$DETAILS" | sed "s/'/''/g")
AGENT_ESC=$(echo "$AGENT_LABEL" | sed "s/'/''/g")
ACTION_ESC=$(echo "$ACTION_TYPE" | sed "s/'/''/g")

sqlite3 "$DB" "INSERT INTO activity_log (id, timestamp, agent_label, action_type, summary, details, links) VALUES ('$ID', $TIMESTAMP, '$AGENT_ESC', '$ACTION_ESC', '$SUMMARY_ESC', $([ -n "$DETAILS" ] && echo "'$DETAILS_ESC'" || echo "NULL"), '$LINKS')"

if [ $? -eq 0 ]; then
  echo "✓ Activity logged: [$ACTION_TYPE] $SUMMARY"
else
  echo "ERROR: Failed to log activity" >&2
  exit 1
fi
