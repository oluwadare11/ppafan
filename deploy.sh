#!/bin/bash

###############################################################################
# PPAFAN DEPLOY
# Commits, pushes to main → GitHub Actions builds & deploys to VPS
#
# Usage:
#   ./deploy.sh                   # prompts for commit message
#   ./deploy.sh "feat: message"   # uses provided message
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

COMMIT_MSG="${1:-}"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        PPAFAN DEPLOY                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}✗ Not a git repository${NC}"
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${BLUE}→${NC} Switching to main..."
    if ! git checkout main 2>/dev/null; then
        echo -e "${RED}✗ Cannot switch to main — commit or stash changes on '$CURRENT_BRANCH' first.${NC}"
        exit 1
    fi
fi

HAS_CHANGES=0
if ! git diff --quiet 2>/dev/null; then HAS_CHANGES=1; fi
if ! git diff --cached --quiet 2>/dev/null; then HAS_CHANGES=1; fi
if [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then HAS_CHANGES=1; fi

if [ $HAS_CHANGES -eq 1 ]; then
    if [ -z "$COMMIT_MSG" ]; then
        printf "  Commit message: "
        read -r COMMIT_MSG
        [ -z "$COMMIT_MSG" ] && COMMIT_MSG="deploy: $(date '+%Y-%m-%d %H:%M')"
    fi
    git add -A
    git commit -m "$COMMIT_MSG"
    echo -e "  ${GREEN}✓${NC} Committed: \"$COMMIT_MSG\""
else
    echo -e "  Nothing to commit — pushing latest."
fi

git push origin main
echo -e "${GREEN}✓${NC} Pushed → origin/main"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✓  GitHub Actions now deploying    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  App:      ${CYAN}https://app.ppafan.org${NC}"
echo -e "  Actions:  ${BLUE}https://github.com/oluwadare11/ppafan/actions${NC}"
echo ""
