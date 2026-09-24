#!/bin/bash
# Tests for scripts/release.sh and scripts/check-release.sh (REV-LINST-19,
# REV-LINST-02). They run on a throwaway git repository made from this
# checkout's files, with its current state committed and tagged as the last
# release; nothing here touches the real repository.
#
# Usage: scripts/tests/test-release.sh      (TEST_BASH=/path/to/bash-3.2 to run the scripts with it)

set -u

REAL_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_BASH="${TEST_BASH:-bash}"
T="$(mktemp -d "${TMPDIR:-/tmp}/zenleap-release-test.XXXXXX")"
PASS=0
FAIL=0
trap 'if [ "${KEEP:-}" = 1 ]; then echo "kept: $T"; else rm -rf "$T"; fi' EXIT

ok()  { PASS=$((PASS + 1)); echo "ok - $*"; }
bad() { FAIL=$((FAIL + 1)); echo "not ok - $*"; }
check() {  # check <description> <command...>
    local desc="$1"
    shift
    if "$@"; then ok "$desc"; else bad "$desc"; fi
}
has()   { grep -qF -- "$2" "$1"; }
lacks() { ! grep -qF -- "$2" "$1"; }
rc_is() { [ "$RC" = "$1" ]; }

# shellcheck disable=SC2016  # $BASH_VERSION of the bash under test
echo "# ZenLeap release tooling tests (bash under test: $("$TEST_BASH" -c 'echo $BASH_VERSION'))"

G="$T/repo"
mkdir -p "$G"
(cd "$REAL_REPO" && tar cf - --exclude=./.git --exclude=./dist .) | (cd "$G" && tar xf -)
VERSION=$(sed -n '1,10s|^// @version[[:space:]]*\([0-9][0-9.]*\).*|\1|p' "$G/JS/zenleap.uc.js" | head -n 1)
LAST_DATE=$(sed -n 's|^[[:space:]]*"updatedAt":[[:space:]]*"\([^"]*\)".*|\1|p' "$G/theme.json" | head -n 1)
NEXT=$(echo "$VERSION" | awk -F. '{ printf "%d.%d.%d", $1, $2, $3 + 1 }')
git_() { git -C "$G" -c user.name=t -c user.email=t@example.invalid "$@"; }
git_ init -q
git_ add -A
git_ commit -qm "last release"
git_ tag "v$VERSION"

OUT="$T/out.log"
rel() { (cd "$G" && "$TEST_BASH" scripts/release.sh "$@") > "$OUT" 2>&1; RC=$?; }
snap() { cat "$G/JS/zenleap.uc.js" "$G/theme.json" "$G/ZenLeap Manager.app/Contents/Info.plist" "$G/CHECKSUMS.sha256" | cksum; }
updated_at() { sed -n 's|^[[:space:]]*"updatedAt":[[:space:]]*"\([^"]*\)".*|\1|p' "$G/theme.json" | head -n 1; }

# 1. updatedAt must move forward: Sine only offers a later one
before=$(snap)
rel "$NEXT" --date 2020-01-01T00:00:00Z
check "updatedAt older than the current one: refused" rc_is 1
check "... says why" has "$OUT" "Sine would not offer this release"
check "... nothing written" test "$(snap)" = "$before"
rel "$NEXT" --date "$LAST_DATE"
check "updatedAt equal to the current one: refused" rc_is 1
check "... nothing written" test "$(snap)" = "$before"

# 2. The last release's updatedAt counts too (a lowered theme.json doesn't help)
sed -i.bak "s|\"updatedAt\": \"[^\"]*\"|\"updatedAt\": \"2001-01-01T00:00:00Z\"|" "$G/theme.json" && rm -f "$G/theme.json.bak"
rel "$NEXT" --date 2002-01-01T00:00:00Z
check "updatedAt older than the last release tag's: refused" rc_is 1
check "... names the tag" has "$OUT" "v$VERSION's $LAST_DATE"
git_ checkout -q -- theme.json

