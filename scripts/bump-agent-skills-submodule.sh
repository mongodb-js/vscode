#!/usr/bin/env bash
# Point ext/agent-skills at the latest GitHub release of mongodb/agent-skills.
# In GitHub Actions, writes bumped=true|false and tag=... to GITHUB_OUTPUT when set.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SUBMODULE_PATH="ext/agent-skills"
SKILLS_REPO="mongodb/agent-skills"

append_github_output() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf '%s\n' "$1" >>"$GITHUB_OUTPUT"
  fi
}

if ! command -v gh >/dev/null 2>&1; then
  echo 'error: gh CLI is required (https://cli.github.com/)' >&2
  exit 1
fi

TAG="$(gh release view --repo "$SKILLS_REPO" --json tagName -q .tagName 2>/dev/null || true)"
if [ -z "$TAG" ]; then
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo '::notice::Could not read latest release from mongodb/agent-skills; skipping.'
  else
    echo 'Could not read latest release from mongodb/agent-skills; skipping.' >&2
  fi
  append_github_output 'bumped=false'
  exit 0
fi

if ! git -C "$SUBMODULE_PATH" rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: submodule ${SUBMODULE_PATH} is not initialized (run: git submodule update --init)" >&2
  exit 1
fi

git -C "$SUBMODULE_PATH" fetch origin "refs/tags/${TAG}:refs/tags/${TAG}"

if ! TARGET="$(git -C "$SUBMODULE_PATH" rev-parse "${TAG}^{commit}")"; then
  echo "error: could not resolve tag ${TAG} to a commit in ${SUBMODULE_PATH}" >&2
  exit 1
fi

CURRENT="$(git -C "$SUBMODULE_PATH" rev-parse HEAD)"
if [ "$CURRENT" = "$TARGET" ]; then
  echo "agent-skills submodule already at ${TAG} (no bump needed)"
  append_github_output 'bumped=false'
  exit 0
fi

git -C "$SUBMODULE_PATH" checkout "$TAG"

append_github_output "tag=${TAG}"
append_github_output 'bumped=true'
echo "agent-skills submodule updated to ${TAG}"
