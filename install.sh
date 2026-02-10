#!/bin/bash
# ZenLeap Installer/Uninstaller
# Usage: ./install.sh [install|uninstall|check] [OPTIONS]
#
# Options:
#   --remote                Download latest ZenLeap from GitHub instead of using local files
#   --check                 Check if installed version is outdated (returns 0 if up-to-date, 1 if outdated)
#   --profile <index>       Select profile by index (1-based), skip interactive prompt
#   --yes, -y               Auto-confirm all prompts (non-interactive mode)
#   --remove-fxautoconfig   Also remove fx-autoconfig during uninstall
#
# This script handles everything:
# 1. Downloads and installs fx-autoconfig (if needed)
# 2. Installs ZenLeap files
# 3. Sets required preferences
# 4. Clears startup cache
#
# Non-interactive examples:
#   ./install.sh install --remote --profile 1 --yes
#   ./install.sh uninstall --profile 1 --yes --remove-fxautoconfig

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
    if [ -e /dev/tty ]; then
        exec 3</dev/tty
    else
        echo "Error: No terminal available for interactive input"
        echo "Try using --yes (-y) and --profile <index> for non-interactive mode"
        echo "Or download and run the script directly:"
        echo "  curl -sLO https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.sh"
        echo "  bash install.sh"
        exit 1
    fi
fi

# Configuration
FXAUTOCONFIG_REPO="https://github.com/MrOtherGuy/fx-autoconfig/archive/refs/heads/master.zip"
ZENLEAP_REPO="https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main"
ZENLEAP_SCRIPT_URL="https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/JS/zenleap.uc.js"
ZENLEAP_CSS_URL="https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/chrome.css"
ZENLEAP_CHECKSUMS_URL="https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/CHECKSUMS.sha256"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Flags
USE_REMOTE=false
CHECK_ONLY=false
PROFILE_INDEX=""
AUTO_YES=false
REMOVE_FXAUTOCONFIG=false

# Get version from a zenleap.uc.js file
get_version() {
    local file="$1"
    if [ -f "$file" ]; then
        grep -o '@version[[:space:]]*[0-9.]*' "$file" | head -1 | sed 's/@version[[:space:]]*//'
    else
        echo ""
    fi
}

# Get remote version from GitHub
get_remote_version() {
    local temp_file=$(mktemp)
    if curl -sfL "$ZENLEAP_SCRIPT_URL" -o "$temp_file" 2>/dev/null; then
        local version=$(get_version "$temp_file")
        rm -f "$temp_file"
        echo "$version"
    else
        rm -f "$temp_file"
        echo ""
    fi
}

# Compare versions (returns 0 if v1 >= v2, 1 if v1 < v2)
version_gte() {
    local v1="$1"
    local v2="$2"
    [ "$(printf '%s\n' "$v2" "$v1" | sort -V | head -n1)" = "$v2" ]
}

# Verify a downloaded file against a SHA-256 checksums file.
# Usage: verify_checksum <file> <relative_path> <checksums_file>
# Returns 0 if checksum matches, 1 if mismatch, 2 if entry not found.
verify_checksum() {
    local file="$1"
    local rel_path="$2"
    local checksums_file="$3"

    if [ ! -f "$checksums_file" ]; then
        return 2
    fi

    # Extract expected hash for this relative path
    local expected
    expected=$(grep -E "^[0-9a-f]{64}  ${rel_path}$" "$checksums_file" | awk '{print $1}')
    if [ -z "$expected" ]; then
        return 2
    fi

    # Compute actual hash (shasum on macOS, sha256sum on Linux)
    local actual
    if command -v sha256sum &> /dev/null; then
        actual=$(sha256sum "$file" | awk '{print $1}')
    elif command -v shasum &> /dev/null; then
        actual=$(shasum -a 256 "$file" | awk '{print $1}')
    else
        echo -e "${YELLOW}⚠${NC} Cannot verify checksum (sha256sum/shasum not found)"
        return 2
    fi

    if [ "$actual" = "$expected" ]; then
        return 0
    else
        echo -e "${RED}Checksum mismatch for ${rel_path}!${NC}"
        echo "  Expected: $expected"
        echo "  Got:      $actual"
        return 1
    fi
}

