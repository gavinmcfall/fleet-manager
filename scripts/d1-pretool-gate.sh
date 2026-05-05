#!/usr/bin/env bash
# PreToolUse hook for Bash commands.
# Reads the tool_input JSON on stdin. If the command is a wrangler d1 mutating
# call against --remote, runs the D1 write budget estimator and blocks if
# projected usage exceeds the threshold.
#
# Allows everything else (--local, non-d1 wrangler, non-wrangler bash) to pass.
#
# Exit codes:
#   0  — allow
#   2  — block (Claude Code treats nonzero from PreToolUse as a deny)

set -euo pipefail

THRESHOLD="${D1_BUDGET_THRESHOLD:-80}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ESTIMATOR="$SCRIPT_DIR/d1-budget.py"

# Read the JSON envelope, extract the actual command string.
input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c '
import json, sys
try:
    data = json.loads(sys.stdin.read())
except Exception:
    print("")
    sys.exit(0)
print(data.get("tool_input", {}).get("command", ""))
')

# Anchored match: the command must START with a wrangler invocation
# (allowing leading env var assignments and an optional `npx`/`source` prefix).
# This avoids false positives when "wrangler d1 ... --remote" appears inside
# a string argument (e.g., a git commit message describing a wrangler command).
if ! printf '%s' "$cmd" | grep -qE '^(\s*[A-Z_]+=\S+\s+)*(\s*(source\s+\S+\s*&&\s*)?\s*(npx\s+)?wrangler\s+d1\s+(execute|migrations\s+apply))'; then
    exit 0
fi
if ! printf '%s' "$cmd" | grep -qE -- '--remote\b'; then
    exit 0  # local — no quota cost
fi
# Read-only --command queries with SELECT? Skip the gate to keep things fast.
# Anything else (INSERT/UPDATE/DELETE/DDL inline, or --file) gets the gate.
if printf '%s' "$cmd" | grep -qiE -- '--command[[:space:]]+["\x27][[:space:]]*SELECT'; then
    exit 0
fi

# Extract database name (first non-flag positional after "execute" or "apply").
db=$(printf '%s' "$cmd" | python3 -c '
import re, sys
cmd = sys.stdin.read()
# Match "wrangler d1 execute <name>" or "wrangler d1 migrations apply <name>"
m = re.search(r"wrangler\s+d1\s+(?:execute|migrations\s+apply)\s+(\S+)", cmd)
print(m.group(1) if m else "")
')

if [[ -z "$db" ]]; then
    echo "[d1-gate] Could not parse database name from command. Allowing." >&2
    exit 0
fi

# Extract --file <path> if present.
sql_file=$(printf '%s' "$cmd" | python3 -c '
import re, sys
m = re.search(r"--file[\s=]+(\S+)", sys.stdin.read())
print(m.group(1) if m else "")
')

# Set up the environment for the estimator.
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    if [[ -f "$HOME/.secrets" ]] && grep -q CLOUDFLARE_API_TOKEN_SCBRIDGE "$HOME/.secrets"; then
        # shellcheck disable=SC1091
        source "$HOME/.secrets"
        export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN_SCBRIDGE:-${CLOUDFLARE_API_TOKEN:-}}"
    fi
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "[d1-gate] CLOUDFLARE_API_TOKEN not available; cannot check budget. Allowing." >&2
    exit 0
fi

args=(--db "$db" --threshold "$THRESHOLD")
if [[ -n "$sql_file" && -f "$sql_file" ]]; then
    args+=(--sql-file "$sql_file")
fi

# Run the estimator. Output is informational; exit code drives the decision.
output=$(python3 "$ESTIMATOR" "${args[@]}" 2>&1) || rc=$? && rc=${rc:-0}
echo "$output" >&2

if [[ "${rc:-0}" -ne 0 ]]; then
    cat >&2 <<EOF

[d1-gate] BLOCKED — projected usage exceeds ${THRESHOLD}% of the 50M monthly cap.
  • If this is dev iteration, use --local instead (zero quota cost).
  • If this load is intentional and you accept the cost, override with
    D1_BUDGET_THRESHOLD=95 <your command>.
  • See tools/docs/guides/local-dev-environment.md for the local-dev workflow.
EOF
    exit 2
fi

exit 0
