#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

if ! command -v gh >/dev/null 2>&1; then
  fail "GitHub CLI (gh) is required"
fi

pushd "$REPO_ROOT" >/dev/null

target_commit_sha="${1:-$(git rev-parse HEAD)}"

if ! git cat-file -e "$target_commit_sha^{commit}" 2>/dev/null; then
  fail "Commit does not exist: $target_commit_sha"
fi

latest_tag="$(git tag --list 'plugins/v*' --sort=-v:refname | head -n 1)"

if [[ -z "$latest_tag" ]]; then
  next_tag="plugins/v0.1.0"
else
  current_version="${latest_tag#plugins/v}"
  IFS='.' read -r major minor patch <<<"$current_version"
  patch=$((patch + 1))
  next_tag="plugins/v${major}.${minor}.${patch}"
fi

if git rev-parse --quiet --verify "refs/tags/$next_tag" >/dev/null; then
  fail "Tag already exists: $next_tag"
fi

log "Creating plugin release tag: $next_tag"
git tag -a "$next_tag" "$target_commit_sha" -m "Plugin bundle release $next_tag"
git push origin "$next_tag"

repo_slug="${REPO_SLUG:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

log "Creating GitHub release with generated changelog: $next_tag"
gh release create "$next_tag" \
  -R "$repo_slug" \
  --target "$target_commit_sha" \
  --title "$next_tag" \
  --generate-notes

popd >/dev/null
