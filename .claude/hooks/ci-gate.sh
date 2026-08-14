#!/usr/bin/env bash
#
# ci-gate.sh — run the same gates GitHub Actions runs, before a commit is made.
#
# Wired as a PreToolUse hook on `Bash(git commit*)` in .claude/settings.json, so it
# fires for EVERY agent in this tree — main session, subagents, spawned tasks,
# parallel sessions — without any of them having to remember it. Exit 2 blocks the
# commit and hands the reason back to the agent; exit 0 lets it through.
#
# The policy is: mirror CI exactly. A gate that blocks a merge blocks a commit here.
# A gate CI only warns about only warns here. This adds no new rules — it just moves
# CI's existing verdict to before the commit instead of ten minutes after the push.
#
# Gates are chosen from what the repo CONTAINS, not from a hardcoded path list, so
# this works unchanged in git worktrees and in cloned copies of a repo:
#
#   .github/workflows/ci.yml   → this repo has CI; its gates are HARD
#   (no ci.yml)                → no CI to mirror; every gate is advisory
#   scripts["test:ci"]         → npm run test:ci                  (backend)
#   web/package.json           → eslint changed files + tsc       (Next.js frontend)
#   scripts.test, no test:ci   → npm test                         (plain node repos)
#   always                     → gitleaks on the staged diff, lad_dev./organization_id
#
# Skip an individual run with:  LAD_SKIP_CI_GATE=1 git commit ...
# Debug what it decided with:   LAD_CI_GATE_DEBUG=1
#
# No `set -u`: macOS ships bash 3.2, where `${#arr[@]}` on an empty array under
# `set -u` is an error — and empty arrays are the normal case here (a clean commit).
set -o pipefail

BLOCKERS=()      # messages that stop the commit
WARNINGS=()      # messages that are printed but do not stop it
NOTES=()         # what actually ran, so a pass isn't silent

log_debug() { [ "${LAD_CI_GATE_DEBUG:-0}" = "1" ] && echo "[ci-gate] $*" >&2; return 0; }

# ── Locate the repo this commit is aimed at ─────────────────────────────────
# The command may carry its own directory ("cd LAD_backend && git commit …" or
# "git -C LAD_backend commit …"); otherwise the hook's cwd is the project root.
payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""' 2>/dev/null)

[ "${LAD_SKIP_CI_GATE:-0}" = "1" ] && exit 0

# Only commits are interesting. This is filtered here rather than with the hook's
# `if: Bash(git commit*)` because that matches on the command PREFIX, and agents
# routinely write "cd LAD_backend && git commit …" — which would slip the gate.
case "$cmd" in
    *"git commit"*|*"git "*" commit "*) : ;;
    *) exit 0 ;;
esac

