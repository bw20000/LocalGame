#!/bin/bash
# Local Game Studio launcher (macOS). Double-click this file in Finder.
# First run: sets up a private Node.js runtime (if your Mac doesn't have one) and checks for Ollama.
# After that it just starts the studio and opens it in your browser. Everything stays on this Mac.
cd "$(dirname "$0")" || exit 1
exec /bin/bash scripts/start.sh "$@"
