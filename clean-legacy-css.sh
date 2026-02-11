#!/bin/bash
# ZenLeap Legacy CSS Cleaner
# Usage: ./clean-legacy-css.sh [OPTIONS]
#
# Removes old pre-marker ZenLeap CSS from userChrome.css that may conflict
# with the runtime theme engine. Only removes content between the ZenLeap
# marker comments; all other CSS (from other extensions, user customizations)
# is preserved.
#
# Options:
#   --profile <index>   Select profile by index (1-based); omit for ALL profiles
#   --yes, -y           Auto-confirm all prompts (non-interactive mode)
#   --dry-run           Show what would be removed without modifying files

set -e

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

# Flags
PROFILE_INDEX=""
AUTO_YES=false
DRY_RUN=false

# Pre-scan for non-interactive flags
for _arg in "$@"; do
    case "$_arg" in
        --yes|-y) AUTO_YES=true ;;
        --help|-h) AUTO_YES=true ;;
    esac
done

# Open /dev/tty for interactive input
if [ "$AUTO_YES" = true ]; then
    exec 3</dev/null
elif [ -t 0 ]; then
    exec 3<&0
else
    if [ -e /dev/tty ]; then
        exec 3</dev/tty
    else
        echo "Error: No terminal available. Use --yes for non-interactive mode."
        exit 1
    fi
fi

# Detect OS and find profile base
detect_os() {
    case "$(uname -s)" in
        Darwin)
            OS="macos"
            PROFILE_BASE="$HOME/Library/Application Support/zen/Profiles"
            ;;
        Linux)
            OS="linux"
            PROFILE_BASE="$HOME/.zen"
            ;;
        *)
            echo -e "${RED}Unsupported operating system${NC}"
            exit 1
            ;;
    esac
}

# Find Zen profiles (same logic as install.sh)
find_profiles() {
    if [ ! -d "$PROFILE_BASE" ]; then
        echo -e "${RED}Error: Zen profile directory not found at $PROFILE_BASE${NC}"
        exit 1
    fi

    PROFILES=()
    while IFS= read -r -d '' dir; do
        PROFILES+=("$dir")
    done < <(find "$PROFILE_BASE" -maxdepth 1 -type d ! -name "Profiles" ! -path "$PROFILE_BASE" -print0 2>/dev/null)

    if [ ${#PROFILES[@]} -eq 0 ]; then
        echo -e "${RED}Error: No Zen profiles found${NC}"
        exit 1
    fi

    SELECTED_PROFILES=()

    if [ -n "$PROFILE_INDEX" ]; then
        if ! [[ "$PROFILE_INDEX" =~ ^[0-9]+$ ]] || [ "$PROFILE_INDEX" -lt 1 ] || [ "$PROFILE_INDEX" -gt ${#PROFILES[@]} ]; then
            echo -e "${RED}Error: Invalid profile index $PROFILE_INDEX (valid: 1-${#PROFILES[@]})${NC}"
            exit 1
        fi
        SELECTED_PROFILES+=("${PROFILES[$((PROFILE_INDEX-1))]}")
        echo -e "${GREEN}+${NC} Selected profile: $(basename "${SELECTED_PROFILES[0]}")"
    else
        SELECTED_PROFILES=("${PROFILES[@]}")
        echo -e "${GREEN}+${NC} Found ${#SELECTED_PROFILES[@]} profile(s)"
    fi
}

# Clean a single profile's userChrome.css
clean_profile() {
    local profile_dir="$1"
    local chrome_dir="$profile_dir/chrome"
    local css_file="$chrome_dir/userChrome.css"
    local pname
    pname=$(basename "$profile_dir")

    if [ ! -f "$css_file" ]; then
        echo -e "  ${YELLOW}-${NC} $pname: no userChrome.css"
        return
    fi

    # Check for ZenLeap marker block
    if grep -q "ZenLeap Styles" "$css_file" 2>/dev/null; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "  ${BLUE}~${NC} $pname: would remove ZenLeap marker block"
            return
        fi
        perl -i -p0e 's/\n*\/\* === ZenLeap Styles === \*\/.*?(\/\* === End ZenLeap Styles === \*\/|\z)//s' "$css_file"
        echo -e "  ${GREEN}+${NC} $pname: removed ZenLeap marker block"
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
            PROFILE_INDEX="$1"
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
            echo "  --profile <index>   Select profile by index (1-based); omit for ALL"
            echo "  --yes, -y           Auto-confirm"
            echo "  --dry-run           Show what would change without modifying files"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
    shift
done

echo -e "${BLUE}ZenLeap Legacy CSS Cleaner${NC}"
echo ""

detect_os
find_profiles

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${YELLOW}Dry run mode — no files will be modified${NC}"
fi

if [ "$AUTO_YES" != true ] && [ "$DRY_RUN" != true ]; then
    echo ""
    echo "This will remove ZenLeap marker blocks from userChrome.css."
    echo "All other CSS will be preserved."
    echo -n "Continue? (y/n): "
    read -r response <&3
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
for profile in "${SELECTED_PROFILES[@]}"; do
    clean_profile "$profile"
done

echo ""
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}Dry run complete. Run without --dry-run to apply changes.${NC}"
else
    echo -e "${GREEN}Done.${NC} Restart Zen Browser for changes to take effect."
fi
