#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${LOOP_STATE_DIR:-$ROOT/.autonomous-loop}"
LOG_DIR="$STATE_DIR/logs"
TMP_DIR="$STATE_DIR/tmp"
GOAL_FILE="$STATE_DIR/goal.md"
MEMORY_FILE="$STATE_DIR/memory.md"
PROGRESS_FILE="$STATE_DIR/progress.md"
LAST_MESSAGE_FILE="$TMP_DIR/last-message.md"
ITERATION_FILE="$TMP_DIR/iteration"

LOOP_AGENT="${LOOP_AGENT:-}"
AGENT_BIN="${AGENT_BIN:-}"
CODEX_SANDBOX="${CODEX_SANDBOX:-workspace-write}"
CODEX_APPROVAL="${CODEX_APPROVAL:-never}"

mkdir -p "$LOG_DIR" "$TMP_DIR"
cd "$ROOT" || exit 1

if [[ -z "$LOOP_AGENT" ]]; then
  if command -v codex >/dev/null 2>&1; then
    LOOP_AGENT="codex"
  elif command -v claude >/dev/null 2>&1; then
    LOOP_AGENT="claude"
  else
    echo "Cannot find codex or claude. Set LOOP_AGENT and AGENT_BIN." >&2
    exit 127
  fi
fi

if [[ -z "$AGENT_BIN" ]]; then
  AGENT_BIN="$LOOP_AGENT"
fi

if ! command -v "$AGENT_BIN" >/dev/null 2>&1; then
  echo "Cannot find agent binary: $AGENT_BIN" >&2
  exit 127
fi

MODEL_ARGS=()
if [[ "$LOOP_AGENT" == "codex" && -n "${CODEX_MODEL:-}" ]]; then
  MODEL_ARGS=(-m "$CODEX_MODEL")
elif [[ "$LOOP_AGENT" == "claude" && -n "${CLAUDE_MODEL:-}" ]]; then
  MODEL_ARGS=(--model "$CLAUDE_MODEL")
fi

preflight_agent() {
  case "$LOOP_AGENT" in
    codex)
      CODEX_CMD=("$AGENT_BIN" --ask-for-approval "$CODEX_APPROVAL" exec)
      if ! "${CODEX_CMD[@]}" --help >"$TMP_DIR/agent-help.txt" 2>&1; then
        echo "Codex CLI invocation is not compatible with this script:" >&2
        sed -n '1,80p' "$TMP_DIR/agent-help.txt" >&2
        exit 2
      fi
      ;;
    claude)
      if ! "$AGENT_BIN" --help >"$TMP_DIR/agent-help.txt" 2>&1; then
        echo "Claude CLI invocation is not compatible with this script:" >&2
        sed -n '1,80p' "$TMP_DIR/agent-help.txt" >&2
        exit 2
      fi
      ;;
    *)
      echo "Unsupported LOOP_AGENT: $LOOP_AGENT. Use codex or claude." >&2
      exit 2
      ;;
  esac
  rm -f "$TMP_DIR/agent-help.txt"
}

run_agent() {
  local prompt_file="$1"
  local log_file="$2"

  case "$LOOP_AGENT" in
    codex)
      "${CODEX_CMD[@]}" \
        -C "$ROOT" \
        -s "$CODEX_SANDBOX" \
        "${MODEL_ARGS[@]}" \
        --output-last-message "$LAST_MESSAGE_FILE" \
        - >"$log_file" 2>&1 < "$prompt_file"
      ;;
    claude)
      "$AGENT_BIN" -p --dangerously-skip-permissions "${MODEL_ARGS[@]}" \
        < "$prompt_file" >"$log_file" 2>&1
      local status=$?
      if [[ "$status" -eq 0 ]]; then
        cp "$log_file" "$LAST_MESSAGE_FILE"
      fi
      return "$status"
      ;;
  esac
}

if [[ ! -d "$ROOT/.git" ]]; then
  git init -b main >/dev/null 2>&1 || git init >/dev/null
fi

if ! git config user.name >/dev/null; then
  git config user.name "Autonomous Loop"
fi

if ! git config user.email >/dev/null; then
  git config user.email "autonomous-loop@example.invalid"
fi

if [[ ! -f "$ITERATION_FILE" ]]; then
  printf '1\n' > "$ITERATION_FILE"
fi

indent() {
  sed 's/^/  /'
}

print_section() {
  local title="$1"
  printf '\n%s\n' "$title"
  printf '%s\n' "----------------------------------------"
}

git_summary() {
  local branch head dirty_count
  if ! branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null)"; then
    branch="unknown"
  fi
  if ! head="$(git rev-parse --short HEAD 2>/dev/null)"; then
    head="no commits"
  fi
  dirty_count="$(git status --short 2>/dev/null | wc -l | tr -d ' ')"
  printf 'Branch: %s | HEAD: %s | Uncommitted paths: %s\n' "$branch" "$head" "$dirty_count"
}

print_progress() {
  if [[ -s "$PROGRESS_FILE" ]]; then
    sed -n '1,160p' "$PROGRESS_FILE" | indent
  else
    printf '  No progress file yet. The next agent session must create one.\n'
  fi
}

print_last_result() {
  if [[ -s "$LAST_MESSAGE_FILE" ]]; then
    sed -n '1,70p' "$LAST_MESSAGE_FILE" | indent
  else
    printf '  No previous agent result yet.\n'
  fi
}

