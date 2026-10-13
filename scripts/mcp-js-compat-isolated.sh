#!/usr/bin/env bash
# Tests the newest stable @lovable.dev/mcp-js in a throwaway copy of the project.
# Never touches this checkout's package.json, lockfile or node_modules.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LATEST=$(npm view @lovable.dev/mcp-js versions --json | node -e 'const v=JSON.parse(require("fs").readFileSync(0));const s=v.filter(x=>/^4\.\d+\.\d+$/.test(x));console.log(s.at(-1)||"")')
[ -z "$LATEST" ] && { echo "No stable 4.x release yet — nothing to test."; exit 0; }
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
tar -C "$ROOT" --exclude=node_modules --exclude=.git --exclude=dist --exclude=.output -cf - . | tar -C "$TMP" -xf -
cd "$TMP"
echo "Testing @lovable.dev/mcp-js@$LATEST in isolation ($TMP)"
bun install --frozen-lockfile >/dev/null
bun add "@lovable.dev/mcp-js@$LATEST" >/dev/null
node scripts/check-build-tool-pin.mjs
RESULT=PASS
bunx vitest run tests/mcp-tools.test.ts || RESULT=FAIL
[ "$RESULT" = PASS ] && { bun run build >/dev/null 2>&1 || RESULT=FAIL; }
echo "COMPATIBILITY @lovable.dev/mcp-js@$LATEST: $RESULT"
[ "$RESULT" = PASS ]
