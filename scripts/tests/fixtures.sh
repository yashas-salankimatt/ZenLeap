# shellcheck shell=bash
# Shared fixtures for the installer tests (sourced by test-*.sh).
# Sets up a throwaway directory $T with fake fx-autoconfig/GitHub fixtures,
# a fake `curl` and inert pgrep/pkill/killall/sudo/flatpak stubs in $FAKEBIN,
# plus sandbox and assertion helpers. Nothing here touches the real HOME, real
# browsers or the network.
# shellcheck disable=SC2034  # several variables are only used by the test scripts

set -u

REAL_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_BASH="${TEST_BASH:-bash}"
T="$(mktemp -d "${TMPDIR:-/tmp}/zenleap-installer-test.XXXXXX")"
FAKEBIN="$T/bin"
PASS=0
FAIL=0
FAKE_PIDS=()

cleanup() {
    local p
    for p in "${FAKE_PIDS[@]}"; do kill "$p" 2>/dev/null; done
    if [ "${KEEP:-}" = 1 ]; then echo "kept: $T"; else rm -rf "$T"; fi
}
trap cleanup EXIT

ok()  { PASS=$((PASS + 1)); echo "ok - $*"; }
bad() { FAIL=$((FAIL + 1)); echo "not ok - $*"; }
check() {  # check <description> <command...>
    local desc="$1"
    shift
    if "$@"; then ok "$desc"; else bad "$desc"; fi
}
has()      { grep -qF -- "$2" "$1"; }
lacks()    { ! grep -qF -- "$2" "$1"; }
exists()   { [ -e "$1" ]; }
missing()  { [ ! -e "$1" ] && [ ! -L "$1" ]; }
same()     { cmp -s "$1" "$2"; }

# ---------------------------------------------------------------- fixtures

mkdir -p "$FAKEBIN" "$T/fixtures"
for c in pgrep pkill killall sudo flatpak; do
    printf '#!/bin/sh\necho "%s $*" >> "%s/stub-calls.log"\nexit 1\n' "$c" "$T" > "$FAKEBIN/$c"
    chmod +x "$FAKEBIN/$c"
done

