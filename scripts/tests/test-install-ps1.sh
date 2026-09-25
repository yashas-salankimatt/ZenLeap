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
# (an argument "@raw:<text>" is passed as PowerShell source, e.g. an array)
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
                @raw:*) line="$line ${a#@raw:}" ;;
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
        FAKE_ROOT="$T" FAKE_FXAC_ZIP="${FAKE_FXAC_ZIP:-$T/fixtures/fxac.zip}" \
        FAKE_TAG="${FAKE_TAG:-v$VERSION}" FAKE_RELEASE="${FAKE_RELEASE:-$T/fixtures/release-good}" \
        FAKE_API_FAIL="${FAKE_API_FAIL:-}" FAKE_FXAC_FAIL="${FAKE_FXAC_FAIL:-}" \
        "$PWSH" -NoProfile "$@" > "$OUT" 2>&1
    RC=$?
    touch "$T/ps-net.log"
}
NET="$T/ps-net.log"

# ps_cmd [--stdin <input>] <PowerShell commands>: run commands (with the mocks)
# the way a user would type them at a prompt: no script file
ps_cmd() {
    local input=""
    if [ "${1:-}" = "--stdin" ]; then input="$2"; shift 2; fi
    OUT="$T/out.$((PASS + FAIL)).log"
    printf '%b' "$input" | env -i PATH="/usr/bin:/bin" HOME="$H" TMPDIR="$T" LANG=C.UTF-8 \
        APPDATA="$H/AppData/Roaming" LOCALAPPDATA="$H/AppData/Local" \
        FAKE_ROOT="$T" FAKE_FXAC_ZIP="$T/fixtures/fxac.zip" \
        FAKE_TAG="${FAKE_TAG:-v$VERSION}" FAKE_RELEASE="${FAKE_RELEASE:-$T/fixtures/release-good}" \
        "$PWSH" -NoProfile -Command ". $(ps_lit "$T/mock.ps1"); $1" > "$OUT" 2>&1
    RC=$?
}

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

# 2. check: "<name> [<profile folder>]: STATUS"
ps -Action check
check "check: exit 0 when up to date" rc_is 0
check "check: installed profile" has "$OUT" "Default (release) [$P]: UP_TO_DATE:$VERSION:$VERSION"
check "check: other profile" has "$OUT" "default-release [$O]: NOT_INSTALLED"
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
rm -rf "$O/chrome/JS" "$P/chrome/JS"
ps -Action install -Yes -Profile "1,aaaa.default-release" -ZenPath "$ZENDIR"
check "-Profile \"1,<name>\" (one string, as powershell -File passes a list): exit 0" rc_is 0
check "... the default profile" exists "$P/chrome/JS/zenleap.uc.js"
check "... and the named one" exists "$O/chrome/JS/zenleap.uc.js"

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
check "Sine's config.js, profile without Sine: skipped (exit 2: nothing installed)" rc_is 2
printf "// other autoconfig\n" > "$ZENDIR/config.js"
cp "$ZENDIR/config.js" "$T/ps-other-config"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "other config.js: untouched" same "$T/ps-other-config" "$ZENDIR/config.js"
check "other config.js: warns" has "$OUT" "loads neither fx-autoconfig nor Sine"
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
check "sine mod (-Yes): Sine's copy left to Sine" has "$S/JS/zenleap.uc.js" "3.3.9"
check "sine mod (-Yes): names the override" has "$OUT" "-Loader sine replaces Sine's copy"
check "sine mod (-Yes): nothing installed, exit 2" rc_is 2
ps -Action install -Yes -Loader sine -Profile 1 -ZenPath "$ZENDIR"
check "sine mod (-Loader sine): replaces Sine's copy" same "$REPO/JS/zenleap.uc.js" "$S/JS/zenleap.uc.js"
check "sine mod: no second copy in chrome/JS" missing "$P/chrome/JS/zenleap.uc.js"
check "sine mod: no program files needed" missing "$ZENDIR/config.js"
printf '// @version 3.3.9\n' > "$S/JS/zenleap.uc.js"
ps --stdin 'y\nn\n' -Action install -Profile 1 -ZenPath "$ZENDIR"
check "sine mod (interactive 'y'): Sine's copy replaced" same "$REPO/JS/zenleap.uc.js" "$S/JS/zenleap.uc.js"
rm -rf "$P/chrome/sine-mods"
ps -Action install -Yes -Profile 1 -ZenPath "$ZENDIR"
check "sine loader only: exit 2" rc_is 2
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

