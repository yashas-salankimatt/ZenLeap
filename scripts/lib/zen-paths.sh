# shellcheck shell=bash
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
