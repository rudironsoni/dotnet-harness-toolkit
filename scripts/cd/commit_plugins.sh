#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

if [[ ! -d "$REPO_ROOT/plugins" ]]; then
  fail "plugins directory does not exist: $REPO_ROOT/plugins"
fi

emit_outputs() {
  local changed="$1"
  local commit_sha="$2"
  local pr_url="$3"
  local pr_created="$4"

  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    {
      echo "changed=$changed"
      echo "commit_sha=$commit_sha"
      echo "pr_url=$pr_url"
      echo "pr_created=$pr_created"
    } >> "$GITHUB_OUTPUT"
  fi
}

pushd "$REPO_ROOT" >/dev/null

git add plugins

if git diff --cached --quiet; then
  log "No plugin bundle changes to commit"
  emit_outputs "false" "" "" "false"
  popd >/dev/null
  exit 0
fi

GIT_AUTHOR_NAME="github-actions[bot]" \
GIT_AUTHOR_EMAIL="41898282+github-actions[bot]@users.noreply.github.com" \
GIT_COMMITTER_NAME="github-actions[bot]" \
GIT_COMMITTER_EMAIL="41898282+github-actions[bot]@users.noreply.github.com" \
git commit -m "chore: regenerate plugin bundles"

commit_sha="$(git rev-parse HEAD)"

set +e
push_output="$(git push 2>&1)"
push_exit_code=$?
set -e

if [[ "$push_exit_code" -ne 0 ]]; then
  if [[ "$push_output" == *"GH013"* || "$push_output" == *"Cannot update this protected ref"* || "$push_output" == *"Changes must be made through a pull request"* ]]; then
    if ! command -v gh >/dev/null 2>&1; then
      fail "Push to main blocked by repository rules and gh is unavailable to open a fallback PR"
    fi

    fallback_branch="automation/plugin-bundles-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}"
    repo_slug="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

    log "Push to protected main blocked; creating fallback branch $fallback_branch"
    git checkout -b "$fallback_branch"
    git push -u origin "$fallback_branch"

    pr_title="chore: regenerate plugin bundles"
    pr_body="Automated plugin bundle regeneration from GitHub Actions run ${GITHUB_RUN_ID:-unknown}."

    set +e
    pr_url="$(gh pr create -R "$repo_slug" --base main --head "$fallback_branch" --title "$pr_title" --body "$pr_body" 2>&1)"
    pr_create_exit_code=$?
    set -e

    if [[ "$pr_create_exit_code" -eq 0 ]]; then
      log "Created fallback PR: $pr_url"
      emit_outputs "false" "$commit_sha" "$pr_url" "true"
      popd >/dev/null
      exit 0
    fi

    if [[ "$pr_url" == *"not permitted to create or approve pull requests"* \
      || "$pr_url" == *"not permitted"* \
      || "$pr_url" == *"permission"* \
      || "$pr_url" == *"Resource not accessible by integration"* ]]; then
      compare_url="https://github.com/${repo_slug}/compare/main...${fallback_branch}?expand=1"
      log "GitHub Actions token cannot create PRs in this repo; open manually: $compare_url"
      emit_outputs "false" "$commit_sha" "$compare_url" "false"
      popd >/dev/null
      exit 0
    fi

    printf '%s\n' "$pr_url"
    fail "Failed to create fallback PR"
  fi

  printf '%s\n' "$push_output"
  fail "Failed to push plugin bundle commit"
fi

emit_outputs "true" "$commit_sha" "" "false"

popd >/dev/null