render_prompt() {
  local iteration="$1"
  cat <<PROMPT
You are running as one worker in an unattended autonomous build loop.

Iteration: $iteration
Repository: $ROOT

Goal:
- $GOAL_FILE

Persistent loop state:
- Memory: $MEMORY_FILE
- Progress checklist: $PROGRESS_FILE
- Previous quiet logs: $LOG_DIR

Read the goal, memory, progress checklist, and repository state before changing files.
Choose the highest-priority unfinished work that moves the project toward the complete goal.

Operating rules:
1. Do production work, not a throwaway preview.
2. Fill in missing user flows, edge cases, and operational details implied by the goal.
3. Keep edits coherent and scoped to the next useful milestone.
4. Add or update tests for the behavior you change, then run the relevant checks before finishing.
5. Make failures observable with actionable diagnostics.
6. Do not block on secrets or external accounts; build configuration and friendly error paths instead.
7. Commit coherent changes with clear commit messages. If you leave uncommitted changes and the iteration started from a clean worktree, the wrapper may auto-commit them. If the iteration started with pre-existing changes, the wrapper will skip auto-commit to avoid bundling unrelated work.
8. Commit often at natural milestones so older variants remain recoverable.
9. Create local-only annotated known-good/... tags only for major verified stable states. Do not tag routine checkpoints, and do not push tags unless the user explicitly asks.
10. If you think the requested work is done, do not switch to passive monitoring. Re-read the original goal and current implementation, look for gaps, uncovered nuances, original-prompt omissions, difficult unaddressed parts, shallow implementation, shallow tests, edge cases, and user-flow or operational rough spots. Address the highest-value gap and continue.
11. Update $MEMORY_FILE and $PROGRESS_FILE before your final response so the next fresh session has continuity.
12. Keep your final response concise: what changed, tests run, current risks/blockers, and next best step.

Stop only after a coherent milestone, a real blocker, or a natural handoff point, and only after doing the gap/depth pass above when the obvious work appears complete.
The wrapper will immediately start the next session after a successful exit.
PROMPT
}

auto_commit_if_needed() {
	local iteration="$1"
	local log_file="$2"
	local pre_agent_status_file="${3:-}"

	if [[ -n "$pre_agent_status_file" && -s "$pre_agent_status_file" ]]; then
		{
			printf '\n[wrapper] Skipping auto-commit for iteration %s because the worktree was dirty before the agent started.\n' "$iteration"
			printf '[wrapper] Pre-existing changes:\n'
			sed 's/^/[wrapper]   /' "$pre_agent_status_file"
		} >>"$log_file" 2>&1
		return 0
	fi

	if [[ -n "$(git status --short)" ]]; then
		{
			printf '\n[wrapper] Auto-committing remaining changes for iteration %s\n' "$iteration"
      git add -A
      git commit -m "chore(loop): iteration $iteration"
    } >>"$log_file" 2>&1 || {
      printf 'Auto-commit failed. See %s\n' "$log_file"
      return 1
    }
  fi
}

preflight_agent

trap 'printf "\nStopped autonomous loop.\n"; exit 130' INT TERM

while true; do
  iteration="$(tr -d '[:space:]' < "$ITERATION_FILE" 2>/dev/null)"
  if [[ -z "$iteration" || ! "$iteration" =~ ^[0-9]+$ ]]; then
    iteration=1
  fi

	timestamp="$(date '+%Y%m%d-%H%M%S')"
	log_file="$LOG_DIR/iteration-$(printf '%04d' "$iteration")-$timestamp.log"
	prompt_file="$TMP_DIR/prompt-$iteration.md"
	pre_agent_status_file="$TMP_DIR/pre-agent-status-$iteration.txt"
	render_prompt "$iteration" > "$prompt_file"
	git status --short --untracked-files=all > "$pre_agent_status_file" 2>/dev/null || true

	clear 2>/dev/null || true
  printf 'Autonomous Build Loop\n'
  printf 'Started: %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
  printf 'Agent: %s (%s)\n' "$LOOP_AGENT" "$AGENT_BIN"
  printf 'Iteration: %s\n' "$iteration"
  git_summary
  printf 'Current session log: %s\n' "$log_file"

  print_section "Progress"
  print_progress

  print_section "Last Agent Result"
  print_last_result

  print_section "Status"
  printf '  Starting agent now. Session output is being written only to the log file.\n'

  run_agent "$prompt_file" "$log_file"
  agent_status=$?

  {
    printf '\n[wrapper] Agent exit status: %s\n' "$agent_status"
    printf '[wrapper] Finished: %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
  } >>"$log_file" 2>&1

  if [[ "$agent_status" -ne 0 ]]; then
    printf '\nAgent exited with status %s. See %s\n' "$agent_status" "$log_file"
    printf '\nLast log lines:\n'
    tail -80 "$log_file" | indent
    exit "$agent_status"
  fi

	auto_commit_if_needed "$iteration" "$log_file" "$pre_agent_status_file" || true

  next_iteration=$((iteration + 1))
  printf '%s\n' "$next_iteration" > "$ITERATION_FILE"
  printf '\nIteration %s finished successfully. Restarting immediately; the next dashboard will print the updated Progress section before launching the agent.\n' "$iteration"
done
