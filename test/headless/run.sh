#!/bin/sh
# The headless checks run under Node only (stage 5): this is run-node.sh.
exec sh "$(dirname "$0")/run-node.sh" "$@"