# 14. irm | iex leaves the caller's session as it was: $PROFILE, the error
#     preference, variables named like the parameters, TLS setting, and no
#     helper functions or variables left behind
new_win scope
rm -rf "$O" && sed -i '/^\[Profile0\]/,/^$/d' "$R/profiles.ini"
mkdir -p "$T/scopecwd" "$H/AppData/Local/Zen Browser"
: > "$H/AppData/Local/Zen Browser/zen.exe"
SCOPE_CMD="\$before = \"\$PROFILE\"; \$eap = \"\$ErrorActionPreference\"
\$Yes = 'mine-yes'; \$Action = 'mine-action'; \$ZenPath = 'mine-zp'; \$Remote = 'mine-remote'
\$tls = [Net.ServicePointManager]::SecurityProtocol
Set-Location $(ps_lit "$T/scopecwd")
Invoke-Expression ([IO.File]::ReadAllText($(ps_lit "$REPO/install.ps1")))
\"EXIT=\$LASTEXITCODE\"
\"PROFILE-SAME=\$(\"\$PROFILE\" -eq \$before)\"
\"EAP-SAME=\$(\"\$ErrorActionPreference\" -eq \$eap)\"
\"VARS-SAME=\$(\$Yes -eq 'mine-yes' -and \$Action -eq 'mine-action' -and \$ZenPath -eq 'mine-zp' -and \$Remote -eq 'mine-remote')\"
\"TLS-SAME=\$([Net.ServicePointManager]::SecurityProtocol -eq \$tls)\"
\"LEAKED-FUNCTIONS=\$(@(Get-Command Stop-Installer, Invoke-Main, Get-SourceDir, Write-Status -ErrorAction SilentlyContinue).Count)\"
\"LEAKED-VARS=\$(@(Get-Variable ZL, ZLAction, ZLYes, ZLProfile, ZLZenPath, exitCode, __zenleapExitCode, __zenleapExit, GitHubRepo, FxPinnedSha256, ScriptDir -ErrorAction SilentlyContinue).Count)\""
ps_cmd --stdin 'n\n' "$SCOPE_CMD"
check "iex (success): installed" same "$T/fixtures/release-good/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "iex (success): \$PROFILE unchanged" has "$OUT" "PROFILE-SAME=True"
check "iex (success): \$ErrorActionPreference unchanged" has "$OUT" "EAP-SAME=True"
check "iex (success): the caller's \$Yes/\$Action/\$ZenPath/\$Remote unchanged" has "$OUT" "VARS-SAME=True"
check "iex (success): exit code 0 in \$LASTEXITCODE" has "$OUT" "EXIT=0"
check "iex (success): TLS setting restored" has "$OUT" "TLS-SAME=True"
check "iex (success): no helper functions left" has "$OUT" "LEAKED-FUNCTIONS=0"
check "iex (success): no installer variables left" has "$OUT" "LEAKED-VARS=0"
rm -rf "$R"
ps_cmd "$SCOPE_CMD"
check "iex (error): exit code in \$LASTEXITCODE" has "$OUT" "EXIT=1"
check "iex (error): \$PROFILE unchanged" has "$OUT" "PROFILE-SAME=True"
check "iex (error): \$ErrorActionPreference unchanged" has "$OUT" "EAP-SAME=True"
check "iex (error): the caller's variables unchanged" has "$OUT" "VARS-SAME=True"
check "iex (error): no helper functions left" has "$OUT" "LEAKED-FUNCTIONS=0"
check "iex (error): no installer variables left" has "$OUT" "LEAKED-VARS=0"
new_win sbcheck
ps -Action install -Yes -ZenPath "$ZENDIR"
ps_cmd "& ([scriptblock]::Create([IO.File]::ReadAllText($(ps_lit "$REPO/install.ps1")))) -Action check; \"EXIT=\$LASTEXITCODE\""
check "scriptblock one-liner with options: -Action check works" has "$OUT" "Default (release) [$P]: UP_TO_DATE"
check "scriptblock one-liner with options: session kept, exit code 0" has "$OUT" "EXIT=0"

