#!/bin/bash
# Tests for install.ps1 that run on Linux with PowerShell 7 (pwsh).
#
# install.ps1 runs in a fake Windows environment: APPDATA/LOCALAPPDATA point
# into a throwaway HOME, the Zen "Program Files" dir is a temp folder, and
# Invoke-WebRequest / Invoke-RestMethod / Start-Process / Stop-Process are
# replaced by mocks that serve the fixtures from fixtures.sh (nothing is
# downloaded, launched or killed). Windows PowerShell 5.1 compatibility is
# checked separately with PSScriptAnalyzer (see RELEASING.md).
#
# Usage: scripts/tests/test-install-ps1.sh      (PWSH=/path/to/pwsh if not on PATH)

set -u

# shellcheck source=scripts/tests/fixtures.sh
. "$(dirname "${BASH_SOURCE[0]}")/fixtures.sh"

PWSH="${PWSH:-pwsh}"
if ! command -v "$PWSH" >/dev/null 2>&1; then
    echo "# pwsh not found (set PWSH=/path/to/pwsh); skipping install.ps1 tests"
    exit 0
fi

cat > "$T/mock.ps1" <<'EOF'
function global:Write-MockLog([string]$Line) {
    Add-Content -LiteralPath (Join-Path $env:FAKE_ROOT 'ps-net.log') -Value $Line
}
function global:Resolve-FakeUrl([string]$Uri) {
    if ($Uri -like 'https://github.com/MrOtherGuy/fx-autoconfig/archive/*.zip') {
        if ($env:FAKE_FXAC_FAIL -eq '1') { return $null }
        return $env:FAKE_FXAC_ZIP
    }
    $prefix = 'https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/'
    if ($Uri.StartsWith($prefix)) {
        $rest = $Uri.Substring($prefix.Length)
        $tag = $rest.Split('/')[0]
        if ($tag -ne $env:FAKE_TAG) { return $null }
        $f = Join-Path $env:FAKE_RELEASE $rest.Substring($tag.Length + 1)
        if (Test-Path -LiteralPath $f) { return $f }
    }
    return $null
}
function global:Invoke-WebRequest {
    param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing)
    Write-MockLog "IWR $Uri"
    if ($Uri -eq 'https://github.com/yashas-salankimatt/ZenLeap/releases/latest') {
        $final = [Uri]"https://github.com/yashas-salankimatt/ZenLeap/releases/tag/$($env:FAKE_TAG)"
        return [pscustomobject]@{ BaseResponse = [pscustomobject]@{ RequestMessage = [pscustomobject]@{ RequestUri = $final } } }
    }
    $src = Resolve-FakeUrl $Uri
    if (-not $src) { throw "404 Not Found: $Uri" }
    if ($OutFile) { Copy-Item -LiteralPath $src -Destination $OutFile -Force; return }
    return [pscustomobject]@{ Content = [IO.File]::ReadAllText($src) }
}
function global:Invoke-RestMethod {
    param([string]$Uri, [switch]$UseBasicParsing)
    Write-MockLog "IRM $Uri"
    if ($Uri -eq 'https://api.github.com/repos/yashas-salankimatt/ZenLeap/releases/latest' -and $env:FAKE_API_FAIL -ne '1') {
        return [pscustomobject]@{ tag_name = $env:FAKE_TAG }
    }
    throw "404 Not Found: $Uri"
}
function global:Start-Process {
    param($FilePath, $Verb, [switch]$Wait, [switch]$PassThru, $ArgumentList)
    Write-MockLog "START-PROCESS $FilePath $Verb"
    throw "Start-Process is blocked in tests"
}
function global:Stop-Process { Write-MockLog "STOP-PROCESS $args" }
EOF

# ps_lit <string>: PowerShell single-quoted literal
ps_lit() { printf "'%s'" "${1//\'/\'\'}"; }

