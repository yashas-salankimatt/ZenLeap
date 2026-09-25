#!/bin/bash
# Tests for "ZenLeap Manager.app" (macOS GUI installer) that run on Linux.
#
# The Manager is a bash script driving AppleScript dialogs. Here it runs in a
# fake macOS: `uname -s` says Darwin, Zen.app lives in ~/Applications of a
# throwaway HOME (with a space in its path), `osascript` answers dialogs from a
# queue and runs "administrator" shell scripts unprivileged, and `lsof`,
# `defaults` and `open` are stubs. Fake curl/fx-autoconfig/releases come from
# fixtures.sh. This checks the script's logic and quoting, not the real
# AppleScript rendering.
#
# Usage: scripts/tests/test-manager.sh     (TEST_BASH=/path/to/bash-3.2 recommended)

set -u

# shellcheck source=scripts/tests/fixtures.sh
. "$(dirname "${BASH_SOURCE[0]}")/fixtures.sh"

MANAGER="$REPO/ZenLeap Manager.app/Contents/MacOS/ZenLeapManager"
MACBIN="$T/macbin"
mkdir -p "$MACBIN"

cat > "$MACBIN/uname" <<'EOF'
#!/bin/sh
case "$1" in
    -s) echo Darwin ;;
    -m) echo x86_64 ;;
    *) echo Darwin ;;
esac
EOF

cat > "$MACBIN/osascript" <<'EOF'
#!/bin/bash
# Fake osascript: answers dialogs from $FAKE_ANSWERS (one answer per line),
# runs "with administrator privileges" shell scripts unprivileged (after
# making the target writable, as root could), logs to $FAKE_ROOT/osascript.log.
script=""
args=()
while [ $# -gt 0 ]; do
    case "$1" in
        -e) script="$script$2"$'\n'; shift 2 ;;
        *) args+=("$1"); shift ;;
    esac
done
log() { printf '%s\n' "$*" >> "$FAKE_ROOT/osascript.log"; }
next_answer() {
    head -n 1 "$FAKE_ANSWERS"
    sed -i '1d' "$FAKE_ANSWERS"
}
case "$script" in
    *"do shell script"*"administrator privileges"*)
        log "ADMIN [${args[*]}]"
        [ "${FAKE_ADMIN_DENY:-}" = 1 ] && exit 1
        chmod u+w "${args[1]}" "${args[1]}/defaults" "${args[1]}/defaults/pref" 2>/dev/null
        /bin/sh -c "${args[0]}" zenleap "${args[@]:1}"
        exit $? ;;
    *"choose from list"*)
        a=$(next_answer)
        log "LIST prompt=[${args[0]}] default=[${args[1]}] items=[${args[*]:2}] -> $a"
        case "$a" in
            DEFAULT) printf '%s\n' "${args[1]}" ;;
            CANCEL) printf '\n' ;;
            \#*) printf '%s\n' "${args[$(( ${a#\#} + 1 ))]}" ;;
            *) printf '%s\n' "$a" ;;
        esac ;;
    *"display notification"*) log "NOTIFY" ;;
    *"to quit"*|*"quit app"*)
        log "QUIT [${args[*]}]"
        if [ -n "${FAKE_ZEN_PIDFILE:-}" ]; then kill "$(cat "$FAKE_ZEN_PIDFILE")" 2>/dev/null; fi ;;
    *"display dialog"*)
        if [[ $script == *"with icon stop"* ]]; then log "ERROR [${args[0]}]"; exit 0; fi
        if [[ $script == *'buttons {"OK"}'* ]]; then log "ALERT [${args[0]}]"; exit 0; fi
        a=$(next_answer)
        log "DIALOG [${args[0]}] buttons=[${args[*]:2}] -> $a"
        [ "$a" = "CANCEL" ] && exit 1
        printf '%s\n' "$a" ;;
    *) log "UNKNOWN [$script]"; exit 1 ;;
esac
EOF

cat > "$MACBIN/lsof" <<'EOF'
#!/bin/sh
# Fake lsof -t -- <file>: reports $FAKE_LSOF_PID for $FAKE_LSOF_FILE
for a in "$@"; do last="$a"; done
if [ -n "${FAKE_LSOF_PID:-}" ] && [ "$last" = "${FAKE_LSOF_FILE:-}" ] && kill -0 "$FAKE_LSOF_PID" 2>/dev/null; then
    echo "$FAKE_LSOF_PID"