# 15. -Profile takes several values of any kind; -ProfileDir too
new_win multi
ps -Action install -Yes -Profile "@raw:'Default (release)',2" -ZenPath "$ZENDIR"
check "-Profile <name>,<n>: exit 0" rc_is 0
check "-Profile <name>,<n>: the named profile" exists "$P/chrome/JS/zenleap.uc.js"
check "-Profile <name>,<n>: the numbered one" exists "$O/chrome/JS/zenleap.uc.js"
mk_profile "$H" "adhoc1"
mk_profile "$H" "adhoc2"
ps -Action install -Yes -ProfileDir "@raw:$(ps_lit "$H/adhoc1"),$(ps_lit "$H/adhoc2")" -ZenPath "$ZENDIR"
check "-ProfileDir <a>,<b>: the first" exists "$H/adhoc1/chrome/JS/zenleap.uc.js"
check "-ProfileDir <a>,<b>: the second" exists "$H/adhoc2/chrome/JS/zenleap.uc.js"

# 16. profiles.ini the way Firefox reads it
new_win ini
printf '[Profile0]\r\nName=default-release\r\n  IsRelative=1\r\nPath=Profiles/aaaa.default-release\r\nDefault=1\r\n\r\n[Profile1] \r\n; a comment\r\nName=Default (release)\r\nIsRelative=1\r\nPath=Profiles/bbbb.Default (release)\r\n' > "$R/profiles.ini"
rm -f "$R/installs.ini"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "'[Profile1] ', indented key, comment: Profile0 (Default=1) is the default" exists "$O/chrome/JS/zenleap.uc.js"
check "... Profile1 not taken for the default" missing "$P/chrome/JS/zenleap.uc.js"
ps -Action check
check "... Profile1 is listed" has "$OUT" "Default (release) [$P]: NOT_INSTALLED"
printf '[Profile0]\nName=default-release\nIsRelative=1\nPath=Profiles/aaaa.default-release\n[Profile1]x\nName=Default (release)\nIsRelative=1\nPath=Profiles/bbbb.Default (release)\nDefault=1\n' > "$R/profiles.ini"
ps -Action check
check "malformed '[Profile1]x': its keys ignored (as by Zen)" lacks "$OUT" "Default (release) ["