# new_win <name>: fake Windows layout with two profiles (install default != Default=1)
new_win() {
    H="$T/$1/home"
    ZENDIR="$T/$1/Program Files/Zen Browser"
    mkdir -p "$H" "$ZENDIR"
    : > "$ZENDIR/zen.exe"
    R="$H/AppData/Roaming/zen"
    L="$H/AppData/Local/zen"
    mkdir -p "$R/Profiles" "$L"
    mk_profile "$R" "Profiles/aaaa.default-release"
    mk_profile "$R" "Profiles/bbbb.Default (release)"
    mkdir -p "$R/Profile Groups" "$R/Crash Reports"
    cat > "$R/profiles.ini" <<'INI'
[General]
StartWithLastProfile=1
Version=2

[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/aaaa.default-release
Default=1

[InstallF0DC299D809B9700]
Default=Profiles/bbbb.Default (release)
Locked=1

[Profile1]
Name=Default (release)
IsRelative=1
Path=Profiles/bbbb.Default (release)
INI
    printf '[F0DC299D809B9700]\r\nDefault=Profiles/bbbb.Default (release)\r\nLocked=1\r\n' > "$R/installs.ini"
    P="$R/Profiles/bbbb.Default (release)"
    O="$R/Profiles/aaaa.default-release"
}

# ps [--stdin <input>] [--iex <dir>] <install.ps1 args...>
ps() {
    local input="" iex_dir="" a line
    if [ "${1:-}" = "--stdin" ]; then input="$2"; shift 2; fi
    if [ "${1:-}" = "--iex" ]; then iex_dir="$2"; shift 2; fi
    OUT="$T/out.$((PASS + FAIL)).log"
    if [ -n "$iex_dir" ]; then
        # Like "irm ... | iex": no script file, so no $PSScriptRoot/$PSCommandPath
        line="Set-Location $(ps_lit "$iex_dir"); Invoke-Expression ([IO.File]::ReadAllText($(ps_lit "$REPO/install.ps1"))); Write-Host \"STILL-ALIVE exit=\$LASTEXITCODE\""
    else
        line="& $(ps_lit "$REPO/install.ps1")"
        for a in "$@"; do
            case "$a" in
                -*) line="$line $a" ;;
                *) line="$line $(ps_lit "$a")" ;;
            esac
        done
        line="$line; exit \$LASTEXITCODE"
    fi
    printf '. %s\n%s\n' "$(ps_lit "$T/mock.ps1")" "$line" > "$T/run.ps1"
    rm -f "$T/ps-net.log"
    # -File for normal runs; -Command for iex so there is no script path at all
    if [ -n "$iex_dir" ]; then set -- -Command "$(cat "$T/run.ps1")"; else set -- -File "$T/run.ps1"; fi
    printf '%b' "$input" | env -i PATH="/usr/bin:/bin" HOME="$H" TMPDIR="$T" LANG=C.UTF-8 \
        APPDATA="$H/AppData/Roaming" LOCALAPPDATA="$H/AppData/Local" \
        FAKE_ROOT="$T" FAKE_FXAC_ZIP="$T/fixtures/fxac.zip" \
        FAKE_TAG="${FAKE_TAG:-v$VERSION}" FAKE_RELEASE="${FAKE_RELEASE:-$T/fixtures/release-good}" \
        FAKE_API_FAIL="${FAKE_API_FAIL:-}" FAKE_FXAC_FAIL="${FAKE_FXAC_FAIL:-}" \
        "$PWSH" -NoProfile "$@" > "$OUT" 2>&1
    RC=$?
    touch "$T/ps-net.log"
}
NET="$T/ps-net.log"

# shellcheck disable=SC2016  # PowerShell expression
echo "# install.ps1 tests ($("$PWSH" -NoProfile -Command '"PowerShell " + $PSVersionTable.PSVersion'))"

