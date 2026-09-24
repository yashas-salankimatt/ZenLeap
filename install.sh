#!/bin/bash
# ZenLeap Installer/Uninstaller (macOS and Linux)
# Usage: ./install.sh [install|uninstall|check] [OPTIONS]
#
# Options:
#   --remote                Install the latest ZenLeap release from GitHub (verified against the
#                           release's CHECKSUMS.sha256) instead of the files next to this script
#   --profile <sel>         Profile(s) to use: a number from the list (1 = the profile Zen opens
#                           by default), a profile or directory name, or "all"; repeatable
#   --all-profiles          Same as --profile all
#   --profile-dir <dir>     Use this profile directory (e.g. one you start with `zen -profile <dir>`)
#   --yes, -y               Don't ask questions (non-interactive mode)
#   --remove-fxautoconfig   Also remove fx-autoconfig during uninstall
#   --zen-path <dir>        Zen Browser installation directory (the folder containing the zen
#                           binary; on macOS the Zen.app bundle)
#
# Without --profile, the installer uses the profile Zen opens by default plus every profile
# that already has ZenLeap; interactive runs show the list and let you change the choice.
#
# Environment (optional):
#   FX_AUTOCONFIG_DIR       use this local fx-autoconfig checkout instead of downloading it
#   FX_AUTOCONFIG_REF       fx-autoconfig commit/branch to download instead of the tested one
#
# What it does:
# 1. Installs fx-autoconfig if needed: the tested commit, SHA-256 verified. An
#    existing fx-autoconfig (e.g. from ZenRipple) is kept; interactive runs offer
#    to update a loader older than the tested one
# 2. Installs ZenLeap into <profile>/chrome/JS/
# 3. Clears the startup cache (or has Zen clear it on its next start)
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
ZEN_MIN_VERSION="1.21.7b"     # oldest Zen release ZenLeap supports
ZEN_TESTED_VERSION="1.22.3b"

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
GRE_DIRS=()
GRE_STATES=()
RUNNING=()
ZEN_WAS_RUNNING=false
ZEN_NEEDS_RESTART=false
INSTALLED_COUNT=0
QUIET=false

# >>> zen-paths.sh (generated from scripts/lib/zen-paths.sh by scripts/sync-lib.sh; edit it there)
# zen-paths.sh - Zen profile discovery, fx-autoconfig and ZenLeap release
# helpers shared by ZenLeap's shell scripts.
#
# This file is the single source of truth. install.sh and
# "ZenLeap Manager.app/Contents/MacOS/ZenLeapManager" carry an embedded copy
# (between the ">>> zen-paths.sh" / "<<< zen-paths.sh" marker lines) so they
# keep working when downloaded on their own (curl | bash, the .app bundle);
# install-plugin.sh and clean-legacy-css.sh source this file. After editing it,
# run scripts/sync-lib.sh (scripts/check-release.sh fails if a copy is stale).
# The ZenRipple installer follows the same rules; keep the two in step.
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
ZP_GITHUB_REPO="yashas-salankimatt/ZenLeap"

# fx-autoconfig commit tested with Zen 1.22.3b (Firefox 156; loader 0.10.16).
# The files the installers copy are checked against these hashes; another
# FX_AUTOCONFIG_REF is used unverified. Same pin as the ZenRipple installer
# and install.ps1 (scripts/check-release.sh compares them).
# shellcheck disable=SC2034  # used by the scripts that include this file
ZP_FXAC_PINNED_REF="dfdab5684faffc112b76ccb1d8cab7f75da0102c"
# shellcheck disable=SC2034
ZP_FXAC_PINNED_VERSION="0.10.16"   # @version of that commit's boot.sys.mjs
ZP_FXAC_SHA256="
80dc421264a3ea04275e1724b7b57234f89254e9582a6c17e9a911b65c3aa6d7  program/config.js
6bfd2ed139d18ff5178e0fc62a3b4058540ddbeba3adc912c0d69edb70c17ece  program/defaults/pref/config-prefs.js
1f0b37d765c7b10b963a465a62a420059e334a18b6b48bd8c09059837e676106  profile/chrome/utils/boot.sys.mjs
d80557b7bdd46f91f0d249f25f1bf66ed83f8c9e620cd0c9334029e4826924d0  profile/chrome/utils/chrome.manifest
1d6302c5484dc914e43685740937f1d89908099f835e53f532338822c31b08af  profile/chrome/utils/fs.sys.mjs
e7fca8757159751df080e5cbfcd27b508d98c5cdfd6434ea14247832418d1f63  profile/chrome/utils/module_loader.mjs
dc7547aecbaac67da94b54e353f8e306a0ca01b2a461e106cc88c63a2e210cac  profile/chrome/utils/uc_api.sys.mjs
3fb7c9799864ee01428722939f324acea1e6065cb63a9298e7bbc59e5adbd96a  profile/chrome/utils/utils.sys.mjs
"

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

