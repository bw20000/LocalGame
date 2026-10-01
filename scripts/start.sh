#!/bin/bash
# Starts Local Game Studio. Used by START_GAME_STUDIO.command (macOS) and runnable directly on Linux.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
PORT="${LGS_PORT:-4317}"
NODE_VERSION="v22.12.0"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# 1) Node.js: use the system one if it is new enough, else a private copy in ./runtime
node_ok() { command -v "$1" >/dev/null 2>&1 && "$1" -e 'process.exit(+process.versions.node.split(".")[0] >= 18 ? 0 : 1)' 2>/dev/null; }
NODE=""
if [ -x "$ROOT/runtime/node/bin/node" ]; then NODE="$ROOT/runtime/node/bin/node"; elif node_ok node; then NODE="$(command -v node)"; fi
if [ -z "$NODE" ]; then
  say "First-time setup: downloading a private copy of Node.js ($NODE_VERSION) into ./runtime (about 45 MB, one time)."
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) PLAT="darwin-arm64" ;; Darwin-x86_64) PLAT="darwin-x64" ;; Linux-x86_64) PLAT="linux-x64" ;; Linux-aarch64) PLAT="linux-arm64" ;;
    *) echo "Unsupported platform $(uname -s)-$(uname -m). Install Node.js 18+ from https://nodejs.org and run again."; read -r -p "Press Return to close."; exit 1 ;;
  esac
  mkdir -p "$ROOT/runtime" && cd "$ROOT/runtime" || exit 1
  URL="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$PLAT.tar.gz"
  if ! curl -fL --progress-bar "$URL" -o node.tgz; then echo "Download failed. Check your internet connection (needed only for this first setup)."; read -r -p "Press Return to close."; exit 1; fi
  if curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o SHASUMS256.txt; then
    EXPECTED="$(grep "node-$NODE_VERSION-$PLAT.tar.gz" SHASUMS256.txt | awk '{print $1}')"
    if command -v shasum >/dev/null 2>&1; then ACTUAL="$(shasum -a 256 node.tgz | awk '{print $1}')"; else ACTUAL="$(sha256sum node.tgz | awk '{print $1}')"; fi
    if [ -z "$EXPECTED" ] || [ "$EXPECTED" != "$ACTUAL" ]; then echo "Checksum mismatch — refusing to use the download."; rm -f node.tgz; read -r -p "Press Return to close."; exit 1; fi
  fi
  tar -xzf node.tgz && rm -f node.tgz SHASUMS256.txt && mv "node-$NODE_VERSION-$PLAT" node
  cd "$ROOT" || exit 1
  NODE="$ROOT/runtime/node/bin/node"
fi

# 2) Local AI runtime (optional): Ollama
if command -v ollama >/dev/null 2>&1 || [ -d "/Applications/Ollama.app" ]; then
  if ! curl -fs "http://127.0.0.1:11434/api/version" >/dev/null 2>&1; then
    say "Starting Ollama (local AI runtime)…"
    if [ -d "/Applications/Ollama.app" ]; then open -ga Ollama; else (ollama serve >/dev/null 2>&1 &); fi
    for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fs "http://127.0.0.1:11434/api/version" >/dev/null 2>&1 && break; sleep 1; done
  fi
else
  say "Ollama (the local AI runtime) is not installed."
  echo "The studio works without it — it builds complete games from its design library — but a local model"
  echo "adds richer content, critique and new systems. To add it later: install from https://ollama.com/download,"
  echo "then pick a model on the studio's Models page. Nothing is installed without you."
fi

# 3) Already running?
if curl -fs "http://127.0.0.1:$PORT/api/status" >/dev/null 2>&1; then
  say "Local Game Studio is already running."
  (command -v open >/dev/null && open "http://127.0.0.1:$PORT") || (command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:$PORT") || echo "Open http://127.0.0.1:$PORT"
  exit 0
fi

say "Starting Local Game Studio at http://127.0.0.1:$PORT  (close this window to stop it)"
exec "$NODE" studio/server/index.js --port="$PORT" --open
