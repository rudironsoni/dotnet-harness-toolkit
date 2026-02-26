#!/usr/bin/env bash
set -euo pipefail

# Build per-platform plugin bundles for distribution
# Creates zip files in dist/ directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DIST_DIR="${PROJECT_ROOT}/dist"

echo "Building plugin bundles..."
echo "Project root: ${PROJECT_ROOT}"
echo "Output: ${DIST_DIR}"

# Clean and create dist directory
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# Generate all platform outputs first
echo ""
echo "=== Generating RuleSync outputs ==="
cd "${PROJECT_ROOT}"

# Generate for all targets
npx rulesync generate --targets "*" --features "*"

# Define platforms and their output directories
declare -A PLATFORM_DIRS=(
    ["claudecode"]=".claude"
    ["opencode"]=".opencode"
    ["copilot"]=".github"
    ["codexcli"]=".codex"
    ["geminicli"]=".gemini"
    ["agentsmd"]=".agents"
    ["antigravity"]=".antigravity"
)

# Build bundles for each platform
echo ""
echo "=== Building platform bundles ==="

for platform in "${!PLATFORM_DIRS[@]}"; do
    src_dir="${PROJECT_ROOT}/${PLATFORM_DIRS[$platform]}"
    bundle_name="dotnet-agent-harness-${platform}.zip"
    bundle_path="${DIST_DIR}/${bundle_name}"
    
    if [[ -d "$src_dir" ]]; then
        echo "Building ${bundle_name}..."
        cd "${PROJECT_ROOT}"
        zip -r "${bundle_path}" "${PLATFORM_DIRS[$platform]}" -x "*.git*" -x "*/node_modules/*" 2>/dev/null || {
            echo "Warning: Could not create zip for ${platform}"
            continue
        }
        
        if [[ -f "$bundle_path" ]]; then
            size=$(du -h "$bundle_path" | cut -f1)
            echo "  Created ${bundle_name} (${size})"
        fi
    else
        echo "Skipping ${platform}: directory ${src_dir} does not exist"
    fi
done

# Summary
echo ""
echo "=== Build complete ==="
echo "Bundles in ${DIST_DIR}:"
ls -lh "${DIST_DIR}"/*.zip 2>/dev/null || echo "  (no bundles created)"