# 1. Fresh install into the install's default profile
new_win fresh
mkdir -p "$L/Profiles/bbbb.Default (release)/startupCache"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "install: exit 0" rc_is 0
check "install: default profile of the install" same "$REPO/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "install: Default=1 profile untouched" missing "$O/chrome"
check "install: junk dirs untouched" missing "$R/Profile Groups/chrome"
check "install: fx-autoconfig config.js in the Zen dir" has "$ZENDIR/config.js" "boot.sys.mjs"
check "install: config-prefs.js in the Zen dir" exists "$ZENDIR/defaults/pref/config-prefs.js"
check "install: loader in chrome/utils" exists "$P/chrome/utils/boot.sys.mjs"
check "install: fx-autoconfig examples not copied" missing "$P/chrome/JS/test.uc.js"
check "install: no userChrome.css / user.js" missing "$P/user.js"
check "install: %LOCALAPPDATA%\\zen\\<Path>\\startupCache cleared" missing "$L/Profiles/bbbb.Default (release)/startupCache"
check "install: themes template" exists "$P/chrome/zenleap-themes.json"
check "install: nothing launched or killed" lacks "$NET" "PROCESS"
show_on_fail 0

# 2. check
ps -Action check
check "check: exit 0 when up to date" rc_is 0
check "check: installed profile" has "$OUT" "Default (release): UP_TO_DATE:$VERSION:$VERSION"
check "check: other profile" has "$OUT" "default-release: NOT_INSTALLED"
FAKE_TAG=v99.0.0 ps -Action check
check "check: exit 1 when outdated" rc_is 1
check "check: OUTDATED line" has "$OUT" "OUTDATED:$VERSION:99.0.0"

# 3. Existing fx-autoconfig config.js is never overwritten; -Profile variants
printf "// customised\nChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs');\n" > "$ZENDIR/config.js"
cp "$ZENDIR/config.js" "$T/ps-config"
ps -Action install -Yes -Profile 2 -ZenPath "$ZENDIR"
check "existing config.js: kept byte-identical" same "$T/ps-config" "$ZENDIR/config.js"
check "-Profile 2: the default profile is #1, so #2 is default-release" exists "$O/chrome/JS/zenleap.uc.js"
ps -Action install -Yes -Profile "DEFAULT (RELEASE)" -ZenPath "$ZENDIR"
check "-Profile <name>: case-insensitive" rc_is 0
rm -rf "$O/chrome/JS"
ps -Action install -Yes -Profile "aaaa.default-release" -ZenPath "$ZENDIR"
check "-Profile <directory name>: works" exists "$O/chrome/JS/zenleap.uc.js"
rm -rf "$O/chrome/JS"
ps -Action install -Yes -AllProfiles -ZenPath "$ZENDIR"
check "-AllProfiles: every profile" exists "$O/chrome/JS/zenleap.uc.js"
ps -Action install -Yes -Profile 5 -ZenPath "$ZENDIR"
check "-Profile 5: rejected" rc_is 1
check "-Profile 5: explains" has "$OUT" "valid: 1-2"

# 4. Uninstall
ps -Action uninstall -Yes -ZenPath "$ZENDIR"
check "uninstall -Yes: removed from both" missing "$P/chrome/JS/zenleap.uc.js"
check "uninstall -Yes: removed from #1 too" missing "$O/chrome/JS/zenleap.uc.js"
check "uninstall -Yes: fx-autoconfig kept without -RemoveFxAutoconfig" exists "$ZENDIR/config.js"
ps -Action install -Yes -ZenPath "$ZENDIR"
ps -Action uninstall -Yes -RemoveFxAutoconfig -ZenPath "$ZENDIR"
check "uninstall -RemoveFxAutoconfig: utils removed" missing "$P/chrome/utils"
check "uninstall -RemoveFxAutoconfig: config.js removed" missing "$ZENDIR/config.js"
ps -Action uninstall -Yes -ZenPath "$ZENDIR"
check "uninstall with nothing installed: exit 0" rc_is 0
check "uninstall with nothing installed: says so" has "$OUT" "not installed in any Zen profile"

