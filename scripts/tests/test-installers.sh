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

# shellcheck source=scripts/tests/fixtures.sh
. "$(dirname "${BASH_SOURCE[0]}")/fixtures.sh"

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
run install.sh install --yes --profile 2 --zen-path "$APP"
check "--profile 2: the default profile is #1, so #2 is default-release" exists "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
check "--profile 2: not into #1" missing "$R/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
run install.sh install --yes --profile "default (release)" --zen-path "$APP"
check "--profile <name>: case-insensitive name match" exists "$R/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
rm -rf "$R/0sczwvfb.default-release/chrome/JS"
run install.sh install --yes --profile "0sczwvfb.default-release" --zen-path "$APP"
check "--profile <directory name>: works" exists "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
rm -rf "$R"/*/chrome/JS
run install.sh install --yes --profile 1 --profile 2 --zen-path "$APP"
check "--profile repeated: both profiles" exists "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
check "--profile repeated: first one too" exists "$R/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
rm -rf "$R"/*/chrome/JS
run install.sh install --yes --all-profiles --zen-path "$APP"
check "--all-profiles: every profile" exists "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
check "--all-profiles: never junk dirs" missing "$R/Profile Groups/chrome"
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
run install.sh install --yes --profile 2 --zen-path "$APP"
check "css: userChrome.css without markers is left byte-identical" same "$T/css-plain" "$R/0sczwvfb.default-release/chrome/userChrome.css"
check "css: no backup when nothing changed" missing "$R/0sczwvfb.default-release/chrome/userChrome.css.zenleap-backup"

# 14. An existing fx-autoconfig (e.g. installed by ZenRipple) is left alone with
#     --yes; interactive runs offer to update a loader older than the tested one
new_home fxold
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
mkdir -p "$P/chrome/utils" "$P/chrome/JS"
printf '// @version 0.10.3\n' > "$P/chrome/utils/boot.sys.mjs"
printf 'content userchromejs ./\n' > "$P/chrome/utils/chrome.manifest"
printf '// user script\n' > "$P/chrome/JS/mine.uc.js"
mkdir -p "$APP/defaults/pref"
printf "Components.utils; ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs');\n" > "$APP/config.js"
printf 'pref("general.config.filename", "config.js");\n' > "$APP/defaults/pref/config-prefs.js"
cp "$APP/config.js" "$T/app-config-before"
run install.sh install --yes --zen-path "$APP"
check "fx old loader (--yes): exit 0" rc_is 0
check "fx old loader (--yes): loader left alone" has "$P/chrome/utils/boot.sys.mjs" "0.10.3"
check "fx old loader (--yes): says how to update it" has "$OUT" "run the installer without --yes to update it"
check "fx old loader: existing config.js not overwritten" same "$T/app-config-before" "$APP/config.js"
check "fx old loader: user scripts untouched" exists "$P/chrome/JS/mine.uc.js"
if $HAVE_SCRIPT; then
    run_tty '\nn\n' install.sh install --profile 1 --zen-path "$APP"
    check "fx old loader (interactive Enter): updated to 0.10.16" has "$P/chrome/utils/boot.sys.mjs" "@version 0.10.16"
    check "fx old loader (interactive Enter): old loader kept as utils.zenleap-backup" has "$P/chrome/utils.zenleap-backup/boot.sys.mjs" "0.10.3"
    check "fx old loader (interactive Enter): prompt shown" has "$OUT" "Update chrome/utils to 0.10.16?"
    printf '// @version 0.10.3\n' > "$P/chrome/utils/boot.sys.mjs"
    run_tty 'n\nn\n' install.sh install --profile 1 --zen-path "$APP"
    check "fx old loader (interactive 'n'): kept" has "$P/chrome/utils/boot.sys.mjs" "0.10.3"
fi
printf '// @version 0.10.16\n' > "$P/chrome/utils/boot.sys.mjs"
: > "$T/curl.log"
FAKE_FXAC_FAIL=1 run install.sh install --yes --zen-path "$APP"
check "fx loader up to date: installs" rc_is 0
check "fx loader up to date: nothing downloaded for fx-autoconfig" lacks "$T/curl.log" "fx-autoconfig/archive"
check "fx loader up to date: reported" has "$OUT" "fx-autoconfig loader 0.10.16 already installed"

