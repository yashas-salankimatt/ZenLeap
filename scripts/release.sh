#!/bin/bash
# Prepare a ZenLeap release: set every version field at once, regenerate
# CHECKSUMS.sha256, then run scripts/check-release.sh.
#
# Usage: scripts/release.sh <version> [--date <YYYY-MM-DDTHH:MM:SSZ>] [--package]
#        scripts/release.sh --checksums    only regenerate CHECKSUMS.sha256
#
# Updates:
#   JS/zenleap.uc.js         "// @version" header and `const VERSION`
#   theme.json               "version" and "updatedAt" (Sine updates a mod only
#                            when updatedAt increases; default: now, UTC). It
#                            must be later than the current value and the last
#                            release's; a re-run for the same version keeps it
#                            unless --date is given
#   ZenLeap Manager.app      Info.plist CFBundleVersion / CFBundleShortVersionString
#   CHECKSUMS.sha256         `sha256sum` line for JS/zenleap.uc.js; the in-browser
#                            updater and the installers refuse a release whose
#                            script does not match it
# --package also builds dist/ZenLeap-Manager-v<version>-macos.zip for the GitHub release.
#
# The edits are made on copies and written only when all of them worked. It
# refuses a version that is already tagged. It does not commit, tag or push.
# See RELEASING.md for the whole process.

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/zen-paths.sh
. "$ROOT/scripts/lib/zen-paths.sh"

JS="$ROOT/JS/zenleap.uc.js"
THEME="$ROOT/theme.json"
PLIST="$ROOT/ZenLeap Manager.app/Contents/Info.plist"
SUMS="$ROOT/CHECKSUMS.sha256"

usage() {
    sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

write_checksums() {
    printf '%s  JS/zenleap.uc.js\n' "$(zp_sha256 "$JS")" > "$SUMS"
    echo "wrote CHECKSUMS.sha256: $(cat "$SUMS")"
}

# edit_file <staged copy> <name> <sed-expression>: sed on a staged copy
# (portable: GNU and BSD); fails if nothing changed
edit_file() {
    local tmp="$1.sed"
    sed -E "$3" "$1" > "$tmp"
    if cmp -s "$1" "$tmp"; then
        rm -f "$tmp"
        echo "error: no change made to $2 by: $3 (nothing was written)" >&2
        exit 1
    fi
    mv -f "$tmp" "$1"
}

# "updatedAt" of a theme.json on stdin
theme_updated_at() {
    sed -n 's|^[[:space:]]*"updatedAt":[[:space:]]*"\([^"]*\)".*|\1|p' | head -n 1
}

# An ISO date as a number (20260323023136), for comparing. A date without a
# time (older releases' theme.json) is midnight UTC, as for Sine.
iso_num() {
    local n="${1//[!0-9]/}000000"
    printf '%s\n' "${n:0:14}"
}

VERSION=""
DATE=""
PACKAGE=false
while [ $# -gt 0 ]; do
    case "$1" in
        --checksums)
            write_checksums
            exit 0
            ;;
        --date)
            shift
            DATE="${1:-}"
            ;;
        --package)
            PACKAGE=true
            ;;
        -h|--help)
            usage 0
            ;;
        -*)
            echo "unknown option: $1" >&2
            usage 2
            ;;
        *)
            VERSION="${1#v}"
            ;;
    esac
    shift
done

if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "error: give the new version as X.Y.Z (got '${VERSION}')" >&2
    usage 2
