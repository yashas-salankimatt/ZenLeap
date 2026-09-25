#!/bin/bash
# Consistency checks for a ZenLeap release. Run it before tagging (release.sh
# runs it too); it exits non-zero if anything a release depends on disagrees.
#
# Usage: scripts/check-release.sh [<version> | v<version>]
#   With an argument, the files must also carry exactly that version
#   (e.g. in CI for a pushed tag: scripts/check-release.sh "$GITHUB_REF_NAME").
#
# Checks:
#   - "// @version", const VERSION, theme.json "version" and the Manager's
#     Info.plist versions all match
#   - CHECKSUMS.sha256 is `sha256sum` output whose JS/zenleap.uc.js hash matches
#     the file (and the committed blob, so CRLF checkouts are caught)
#   - theme.json / preferences.json are valid, reference existing files, have
#     ISO-8601 UTC dates, and preferences.json has no legacy uc.zenleap.* prefs
#   - theme.json updatedAt never goes back from the last release tag's, and is
#     later than it for a new version (Sine only offers a later updatedAt)
#   - CHANGELOG.md has a section for the version
#   - the updater and installers fetch release tags, not the main branch
#   - embedded copies of scripts/lib/zen-paths.sh are in sync, and install.ps1
#     pins the same fx-autoconfig commit, file hashes and example-file hashes
#   - every shell script passes `bash -n` (and shellcheck, when installed)

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 2
# shellcheck source=scripts/lib/zen-paths.sh
. "$ROOT/scripts/lib/zen-paths.sh"

FAILS=0
WARNS=0
pass() { echo "ok    $*"; }
fail() { echo "FAIL  $*"; FAILS=$((FAILS + 1)); }
warn() { echo "warn  $*"; WARNS=$((WARNS + 1)); }

JS="JS/zenleap.uc.js"
PLIST="ZenLeap Manager.app/Contents/Info.plist"
MANAGER="ZenLeap Manager.app/Contents/MacOS/ZenLeapManager"
EXPECTED="${1:-}"
EXPECTED="${EXPECTED#v}"

# JSON helper: json_get <file> <key> (top-level string) or json_valid <file>
json_tool() {
    if command -v python3 >/dev/null 2>&1; then
        python3 - "$@" <<'PY'
import json, sys
mode, path = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(path, encoding="utf-8"))
except Exception as e:
    print("invalid JSON: %s" % e)
    sys.exit(1)
if mode == "get":
    v = data.get(sys.argv[3], "") if isinstance(data, dict) else ""
    print(v if isinstance(v, str) else json.dumps(v))
elif mode == "type":
    print(type(data).__name__)
elif mode == "theme-files":
    for f in (data.get("scripts") or {}):
        print(f)
    style = data.get("style") or {}
    for k in ("chrome", "content"):
        if style.get(k):
            print(style[k])
    if data.get("preferences"):
        print(data["preferences"])
elif mode == "pref-properties":
    for p in data:
        if isinstance(p, dict) and p.get("property"):
            print(p["property"])
PY
    elif command -v node >/dev/null 2>&1; then
        node -e '
const [mode, path, key] = process.argv.slice(1);
let data;
try { data = JSON.parse(require("fs").readFileSync(path, "utf8")); } catch (e) { console.log("invalid JSON: " + e.message); process.exit(1); }
if (mode === "get") { const v = data[key]; console.log(typeof v === "string" ? v : JSON.stringify(v ?? "")); }
else if (mode === "type") console.log(Array.isArray(data) ? "list" : typeof data === "object" ? "dict" : typeof data);
else if (mode === "theme-files") { Object.keys(data.scripts || {}).forEach(f => console.log(f)); const s = data.style || {}; ["chrome", "content"].forEach(k => s[k] && console.log(s[k])); if (data.preferences) console.log(data.preferences); }
else if (mode === "pref-properties") data.forEach(p => p && p.property && console.log(p.property));
' "$@"
    else
        return 3
    fi
}

echo "# ZenLeap release checks"

# --- versions -------------------------------------------------------------
v_header=$(sed -n '1,10s|^// @version[[:space:]]*\([0-9][0-9.]*\).*|\1|p' "$JS" | head -n 1)
v_const=$(sed -n "s|^[[:space:]]*const VERSION = '\\([^']*\\)';.*|\\1|p" "$JS" | head -n 1)
v_theme=$(sed -n 's|^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*|\1|p' theme.json | head -n 1)
v_plist=$(awk '/<key>CFBundleShortVersionString<\/key>/ { getline; gsub(/.*<string>|<\/string>.*/, ""); print; exit }' "$PLIST")
v_plist2=$(awk '/<key>CFBundleVersion<\/key>/ { getline; gsub(/.*<string>|<\/string>.*/, ""); print; exit }' "$PLIST")
VERSION="$v_header"
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    fail "@version header of $JS is not X.Y.Z (got '${VERSION}')"
fi
mismatch=""
for pair in "const VERSION=$v_const" "theme.json version=$v_theme" \
            "Info.plist CFBundleShortVersionString=$v_plist" "Info.plist CFBundleVersion=$v_plist2"; do
    if [ "${pair##*=}" != "$VERSION" ]; then mismatch="$mismatch; ${pair%%=*} is ${pair##*=}"; fi