# 15. fx-autoconfig missing and the download fails -> clear error
new_home fxfail
mk_two_profiles "$H/.config/zen"
FAKE_FXAC_FAIL=1 run install.sh install --yes --zen-path "$APP"
check "fx missing + download fails: exit 1" rc_is 1
check "fx missing + download fails: error message" has "$OUT" "Could not get fx-autoconfig"

# 16. config.js that is not fx-autoconfig's is never overwritten
new_home foreign
mk_two_profiles "$H/.config/zen"
mkdir -p "$APP/defaults/pref"
printf "// Loads Sine.\nChromeUtils.importESModule('chrome://userscripts/content/sine.sys.mjs');\n" > "$APP/config.js"
cp "$APP/config.js" "$T/sine-config"
run install.sh install --yes --zen-path "$APP"
check "Sine's config.js: untouched" same "$T/sine-config" "$APP/config.js"
check "Sine's config.js: explains that Sine only runs Sine mods" has "$OUT" "starts Sine's bootloader"
check "Sine's config.js, profile without Sine: skipped (exit 1)" rc_is 1
check "Sine's config.js, profile without Sine: nothing in chrome/JS" missing "$H/.config/zen/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
printf "// some other autoconfig\nlockPref('a', 1);\n" > "$APP/config.js"
cp "$APP/config.js" "$T/other-config"
run install.sh install --yes --zen-path "$APP"
check "other config.js: untouched" same "$T/other-config" "$APP/config.js"
check "other config.js: warns" has "$OUT" "is not fx-autoconfig's"
check "other config.js: profile part still installed" exists "$H/.config/zen/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"
printf "Components.utils.import('chrome://userchromejs/content/boot.jsm');\n" > "$APP/config.js"
cp "$APP/config.js" "$T/jsm-config"
run install.sh install --yes --zen-path "$APP"
check "old boot.jsm fx-autoconfig config.js: left alone" same "$T/jsm-config" "$APP/config.js"
printf "ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs'); // mine\n" > "$APP/config.js"
cp "$APP/config.js" "$T/noprefs-config"
rm -f "$APP"/defaults/pref/*.js
run install.sh install --yes --zen-path "$APP"
check "fx-autoconfig config.js without its pref file: config.js kept" same "$T/noprefs-config" "$APP/config.js"
check "fx-autoconfig config.js without its pref file: pref file added" has "$APP/defaults/pref/config-prefs.js" "general.config.filename"
rm -f "$APP/defaults/pref/config-prefs.js"
printf 'pref("general.config.filename", "config.js");\n' > "$APP/defaults/pref/autoconfig.js"
run install.sh install --yes --zen-path "$APP"
check "pref file under another name is recognised" missing "$APP/defaults/pref/config-prefs.js"

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
run install.sh install --yes --profile 1 --zen-path "$APP"
check "sine mod: --yes replaces Sine's copy" same "$REPO/JS/zenleap.uc.js" "$S/JS/zenleap.uc.js"
check "sine mod: no second copy in chrome/JS" missing "$P/chrome/JS/zenleap.uc.js"
check "sine mod: Sine's loader untouched" same "$T/sine-manifest" "$P/chrome/utils/chrome.manifest"
check "sine mod: no fx-autoconfig program files needed" missing "$APP/config.js"
rm -rf "$P/chrome/sine-mods"
run install.sh install --yes --profile 1 --zen-path "$APP"
check "sine loader, no mod: exit 1 (nothing installed)" rc_is 1
check "sine loader, no mod: tells the user to use Sine" has "$OUT" "Install ZenLeap from Sine instead"
check "sine loader, no mod: nothing copied to chrome/JS" missing "$P/chrome/JS/zenleap.uc.js"
if $HAVE_SCRIPT; then
    mkdir -p "$S/JS"
    printf '// @version 3.3.9\n' > "$S/JS/zenleap.uc.js"
    run_tty 'n\nn\n' install.sh install --profile 1 --zen-path "$APP"
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
printf '[Compatibility]\nLastVersion=1.22.3b_20260922050124/20260922050124\n' > "$P/compatibility.ini"
mkdir -p "$H/.cache/zen/gdgcari8.Default (release)/startupCache"
run install.sh install --yes --zen-path "$APP"
check "running: --yes still installs" exists "$P/chrome/JS/zenleap.uc.js"
check "running: asks Zen to drop its startup cache on the next start" has "$P/compatibility.ini" "InvalidateCaches=1"
check "running: cache of the running Zen not deleted underneath it" exists "$H/.cache/zen/gdgcari8.Default (release)/startupCache"
check "running: names the running profile and PID" has "$OUT" "Default (release) (PID $ZPID)"
check "running: asks for a restart" has "$OUT" "Restart Zen Browser to activate ZenLeap"
check "running: Zen process not killed" kill -0 "$ZPID"
check "running: no pkill/pgrep used" missing "$T/stub-calls.log"
if $HAVE_SCRIPT; then
    run_tty 'q\n' install.sh install --profile 1 --zen-path "$APP"
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
    run_tty '9\n2\nn\n' install.sh install --zen-path "$APP"
    check "menu: invalid number re-prompts, then 2 works" exists "$R/0sczwvfb.default-release/chrome/JS/zenleap.uc.js"
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
run install.sh install --yes --profile 1 --zen-path "$APP"
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

# 25. Zen installation from the profile's compatibility.ini (no --zen-path), version floor
new_home lastplatform
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
APP2="$T/lastplatform/zen-old"
mk_app "$APP2"
printf '[App]\nVersion=1.20.2b\n' > "$APP2/application.ini"
printf '[Compatibility]\nLastVersion=1.20.2b_1/1\nLastPlatformDir=%s\nLastAppDir=%s/browser\n' "$APP2" "$APP2" > "$P/compatibility.ini"
run install.sh install --yes
check "LastPlatformDir: exit 0" rc_is 0
check "LastPlatformDir: fx-autoconfig goes into the install that runs the profile" exists "$APP2/config.js"
check "LastPlatformDir: warns about a Zen older than the floor" has "$OUT" "older than 1.21.7b"
check "cache: InvalidateCaches=1 added to compatibility.ini" has "$P/compatibility.ini" "InvalidateCaches=1"
run install.sh install --yes
check "cache: InvalidateCaches=1 not duplicated" test "$(grep -c InvalidateCaches=1 "$P/compatibility.ini")" = 1
rm -f "$P/compatibility.ini"
rm -rf "$P/chrome"
run install.sh install --yes
check "no Zen installation found with --yes: fails" rc_is 1
check "no Zen installation found with --yes: asks for --zen-path" has "$OUT" "--zen-path"

# 26. profiles.ini is read like Firefox: stops at the first gap or at a
#     section without IsRelative; newest profile wins when nothing is marked
new_home iniquirks
R="$H/.config/zen"
mk_profile "$R" "a.A"
mk_profile "$R" "b.B"
mk_profile "$R" "c.C"
printf '[Profile0]\nName=A\nIsRelative=1\nPath=a.A\n\n[Profile2]\nName=C\nIsRelative=1\nPath=c.C\n' > "$R/profiles.ini"
run install.sh install --yes --all-profiles --zen-path "$APP"
check "ini gap: Profile0 used" exists "$R/a.A/chrome/JS/zenleap.uc.js"
check "ini gap: Profile2 after a gap ignored (as by Zen)" missing "$R/c.C/chrome"
rm -rf "$R/a.A/chrome"
printf '[Profile0]\nName=A\nIsRelative=1\nPath=a.A\n\n[Profile1]\nName=B\nPath=b.B\n\n[Profile2]\nName=C\nIsRelative=1\nPath=c.C\n' > "$R/profiles.ini"
run install.sh install --yes --all-profiles --zen-path "$APP"
check "ini without IsRelative: stops there (as Zen does)" missing "$R/b.B/chrome"
check "ini without IsRelative: later profiles ignored" missing "$R/c.C/chrome"
rm -rf "$R"/*/chrome
printf '[Profile0]\nName=A\nIsRelative=1\nPath=a.A\n\n[Profile1]\nName=B\nIsRelative=1\nPath=b.B\n' > "$R/profiles.ini"
touch -d '2026-01-01' "$R/a.A/prefs.js"
touch -d '2026-06-01' "$R/b.B/prefs.js"
run install.sh install --yes --zen-path "$APP"
check "no default marked: the most recently used profile" exists "$R/b.B/chrome/JS/zenleap.uc.js"
check "no default marked: not the other one" missing "$R/a.A/chrome"