# 2b. An updatedAt without a time (as in releases before 3.3.5) is midnight UTC
sed -i.bak "s|\"updatedAt\": \"[^\"]*\"|\"updatedAt\": \"2031-05-05\"|" "$G/theme.json" && rm -f "$G/theme.json.bak"
before=$(snap)
rel "$NEXT" --date 2031-05-04T23:59:59Z
check "date-only updatedAt: a time on the day before is refused" rc_is 1
check "... nothing written" test "$(snap)" = "$before"
git_ checkout -q -- theme.json

# 3. A failing edit writes nothing (edits are staged)
cp "$G/JS/zenleap.uc.js" "$T/js-saved"
sed -i.bak "/const VERSION = '/d" "$G/JS/zenleap.uc.js" && rm -f "$G/JS/zenleap.uc.js.bak"
cp "$G/theme.json" "$T/theme-saved"
rel "$NEXT" --date 2030-01-01T00:00:00Z
check "an edit that fails: exit 1" rc_is 1
check "... says nothing was written" has "$OUT" "nothing was written"
check "... theme.json untouched" cmp -s "$T/theme-saved" "$G/theme.json"
cp "$T/js-saved" "$G/JS/zenleap.uc.js"

# 4. A new version: every field, a later updatedAt
printf '## [%s] - 2030-01-01\n\n- test\n\n' "$NEXT" | cat - "$G/CHANGELOG.md" > "$T/cl" && mv "$T/cl" "$G/CHANGELOG.md"
rel "$NEXT" --date 2030-01-01T00:00:00Z
check "new version: @version set" has "$G/JS/zenleap.uc.js" "@version        $NEXT"
check "new version: theme.json version set" has "$G/theme.json" "\"version\": \"$NEXT\""
check "new version: updatedAt set" test "$(updated_at)" = "2030-01-01T00:00:00Z"
check "new version: Info.plist set" has "$G/ZenLeap Manager.app/Contents/Info.plist" "<string>$NEXT</string>"
check "new version: CHECKSUMS.sha256 matches" test "$(cut -d' ' -f1 "$G/CHECKSUMS.sha256")" = "$(sha256sum < "$G/JS/zenleap.uc.js" | cut -d' ' -f1)"

# 5. A re-run for the same version keeps updatedAt (no new stamp for Sine)
rel "$NEXT"
check "re-run: updatedAt kept" test "$(updated_at)" = "2030-01-01T00:00:00Z"
rel "$NEXT" --date 2030-02-01T00:00:00Z
check "re-run with --date: updatedAt changed" test "$(updated_at)" = "2030-02-01T00:00:00Z"

# 6. A tagged version is never re-released
git_ add -A
git_ commit -qm "Release v$NEXT"
git_ tag "v$NEXT"
before=$(snap)
rel "$NEXT" --date 2031-01-01T00:00:00Z
check "already tagged: refused" rc_is 1
check "... says so" has "$OUT" "already tagged"
check "... nothing written" test "$(snap)" = "$before"

# 7. check-release.sh: updatedAt against the last release tag
ck() { (cd "$G" && "$TEST_BASH" scripts/check-release.sh) > "$OUT" 2>&1; RC=$?; }
ck
check "check-release: the tagged release's updatedAt passes" lacks "$OUT" "FAIL  theme.json updatedAt"
sed -i.bak "s|\"updatedAt\": \"[^\"]*\"|\"updatedAt\": \"2029-01-01T00:00:00Z\"|" "$G/theme.json" && rm -f "$G/theme.json.bak"
ck
check "check-release: updatedAt earlier than the last release's: FAIL" has "$OUT" "is earlier than v$NEXT's"
git_ checkout -q -- theme.json
NEXT2=$(echo "$NEXT" | awk -F. '{ printf "%d.%d.%d", $1, $2, $3 + 1 }')
sed -i.bak "s|\"version\": \"$NEXT\"|\"version\": \"$NEXT2\"|" "$G/theme.json" && rm -f "$G/theme.json.bak"
sed -i.bak "1,10s|@version        $NEXT|@version        $NEXT2|; s|const VERSION = '$NEXT'|const VERSION = '$NEXT2'|" "$G/JS/zenleap.uc.js" && rm -f "$G/JS/zenleap.uc.js.bak"
ck
check "check-release: a new version with the old updatedAt: FAIL" has "$OUT" "Sine would not offer $NEXT2"

echo ""
echo "# $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