# 17. The loader that runs a profile decides, not stray Sine files
new_win loaders
ps -Action install -Yes -ZenPath "$ZENDIR"
rm -f "$P/chrome/JS/zenleap.uc.js"
mkdir -p "$P/chrome/sine-mods"
echo '{}' > "$P/chrome/sine-mods/mods.json"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "fx-autoconfig + a leftover Sine mods.json: installs into chrome\\JS" exists "$P/chrome/JS/zenleap.uc.js"
S="$P/chrome/sine-mods/zenleap-relative-tab-nav/JS"
mkdir -p "$S"
printf '// @version 3.3.0\n' > "$S/zenleap.uc.js"
: > "$P/chrome/JS/sine.sys.mjs"
rm -f "$P/chrome/JS/zenleap.uc.js"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "Sine (on fx-autoconfig) manages ZenLeap, -Yes: exit 2" rc_is 2
check "... Sine's copy left alone" has "$S/zenleap.uc.js" "3.3.0"
check "... nothing in chrome\\JS" missing "$P/chrome/JS/zenleap.uc.js"
ps -Action install -Yes -Loader fx-autoconfig -ZenPath "$ZENDIR"
check "-Loader fx-autoconfig: into chrome\\JS anyway" exists "$P/chrome/JS/zenleap.uc.js"
check "-Loader fx-autoconfig: warns about loading twice" has "$OUT" "doesn't load twice"
rm -f "$P/chrome/JS/zenleap.uc.js" "$P/chrome/JS/sine.sys.mjs"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "Sine copy left over (Sine doesn't start): into chrome\\JS" exists "$P/chrome/JS/zenleap.uc.js"
check "... says the Sine copy is unused" has "$OUT" "left over from Sine"
new_win foreignutils
mkdir -p "$P/chrome/utils"
printf 'content other ./\n' > "$P/chrome/utils/chrome.manifest"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "chrome\\utils of another loader: skipped, exit 2" rc_is 2
check "... nothing in chrome\\JS" missing "$P/chrome/JS/zenleap.uc.js"
ps -Action install -Yes -Loader fx-autoconfig -ZenPath "$ZENDIR"
check "-Loader fx-autoconfig + another loader: copied, exit 0" rc_is 0
check "... says it will not load yet" has "$OUT" "chrome\\utils is not fx-autoconfig's loader"
check "... no 'Installation Complete!'" lacks "$OUT" "Installation Complete!"
check "... chrome\\utils untouched" has "$P/chrome/utils/chrome.manifest" "content other"

# 18. -Yes without -Profile: update where ZenLeap is, else the default
new_win onlyother
mkdir -p "$O/chrome/JS"
printf '// @version 3.3.0\n' > "$O/chrome/JS/zenleap.uc.js"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "update -Yes: the profile with ZenLeap is updated" same "$REPO/JS/zenleap.uc.js" "$O/chrome/JS/zenleap.uc.js"
check "update -Yes: not added to the default profile" missing "$P/chrome/JS/zenleap.uc.js"

# 19. -ZenPath and -ProfileDir must point to Zen and to a profile
new_win badpaths
mkdir -p "$T/badpaths/notzen"
ps -Action install -Yes -ZenPath "$T/badpaths/notzen"
check "-ZenPath to a folder without Zen, -Yes: refused" rc_is 1
check "... explains" has "$OUT" "does not look like a Zen installation directory"
check "... no config.js there" missing "$T/badpaths/notzen/config.js"
ps --stdin 'n\n' -Action install -ZenPath "$T/badpaths/notzen"
check "-ZenPath without Zen, interactive 'n': refused" rc_is 1
ps -Action install -Yes -ProfileDir "$H" -ZenPath "$ZENDIR"
check "-ProfileDir <home>, -Yes: refused" rc_is 1
check "... explains" has "$OUT" "does not look like a Zen profile"
check "... no chrome folder there" missing "$H/chrome"

# 20. Leftovers of older versions
new_win leftovers
ps -Action install -Yes -ZenPath "$ZENDIR"
cp "$P/chrome/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js.bak"
: > "$P/chrome/JS/zenleap.uc.js.part"
mkdir -p "$P/chrome/CSS"
cp "$FXAC_TREE/profile/chrome/JS/test.uc.js" "$P/chrome/JS/"
cp "$FXAC_TREE/profile/chrome/CSS/agent_style.uc.css" "$P/chrome/CSS/"
printf 'console.log("mine");\n' > "$P/chrome/JS/mine.uc.js"
G="$R/Profiles/not-a-profile"
mkdir -p "$G/chrome/JS"
cp "$REPO/JS/zenleap.uc.js" "$G/chrome/JS/"
printf 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);\n' > "$G/user.js"
ps -Action install -Yes -Profile 1 -ZenPath "$ZENDIR"
check "leftovers (-Yes): examples listed" has "$OUT" "test.uc.js"
check "leftovers (-Yes): the non-profile folder listed" has "$OUT" "not-a-profile"
check "leftovers (-Yes): the user's own script not listed" lacks "$OUT" "mine.uc.js"
check "leftovers (-Yes): nothing removed" exists "$P/chrome/JS/test.uc.js"
ps --stdin 'y\nn\n' -Action install -Profile 1 -ZenPath "$ZENDIR"
check "leftovers (interactive 'y'): example script removed" missing "$P/chrome/JS/test.uc.js"
check "... example CSS and its empty folder removed" missing "$P/chrome/CSS"
check "... the user's own script kept" exists "$P/chrome/JS/mine.uc.js"
check "... the non-profile folder's chrome removed" missing "$G/chrome"
check "... its user.js with only the old pref removed" missing "$G/user.js"
ps -Action uninstall -Yes -ZenPath "$ZENDIR"
check "uninstall: the updater's zenleap.uc.js.bak removed" missing "$P/chrome/JS/zenleap.uc.js.bak"
check "uninstall: a partial update download removed" missing "$P/chrome/JS/zenleap.uc.js.part"
printf '/* === ZenLeap Styles === */\r\n.x{}\r\n/* === End ZenLeap Styles === */\r\n' > "$P/chrome/userChrome.css"
ps -Action install -Yes -Profile 1 -ZenPath "$ZENDIR"
check "userChrome.css with only ZenLeap's block: removed" missing "$P/chrome/userChrome.css"
check "... backup kept" has "$P/chrome/userChrome.css.zenleap-backup" ".x{}"