done
if [ -n "$mismatch" ]; then
    fail "versions disagree: @version is $VERSION$mismatch"
else
    pass "version $VERSION in @version, const VERSION, theme.json and Info.plist"
fi
if [ -n "$EXPECTED" ]; then
    if [ "$EXPECTED" = "$VERSION" ]; then pass "matches the requested version $EXPECTED"; else fail "requested version $EXPECTED but the files say $VERSION"; fi
fi

# --- CHECKSUMS.sha256 -----------------------------------------------------
if [ ! -f CHECKSUMS.sha256 ]; then
    fail "CHECKSUMS.sha256 is missing (scripts/release.sh --checksums)"
else
    bad_lines=$(grep -vcE '^[0-9a-f]{64} [ *][^ ].*$' CHECKSUMS.sha256 || true)
    if [ "$bad_lines" != "0" ]; then
        fail "CHECKSUMS.sha256 has $bad_lines line(s) not in sha256sum format"
    fi
    listed=$(awk '$2 == "JS/zenleap.uc.js" || $2 == "*JS/zenleap.uc.js" { print $1 }' CHECKSUMS.sha256)
    actual=$(zp_sha256 "$JS")
    if [ -z "$listed" ]; then
        fail "CHECKSUMS.sha256 has no entry for JS/zenleap.uc.js"
    elif [ "$(printf '%s\n' "$listed" | wc -l | tr -d ' ')" != "1" ]; then
        fail "CHECKSUMS.sha256 lists JS/zenleap.uc.js more than once"
    elif [ "$listed" != "$actual" ]; then
        fail "CHECKSUMS.sha256 is stale: lists $listed, JS/zenleap.uc.js is $actual (scripts/release.sh --checksums)"
    else
        pass "CHECKSUMS.sha256 matches JS/zenleap.uc.js ($actual)"
    fi
    # Other listed files must match too
    while read -r hash name; do
        name="${name#\*}"
        [ "$name" = "JS/zenleap.uc.js" ] && continue
        if [ ! -f "$name" ]; then
            fail "CHECKSUMS.sha256 lists missing file $name"
        elif [ "$(zp_sha256 "$name")" != "$hash" ]; then
            fail "CHECKSUMS.sha256 is stale for $name"
        fi
    done < CHECKSUMS.sha256
    # What raw.githubusercontent.com serves is the committed blob
    if command -v git >/dev/null 2>&1 && git rev-parse --verify -q HEAD >/dev/null 2>&1 && \
       git diff --quiet HEAD -- "$JS" CHECKSUMS.sha256 2>/dev/null; then
        blob_hash=$(git show "HEAD:$JS" | { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; } | cut -d' ' -f1)
        if [ "$blob_hash" != "$actual" ]; then
            fail "the committed JS/zenleap.uc.js hashes to $blob_hash, not $actual (line endings? see .gitattributes)"
        else
            pass "committed JS/zenleap.uc.js has the same hash"
        fi
    fi
fi

