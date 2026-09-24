# shellcheck shell=bash
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
# fx-autoconfig's example files (unchanged since 2024). ZenLeap installers up
# to 3.4 copied them into every profile; test.uc.js logs "Hi mom, I'm loaded!"
# in every window. Only byte-identical copies are offered for removal.
# shellcheck disable=SC2034
ZP_FXAC_EXAMPLES_SHA256="
de6ddbef85afd6b68ffa66243ffe802bd16f31db36fbb8c78f122c99f54516e4  profile/chrome/JS/test.uc.js
1abbcad61de45c1507a286098db059d8cb3fe7ca63fb514d7f71a16e9914b4ff  profile/chrome/JS/userChrome_ag_css.sys.mjs
09543f005ec2aa9ffe68063aa3a3375d0bcef7892bde1244dc917b0e40ba1019  profile/chrome/JS/userChrome_au_css.uc.js
6b6d576dd8c2e3ac79f02a9ef1ebc8a8d3194a77dd9f6ee7fdf75b5e3dc50f0c  profile/chrome/CSS/agent_style.uc.css
fd0925fdbae19e3c3503ec0e2624bfeadbf63b08d4cb1e7000e899b158c393c5  profile/chrome/CSS/author_style.uc.css
6a22fa309f93b22a82b22d06135d69d85c6e782f84fad510bdb7ff46d79ccbe1  profile/chrome/resources/userChrome.ag.css
23453d331dfaf7b0b01fc7a8d220e21bdedd568b48c2d26cb05a256704850f74  profile/chrome/resources/userChrome.au.css
"
ZP_BOM=$'\xef\xbb\xbf'
ZP_US=$'\037'   # field separator for zp_autoconfig_setting

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

# Print an INI file the way Firefox's INI parser (nsINIParser) reads it: one
# "[section]" or "key=value" line per entry, without the UTF-8 BOM, CRs,
# leading blanks and comment lines. A malformed section header ("[Profile1]x",
# "[Profile1") prints "[]", so the keys under it are ignored, as by Firefox.
zp__ini_lines() {
    local line first=true name rest
    while IFS= read -r line || [ -n "$line" ]; do
        if [ "$first" = true ]; then
            line=${line#"$ZP_BOM"}
            first=false
        fi
        line=${line#"${line%%[![:blank:]]*}"}
        case "$line" in
            ""|\;*|\#*) ;;
            \[*)
                name=${line#\[}
                case "$name" in
                    *\]*)
                        rest=${name#*\]}
                        name=${name%%\]*}
                        case "$rest" in *[![:blank:]]*) name="" ;; esac
                        ;;
                    *) name="" ;;
                esac
                printf '[%s]\n' "$name"
                ;;
            *=*) printf '%s\n' "$line" ;;
        esac
    done < <(tr -d '\r' < "$1")
}