# Path without trailing slashes
zp__strip_slash() {
    local p="$1"
    while [ "${#p}" -gt 1 ] && [ "${p%/}" != "$p" ]; do p=${p%/}; done
    printf '%s\n' "$p"
}

# Value of <key> in [<section>] of an INI file (CRs ignored)
zp_ini_value() {
    [ -f "$1" ] || return 0
    awk -v want="$2" -v key="$3" '
        { sub(/\r$/, "") }
        /^[ \t]*\[.*\][ \t]*$/ { s = $0; sub(/^[ \t]*\[/, "", s); sub(/\][ \t]*$/, "", s); sect = s; next }
        sect == want && index($0, key "=") == 1 { print substr($0, length(key) + 2); exit }
    ' "$1"
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
    ZP_SELECTED=()
}

# zp__add_profile <dir> <name> <local-dir> <root>
zp__add_profile() {
    if [ ! -d "$1" ]; then return 0; fi   # listed in profiles.ini but deleted
    if zp__in_list "$1" "${ZP_PROFILE_DIRS[@]}"; then return 0; fi
    ZP_PROFILE_DIRS+=("$1")
    ZP_PROFILE_NAMES+=("$2")
    ZP_PROFILE_LOCAL+=("$3")
    ZP_PROFILE_ROOT+=("$4")
}

# Print an INI file without CRs.
zp__ini_lines() {
    tr -d '\r' < "$1"
    printf '\n'
}

# zp__newest <dirs...>: position (0-based) of the directory whose prefs.js
# changed last, i.e. the profile used most recently.
zp__newest() {
    local best=0 i=0 d best_dir="$1"
    for d in "$@"; do
        if [ "$d/prefs.js" -nt "$best_dir/prefs.js" ]; then best=$i; best_dir="$d"; fi
        i=$((i + 1))
    done
    printf '%s\n' "$best"
}

