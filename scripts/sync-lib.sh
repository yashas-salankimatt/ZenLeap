#!/bin/bash
# Copy scripts/lib/zen-paths.sh into the scripts that embed it (install.sh and
# the macOS ZenLeap Manager), between their "# >>> zen-paths.sh" and
# "# <<< zen-paths.sh" marker lines. Those scripts must work when downloaded
# on their own, so they cannot source the library.
#
# Usage: scripts/sync-lib.sh           update the embedded copies
#        scripts/sync-lib.sh --check   only report stale copies (exit 1)

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB="$ROOT/scripts/lib/zen-paths.sh"
TARGETS=(
    "$ROOT/install.sh"
    "$ROOT/ZenLeap Manager.app/Contents/MacOS/ZenLeapManager"
)

CHECK=false
case "${1:-}" in
    --check) CHECK=true ;;
    "") ;;
    *) echo "Usage: $0 [--check]" >&2; exit 2 ;;
esac

rc=0
for target in "${TARGETS[@]}"; do
    name="${target#"$ROOT"/}"
    starts=$(grep -c '^# >>> zen-paths.sh' "$target" || true)
    ends=$(grep -c '^# <<< zen-paths.sh' "$target" || true)
    if [ "$starts" != 1 ] || [ "$ends" != 1 ]; then
        echo "$name: expected exactly one '# >>> zen-paths.sh' and one '# <<< zen-paths.sh' line" >&2
        rc=1
        continue
    fi
    tmp="$(mktemp)"
    # The library's leading "# shellcheck shell=bash" directive is only
    # meaningful at the top of a file, so it is not copied.
    awk -v lib="$LIB" '
        /^# >>> zen-paths.sh/ {
            print
            first = 1
            while ((getline line < lib) > 0) {
                if (first && line ~ /^# shellcheck shell=/) { first = 0; continue }
                first = 0
                print line
            }
            close(lib)
            skip = 1
            next
        }
        /^# <<< zen-paths.sh/ { skip = 0 }
        !skip { print }
    ' "$target" > "$tmp"
    if cmp -s "$target" "$tmp"; then
        [ "$CHECK" = true ] || echo "up to date: $name"
    elif [ "$CHECK" = true ]; then
        echo "stale copy of scripts/lib/zen-paths.sh in: $name (run scripts/sync-lib.sh)" >&2
        rc=1
    else
        cat "$tmp" > "$target"   # keeps the file's permissions
        echo "updated: $name"
    fi
    rm -f "$tmp"
done
exit $rc