# 27. fx-autoconfig pin: the real, tested hashes reject a different archive;
#     FX_AUTOCONFIG_REF / FX_AUTOCONFIG_DIR are used unverified
new_home fxpin
R="$H/.config/zen"
mk_two_profiles "$R"
REPO="$REAL_REPO" run install.sh install --yes --zen-path "$APP"
check "pinned hashes: an archive that differs is refused" rc_is 1
check "pinned hashes: says why" has "$OUT" "does not match the tested version"
check "pinned hashes: nothing installed" missing "$APP/config.js"
check "pinned hashes: downloads the pinned commit" has "$T/curl.log" "fx-autoconfig/archive/dfdab5684faffc112b76ccb1d8cab7f75da0102c.zip"
EXTRA_ENV="FX_AUTOCONFIG_REF=some-branch" REPO="$REAL_REPO" run install.sh install --yes --zen-path "$APP"
check "FX_AUTOCONFIG_REF: installs" rc_is 0
check "FX_AUTOCONFIG_REF: says it is not verified" has "$OUT" "not the tested version, not verified"
check "FX_AUTOCONFIG_REF: downloads that ref" has "$T/curl.log" "fx-autoconfig/archive/some-branch.zip"
new_home fxdir
mk_two_profiles "$H/.config/zen"
: > "$T/curl.log"
EXTRA_ENV="FX_AUTOCONFIG_DIR=$FXAC_TREE" REPO="$REAL_REPO" run install.sh install --yes --zen-path "$APP"
check "FX_AUTOCONFIG_DIR: installs from the local checkout" has "$APP/config.js" "boot.sys.mjs"
check "FX_AUTOCONFIG_DIR: nothing downloaded" lacks "$T/curl.log" "fx-autoconfig"
EXTRA_ENV="FX_AUTOCONFIG_DIR=$FXAC_TREE" REPO="$REAL_REPO" run install.sh install --yes --zen-path "$APP"
check "FX_AUTOCONFIG_DIR + loader already there: reported as up to date" has "$OUT" "fx-autoconfig loader 0.10.16 already installed"
check "FX_AUTOCONFIG_DIR + loader already there: not called outdated" lacks "$OUT" "older than the tested one"