# Download ZenLeap from remote (with optional checksum verification)
download_zenleap() {
    local dest_dir="$1"
    echo "  Downloading latest ZenLeap from GitHub..."

    mkdir -p "$dest_dir/JS"

    if ! curl -sfL "$ZENLEAP_SCRIPT_URL" -o "$dest_dir/JS/zenleap.uc.js"; then
        echo -e "${RED}Error: Failed to download zenleap.uc.js${NC}"
        return 1
    fi

    if ! curl -sfL "$ZENLEAP_CSS_URL" -o "$dest_dir/chrome.css"; then
        echo -e "${RED}Error: Failed to download chrome.css${NC}"
        return 1
    fi

    # Verify integrity against repo checksums (best-effort: warn but don't
    # block install if the checksums file is missing or doesn't have entries).
    local checksums_file="$dest_dir/.checksums"
    if curl -sfL "$ZENLEAP_CHECKSUMS_URL" -o "$checksums_file" 2>/dev/null; then
        local failed=false
        local rc=0
        verify_checksum "$dest_dir/JS/zenleap.uc.js" "JS/zenleap.uc.js" "$checksums_file" || rc=$?
        if [ "$rc" -eq 1 ]; then failed=true; fi
        rc=0
        verify_checksum "$dest_dir/chrome.css" "chrome.css" "$checksums_file" || rc=$?
        if [ "$rc" -eq 1 ]; then failed=true; fi
        rm -f "$checksums_file"

        if [ "$failed" = true ]; then
            echo -e "${RED}Error: Downloaded files failed integrity check — aborting${NC}"
            return 1
        fi
        echo -e "${GREEN}✓${NC} Integrity verified"
    else
        echo -e "${YELLOW}⚠${NC} Checksums file not available — skipping integrity check"
    fi

    echo -e "${GREEN}✓${NC} Downloaded latest ZenLeap"
    return 0
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

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin)
            OS="macos"
            # Try both possible app names
            if [ -d "/Applications/Zen.app" ]; then
                ZEN_APP="/Applications/Zen.app"
            elif [ -d "/Applications/Zen Browser.app" ]; then
                ZEN_APP="/Applications/Zen Browser.app"
            else
                echo -e "${RED}Error: Could not find Zen Browser in /Applications${NC}"
                exit 1
            fi
            ZEN_RESOURCES="$ZEN_APP/Contents/Resources"
            PROFILE_BASE="$HOME/Library/Application Support/zen/Profiles"
            ;;
        Linux)
            OS="linux"
            if [ -d "/opt/zen-browser" ]; then
                ZEN_RESOURCES="/opt/zen-browser"
            elif [ -d "/usr/lib/zen" ]; then
                ZEN_RESOURCES="/usr/lib/zen"
            elif [ -d "$HOME/.local/share/zen" ]; then
                ZEN_RESOURCES="$HOME/.local/share/zen"
            else
                echo -e "${RED}Error: Could not find Zen Browser installation${NC}"
                echo "Please install Zen Browser first or specify the path manually"
                exit 1
            fi
            PROFILE_BASE="$HOME/.zen"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            OS="windows"
            echo -e "${RED}Windows is not currently supported. Please install manually.${NC}"
            echo "See: https://github.com/yashas-salankimatt/ZenLeap#manual-installation"
            exit 1
            ;;
        *)
            echo -e "${RED}Unsupported operating system${NC}"
            exit 1
            ;;
    esac
    echo -e "${GREEN}✓${NC} Detected OS: $OS"
}

