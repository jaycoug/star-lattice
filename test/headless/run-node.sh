#!/bin/sh
# Every headless check, under Node (16+): the unit tests, the module load, and the click-throughs.
# Usage: sh test/headless/run-node.sh   (ONLY="treeflow qsetflow" runs just those click-throughs)
# Each check runs on its own throwaway copy of the project, whose saves/ and content/ are the test
# fixtures (test/fixtures/): your own saves are never read or touched. Exits 1 when anything fails.
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FAILED=0
fresh() {
  rm -rf "$TMP/p"; mkdir -p "$TMP/p"
  (cd "$ROOT" && tar cf - --exclude=./archive --exclude=./saves --exclude=./content --exclude=./exam3_prep --exclude=./dist --exclude=./node_modules .) | tar xf - -C "$TMP/p"
  cp -r "$ROOT/test/fixtures/saves" "$ROOT/test/fixtures/content" "$TMP/p/"
}
# Windows' Node wants C:/… paths (Git Bash's pwd -W); elsewhere the plain path.
path() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }
check() {
  s=$1; shift
  limit=60; [ "$s" = quizflow ] && limit=180; [ "$s" = funflow ] && limit=150   # the quiz and fun click-throughs are the longest
  fresh
  (cd "$TMP/p/test/headless" && timeout $limit node "$s.js" "$(path "$TMP/p")") > "$TMP/out" 2>&1
  [ $? -eq 124 ] && { echo "  TIMEOUT: $s was stopped after $limit seconds ($(grep -c '^ok' "$TMP/out") steps)"; FAILED=1; }
  grep -qE '^FAIL|Error' "$TMP/out" && FAILED=1
  "$@" < "$TMP/out"
  return 0
}
echo "== unit tests"; check runtests tail -1
echo "== modules"; check loadall tail -1
for f in ${ONLY:-smoke treeflow palettes playflow designflow schedflow screenflow quizflow indflow importflow qsetflow testrun layoutflow deckflow tourflow funflow apartflow}; do
  echo "== $f"; check $f sh -c "grep -E '^(ok|FAIL)|Error' | sed 's/^/  /'"
done
[ $FAILED -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit $FAILED