fi
if [ -n "$DATE" ] && ! [[ $DATE =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
    echo "error: --date must look like 2026-03-23T02:31:36Z" >&2
    exit 2
fi

current="$(zp_file_version "$JS")"
if [ "$current" != "$VERSION" ] && zp_version_gte "$current" "$VERSION"; then
    echo "error: $VERSION is not newer than the current version $current" >&2
    exit 1
fi
# A released tag is never changed: release a new version instead
if git -C "$ROOT" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null 2>&1; then
    echo "error: v$VERSION is already tagged; release a new version instead" >&2
    exit 1
fi

# updatedAt. Sine offers an update only when it is later than the installed
# copy's, so it must move forward: past the current value (unless this is a
# re-run for the same version, which keeps its stamp) and past the last
# release's.
theme_version=$(sed -n 's|^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*|\1|p' "$THEME" | head -n 1)
current_date=$(theme_updated_at < "$THEME")
last_tag=$(git -C "$ROOT" describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)
last_date=""
if [ -n "$last_tag" ]; then
    last_date=$(git -C "$ROOT" show "$last_tag:theme.json" 2>/dev/null | theme_updated_at)
fi
rerun=false
if [ "$theme_version" = "$VERSION" ] && [ "$current" = "$VERSION" ]; then rerun=true; fi
if [ -z "$DATE" ]; then
    if [ "$rerun" = true ] && [ -n "$current_date" ]; then
        DATE="$current_date"
    else
        DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    fi
fi
if [ "$rerun" != true ] && [ -n "$current_date" ] && [ "$(iso_num "$DATE")" -le "$(iso_num "$current_date")" ]; then
    echo "error: updatedAt $DATE is not later than theme.json's current $current_date; Sine would not offer this release" >&2
    exit 1
fi
if [ -n "$last_date" ] && [ "$(iso_num "$DATE")" -le "$(iso_num "$last_date")" ]; then
    echo "error: updatedAt $DATE is not later than $last_tag's $last_date; Sine would not offer this release" >&2
    exit 1
fi
echo "ZenLeap ${current:-?} -> $VERSION (updatedAt $DATE)"

# Edit copies; write them only when every edit worked
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp "$JS" "$STAGE/js"
cp "$THEME" "$STAGE/theme"
cp "$PLIST" "$STAGE/plist"
if [ "$current" != "$VERSION" ]; then
    edit_file "$STAGE/js" JS/zenleap.uc.js "1,10s|^(// @version[[:space:]]+)[0-9][0-9.]*|\\1$VERSION|"
    edit_file "$STAGE/js" JS/zenleap.uc.js "s|^([[:space:]]*const VERSION = ')[^']*(';)|\\1$VERSION\\2|"
fi
if [ "$theme_version" != "$VERSION" ]; then
    edit_file "$STAGE/theme" theme.json "s|^([[:space:]]*\"version\":[[:space:]]*\")[^\"]*(\")|\\1$VERSION\\2|"
fi
if [ "$DATE" != "$current_date" ]; then
    edit_file "$STAGE/theme" theme.json "s|^([[:space:]]*\"updatedAt\":[[:space:]]*\")[^\"]*(\")|\\1$DATE\\2|"
fi

# Info.plist: the <string> after each version key
awk -v v="$VERSION" '
    /<key>CFBundleVersion<\/key>|<key>CFBundleShortVersionString<\/key>/ { print; want = 1; next }
    want && /<string>/ { sub(/<string>[^<]*<\/string>/, "<string>" v "</string>"); want = 0 }
    { print }
' "$STAGE/plist" > "$STAGE/plist.new"
mv -f "$STAGE/plist.new" "$STAGE/plist"

cat "$STAGE/js" > "$JS"
cat "$STAGE/theme" > "$THEME"
cat "$STAGE/plist" > "$PLIST"
write_checksums

if ! grep -q "^## \[$VERSION\]" "$ROOT/CHANGELOG.md"; then
    echo ""
    echo "note: CHANGELOG.md has no '## [$VERSION] - <date>' section yet; add it before tagging"
    echo "      (the in-browser update dialog shows that section)."
fi

if [ "$PACKAGE" = true ]; then
    mkdir -p "$ROOT/dist"
    zip_path="$ROOT/dist/ZenLeap-Manager-v$VERSION-macos.zip"
    rm -f "$zip_path"
    (cd "$ROOT" && zip -qry "$zip_path" "ZenLeap Manager.app" -x '*.DS_Store')
    echo "built ${zip_path#"$ROOT"/}"
fi

echo ""
"$ROOT/scripts/check-release.sh" "$VERSION"
