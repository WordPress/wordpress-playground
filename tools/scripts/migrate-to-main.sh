#!/usr/bin/env bash
#
# Phase 2: Create lean `main` branch
#
# See https://github.com/WordPress/wordpress-playground/issues/2690
#
# This script is a ONE-TIME operation to be run by a maintainer after Phase 1
# (the external binary infrastructure) has been merged and validated on trunk.
#
# What it does:
#   1. Creates `main` from `trunk` HEAD
#   2. Rewrites `main` history with git-filter-repo to strip all committed
#      binary files (WASM, .so, .la, WordPress ZIPs, .data files)
#   3. Updates all `trunk` references to `main` in workflow and config files
#   4. Commits those reference updates onto the rewritten `main`
#   5. Force-pushes `main` to GitHub
#   6. Changes the default branch from `trunk` to `main`
#
# Usage:
#   bash tools/scripts/migrate-to-main.sh [--dry-run] [--yes]
#
#   --dry-run   Print every command without executing it
#   --yes       Skip all confirmation prompts (use with care)

set -euo pipefail

# --- Options -----------------------------------------------------------------

DRY_RUN=false
SKIP_CONFIRM=false

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --yes)     SKIP_CONFIRM=true ;;
        *)
            echo "Unknown argument: $arg"
            echo "Usage: $0 [--dry-run] [--yes]"
            exit 1
            ;;
    esac
done

# --- Helpers -----------------------------------------------------------------

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}▶ $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}" >&2; }
step()    { echo; echo -e "${BOLD}── $* ──────────────────────────────────────────${RESET}"; }

run() {
    if $DRY_RUN; then
        echo -e "${YELLOW}  [dry-run] $*${RESET}"
    else
        eval "$@"
    fi
}

