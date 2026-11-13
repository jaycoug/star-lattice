#!/bin/sh
# Star Lattice: starts its local server and opens it in your browser (macOS, Linux).
# Close this terminal (or press Ctrl+C) to stop it. Make it clickable once: chmod +x start-star-lattice.sh
cd "$(dirname "$0")" || exit 1
for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1 && "$py" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)'; then
    exec "$py" serve.py "$@" --open
  fi
done
echo "Star Lattice needs Python 3: https://www.python.org/downloads/"
exit 1
