#!/bin/bash
# Usage: notify-agent.sh <label> <action> <summary> [task] [branch]
# Example: notify-agent.sh lead-developer started "Building realtime dashboard" "Real-time agent updates" "feature/sse-dashboard"

set -e

LABEL="$1"
ACTION="$2"
SUMMARY="$3"
TASK="${4:-}"
BRANCH="${5:-}"

if [[ -z "$LABEL" || -z "$ACTION" || -z "$SUMMARY" ]]; then
  echo "Usage: notify-agent.sh <label> <action> <summary> [task] [branch]"
  echo ""
  echo "Arguments:"
  echo "  label   - Agent label (e.g. lead-developer, quality-engineer)"
  echo "  action  - Action type (started, completed, commit, pr_opened, error, etc.)"
  echo "  summary - Brief description of what happened"
  echo "  task    - (Optional) Current task description"
  echo "  branch  - (Optional) Git branch name"
  echo ""
  echo "Examples:"
  echo "  notify-agent.sh lead-developer started 'Building SSE dashboard' 'Real-time updates' 'feature/sse'"
  echo "  notify-agent.sh quality-engineer completed 'Fixed form validation bug'"
  echo "  notify-agent.sh crm-engineer commit 'Added CSV export' '' 'fix/csv-export'"
  exit 1
fi

# SuperClaw dashboard runs on port 3080
SUPERCLAW_PORT=3080

# Build JSON payload
PAYLOAD=$(cat <<EOFPAYLOAD
{
  "label": "$LABEL",
  "action": "$ACTION",
  "summary": "$SUMMARY",
  "task": "$TASK",
  "branch": "$BRANCH"
}
EOFPAYLOAD
)

# POST to notify endpoint
curl -s -X POST "http://localhost:$SUPERCLAW_PORT/api/agents/notify" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | jq -r '.success // empty'

if [[ $? -eq 0 ]]; then
  echo "✓ Agent notification sent: $LABEL → $ACTION"
else
  echo "✗ Failed to notify agent" >&2
  exit 1
fi