# Value of <key> in [<section>] of an INI file (the last one, like Firefox)
zp_ini_value() {
    local line section="" value="" found=false
    [ -f "$1" ] || return 0
    while IFS= read -r line; do
        case "$line" in
            \[*\]) section=${line#\[}; section=${section%\]} ;;
            "$3="*)
                if [ "$section" = "$2" ]; then
                    value=${line#"$3="}
                    found=true
                fi
                ;;
        esac
    done < <(zp__ini_lines "$1")
    if [ "$found" = true ]; then printf '%s\n' "$value"; fi
    return 0
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

# Add one explicit profile directory (e.g. one started with
# `zen -profile <dir>`) to ZP_SELECTED. A directory that zp_discover already
# found keeps its name and local dir; any other directory is added with itself
# as local dir, which is what Firefox does for -profile.
zp_use_profile_dir() {
    local want i pick=""
    want=$(zp__physical_dir "$1")
    if [ -z "$want" ]; then
        ZP_ERROR="Profile directory not found: $1"
        return 1
    fi
    for ((i = 0; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
        if [ "$(zp__physical_dir "${ZP_PROFILE_DIRS[$i]}")" = "$want" ]; then
            pick=$i
            break
        fi
    done
    if [ -z "$pick" ]; then
        zp__add_profile "$want" "${want##*/}" "$want" ""
        pick=$(( ${#ZP_PROFILE_DIRS[@]} - 1 ))
    fi
    if ! zp__in_list "$pick" "${ZP_SELECTED[@]}"; then ZP_SELECTED+=("$pick"); fi
    return 0
}

# True if <dir> looks like a profile Zen has used (a typo such as the home
# directory must not get a chrome/ folder).
zp_is_profile_dir() {
    [ -f "$1/prefs.js" ] || [ -f "$1/times.json" ] || [ -f "$1/compatibility.ini" ]
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

# The union of several selections, each resolved like zp_select (e.g. from
# repeated --profile options: a name, "2,3" and "all" can be mixed).
# Sets ZP_SELECTED; returns 1 with ZP_ERROR.
zp_select_specs() {
    local spec i acc=()
    for spec in "$@"; do
        zp_select "$spec" || return 1
        for i in "${ZP_SELECTED[@]}"; do
            if ! zp__in_list "$i" "${acc[@]}"; then acc+=("$i"); fi
        done
    done
    ZP_SELECTED=("${acc[@]}")
    return 0
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
# too. A file with nothing else in it (the old installers created it) is
# deleted; callers keep a backup. Returns 1 if the file has no block.
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
    if ! grep -q '[^[:space:]]' "$file" 2>/dev/null; then
        rm -f "$file"
    fi
    return 0
}

# SHA-256 of a file as lowercase hex. The file is read from stdin: given a
# name containing "\", GNU sha256sum escapes it and prefixes the hash with "\".
zp_sha256() {
    local out
    if command -v sha256sum >/dev/null 2>&1; then
        out=$(sha256sum < "$1")
    elif command -v shasum >/dev/null 2>&1; then
        out=$(shasum -a 256 < "$1")
    else
        out=$(openssl dgst -sha256 -r < "$1")
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

# Which loader runs the scripts of <profile-dir>. What runs is decided by the
# Zen installation's config.js (<program-status>, see zp_program_status; empty
# if unknown) and the profile's chrome/utils, not by other files in the profile:
#   fxac     fx-autoconfig runs chrome/JS: its loader is in chrome/utils, or
#            chrome/utils is empty (the installers add it)
#   sine     Sine's bootloader, which only runs Sine mods: Zen's config.js is
#            Sine's, or chrome/utils is Sine's (its chrome.manifest maps sine-mods)
#   foreign  chrome/utils holds some other loader
# Sine can also run on top of fx-autoconfig (chrome/JS/sine.sys.mjs); that
# profile is "fxac" (its chrome/JS scripts run too), see zp_sine_active.
zp_profile_loader() {
    local utils="$1/chrome/utils"
    if [ "$2" = sine ] || [ "$2" = sine-noprefs ]; then
        echo sine
    elif [ -f "$utils/boot.sys.mjs" ] || [ -f "$utils/boot.jsm" ]; then
        echo fxac
    elif [ -z "$(ls -A "$utils" 2>/dev/null)" ]; then
        echo fxac
    elif grep -qs 'sine-mods' "$utils/chrome.manifest"; then
        echo sine
    else
        echo foreign
    fi
}

# True if Sine runs (or is set up to run) in <profile-dir>: through its
# bootloader, or through fx-autoconfig (chrome/JS/sine.sys.mjs; sine.uc.mjs in
# older Sine versions). A chrome/sine-mods folder alone is no evidence: it
# stays behind when Sine is removed.
# Usage: zp_sine_active <profile-dir> <program-status>
zp_sine_active() {
    case "$(zp_profile_loader "$1" "$2")" in
        sine) return 0 ;;
        fxac)
            if [ -f "$1/chrome/JS/sine.sys.mjs" ] || [ -f "$1/chrome/JS/sine.uc.mjs" ]; then return 0; fi ;;
    esac
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

# Scripts in <profile-dir>/chrome/JS that need fx-autoconfig besides ZenLeap
# (e.g. ZenRipple), one file name per line. fx-autoconfig's own examples
# don't count.
zp_other_scripts() {
    local f examples
    examples=$(zp_fxac_examples "$1")
    for f in "$1"/chrome/JS/*.uc.js "$1"/chrome/JS/*.uc.mjs "$1"/chrome/JS/*.sys.mjs; do
        if [ ! -f "$f" ] || [ "${f##*/}" = zenleap.uc.js ]; then continue; fi
        if printf '%s\n' "$examples" | grep -qxF "chrome/JS/${f##*/}"; then continue; fi
        printf '%s\n' "${f##*/}"
    done
    return 0
}

# fx-autoconfig example files in <profile-dir> that are byte-identical to
# fx-autoconfig's (see ZP_FXAC_EXAMPLES_SHA256), as "chrome/JS/test.uc.js" etc.
zp_fxac_examples() {
    local sum file
    while read -r sum file; do
        [ -n "$file" ] || continue
        file="chrome/${file#profile/chrome/}"
        if [ -f "$1/$file" ] && [ "$(zp_sha256 "$1/$file")" = "$sum" ]; then
            printf '%s\n' "$file"
        fi
    done <<EOF
$ZP_FXAC_EXAMPLES_SHA256
EOF
    return 0
}

# Folders next to the profiles that are not profiles but hold ZenLeap files:
# installers up to 3.4 treated every folder in the profile root as a profile
# (Profile Groups/, Crash Reports/, Pending Pings/, ...). Looks in the roots of
# the profiles zp_discover found; prints one folder per line.
zp_leftover_dirs() {
    local i root d roots=()
    for ((i = 0; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
        root=${ZP_PROFILE_ROOT[$i]}
        if [ -n "$root" ] && ! zp__in_list "$root" "${roots[@]}"; then roots+=("$root"); fi
    done
    for root in "${roots[@]}"; do
        for d in "$root"/*/ "$root"/Profiles/*/; do
            d=${d%/}
            if [ -f "$d/chrome/JS/zenleap.uc.js" ] && ! zp_is_profile_dir "$d" && \
               ! zp__in_list "$d" "${ZP_PROFILE_DIRS[@]}"; then
                printf '%s\n' "$d"
            fi
        done
    done
    return 0
}

# What installers up to 3.4 left in a non-profile folder <dir> (see
# zp_leftover_dirs): its chrome/ folder, and user.js when it holds nothing but
# the stylesheet pref they added. One path per line.
zp_leftover_files() {
    printf '%s\n' "$1/chrome"
    if [ -f "$1/user.js" ] && \
       ! grep -v -e '^[[:space:]]*$' -e 'toolkit\.legacyUserProfileCustomizations\.stylesheets' "$1/user.js" >/dev/null 2>&1; then
        printf '%s\n' "$1/user.js"
    fi
    return 0
}

# True if the Flatpak Zen is installed. Its data folder in ~/.var/app is no
# evidence: `flatpak uninstall` leaves it behind.
zp_flatpak_installed() {
    command -v flatpak >/dev/null 2>&1 && flatpak info "$ZP_FLATPAK_ID" >/dev/null 2>&1
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

# Value of a string pref in a default-prefs file (the last line that sets it
# wins; commented-out lines don't count). Fails if the file doesn't set it.
# Usage: zp_pref_file_value <file> <pref-name>
zp_pref_file_value() {
    awk -v key="$2" '
        BEGIN { sep = "^[ \t]*,[ \t]*[\"\047]" }
        { line = $0; sub(/\r$/, "", line) }
        line ~ /^[ \t]*\/\// { next }
        {
            i = index(line, "\"" key "\""); if (i == 0) i = index(line, "\047" key "\047"); if (i == 0) next
            rest = substr(line, i + length(key) + 2)
            if (match(rest, sep)) {
                q = substr(rest, RLENGTH, 1); rest = substr(rest, RLENGTH + 1)
                j = index(rest, q); if (j > 0) { val = substr(rest, 1, j - 1); found = 1 }
            }
        }
        END { if (found) print val; else exit 1 }
    ' "$1" 2>/dev/null
}

# The autoconfig file an installation directory runs (general.config.filename,
# relative to it) and the pref file that sets it, as "<value><ZP_US><file>";
# nothing when no file sets it. Zen reads <dir>/defaults/pref/*.js in reverse
# alphabetical order, then <dir>/browser/defaults/preferences/*.js, and the
# last value read wins (verified with Zen 1.22.3b; the same as the ZenRipple
# installer).
zp_autoconfig_setting() {
    local layer f v out=""
    for layer in "$1/defaults/pref" "$1/browser/defaults/preferences"; do
        [ -d "$layer" ] || continue
        while IFS= read -r f; do
            if v=$(zp_pref_file_value "$f" general.config.filename); then out="$v$ZP_US$f"; fi
        done < <(find "$layer" -maxdepth 1 \( -type f -o -type l \) -iname '*.js' 2>/dev/null | LC_ALL=C sort -r)
    done
    if [ -n "$out" ]; then printf '%s\n' "$out"; fi
    return 0
}

# What an installation directory's autoconfig does at startup (the file that
# general.config.filename names; config.js when no pref names one):
#   fxac          fx-autoconfig's config.js, and a pref that makes Zen run it
#   fxac-noprefs  fx-autoconfig's config.js, but no pref makes Zen run it
#   sine          Sine's bootloader, which runs only Sine mods (sine-noprefs:
#                 its config.js without the pref)
#   foreign       Zen runs some other autoconfig file (an enterprise
#                 mozilla.cfg, an old fx-autoconfig, ...), or autoconfig is
#                 switched off (an empty general.config.filename)
#   missing       no config.js (and no pref naming another file)
# Same classes as the ZenRipple installer.
zp_program_status() {
    local setting file suffix=""
    setting=$(zp_autoconfig_setting "$1")
    if [ -z "$setting" ]; then
        file=config.js
        suffix=-noprefs
    else
        file=${setting%%"$ZP_US"*}
    fi
    case "$file" in
        ""|*/*) echo foreign; return 0 ;;
    esac
    if [ ! -f "$1/$file" ]; then
        if [ "$file" = config.js ]; then echo missing; else echo foreign; fi
    elif grep -q 'userchromejs/content/boot.sys.mjs' "$1/$file" 2>/dev/null; then
        echo "fxac$suffix"
    elif grep -q 'sine.sys.mjs' "$1/$file" 2>/dev/null; then
        echo "sine$suffix"
    else
        echo foreign
    fi
}

# For messages: the autoconfig file an installation directory runs and where
# that is set.
zp_describe_autoconfig() {
    local setting file src
    setting=$(zp_autoconfig_setting "$1")
    if [ -z "$setting" ]; then
        printf '%s\n' "$1/config.js"
        return 0
    fi
    file=${setting%%"$ZP_US"*}
    src=${setting#*"$ZP_US"}
    if [ -z "$file" ]; then
        printf 'autoconfig switched off (general.config.filename is empty in %s)\n' "$src"
    else
        printf '%s (general.config.filename in %s)\n' "$1/$file" "$src"
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
    # Every entry (hidden ones too) must be listed, by its exact name
    while IFS= read -r file; do
        extra="profile/chrome/utils/${file##*/}"
        if ! printf '%s\n' "$ZP_FXAC_SHA256" | awk -v f="$extra" '$2 == f { found = 1 } END { exit !found }'; then
            ZP_ERROR="fx-autoconfig download contains an unexpected file: $extra"
            return 1
        fi
    done < <(find "$dir/profile/chrome/utils" -mindepth 1 -maxdepth 1 2>/dev/null)
    return 0
}

# Copy fx-autoconfig's loader (profile/chrome/utils of the tree <src>) to
# <dest> (a profile's chrome/utils). From the tested version (<verified> =
# true) exactly the pinned files are copied and each copy is checked; any other
# version is copied as it is. Returns 1 with ZP_ERROR (and no <dest> left).
# Usage: zp_fxac_copy_utils <src> <dest> <verified>
zp_fxac_copy_utils() {
    local src="$1/profile/chrome/utils" dest="$2" sum file
    rm -rf "$dest"
    if ! mkdir -p "$dest"; then
        ZP_ERROR="could not create $dest"
        return 1
    fi
    if [ "$3" = true ]; then
        while read -r sum file; do
            case "$file" in profile/chrome/utils/*) ;; *) continue ;; esac
            if ! cp "$1/$file" "$dest/${file##*/}" 2>/dev/null || \
               [ "$(zp_sha256 "$dest/${file##*/}")" != "$sum" ]; then
                rm -rf "$dest"
                ZP_ERROR="the copy of $file does not match the tested version"
                return 1
            fi
        done <<EOF
$ZP_FXAC_SHA256
EOF
    elif ! cp -R "$src/." "$dest/" 2>/dev/null; then
        rm -rf "$dest"
        ZP_ERROR="could not copy $src to $dest"
        return 1
    fi
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
