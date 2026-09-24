#!/bin/bash
# ZenLeap Legacy CSS Cleaner
# Usage: ./clean-legacy-css.sh [OPTIONS]
#
# Removes the ZenLeap block that installers up to 3.4 appended to
# userChrome.css (the pre-3.1 CSS in it conflicts with the runtime theme
# engine). Only the content between the ZenLeap marker comments is removed;
# all other CSS (from other mods, user customizations) is preserved, and the
# previous file is saved as userChrome.css.zenleap-backup.
# Run it from a ZenLeap checkout (it uses scripts/lib/zen-paths.sh).
#
# Options:
#   --profile <sel>      Profile(s): a number from the list, a profile name, or "all";
#                        repeatable. Default: every profile whose userChrome.css has a
#                        ZenLeap block
#   --profile-dir <dir>  Use this profile directory directly; repeatable
#   --yes, -y            Auto-confirm all prompts (non-interactive mode)
#   --dry-run            Show what would be removed without modifying files

if [ -z "${BASH_VERSION:-}" ]; then
    echo "This script needs bash: bash clean-legacy-css.sh ..." >&2
    exit 1
fi
set +o posix   # `sh` on macOS is bash in POSIX mode, which has no <(...)

set -e

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/scripts/lib/zen-paths.sh" ]; then
    echo "Error: $SCRIPT_DIR/scripts/lib/zen-paths.sh not found; run this script from a ZenLeap checkout."
    exit 1
fi
# shellcheck source=scripts/lib/zen-paths.sh
. "$SCRIPT_DIR/scripts/lib/zen-paths.sh"

# Flags
PROFILE_SPECS=()
PROFILE_DIR_ARGS=()
AUTO_YES=false
DRY_RUN=false

# Pre-scan for non-interactive flags
for _arg in "$@"; do
    case "$_arg" in
        --yes|-y) AUTO_YES=true ;;
        --help|-h|--dry-run) _NO_TTY=true ;;
    esac
done

# Open /dev/tty for interactive input
if [ "$AUTO_YES" = true ] || [ "${_NO_TTY:-}" = true ]; then
    exec 3</dev/null
elif [ -t 0 ]; then
    exec 3<&0
else
    if [ -e /dev/tty ] && { exec 3</dev/tty; } 2>/dev/null; then
        :
    else
        echo "Error: No terminal available. Use --yes for non-interactive mode."
        exit 1
    fi
fi

has_css_block() {
    grep -qsF '/* === ZenLeap Styles === */' "${ZP_PROFILE_DIRS[$1]}/chrome/userChrome.css"
}

css_status() {
    if has_css_block "$1"; then printf 'has a ZenLeap block'; fi
}