# 29. profiles.ini the way Firefox reads it: a UTF-8 BOM, "[Section] " with a
#     trailing blank, indented keys and comments work; the keys under a
#     malformed header ("[Profile1]x") are ignored  [REV-LINST-10]
new_home inifx
R="$H/.config/zen"
mk_profile "$R" "aaaa.one"
mk_profile "$R" "bbbb.two"
printf '\xef\xbb\xbf[Profile0]\nName=one\nIsRelative=1\nPath=aaaa.one\n\n[Profile1]\nName=two\nIsRelative=1\nPath=bbbb.two\nDefault=1\n' > "$R/profiles.ini"
touch -d '2020-01-01' "$R/bbbb.two/prefs.js"
run install.sh install --yes --zen-path "$APP"
check "ini with a UTF-8 BOM: read (the Default=1 profile)" exists "$R/bbbb.two/chrome/JS/zenleap.uc.js"
check "ini with a UTF-8 BOM: not the newest unmarked one" missing "$R/aaaa.one/chrome"
rm -rf "$R"/*/chrome
printf '[Profile0]\nName=one\nIsRelative=1\nPath=aaaa.one\nDefault=1\n\n[Profile1] \nName=two\nIsRelative=1\nPath=bbbb.two\n' > "$R/profiles.ini"
run install.sh install --yes --zen-path "$APP"
check "'[Profile1] ': Profile0 keeps its own keys (the default)" exists "$R/aaaa.one/chrome/JS/zenleap.uc.js"
check "'[Profile1] ': Profile1 not taken for the default" missing "$R/bbbb.two/chrome"
run install.sh check
check "'[Profile1] ': Profile1 is listed" has "$OUT" "two: NOT_INSTALLED"
rm -rf "$R"/*/chrome
printf '[Profile0]\n  Name=one\n\tIsRelative=1\n  Path=aaaa.one\n; Path=bbbb.two\n# Default=0\n[Profile1]x\nName=two\nIsRelative=1\nPath=bbbb.two\nDefault=1\n' > "$R/profiles.ini"
run install.sh install --yes --all-profiles --zen-path "$APP"
check "indented keys and comments: Profile0 read" exists "$R/aaaa.one/chrome/JS/zenleap.uc.js"
check "malformed '[Profile1]x': its keys ignored (as by Zen)" missing "$R/bbbb.two/chrome"