# --- theme.json / preferences.json ---------------------------------------
if out=$(json_tool type theme.json 2>&1); then
    pass "theme.json is valid JSON"
    updated=$(json_tool get theme.json updatedAt)
    created=$(json_tool get theme.json createdAt)
    if [[ $updated =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
        pass "theme.json updatedAt $updated"
    else
        fail "theme.json updatedAt must be ISO-8601 UTC like 2026-03-23T02:31:36Z (got '$updated')"
    fi
    if ! [[ $created =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then fail "theme.json createdAt is not a date ('$created')"; fi
    # Sine offers an update only when updatedAt is later than the installed copy's
    last_tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)
    if [ -n "$last_tag" ] && [[ $updated =~ ^[0-9]{4}- ]]; then
        last_updated=$(git show "$last_tag:theme.json" 2>/dev/null | sed -n 's|^[[:space:]]*"updatedAt":[[:space:]]*"\([^"]*\)".*|\1|p' | head -n 1)
        # As numbers (20260323023136); a date without a time is midnight UTC, as for Sine
        now_n="${updated//[!0-9]/}000000"; now_n=${now_n:0:14}
        last_n=""
        if [ -n "${last_updated//[!0-9]/}" ]; then last_n="${last_updated//[!0-9]/}000000"; last_n=${last_n:0:14}; fi
        if [ -z "$last_n" ]; then
            :
        elif [ "$now_n" -lt "$last_n" ]; then
            fail "theme.json updatedAt $updated is earlier than $last_tag's $last_updated"
        elif [ "$VERSION" != "${last_tag#v}" ] && [ "$now_n" -le "$last_n" ]; then
            fail "theme.json updatedAt $updated is not later than $last_tag's $last_updated: Sine would not offer $VERSION (scripts/release.sh sets it)"
        else
            pass "theme.json updatedAt is not earlier than $last_tag's"
        fi
    fi
    while IFS= read -r f; do
        if [ -n "$f" ] && [ ! -f "$f" ]; then fail "theme.json references missing file $f"; fi
    done < <(json_tool theme-files theme.json)
elif [ $? -eq 3 ]; then
    warn "no python3 or node: JSON files not validated"
else
    fail "theme.json: $out"
fi
if out=$(json_tool type preferences.json 2>&1); then
    if [ "$out" = "list" ]; then pass "preferences.json is a valid list"; else fail "preferences.json must be a JSON list"; fi
    legacy=$(json_tool pref-properties preferences.json | grep -E '^uc\.zenleap\.(debug|current_indicator)$' || true)
    if [ -n "$legacy" ]; then
        fail "preferences.json exposes legacy prefs that the settings migration clears: $(echo "$legacy" | tr '\n' ' ')"
    fi
elif [ $? -ne 3 ]; then
    fail "preferences.json: $out"
fi

# --- CHANGELOG ------------------------------------------------------------
if grep -q "^## \[$VERSION\] - [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}" CHANGELOG.md; then
    pass "CHANGELOG.md has a [$VERSION] section"
else
    fail "CHANGELOG.md has no '## [$VERSION] - YYYY-MM-DD' section"
fi

# --- downloads come from release tags -------------------------------------
main_refs=$(grep -nE 'raw\.githubusercontent\.com/yashas-salankimatt/ZenLeap/main/(JS/zenleap\.uc\.js|chrome\.css)' \
    "$JS" install.sh install.ps1 "$MANAGER" 2>/dev/null || true)
if [ -n "$main_refs" ]; then
    fail "these download ZenLeap from the main branch instead of the release tag:"
    printf '%s\n' "$main_refs" | sed 's/^/        /' | cut -c1-160
else
    pass "updater and installers fetch release tags"
fi

# --- embedded library -----------------------------------------------------
if out=$("$ROOT/scripts/sync-lib.sh" --check 2>&1); then
    pass "embedded zen-paths.sh copies are in sync"
else
    fail "$out"
fi

# --- fx-autoconfig pin: install.ps1 must match the shell library -----------
sh_pin=$(printf '%s\n' "$ZP_FXAC_PINNED_REF $ZP_FXAC_PINNED_VERSION"; printf '%s\n' "$ZP_FXAC_SHA256" | grep -E '^[0-9a-f]{64}  ')
# shellcheck disable=SC2016  # literal $ in the PowerShell variable names
ps_ref=$(sed -n 's/^\$FxPinnedRef[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' install.ps1)
# shellcheck disable=SC2016
ps_ver=$(sed -n 's/^\$FxPinnedVersion[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' install.ps1)
# shellcheck disable=SC2016
ps_pin=$(printf '%s\n' "$ps_ref $ps_ver"; sed -n '/^\$FxPinnedSha256/,/^"@/p' install.ps1 | grep -E '^[0-9a-f]{64}  ')
if [ "$sh_pin" = "$ps_pin" ]; then
    pass "install.ps1 pins the same fx-autoconfig commit ($ZP_FXAC_PINNED_REF) and hashes"
else
    fail "fx-autoconfig pin differs between scripts/lib/zen-paths.sh and install.ps1"
fi
sh_examples=$(printf '%s\n' "$ZP_FXAC_EXAMPLES_SHA256" | grep -E '^[0-9a-f]{64}  ')
# shellcheck disable=SC2016
ps_examples=$(sed -n '/^\$FxExamplesSha256/,/^"@/p' install.ps1 | grep -E '^[0-9a-f]{64}  ')
if [ -n "$sh_examples" ] && [ "$sh_examples" = "$ps_examples" ]; then
    pass "install.ps1 lists the same fx-autoconfig example files"
else
    fail "fx-autoconfig example hashes differ between scripts/lib/zen-paths.sh and install.ps1"
fi

# --- shell scripts --------------------------------------------------------
scripts=(install.sh install-plugin.sh clean-legacy-css.sh "$MANAGER" scripts/*.sh scripts/lib/*.sh scripts/tests/*.sh)
syntax_ok=true
for f in "${scripts[@]}"; do
    if ! bash -n "$f" 2>/dev/null; then
        fail "bash -n $f"
        syntax_ok=false
    fi
done
if [ "$syntax_ok" = true ]; then pass "bash -n: ${#scripts[@]} scripts"; fi
if command -v shellcheck >/dev/null 2>&1; then
    if shellcheck -x "${scripts[@]}" >/dev/null 2>&1; then
        pass "shellcheck: clean"
    else
        fail "shellcheck reports problems (run: shellcheck -x ${scripts[*]})"
    fi
else
    warn "shellcheck not installed (e.g. uvx --from shellcheck-py shellcheck); skipped"
fi

echo ""
if [ "$FAILS" -gt 0 ]; then
    echo "# $FAILS check(s) failed, $WARNS warning(s)"
    exit 1
fi
echo "# all checks passed ($WARNS warning(s))"