# 5. Foreign (Sine) config.js
new_win foreign
printf "ChromeUtils.importESModule('chrome://userscripts/content/sine.sys.mjs');\n" > "$ZENDIR/config.js"
cp "$ZENDIR/config.js" "$T/ps-sine-config"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "Sine's config.js: untouched" same "$T/ps-sine-config" "$ZENDIR/config.js"
check "Sine's config.js: explains" has "$OUT" "starts Sine's bootloader"
check "Sine's config.js, profile without Sine: skipped (exit 1)" rc_is 1
printf "// other autoconfig\n" > "$ZENDIR/config.js"
cp "$ZENDIR/config.js" "$T/ps-other-config"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "other config.js: untouched" same "$T/ps-other-config" "$ZENDIR/config.js"
check "other config.js: warns" has "$OUT" "is not fx-autoconfig's"
check "other config.js: profile part installed" exists "$P/chrome/JS/zenleap.uc.js"
printf "ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs'); // mine\n" > "$ZENDIR/config.js"
cp "$ZENDIR/config.js" "$T/ps-noprefs-config"
rm -rf "$ZENDIR/defaults"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "fx-autoconfig config.js without pref file: config.js kept" same "$T/ps-noprefs-config" "$ZENDIR/config.js"
check "fx-autoconfig config.js without pref file: pref file added" has "$ZENDIR/defaults/pref/config-prefs.js" "general.config.filename"

# 6. Sine-managed profile and Sine-only profile
new_win sine
S="$P/chrome/sine-mods/zenleap-relative-tab-nav"
mkdir -p "$S/JS" "$P/chrome/JS" "$P/chrome/utils"
printf '// @version 3.3.9\n' > "$S/JS/zenleap.uc.js"
: > "$P/chrome/JS/sine.sys.mjs"
printf 'content sine ../sine-mods/\n' > "$P/chrome/utils/chrome.manifest"
ps -Action install -Yes -Profile 1 -ZenPath "$ZENDIR"
check "sine mod: -Yes replaces Sine's copy" same "$REPO/JS/zenleap.uc.js" "$S/JS/zenleap.uc.js"
check "sine mod: no second copy in chrome/JS" missing "$P/chrome/JS/zenleap.uc.js"
check "sine mod: no program files needed" missing "$ZENDIR/config.js"
rm -rf "$P/chrome/sine-mods"
ps -Action install -Yes -Profile 1 -ZenPath "$ZENDIR"
check "sine loader only: exit 1" rc_is 1
check "sine loader only: points to Sine" has "$OUT" "Install ZenLeap from Sine instead"

# 7. Outdated loader and old userChrome.css block
new_win outdated
mkdir -p "$P/chrome/utils"
printf '// @version 0.10.3\n' > "$P/chrome/utils/boot.sys.mjs"
printf '.mine { a: b; }\r\n\r\n/* === ZenLeap Styles === */\r\n.old {}\r\n/* === End ZenLeap Styles === */\r\n.after {}\r\n' > "$P/chrome/userChrome.css"
cp "$P/chrome/userChrome.css" "$T/ps-css"
mkdir -p "$O/chrome"
printf '/* plain */\n' > "$O/chrome/userChrome.css"
cp "$O/chrome/userChrome.css" "$T/ps-css-plain"
ps -Action install -Yes -Profile all -ZenPath "$ZENDIR"
check "old loader (-Yes): left alone" has "$P/chrome/utils/boot.sys.mjs" "0.10.3"
check "old loader (-Yes): says how to update" has "$OUT" "run the installer without -Yes to update it"
ps --stdin '\nn\n' -Action install -Profile 1 -ZenPath "$ZENDIR"
check "old loader (interactive Enter): updated" has "$P/chrome/utils/boot.sys.mjs" "0.10.16"
check "old loader (interactive Enter): backup" has "$P/chrome/utils.zenleap-backup/boot.sys.mjs" "0.10.3"
check "css (CRLF): block removed" lacks "$P/chrome/userChrome.css" ".old"
check "css (CRLF): content before kept" has "$P/chrome/userChrome.css" ".mine { a: b; }"
check "css (CRLF): content after kept" has "$P/chrome/userChrome.css" ".after {}"
check "css: backup" same "$T/ps-css" "$P/chrome/userChrome.css.zenleap-backup"
check "css without markers: untouched" same "$T/ps-css-plain" "$O/chrome/userChrome.css"
check "css: no BOM written" lacks "$P/chrome/userChrome.css" $'\xef\xbb\xbf'