# Find Zen profile directory
find_profile() {
    if [ ! -d "$PROFILE_BASE" ]; then
        echo -e "${RED}Error: Zen profile directory not found at $PROFILE_BASE${NC}"
        echo "Please run Zen Browser at least once to create a profile"
        exit 1
    fi

    # Find all profiles
    PROFILES=()
    while IFS= read -r -d '' dir; do
        PROFILES+=("$dir")
    done < <(find "$PROFILE_BASE" -maxdepth 1 -type d ! -name "Profiles" ! -path "$PROFILE_BASE" -print0 2>/dev/null)

    if [ ${#PROFILES[@]} -eq 0 ]; then
        echo -e "${RED}Error: Could not find any Zen profiles${NC}"
        echo "Please check about:profiles in Zen Browser"
        exit 1
    fi

    # If only one profile, use it
    if [ ${#PROFILES[@]} -eq 1 ]; then
        PROFILE_DIR="${PROFILES[0]}"
        echo -e "${GREEN}✓${NC} Found profile: $(basename "$PROFILE_DIR")"
    elif [ -n "$PROFILE_INDEX" ]; then
        # Non-interactive: use specified profile index
        if ! [[ "$PROFILE_INDEX" =~ ^[0-9]+$ ]] || [ "$PROFILE_INDEX" -lt 1 ] || [ "$PROFILE_INDEX" -gt ${#PROFILES[@]} ]; then
            echo -e "${RED}Error: Invalid profile index $PROFILE_INDEX (valid range: 1-${#PROFILES[@]})${NC}"
            exit 1
        fi
        PROFILE_DIR="${PROFILES[$((PROFILE_INDEX-1))]}"
        echo -e "${GREEN}✓${NC} Selected profile (index $PROFILE_INDEX): $(basename "$PROFILE_DIR")"
    else
        # Multiple profiles - let user choose
        echo -e "${YELLOW}Multiple profiles found:${NC}"
        for i in "${!PROFILES[@]}"; do
            profile_name=$(basename "${PROFILES[$i]}")
            # Check if ZenLeap is installed in this profile
            if [ -f "${PROFILES[$i]}/chrome/JS/zenleap.uc.js" ]; then
                echo "  $((i+1)). $profile_name ${GREEN}(ZenLeap installed)${NC}"
            else
                echo "  $((i+1)). $profile_name"
            fi
        done
        echo ""
        echo -n "Select profile (1-${#PROFILES[@]}): "
        read -r selection <&3

        if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#PROFILES[@]} ]; then
            echo -e "${RED}Invalid selection${NC}"
            exit 1
        fi

        PROFILE_DIR="${PROFILES[$((selection-1))]}"
        echo -e "${GREEN}✓${NC} Selected profile: $(basename "$PROFILE_DIR")"
    fi

    CHROME_DIR="$PROFILE_DIR/chrome"
    JS_DIR="$CHROME_DIR/JS"
}

# Check if Zen Browser is running
check_zen_running() {
    if pgrep -x "zen" > /dev/null 2>&1 || pgrep -x "Zen Browser" > /dev/null 2>&1; then
        if [ "$AUTO_YES" = true ]; then
            echo -e "${YELLOW}⚠ Zen Browser is running, closing it...${NC}"
            if [ "$OS" = "macos" ]; then
                osascript -e 'quit app "Zen"' 2>/dev/null || osascript -e 'quit app "Zen Browser"' 2>/dev/null || true
            else
                pkill -x "zen" 2>/dev/null || true
            fi
            sleep 2
        else
            echo -e "${YELLOW}⚠ Zen Browser is running${NC}"
            echo -n "Close Zen Browser to continue? (y/n): "
            read -r response <&3
            if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
                if [ "$OS" = "macos" ]; then
                    osascript -e 'quit app "Zen"' 2>/dev/null || osascript -e 'quit app "Zen Browser"' 2>/dev/null || true
                else
                    pkill -x "zen" 2>/dev/null || true
                fi
                sleep 2
            else
                echo -e "${YELLOW}Please close Zen Browser manually and run again${NC}"
                exit 1
            fi
        fi
    fi
}

# Check if fx-autoconfig is installed
check_fxautoconfig() {
    if [ -f "$CHROME_DIR/utils/boot.sys.mjs" ] || [ -f "$CHROME_DIR/utils/chrome.manifest" ]; then
        echo -e "${GREEN}✓${NC} fx-autoconfig already installed"
        return 0
    fi
    return 1
}

# Download and install fx-autoconfig
install_fxautoconfig() {
    echo -e "${BLUE}Installing fx-autoconfig...${NC}"

    TEMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TEMP_DIR"' EXIT

    echo "  Downloading..."
    if command -v curl &> /dev/null; then
        curl -sfL "$FXAUTOCONFIG_REPO" -o "$TEMP_DIR/fxautoconfig.zip"
    elif command -v wget &> /dev/null; then
        wget -q "$FXAUTOCONFIG_REPO" -O "$TEMP_DIR/fxautoconfig.zip"
    else
        echo -e "${RED}Error: Neither curl nor wget found${NC}"
        exit 1
    fi

    echo "  Extracting..."
    unzip -q "$TEMP_DIR/fxautoconfig.zip" -d "$TEMP_DIR"

    # Find the extracted directory
    EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "fx-autoconfig*" | head -1)

    if [ -z "$EXTRACTED_DIR" ]; then
        echo -e "${RED}Error: Could not find extracted fx-autoconfig files${NC}"
        exit 1
    fi

    # Install to Zen Resources (requires admin)
    echo "  Installing to Zen Browser (may require admin password)..."
    if [ -d "$EXTRACTED_DIR/program" ]; then
        sudo mkdir -p "$ZEN_RESOURCES/defaults/pref"
        sudo cp "$EXTRACTED_DIR/program/config.js" "$ZEN_RESOURCES/config.js"
        sudo cp "$EXTRACTED_DIR/program/defaults/pref/config-prefs.js" "$ZEN_RESOURCES/defaults/pref/config-prefs.js"
    fi

    # Install to profile
    echo "  Installing to profile..."
    mkdir -p "$CHROME_DIR"
    if [ -d "$EXTRACTED_DIR/profile/chrome" ]; then
        cp -r "$EXTRACTED_DIR/profile/chrome/"* "$CHROME_DIR/"
    fi

    echo -e "${GREEN}✓${NC} fx-autoconfig installed"
}

# Install ZenLeap
install_zenleap() {
    echo -e "${BLUE}Installing ZenLeap...${NC}"

    # Create directories
    mkdir -p "$JS_DIR"

    # Determine source (remote or local)
    local source_dir="$SCRIPT_DIR"
    if [ "$USE_REMOTE" = true ]; then
        # Download to temp directory
        source_dir=$(mktemp -d)
        if ! download_zenleap "$source_dir"; then
            rm -rf "$source_dir"
            exit 1
        fi
    fi

    # Copy main script
    if [ -f "$source_dir/JS/zenleap.uc.js" ]; then
        cp "$source_dir/JS/zenleap.uc.js" "$JS_DIR/"
        local version=$(get_version "$JS_DIR/zenleap.uc.js")
        echo -e "${GREEN}✓${NC} Installed zenleap.uc.js (v$version)"
    else
        echo -e "${RED}Error: zenleap.uc.js not found${NC}"
        [ "$USE_REMOTE" = true ] && rm -rf "$source_dir"
        exit 1
    fi

    # Append CSS to userChrome.css if it exists and not already added
    if [ -f "$source_dir/chrome.css" ]; then
        if [ -f "$CHROME_DIR/userChrome.css" ]; then
            # Remove old ZenLeap styles first
            if grep -q "ZenLeap Styles" "$CHROME_DIR/userChrome.css" 2>/dev/null; then
                perl -i -p0e 's/\n*\/\* === ZenLeap Styles === \*\/.*?(\/\* === End ZenLeap Styles === \*\/|\z)//s' "$CHROME_DIR/userChrome.css"
            fi
            echo "" >> "$CHROME_DIR/userChrome.css"
            echo "/* === ZenLeap Styles === */" >> "$CHROME_DIR/userChrome.css"
            cat "$source_dir/chrome.css" >> "$CHROME_DIR/userChrome.css"
            echo "/* === End ZenLeap Styles === */" >> "$CHROME_DIR/userChrome.css"
            echo -e "${GREEN}✓${NC} Updated styles in userChrome.css"
        else
            echo "/* === ZenLeap Styles === */" > "$CHROME_DIR/userChrome.css"
            cat "$source_dir/chrome.css" >> "$CHROME_DIR/userChrome.css"
            echo "/* === End ZenLeap Styles === */" >> "$CHROME_DIR/userChrome.css"
            echo -e "${GREEN}✓${NC} Created userChrome.css with styles"
        fi
    fi

    # Cleanup temp directory if using remote
    [ "$USE_REMOTE" = true ] && rm -rf "$source_dir"

    # Set required preferences via user.js
    USER_JS="$PROFILE_DIR/user.js"

    # Create or update user.js
    touch "$USER_JS"

    PREFS_TO_SET=(
        'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'
    )

    for pref in "${PREFS_TO_SET[@]}"; do
        pref_name=$(echo "$pref" | sed 's/user_pref("\([^"]*\)".*/\1/')
        if ! grep -q "$pref_name" "$USER_JS" 2>/dev/null; then
            echo "$pref" >> "$USER_JS"
        fi
    done
    echo -e "${GREEN}✓${NC} Set required preferences"
}

# Uninstall ZenLeap
uninstall_zenleap() {
    echo -e "${BLUE}Uninstalling ZenLeap...${NC}"

    local found_anything=false

    # Remove zenleap.uc.js
    if [ -f "$JS_DIR/zenleap.uc.js" ]; then
        rm "$JS_DIR/zenleap.uc.js"
        echo -e "${GREEN}✓${NC} Removed zenleap.uc.js"
        found_anything=true
    else
        echo -e "${YELLOW}⚠${NC} zenleap.uc.js not found in $JS_DIR"
    fi

    # Remove styles from userChrome.css
    if [ -f "$CHROME_DIR/userChrome.css" ]; then
        if grep -q "ZenLeap Styles" "$CHROME_DIR/userChrome.css" 2>/dev/null; then
            # Use perl for more reliable multi-line removal on macOS
            perl -i -p0e 's/\n*\/\* === ZenLeap Styles === \*\/.*?(\/\* === End ZenLeap Styles === \*\/|\z)//s' "$CHROME_DIR/userChrome.css"
            echo -e "${GREEN}✓${NC} Removed styles from userChrome.css"
            found_anything=true
        else
            echo -e "${YELLOW}⚠${NC} ZenLeap styles not found in userChrome.css"
        fi
    fi

    if [ "$found_anything" = true ]; then
        echo -e "${GREEN}✓${NC} ZenLeap uninstalled"
    else
        echo -e "${YELLOW}⚠${NC} ZenLeap was not installed in this profile"
    fi

}

# Uninstall fx-autoconfig
uninstall_fxautoconfig() {
    echo -e "${BLUE}Uninstalling fx-autoconfig...${NC}"

    local found_anything=false

    # Remove program-level files (requires admin)
    if [ -f "$ZEN_RESOURCES/config.js" ]; then
        echo "  Removing config.js (may require admin password)..."
        sudo rm -f "$ZEN_RESOURCES/config.js"
        echo -e "${GREEN}✓${NC} Removed config.js"
        found_anything=true
    fi

    if [ -f "$ZEN_RESOURCES/defaults/pref/config-prefs.js" ]; then
        sudo rm -f "$ZEN_RESOURCES/defaults/pref/config-prefs.js"
        echo -e "${GREEN}✓${NC} Removed config-prefs.js"
        found_anything=true
    fi

    # Remove profile-level utils directory
    if [ -d "$CHROME_DIR/utils" ]; then
        rm -rf "$CHROME_DIR/utils"
        echo -e "${GREEN}✓${NC} Removed chrome/utils/"
        found_anything=true
    fi

    if [ "$found_anything" = true ]; then
        echo -e "${GREEN}✓${NC} fx-autoconfig uninstalled"
    else
        echo -e "${YELLOW}⚠${NC} fx-autoconfig files not found"
    fi
}

# Clear startup cache
clear_cache() {
    echo -e "${BLUE}Clearing startup cache...${NC}"

    CACHE_DIR=""
    if [ "$OS" = "macos" ]; then
        CACHE_DIR="$HOME/Library/Caches/zen"
    else
        CACHE_DIR="$HOME/.cache/zen"
    fi

    if [ -d "$CACHE_DIR" ]; then
        rm -rf "$CACHE_DIR/startupCache" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Startup cache cleared"
    else
        echo -e "${YELLOW}⚠${NC} Cache directory not found (this is OK)"
    fi
}

# Main install function
do_install() {
    detect_os
    find_profile
    check_zen_running

    if ! check_fxautoconfig; then
        install_fxautoconfig
    fi

    install_zenleap
    clear_cache

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Installation Complete!                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Usage:${NC}"
    echo "  Ctrl+Space     Enter leap mode"
    echo "  j/k or ↑/↓     Browse tabs"
    echo "  Enter          Open selected tab"
    echo "  x              Close selected tab"
    echo "  gg             Go to first tab"
    echo "  G              Go to last tab"
    echo "  g{num}         Go to tab number"
    echo "  zz/zt/zb       Scroll center/top/bottom"
    echo "  Escape         Cancel"
    echo ""
    echo -e "${YELLOW}Please restart Zen Browser to activate ZenLeap${NC}"

    if [ "$AUTO_YES" = true ]; then
        # Non-interactive: skip opening Zen
        :
    else
        # Offer to open Zen
        echo -n "Open Zen Browser now? (y/n): "
        read -r response <&3
        if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
            if [ "$OS" = "macos" ]; then
                open "$ZEN_APP"
            else
                zen &
            fi
        fi
    fi
}

# Main uninstall function
do_uninstall() {
    detect_os
    find_profile

    # Track if Zen was running before we closed it
    ZEN_WAS_RUNNING=false
    if pgrep -x "zen" > /dev/null 2>&1 || pgrep -x "Zen" > /dev/null 2>&1; then
        ZEN_WAS_RUNNING=true
    fi

    check_zen_running
    uninstall_zenleap

    # Offer to uninstall fx-autoconfig
    if [ -f "$ZEN_RESOURCES/config.js" ] || [ -d "$CHROME_DIR/utils" ]; then
        if [ "$AUTO_YES" = true ]; then
            if [ "$REMOVE_FXAUTOCONFIG" = true ]; then
                uninstall_fxautoconfig
            else
                echo -e "${YELLOW}Skipping fx-autoconfig removal (use --remove-fxautoconfig to include)${NC}"
            fi
        else
            echo ""
            echo -n "Also remove fx-autoconfig? Other userscripts may depend on it. (y/n): "
            read -r response <&3
            if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
                uninstall_fxautoconfig
            fi
        fi
    fi

    clear_cache

    echo ""
    echo -e "${GREEN}Uninstallation complete!${NC}"

    # Offer to reopen Zen if it was running
    if [ "$ZEN_WAS_RUNNING" = true ]; then
        if [ "$AUTO_YES" = true ]; then
            # Non-interactive: skip reopening Zen
            :
        else
            echo ""
            echo -n "Reopen Zen Browser? (y/n): "
            read -r response <&3
            if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
                if [ "$OS" = "macos" ]; then
                    open "$ZEN_APP"
                else
                    zen &
                fi
            fi
        fi
    else
        echo -e "${YELLOW}Please restart Zen Browser if it's running${NC}"
    fi
}

# Check version and report status
do_check() {
    detect_os
    find_profile

    local installed_version=$(get_version "$JS_DIR/zenleap.uc.js")
    local remote_version=$(get_remote_version)

    if [ -z "$installed_version" ]; then
        echo "NOT_INSTALLED"
        return 2
    fi

    if [ -z "$remote_version" ]; then
        echo "INSTALLED:$installed_version:UNKNOWN"
        return 0
    fi

    if version_gte "$installed_version" "$remote_version"; then
        echo "UP_TO_DATE:$installed_version:$remote_version"
        return 0
    else
        echo "OUTDATED:$installed_version:$remote_version"
        return 1
    fi
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
        check)
            ACTION="check"
            ;;
        --remote)
            USE_REMOTE=true
            ;;
        --check)
            ACTION="check"
            ;;
        --profile)
            shift
            if [ -z "$1" ] || [[ "$1" == --* ]]; then
                echo -e "${RED}Error: --profile requires an index argument${NC}"
                exit 1
            fi
            PROFILE_INDEX="$1"
            ;;
        --yes|-y)
            AUTO_YES=true
            ;;
        --remove-fxautoconfig)
            REMOVE_FXAUTOCONFIG=true
            ;;
        --help|-h)
            echo "Usage: $0 [install|uninstall|check] [OPTIONS]"
            echo ""
            echo "Actions:"
            echo "  install     Install ZenLeap (default)"
            echo "  uninstall   Remove ZenLeap"
            echo "  check       Check if installed version is outdated"
            echo ""
            echo "Options:"
            echo "  --remote                Download latest from GitHub instead of local files"
            echo "  --profile <index>       Select profile by index (1-based), skip prompt"
            echo "  --yes, -y               Auto-confirm all prompts (non-interactive mode)"
            echo "  --remove-fxautoconfig   Also remove fx-autoconfig during uninstall"
            echo ""
            echo "Non-interactive examples:"
            echo "  $0 install --remote --profile 1 --yes"
            echo "  $0 uninstall --profile 1 --yes --remove-fxautoconfig"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
    shift
done

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