# 35. fx-autoconfig verification counts every entry of chrome/utils (hidden ones
#     too, by exact name), and exactly the verified files are copied  [REV-LINST-13]
new_home fxhidden
R="$H/.config/zen"
mk_two_profiles "$R"
P="$R/gdgcari8.Default (release)"
for extra in .hidden.mjs boot; do
    rm -rf "$T/fxh"
    mkdir -p "$T/fxh"
    cp -a "$FXAC_TREE" "$T/fxh/"
    printf 'evil\n' > "$T/fxh/$(basename "$FXAC_TREE")/profile/chrome/utils/$extra"
    zip_tree "$T/fixtures/fxac-extra.zip" "$T/fxh" "$(basename "$FXAC_TREE")"
    FAKE_FXAC_ZIP="$T/fixtures/fxac-extra.zip" run install.sh install --yes --zen-path "$APP"
    check "archive with an extra chrome/utils/$extra: refused" rc_is 1
    check "... names it" has "$OUT" "unexpected file: profile/chrome/utils/$extra"
    check "... no loader installed" missing "$P/chrome/utils"
    check "... no config.js" missing "$APP/config.js"
done
run install.sh install --yes --zen-path "$APP"
# shellcheck disable=SC2012  # plain file names
check "verified loader: exactly the pinned files in chrome/utils" \
    test "$(ls -A "$P/chrome/utils" | tr '\n' ' ')" = "boot.sys.mjs chrome.manifest fs.sys.mjs module_loader.mjs uc_api.sys.mjs utils.sys.mjs "

# 38. Not bash: a clear message instead of a parse error; bash in POSIX mode
#     (`sh` on macOS) works  [REV-LINST-17]
new_home notbash
mk_two_profiles "$H/.config/zen"
DASH=$(command -v dash || true)
if [ -n "$DASH" ]; then
    OUT="$T/out.dash.log"
    env -i PATH="$FAKEBIN:/usr/bin:/bin" HOME="$H" "$DASH" -s -- --yes < "$REPO/install.sh" > "$OUT" 2>&1
    RC=$?
    check "piped into dash: exit 1" rc_is 1
    check "piped into dash: says bash is needed" has "$OUT" "needs bash"
    check "piped into dash: no parse error" lacks "$OUT" "Bad substitution"
    for s in install-plugin.sh clean-legacy-css.sh; do
        env -i PATH="$FAKEBIN:/usr/bin:/bin" HOME="$H" "$DASH" "$REPO/$s" --list > "$OUT" 2>&1
        RC=$?
        check "$s under dash: says bash is needed" has "$OUT" "needs bash"
    done
fi
OUT="$T/out.posix.log"
env -i PATH="$FAKEBIN:/usr/bin:/bin" HOME="$H" TMPDIR="$T" FAKE_ROOT="$T" FAKE_FXAC_ZIP="$T/fixtures/fxac.zip" \
    FAKE_TAG="v$VERSION" FAKE_RELEASE="$T/fixtures/release-good" \
    "$TEST_BASH" --posix -s -- --yes --zen-path "$APP" < "$REPO/install.sh" > "$OUT" 2>&1