# 21. fx-autoconfig verification counts hidden files; exactly the verified
#     files are copied
new_win fxhidden
rm -rf "$T/fxh"
mkdir -p "$T/fxh"
cp -a "$FXAC_TREE" "$T/fxh/"
printf 'evil\n' > "$T/fxh/$(basename "$FXAC_TREE")/profile/chrome/utils/.hidden.mjs"
zip_tree "$T/fixtures/fxac-hidden.zip" "$T/fxh" "$(basename "$FXAC_TREE")"
FAKE_FXAC_ZIP="$T/fixtures/fxac-hidden.zip" ps -Action install -Yes -ZenPath "$ZENDIR"
check "archive with a hidden chrome/utils file: refused" rc_is 1
check "... names it" has "$OUT" "unexpected file: profile/chrome/utils/.hidden.mjs"
check "... no loader installed" missing "$P/chrome/utils"
ps -Action install -Yes -ZenPath "$ZENDIR"
# shellcheck disable=SC2012  # plain file names
check "verified loader: exactly the pinned files in chrome\\utils" \
    test "$(ls -A "$P/chrome/utils" | tr '\n' ' ')" = "boot.sys.mjs chrome.manifest fs.sys.mjs module_loader.mjs uc_api.sys.mjs utils.sys.mjs "

# 22. -RemoveFxAutoconfig keeps fx-autoconfig that other scripts need
new_win fxusers
ps -Action install -Yes -ZenPath "$ZENDIR"
echo '// other' > "$P/chrome/JS/zenripple_agent.uc.js"
ps -Action uninstall -Yes -RemoveFxAutoconfig -ZenPath "$ZENDIR"
check "-RemoveFxAutoconfig, another script in the profile: loader kept" exists "$P/chrome/utils/boot.sys.mjs"
check "... names the script" has "$OUT" "zenripple_agent.uc.js"
check "... config.js kept" exists "$ZENDIR/config.js"
rm -f "$P/chrome/JS/zenripple_agent.uc.js"
ps -Action install -Yes -Profile all -ZenPath "$ZENDIR"
ps -Action uninstall -Yes -RemoveFxAutoconfig -Profile 1 -ZenPath "$ZENDIR"
check "-RemoveFxAutoconfig, ZenLeap still in another profile: config.js kept" exists "$ZENDIR/config.js"
check "... this profile's loader removed" missing "$P/chrome/utils"
ps -Action uninstall -Yes -RemoveFxAutoconfig -ZenPath "$ZENDIR"
check "-RemoveFxAutoconfig, the last user: config.js removed" missing "$ZENDIR/config.js"