# 8. Zen dir not writable: no elevation with -Yes, commands printed, staged files
new_win readonly
chmod a-w "$ZENDIR"
ps -Action install -Yes -ZenPath "$ZENDIR"
chmod u+w "$ZENDIR"
check "read-only: exit 0" rc_is 0
check "read-only: prints admin commands" has "$OUT" "Run as administrator"
check "read-only: command copies config.js" has "$OUT" "-Destination '$ZENDIR/config.js'"
check "read-only: files staged in LOCALAPPDATA" exists "$H/AppData/Local/zenleap/fx-autoconfig-program/config.js"
check "read-only: 'One more step' summary" has "$OUT" "One more step needed"
check "read-only: no elevation attempted with -Yes" lacks "$NET" "START-PROCESS"
check "read-only: profile part installed" exists "$P/chrome/JS/zenleap.uc.js"
chmod a-w "$ZENDIR"
ps --stdin '\n' -Action install -Profile 1 -ZenPath "$ZENDIR"
chmod u+w "$ZENDIR"
check "read-only interactive: elevation offered and attempted (UAC)" has "$NET" "START-PROCESS powershell.exe RunAs"
check "read-only interactive: falls back to printed commands" has "$OUT" "One more step needed"

# 9. Remote install
new_win remote
ps -Action install -Remote -Yes -ZenPath "$ZENDIR"
check "remote: exit 0" rc_is 0
check "remote: release file installed" same "$T/fixtures/release-good/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "remote: verified" has "$OUT" "SHA-256 verified"
check "remote: from the tag" has "$NET" "ZenLeap/v$VERSION/JS/zenleap.uc.js"
rm -rf "$P/chrome/JS"
FAKE_RELEASE="$T/fixtures/release-badsum" ps -Action install -Remote -Yes -ZenPath "$ZENDIR"
check "remote bad checksum: refused" rc_is 1
check "remote bad checksum: nothing installed" missing "$P/chrome/JS/zenleap.uc.js"
check "remote bad checksum: explains" has "$OUT" "does not match the release's CHECKSUMS.sha256"
FAKE_RELEASE="$T/fixtures/release-badversion" ps -Action install -Remote -Yes -ZenPath "$ZENDIR"
check "remote wrong version: refused" rc_is 1
FAKE_API_FAIL=1 ps -Action install -Remote -Yes -ZenPath "$ZENDIR"
check "remote, API down: redirect fallback works" rc_is 0

# 10. irm | iex: no script path -> release, ignores ./JS in the current dir, keeps the session alive
new_win iex
rm -rf "$O" && sed -i '/^\[Profile0\]/,/^$/d' "$R/profiles.ini"
mkdir -p "$T/iexcwd/JS"
printf '// @version 0.0.0 stray\n' > "$T/iexcwd/JS/zenleap.uc.js"
mkdir -p "$H/AppData/Local/Zen Browser"
: > "$H/AppData/Local/Zen Browser/zen.exe"
ps --stdin 'n\n' --iex "$T/iexcwd"
check "iex: installs the verified release, not ./JS" same "$T/fixtures/release-good/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "iex: finds Zen under LOCALAPPDATA" has "$OUT" "Found Zen Browser at: $H/AppData/Local/Zen Browser"
check "iex: session still alive afterwards" has "$OUT" "STILL-ALIVE exit="
rm -rf "$R"
ps --iex "$T/iexcwd"
check "iex error path: no profiles -> error, session still alive" has "$OUT" "STILL-ALIVE exit=1"

