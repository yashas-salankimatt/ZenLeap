#!/bin/bash
# ZenLeap Installer/Uninstaller (macOS and Linux)
# Usage: ./install.sh [install|uninstall|check] [OPTIONS]
#
# Options:
#   --remote                Install the latest ZenLeap release from GitHub (verified against the
#                           release's CHECKSUMS.sha256) instead of the files next to this script
#   --profile <sel>         Profile(s) to use: a number from the list, a profile name, or "all"
#   --profile-dir <dir>     Use this profile directory (e.g. one you start with `zen -profile <dir>`)
#   --yes, -y               Don't ask questions (non-interactive mode)
#   --remove-fxautoconfig   Also remove fx-autoconfig during uninstall
#   --zen-path <dir>        Zen Browser installation directory (the folder containing the zen
#                           binary; on macOS the Zen.app bundle)
#
# Without --profile, the installer uses the profile Zen opens by default plus every profile
# that already has ZenLeap; interactive runs show the list and let you change the choice.
#
# What it does:
# 1. Installs fx-autoconfig if needed (and offers to update an outdated one)
# 2. Installs ZenLeap into <profile>/chrome/JS/
# 3. Clears the startup cache
# It never closes Zen for you: Zen loads ZenLeap at startup, so quit Zen first or restart it after.
#
# Non-interactive examples:
#   ./install.sh install --remote --yes
#   ./install.sh install --profile 2 --yes
#   ./install.sh uninstall --profile all --yes --remove-fxautoconfig

set -e

# Colors for output (use $'...' for proper escape interpretation)
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m' # No Color

# Pre-scan for non-interactive flags (needed before tty setup)
_NON_INTERACTIVE=false
for _arg in "$@"; do
    case "$_arg" in
        --yes|-y) _NON_INTERACTIVE=true ;;
        --help|-h) _NON_INTERACTIVE=true ;;
        check|--check) _NON_INTERACTIVE=true ;;
    esac
done

# Open /dev/tty for interactive input (needed when piped from curl)
# This must happen early, before any functions try to read
if [ "$_NON_INTERACTIVE" = true ]; then
    # Non-interactive mode: no tty needed, set fd 3 to /dev/null
    exec 3</dev/null
elif [ -t 0 ]; then
    # stdin is a terminal, use it directly
    exec 3<&0
else
    # stdin is a pipe (e.g., curl | bash), open /dev/tty
    if [ -e /dev/tty ] && { exec 3</dev/tty; } 2>/dev/null; then
        :
    else
        echo "Error: No terminal available for interactive input"
        echo "Try using --yes (-y) for non-interactive mode"
        echo "Or download and run the script directly:"
        echo "  curl -sfLO https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.sh"
        echo "  bash install.sh"
        exit 1
    fi
fi

# Configuration
GITHUB_REPO="yashas-salankimatt/ZenLeap"
ZENLEAP_RAW_BASE="https://raw.githubusercontent.com/$GITHUB_REPO"
ZENLEAP_LATEST_API="https://api.github.com/repos/$GITHUB_REPO/releases/latest"
ZENLEAP_LATEST_PAGE="https://github.com/$GITHUB_REPO/releases/latest"
FXAUTOCONFIG_REPO="https://github.com/MrOtherGuy/fx-autoconfig/archive/refs/heads/master.zip"

# Directory holding this script's checkout. Empty when the script is piped
# (curl | bash): then there are no local files, even if the current directory
# happens to contain some.
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
    SCRIPT_DIR=""
fi

# Flags
USE_REMOTE=false
PROFILE_SPEC=""
PROFILE_DIR_ARG=""
AUTO_YES=false
REMOVE_FXAUTOCONFIG=false
IS_FLATPAK=false
CUSTOM_ZEN_PATH=""

# State
OS=""
ZEN_RESOURCES=""
WORK_DIR=""
SOURCE_DIR=""
FXAC_SRC=""
FXAC_VERSION=""
FXAC_FAILED=false
FXAC_PROGRAM_PENDING=false
FXAC_PROGRAM_CMDS=""
ZEN_WAS_RUNNING=false
ZEN_NEEDS_RESTART=false
INSTALLED_COUNT=0
QUIET=false

# >>> zen-paths.sh (generated from scripts/lib/zen-paths.sh by scripts/sync-lib.sh; edit it there)
# zen-paths.sh - Zen Browser profile discovery shared by ZenLeap's shell scripts.
#
# This file is the single source of truth. install.sh and
# "ZenLeap Manager.app/Contents/MacOS/ZenLeapManager" carry an embedded copy
# (between the ">>> zen-paths.sh" / "<<< zen-paths.sh" marker lines) so they
# keep working when downloaded on their own (curl | bash, the .app bundle);
# install-plugin.sh and clean-legacy-css.sh source this file. After editing it,
# run scripts/sync-lib.sh (scripts/check-release.sh fails if a copy is stale).
#
# Keep it compatible with bash 3.2 (macOS /bin/bash): no associative arrays,
# no mapfile, no ${var,,}, no namerefs. Callers may use `set -e`, so functions
# must not end on a failing `[ ... ] && ...` list.
#
# Where Zen keeps profiles (verified against Zen 1.22.3b / Firefox 156):
#   Linux    The legacy root ~/.zen is used when MOZ_LEGACY_HOME=1, or when
#            ~/.zen or ~/zen exists (Zen builds with MOZ_USER_DIR "zen");
#            otherwise $XDG_CONFIG_HOME/zen (relative values are ignored,
#            default ~/.config/zen). Profiles sit directly in the root.
#            Local data (startupCache) lives in ${XDG_CACHE_HOME:-~/.cache}/zen.
#   Flatpak  ~/.var/app/app.zen_browser.zen/.zen (persisted legacy root) or
#            ~/.var/app/app.zen_browser.zen/config/zen; local data in
#            ~/.var/app/app.zen_browser.zen/cache/zen.
#   macOS    ~/Library/Application Support/zen (profiles in Profiles/);
#            local data in ~/Library/Caches/zen.
# profiles.ini lists the profiles. The profile Zen opens by default is the
# install's [Install*] Default= entry (profiles.ini / installs.ini), which is
# not necessarily the profile marked Default=1.

ZP_FLATPAK_ID="app.zen_browser.zen"
ZP_SINE_MOD_ID="zenleap-relative-tab-nav"