# Fake fx-autoconfig archive with the layout of the real one (all files the
# installers copy, plus example files that must not be copied)
FXAC_FILES="program/config.js program/defaults/pref/config-prefs.js profile/chrome/utils/boot.sys.mjs
profile/chrome/utils/chrome.manifest profile/chrome/utils/fs.sys.mjs profile/chrome/utils/module_loader.mjs
profile/chrome/utils/uc_api.sys.mjs profile/chrome/utils/utils.sys.mjs"
FXAC_TREE="$T/fxac-src/fx-autoconfig-dfdab5684faffc112b76ccb1d8cab7f75da0102c"
make_fxac_zip() {  # make_fxac_zip <out.zip>
    local top="$FXAC_TREE" f
    mkdir -p "$top/program/defaults/pref" "$top/profile/chrome/utils" "$top/profile/chrome/JS" "$top/profile/chrome/CSS"
    printf "// skip 1st line\ntry { ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs'); } catch (ex) {}\n" > "$top/program/config.js"
    printf 'pref("general.config.filename", "config.js");\n' > "$top/program/defaults/pref/config-prefs.js"
    printf '// ==UserScript==\n// @version 0.10.16\n' > "$top/profile/chrome/utils/boot.sys.mjs"
    printf 'content userchromejs ./\n' > "$top/profile/chrome/utils/chrome.manifest"
    for f in fs.sys.mjs module_loader.mjs uc_api.sys.mjs utils.sys.mjs; do
        printf '// fake %s\n' "$f" > "$top/profile/chrome/utils/$f"
    done
    printf 'console.log("Hi mom");\n' > "$top/profile/chrome/JS/test.uc.js"
    printf '/* example */\n' > "$top/profile/chrome/CSS/agent_style.uc.css"
    zip_tree "$1" "$(dirname "$top")" "$(basename "$top")"
}
# zip_tree <out.zip> <parent-dir> <top>: zip <parent-dir>/<top> (hidden files too)
zip_tree() {
    (cd "$2" && python3 -c 'import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1], "w")
for root, _, files in os.walk(sys.argv[2]):
    for f in files: z.write(os.path.join(root, f))
z.close()' "$1" "$3")
}
make_fxac_zip "$T/fixtures/fxac.zip"

# The code under test: a copy of the repository whose pinned fx-autoconfig
# hashes are those of the fake archive. (A test runs the real tree against the
# fake archive to show that the real pins reject it.)
REPO="$T/repo"
mkdir -p "$REPO"
(cd "$REAL_REPO" && tar cf - --exclude=./.git --exclude=./dist .) | (cd "$REPO" && tar xf -)
for f in $FXAC_FILES; do
    h=$(sha256sum "$FXAC_TREE/$f" | cut -d' ' -f1)
    for code in scripts/lib/zen-paths.sh install.sh "ZenLeap Manager.app/Contents/MacOS/ZenLeapManager" install.ps1; do
        sed -i -E "s|^[0-9a-f]{64}  $f\$|$h  $f|" "$REPO/$code"
        if ! grep -q "^$h  $f\$" "$REPO/$code"; then
            echo "fixtures: could not patch the fx-autoconfig pin for $f in $code" >&2
            exit 1
        fi
    done
done

# Fake GitHub release (the worktree's script, released under its own version)
VERSION="$(grep -o '@version[[:space:]]*[0-9][0-9.]*' "$REPO/JS/zenleap.uc.js" | head -n 1 | sed 's/@version[[:space:]]*//')"
make_release() {  # make_release <dir> <good|badsum|nosums|badversion>
    mkdir -p "$1/JS"
    cp "$REPO/JS/zenleap.uc.js" "$1/JS/zenleap.uc.js"
    cp "$REPO/zenleap-themes.json" "$1/zenleap-themes.json"
    (cd "$1" && sha256sum JS/zenleap.uc.js > CHECKSUMS.sha256)
    case "$2" in
        badsum) printf '// tampered\n' >> "$1/JS/zenleap.uc.js" ;;
        nosums) rm -f "$1/CHECKSUMS.sha256" ;;
        badversion)
            sed -i 's/@version[[:space:]]*[0-9][0-9.]*/@version        0.0.1/' "$1/JS/zenleap.uc.js"
            (cd "$1" && sha256sum JS/zenleap.uc.js > CHECKSUMS.sha256) ;;
    esac
}
for kind in good badsum nosums badversion; do make_release "$T/fixtures/release-$kind" "$kind"; done

cat > "$FAKEBIN/curl" <<'EOF'
#!/bin/bash
# Test double for curl: serves the GitHub URLs used by the installers.
out=""; head=false; url=""
while [ $# -gt 0 ]; do
    case "$1" in
        -o) out="$2"; shift ;;
        -H) shift ;;
        -I) head=true ;;
        -*) case "$1" in -*I*) head=true ;; esac ;;
        *) url="$1" ;;
    esac
    shift
done
echo "$url" >> "$FAKE_ROOT/curl.log"
emit() { if [ -n "$out" ]; then cat "$1" > "$out"; else cat "$1"; fi; }
case "$url" in
    https://github.com/MrOtherGuy/fx-autoconfig/archive/*.zip)
        [ "${FAKE_FXAC_FAIL:-}" = 1 ] && exit 22
        emit "$FAKE_FXAC_ZIP" ;;
    https://api.github.com/repos/yashas-salankimatt/ZenLeap/releases/latest)
        [ "${FAKE_API_FAIL:-}" = 1 ] && exit 22
        printf '{"tag_name": "%s", "name": "%s"}\n' "$FAKE_TAG" "$FAKE_TAG" > "$FAKE_ROOT/api.json"
        emit "$FAKE_ROOT/api.json" ;;
    https://github.com/yashas-salankimatt/ZenLeap/releases/latest)
        $head && printf 'HTTP/2 302\r\nlocation: https://github.com/yashas-salankimatt/ZenLeap/releases/tag/%s\r\n\r\n' "$FAKE_TAG" ;;
    https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/*)
        rest=${url#https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/}
        [ "${rest%%/*}" = "$FAKE_TAG" ] || exit 22
        [ -f "$FAKE_RELEASE/${rest#*/}" ] || exit 22
        emit "$FAKE_RELEASE/${rest#*/}" ;;
    *) exit 22 ;;
esac
EOF
chmod +x "$FAKEBIN/curl"

# ---------------------------------------------------------------- helpers