target_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
if [[ "$cmd" =~ (^|[[:space:];&|])cd[[:space:]]+\"?([^[:space:];\&|\"]+) ]]; then
    target_dir="${BASH_REMATCH[2]}"
elif [[ "$cmd" =~ git[[:space:]]+-C[[:space:]]+\"?([^[:space:];\&|\"]+) ]]; then
    target_dir="${BASH_REMATCH[1]}"
fi
[ -d "$target_dir" ] || target_dir="${CLAUDE_PROJECT_DIR:-$PWD}"

REPO=$(git -C "$target_dir" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO" ]; then
    log_debug "no git repo at $target_dir — letting the commit through"
    exit 0
fi
log_debug "repo=$REPO (from $target_dir)"

# ── What is being committed ─────────────────────────────────────────────────
# `git commit -a` stages tracked edits at commit time, so those count too.
CHANGED=$(git -C "$REPO" diff --cached --name-only --diff-filter=ACMR 2>/dev/null)
if [[ "$cmd" =~ (^|[[:space:]])-[a-zA-Z]*a|--all ]]; then
    CHANGED=$(printf '%s\n%s' "$CHANGED" \
        "$(git -C "$REPO" diff --name-only --diff-filter=ACMR 2>/dev/null)")
fi
CHANGED=$(printf '%s\n' "$CHANGED" | grep -v '^$' | sort -u)

if [ -z "$CHANGED" ]; then
    log_debug "nothing staged — letting the commit through (amend / empty commit)"
    exit 0
fi
log_debug "changed: $(printf '%s' "$CHANGED" | tr '\n' ' ')"

changed_matching() { printf '%s\n' "$CHANGED" | grep -E "$1" || true; }
has_script() {
    [ -f "$1/package.json" ] || return 1
    PKG="$1/package.json" SCRIPT="$2" node -e \
        'process.exit(require(process.env.PKG).scripts?.[process.env.SCRIPT] ? 0 : 1)' 2>/dev/null
}

# Does this repo have CI? If not there is no verdict to mirror, so nothing blocks.
if [ -f "$REPO/.github/workflows/ci.yml" ]; then
    HARD=1
else
    HARD=0
    NOTES+=("no .github/workflows/ci.yml in $(basename "$REPO") — every gate below is advisory")
fi

fail() {  # fail <message> — blocks only when this repo actually has CI
    if [ "$HARD" = "1" ]; then BLOCKERS+=("$1"); else WARNINGS+=("$1"); fi
}

# ── Gate: secrets (gitleaks) ────────────────────────────────────────────────
# CI hard-gates this on every PR. Scan only what is staged — the full-history
# scan is CI's job and would be far too slow here.
if command -v gitleaks >/dev/null 2>&1; then
    # --redact is not optional: this output is fed back into the agent's context,
    # and the whole point is that the secret must not travel any further.
    leak_out=$(cd "$REPO" && gitleaks protect --staged --no-banner -v --redact --no-color 2>&1)
    if [ $? -ne 0 ]; then
        # A committed secret is a security boundary, not a style rule — it blocks
        # regardless of whether this particular repo has CI wired up yet.
        BLOCKERS+=("gitleaks found a secret in the staged diff (value redacted):\n$(printf '%s' "$leak_out" | grep -E 'RuleID|File|Line|Fingerprint|leaks found' | head -20)")
    else
        NOTES+=("gitleaks: clean")
    fi
else
    WARNINGS+=("gitleaks not installed — the secret gate did NOT run (brew install gitleaks)")
fi

# ── Gate: backend unit tests ────────────────────────────────────────────────
# CI: HARD GATE (npm run test:ci). Hermetic + fully mocked, so it is fast enough
# to sit in front of a commit.
if has_script "$REPO" "test:ci"; then
    if [ -n "$(changed_matching '\.(js|mjs|cjs|json)$')" ]; then
        # Exclude worktree copies. CI checks out a clean tree, so the local run is
        # only faithful with them out: leaving them in pulled in 2055 suites of
        # other agents' in-progress code (109s, 3 phantom failures) instead of the
        # 151 suites that are actually this repo (8s, green).
        test_out=$(cd "$REPO" && npm run test:ci --silent -- \
            --testPathIgnorePatterns "/node_modules/" "/\.worktrees/" "/\.claude/worktrees/" 2>&1)
        if [ $? -ne 0 ]; then
            # Prefer jest's own failure lines; fall back to the tail so the
            # message is never empty for a non-jest runner.
            detail=$(printf '%s' "$test_out" | grep -E '✕|●|Tests:|Suites:' | head -25)
            [ -z "$detail" ] && detail=$(printf '%s' "$test_out" | tail -15)
            fail "npm run test:ci failed:\n$detail"
        else
            NOTES+=("npm run test:ci: $(printf '%s' "$test_out" | grep -E '^Tests:' | head -1)")
        fi
    else
        NOTES+=("no JS changed — skipped test:ci")
    fi
fi

# ── Gate: plain-node test script (repos with no test:ci) ────────────────────
if ! has_script "$REPO" "test:ci" && has_script "$REPO" "test"; then
    if [ -n "$(changed_matching '\.(js|mjs|cjs)$')" ]; then
        test_out=$(cd "$REPO" && npm test --silent 2>&1)
        [ $? -ne 0 ] && fail "npm test failed:\n$(printf '%s' "$test_out" | tail -20)" \
                     || NOTES+=("npm test: passed")
    fi
fi

# ── Gate: lint ──────────────────────────────────────────────────────────────
# Backend CI lints CHANGED FILES ONLY and is advisory (the tree still carries
# ~966 legacy no-console violations). Frontend CI runs `npm run lint` and BLOCKS.
# Either way we lint only what changed: eslint errors are per-file, so a
# changed-file run catches what a full run would, in seconds instead of minutes.
if [ -d "$REPO/web" ] && [ -f "$REPO/web/package.json" ]; then
    fe_files=$(changed_matching '^web/.*\.(ts|tsx|js|jsx|mjs)$' | sed 's|^web/||')
    if [ -n "$fe_files" ]; then
        # Use eslint's EXIT CODE, not its summary text: it exits 1 only for errors
        # and 0 when there are merely warnings. Grepping for "[0-9]+ error" matches
        # the "(0 errors, 236 warnings)" summary and blocks a clean file.
        lint_out=$(cd "$REPO/web" && npx eslint $fe_files 2>&1)
        if [ $? -ne 0 ]; then
            fail "eslint errors in changed web/ files — frontend CI BLOCKS on lint:\n$(printf '%s' "$lint_out" | grep -E ' error ' | head -20)"
        else
            NOTES+=("eslint (web, $(printf '%s\n' "$fe_files" | wc -l | tr -d ' ') file(s)): no errors")
        fi
    fi
elif ls "$REPO"/.eslintrc.* >/dev/null 2>&1 || ls "$REPO"/eslint.config.* >/dev/null 2>&1; then
    be_files=$(changed_matching '\.(js|mjs|cjs)$')
    if [ -n "$be_files" ]; then
        lint_out=$(cd "$REPO" && npx eslint $be_files 2>&1)
        # Advisory on purpose — this is exactly what backend CI does
        # (continue-on-error: true) until the M4 console.log→logger sweep lands.
        if [ $? -ne 0 ]; then
            WARNINGS+=("eslint reported errors (advisory in CI until M4):\n$(printf '%s' "$lint_out" | grep -E ' error ' | head -15)")
        else
            NOTES+=("eslint ($(printf '%s\n' "$be_files" | wc -l | tr -d ' ') file(s)): no errors")
        fi
    fi
fi

# ── Gate: frontend types ────────────────────────────────────────────────────
# CI is REPORT-ONLY against a baseline of 363 pre-existing errors, so this warns
# and never blocks — but it does catch the missing-export class of bug that has
# twice reached users as a runtime crash (next build does not type-check).
if [ -d "$REPO/web" ] && [ -n "$(changed_matching '^web/.*\.(ts|tsx)$')" ]; then
    ts_out=$(cd "$REPO/web" && npx tsc --noEmit 2>&1)
    ts_rc=$?
    ts_count=$(printf '%s' "$ts_out" | grep -cE ': error TS')
    baseline=$(grep -oE '^ *BASELINE=[0-9]+' "$REPO/.github/workflows/ci.yml" 2>/dev/null \
        | grep -oE '[0-9]+' | head -1)
    baseline=${baseline:-363}
    if [ "$ts_rc" -ne 0 ] && [ "$ts_count" -eq 0 ]; then
        # tsc failed without producing any file-scoped diagnostics — the checker
        # itself could not run (bad tsconfig, broken node_modules, missing types).
        # Counting that as "0 errors" is how a dead gate looks exactly like a
        # passing one, so name it instead. CI's grep has the same blind spot.
        WARNINGS+=("tsc could not run — the type gate did NOT check anything:\n$(printf '%s' "$ts_out" | head -3)")
    elif [ "$ts_count" -gt "$baseline" ]; then
        WARNINGS+=("tsc: $ts_count type errors vs baseline $baseline (+$((ts_count - baseline))) — check for a new missing export before pushing")
    else
        NOTES+=("tsc: $ts_count errors, at or under baseline $baseline")
    fi
fi

# ── Gate: architecture guardrails ───────────────────────────────────────────
# CI runs both in WARN mode while the M2/M3 migrations are in flight, so these
# warn here too. Flip them to fail() when CI flips WARN_MODE to false.
added_lines=$(git -C "$REPO" diff --cached -- \
    ':(exclude)*.sql' ':(exclude)*.md' ':(exclude)**/migrations/**' \
    ':(exclude)**/tests/**' ':(exclude).github/**' 2>/dev/null | grep -E '^\+[^+]')

lad_dev_hits=$(printf '%s' "$added_lines" | grep -cE '\blad_dev\.' || true)
[ "${lad_dev_hits:-0}" -gt 0 ] && \
    WARNINGS+=("$lad_dev_hits new literal 'lad_dev.' reference(s) — use getSchema(req) / core_table(). CI warns on this (M3).")

org_id_hits=$(printf '%s' "$added_lines" | grep -c 'organization_id' || true)
[ "${org_id_hits:-0}" -gt 0 ] && \
    WARNINGS+=("$org_id_hits new 'organization_id' reference(s) — use tenant_id. CI warns on this (M2).")

# ── Verdict ─────────────────────────────────────────────────────────────────
if [ ${#BLOCKERS[@]} -gt 0 ]; then
    {
        echo "COMMIT BLOCKED — $(basename "$REPO") would fail CI:"
        echo
        for b in "${BLOCKERS[@]}"; do echo "  ✗ $(printf '%b' "$b")"; echo; done
        for w in "${WARNINGS[@]}"; do echo "  ! $(printf '%b' "$w")"; echo; done
        echo "Fix these, then commit again. To commit anyway (you own the CI failure):"
        echo "  LAD_SKIP_CI_GATE=1 git commit ..."
    } >&2
    exit 2
fi

{
    echo "ci-gate: $(basename "$REPO") clear to commit"
    for n in "${NOTES[@]}"; do echo "  ✓ $n"; done
    for w in "${WARNINGS[@]}"; do echo "  ! $(printf '%b' "$w")"; done
}
exit 0
