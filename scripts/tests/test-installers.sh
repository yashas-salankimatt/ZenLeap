#!/bin/bash
# Offline tests for install.sh, install-plugin.sh and clean-legacy-css.sh.
#
# Every run happens in a throwaway HOME with fake Zen profile layouts, a fake
# Zen installation directory, a fake fx-autoconfig archive and a fake `curl`
# that serves GitHub URLs from local fixtures. pgrep/pkill/killall/sudo/flatpak
# are replaced by inert stubs, so nothing here can touch real browsers, the real
# home directory or the network.
#
# Usage: scripts/tests/test-installers.sh
#   TEST_BASH=/path/to/bash   run the scripts under another bash (e.g. 3.2)
#   KEEP=1                    keep the temporary directory for inspection
# Interactive cases need util-linux `script`; they are skipped without it.

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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

# Fake fx-autoconfig archive (layout of the real master.zip)
make_fxac_zip() {  # make_fxac_zip <out.zip> <version>
    local src="$T/fxac-src-$2"
    local top="$src/fx-autoconfig-master"
    mkdir -p "$top/program/defaults/pref" "$top/profile/chrome/utils" "$top/profile/chrome/JS" "$top/profile/chrome/CSS"
    printf "// skip 1st line\ntry { ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs'); } catch (ex) {}\n" > "$top/program/config.js"
    printf 'pref("general.config.filename", "config.js");\n' > "$top/program/defaults/pref/config-prefs.js"
    printf '// ==UserScript==\n// @version %s\n' "$2" > "$top/profile/chrome/utils/boot.sys.mjs"
    printf 'content userchromejs ./\n' > "$top/profile/chrome/utils/chrome.manifest"
    printf 'console.log("Hi mom");\n' > "$top/profile/chrome/JS/test.uc.js"
    printf '/* example */\n' > "$top/profile/chrome/CSS/agent_style.uc.css"
    (cd "$src" && python3 -c 'import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1], "w")
for root, _, files in os.walk("fx-autoconfig-master"):
    for f in files: z.write(os.path.join(root, f))
z.close()' "$1")
}
make_fxac_zip "$T/fixtures/fxac.zip" 0.10.16

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
    https://github.com/MrOtherGuy/fx-autoconfig/archive/refs/heads/master.zip)
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

# ---------------------------------------------------------------- tests

# shellcheck disable=SC2016  # $BASH_VERSION of the bash under test
echo "# ZenLeap installer tests (bash under test: $("$TEST_BASH" -c 'echo $BASH_VERSION'))"

# 1. Fresh Zen 1.22 layout in ~/.config/zen (XDG), junk dirs, install default != Default=1
new_home xdg
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
O="$R/0sczwvfb.default-release"
mkdir -p "$H/.cache/zen/gdgcari8.Default (release)/startupCache"
: > "$H/.cache/zen/gdgcari8.Default (release)/startupCache/startupCache.8.little"
f=$FAIL
run install.sh install --yes --zen-path "$APP"
check "xdg: install exits 0" rc_is 0
check "xdg: installs into the install's default profile" same "$REPO/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "xdg: leaves the Default=1 profile alone" missing "$O/chrome"
check "xdg: never touches Profile Groups/" missing "$R/Profile Groups/chrome"
check "xdg: never touches Crash Reports/" missing "$R/Crash Reports/chrome"
check "xdg: never touches Pending Pings/" missing "$R/Pending Pings/user.js"
check "xdg: fx-autoconfig program files go into the app dir" has "$APP/config.js" "boot.sys.mjs"
check "xdg: config-prefs.js installed" exists "$APP/defaults/pref/config-prefs.js"
check "xdg: loader copied to chrome/utils" exists "$P/chrome/utils/boot.sys.mjs"
check "xdg: fx-autoconfig example scripts are not copied" missing "$P/chrome/JS/test.uc.js"
check "xdg: fx-autoconfig example CSS is not copied" missing "$P/chrome/CSS"
check "xdg: themes template created" exists "$P/chrome/zenleap-themes.json"
check "xdg: no userChrome.css is created" missing "$P/chrome/userChrome.css"
check "xdg: user.js is not touched" missing "$P/user.js"
check "xdg: startup cache in ~/.cache/zen/<profile> cleared" missing "$H/.cache/zen/gdgcari8.Default (release)/startupCache"
check "xdg: output names the profile" has "$OUT" "Profile: Default (release)"
check "xdg: no pgrep/pkill/sudo calls" missing "$T/stub-calls.log"
show_on_fail "$f"

# 2. check action
run install.sh check
check "check: exit 0 when up to date" rc_is 0
check "check: reports installed profile" has "$OUT" "Default (release): UP_TO_DATE:$VERSION:$VERSION"
check "check: reports other profile" has "$OUT" "default-release: NOT_INSTALLED"
check "check: output has no decoration" lacks "$OUT" "Detected OS"
FAKE_TAG=v99.0.0 run install.sh check
check "check: exit 1 when outdated" rc_is 1
check "check: reports OUTDATED" has "$OUT" "OUTDATED:$VERSION:99.0.0"

# 3. --yes without --profile also updates profiles that already have ZenLeap
mkdir -p "$O/chrome/JS"
printf '// @version 3.3.0\n' > "$O/chrome/JS/zenleap.uc.js"
run install.sh install --yes --zen-path "$APP"
check "update: exits 0" rc_is 0
check "update: refreshes the other profile that had ZenLeap" same "$REPO/JS/zenleap.uc.js" "$O/chrome/JS/zenleap.uc.js"
check "update: fx-autoconfig already set up is reported" has "$OUT" "fx-autoconfig is set up"

# 4. --profile by number, by name, invalid
new_home select
R="$H/.config/zen"
mk_two_profiles "$R"
run install.sh install --yes --profile 1 --zen-path "$APP"
check "--profile 1: installs into profiles.ini order #1 (default-release)" exists "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
check "--profile 1: not into #2" missing "$R/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
run install.sh install --yes --profile "default (release)" --zen-path "$APP"
check "--profile <name>: case-insensitive name match" exists "$R/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
run install.sh install --yes --profile 7 --zen-path "$APP"
check "--profile 7: rejected" rc_is 1
check "--profile 7: explains the valid range" has "$OUT" "valid: 1-2"
run install.sh install --yes --profile nosuch --zen-path "$APP"
check "--profile <unknown name>: rejected" rc_is 1

# 5. Legacy ~/.zen layout
new_home legacy
R="$H/.zen"
mk_profile "$R" "abcd1234.Default (release)"
mk_junk "$R"
printf '[Profile0]\nName=Default (release)\nIsRelative=1\nPath=abcd1234.Default (release)\nDefault=1\n\n[General]\nStartWithLastProfile=1\nVersion=2\n' > "$R/profiles.ini"
mkdir -p "$H/.cache/zen/abcd1234.Default (release)/startupCache"
run install.sh install --yes --zen-path "$APP"
check "legacy: exit 0" rc_is 0
check "legacy: installs into ~/.zen profile" exists "$R/abcd1234.Default (release)/chrome/JS/zenleap.uc.js"
check "legacy: junk dirs untouched" missing "$R/Profile Groups/chrome"
check "legacy: cache cleared" missing "$H/.cache/zen/abcd1234.Default (release)/startupCache"

# 6. ~/zen (Zen's MOZ_USER_DIR) forces the legacy root even without ~/.zen/profiles.ini elsewhere
new_home homezen
mkdir -p "$H/zen"
mk_two_profiles "$H/.zen"
mk_two_profiles "$H/.config/zen"
run install.sh install --yes --zen-path "$APP"
check "HOME/zen: legacy root wins" exists "$H/.zen/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
check "HOME/zen: XDG root untouched" missing "$H/.config/zen/gdgcari8.Default (release)/chrome"

# 7. XDG_CONFIG_HOME (absolute) is honoured, relative is ignored
new_home xdgenv
mk_two_profiles "$H/cfg/zen"
EXTRA_ENV="XDG_CONFIG_HOME=$H/cfg" run install.sh install --yes --zen-path "$APP"
check "XDG_CONFIG_HOME: installs under \$XDG_CONFIG_HOME/zen" exists "$H/cfg/zen/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
new_home xdgrel
mk_two_profiles "$H/.config/zen"
mkdir -p "$H/relcfg/zen"
EXTRA_ENV="XDG_CONFIG_HOME=relcfg" run install.sh install --yes --zen-path "$APP"
check "relative XDG_CONFIG_HOME: ignored (uses ~/.config/zen)" exists "$H/.config/zen/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
new_home xdgcache
mk_two_profiles "$H/.config/zen"
mkdir -p "$H/xcache/zen/gdgcari8.Default (release)/startupCache"
EXTRA_ENV="XDG_CACHE_HOME=$H/xcache" run install.sh install --yes --zen-path "$APP"
check "XDG_CACHE_HOME: startup cache cleared there" missing "$H/xcache/zen/gdgcari8.Default (release)/startupCache"

# 8. MOZ_LEGACY_HOME=1 with both roots present
new_home mozlegacy
mk_two_profiles "$H/.config/zen"
mkdir -p "$H/.zen"
mk_profile "$H/.zen" "zzzz0000.legacy"
printf '[Profile0]\nName=legacy\nIsRelative=1\nPath=zzzz0000.legacy\nDefault=1\n' > "$H/.zen/profiles.ini"
EXTRA_ENV="MOZ_LEGACY_HOME=1" run install.sh install --yes --zen-path "$APP"
check "MOZ_LEGACY_HOME=1: ~/.zen default profile" exists "$H/.zen/zzzz0000.legacy/chrome/JS/zenleap.uc.js"
check "MOZ_LEGACY_HOME=1: XDG profiles untouched" missing "$H/.config/zen/gdgcari8.Default (release)/chrome"

# 9. No profiles.ini: fall back to dirs with prefs.js/times.json, never junk
new_home noini
mk_profile "$H/.config/zen" "only.profile"
mk_junk "$H/.config/zen"
run install.sh install --yes --zen-path "$APP"
check "no profiles.ini: uses the only real profile" exists "$H/.config/zen/only.profile/chrome/JS/zenleap.uc.js"
check "no profiles.ini: junk untouched" missing "$H/.config/zen/Profile Groups/chrome"

# 10. No Zen profile at all
new_home none
run install.sh install --yes --zen-path "$APP"
check "no profiles: fails" rc_is 1
check "no profiles: says where it looked" has "$OUT" "$H/.config/zen"

# 11. Several installs share a root: pick the default of the install in --zen-path
new_home twoinstalls
R="$H/.config/zen"
mk_profile "$R" "aaaa.Default (release)"
mk_profile "$R" "bbbb.Default (twilight)"
printf '[Profile0]\nName=Default (release)\nIsRelative=1\nPath=aaaa.Default (release)\n\n[Profile1]\nName=Default (twilight)\nIsRelative=1\nPath=bbbb.Default (twilight)\n\n[InstallAAAA]\nDefault=aaaa.Default (release)\nLocked=1\n\n[InstallBBBB]\nDefault=bbbb.Default (twilight)\nLocked=1\n' > "$R/profiles.ini"
printf '[Compatibility]\nLastPlatformDir=/opt/other-zen\n' > "$R/aaaa.Default (release)/compatibility.ini"
printf '[Compatibility]\nLastPlatformDir=%s\n' "$APP" > "$R/bbbb.Default (twilight)/compatibility.ini"
run install.sh install --yes --zen-path "$APP"
check "two installs: default of the install in --zen-path" exists "$R/bbbb.Default (twilight)/chrome/JS/zenleap.uc.js"
check "two installs: other install's default untouched" missing "$R/aaaa.Default (release)/chrome"

# 12. Absolute (IsRelative=0) profile and --profile-dir
new_home absolute
mkdir -p "$H/.config/zen"
mk_profile "$H/elsewhere" "myprofile"
printf '[Profile0]\nName=Elsewhere\nIsRelative=0\nPath=%s\nDefault=1\n' "$H/elsewhere/myprofile" > "$H/.config/zen/profiles.ini"
mkdir -p "$H/elsewhere/myprofile/startupCache"
run install.sh install --yes --zen-path "$APP"
check "IsRelative=0: installs into the absolute path" exists "$H/elsewhere/myprofile/chrome/JS/zenleap.uc.js"
check "IsRelative=0: clears <profile>/startupCache" missing "$H/elsewhere/myprofile/startupCache"
mk_profile "$H" "adhoc-profile"
run install.sh install --yes --profile-dir "$H/adhoc-profile" --zen-path "$APP"
check "--profile-dir: installs there" exists "$H/adhoc-profile/chrome/JS/zenleap.uc.js"
run install.sh install --yes --profile 1 --profile-dir "$H/adhoc-profile" --zen-path "$APP"
check "--profile + --profile-dir: rejected" rc_is 1

# 13. userChrome.css with and without the old ZenLeap block
new_home css
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
mkdir -p "$P/chrome"
printf '/* mine */\n#nav-bar { color: red; }\n\n/* === ZenLeap Styles === */\n.old-zenleap { color: blue; }\n/* === End ZenLeap Styles === */\n/* after */\n.keep { x: y; }\n' > "$P/chrome/userChrome.css"
cp "$P/chrome/userChrome.css" "$T/css-before"
run install.sh install --yes --zen-path "$APP"
check "css: old ZenLeap block removed" lacks "$P/chrome/userChrome.css" "old-zenleap"
check "css: markers removed" lacks "$P/chrome/userChrome.css" "ZenLeap Styles"
check "css: user CSS before the block kept" has "$P/chrome/userChrome.css" "#nav-bar { color: red; }"
check "css: user CSS after the block kept" has "$P/chrome/userChrome.css" ".keep { x: y; }"
check "css: backup written" same "$T/css-before" "$P/chrome/userChrome.css.zenleap-backup"
printf '/* no zenleap here */\n' > "$R/0sczwvfb.default-release/chrome-userChrome.tmp"
mkdir -p "$R/0sczwvfb.default-release/chrome"
mv "$R/0sczwvfb.default-release/chrome-userChrome.tmp" "$R/0sczwvfb.default-release/chrome/userChrome.css"
cp "$R/0sczwvfb.default-release/chrome/userChrome.css" "$T/css-plain"
run install.sh install --yes --profile 1 --zen-path "$APP"
check "css: userChrome.css without markers is left byte-identical" same "$T/css-plain" "$R/0sczwvfb.default-release/chrome/userChrome.css"
check "css: no backup when nothing changed" missing "$R/0sczwvfb.default-release/chrome/userChrome.css.zenleap-backup"

# 14. Outdated fx-autoconfig loader is refreshed (utils only), with a backup
new_home fxold
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
mkdir -p "$P/chrome/utils" "$P/chrome/JS"
printf '// @version 0.10.3\n' > "$P/chrome/utils/boot.sys.mjs"
printf 'content userchromejs ./\n' > "$P/chrome/utils/chrome.manifest"
printf '// user script\n' > "$P/chrome/JS/mine.uc.js"
cp "$T/fixtures/release-good/JS/zenleap.uc.js" /dev/null
mkdir -p "$APP/defaults/pref"
printf "Components.utils; ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs');\n" > "$APP/config.js"
printf 'pref("general.config.filename", "config.js");\n' > "$APP/defaults/pref/config-prefs.js"
cp "$APP/config.js" "$T/app-config-before"
run install.sh install --yes --zen-path "$APP"
check "fx outdated: exit 0" rc_is 0
check "fx outdated: loader updated to 0.10.16" has "$P/chrome/utils/boot.sys.mjs" "@version 0.10.16"
check "fx outdated: old loader kept as utils.zenleap-backup" has "$P/chrome/utils.zenleap-backup/boot.sys.mjs" "0.10.3"
check "fx outdated: user scripts untouched" exists "$P/chrome/JS/mine.uc.js"
check "fx outdated: existing config.js not overwritten" same "$T/app-config-before" "$APP/config.js"
if $HAVE_SCRIPT; then
    printf '// @version 0.10.3\n' > "$P/chrome/utils/boot.sys.mjs"
    run_tty 'n\nn\n' install.sh install --profile 2 --zen-path "$APP"
    check "fx outdated (interactive 'n'): loader kept" has "$P/chrome/utils/boot.sys.mjs" "0.10.3"
    check "fx outdated (interactive 'n'): prompt shown" has "$OUT" "Update chrome/utils to 0.10.16?"
fi
run install.sh install --yes --zen-path "$APP"
FAKE_FXAC_FAIL=1 run install.sh install --yes --zen-path "$APP"
check "fx download fails, loader present: still installs" rc_is 0
check "fx download fails, loader present: warns" has "$OUT" "Could not download fx-autoconfig"

# 15. fx-autoconfig missing and the download fails -> clear error
new_home fxfail
mk_two_profiles "$H/.config/zen"
FAKE_FXAC_FAIL=1 run install.sh install --yes --zen-path "$APP"
check "fx missing + download fails: exit 1" rc_is 1
check "fx missing + download fails: error message" has "$OUT" "Failed to download fx-autoconfig"

# 16. Foreign (Sine) config.js in the app dir is never overwritten
new_home foreign
mk_two_profiles "$H/.config/zen"
mkdir -p "$APP/defaults/pref"
printf "// Loads Sine.\nChromeUtils.importESModule('chrome://userscripts/content/sine.sys.mjs');\n" > "$APP/config.js"
cp "$APP/config.js" "$T/sine-config"
run install.sh install --yes --zen-path "$APP"
check "foreign config.js: untouched" same "$T/sine-config" "$APP/config.js"
check "foreign config.js: warns" has "$OUT" "is not fx-autoconfig's"

# 17. App dir not writable: print sudo commands, never run sudo
new_home readonly
mk_two_profiles "$H/.config/zen"
chmod a-w "$APP"
run install.sh install --yes --zen-path "$APP"
chmod u+w "$APP"
check "read-only app dir: exit 0" rc_is 0
check "read-only app dir: prints sudo mkdir" has "$OUT" "sudo mkdir -p"
check "read-only app dir: prints sudo cp of config.js" has "$OUT" "$APP/config.js"
check "read-only app dir: files staged in the user cache" exists "$H/.cache/zenleap/fx-autoconfig-program/config.js"
check "read-only app dir: sudo never executed" missing "$T/stub-calls.log"
check "read-only app dir: still installs the profile part" exists "$H/.config/zen/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
check "read-only app dir: final summary repeats the commands" has "$OUT" "will not load until fx-autoconfig"
check "read-only app dir: no 'Installation Complete!'" lacks "$OUT" "Installation Complete!"

# 18. Sine: ZenLeap as a Sine mod (--yes replaces Sine's copy); Sine-only profile is skipped
new_home sine
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
S="$P/chrome/sine-mods/zenleap-relative-tab-nav"
mkdir -p "$S/JS" "$P/chrome/utils" "$P/chrome/JS"
printf '// @version 3.3.9\n' > "$S/JS/zenleap.uc.js"
printf 'content userchromejs ./\ncontent userscripts ../JS/\ncontent sine ../sine-mods/\n' > "$P/chrome/utils/chrome.manifest"
: > "$P/chrome/JS/sine.sys.mjs"
cp "$P/chrome/utils/chrome.manifest" "$T/sine-manifest"
run install.sh install --yes --profile 2 --zen-path "$APP"
check "sine mod: --yes replaces Sine's copy" same "$REPO/JS/zenleap.uc.js" "$S/JS/zenleap.uc.js"
check "sine mod: no second copy in chrome/JS" missing "$P/chrome/JS/zenleap.uc.js"
check "sine mod: Sine's loader untouched" same "$T/sine-manifest" "$P/chrome/utils/chrome.manifest"
check "sine mod: no fx-autoconfig program files needed" missing "$APP/config.js"
rm -rf "$P/chrome/sine-mods"
run install.sh install --yes --profile 2 --zen-path "$APP"
check "sine loader, no mod: exit 1 (nothing installed)" rc_is 1
check "sine loader, no mod: tells the user to use Sine" has "$OUT" "Install ZenLeap from Sine instead"
check "sine loader, no mod: nothing copied to chrome/JS" missing "$P/chrome/JS/zenleap.uc.js"
if $HAVE_SCRIPT; then
    mkdir -p "$S/JS"
    printf '// @version 3.3.9\n' > "$S/JS/zenleap.uc.js"
    run_tty 'n\nn\n' install.sh install --profile 2 --zen-path "$APP"
    check "sine mod (interactive 'n'): Sine's copy kept" has "$S/JS/zenleap.uc.js" "3.3.9"
fi

# 19. Zen running with the profile: never killed; --yes continues and asks for a restart
new_home running
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
mkdir -p "$T/fakezen"
cp "$(command -v sleep)" "$T/fakezen/zen"
"$T/fakezen/zen" 300 &
ZPID=$!
FAKE_PIDS+=("$ZPID")
ln -s "127.0.1.1:+$ZPID" "$P/lock"
run install.sh install --yes --zen-path "$APP"
check "running: --yes still installs" exists "$P/chrome/JS/zenleap.uc.js"
check "running: names the running profile and PID" has "$OUT" "Default (release) (PID $ZPID)"
check "running: asks for a restart" has "$OUT" "Restart Zen Browser to activate ZenLeap"
check "running: Zen process not killed" kill -0 "$ZPID"
check "running: no pkill/pgrep used" missing "$T/stub-calls.log"
if $HAVE_SCRIPT; then
    run_tty 'q\n' install.sh install --profile 2 --zen-path "$APP"
    check "running (interactive 'q'): cancelled" rc_is 1
    check "running (interactive 'q'): Zen still alive" kill -0 "$ZPID"
fi
kill "$ZPID" 2>/dev/null
wait "$ZPID" 2>/dev/null
rm -f "$P/lock"
ln -s "127.0.1.1:+999999" "$P/lock"
run install.sh install --yes --zen-path "$APP"
check "stale lock (dead PID): not reported as running" lacks "$OUT" "Zen is running"

# 20. Interactive profile menu
if $HAVE_SCRIPT; then
    new_home menu
    R="$H/.config/zen"
    mk_two_profiles "$R"
    run_tty '\nn\n' install.sh install --zen-path "$APP"
    check "menu: Enter picks the default profile" exists "$R/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
    check "menu: other profile untouched" missing "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
    check "menu: shows names and marks the default" has "$OUT" "Default (release)  [gdgcari8.Default (release)]  - default profile"
    run_tty '9\n1\nn\n' install.sh install --zen-path "$APP"
    check "menu: invalid number re-prompts, then 1 works" exists "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
    check "menu: invalid number explained" has "$OUT" "Invalid profile number 9"
    run_tty 'q\n' install.sh install --zen-path "$APP"
    check "menu: q cancels" rc_is 1
fi

# 21. Uninstall
new_home uninstall
R="$H/.config/zen"
mk_two_profiles "$R"
run install.sh install --yes --profile all --zen-path "$APP"
check "uninstall setup: installed into all profiles" exists "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
mkdir -p "$R/gdgcari8.Default (release)/zenleap-sessions"
run install.sh uninstall --yes --zen-path "$APP"
check "uninstall --yes: exit 0" rc_is 0
check "uninstall --yes: removed from profile 1" missing "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
check "uninstall --yes: removed from profile 2" missing "$R/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
check "uninstall --yes: keeps fx-autoconfig by default" exists "$R/gdgcari8.Default (release)/chrome/utils/boot.sys.mjs"
check "uninstall --yes: keeps user data" exists "$R/gdgcari8.Default (release)/zenleap-sessions"
run install.sh install --yes --profile 2 --zen-path "$APP"
run install.sh uninstall --yes --remove-fxautoconfig --zen-path "$APP"
check "uninstall --remove-fxautoconfig: utils removed" missing "$R/gdgcari8.Default (release)/chrome/utils"
check "uninstall --remove-fxautoconfig: config.js removed" missing "$APP/config.js"
check "uninstall --remove-fxautoconfig: config-prefs.js removed" missing "$APP/defaults/pref/config-prefs.js"
run install.sh uninstall --yes --zen-path "$APP"
check "uninstall with nothing installed: exit 0" rc_is 0
check "uninstall with nothing installed: says so" has "$OUT" "not installed in any Zen profile"

# 22. --remote: verified release download
new_home remote
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
run install.sh install --remote --yes --zen-path "$APP"
check "remote: exit 0" rc_is 0
check "remote: installs the release file" same "$T/fixtures/release-good/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "remote: reports verification" has "$OUT" "SHA-256 verified"
check "remote: downloaded from the release tag" has "$T/curl.log" "ZenLeap/v$VERSION/JS/zenleap.uc.js"
check "remote: never downloads from main" lacks "$T/curl.log" "ZenLeap/main/"
rm -rf "$P/chrome/JS"
FAKE_RELEASE="$T/fixtures/release-badsum" run install.sh install --remote --yes --zen-path "$APP"
check "remote bad checksum: refused (exit 1)" rc_is 1
check "remote bad checksum: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
check "remote bad checksum: explains" has "$OUT" "does not match the release's CHECKSUMS.sha256"
FAKE_RELEASE="$T/fixtures/release-nosums" run install.sh install --remote --yes --zen-path "$APP"
check "remote without CHECKSUMS.sha256: refused" rc_is 1
FAKE_RELEASE="$T/fixtures/release-badversion" run install.sh install --remote --yes --zen-path "$APP"
check "remote version != tag: refused" rc_is 1
check "remote version != tag: explains" has "$OUT" "reports version 0.0.1"
FAKE_API_FAIL=1 run install.sh install --remote --yes --zen-path "$APP"
check "remote, API down: falls back to the releases/latest redirect" rc_is 0

# 23. Piped (curl | bash) run from a directory containing stray files uses the release
new_home piped
R="$H/.config/zen"
mk_two_profiles "$R"
mkdir -p "$T/strayjs/JS"
printf '// @version 0.0.0 stray\n' > "$T/strayjs/JS/zenleap.uc.js"
OUT="$T/out.piped.log"
(cd "$T/strayjs" && env -i PATH="$FAKEBIN:/usr/bin:/bin" HOME="$H" TMPDIR="$T" FAKE_ROOT="$T" \
    FAKE_FXAC_ZIP="$T/fixtures/fxac.zip" FAKE_TAG="v$VERSION" FAKE_RELEASE="$T/fixtures/release-good" \
    "$TEST_BASH" -s -- install --yes --zen-path "$APP" < "$REPO/install.sh" > "$OUT" 2>&1)
RC=$?
check "piped: exit 0" rc_is 0
check "piped: ignores ./JS in the current directory, installs the release" same "$T/fixtures/release-good/JS/zenleap.uc.js" "$R/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"

# 24. Flatpak layout (no native Zen)
new_home flatpak
FR="$H/.var/app/app.zen_browser.zen/.zen"
mk_two_profiles "$FR"
mkdir -p "$H/.var/app/app.zen_browser.zen/cache/zen/gdgcari8.Default (release)/startupCache"
run install.sh install --yes
check "flatpak: exit 0" rc_is 0
check "flatpak: installs into the flatpak profile" exists "$FR/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
check "flatpak: program files go to the systemconfig extension" exists "$H/.local/share/flatpak/extension/app.zen_browser.zen.systemconfig/$(uname -m)/stable/config.js"
check "flatpak: flatpak cache cleared" missing "$H/.var/app/app.zen_browser.zen/cache/zen/gdgcari8.Default (release)/startupCache"

# ---------------------------------------------------------------- install-plugin.sh

new_home plugins
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
O="$R/0sczwvfb.default-release"
run install.sh install --yes --zen-path "$APP"
for plugin in "$REPO"/examples/plugins/*/; do
    id=$(basename "$plugin")
    run install-plugin.sh "$plugin" --yes
    check "plugin $id: exit 0" rc_is 0
    check "plugin $id: installed where ZenLeap is" exists "$P/chrome/zenleap-plugins/$id/plugin.js"
    check "plugin $id: not in the profile without ZenLeap" missing "$O/chrome/zenleap-plugins/$id"
done
check "plugin: security note shown" has "$OUT" "full browser privileges"
check "plugin: explains that new plugins start disabled" has "$OUT" "New plugins start disabled"
run install-plugin.sh --list
check "plugin --list: lists tab-stats" has "$OUT" "tab-stats"
check "plugin --list: shows profile names" has "$OUT" "Default (release)"
run install-plugin.sh --uninstall tab-stats --yes
check "plugin --uninstall: removed" missing "$P/chrome/zenleap-plugins/tab-stats"
check "plugin --uninstall: others kept" exists "$P/chrome/zenleap-plugins/quick-notes"
run install-plugin.sh --uninstall tab-stats --yes
check "plugin --uninstall again: says not installed" has "$OUT" "not installed in any Zen profile"
mkdir -p "$T/badplugin"
printf '{"id": "../evil", "name": "x"}' > "$T/badplugin/manifest.json"
: > "$T/badplugin/plugin.js"
run install-plugin.sh "$T/badplugin" --yes
check "plugin with unsafe id: rejected" rc_is 1
run install-plugin.sh "$REPO/examples/plugins/tab-stats" --yes --profile 1
check "plugin --profile 1: installs into #1" exists "$O/chrome/zenleap-plugins/tab-stats/manifest.json"
if $HAVE_SCRIPT; then
    run_tty 'y\n' install-plugin.sh "$REPO/examples/plugins/tab-timer" --profile 2
    check "plugin interactive overwrite 'y': exit 0" rc_is 0
fi

# ---------------------------------------------------------------- clean-legacy-css.sh

new_home cleancss
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
mkdir -p "$P/chrome"
printf '.mine{}\n\n/* === ZenLeap Styles === */\n.legacy{}\n' > "$P/chrome/userChrome.css"
cp "$P/chrome/userChrome.css" "$T/clean-before"
run clean-legacy-css.sh --dry-run
check "clean --dry-run: exit 0" rc_is 0
check "clean --dry-run: reports the block" has "$OUT" "would remove ZenLeap marker block"
check "clean --dry-run: file unchanged" same "$T/clean-before" "$P/chrome/userChrome.css"
run clean-legacy-css.sh --yes
check "clean --yes: exit 0" rc_is 0
check "clean --yes: block without end marker removed to EOF" lacks "$P/chrome/userChrome.css" ".legacy"
check "clean --yes: user CSS kept" has "$P/chrome/userChrome.css" ".mine{}"
check "clean --yes: backup written" same "$T/clean-before" "$P/chrome/userChrome.css.zenleap-backup"
run clean-legacy-css.sh --yes
check "clean again: nothing to clean" has "$OUT" "Nothing to clean"

echo ""
echo "# $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
