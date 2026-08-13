#!/usr/bin/env bash
# Build torpc.pdf from torpc.tex using Tectonic.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v tectonic >/dev/null 2>&1; then
  echo "error: tectonic not found." >&2
  echo "install it:" >&2
  echo "  macOS:  brew install tectonic" >&2
  echo "  else:   https://tectonic-typesetting.github.io/install.html" >&2
  exit 1
fi

echo "building torpc.pdf ..."
tectonic torpc.tex
echo "done -> torpc.pdf"