# Read <root>/profiles.ini like Firefox does: [Profile0], [Profile1], ... up
# to the first missing section or one without IsRelative; entries without
# Name= or Path= are skipped. The root's default profile (the install's
# [Install*]/installs.ini Default=, else Default=1, else the most recently used;
# ties go to the install in app-dir, then to the most recently used) is listed
# first. Sets ZP__ROOT_DEFAULT to its index (-1 if the root adds nothing).
# Usage: zp__parse_root <root> <cache-root> [app-dir]
zp__parse_root() {
    local root="$1" cache_root="$2" app_dir="$3"
    local line section="" key val n dir want have pick i
    local s_name=() s_path=() s_rel=() s_def=() defaults=()
    local c_dir=() c_name=() c_local=() inst=() flagged=() all=() cands=()
    ZP__ROOT_DEFAULT=-1

    while IFS= read -r line; do
        case "$line" in
            \[*\]) section=${line#\[}; section=${section%\]}; continue ;;
            *=*) ;;
            *) continue ;;
        esac
        key=${line%%=*}
        val=${line#*=}
        case "$section" in
            Profile[0-9]*)
                n=${section#Profile}
                case "$n" in *[!0-9]*) continue ;; esac
                if [ "Profile$((10#$n))" != "$section" ]; then continue; fi   # e.g. Profile01
                n=$((10#$n))
                case "$key" in
                    Name) s_name[n]=$val ;;
                    Path) s_path[n]=$val ;;
                    IsRelative) s_rel[n]=$val ;;
                    Default) s_def[n]=$val ;;
                esac ;;
            General|BackgroundTasksProfiles|"") ;;
            *) if [ "$key" = "Default" ] && [ -n "$val" ]; then defaults+=("$val"); fi ;;   # [Install<hash>]
        esac
    done < <(zp__ini_lines "$root/profiles.ini")

    # installs.ini ([<hash>] Default=) mirrors the [Install*] sections.
    if [ -f "$root/installs.ini" ]; then
        section=""
        while IFS= read -r line; do
            case "$line" in
                \[*\]) section=${line#\[}; section=${section%\]} ;;
                Default=*) if [ -n "$section" ] && [ -n "${line#Default=}" ]; then defaults+=("${line#Default=}"); fi ;;
            esac
        done < <(zp__ini_lines "$root/installs.ini")
    fi

    n=0
    while [ -n "${s_rel[n]+set}" ]; do
        if [ -n "${s_path[n]:-}" ] && [ -n "${s_name[n]+set}" ]; then
            if [ "${s_rel[n]}" = "1" ]; then
                dir="$root/${s_path[n]}"
                have="$cache_root/${s_path[n]}"
            else
                dir="${s_path[n]}"
                have="$dir"      # absolute profiles keep their local data inside
            fi
            dir=$(zp__strip_slash "$dir")
            if [ -d "$dir" ] && ! zp__in_list "$dir" "${c_dir[@]}"; then
                c_dir+=("$dir")
                c_name+=("${s_name[n]}")
                c_local+=("$(zp__strip_slash "$have")")
                if [ "${s_def[n]:-}" = "1" ]; then flagged+=("$((${#c_dir[@]} - 1))"); fi
            fi
        fi
        n=$((n + 1))
    done
    if [ ${#c_dir[@]} -eq 0 ]; then return 0; fi

    # Which listed profiles are an install's default?
    for want in "${defaults[@]}"; do
        case "$want" in /*) ;; *) want="$root/$want" ;; esac
        want=$(zp__strip_slash "$want")
        for ((i = 0; i < ${#c_dir[@]}; i++)); do
            if [ "${c_dir[$i]}" = "$want" ] && ! zp__in_list "$i" "${inst[@]}"; then inst+=("$i"); fi
        done
    done

    pick=""
    if [ ${#inst[@]} -gt 1 ] && [ -n "$app_dir" ]; then
        want=$(zp__physical_dir "$app_dir")
        for i in "${inst[@]}"; do
            have=$(zp_ini_value "${c_dir[$i]}/compatibility.ini" Compatibility LastPlatformDir)
            if [ -n "$want" ] && [ -n "$have" ] && [ "$(zp__physical_dir "$have")" = "$want" ]; then
                pick=$i
                break
            fi
        done
    fi
    if [ -z "$pick" ]; then
        if [ ${#inst[@]} -gt 0 ]; then
            all=("${inst[@]}")
        elif [ ${#flagged[@]} -gt 0 ]; then
            all=("${flagged[@]}")
        else
            all=()
            for ((i = 0; i < ${#c_dir[@]}; i++)); do all+=("$i"); done
        fi
        for i in "${all[@]}"; do cands+=("${c_dir[$i]}"); done
        pick=${all[$(zp__newest "${cands[@]}")]}
    fi

    # The default first, then the rest in profiles.ini order
    ZP__ROOT_DEFAULT=${#ZP_PROFILE_DIRS[@]}
    zp__add_profile "${c_dir[$pick]}" "${c_name[$pick]}" "${c_local[$pick]}" "$root"
    for ((i = 0; i < ${#c_dir[@]}; i++)); do
        if [ "$i" != "$pick" ]; then
            zp__add_profile "${c_dir[$i]}" "${c_name[$i]}" "${c_local[$i]}" "$root"
        fi
    done
    if [ "${ZP_PROFILE_DIRS[$ZP__ROOT_DEFAULT]:-}" != "${c_dir[$pick]}" ]; then ZP__ROOT_DEFAULT=-1; fi
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
    local mode="${1:-native}" app_dir="${2:-}" root d base scan_hits=()
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
            scan_hits=()
            for d in "$base"/*/; do
                d=${d%/}
                if [ -f "$d/prefs.js" ] || [ -f "$d/times.json" ]; then scan_hits+=("$d"); fi
            done
            if [ ${#scan_hits[@]} -gt 0 ]; then
                for d in "${scan_hits[@]}"; do
                    zp__add_profile "$d" "${d##*/}" "$ZP_CACHE_ROOT/${d#"$root"/}" "$root"
                done
                ZP_ROOT=$root
                ZP_DEFAULT=$(zp__newest "${scan_hits[@]}")
                break
            fi
        done
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
    zp__add_profile "$want" "${want##*/}" "$want" ""
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

# Resolve a profile selection: "all", 1-based numbers ("2" or "1,3"), a
# profile name or a profile directory name. Sets ZP_SELECTED (0-based
# indices); returns 1 with ZP_ERROR.
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
    if [ ${#hit[@]} -eq 0 ]; then
        for ((i = 0; i < n; i++)); do
            if [ "${ZP_PROFILE_DIRS[$i]##*/}" = "$spec" ]; then hit+=("$i"); fi
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
        *zen*|*Zen*|*twilight*|*Twilight*) return 0 ;;
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

# Make Zen drop the startup cache of profile <i>: InvalidateCaches=1 in
# compatibility.ini makes Zen clear it at its next start (what about:support's
# "Clear startup cache" does), which also works while Zen is running. When the
# profile is not in use (<in-use> = false) the cache directories are removed
# right away too (in the local dir, and in the profile dir for profiles started
# with -profile). Returns 1 if there was nothing to do.
# Usage: zp_clear_startup_cache <i> [in-use]
zp_clear_startup_cache() {
    local dir="${ZP_PROFILE_DIRS[$1]}" compat d done_=1
    compat="$dir/compatibility.ini"
    if [ -f "$compat" ]; then
        if ! grep -qx 'InvalidateCaches=1' "$compat"; then
            if [ -n "$(tail -c 1 "$compat")" ]; then printf '\n' >> "$compat"; fi
            printf 'InvalidateCaches=1\n' >> "$compat"
        fi
        done_=0
    fi
    if [ "${2:-false}" != true ]; then
        for d in "${ZP_PROFILE_LOCAL[$1]}/startupCache" "$dir/startupCache"; do
            if [ -d "$d" ]; then
                rm -rf "$d" 2>/dev/null || true
                done_=0
            fi
        done
    fi
    return $done_
}

# Copy a file through a temporary name so an interrupted copy never leaves a
# half-written script behind.
zp_copy_file() {
    if cp "$1" "$2.zenleap-tmp" 2>/dev/null && mv -f "$2.zenleap-tmp" "$2" 2>/dev/null; then
        return 0
    fi
    rm -f "$2.zenleap-tmp" 2>/dev/null
    return 1
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

# zp_version_gte <a> <b>: true if dotted version a >= b ("1.22.3b" works).
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
    if [ -f "$1/chrome/JS/sine.sys.mjs" ] || [ -f "$1/chrome/sine-mods/mods.json" ]; then return 0; fi
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

# --- Zen installation and fx-autoconfig ------------------------------------

# True if <dir> is a Zen installation directory (GRE): where config.js goes.
zp_is_zen_dir() {
    [ -n "$1" ] && { [ -f "$1/omni.ja" ] || [ -f "$1/application.ini" ]; }
}

# The Zen installation that last ran profile <i> (compatibility.ini
# LastPlatformDir), if it is still there. Flatpak/AppImage paths (/app/...,
# /tmp/.mount_*) are not usable from outside and are skipped.
zp_profile_zen_dir() {
    local lp
    lp=$(zp_ini_value "${ZP_PROFILE_DIRS[$1]}/compatibility.ini" Compatibility LastPlatformDir)
    case "$lp" in
        ""|/app/*|/tmp/.mount_*) return 1 ;;
    esac
    if zp_is_zen_dir "$lp"; then printf '%s\n' "$(zp__strip_slash "$lp")"; return 0; fi
    return 1
}

# Zen version of an installation directory (application.ini), e.g. 1.22.3b
zp_zen_version() {
    zp_ini_value "$1/application.ini" App Version
}

# What an installation directory's autoconfig does at startup:
#   fxac          fx-autoconfig's config.js and a pref file that enables it
#   fxac-noprefs  fx-autoconfig's config.js, but no general.config.filename pref
#   sine          Sine's bootloader (runs only Sine mods)
#   foreign       some other autoconfig file (or an old fx-autoconfig)
#   missing       no config.js
zp_program_status() {
    if [ ! -f "$1/config.js" ]; then
        echo missing
    elif grep -q 'userchromejs/content/boot.sys.mjs' "$1/config.js" 2>/dev/null; then
        if grep -qs 'general.config.filename' "$1"/defaults/pref/*.js; then echo fxac; else echo fxac-noprefs; fi
    elif grep -q 'sine.sys.mjs' "$1/config.js" 2>/dev/null; then
        echo sine
    else
        echo foreign
    fi
}

# Download URL of an fx-autoconfig commit/branch as a zip archive
zp_fxac_url() {
    printf 'https://github.com/MrOtherGuy/fx-autoconfig/archive/%s.zip\n' "$1"
}

# Check an extracted fx-autoconfig tree against the pinned hashes: every
# listed file must match and chrome/utils must contain nothing else.
# Returns 1 with ZP_ERROR.
zp_fxac_verify() {
    local dir="$1" sum file extra
    while read -r sum file; do
        [ -n "$file" ] || continue
        if [ ! -f "$dir/$file" ]; then
            ZP_ERROR="fx-autoconfig download is missing $file"
            return 1
        fi
        if [ "$(zp_sha256 "$dir/$file")" != "$sum" ]; then
            ZP_ERROR="fx-autoconfig file $file does not match the tested version"
            return 1
        fi
    done <<EOF
$ZP_FXAC_SHA256
EOF
    for file in "$dir"/profile/chrome/utils/*; do
        extra="profile/chrome/utils/${file##*/}"
        if ! printf '%s\n' "$ZP_FXAC_SHA256" | grep -qF "  $extra"; then
            ZP_ERROR="fx-autoconfig download contains an unexpected file: $extra"
            return 1
        fi
    done
    return 0
}

# --- ZenLeap releases -------------------------------------------------------

# Tag of the latest ZenLeap release (e.g. v3.4.0). Uses the GitHub API and
# falls back to the releases/latest redirect (no API rate limit).
zp_latest_release_tag() {
    local json tag
    json=$(curl -sfL -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$ZP_GITHUB_REPO/releases/latest" 2>/dev/null) || json=""
    tag=$(printf '%s' "$json" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ -z "$tag" ]; then
        tag=$(curl -sfI "https://github.com/$ZP_GITHUB_REPO/releases/latest" 2>/dev/null | tr -d '\r' |
            sed -n 's|^[Ll]ocation:.*/releases/tag/||p' | tail -n 1)
    fi
    case "$tag" in
        ""|*[!A-Za-z0-9._-]*) return 1 ;;
    esac
    printf '%s\n' "$tag"
}

# Download ZenLeap release <tag> into <dest> (JS/zenleap.uc.js, and
# zenleap-themes.json when available) and verify it: the script's SHA-256
# must match the tag's CHECKSUMS.sha256 and its @version must match the tag.
# Returns 1 with ZP_ERROR on failure. Usage: zp_fetch_release <tag> <dest>
zp_fetch_release() {
    local tag="$1" dest="$2" raw expected actual version
    raw="https://raw.githubusercontent.com/$ZP_GITHUB_REPO/$tag"
    mkdir -p "$dest/JS"
    if ! curl -sfL "$raw/JS/zenleap.uc.js" -o "$dest/JS/zenleap.uc.js"; then
        ZP_ERROR="Failed to download zenleap.uc.js ($tag)"
        return 1
    fi
    if ! curl -sfL "$raw/CHECKSUMS.sha256" -o "$dest/CHECKSUMS.sha256"; then
        ZP_ERROR="Release $tag has no CHECKSUMS.sha256; refusing to install unverified code"
        return 1
    fi
    expected=$(awk '$2 == "JS/zenleap.uc.js" || $2 == "*JS/zenleap.uc.js" { print tolower($1); exit }' "$dest/CHECKSUMS.sha256")
    actual=$(zp_sha256 "$dest/JS/zenleap.uc.js")
    if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
        ZP_ERROR="zenleap.uc.js from $tag does not match the release's CHECKSUMS.sha256 (expected ${expected:-no entry}, got $actual); refusing to install it"
        return 1
    fi
    version=$(zp_file_version "$dest/JS/zenleap.uc.js")
    if [ "v$version" != "$tag" ] && [ "$version" != "$tag" ]; then
        ZP_ERROR="zenleap.uc.js from $tag reports version ${version:-?}; refusing to install it"
        return 1
    fi
    curl -sfL "$raw/zenleap-themes.json" -o "$dest/zenleap-themes.json" 2>/dev/null || rm -f "$dest/zenleap-themes.json"
    return 0
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

# Download the latest release into $1 and verify it (see zp_fetch_release)
download_release() {
    local tag
    echo "  Looking up the latest ZenLeap release..."
    if ! tag=$(zp_latest_release_tag); then
        echo -e "${RED}Error: Could not determine the latest ZenLeap release (network?)${NC}"
        return 1
    fi
    echo "  Downloading ZenLeap $tag from GitHub..."
    if ! zp_fetch_release "$tag" "$1"; then
        echo -e "${RED}Error: $ZP_ERROR${NC}"
        return 1
    fi
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
# session). --yes continues and asks for a restart at the end. Profiles still
# open afterwards are recorded in RUNNING.
check_zen_running() {
    local i pid ans names=()
    while true; do
        RUNNING=()
        names=()
        for i in "${ZP_SELECTED[@]}"; do
            if pid=$(zp_profile_pid "${ZP_PROFILE_DIRS[$i]}"); then
                RUNNING+=("$i")
                names+=("${ZP_PROFILE_NAMES[$i]} (PID $pid)")
            fi
        done
        # Flatpak runs Zen in its own PID namespace, so the lock PID is useless there
        if [ "$IS_FLATPAK" = true ] && command -v flatpak >/dev/null 2>&1 && \
           flatpak ps --columns=application 2>/dev/null | grep -qx "$ZP_FLATPAK_ID"; then
            RUNNING=("${ZP_SELECTED[@]}")
            names=("Flatpak Zen")
        fi
        if [ ${#RUNNING[@]} -eq 0 ]; then
            return 0
        fi

        warn "Zen is running with:"
        printf '    %s\n' "${names[@]}"
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

is_running() {
    zp__in_list "$1" "${RUNNING[@]}"
}

# The Zen installation a profile runs with: --zen-path (or the Flatpak
# systemconfig dir), else the one that last ran it (compatibility.ini), else
# the one found on this system. Prints nothing if unknown.
profile_zen_dir() {
    if [ -n "$CUSTOM_ZEN_PATH" ] || [ "$IS_FLATPAK" = true ]; then
        echo "$ZEN_RESOURCES"
    elif ! zp_profile_zen_dir "$1"; then
        echo "$ZEN_RESOURCES"
    fi
}

# Remember what each Zen installation's loader looks like (ok, pending,
# foreign, sine), so every installation is handled once.
gre_state() {
    local i
    for ((i = 0; i < ${#GRE_DIRS[@]}; i++)); do
        if [ "${GRE_DIRS[$i]}" = "$1" ]; then echo "${GRE_STATES[$i]}"; return 0; fi
    done
    return 1
}
set_gre_state() {
    GRE_DIRS+=("$1")
    GRE_STATES+=("$2")
}

# Download fx-autoconfig (once per run) into $FXAC_SRC: the pinned, tested
# commit, verified file by file. FX_AUTOCONFIG_DIR (a local checkout) and
# FX_AUTOCONFIG_REF (another commit/branch) are used unverified.
fxac_fetch() {
    local dir ref
    if [ -n "$FXAC_SRC" ]; then
        return 0
    fi
    if [ "$FXAC_FAILED" = true ]; then
        return 1
    fi
    FXAC_FAILED=true
    if [ -n "${FX_AUTOCONFIG_DIR:-}" ]; then
        if [ ! -f "$FX_AUTOCONFIG_DIR/program/config.js" ] || [ ! -f "$FX_AUTOCONFIG_DIR/profile/chrome/utils/boot.sys.mjs" ]; then
            ZP_ERROR="FX_AUTOCONFIG_DIR=$FX_AUTOCONFIG_DIR is not an fx-autoconfig checkout"
            return 1
        fi
        FXAC_SRC="$(cd "$FX_AUTOCONFIG_DIR" && pwd)"
        warn "Using fx-autoconfig from $FXAC_SRC (FX_AUTOCONFIG_DIR, not verified)"
    else
        ref="${FX_AUTOCONFIG_REF:-$ZP_FXAC_PINNED_REF}"
        work_dir
        dir="$WORK_DIR/fxac-download"
        rm -rf "$dir"
        mkdir -p "$dir"
        echo "  Downloading fx-autoconfig..."
        if command -v curl &> /dev/null; then
            curl -sfL "$(zp_fxac_url "$ref")" -o "$dir/fxautoconfig.zip" || { ZP_ERROR="download failed"; return 1; }
        elif command -v wget &> /dev/null; then
            wget -q "$(zp_fxac_url "$ref")" -O "$dir/fxautoconfig.zip" || { ZP_ERROR="download failed"; return 1; }
        else
            ZP_ERROR="neither curl nor wget found"
            return 1
        fi
        if command -v unzip &> /dev/null; then
            unzip -q "$dir/fxautoconfig.zip" -d "$dir" || { ZP_ERROR="could not extract the archive"; return 1; }
        elif command -v python3 &> /dev/null; then
            python3 -m zipfile -e "$dir/fxautoconfig.zip" "$dir" || { ZP_ERROR="could not extract the archive"; return 1; }
        else
            ZP_ERROR="unzip not found (install unzip and run again)"
            return 1
        fi
        dir=$(find "$dir" -mindepth 1 -maxdepth 1 -type d -name "fx-autoconfig*" | head -n 1)
        if [ -z "$dir" ] || [ ! -f "$dir/profile/chrome/utils/boot.sys.mjs" ] || [ ! -f "$dir/program/config.js" ]; then
            ZP_ERROR="unexpected fx-autoconfig archive layout"
            return 1
        fi
        if [ "$ref" = "$ZP_FXAC_PINNED_REF" ]; then
            zp_fxac_verify "$dir" || return 1
        else
            warn "Using fx-autoconfig $ref (FX_AUTOCONFIG_REF: not the tested version, not verified)"
        fi
        FXAC_SRC="$dir"
    fi
    FXAC_VERSION=$(zp_file_version "$FXAC_SRC/profile/chrome/utils/boot.sys.mjs")
    FXAC_FAILED=false
}

# fx-autoconfig's program files (config.js + defaults/pref/config-prefs.js) go
# into a Zen installation directory, once for all its profiles. An existing
# config.js is never replaced: fx-autoconfig's is kept as it is (only a
# missing pref file is added), Sine's or any other one is left alone.
ensure_fxautoconfig_program() {
    local dir="$1" status stage ans cmds="" version
    if gre_state "$dir" >/dev/null; then
        return 0
    fi
    version=$(zp_zen_version "$dir")
    if [ -n "$version" ] && ! zp_version_gte "$version" "$ZEN_MIN_VERSION"; then
        warn "Zen $version in $dir is older than $ZEN_MIN_VERSION, the oldest version ZenLeap supports (tested: $ZEN_TESTED_VERSION)."
    fi
    status=$(zp_program_status "$dir")
    case "$status" in
        fxac)
            ok "fx-autoconfig is set up in $dir"
            set_gre_state "$dir" ok
            return 0
            ;;
        sine)
            warn "$dir starts Sine's bootloader, which only runs Sine mods."
            set_gre_state "$dir" sine
            return 0
            ;;
        foreign)
            warn "$dir/config.js is not fx-autoconfig's (another loader, or an old fx-autoconfig); leaving it alone."
            echo "  ZenLeap in chrome/JS only loads if that file loads fx-autoconfig's boot.sys.mjs."
            set_gre_state "$dir" foreign
            return 0
            ;;
    esac

    echo -e "${BLUE}Installing fx-autoconfig into the Zen installation ($dir)...${NC}"
    fxac_fetch || die "Could not get fx-autoconfig: $ZP_ERROR"
    if mkdir -p "$dir/defaults/pref" 2>/dev/null && \
       { [ "$status" != "missing" ] || zp_copy_file "$FXAC_SRC/program/config.js" "$dir/config.js"; } && \
       zp_copy_file "$FXAC_SRC/program/defaults/pref/config-prefs.js" "$dir/defaults/pref/config-prefs.js" && \
       [ "$(zp_program_status "$dir")" = "fxac" ]; then
        ok "Installed fx-autoconfig's loader files into $dir"
        set_gre_state "$dir" ok
        return 0
    fi

    # Needs administrator rights. Don't run sudo from here; print the commands.
    stage="$(user_cache_dir)/zenleap/fx-autoconfig-program"
    rm -rf "$stage"
    mkdir -p "$stage"
    cp "$FXAC_SRC/program/config.js" "$FXAC_SRC/program/defaults/pref/config-prefs.js" "$stage/"
    if [ "$status" = "missing" ]; then
        cmds=$(printf '    sudo cp %q %q' "$stage/config.js" "$dir/config.js")$'\n'
    fi
    cmds="$cmds$(printf '    sudo mkdir -p %q' "$dir/defaults/pref")"$'\n'
    cmds="$cmds$(printf '    sudo cp %q %q' "$stage/config-prefs.js" "$dir/defaults/pref/config-prefs.js")"
    FXAC_PROGRAM_CMDS="${FXAC_PROGRAM_CMDS:+$FXAC_PROGRAM_CMDS$'\n'}$cmds"
    warn "Copying fx-autoconfig into $dir needs administrator rights."
    echo "  Run these commands in a terminal:"
    echo ""
    echo "$cmds"
    echo ""
    if [ "$OS" = "macos" ]; then
        echo "  macOS may block changes inside an app bundle: allow your terminal under"
        echo "  System Settings > Privacy & Security > App Management first."
    fi
    if [ "$AUTO_YES" != true ]; then
        while true; do
            echo -n "  Press Enter once you've run them, or 's' to skip for now: "
            read -r ans <&3 || ans="s"
            case "$ans" in
                s|S) break ;;
            esac
            if [ "$(zp_program_status "$dir")" = "fxac" ]; then
                ok "fx-autoconfig is set up in $dir"
                set_gre_state "$dir" ok
                return 0
            fi
            warn "Still missing: $dir/config.js or its pref file in $dir/defaults/pref"
        done
    fi
    FXAC_PROGRAM_PENDING=true
    set_gre_state "$dir" pending
}

# fx-autoconfig's loader in the profile: <profile>/chrome/utils (only that
# folder; the rest of fx-autoconfig's profile/ dir is examples). An existing
# loader is left alone, except that interactive runs offer to update one older
# than the tested version (kept as chrome/utils.zenleap-backup).
ensure_fxautoconfig_profile() {
    local utils="$CHROME_DIR/utils" have target ans
    if [ -f "$utils/boot.sys.mjs" ] || [ -f "$utils/boot.jsm" ]; then
        have=$(zp_file_version "$utils/boot.sys.mjs")
        # The loader version this installer would install (no download needed
        # for the tested one; not in a subshell, fxac_fetch sets globals)
        target="$ZP_FXAC_PINNED_VERSION"
        if [ -n "${FX_AUTOCONFIG_DIR:-}" ] || [ -n "${FX_AUTOCONFIG_REF:-}" ]; then
            target=""
            if fxac_fetch; then target="$FXAC_VERSION"; fi
        fi
        if [ -z "$target" ] || { [ -n "$have" ] && zp_version_gte "$have" "$target"; }; then
            ok "fx-autoconfig loader ${have:-} already installed"
            return 0
        fi
        warn "This profile's fx-autoconfig loader is older than the tested one (${have:-pre-0.8} < $target)."
        if [ "$AUTO_YES" = true ]; then
            echo "  Leaving it as it is; run the installer without --yes to update it."
            return 0
        fi
        echo -n "  Update chrome/utils to $target? (Y/n): "
        read -r ans <&3 || ans="n"
        case "$ans" in
            n|N|no|No)
                echo "  Keeping the installed loader"
                return 0
                ;;
        esac
        fxac_fetch || die "Could not get fx-autoconfig: $ZP_ERROR"
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
    fxac_fetch || die "Could not get fx-autoconfig: $ZP_ERROR"
    mkdir -p "$CHROME_DIR"
    rm -rf "$utils"
    cp -R "$FXAC_SRC/profile/chrome/utils" "$utils"
    ok "Installed fx-autoconfig loader (chrome/utils, $FXAC_VERSION)"
}

# Does profile $1 get ZenLeap through fx-autoconfig (not through Sine)?
needs_fxautoconfig() {
    local dir="${ZP_PROFILE_DIRS[$1]}"
    ! zp_sine_zenleap_dir "$dir" >/dev/null && ! zp_profile_uses_sine "$dir"
}

# Install ZenLeap into the current profile ($1: its Zen installation's loader state)
install_zenleap() {
    local gre_status="$1" version sine_dir ans
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
        zp_copy_file "$SOURCE_DIR/JS/zenleap.uc.js" "$sine_dir/JS/zenleap.uc.js" || die "Could not write $sine_dir/JS/zenleap.uc.js"
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
    if zp_profile_uses_sine "$PROFILE_DIR" || [ "$gre_status" = "sine" ]; then
        if zp_profile_uses_sine "$PROFILE_DIR"; then
            warn "This profile loads scripts through Sine, which does not run scripts from chrome/JS."
        else
            warn "This Zen installation starts Sine's bootloader, which does not run scripts from chrome/JS."
        fi
        echo "  Install ZenLeap from Sine instead (Sine mods page -> install yashas-salankimatt/ZenLeap)."
        return 0
    fi

    ensure_fxautoconfig_profile

    mkdir -p "$JS_DIR"
    zp_copy_file "$SOURCE_DIR/JS/zenleap.uc.js" "$JS_DIR/zenleap.uc.js" || die "Could not write $JS_DIR/zenleap.uc.js"
    ok "Installed zenleap.uc.js (v$version)"

    # Installers up to 3.4 appended chrome.css to userChrome.css. ZenLeap
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
    local found_anything=false

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

    if zp_sine_zenleap_dir "$PROFILE_DIR" >/dev/null; then
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

# Remove fx-autoconfig's program files from Zen installation $1 (only if they
# are fx-autoconfig's)
uninstall_fxautoconfig_program() {
    local dir="$1" f failed=()
    case "$(zp_program_status "$dir")" in
        fxac|fxac-noprefs) ;;
        missing) return 0 ;;
        *)
            warn "$dir/config.js is not fx-autoconfig's; leaving it alone"
            return 0
            ;;
    esac
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

# Clear the startup cache of the selected profiles (see zp_clear_startup_cache)
clear_cache() {
    local i any=false later=false in_use
    echo ""
    echo -e "${BLUE}Clearing startup cache...${NC}"
    for i in "${ZP_SELECTED[@]}"; do
        in_use=false
        if is_running "$i"; then
            in_use=true
            later=true
        fi
        if zp_clear_startup_cache "$i" "$in_use"; then
            any=true
        fi
    done
    if [ "$later" = true ]; then
        ok "Zen will clear its startup cache when it next starts"
    elif [ "$any" = true ]; then
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
    local i gre response
    local profile_gres=()
    detect_os false
    choose_profiles install
    if [ ${#ZP_SELECTED[@]} -eq 0 ]; then
        die "No profile selected"
    fi
    prepare_source
    check_zen_running

    # fx-autoconfig's program files, once per Zen installation in use
    for i in "${ZP_SELECTED[@]}"; do
        if needs_fxautoconfig "$i"; then
            gre=$(profile_zen_dir "$i")
            if [ -z "$gre" ]; then
                prompt_zen_path
                gre="$ZEN_RESOURCES"
            fi
            profile_gres[i]="$gre"
            ensure_fxautoconfig_program "$gre"
        fi
    done

    for i in "${ZP_SELECTED[@]}"; do
        set_profile_paths "$i"
        echo ""
        echo -e "${BLUE}--- ${ZP_PROFILE_NAMES[$i]} ---${NC}"
        install_zenleap "$(gre_state "${profile_gres[i]:-}" || true)"
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
    local i gre response remove_fx=false any_fx=false
    local gres=()
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
        gre=$(profile_zen_dir "$i")
        if [ -n "$gre" ] && ! zp__in_list "$gre" "${gres[@]}"; then
            gres+=("$gre")
            case "$(zp_program_status "$gre")" in
                fxac|fxac-noprefs) any_fx=true ;;
            esac
        fi
    done
    if [ "$any_fx" = true ]; then
        if [ "$AUTO_YES" = true ]; then
            if [ "$REMOVE_FXAUTOCONFIG" = true ]; then
                remove_fx=true
            else
                echo -e "${YELLOW}Skipping fx-autoconfig removal (use --remove-fxautoconfig to include)${NC}"
            fi
        else
            echo ""
            echo -n "Also remove fx-autoconfig? Other userscripts (e.g. ZenRipple) may depend on it. (y/n): "
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
        for gre in "${gres[@]}"; do
            uninstall_fxautoconfig_program "$gre"
        done
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

    if tag=$(zp_latest_release_tag); then
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
    echo "  --profile <sel>         Profile(s): number from the list (1 = the profile Zen opens"
    echo "                          by default), profile or directory name, or \"all\"; repeatable."
    echo "                          Default: the profile Zen opens by default plus every"
    echo "                          profile that already has ZenLeap"
    echo "  --all-profiles          Same as --profile all"
    echo "  --profile-dir <dir>     Use this profile directory directly"
    echo "  --yes, -y               Don't ask questions (non-interactive mode)"
    echo "  --remove-fxautoconfig   Also remove fx-autoconfig during uninstall"
    echo "  --zen-path <dir>        Zen Browser installation directory (default: the one that last"
    echo "                          ran the profile, else a standard location)"
    echo ""
    echo "Environment: FX_AUTOCONFIG_DIR=<checkout> or FX_AUTOCONFIG_REF=<commit> to use another"
    echo "fx-autoconfig than the tested, SHA-256 verified commit."
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
            PROFILE_SPEC="${PROFILE_SPEC:+$PROFILE_SPEC,}$1"
            ;;
        --all-profiles)
            PROFILE_SPEC="all"
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