RC=$?
check "bash --posix (macOS sh): exit 0" rc_is 0
check "bash --posix (macOS sh): installed" exists "$H/.config/zen/gdgcari8.Default (release)/chrome/JS/zenleap.uc.js"

# 41. A path with a backslash: files are hashed from stdin (GNU sha256sum
#     escapes such names in its output)
new_home 'back\slash'
mk_two_profiles "$H/.config/zen"
run install.sh install --yes --zen-path "$APP"
check "HOME with a backslash: exit 0" rc_is 0
check "HOME with a backslash: the verified loader copied" exists "$H/.config/zen/gdgcari8.Default (release)/chrome/utils/boot.sys.mjs"

# 42. Profile root rules (the same as the ZenRipple installer, verified with the
#     real Zen): ~/.zen or ~/zen existing (a regular file counts, a dangling
#     symlink doesn't) or MOZ_LEGACY_HOME starting with 1 -> ~/.zen
# shellcheck disable=SC2016  # expanded by the bash under test
lib_root() {  # lib_root <home> [VAR=value...]
    local h="$1"
    shift
    env -i HOME="$h" PATH=/usr/bin:/bin "$@" "$TEST_BASH" -c '. "$1"; zp_linux_rule_root' _ "$REPO/scripts/lib/zen-paths.sh"
}
RH="$T/roots"
mkdir -p "$RH/plain" "$RH/dangling" "$RH/zenfile" "$RH/dotzenfile" "$RH/capital/Zen" "$RH/mozilla/.mozilla"
ln -s "$T/nowhere" "$RH/dangling/.zen"
: > "$RH/zenfile/zen"
: > "$RH/dotzenfile/.zen"
check "root: nothing -> ~/.config/zen" test "$(lib_root "$RH/plain")" = "$RH/plain/.config/zen"
check "root: a dangling ~/.zen symlink doesn't count" test "$(lib_root "$RH/dangling")" = "$RH/dangling/.config/zen"
check "root: ~/zen as a regular file -> ~/.zen" test "$(lib_root "$RH/zenfile")" = "$RH/zenfile/.zen"
check "root: ~/.zen as a regular file -> ~/.zen" test "$(lib_root "$RH/dotzenfile")" = "$RH/dotzenfile/.zen"
check "root: ~/Zen doesn't count" test "$(lib_root "$RH/capital")" = "$RH/capital/.config/zen"
check "root: ~/.mozilla doesn't count" test "$(lib_root "$RH/mozilla")" = "$RH/mozilla/.config/zen"
check "root: MOZ_LEGACY_HOME=1x -> ~/.zen" test "$(lib_root "$RH/plain" MOZ_LEGACY_HOME=1x)" = "$RH/plain/.zen"
check "root: MOZ_LEGACY_HOME=true -> XDG" test "$(lib_root "$RH/plain" MOZ_LEGACY_HOME=true)" = "$RH/plain/.config/zen"
check "root: MOZ_LEGACY_HOME=0 -> XDG" test "$(lib_root "$RH/plain" MOZ_LEGACY_HOME=0)" = "$RH/plain/.config/zen"
check "root: relative XDG_CONFIG_HOME ignored" test "$(lib_root "$RH/plain" XDG_CONFIG_HOME=rel/cfg)" = "$RH/plain/.config/zen"
check "root: absolute XDG_CONFIG_HOME honoured" test "$(lib_root "$RH/plain" XDG_CONFIG_HOME=/x/cfg)" = "/x/cfg/zen"

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
run install-plugin.sh "$REPO/examples/plugins/tab-stats" --yes --profile 2
check "plugin --profile 2: installs into #2" exists "$O/chrome/zenleap-plugins/tab-stats/manifest.json"
if $HAVE_SCRIPT; then
    run_tty 'y\n' install-plugin.sh "$REPO/examples/plugins/tab-timer" --profile 1
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