# Print $1 if it is an absolute path, else $2 (the XDG spec says relative
# values must be ignored, and Firefox does so).
zp_xdg_dir() {
    case "$1" in
        /*) printf '%s\n' "$1" ;;
        *) printf '%s\n' "$2" ;;
    esac
}

# The profile root a native (non-Flatpak) Linux Zen uses.
zp_linux_rule_root() {
    case "${MOZ_LEGACY_HOME:-}" in
        1*) printf '%s\n' "$HOME/.zen"; return 0 ;;
    esac
    if [ -e "$HOME/.zen" ] || [ -e "$HOME/zen" ]; then
        printf '%s\n' "$HOME/.zen"
    else
        printf '%s/zen\n' "$(zp_xdg_dir "${XDG_CONFIG_HOME:-}" "$HOME/.config")"
    fi
}

# zp__in_list <needle> <items...>
zp__in_list() {
    local needle="$1" item
    shift
    for item in "$@"; do
        if [ "$item" = "$needle" ]; then return 0; fi
    done
    return 1
}

# Physical path of an existing directory (symlinks resolved), else empty.
zp__physical_dir() {
    (cd "$1" 2>/dev/null && pwd -P) || true
}

# Candidate profile roots, the one Zen uses first. Sets ZP_ROOT_CANDIDATES and
# ZP_CACHE_ROOT. Usage: zp_candidate_roots <native|flatpak>
zp_candidate_roots() {
    local c
    ZP_ROOT_CANDIDATES=()
    if [ "$(uname -s)" = "Darwin" ]; then
        ZP_ROOT_CANDIDATES=("$HOME/Library/Application Support/zen")
        ZP_CACHE_ROOT="$HOME/Library/Caches/zen"
    elif [ "$1" = "flatpak" ]; then
        ZP_ROOT_CANDIDATES=("$HOME/.var/app/$ZP_FLATPAK_ID/.zen" "$HOME/.var/app/$ZP_FLATPAK_ID/config/zen")
        ZP_CACHE_ROOT="$HOME/.var/app/$ZP_FLATPAK_ID/cache/zen"
    else
        for c in "$(zp_linux_rule_root)" "$HOME/.zen" \
                 "$(zp_xdg_dir "${XDG_CONFIG_HOME:-}" "$HOME/.config")/zen" "$HOME/.config/zen"; do
            if ! zp__in_list "$c" "${ZP_ROOT_CANDIDATES[@]}"; then ZP_ROOT_CANDIDATES+=("$c"); fi
        done
        ZP_CACHE_ROOT="$(zp_xdg_dir "${XDG_CACHE_HOME:-}" "$HOME/.cache")/zen"
    fi
}

zp_reset() {
    ZP_ROOT=""
    ZP_ERROR=""
    ZP_DEFAULT=-1
    ZP_PROFILE_DIRS=()
    ZP_PROFILE_NAMES=()
    ZP_PROFILE_LOCAL=()
    ZP_PROFILE_ROOT=()
    ZP_PROFILE_RAW=()
    ZP_SELECTED=()
}

# zp__add_profile <dir> <name> <local-dir> <root> <raw-path>
zp__add_profile() {
    if [ ! -d "$1" ]; then return 0; fi   # listed in profiles.ini but deleted
    if zp__in_list "$1" "${ZP_PROFILE_DIRS[@]}"; then return 0; fi
    ZP_PROFILE_DIRS+=("$1")
    ZP_PROFILE_NAMES+=("$2")
    ZP_PROFILE_LOCAL+=("$3")
    ZP_PROFILE_ROOT+=("$4")
    ZP_PROFILE_RAW+=("$5")
}

# Print an INI file without CRs, followed by a sentinel section header so the
# last section gets flushed by the parse loops below.
zp__ini_lines() {
    tr -d '\r' < "$1"
    printf '\n[]\n'
}

# Parse <root>/profiles.ini and append its profiles; sets ZP__ROOT_DEFAULT to
# the index of the profile this root starts by default (-1 if none).
# Usage: zp__parse_root <root> <cache-root> [app-dir]
zp__parse_root() {
    local root="$1" cache_root="$2" app_dir="$3"
    local line section="" name="" path="" rel=1 isdef="" flagged="" want have i
    local first=${#ZP_PROFILE_DIRS[@]}
    local defaults=() matches=()
    ZP__ROOT_DEFAULT=-1

    while IFS= read -r line; do
        case "$line" in
            \[*\])
                case "$section" in
                    Profile[0-9]*)
                        if [ -n "$path" ]; then
                            if [ "$rel" = "0" ]; then
                                zp__add_profile "$path" "${name:-${path##*/}}" "$path" "$root" "$path"
                            else
                                zp__add_profile "$root/$path" "${name:-${path##*/}}" "$cache_root/$path" "$root" "$path"
                            fi
                            if [ -n "$isdef" ]; then flagged=$path; fi
                        fi ;;
                esac
                section=${line#\[}; section=${section%\]}
                name=""; path=""; rel=1; isdef="" ;;
            Name=*) name=${line#Name=} ;;
            Path=*) path=${line#Path=} ;;
            IsRelative=*) rel=${line#IsRelative=} ;;
            Default=*)
                case "$section" in
                    Profile[0-9]*) if [ "${line#Default=}" = "1" ]; then isdef=1; fi ;;
                    General|BackgroundTasksProfiles) ;;
                    *) defaults+=("${line#Default=}") ;;   # [Install<hash>]
                esac ;;
        esac
    done < <(zp__ini_lines "$root/profiles.ini")

    # installs.ini ([<hash>] Default=) mirrors the [Install*] sections.
    if [ -f "$root/installs.ini" ]; then
        section=""
        while IFS= read -r line; do
            case "$line" in
                \[*\]) section=${line#\[}; section=${section%\]} ;;
                Default=*) if [ -n "$section" ]; then defaults+=("${line#Default=}"); fi ;;
            esac
        done < <(zp__ini_lines "$root/installs.ini")
    fi

    # The install's default profile wins over the legacy Default=1 marker.
    for want in "${defaults[@]}"; do
        for ((i = first; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
            if [ "${ZP_PROFILE_RAW[$i]}" = "$want" ] && ! zp__in_list "$i" "${matches[@]}"; then
                matches+=("$i")
            fi
        done
    done
    if [ ${#matches[@]} -gt 1 ] && [ -n "$app_dir" ]; then
        # Several Zen installs share this root: prefer the profile that the
        # install in app_dir ran last (compatibility.ini LastPlatformDir).
        want=$(zp__physical_dir "$app_dir")
        for i in "${matches[@]}"; do
            have=$(sed -n 's/^LastPlatformDir=//p' "${ZP_PROFILE_DIRS[$i]}/compatibility.ini" 2>/dev/null | tr -d '\r' | head -n 1)
            if [ -n "$want" ] && [ -n "$have" ] && [ "$(zp__physical_dir "$have")" = "$want" ]; then
                ZP__ROOT_DEFAULT=$i
                return 0
            fi
        done
    fi
    if [ ${#matches[@]} -gt 0 ]; then
        ZP__ROOT_DEFAULT=${matches[0]}
        return 0
    fi
    for ((i = first; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
        if [ -n "$flagged" ] && [ "${ZP_PROFILE_RAW[$i]}" = "$flagged" ]; then
            ZP__ROOT_DEFAULT=$i
            return 0
        fi
    done
    if [ ${#ZP_PROFILE_DIRS[@]} -gt "$first" ]; then ZP__ROOT_DEFAULT=$first; fi
    return 0
}

# Find Zen profiles. Lists the profiles of every candidate root that has a
# profiles.ini (the root Zen uses first); without any profiles.ini it falls
# back to directories that contain prefs.js or times.json.
# Usage: zp_discover <native|flatpak> [app-dir]
# Sets: ZP_ROOT (root in use), ZP_PROFILE_DIRS[], ZP_PROFILE_NAMES[],
#       ZP_PROFILE_LOCAL[] (local dir holding startupCache), ZP_PROFILE_ROOT[],
#       ZP_DEFAULT (index of the profile Zen opens by default, -1 if unknown).
# Returns 1 and sets ZP_ERROR when nothing is found.
zp_discover() {
    local mode="${1:-native}" app_dir="${2:-}" root d base
    zp_reset
    zp_candidate_roots "$mode"
    for root in "${ZP_ROOT_CANDIDATES[@]}"; do
        if [ ! -f "$root/profiles.ini" ]; then continue; fi
        zp__parse_root "$root" "$ZP_CACHE_ROOT" "$app_dir"
        if [ -z "$ZP_ROOT" ] && [ "$ZP__ROOT_DEFAULT" -ge 0 ]; then
            ZP_ROOT=$root
            ZP_DEFAULT=$ZP__ROOT_DEFAULT
        fi
    done
    if [ ${#ZP_PROFILE_DIRS[@]} -eq 0 ]; then
        for root in "${ZP_ROOT_CANDIDATES[@]}"; do
            if [ ! -d "$root" ]; then continue; fi
            base=$root
            if [ "$(uname -s)" = "Darwin" ]; then base="$root/Profiles"; fi
            for d in "$base"/*/; do
                d=${d%/}
                if [ -f "$d/prefs.js" ] || [ -f "$d/times.json" ]; then
                    zp__add_profile "$d" "${d##*/}" "$ZP_CACHE_ROOT/${d#"$root"/}" "$root" "${d#"$root"/}"
                fi
            done
            if [ ${#ZP_PROFILE_DIRS[@]} -gt 0 ]; then
                ZP_ROOT=$root
                break
            fi
        done
        if [ ${#ZP_PROFILE_DIRS[@]} -eq 1 ]; then ZP_DEFAULT=0; fi
    fi
    if [ ${#ZP_PROFILE_DIRS[@]} -eq 0 ]; then
        ZP_ERROR="No Zen profiles found in: ${ZP_ROOT_CANDIDATES[*]}"
        return 1
    fi
    return 0
}

# Select one explicit profile directory (e.g. one started with
# `zen -profile <dir>`). A directory that zp_discover already found keeps its
# name and local dir; any other directory is added with itself as local dir,
# which is what Firefox does for -profile. Sets ZP_SELECTED.
zp_use_profile_dir() {
    local want i
    want=$(zp__physical_dir "$1")
    if [ -z "$want" ]; then
        ZP_ERROR="Profile directory not found: $1"
        return 1
    fi
    for ((i = 0; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
        if [ "$(zp__physical_dir "${ZP_PROFILE_DIRS[$i]}")" = "$want" ]; then
            ZP_SELECTED=("$i")
            return 0
        fi
    done
    zp__add_profile "$want" "${want##*/}" "$want" "" "$want"
    ZP_SELECTED=("$(( ${#ZP_PROFILE_DIRS[@]} - 1 ))")
}

# One-line description of profile <i> for lists: name, directory when it
# differs from the name, and the root when it is not the one Zen uses.
zp_describe() {
    local i="$1" dir="${ZP_PROFILE_DIRS[$1]}" out="${ZP_PROFILE_NAMES[$1]}"
    if [ "${dir##*/}" != "$out" ]; then out="$out  [${dir##*/}]"; fi
    if [ -n "${ZP_PROFILE_ROOT[$i]}" ] && [ "${ZP_PROFILE_ROOT[$i]}" != "$ZP_ROOT" ]; then
        out="$out  (in ${ZP_PROFILE_ROOT[$i]})"
    elif [ -z "${ZP_PROFILE_ROOT[$i]}" ]; then
        out="$out  ($dir)"
    fi
    printf '%s\n' "$out"
}

# Resolve a profile selection: "all", 1-based numbers ("2" or "1,3"), or a
# profile name. Sets ZP_SELECTED (0-based indices); returns 1 with ZP_ERROR.
zp_select() {
    local spec="$1" tok i n=${#ZP_PROFILE_DIRS[@]} lc hit=()
    ZP_SELECTED=()
    case "$spec" in
        all|ALL|All|a|A)
            for ((i = 0; i < n; i++)); do ZP_SELECTED+=("$i"); done
            return 0 ;;
    esac
    if [[ $spec =~ ^[[:space:]]*[0-9]+([,[:space:]]+[0-9]+)*[[:space:]]*$ ]]; then
        for tok in ${spec//,/ }; do
            tok=$((10#$tok))
            if [ "$tok" -lt 1 ] || [ "$tok" -gt "$n" ]; then
                ZP_ERROR="Invalid profile number $tok (valid: 1-$n)"
                ZP_SELECTED=()
                return 1
            fi
            if ! zp__in_list "$((tok - 1))" "${ZP_SELECTED[@]}"; then ZP_SELECTED+=("$((tok - 1))"); fi
        done
        return 0
    fi
    for ((i = 0; i < n; i++)); do
        if [ "${ZP_PROFILE_NAMES[$i]}" = "$spec" ]; then hit+=("$i"); fi
    done
    if [ ${#hit[@]} -eq 0 ]; then
        lc=$(printf '%s' "$spec" | tr '[:upper:]' '[:lower:]')
        for ((i = 0; i < n; i++)); do
            if [ "$(printf '%s' "${ZP_PROFILE_NAMES[$i]}" | tr '[:upper:]' '[:lower:]')" = "$lc" ]; then hit+=("$i"); fi
        done
    fi
    if [ ${#hit[@]} -eq 1 ]; then
        ZP_SELECTED=("${hit[0]}")
        return 0
    fi
    if [ ${#hit[@]} -gt 1 ]; then
        ZP_ERROR="Several profiles are named \"$spec\"; use its number instead"
    else
        ZP_ERROR="No profile named \"$spec\" (use a number from the list, a profile name, or \"all\")"
    fi
    return 1
}

# Interactive profile picker. Prints the numbered list, then reads the answer
# from file descriptor 3. Enter accepts the suggested profiles.
# Usage: zp_menu <status-function|""> <suggested indices...>
# The status function is called with an index and prints a short note (e.g.
# "ZenLeap 3.4.0 installed"). Sets ZP_SELECTED; returns 1 if the user quits.
zp_menu() {
    local status_fn="$1" i n=${#ZP_PROFILE_DIRS[@]} note ans suggested="" s
    shift
    for s in "$@"; do suggested="${suggested:+$suggested,}$((s + 1))"; done
    for ((i = 0; i < n; i++)); do
        note=""
        if [ -n "$status_fn" ]; then note=$("$status_fn" "$i"); fi
        if [ "$i" = "$ZP_DEFAULT" ]; then note="default profile${note:+, $note}"; fi
        printf '  %2d) %s%s\n' "$((i + 1))" "$(zp_describe "$i")" "${note:+  - $note}"
    done
    while :; do
        if [ -n "$suggested" ]; then
            printf 'Select profile(s) - numbers, a name, "all" [Enter = %s, q = quit]: ' "$suggested"
        else
            printf 'Select profile(s) - numbers, a name, "all" [q = quit]: '
        fi
        if ! IFS= read -r ans <&3; then
            printf '\n'
            return 1
        fi
        case "$ans" in
            q|Q|quit) return 1 ;;
            "")
                if [ -n "$suggested" ]; then
                    ZP_SELECTED=("$@")
                    return 0
                fi ;;
            *)
                if zp_select "$ans"; then return 0; fi
                printf '%s\n' "$ZP_ERROR" ;;
        esac
    done
}

# zp__is_zen_pid <pid>: the process exists and is a Zen browser process.
zp__is_zen_pid() {
    local comm=""
    if ! kill -0 "$1" 2>/dev/null; then return 1; fi
    if [ -r "/proc/$1/comm" ]; then
        comm=$(cat "/proc/$1/comm" 2>/dev/null)
    else
        comm=$(ps -p "$1" -o comm= 2>/dev/null)
    fi
    comm=${comm##*/}
    case "$comm" in
        zen|zen-bin|Zen|"Zen Browser") return 0 ;;
    esac
    return 1
}

# Print the PID of the Zen process that has <profile-dir> open, if any.
# Linux: Firefox's "lock" symlink points to "<ip>:+<pid>". macOS: the process
# holding .parentlock (via lsof). Never guesses from process names alone.
zp_profile_pid() {
    local dir="$1" target pid
    if [ -L "$dir/lock" ]; then
        target=$(readlink "$dir/lock" 2>/dev/null)
        pid=${target##*+}
        case "$pid" in
            ""|*[!0-9]*) ;;
            *) if zp__is_zen_pid "$pid"; then printf '%s\n' "$pid"; return 0; fi ;;
        esac
    fi
    if [ "$(uname -s)" = "Darwin" ] && [ -e "$dir/.parentlock" ] && command -v lsof >/dev/null 2>&1; then
        for pid in $(lsof -t -- "$dir/.parentlock" 2>/dev/null); do
            if zp__is_zen_pid "$pid"; then printf '%s\n' "$pid"; return 0; fi
        done
    fi
    return 1
}

# Remove the startup cache of profile <i> (in its local dir, and in the profile
# dir itself for profiles started with -profile). Returns 1 if there was none.
zp_clear_startup_cache() {
    local d found=1
    for d in "${ZP_PROFILE_LOCAL[$1]}/startupCache" "${ZP_PROFILE_DIRS[$1]}/startupCache"; do
        if [ -d "$d" ]; then
            rm -rf "$d" 2>/dev/null || true
            found=0
        fi
    done
    return $found
}

# Remove the "/* === ZenLeap Styles === */ ... /* === End ZenLeap Styles === */"
# block(s) that older installers appended to a userChrome.css (a block with no
# end marker runs to the end of the file). Blank lines just before a block go
# too. Returns 1 if the file has no block.
zp_strip_css_block() {
    local file="$1" tmp
    if ! grep -qF '/* === ZenLeap Styles === */' "$file" 2>/dev/null; then return 1; fi
    tmp="$file.zenleap-tmp.$$"
    awk '
        !skip && index($0, "/* === ZenLeap Styles === */") { skip = 1; blank = ""; next }
        skip { if (index($0, "/* === End ZenLeap Styles === */")) skip = 0; next }
        /^[ \t]*$/ { blank = blank $0 "\n"; next }
        { printf "%s", blank; blank = ""; print }
        END { printf "%s", blank }
    ' "$file" > "$tmp" && cat "$tmp" > "$file"
    rm -f "$tmp"
    return 0
}

# SHA-256 of a file as lowercase hex.
zp_sha256() {
    local out
    if command -v sha256sum >/dev/null 2>&1; then
        out=$(sha256sum "$1")
    elif command -v shasum >/dev/null 2>&1; then
        out=$(shasum -a 256 "$1")
    else
        out=$(openssl dgst -sha256 -r "$1")
    fi
    printf '%s\n' "${out%% *}" | tr '[:upper:]' '[:lower:]'
}

# The "@version x.y.z" of a script (zenleap.uc.js, fx-autoconfig's boot.sys.mjs).
zp_file_version() {
    if [ -f "$1" ]; then
        grep -o '@version[[:space:]]*[0-9][0-9.]*' "$1" 2>/dev/null | head -n 1 | sed 's/@version[[:space:]]*//'
    fi
}

# zp_version_gte <a> <b>: true if dotted version a >= b.
zp_version_gte() {
    local a="$1" b="$2" x y
    while [ -n "$a" ] || [ -n "$b" ]; do
        x=${a%%.*}; y=${b%%.*}
        x=${x//[!0-9]/}; y=${y//[!0-9]/}
        x=$((10#${x:-0})); y=$((10#${y:-0}))
        if [ "$x" -gt "$y" ]; then return 0; fi
        if [ "$x" -lt "$y" ]; then return 1; fi
        case "$a" in *.*) a=${a#*.} ;; *) a="" ;; esac
        case "$b" in *.*) b=${b#*.} ;; *) b="" ;; esac
    done
    return 0
}

# ZenLeap as a Sine mod inside <profile-dir> (prints the mod dir).
zp_sine_zenleap_dir() {
    local d="$1/chrome/sine-mods/$ZP_SINE_MOD_ID"
    if [ -f "$d/JS/zenleap.uc.js" ]; then printf '%s\n' "$d"; return 0; fi
    return 1
}

# True if <profile-dir> boots through Sine's loader (which only runs Sine mods,
# not fx-autoconfig scripts in chrome/JS).
zp_profile_uses_sine() {
    if [ -f "$1/chrome/JS/sine.sys.mjs" ]; then return 0; fi
    if grep -qs 'sine-mods' "$1/chrome/utils/chrome.manifest"; then return 0; fi
    return 1
}

# Version of ZenLeap installed in <profile-dir> (chrome/JS or Sine), or empty.
zp_zenleap_version() {
    local d
    if [ -f "$1/chrome/JS/zenleap.uc.js" ]; then
        zp_file_version "$1/chrome/JS/zenleap.uc.js"
    elif d=$(zp_sine_zenleap_dir "$1"); then
        zp_file_version "$d/JS/zenleap.uc.js"
    fi
}
# <<< zen-paths.sh

ok()   { [ "$QUIET" = true ] || echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
die()  { echo -e "${RED}Error: $*${NC}"; exit 1; }

cleanup() {
    if [ -n "$WORK_DIR" ]; then rm -rf "$WORK_DIR"; fi
}
trap cleanup EXIT

work_dir() {
    if [ -z "$WORK_DIR" ]; then
        WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/zenleap-install.XXXXXX")
    fi
}

# Per-user cache directory (for files the user may need after we exit)
user_cache_dir() {
    if [ "$OS" = "macos" ]; then
        echo "$HOME/Library/Caches"
    else
        zp_xdg_dir "${XDG_CACHE_HOME:-}" "$HOME/.cache"
    fi
}

# Tag of the latest ZenLeap release (e.g. v3.4.0)
latest_release_tag() {
    local json tag
    json=$(curl -sfL -H "Accept: application/vnd.github+json" "$ZENLEAP_LATEST_API" 2>/dev/null) || json=""
    tag=$(printf '%s' "$json" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ -z "$tag" ]; then
        # API unavailable (e.g. rate-limited): follow the releases/latest redirect instead
        tag=$(curl -sfI "$ZENLEAP_LATEST_PAGE" 2>/dev/null | tr -d '\r' | sed -n 's|^[Ll]ocation:.*/releases/tag/||p' | tail -n 1)
    fi
    case "$tag" in
        ""|*[!A-Za-z0-9._-]*) return 1 ;;
    esac
    echo "$tag"
}

# Download the latest release into $1 and verify it. The script must match the
# SHA-256 listed in that release's CHECKSUMS.sha256 and carry the tag's version.
download_release() {
    local dest="$1" tag expected actual version
    echo "  Looking up the latest ZenLeap release..."
    tag=$(latest_release_tag) || { echo -e "${RED}Error: Could not determine the latest ZenLeap release (network?)${NC}"; return 1; }
    echo "  Downloading ZenLeap $tag from GitHub..."
    mkdir -p "$dest/JS"
    if ! curl -sfL "$ZENLEAP_RAW_BASE/$tag/JS/zenleap.uc.js" -o "$dest/JS/zenleap.uc.js"; then
        echo -e "${RED}Error: Failed to download zenleap.uc.js${NC}"
        return 1
    fi
    if ! curl -sfL "$ZENLEAP_RAW_BASE/$tag/CHECKSUMS.sha256" -o "$dest/CHECKSUMS.sha256"; then
        echo -e "${RED}Error: Release $tag has no CHECKSUMS.sha256; refusing to install unverified code${NC}"
        return 1
    fi
    expected=$(awk '$2 == "JS/zenleap.uc.js" || $2 == "*JS/zenleap.uc.js" { print tolower($1); exit }' "$dest/CHECKSUMS.sha256")
    actual=$(zp_sha256 "$dest/JS/zenleap.uc.js")
    if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
        echo -e "${RED}Error: zenleap.uc.js from $tag does not match the release's CHECKSUMS.sha256; refusing to install it${NC}"
        echo "  expected: ${expected:-<no entry for JS/zenleap.uc.js>}"
        echo "  got:      $actual"
        return 1
    fi
    version=$(zp_file_version "$dest/JS/zenleap.uc.js")
    if [ "v$version" != "$tag" ] && [ "$version" != "$tag" ]; then
        echo -e "${RED}Error: zenleap.uc.js from $tag reports version ${version:-?}; refusing to install it${NC}"
        return 1
    fi
    # Themes template (best-effort; only copied when a profile has none)
    curl -sfL "$ZENLEAP_RAW_BASE/$tag/zenleap-themes.json" -o "$dest/zenleap-themes.json" 2>/dev/null || rm -f "$dest/zenleap-themes.json"
    ok "Downloaded ZenLeap $tag (SHA-256 verified)"
}

# Decide where the ZenLeap files come from: the checkout next to this script,
# or (with --remote, or when there is no checkout) the latest release.
prepare_source() {
    if [ "$USE_REMOTE" != true ]; then
        if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/JS/zenleap.uc.js" ]; then
            SOURCE_DIR="$SCRIPT_DIR"
            return 0
        fi
        echo "No local ZenLeap files next to this script; using the latest release from GitHub."
    fi
    work_dir
    SOURCE_DIR="$WORK_DIR/release"
    download_release "$SOURCE_DIR" || exit 1
}

# Show banner
show_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                   ZenLeap Installer                       ║"
    echo "║         Vim-style Relative Tab Navigation                 ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Backup userChrome.css before modification
backup_user_chrome() {
    local css_file="$CHROME_DIR/userChrome.css"
    if [ -f "$css_file" ]; then
        cp "$css_file" "$CHROME_DIR/userChrome.css.zenleap-backup"
    fi
}

# Is $1 a Zen installation directory?
is_zen_dir() {
    [ -f "$1/application.ini" ] || [ -f "$1/zen" ] || [ -f "$1/zen-bin" ]
}

# Prompt user for Zen Browser installation path
prompt_zen_path() {
    echo ""
    echo -e "${YELLOW}Could not find Zen Browser in the default locations.${NC}"
    echo ""
    echo "To find your Zen installation directory:"
    echo "  1. Open Zen Browser"
    echo "  2. Go to ${BLUE}about:support${NC}"
    echo "  3. Look for ${BLUE}Application Binary${NC} in the table"
    echo "  4. The installation directory is the folder containing that binary"
    echo ""
    echo "Common locations:"
    if [ "$OS" = "macos" ]; then
        echo "  /Applications/Zen.app"
    else
        echo "  ~/.tarball-installations/zen    /opt/zen-browser    /opt/zen-browser-bin"
        echo "  /opt/zen    /usr/lib/zen-browser    ~/.local/share/zen"
    fi
    echo ""

    if [ "$AUTO_YES" = true ]; then
        echo -e "${RED}Error: Cannot prompt for path in non-interactive mode.${NC}"
        echo "Use --zen-path <directory> to specify the Zen installation directory."
        exit 1
    fi

    local user_path
    while true; do
        echo -n "Enter the Zen Browser installation directory (or 'q' to quit): "
        read -r user_path <&3 || exit 1
        if [ "$user_path" = "q" ] || [ "$user_path" = "Q" ]; then
            echo "Installation cancelled."
            exit 1
        fi
        # Trim surrounding whitespace and expand a leading ~
        user_path="${user_path#"${user_path%%[![:space:]]*}"}"
        user_path="${user_path%"${user_path##*[![:space:]]}"}"
        # shellcheck disable=SC2088  # matching a literal ~ typed by the user
        case "$user_path" in "~"|"~/"*) user_path="$HOME${user_path#\~}" ;; esac
        if [ -z "$user_path" ]; then
            echo -e "${RED}Path cannot be empty.${NC}"
            continue
        fi
        if [ ! -d "$user_path" ]; then
            echo -e "${RED}Directory not found: $user_path${NC}"
            continue
        fi
        # On macOS, if they gave an .app path, resolve to Contents/Resources
        if [[ "$user_path" == *.app ]] && [ -d "$user_path/Contents/Resources" ]; then
            user_path="$user_path/Contents/Resources"
            ok "Resolved to: $user_path"
        fi
        ok "Using Zen installation at: $user_path"
        ZEN_RESOURCES="$user_path"
        return 0
    done
}

# Detect OS and the Zen installation.
# Usage: detect_os <prompt-if-not-found: true|false>
detect_os() {
    local prompt="$1"
    ZEN_RESOURCES=""
    IS_FLATPAK=false
    case "$(uname -s)" in
        Darwin)
            OS="macos"
            if [ -n "$CUSTOM_ZEN_PATH" ]; then
                if [ ! -d "$CUSTOM_ZEN_PATH" ]; then
                    die "Directory not found: $CUSTOM_ZEN_PATH"
                fi
                # If they gave an .app path, resolve to Contents/Resources
                if [[ "$CUSTOM_ZEN_PATH" == *.app ]] && [ -d "$CUSTOM_ZEN_PATH/Contents/Resources" ]; then
                    ZEN_RESOURCES="$CUSTOM_ZEN_PATH/Contents/Resources"
                else
                    ZEN_RESOURCES="$CUSTOM_ZEN_PATH"
                fi
            else
                local app
                for app in "/Applications/Zen.app" "/Applications/Zen Browser.app" \
                           "$HOME/Applications/Zen.app" "$HOME/Applications/Zen Browser.app"; do
                    if [ -d "$app/Contents/Resources" ]; then
                        ZEN_RESOURCES="$app/Contents/Resources"
                        break
                    fi
                done
            fi
            if [ -z "$ZEN_RESOURCES" ] && [ "$prompt" = true ]; then
                prompt_zen_path
            fi
            ;;
        Linux)
            OS="linux"

            # Use custom path if provided
            if [ -n "$CUSTOM_ZEN_PATH" ]; then
                if [ ! -d "$CUSTOM_ZEN_PATH" ]; then
                    die "Directory not found: $CUSTOM_ZEN_PATH"
                fi
                ZEN_RESOURCES="$(cd "$CUSTOM_ZEN_PATH" && pwd)"
            fi

            # Auto-detect if no custom path provided
            if [ -z "$ZEN_RESOURCES" ]; then
                # Standard install paths (official tarball script, deb, AUR, generic)
                local candidate
                for candidate in \
                    "$HOME/.tarball-installations/zen" \
                    "/opt/zen-browser" \
                    "/opt/zen-browser-bin" \
                    "/opt/zen" \
                    "/usr/lib/zen-browser" \
                    "/usr/lib/zen" \
                    "/usr/lib64/zen-browser" \
                    "/usr/lib64/zen" \
                    "$HOME/.local/share/zen" \
                    "$HOME/.local/share/zen-browser"; do
                    if is_zen_dir "$candidate"; then
                        ZEN_RESOURCES="$candidate"
                        break
                    fi
                done

                # Fallback: find zen on PATH and resolve its directory
                if [ -z "$ZEN_RESOURCES" ]; then
                    local zen_bin zen_dir
                    zen_bin=$(command -v zen 2>/dev/null || command -v zen-browser 2>/dev/null || true)
                    if [ -n "$zen_bin" ]; then
                        # Resolve symlinks to find the real installation directory
                        zen_bin=$(readlink -f "$zen_bin" 2>/dev/null || realpath "$zen_bin" 2>/dev/null || echo "$zen_bin")
                        zen_dir=$(dirname "$zen_bin")
                        if [ "$zen_dir" != "/usr/bin" ] && [ "$zen_dir" != "/usr/local/bin" ] && is_zen_dir "$zen_dir"; then
                            ZEN_RESOURCES="$zen_dir"
                        fi
                    fi
                fi

                # Flatpak install (only when there is no native one)
                if [ -z "$ZEN_RESOURCES" ]; then
                    if [ -d "$HOME/.var/app/$ZP_FLATPAK_ID" ] || \
                       { command -v flatpak >/dev/null 2>&1 && flatpak list --app 2>/dev/null | grep -q "$ZP_FLATPAK_ID"; }; then
                        IS_FLATPAK=true
                    fi
                fi
            fi

            if [ "$IS_FLATPAK" = true ]; then
                # Flatpak: the app dir is read-only, use the systemconfig extension
                # (mounted at /app/etc/zen, which Firefox reads as its system config dir)
                local flatpak_arch
                flatpak_arch=$(flatpak --default-arch 2>/dev/null || uname -m)
                case "$flatpak_arch" in
                    x86_64|amd64) flatpak_arch="x86_64" ;;
                    aarch64|arm64) flatpak_arch="aarch64" ;;
                    i386|i686) flatpak_arch="i386" ;;
                esac
                ZEN_RESOURCES="$HOME/.local/share/flatpak/extension/$ZP_FLATPAK_ID.systemconfig/$flatpak_arch/stable"
                ok "Detected Flatpak installation (experimental support)"
            elif [ -z "$ZEN_RESOURCES" ] && [ "$prompt" = true ]; then
                prompt_zen_path
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*)
            OS="windows"
            echo -e "${RED}This bash installer does not support Windows.${NC}"
            echo "Use the PowerShell installer instead:"
            echo -e "${BLUE}  powershell -ExecutionPolicy Bypass -c \"irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 | iex\"${NC}"
            exit 1
            ;;
        *)
            echo -e "${RED}Unsupported operating system${NC}"
            exit 1
            ;;
    esac
    ok "Detected OS: $OS"
    if [ -n "$ZEN_RESOURCES" ] && [ "$IS_FLATPAK" != true ]; then
        ok "Zen installation: $ZEN_RESOURCES"
    fi
}

# Status note for the profile list: which profiles already have ZenLeap
zenleap_status() {
    local dir="${ZP_PROFILE_DIRS[$1]}" v
    v=$(zp_zenleap_version "$dir")
    if [ -z "$v" ]; then
        return 0
    fi
    if [ ! -f "$dir/chrome/JS/zenleap.uc.js" ]; then
        echo "ZenLeap $v (via Sine)"
    else
        echo "ZenLeap $v installed"
    fi
}

# Find the profiles and decide which ones to work on (sets ZP_SELECTED).
# Usage: choose_profiles <install|uninstall|check>
choose_profiles() {
    local action="$1" i mode=native suggested=()
    [ "$IS_FLATPAK" = true ] && mode=flatpak

    if ! zp_discover "$mode" "$ZEN_RESOURCES" && [ -z "$PROFILE_DIR_ARG" ]; then
        echo -e "${RED}Error: $ZP_ERROR${NC}"
        echo "Start Zen Browser once to create a profile (or check about:profiles), then run this again."
        exit 1
    fi

    if [ -n "$PROFILE_DIR_ARG" ]; then
        zp_use_profile_dir "$PROFILE_DIR_ARG" || die "$ZP_ERROR"
    elif [ -n "$PROFILE_SPEC" ]; then
        if ! zp_select "$PROFILE_SPEC"; then
            echo -e "${RED}Error: $ZP_ERROR${NC}"
            echo "Zen profiles:"
            zp_menu_list
            exit 1
        fi
    elif [ "$action" = "check" ]; then
        zp_select all
    else
        # Suggest the profile Zen opens by default (install only) plus every
        # profile that already has ZenLeap.
        for ((i = 0; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
            if [ -n "$(zp_zenleap_version "${ZP_PROFILE_DIRS[$i]}")" ] || \
               { [ "$action" = "install" ] && [ "$i" = "$ZP_DEFAULT" ]; }; then
                suggested+=("$i")
            fi
        done
        if [ "$action" = "install" ] && [ ${#ZP_PROFILE_DIRS[@]} -eq 1 ]; then
            ZP_SELECTED=(0)
        elif [ "$action" = "uninstall" ] && [ ${#suggested[@]} -eq 0 ]; then
            ZP_SELECTED=()
        elif [ "$AUTO_YES" = true ]; then
            if [ ${#suggested[@]} -eq 0 ]; then
                echo -e "${RED}Error: Found ${#ZP_PROFILE_DIRS[@]} profiles and could not tell which one Zen uses.${NC}"
                zp_menu_list
                echo "Pass --profile <number|name|all>."
                exit 1
            fi
            ZP_SELECTED=("${suggested[@]}")
        else
            echo ""
            echo "Zen profiles (in $ZP_ROOT):"
            if ! zp_menu zenleap_status "${suggested[@]}"; then
                echo "Cancelled."
                exit 1
            fi
        fi
    fi

    if [ "$action" != "check" ]; then
        for i in "${ZP_SELECTED[@]}"; do
            ok "Profile: $(zp_describe "$i")"
        done
    fi
}

# Non-interactive listing of the profiles (for error messages)
zp_menu_list() {
    local i
    for ((i = 0; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
        printf '  %2d) %s%s\n' "$((i + 1))" "$(zp_describe "$i")" "$([ "$i" = "$ZP_DEFAULT" ] && echo "  - default profile")"
    done
}

# Set per-profile path variables for profile index $1
set_profile_paths() {
    PROFILE_DIR="${ZP_PROFILE_DIRS[$1]}"
    CHROME_DIR="$PROFILE_DIR/chrome"
    JS_DIR="$CHROME_DIR/JS"
}

# Zen loads ZenLeap only at startup. If Zen is running with a selected
# profile, ask the user to quit it; never kill it (a killed Zen loses its
# session). --yes continues and asks for a restart at the end.
check_zen_running() {
    local i pid ans running=()
    while true; do
        running=()
        for i in "${ZP_SELECTED[@]}"; do
            if pid=$(zp_profile_pid "${ZP_PROFILE_DIRS[$i]}"); then
                running+=("${ZP_PROFILE_NAMES[$i]} (PID $pid)")
            fi
        done
        # Flatpak runs Zen in its own PID namespace, so the lock PID is useless there
        if [ "$IS_FLATPAK" = true ] && command -v flatpak >/dev/null 2>&1 && \
           flatpak ps --columns=application 2>/dev/null | grep -qx "$ZP_FLATPAK_ID"; then
            running+=("Flatpak Zen")
        fi
        if [ ${#running[@]} -eq 0 ]; then
            return 0
        fi

        warn "Zen is running with:"
        printf '    %s\n' "${running[@]}"
        if [ "$AUTO_YES" = true ]; then
            echo "  Continuing; restart Zen afterwards so it loads the changes."
            ZEN_NEEDS_RESTART=true
            return 0
        fi
        echo "  Quit Zen (Ctrl+Q, or Cmd+Q on macOS) so it picks up the changes on its next start."
        echo -n "  Press Enter once Zen is closed, 's' to continue anyway (restart Zen later), or 'q' to cancel: "
        read -r ans <&3 || ans="q"
        case "$ans" in
            q|Q)
                echo "Cancelled."
                exit 1
                ;;
            s|S)
                ZEN_NEEDS_RESTART=true
                return 0
                ;;
            *)
                ZEN_WAS_RUNNING=true
                ;;
        esac
    done
}

# Download fx-autoconfig (once per run) into $FXAC_SRC
fxac_fetch() {
    if [ -n "$FXAC_SRC" ]; then
        return 0
    fi
    if [ "$FXAC_FAILED" = true ]; then
        return 1
    fi
    local dir
    FXAC_FAILED=true
    work_dir
    dir="$WORK_DIR/fxac-download"
    rm -rf "$dir"
    mkdir -p "$dir"
    echo "  Downloading fx-autoconfig..."
    if command -v curl &> /dev/null; then
        curl -sfL "$FXAUTOCONFIG_REPO" -o "$dir/fxautoconfig.zip" || return 1
    elif command -v wget &> /dev/null; then
        wget -q "$FXAUTOCONFIG_REPO" -O "$dir/fxautoconfig.zip" || return 1
    else
        echo -e "${RED}Error: Neither curl nor wget found${NC}"
        return 1
    fi
    if command -v unzip &> /dev/null; then
        unzip -q "$dir/fxautoconfig.zip" -d "$dir" || return 1
    elif command -v python3 &> /dev/null; then
        python3 -m zipfile -e "$dir/fxautoconfig.zip" "$dir" || return 1
    else
        echo -e "${RED}Error: unzip not found (install unzip and run again)${NC}"
        return 1
    fi
    dir=$(find "$dir" -mindepth 1 -maxdepth 1 -type d -name "fx-autoconfig*" | head -n 1)
    if [ -z "$dir" ] || [ ! -f "$dir/profile/chrome/utils/boot.sys.mjs" ] || [ ! -f "$dir/program/config.js" ]; then
        echo -e "${RED}Error: Unexpected fx-autoconfig archive layout${NC}"
        return 1
    fi
    FXAC_SRC="$dir"
    FXAC_VERSION=$(zp_file_version "$dir/profile/chrome/utils/boot.sys.mjs")
    FXAC_FAILED=false
}

# fx-autoconfig's program files (config.js + defaults/pref/config-prefs.js) go
# into Zen's installation directory, once for all profiles.
ensure_fxautoconfig_program() {
    local dir="$ZEN_RESOURCES" stage ans
    if [ -z "$dir" ]; then
        die "Zen installation directory unknown (use --zen-path)"
    fi
    if [ -f "$dir/config.js" ]; then
        if ! grep -q 'userchromejs/content/boot' "$dir/config.js" 2>/dev/null; then
            warn "$dir/config.js is not fx-autoconfig's (Sine's or another loader's); leaving it alone."
            echo "  ZenLeap in chrome/JS only runs if that config.js also loads fx-autoconfig."
            return 0
        fi
        if grep -q 'boot.sys.mjs' "$dir/config.js" && [ -f "$dir/defaults/pref/config-prefs.js" ]; then
            ok "fx-autoconfig is set up in the Zen installation"
            return 0
        fi
        # An outdated (boot.jsm) config.js or a missing config-prefs.js: install both again
    fi

    echo -e "${BLUE}Installing fx-autoconfig into the Zen installation...${NC}"
    fxac_fetch || die "Failed to download fx-autoconfig"
    if mkdir -p "$dir/defaults/pref" 2>/dev/null && \
       cp "$FXAC_SRC/program/config.js" "$dir/config.js" 2>/dev/null && \
       cp "$FXAC_SRC/program/defaults/pref/config-prefs.js" "$dir/defaults/pref/config-prefs.js" 2>/dev/null; then
        ok "Installed fx-autoconfig program files into $dir"
        return 0
    fi

    # Needs administrator rights. Don't run sudo from here; print the commands.
    stage="$(user_cache_dir)/zenleap/fx-autoconfig-program"
    rm -rf "$stage"
    mkdir -p "$stage"
    cp "$FXAC_SRC/program/config.js" "$FXAC_SRC/program/defaults/pref/config-prefs.js" "$stage/"
    FXAC_PROGRAM_CMDS=$(
        printf '    sudo mkdir -p %q\n' "$dir/defaults/pref"
        printf '    sudo cp %q %q\n' "$stage/config.js" "$dir/config.js"
        printf '    sudo cp %q %q\n' "$stage/config-prefs.js" "$dir/defaults/pref/config-prefs.js"
    )
    warn "Copying fx-autoconfig into $dir needs administrator rights."
    echo "  Run these commands in a terminal:"
    echo ""
    echo "$FXAC_PROGRAM_CMDS"
    echo ""
    FXAC_PROGRAM_PENDING=true
    if [ "$AUTO_YES" = true ]; then
        return 0
    fi
    while true; do
        echo -n "  Press Enter once you've run them, or 's' to skip for now: "
        read -r ans <&3 || ans="s"
        case "$ans" in
            s|S) return 0 ;;
        esac
        if [ -f "$dir/config.js" ] && [ -f "$dir/defaults/pref/config-prefs.js" ]; then
            FXAC_PROGRAM_PENDING=false
            ok "fx-autoconfig program files are in place"
            return 0
        fi
        warn "Still missing: $dir/config.js or $dir/defaults/pref/config-prefs.js"
    done
}

# fx-autoconfig's loader in the profile: <profile>/chrome/utils (only that
# folder; the rest of fx-autoconfig's profile/ dir is examples). Offers to
# update an outdated loader.
ensure_fxautoconfig_profile() {
    local utils="$CHROME_DIR/utils" have ans
    if [ -f "$utils/boot.sys.mjs" ] || [ -f "$utils/boot.jsm" ]; then
        have=$(zp_file_version "$utils/boot.sys.mjs")
        if ! fxac_fetch; then
            warn "Could not download fx-autoconfig to check for loader updates; keeping ${have:-the installed version}"
            return 0
        fi
        if [ -n "$have" ] && zp_version_gte "$have" "$FXAC_VERSION"; then
            ok "fx-autoconfig loader $have (up to date)"
            return 0
        fi
        warn "This profile's fx-autoconfig loader is outdated (${have:-pre-0.8} < $FXAC_VERSION)."
        if [ "$AUTO_YES" != true ]; then
            echo -n "  Update chrome/utils to $FXAC_VERSION? (Y/n): "
            read -r ans <&3 || ans="n"
            case "$ans" in
                n|N|no|No)
                    echo "  Keeping the installed loader"
                    return 0
                    ;;
            esac
        fi
        rm -rf "$CHROME_DIR/utils.zenleap-backup"
        mv "$utils" "$CHROME_DIR/utils.zenleap-backup"
        cp -R "$FXAC_SRC/profile/chrome/utils" "$utils"
        ok "Updated fx-autoconfig loader to $FXAC_VERSION (previous copy: chrome/utils.zenleap-backup)"
        return 0
    fi
    if [ -d "$utils" ] && [ -n "$(ls -A "$utils" 2>/dev/null)" ]; then
        warn "chrome/utils exists but is not fx-autoconfig's loader; leaving it alone."
        echo "  ZenLeap needs fx-autoconfig's chrome/utils to load."
        return 0
    fi
    fxac_fetch || die "Failed to download fx-autoconfig"
    mkdir -p "$CHROME_DIR"
    rm -rf "$utils"
    cp -R "$FXAC_SRC/profile/chrome/utils" "$utils"
    ok "Installed fx-autoconfig loader (chrome/utils, $FXAC_VERSION)"
}

# Does the selected profile set need fx-autoconfig? (Not for profiles that
# get ZenLeap through Sine.)
selection_needs_fxautoconfig() {
    local i dir
    for i in "${ZP_SELECTED[@]}"; do
        dir="${ZP_PROFILE_DIRS[$i]}"
        if ! zp_sine_zenleap_dir "$dir" >/dev/null && ! zp_profile_uses_sine "$dir"; then
            return 0
        fi
    done
    return 1
}

# Install ZenLeap into the current profile
install_zenleap() {
    local version sine_dir ans
    version=$(zp_file_version "$SOURCE_DIR/JS/zenleap.uc.js")

    # ZenLeap installed as a Sine mod in this profile
    if sine_dir=$(zp_sine_zenleap_dir "$PROFILE_DIR"); then
        warn "ZenLeap is installed through Sine in this profile (v$(zp_file_version "$sine_dir/JS/zenleap.uc.js"))"
        if [ "$AUTO_YES" != true ]; then
            echo -n "  Replace Sine's copy with v$version? (y/n): "
            read -r ans <&3 || ans="n"
            if [ "$ans" != "y" ] && [ "$ans" != "Y" ]; then
                warn "Skipped this profile (update ZenLeap from Sine's mods page instead)"
                return 0
            fi
        fi
        cp "$SOURCE_DIR/JS/zenleap.uc.js" "$sine_dir/JS/zenleap.uc.js"
        if [ -f "$SOURCE_DIR/chrome.css" ]; then
            cp "$SOURCE_DIR/chrome.css" "$sine_dir/chrome.css"
        fi
        if [ -f "$SOURCE_DIR/zenleap-themes.json" ]; then
            cp "$SOURCE_DIR/zenleap-themes.json" "$sine_dir/zenleap-themes.json"
        fi
        ok "Updated Sine-managed zenleap.uc.js (v$version)"
        INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
        return 0
    fi

    # Sine's loader only runs Sine mods, not scripts in chrome/JS
    if zp_profile_uses_sine "$PROFILE_DIR"; then
        warn "This profile loads scripts through Sine, which does not run scripts from chrome/JS."
        echo "  Install ZenLeap from Sine instead (Sine mods page -> install yashas-salankimatt/ZenLeap)."
        return 0
    fi

    ensure_fxautoconfig_profile

    mkdir -p "$JS_DIR"
    cp "$SOURCE_DIR/JS/zenleap.uc.js" "$JS_DIR/zenleap.uc.js"
    ok "Installed zenleap.uc.js (v$version)"

    # Installers before 3.5 appended chrome.css to userChrome.css. ZenLeap
    # injects its styles at runtime, so only remove such old blocks.
    if [ -f "$CHROME_DIR/userChrome.css" ] && grep -qF '/* === ZenLeap Styles === */' "$CHROME_DIR/userChrome.css"; then
        backup_user_chrome
        zp_strip_css_block "$CHROME_DIR/userChrome.css" || true
        ok "Removed old ZenLeap styles from userChrome.css (backup: userChrome.css.zenleap-backup)"
    fi

    # Copy themes template if not already present (don't overwrite user customizations)
    if [ ! -f "$CHROME_DIR/zenleap-themes.json" ] && [ -f "$SOURCE_DIR/zenleap-themes.json" ]; then
        cp "$SOURCE_DIR/zenleap-themes.json" "$CHROME_DIR/zenleap-themes.json"
        ok "Created zenleap-themes.json template"
    fi
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
}

# Uninstall ZenLeap from the current profile
uninstall_zenleap() {
    local found_anything=false sine_dir

    if [ -f "$JS_DIR/zenleap.uc.js" ]; then
        rm -f "$JS_DIR/zenleap.uc.js"
        ok "Removed zenleap.uc.js"
        found_anything=true
    fi

    # Remove styles that older installers added to userChrome.css
    if [ -f "$CHROME_DIR/userChrome.css" ] && grep -qF '/* === ZenLeap Styles === */' "$CHROME_DIR/userChrome.css"; then
        backup_user_chrome
        zp_strip_css_block "$CHROME_DIR/userChrome.css" || true
        ok "Removed ZenLeap styles from userChrome.css (backup: userChrome.css.zenleap-backup)"
        found_anything=true
    fi

    if sine_dir=$(zp_sine_zenleap_dir "$PROFILE_DIR"); then
        warn "ZenLeap is also installed through Sine here; remove it from Sine's mods page."
    fi

    if [ "$found_anything" = true ]; then
        ok "ZenLeap uninstalled"
    else
        warn "ZenLeap was not installed in this profile (chrome/JS)"
    fi
}

# Remove fx-autoconfig's loader from the current profile
uninstall_fxautoconfig_profile() {
    if zp_profile_uses_sine "$PROFILE_DIR"; then
        warn "chrome/utils belongs to Sine in this profile; not removing it"
        return 0
    fi
    if [ -f "$CHROME_DIR/utils/boot.sys.mjs" ] || [ -f "$CHROME_DIR/utils/boot.jsm" ]; then
        rm -rf "$CHROME_DIR/utils"
        ok "Removed chrome/utils/ (fx-autoconfig)"
    else
        warn "fx-autoconfig's loader not found in this profile"
    fi
}

# Remove fx-autoconfig's program files from the Zen installation
uninstall_fxautoconfig_program() {
    local dir="$ZEN_RESOURCES" f failed=()
    if [ -z "$dir" ]; then
        warn "Zen installation not found; fx-autoconfig's config.js was not removed (use --zen-path)"
        return 0
    fi
    if [ ! -f "$dir/config.js" ]; then
        return 0
    fi
    if ! grep -q 'userchromejs/content/boot' "$dir/config.js" 2>/dev/null; then
        warn "$dir/config.js is not fx-autoconfig's; leaving it alone"
        return 0
    fi
    for f in "$dir/config.js" "$dir/defaults/pref/config-prefs.js"; do
        if [ -f "$f" ]; then
            if rm -f "$f" 2>/dev/null && [ ! -e "$f" ]; then
                ok "Removed $f"
            else
                failed+=("$f")
            fi
        fi
    done
    if [ ${#failed[@]} -gt 0 ]; then
        warn "Removing fx-autoconfig from $dir needs administrator rights. Run:"
        for f in "${failed[@]}"; do
            printf '    sudo rm -f %q\n' "$f"
        done
    fi
}

# Clear startup cache of the selected profiles
clear_cache() {
    local i cleared=false
    echo ""
    echo -e "${BLUE}Clearing startup cache...${NC}"
    for i in "${ZP_SELECTED[@]}"; do
        if zp_clear_startup_cache "$i"; then
            cleared=true
        fi
    done
    if [ "$cleared" = true ]; then
        ok "Startup cache cleared"
    else
        ok "No startup cache to clear"
    fi
}

# Launch Zen Browser
launch_zen() {
    if [ "$OS" = "macos" ]; then
        # Derive .app path from ZEN_RESOURCES (e.g. /Applications/Zen.app/Contents/Resources → /Applications/Zen.app)
        open "${ZEN_RESOURCES%/Contents/Resources}"
    elif [ "$IS_FLATPAK" = true ]; then
        (flatpak run "$ZP_FLATPAK_ID" >/dev/null 2>&1 &)
    elif [ -x "$ZEN_RESOURCES/zen" ]; then
        ("$ZEN_RESOURCES/zen" >/dev/null 2>&1 &)
    elif command -v zen &>/dev/null; then
        (zen >/dev/null 2>&1 &)
    else
        warn "Could not find zen executable to launch"
    fi
}

print_usage_hint() {
    echo -e "${BLUE}Usage:${NC}"
    echo "  Ctrl+Space     Enter leap mode (? inside it shows all keys)"
    echo "  j/k or ↑/↓     Browse tabs"
    echo "  Enter          Open selected tab"
    echo "  x              Close selected tab"
    echo "  gg / G         Go to first / last tab"
    echo "  g{num}         Go to tab number"
    echo "  zz/zt/zb       Scroll center/top/bottom"
    echo "  Escape         Cancel"
    echo "  Ctrl+/         Search tabs"
    echo "  Ctrl+Shift+/   Command palette"
}

# Main install function
do_install() {
    local i response
    detect_os true
    choose_profiles install
    if [ ${#ZP_SELECTED[@]} -eq 0 ]; then
        die "No profile selected"
    fi
    prepare_source
    check_zen_running

    if selection_needs_fxautoconfig; then
        ensure_fxautoconfig_program
    fi

    for i in "${ZP_SELECTED[@]}"; do
        set_profile_paths "$i"
        echo ""
        echo -e "${BLUE}--- ${ZP_PROFILE_NAMES[$i]} ---${NC}"
        install_zenleap
    done

    clear_cache

    echo ""
    if [ "$INSTALLED_COUNT" -eq 0 ]; then
        warn "ZenLeap was not installed into any profile."
        exit 1
    fi
    if [ "$FXAC_PROGRAM_PENDING" = true ]; then
        echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║              One more step needed                         ║${NC}"
        echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "ZenLeap is installed in your profile, but it will not load until fx-autoconfig"
        echo "is in the Zen installation. Run these commands, then (re)start Zen:"
        echo ""
        echo "$FXAC_PROGRAM_CMDS"
        echo ""
        print_usage_hint
        return 0
    fi
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Installation Complete!                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    print_usage_hint
    echo ""
    if [ "$ZEN_NEEDS_RESTART" = true ]; then
        echo -e "${YELLOW}Restart Zen Browser to activate ZenLeap${NC}"
    elif [ "$AUTO_YES" = true ]; then
        echo -e "${YELLOW}Please start Zen Browser to activate ZenLeap${NC}"
    else
        echo -n "Open Zen Browser now? (y/n): "
        read -r response <&3 || response="n"
        if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
            launch_zen
        else
            echo -e "${YELLOW}Please start Zen Browser to activate ZenLeap${NC}"
        fi
    fi
}

# Main uninstall function
do_uninstall() {
    local i response remove_fx=false any_fx=false
    detect_os false
    choose_profiles uninstall
    if [ ${#ZP_SELECTED[@]} -eq 0 ]; then
        ok "ZenLeap is not installed in any Zen profile (use --profile to pick one anyway)."
        return 0
    fi
    check_zen_running

    for i in "${ZP_SELECTED[@]}"; do
        set_profile_paths "$i"
        echo ""
        echo -e "${BLUE}--- ${ZP_PROFILE_NAMES[$i]} ---${NC}"
        uninstall_zenleap
    done

    # Offer to uninstall fx-autoconfig
    for i in "${ZP_SELECTED[@]}"; do
        set_profile_paths "$i"
        if [ -f "$CHROME_DIR/utils/boot.sys.mjs" ] || [ -f "$CHROME_DIR/utils/boot.jsm" ]; then
            any_fx=true
        fi
    done
    if [ -n "$ZEN_RESOURCES" ] && grep -qs 'userchromejs/content/boot' "$ZEN_RESOURCES/config.js"; then
        any_fx=true
    fi
    if [ "$any_fx" = true ]; then
        if [ "$AUTO_YES" = true ]; then
            if [ "$REMOVE_FXAUTOCONFIG" = true ]; then
                remove_fx=true
            else
                echo -e "${YELLOW}Skipping fx-autoconfig removal (use --remove-fxautoconfig to include)${NC}"
            fi
        else
            echo ""
            echo -n "Also remove fx-autoconfig? Other userscripts may depend on it. (y/n): "
            read -r response <&3 || response="n"
            if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
                remove_fx=true
            fi
        fi
    fi
    if [ "$remove_fx" = true ]; then
        echo ""
        echo -e "${BLUE}Uninstalling fx-autoconfig...${NC}"
        for i in "${ZP_SELECTED[@]}"; do
            set_profile_paths "$i"
            uninstall_fxautoconfig_profile
        done
        uninstall_fxautoconfig_program
    fi

    clear_cache

    echo ""
    echo -e "${GREEN}Uninstallation complete!${NC}"
    echo ""
    echo "Your ZenLeap data was kept: chrome/zenleap-themes.json, chrome/zenleap-plugins/,"
    echo "zenleap-sessions/ in the profile, and the uc.zenleap.* prefs in about:config."
    echo "If userChrome.css was changed, the previous version is in chrome/userChrome.css.zenleap-backup."
    if [ "$ZEN_NEEDS_RESTART" = true ] || [ "$ZEN_WAS_RUNNING" != true ]; then
        echo -e "${YELLOW}Restart Zen Browser if it's running${NC}"
    elif [ "$AUTO_YES" != true ]; then
        echo ""
        echo -n "Reopen Zen Browser? (y/n): "
        read -r response <&3 || response="n"
        if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
            launch_zen
        fi
    fi
}

# Check version and report status
do_check() {
    local i tag remote_version="" installed_version any_outdated=false
    QUIET=true
    detect_os false
    choose_profiles check

    if tag=$(latest_release_tag); then
        remote_version="${tag#v}"
    fi

    for i in "${ZP_SELECTED[@]}"; do
        installed_version=$(zp_zenleap_version "${ZP_PROFILE_DIRS[$i]}")
        if [ -z "$installed_version" ]; then
            echo "${ZP_PROFILE_NAMES[$i]}: NOT_INSTALLED"
        elif [ -z "$remote_version" ]; then
            echo "${ZP_PROFILE_NAMES[$i]}: INSTALLED:$installed_version:UNKNOWN"
        elif zp_version_gte "$installed_version" "$remote_version"; then
            echo "${ZP_PROFILE_NAMES[$i]}: UP_TO_DATE:$installed_version:$remote_version"
        else
            echo "${ZP_PROFILE_NAMES[$i]}: OUTDATED:$installed_version:$remote_version"
            any_outdated=true
        fi
    done

    if [ "$any_outdated" = true ]; then
        return 1
    fi
    return 0
}

show_help() {
    echo "Usage: $0 [install|uninstall|check] [OPTIONS]"
    echo ""
    echo "Actions:"
    echo "  install     Install or update ZenLeap (default)"
    echo "  uninstall   Remove ZenLeap"
    echo "  check       Compare installed versions with the latest release (exit 1 if outdated)"
    echo ""
    echo "Options:"
    echo "  --remote                Install the latest release from GitHub (SHA-256 verified)"
    echo "                          instead of the files next to this script"
    echo "  --profile <sel>         Profile(s): number from the list, profile name, or \"all\"."
    echo "                          Default: the profile Zen opens by default plus every"
    echo "                          profile that already has ZenLeap"
    echo "  --profile-dir <dir>     Use this profile directory directly"
    echo "  --yes, -y               Don't ask questions (non-interactive mode)"
    echo "  --remove-fxautoconfig   Also remove fx-autoconfig during uninstall"
    echo "  --zen-path <dir>        Zen Browser installation directory"
    echo ""
    echo "Profiles are read from Zen's profiles.ini: ~/.config/zen or ~/.zen on Linux"
    echo "(\$XDG_CONFIG_HOME and MOZ_LEGACY_HOME are honoured), ~/Library/Application Support/zen on macOS."
    echo ""
    echo "Non-interactive examples:"
    echo "  $0 install --remote --yes"
    echo "  $0 install --remote --zen-path /opt/zen-browser-bin --profile 2 --yes"
    echo "  $0 uninstall --profile all --yes --remove-fxautoconfig"
}

# Parse arguments
ACTION="install"
while [ $# -gt 0 ]; do
    case "$1" in
        install)
            ACTION="install"
            ;;
        uninstall|remove)
            ACTION="uninstall"
            ;;
        check|--check)
            ACTION="check"
            ;;
        --remote)
            USE_REMOTE=true
            ;;
        --profile)
            shift
            if [ -z "${1:-}" ] || [[ "$1" == --* ]]; then
                die "--profile requires a profile number, name, or \"all\""
            fi
            PROFILE_SPEC="$1"
            ;;
        --profile-dir)
            shift
            if [ -z "${1:-}" ] || [[ "$1" == --* ]]; then
                die "--profile-dir requires a directory argument"
            fi
            PROFILE_DIR_ARG="$1"
            ;;
        --yes|-y)
            AUTO_YES=true
            ;;
        --remove-fxautoconfig)
            REMOVE_FXAUTOCONFIG=true
            ;;
        --zen-path)
            shift
            if [ -z "${1:-}" ] || [[ "$1" == --* ]]; then
                die "--zen-path requires a directory argument"
            fi
            CUSTOM_ZEN_PATH="$1"
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
    shift || true
done

if [ -n "$PROFILE_SPEC" ] && [ -n "$PROFILE_DIR_ARG" ]; then
    die "Use either --profile or --profile-dir, not both"
fi

# Show banner (unless in check mode)
if [ "$ACTION" != "check" ]; then
    show_banner
fi

case "$ACTION" in
    install)
        do_install
        ;;
    uninstall)
        do_uninstall
        ;;
    check)
        do_check
        ;;
esac