fi
EOF
printf '#!/bin/sh\necho app.zen-browser.zen\n' > "$MACBIN/defaults"
# shellcheck disable=SC2016  # expanded by the stub at run time
printf '#!/bin/sh\necho "open $*" >> "$FAKE_ROOT/osascript.log"\n' > "$MACBIN/open"
chmod +x "$MACBIN"/*

# new_mac <name>: HOME with a space in its path, Zen.app in ~/Applications
new_mac() {
    H="$T/$1/mac home"
    APP="$H/Applications/Zen.app"
    RES="$APP/Contents/Resources"
    R="$H/Library/Application Support/zen"
    mkdir -p "$RES" "$APP/Contents/MacOS" "$R/Profiles"
    printf '[App]\nVersion=1.22.3b\n' > "$RES/application.ini"
    : > "$APP/Contents/Info.plist"
    mk_profile "$R" "Profiles/aaaa.default-release"
    mk_profile "$R" "Profiles/bbbb.Default (release)"
    mkdir -p "$R/Profile Groups"
    cat > "$R/profiles.ini" <<'INI'
[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/aaaa.default-release
Default=1

[Profile1]
Name=Default (release)
IsRelative=1
Path=Profiles/bbbb.Default (release)

[Install2656FF1E876E9973]
Default=Profiles/bbbb.Default (release)
Locked=1
INI
    P="$R/Profiles/bbbb.Default (release)"
    O="$R/Profiles/aaaa.default-release"
    rm -f "$T/osascript.log"
}

# manager <answers...>: run the Manager with the given dialog answers
manager() {
    local a
    OUT="$T/out.$((PASS + FAIL)).log"
    : > "$T/answers"
    for a in "$@"; do printf '%s\n' "$a" >> "$T/answers"; done
    rm -f "$T/osascript.log"
    env -i PATH="$MACBIN:$FAKEBIN:/usr/bin:/bin" HOME="$H" TMPDIR="$T" LANG=C.UTF-8 \
        FAKE_ROOT="$T" FAKE_ANSWERS="$T/answers" FAKE_FXAC_ZIP="$T/fixtures/fxac.zip" \
        FAKE_TAG="${FAKE_TAG:-v$VERSION}" FAKE_RELEASE="${FAKE_RELEASE:-$T/fixtures/release-good}" \
        FAKE_LSOF_PID="${FAKE_LSOF_PID:-}" FAKE_LSOF_FILE="${FAKE_LSOF_FILE:-}" \
        FAKE_ZEN_PIDFILE="${FAKE_ZEN_PIDFILE:-}" \
        "$TEST_BASH" "$MANAGER" > "$OUT" 2>&1 < /dev/null
    RC=$?
    touch "$T/osascript.log"
    cp "$T/osascript.log" "$OUT.dialogs"   # kept for KEEP=1 debugging
}
LOG="$T/osascript.log"
answers_used() { [ ! -s "$T/answers" ]; }

# shellcheck disable=SC2016  # $BASH_VERSION of the bash under test
echo "# ZenLeap Manager tests (bash under test: $("$TEST_BASH" -c 'echo $BASH_VERSION'))"

# A. Fresh install: the list preselects the install's default profile
new_mac fresh
mkdir -p "$H/Library/Caches/zen/Profiles/bbbb.Default (release)/startupCache"
printf '[Compatibility]\nLastVersion=1.22.3b_1/1\n' > "$P/compatibility.ini"
manager Install DEFAULT No
check "install: exit 0" rc_is 0
check "install: all dialogs answered" answers_used
check "install: main menu offers Install" has "$LOG" "Not installed"
check "install: profile list preselects the install default" has "$LOG" "default=[Default (release)  [bbbb.Default (release)]]"
check "install: profile list has both profiles (default first), no junk" has "$LOG" "items=[Default (release)  [bbbb.Default (release)] default-release  [aaaa.default-release]]"
check "install: zenleap.uc.js from the verified release" same "$T/fixtures/release-good/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "install: other profile untouched" missing "$O/chrome"
check "install: fx-autoconfig program files in Zen.app" has "$RES/config.js" "boot.sys.mjs"
check "install: config-prefs.js in Zen.app" exists "$RES/defaults/pref/config-prefs.js"
check "install: loader in chrome/utils only" exists "$P/chrome/utils/boot.sys.mjs"
check "install: no fx-autoconfig example scripts" missing "$P/chrome/JS/test.uc.js"
check "install: no userChrome.css / user.js" missing "$P/chrome/userChrome.css"
check "install: no admin rights needed for a writable Zen.app" lacks "$LOG" "ADMIN"
check "install: startup cache in ~/Library/Caches/zen/Profiles/<p> cleared" missing "$H/Library/Caches/zen/Profiles/bbbb.Default (release)/startupCache"
check "install: InvalidateCaches=1 in compatibility.ini" has "$P/compatibility.ini" "InvalidateCaches=1"
check "install: tested fx-autoconfig commit downloaded" has "$T/curl.log" "fx-autoconfig/archive/dfdab5684faffc112b76ccb1d8cab7f75da0102c.zip"
check "install: success dialog" has "$LOG" "installed successfully"
check "install: dialogs contain no literal \\n" lacks "$LOG" '\n'
check "install: downloads from the release tag, not main" lacks "$T/curl.log" "/main/"
show_on_fail 0

# B. Status: installed and up to date
manager Quit
check "status: shows installed version and profile" has "$LOG" "Installed: v$VERSION (profile \"Default (release)\")"
check "status: up to date" has "$LOG" "(up to date)"
FAKE_TAG=v99.0.0 manager Quit
check "status: update available" has "$LOG" "Latest: v99.0.0 (UPDATE AVAILABLE)"

# C. Uninstall, including fx-autoconfig
manager Uninstall Yes
check "uninstall: exit 0" rc_is 0
check "uninstall: all dialogs answered" answers_used
check "uninstall: zenleap.uc.js removed" missing "$P/chrome/JS/zenleap.uc.js"
check "uninstall: chrome/utils removed" missing "$P/chrome/utils"
check "uninstall: config.js removed from Zen.app" missing "$RES/config.js"
check "uninstall: success" has "$LOG" "uninstalled successfully"

# D. Zen.app not writable: the admin dialog path, with safely quoted paths
new_mac readonly
chmod a-w "$RES"
manager Install DEFAULT No
chmod -R u+w "$RES"
check "admin: exit 0" rc_is 0
check "admin: elevation requested" has "$LOG" "ADMIN"
check "admin: Resources path passed as one argument" has "$LOG" "$RES $T/"
check "admin: config.js installed" exists "$RES/config.js"
check "admin: config-prefs.js installed" exists "$RES/defaults/pref/config-prefs.js"

# E. Zen running with the profile
new_mac running
mkdir -p "$T/fakezen"
cp "$(command -v sleep)" "$T/fakezen/zen"
start_fake_zen() {
    "$T/fakezen/zen" 300 &
    ZPID=$!
    FAKE_PIDS+=("$ZPID")
    echo "$ZPID" > "$T/zen.pid"
}
start_fake_zen
FAKE_LSOF_PID=$ZPID FAKE_LSOF_FILE="$P/.parentlock" FAKE_ZEN_PIDFILE="$T/zen.pid"
: > "$P/.parentlock"
manager Install DEFAULT "Quit Zen" No
check "running/quit: asked before quitting" has "$LOG" "Zen Browser is running with this profile"
check "running/quit: quits Zen by bundle id" has "$LOG" "QUIT [app.zen-browser.zen]"
check "running/quit: installed" exists "$P/chrome/JS/zenleap.uc.js"
check "running/quit: offers to open Zen afterwards" has "$LOG" "Open Zen Browser now?"
rm -rf "$P/chrome/JS"
start_fake_zen
FAKE_LSOF_PID=$ZPID
manager Install DEFAULT "Continue (restart later)"
check "running/continue: installed" exists "$P/chrome/JS/zenleap.uc.js"
check "running/continue: Zen left running" kill -0 "$ZPID"
check "running/continue: asks for a restart" has "$LOG" "Restart Zen Browser to activate it"
rm -rf "$P/chrome/JS"
manager Install DEFAULT CANCEL
check "running/cancel: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
check "running/cancel: Zen left running" kill -0 "$ZPID"
check "running/cancel: says cancelled" has "$LOG" "Installation cancelled."
kill "$ZPID" 2>/dev/null
FAKE_LSOF_PID="" FAKE_LSOF_FILE="" FAKE_ZEN_PIDFILE=""

# F. Sine-managed profile (Sine's bootloader in the profile, ZenLeap as a Sine mod)
new_mac sine
mkdir -p "$P/chrome/sine-mods/zenleap-relative-tab-nav/JS" "$P/chrome/utils" "$P/chrome/JS"
printf '// @version 3.3.9\n' > "$P/chrome/sine-mods/zenleap-relative-tab-nav/JS/zenleap.uc.js"
printf 'content userchromejs ./\ncontent userscripts ../JS/\ncontent sine ../sine-mods/\n' > "$P/chrome/utils/chrome.manifest"
: > "$P/chrome/JS/sine.sys.mjs"
manager Install DEFAULT
check "sine: points to Sine" has "$LOG" "Sine manages ZenLeap in this profile"
check "sine: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
check "sine: no fx-autoconfig program files" missing "$RES/config.js"
check "sine: Sine's copy untouched" has "$P/chrome/sine-mods/zenleap-relative-tab-nav/JS/zenleap.uc.js" "3.3.9"
rm -rf "$P/chrome/sine-mods"
manager Install DEFAULT
check "sine bootloader profile without the mod: points to Sine" has "$LOG" "set up for Sine's bootloader"
check "sine bootloader profile without the mod: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
# A sine-mods copy where Sine does not start is a leftover: install as usual
new_mac sineleft
mkdir -p "$P/chrome/sine-mods/zenleap-relative-tab-nav/JS"
printf '// @version 3.3.9\n' > "$P/chrome/sine-mods/zenleap-relative-tab-nav/JS/zenleap.uc.js"
echo '{}' > "$P/chrome/sine-mods/mods.json"
manager Install DEFAULT No
check "leftover Sine files: installed into chrome/JS" same "$T/fixtures/release-good/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "leftover Sine files: fx-autoconfig set up" exists "$RES/config.js"
# chrome/utils of another loader
new_mac foreignutils
mkdir -p "$P/chrome/utils"
printf 'content other ./\n' > "$P/chrome/utils/chrome.manifest"
manager Install DEFAULT
check "another loader's chrome/utils: error shown" has "$LOG" "holds another script loader"
check "another loader's chrome/utils: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
check "another loader's chrome/utils: untouched" has "$P/chrome/utils/chrome.manifest" "content other"

# G. Foreign config.js in Zen.app
new_mac foreign
printf "ChromeUtils.importESModule('chrome://userscripts/content/sine.sys.mjs');\n" > "$RES/config.js"
cp "$RES/config.js" "$T/foreign-config"
manager Install DEFAULT
check "Sine's config.js: points to Sine" has "$LOG" "starts Sine's bootloader"
check "Sine's config.js: untouched" same "$T/foreign-config" "$RES/config.js"
check "Sine's config.js: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
printf "// custom autoconfig\n" > "$RES/config.js"
cp "$RES/config.js" "$T/foreign-config"
manager Install DEFAULT
check "other config.js: error shown" has "$LOG" "loads neither fx-autoconfig nor Sine"
check "other config.js: names the file Zen runs" has "$LOG" "$RES/config.js"
check "other config.js: untouched" same "$T/foreign-config" "$RES/config.js"

# H. Release fails verification: what happened and what to do instead
new_mac badsum
FAKE_RELEASE="$T/fixtures/release-badsum" manager Install DEFAULT
check "bad checksum: error shown" has "$LOG" "does not match the release's CHECKSUMS.sha256"
check "bad checksum: whose problem it is" has "$LOG" "This is a problem with that release on GitHub"
check "bad checksum: no promise about a fixed release" lacks "$LOG" "on its way"
check "bad checksum: the clone's installer, no options (the Manager has none)" has "$LOG" "cd ZenLeap && ./install.sh"
check "bad checksum: how to install from a clone" has "$LOG" "git clone --depth 1 https://github.com/yashas-salankimatt/ZenLeap.git"
check "bad checksum: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
FAKE_RELEASE="$T/fixtures/no-such-release" manager Install DEFAULT
check "download failure: not blamed on the release" lacks "$LOG" "git clone"

# I. Outdated loader, userChrome.css block from an older version
new_mac outdated
mkdir -p "$P/chrome/utils"
printf '// @version 0.10.3\n' > "$P/chrome/utils/boot.sys.mjs"
printf '.mine{}\n/* === ZenLeap Styles === */\n.old{}\n/* === End ZenLeap Styles === */\n' > "$P/chrome/userChrome.css"
manager Install DEFAULT Yes No
check "outdated: loader updated" has "$P/chrome/utils/boot.sys.mjs" "0.10.16"
check "outdated: backup kept" has "$P/chrome/utils.zenleap-backup/boot.sys.mjs" "0.10.3"
check "outdated: old CSS block removed" lacks "$P/chrome/userChrome.css" ".old{}"
check "outdated: user CSS kept" has "$P/chrome/userChrome.css" ".mine{}"
check "outdated: userChrome.css backup" exists "$P/chrome/userChrome.css.zenleap-backup"

