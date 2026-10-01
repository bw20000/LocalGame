#!/bin/bash
# Optional: enables automated browser testing + screenshots. Installs playwright-core (≈3 MB, no browser
# download) into studio-data/tools and uses Google Chrome / Microsoft Edge already on this computer.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$ROOT/runtime/node/bin/node"; [ -x "$NODE" ] || NODE="$(command -v node)"
NPM="$(dirname "$NODE")/npm"; [ -x "$NPM" ] || NPM="$(command -v npm)"
mkdir -p "$ROOT/studio-data/tools" && cd "$ROOT/studio-data/tools"
[ -f package.json ] || echo '{"private":true}' > package.json
"$NPM" install --no-audit --no-fund playwright-core@1
if [ ! -d "/Applications/Google Chrome.app" ] && [ ! -d "/Applications/Microsoft Edge.app" ] && ! command -v chromium >/dev/null && ! command -v google-chrome >/dev/null; then
  echo "No Chrome/Edge found. Install Google Chrome, or set LGS_CHROME=/path/to/chrome before starting the studio."
fi
echo "Browser tests enabled."