confirm() {
    local prompt="$1"
    if $SKIP_CONFIRM; then return 0; fi
    echo
    echo -e "${BOLD}${prompt}${RESET}"
    read -rp "Continue? [y/N] " response
    echo
    [[ "$response" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
}

# Cross-platform sed -i
sed_inplace() {
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# --- Header ------------------------------------------------------------------

echo
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║  Phase 2: Create lean \`main\` branch                  ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo
echo "This script will:"
echo "  1. Create \`main\` from \`trunk\`"
echo "  2. Strip all binary files from \`main\` history"
echo "  3. Update \`trunk\` references to \`main\` in config files"
echo "  4. Force-push \`main\` to GitHub"
echo "  5. Change the default branch to \`main\`"
echo
$DRY_RUN && warn "DRY-RUN mode — no changes will be made."

# --- Step 1: Prerequisites ---------------------------------------------------

step "Prerequisites"

info "Checking Phase 1 is merged..."
if [[ ! -f "packages/php-wasm/binaries-manifest.json" ]]; then
    error "packages/php-wasm/binaries-manifest.json not found."
    echo "  Phase 1 must be merged into trunk before running Phase 2."
    exit 1
fi
success "Phase 1 manifest found."

REPO="WordPress/wordpress-playground"
REMOTE_URL="https://github.com/WordPress/wordpress-playground.git"

echo
warn "This is a DESTRUCTIVE, ONE-TIME operation."
warn "All contributors will need to reset their local repositories."
warn "All open PRs will need to be rebased onto \`main\`."
confirm "Understood — proceed with Phase 2?"

# --- Step 2: Create `main` from `trunk` HEAD ---------------------------------

step "Create \`main\` branch"

info "Creating main from current trunk HEAD ($(git rev-parse --short HEAD))..."

if git show-ref --verify --quiet refs/heads/main; then
    error "Branch \`main\` already exists locally. Delete it first:"
    echo "  git branch -D main"
    exit 1
fi

run "git checkout -b main"
success "Branch \`main\` created."

# --- Step 3: Rewrite history -------------------------------------------------

step "Strip binary files from history"

echo "Files to remove from ALL commits:"
echo "  packages/php-wasm/{web,node}-builds/*/asyncify/**"
echo "  packages/php-wasm/{web,node}-builds/*/jspi/**"
echo "  packages/playground/wordpress-builds/src/wordpress/wp-*.zip"
echo "  packages/playground/wordpress-builds/src/sqlite-database-integration/*.zip"
echo "  packages/playground/wordpress-builds/public/"
echo "  packages/playground/website/playwright/*.zip"
echo "  public/*.data  (historical)"
echo "  dist-web/*.data  (historical)"
echo

if $DRY_RUN; then
    warn "[dry-run] Would run git-filter-repo to rewrite all history."
else
    # git-filter-repo removes the remote as a safety measure.
    # We save the URL before and restore it after.
    git filter-repo \
        --invert-paths \
        --path-regex '^packages/php-wasm/(web|node)-builds/[^/]+/(asyncify|jspi)/' \
        --path-regex '^packages/playground/wordpress-builds/src/wordpress/wp-[^/]+\.zip$' \
        --path-regex '^packages/playground/wordpress-builds/src/sqlite-database-integration/[^/]+\.zip$' \
        --path-regex '^packages/playground/wordpress-builds/public/' \
        --path-regex '^packages/playground/website/playwright/[^/]+\.zip$' \
        --path-regex '^public/[^/]+\.data$' \
        --path-regex '^dist-web/[^/]+\.data$' \
        --force

    # Restore the remote (git-filter-repo removes it)
    git remote add origin "${REMOTE_URL}"
fi
success "History rewritten."

# --- Step 4: Update trunk references to main ---------------------------------

step "Update \`trunk\` references to \`main\`"

WORKFLOW_FILES=(
    ".github/actions/prepare-playground/action.yml"
    ".github/workflows/ci.yml"
    ".github/workflows/cleanup-php-wasm-releases.yml"
    ".github/workflows/deploy-cors-proxy.yml"
    ".github/workflows/deploy-my-wordpress-net.yml"
    ".github/workflows/deploy-website.yml"
    ".github/workflows/publish-devtools-extension.yml"
    ".github/workflows/publish-npm-packages.yml"
    ".github/workflows/publish-php-wasm-binaries.yml"
    ".github/workflows/publish-self-hosted-package-release.yml"
    ".github/workflows/refresh-sqlite-integration.yml"
    ".github/workflows/refresh-wordpress-major-and-beta.yml"
    ".github/workflows/refresh-wordpress-nightly.yml"
    ".github/workflows/update-changelog.yml"
)

for FILE in "${WORKFLOW_FILES[@]}"; do
    [[ -f "$FILE" ]] || continue
    info "Updating ${FILE}..."
    if $DRY_RUN; then
        warn "  [dry-run] Would update trunk references in ${FILE}"
    else
        sed_inplace \
            -e "s|refs/heads/trunk|refs/heads/main|g" \
            -e "s|origin/trunk|origin/main|g" \
            -e "s|git fetch origin trunk|git fetch origin main|g" \
            -e "s|HEAD:trunk|HEAD:main|g" \
            -e "s|ref: trunk|ref: main|g" \
            "$FILE"
    fi
done

# Branch triggers use a different indented format
for FILE in ".github/workflows/ci.yml" ".github/workflows/publish-php-wasm-binaries.yml"; do
    [[ -f "$FILE" ]] || continue
    if $DRY_RUN; then
        warn "  [dry-run] Would update branch trigger in ${FILE}"
    else
        sed_inplace -e "s|            - trunk|            - main|" "$FILE"
    fi
done

info "Updating AGENTS.md..."
if $DRY_RUN; then
    warn "  [dry-run] Would update trunk references in AGENTS.md"
else
    sed_inplace \
        -e "s|\`trunk\` is the primary development branch|\`main\` is the primary development branch|g" \
        -e "s|git clone -b trunk|git clone -b main|g" \
        -e "s|\`trunk\`|\`main\`|g" \
        AGENTS.md
fi
success "References updated."

# --- Step 5: Commit reference updates ----------------------------------------

step "Commit reference updates"

if $DRY_RUN; then
    warn "[dry-run] Would commit updated references."
else
    git config user.name "deployment_bot"
    git config user.email "deployment_bot@users.noreply.github.com"
    git add -A
    # Only commit if there are actual changes
    if ! git diff --cached --quiet; then
        git commit -m "Phase 2: rename default branch from \`trunk\` to \`main\`"
        success "Committed reference updates."
    else
        success "No reference changes to commit."
    fi
fi

# --- Step 6: Force-push main to GitHub ---------------------------------------

step "Force-push \`main\` to GitHub"

warn "About to force-push \`main\` to origin."
confirm "Force-push main?"

run "git push origin main --force"
success "Pushed \`main\` to GitHub."

# --- Step 7: Change default branch -------------------------------------------

step "Change default branch"

info "Setting default branch to \`main\` on GitHub..."
run "gh repo edit \"${REPO}\" --default-branch main"
success "Default branch is now \`main\`."

# --- Done --------------------------------------------------------------------

echo
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║  Phase 2 complete!                                   ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo
echo "Next steps:"
echo
echo "  1. Announce to contributors — they must run:"
echo "       git fetch origin"
echo "       git checkout main"
echo "       git branch -D trunk"
echo "       npm run setup:binaries"
echo
echo "  2. Ask open PR authors to rebase their branches onto main."
echo
echo "  3. Keep \`trunk\` as a read-only historical archive, or delete it:"
echo "       gh api --method DELETE repos/${REPO}/git/refs/heads/trunk"
echo
echo "  4. Update any external references to \`trunk\` (docs site, Telex, Studio, wp-env)."
echo