# M. Leftovers: fx-autoconfig's examples offered for removal on install, the
#    updater's backup removed on uninstall, fx-autoconfig kept for other scripts
new_mac leftovers
mkdir -p "$P/chrome/JS" "$P/chrome/CSS"
cp "$FXAC_TREE/profile/chrome/JS/test.uc.js" "$P/chrome/JS/"
cp "$FXAC_TREE/profile/chrome/CSS/agent_style.uc.css" "$P/chrome/CSS/"
manager Install DEFAULT Yes No
check "examples: removal offered" has "$LOG" "Hi mom"
check "examples: test.uc.js removed" missing "$P/chrome/JS/test.uc.js"
check "examples: empty CSS folder removed" missing "$P/chrome/CSS"
check "examples: ZenLeap installed" exists "$P/chrome/JS/zenleap.uc.js"
cp "$P/chrome/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js.bak"
echo '// other' > "$P/chrome/JS/zenripple_agent.uc.js"
manager Uninstall
check "uninstall: zenleap.uc.js removed" missing "$P/chrome/JS/zenleap.uc.js"
check "uninstall: the updater's .bak removed" missing "$P/chrome/JS/zenleap.uc.js.bak"
check "uninstall: fx-autoconfig not offered for removal while another script uses it" lacks "$LOG" "Also remove fx-autoconfig?"
check "uninstall: says why it was kept" has "$LOG" "zenripple_agent.uc.js"
check "uninstall: loader kept" exists "$P/chrome/utils/boot.sys.mjs"
check "uninstall: config.js kept" exists "$RES/config.js"
rm -f "$P/chrome/JS/zenripple_agent.uc.js"
manager Install DEFAULT No
mkdir -p "$O/chrome/JS"
cp -R "$P/chrome/utils" "$O/chrome/"
cp "$P/chrome/JS/zenleap.uc.js" "$O/chrome/JS/"
manager Uninstall DEFAULT Yes
check "uninstall + remove fx-autoconfig: this profile's loader removed" missing "$P/chrome/utils"
check "uninstall + remove fx-autoconfig: config.js kept for the other profile" exists "$RES/config.js"
check "uninstall + remove fx-autoconfig: says so" has "$LOG" "still need it"

# K. Zen.app outside the usual folders, found through the profile's compatibility.ini
new_mac elsewhere
mkdir -p "$H/Downloads"
mv "$APP" "$H/Downloads/Zen.app"
APP="$H/Downloads/Zen.app"
RES="$APP/Contents/Resources"
printf '[Compatibility]\nLastPlatformDir=%s\n' "$RES" > "$P/compatibility.ini"
manager Install DEFAULT No
check "Zen.app from LastPlatformDir: installed" exists "$P/chrome/JS/zenleap.uc.js"
check "Zen.app from LastPlatformDir: fx-autoconfig went into that app" exists "$RES/config.js"

# L. The real, tested fx-autoconfig hashes reject a different archive
new_mac pinned
MANAGER="$REAL_REPO/ZenLeap Manager.app/Contents/MacOS/ZenLeapManager" manager Install DEFAULT
check "pinned hashes: fx-autoconfig from a different archive is refused" has "$LOG" "Failed to install fx-autoconfig"
check "pinned hashes: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
check "pinned hashes: no config.js written" missing "$RES/config.js"

# J. No Zen.app
new_mac noapp
rm -rf "$APP"
manager
check "no Zen.app: error" has "$LOG" "Zen Browser is not installed"

echo ""
echo "# $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