# Find Zen profiles and decide which ones to clean (sets ZP_SELECTED)
find_profiles() {
    local i d suggested=()
    case "$(uname -s)" in
        Darwin|Linux) ;;
        *)
            echo -e "${RED}Unsupported operating system${NC}"
            exit 1
            ;;
    esac

    # Native profiles first, else those of an installed Flatpak Zen (its data
    # folder stays behind after `flatpak uninstall`)
    if ! zp_discover native && ! { zp_flatpak_installed && zp_discover flatpak; } && [ ${#PROFILE_DIR_ARGS[@]} -eq 0 ]; then
        zp_discover native || true
        echo -e "${RED}Error: $ZP_ERROR${NC}"
        exit 1
    fi

    if [ ${#PROFILE_DIR_ARGS[@]} -gt 0 ]; then
        for d in "${PROFILE_DIR_ARGS[@]}"; do
            if ! zp_use_profile_dir "$d"; then
                echo -e "${RED}Error: $ZP_ERROR${NC}"
                exit 1
            fi
        done
    elif [ ${#PROFILE_SPECS[@]} -gt 0 ]; then
        if ! zp_select_specs "${PROFILE_SPECS[@]}"; then
            echo -e "${RED}Error: $ZP_ERROR${NC}"
            exit 1
        fi
    else
        for ((i = 0; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
            if has_css_block "$i"; then suggested+=("$i"); fi
        done
        if [ ${#suggested[@]} -le 1 ] || [ "$AUTO_YES" = true ] || [ "$DRY_RUN" = true ]; then
            ZP_SELECTED=("${suggested[@]}")
        else
            echo "Zen profiles (in $ZP_ROOT):"
            if ! zp_menu css_status "${suggested[@]}"; then
                echo "Cancelled."
                exit 0
            fi
        fi
    fi
    echo -e "${GREEN}+${NC} Checking ${#ZP_SELECTED[@]} of ${#ZP_PROFILE_DIRS[@]} profile(s)"
}

# Clean a single profile's userChrome.css
clean_profile() {
    local profile_dir="${ZP_PROFILE_DIRS[$1]}"
    local chrome_dir="$profile_dir/chrome"
    local css_file="$chrome_dir/userChrome.css"
    local pname="${ZP_PROFILE_NAMES[$1]}"

    if [ ! -f "$css_file" ]; then
        echo -e "  ${YELLOW}-${NC} $pname: no userChrome.css"
        return
    fi

    # Check for ZenLeap marker block
    if has_css_block "$1"; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "  ${BLUE}~${NC} $pname: would remove ZenLeap marker block"
            return
        fi
        cp "$css_file" "$chrome_dir/userChrome.css.zenleap-backup"
        zp_strip_css_block "$css_file" || true
        echo -e "  ${GREEN}+${NC} $pname: removed ZenLeap marker block (backup: userChrome.css.zenleap-backup)"
    else
        echo -e "  ${YELLOW}-${NC} $pname: no ZenLeap marker block found"
    fi

    # Also clean stale chrome.css if it contains old hardcoded styles
    local chrome_css="$chrome_dir/chrome.css"
    if [ -f "$chrome_css" ]; then
        local linecount
        linecount=$(wc -l < "$chrome_css" | tr -d ' ')
        if [ "$linecount" -gt 20 ]; then
            if [ "$DRY_RUN" = true ]; then
                echo -e "  ${BLUE}~${NC} $pname: chrome.css has $linecount lines (may contain legacy styles)"
            else
                echo -e "  ${YELLOW}!${NC} $pname: chrome.css has $linecount lines — may contain old styles"
                echo "    To clean, manually review: $chrome_css"
            fi
        fi
    fi
}

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        --profile)
            shift
            if [ -z "${1:-}" ] || [[ "$1" == --* ]]; then
                echo -e "${RED}Error: --profile requires a profile number, name, or \"all\"${NC}"
                exit 1
            fi
            PROFILE_SPECS+=("$1")
            ;;
        --profile-dir)
            shift
            if [ -z "${1:-}" ] || [[ "$1" == --* ]]; then
                echo -e "${RED}Error: --profile-dir requires a directory${NC}"
                exit 1
            fi
            PROFILE_DIR_ARGS+=("$1")
            ;;
        --yes|-y)
            AUTO_YES=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Removes old ZenLeap CSS marker blocks from userChrome.css."
            echo "All other CSS (from other extensions, user customizations) is preserved."
            echo ""
            echo "Options:"
            echo "  --profile <sel>      Profile(s): number from the list, profile name, or \"all\";"
            echo "                       repeatable (default: profiles whose userChrome.css has a"
            echo "                       ZenLeap block)"
            echo "  --profile-dir <dir>  Use this profile directory directly; repeatable"
            echo "  --yes, -y            Auto-confirm"
            echo "  --dry-run            Show what would change without modifying files"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
    shift
done

if [ ${#PROFILE_SPECS[@]} -gt 0 ] && [ ${#PROFILE_DIR_ARGS[@]} -gt 0 ]; then
    echo -e "${RED}Error: Use either --profile or --profile-dir, not both${NC}"
    exit 1
fi

echo -e "${BLUE}ZenLeap Legacy CSS Cleaner${NC}"
echo ""

find_profiles

if [ ${#ZP_SELECTED[@]} -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Nothing to clean:${NC} no userChrome.css contains a ZenLeap block."
    exit 0
fi

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${YELLOW}Dry run mode — no files will be modified${NC}"
fi

if [ "$AUTO_YES" != true ] && [ "$DRY_RUN" != true ]; then
    echo ""
    echo "This will remove ZenLeap marker blocks from userChrome.css."
    echo "All other CSS will be preserved."
    echo -n "Continue? (y/n): "
    read -r response <&3 || response="n"
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
for i in "${ZP_SELECTED[@]}"; do
    clean_profile "$i"
done

echo ""
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}Dry run complete. Run without --dry-run to apply changes.${NC}"
else
    echo -e "${GREEN}Done.${NC} Restart Zen Browser for changes to take effect."
fi