# 23. A config.js that cannot load ZenLeap: no "Installation Complete!"
new_win foreignsum
printf 'Components.utils.import("chrome://userchromejs/content/boot.jsm");\n' > "$ZENDIR/config.js"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "old/foreign config.js: installed, exit 0" rc_is 0
check "... no 'Installation Complete!'" lacks "$OUT" "Installation Complete!"
check "... says what keeps it from loading" has "$OUT" "does not load fx-autoconfig"

# 24. A release that fails verification: what happened and what to do
new_win unverified
FAKE_RELEASE="$T/fixtures/release-badsum" ps -Action install -Remote -Yes -ZenPath "$ZENDIR"
check "unverified release: exit 1" rc_is 1
check "... names the release" has "$OUT" "ZenLeap v$VERSION, the latest release, could not be verified"
check "... says nothing was installed and whose problem it is" has "$OUT" "Nothing was installed. This is a problem with that release on GitHub"
check "... makes no promise about a fixed release" lacks "$OUT" "on its way"
check "... the clone commands" has "$OUT" "git clone --depth 1 https://github.com/yashas-salankimatt/ZenLeap.git"
check "... how to run it there, with this run's options (not -Remote)" has "$OUT" "powershell -ExecutionPolicy Bypass -File .\\install.ps1 -ZenPath '$ZENDIR' -Yes"
FAKE_RELEASE="$T/fixtures/release-badsum" ps -Action install -Remote -Yes -Profile "Default (release)" -Loader fx-autoconfig -ZenPath "$ZENDIR"
check "unverified release: values quoted as PowerShell literals" has "$OUT" "-File .\\install.ps1 -Profile 'Default (release)' -ZenPath '$ZENDIR' -Loader fx-autoconfig -Yes"
check "... nothing installed" missing "$P/chrome"
FAKE_RELEASE="$T/fixtures/no-such-release" ps -Action install -Remote -Yes -ZenPath "$ZENDIR"
check "download failure: not blamed on the release" lacks "$OUT" "git clone"
check "download failure: suggests checking the connection" has "$OUT" "Check your internet connection"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "from a clone: installs the clone's own file without a release" same "$REPO/JS/zenleap.uc.js" "$P/chrome/JS/zenleap.uc.js"
check "from a clone: no release lookup" lacks "$NET" "releases/latest"

# 25. The autoconfig file Zen really runs decides (same rules as install.sh and
#     the ZenRipple installer)
new_win autoconfig
mkdir -p "$ZENDIR/defaults/pref"
printf 'pref("general.config.filename", "mozilla.cfg");\r\n' > "$ZENDIR/defaults/pref/autoconfig.js"
printf 'lockPref("browser.x", 1);\r\n' > "$ZENDIR/mozilla.cfg"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "enterprise mozilla.cfg: no config.js added" missing "$ZENDIR/config.js"
check "... names the file Zen runs" has "$OUT" "mozilla.cfg (general.config.filename in"
check "... no 'Installation Complete!'" lacks "$OUT" "Installation Complete!"
rm -f "$ZENDIR/mozilla.cfg" "$ZENDIR/defaults/pref/autoconfig.js"
printf "ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs');\n" > "$ZENDIR/config.js"
printf 'pref("general.config.filename", "config.js");\n' > "$ZENDIR/defaults/pref/config-prefs.js"
mkdir -p "$ZENDIR/browser/defaults/preferences"
printf 'pref("general.config.filename", "");\n' > "$ZENDIR/browser/defaults/preferences/zz-off.js"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "browser\\defaults\\preferences switches autoconfig off: reported" has "$OUT" "autoconfig switched off"
rm -rf "$ZENDIR/browser"
printf 'pref("general.config.filename", "other.cfg");\n' > "$ZENDIR/defaults/pref/a-first.js"
: > "$ZENDIR/other.cfg"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "the alphabetically first pref file wins" has "$OUT" "other.cfg (general.config.filename in"
mv "$ZENDIR/defaults/pref/a-first.js" "$ZENDIR/defaults/pref/z-last.js"
ps -Action install -Yes -ZenPath "$ZENDIR"
check "a later pref file loses" has "$OUT" "fx-autoconfig is set up"

echo ""
echo "# $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