# A fake Zen installation directory (writable unless chmod'ed later)
mk_app() {
    mkdir -p "$1"
    printf '[App]\nVersion=1.22.3b\n' > "$1/application.ini"
    printf '#!/bin/sh\nexit 0\n' > "$1/zen"
    chmod +x "$1/zen"
}

# mk_profile <root> <dir-name> : a directory that looks like a used profile
mk_profile() {
    mkdir -p "$1/$2"
    printf 'user_pref("browser.startup.homepage", "about:blank");\n' > "$1/$2/prefs.js"
    printf '{"created":1}\n' > "$1/$2/times.json"
}

# junk that Zen/Firefox keeps next to the profiles
mk_junk() {
    mkdir -p "$1/Profile Groups" "$1/Crash Reports/events" "$1/Pending Pings"
    : > "$1/Profile Groups/abc.sqlite"
}

# Two profiles where the install default (Default (release)) is NOT the
# Default=1 profile, exactly like a fresh Zen 1.22 install.
mk_two_profiles() {  # mk_two_profiles <root>
    mk_profile "$1" "0sczwvfb.default-release"
    mk_profile "$1" "gdgcari8.Default (release)"
    mk_junk "$1"
    cat > "$1/profiles.ini" <<'INI'
[General]
StartWithLastProfile=1
Version=2

[Profile0]
Name=default-release
IsRelative=1
Path=0sczwvfb.default-release
Default=1

[Install6E2387A6838A7977]
Default=gdgcari8.Default (release)
Locked=1

[Profile1]
Name=Default (release)
IsRelative=1
Path=gdgcari8.Default (release)
INI
    printf '[6E2387A6838A7977]\nDefault=gdgcari8.Default (release)\nLocked=1\n' > "$1/installs.ini"
}

new_home() {  # new_home <name> -> sets H, APP
    H="$T/$1/home"
    APP="$T/$1/app"
    mkdir -p "$H"
    mk_app "$APP"
    rm -f "$T/stub-calls.log"
}

OUT=""
RC=0
# run <script> [args...]: run a repo script in the sandbox (stdin: /dev/null)
run() {
    local script="$1"
    shift
    OUT="$T/out.$((PASS + FAIL)).log"
    env -i PATH="$FAKEBIN:/usr/bin:/bin" HOME="$H" TMPDIR="$T" LANG=C.UTF-8 \
        FAKE_ROOT="$T" FAKE_FXAC_ZIP="${FAKE_FXAC_ZIP:-$T/fixtures/fxac.zip}" \
        FAKE_TAG="${FAKE_TAG:-v$VERSION}" FAKE_RELEASE="${FAKE_RELEASE:-$T/fixtures/release-good}" \
        FAKE_API_FAIL="${FAKE_API_FAIL:-}" FAKE_FXAC_FAIL="${FAKE_FXAC_FAIL:-}" \
        ${EXTRA_ENV:+$EXTRA_ENV} \
        "$TEST_BASH" "$REPO/$script" "$@" > "$OUT" 2>&1 < /dev/null
    RC=$?
}

HAVE_SCRIPT=false
if script -qec true /dev/null >/dev/null 2>&1; then HAVE_SCRIPT=true; fi

# run_tty <input> <script> [args...]: same, on a pseudo-terminal fed <input>
run_tty() {
    local input="$1" script="$2" cmd a
    shift 2
    OUT="$T/out.$((PASS + FAIL)).log"
    cmd="$(printf '%q ' "$TEST_BASH" "$REPO/$script")"
    for a in "$@"; do cmd="$cmd$(printf '%q ' "$a")"; done
    printf '%b' "$input" | env -i PATH="$FAKEBIN:/usr/bin:/bin" HOME="$H" TMPDIR="$T" LANG=C.UTF-8 \
        FAKE_ROOT="$T" FAKE_FXAC_ZIP="${FAKE_FXAC_ZIP:-$T/fixtures/fxac.zip}" \
        FAKE_TAG="${FAKE_TAG:-v$VERSION}" FAKE_RELEASE="${FAKE_RELEASE:-$T/fixtures/release-good}" \
        script -qec "$cmd" /dev/null > "$OUT" 2>&1
    RC=$?
}

rc_is() { [ "$RC" = "$1" ]; }
show_on_fail() { if [ "$FAIL" -gt "${1:-0}" ]; then sed 's/^/    | /' "$OUT"; fi; }