# 11. Interactive profile menu
new_win menu
ps --stdin '\nn\n' -Action install -ZenPath "$ZENDIR"
check "menu: Enter picks the install default" exists "$P/chrome/JS/zenleap.uc.js"
check "menu: other profile untouched" missing "$O/chrome/JS/zenleap.uc.js"
check "menu: marks the default" has "$OUT" "Default (release)  [bbbb.Default (release)]  - default profile"
ps --stdin '7\n2\nn\n' -Action install -ZenPath "$ZENDIR"
check "menu: invalid number re-prompts, then 2" exists "$O/chrome/JS/zenleap.uc.js"
check "menu: invalid number explained" has "$OUT" "Invalid profile number 7"
ps --stdin 'q\n' -Action install -ZenPath "$ZENDIR"
check "menu: q cancels with exit 1" rc_is 1

# 12. Zen running (parent.lock held without sharing): never killed
new_win running
: > "$P/parent.lock"
"$PWSH" -NoProfile -Command "\$fs = [IO.File]::Open('$P/parent.lock', 'Open', 'Read', 'None'); Start-Sleep 60" >/dev/null 2>&1 &
LOCKPID=$!
FAKE_PIDS+=("$LOCKPID")
sleep 3
printf '[Compatibility]\r\nLastVersion=1.22.3b_1/1\r\n' > "$P/compatibility.ini"
mkdir -p "$L/Profiles/bbbb.Default (release)/startupCache"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "running -Yes: still installs" exists "$P/chrome/JS/zenleap.uc.js"
check "running -Yes: InvalidateCaches=1 for the next start" has "$P/compatibility.ini" "InvalidateCaches=1"
check "running -Yes: cache of the running Zen not deleted" exists "$L/Profiles/bbbb.Default (release)/startupCache"
check "running -Yes: reports the running profile" has "$OUT" "Zen is running with: Default (release)"
check "running -Yes: asks for a restart" has "$OUT" "Restart Zen Browser to activate ZenLeap"
check "running -Yes: nothing killed" lacks "$NET" "STOP-PROCESS"
ps --stdin 'q\n' -Action install -Profile 1 -ZenPath "$ZENDIR"
check "running interactive 'q': cancelled" rc_is 1
kill "$LOCKPID" 2>/dev/null
sleep 1
ps -Action install -Yes -ZenPath "$ZENDIR"
check "stale parent.lock (not held): not reported as running" lacks "$OUT" "Zen is running"

# 13. Zen installation from the profile's compatibility.ini; version floor; pin
new_win lastplatform
ZEN2="$T/lastplatform/Other Zen"
mkdir -p "$ZEN2"
: > "$ZEN2/zen.exe"
printf '[App]\r\nVersion=1.20.2b\r\n' > "$ZEN2/application.ini"
printf '[Compatibility]\r\nLastVersion=1.20.2b_1/1\r\nLastPlatformDir=%s\r\n' "$ZEN2" > "$P/compatibility.ini"
rm -f "$ZENDIR/zen.exe"
ps -Action install -Yes
check "LastPlatformDir: fx-autoconfig goes into the Zen that runs the profile" exists "$ZEN2/config.js"
check "LastPlatformDir: warns about a Zen older than the floor" has "$OUT" "older than 1.21.7b"
check "cache: InvalidateCaches=1 added" has "$P/compatibility.ini" "InvalidateCaches=1"
ps -Action install -Yes
check "cache: InvalidateCaches=1 not duplicated" test "$(grep -c InvalidateCaches=1 "$P/compatibility.ini")" = 1
new_win pinned
REPO="$REAL_REPO" ps -Action install -Yes -ZenPath "$ZENDIR"
check "pinned hashes: a different fx-autoconfig archive is refused" rc_is 1
check "pinned hashes: says why" has "$OUT" "does not match the tested version"
check "pinned hashes: downloads the pinned commit" has "$NET" "fx-autoconfig/archive/dfdab5684faffc112b76ccb1d8cab7f75da0102c.zip"
check "pinned hashes: nothing installed" missing "$ZENDIR/config.js"

echo ""
echo "# $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
