#!/bin/bash
# ZenLeap Installer/Uninstaller
# Usage: ./install.sh [install|uninstall|check] [OPTIONS]
#
# Options:
#   --remote                Download latest ZenLeap from GitHub instead of using local files
#   --check                 Check if installed version is outdated (returns 0 if up-to-date, 1 if outdated)
#   --profile <index>       Select profile by index (1-based); omit to install to ALL profiles
#   --yes, -y               Auto-confirm all prompts (non-interactive mode)
#   --remove-fxautoconfig   Also remove fx-autoconfig during uninstall
#   --zen-path <dir>        Specify Zen Browser installation directory manually
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
ZENLEAP_THEMES_URL="https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/zenleap-themes.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Flags
USE_REMOTE=false
CHECK_ONLY=false
PROFILE_INDEX=""
AUTO_YES=false
REMOVE_FXAUTOCONFIG=false
IS_FLATPAK=false
CUSTOM_ZEN_PATH=""

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
    local content
    content=$(curl -sfL "$ZENLEAP_SCRIPT_URL" 2>/dev/null) || { echo ""; return; }
    echo "$content" | grep -o '@version[[:space:]]*[0-9.]*' | head -1 | sed 's/@version[[:space:]]*//'
}

# Compare versions (returns 0 if v1 >= v2, 1 if v1 < v2)
version_gte() {
    local IFS=.
    local i v1=($1) v2=($2)
    for ((i=0; i<${#v2[@]}; i++)); do
        if ((10#${v1[i]:-0} < 10#${v2[i]:-0})); then
            return 1
        elif ((10#${v1[i]:-0} > 10#${v2[i]:-0})); then
            return 0
        fi
    done
    return 0
}

# Download ZenLeap from remote
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

    # Download themes template (best-effort)
    curl -sfL "$ZENLEAP_THEMES_URL" -o "$dest_dir/zenleap-themes.json" 2>/dev/null || true

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

# Backup userChrome.css before modification
backup_user_chrome() {
    local css_file="$CHROME_DIR/userChrome.css"
    if [ -f "$css_file" ]; then
        local backup_file="$CHROME_DIR/userChrome.css.zenleap-backup"
        cp "$css_file" "$backup_file"
        echo -e "${GREEN}✓${NC} Backed up userChrome.css → userChrome.css.zenleap-backup"
    fi
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
        echo "  /Applications/Zen.app/Contents/Resources"
        echo "  /Applications/Zen Browser.app/Contents/Resources"
    else
        echo "  /opt/zen-browser    /opt/zen    /usr/lib/zen-browser"
        echo "  ~/.local/share/zen  /opt/zen-browser-bin"
    fi
    echo ""

    if [ "$AUTO_YES" = true ]; then
        echo -e "${RED}Error: Cannot prompt for path in non-interactive mode.${NC}"
        echo "Use --zen-path <directory> to specify the Zen installation directory."
        exit 1
    fi

    while true; do
        echo -n "Enter the Zen Browser installation directory (or 'q' to quit): "
        read -r user_path <&3
        if [ "$user_path" = "q" ] || [ "$user_path" = "Q" ]; then
            echo "Installation cancelled."
            exit 1
        fi
        # Trim whitespace
        user_path=$(echo "$user_path" | xargs)
        if [ -z "$user_path" ]; then
            echo -e "${RED}Path cannot be empty.${NC}"
            continue
        fi
        if [ ! -d "$user_path" ]; then
            echo -e "${RED}Directory not found: $user_path${NC}"
            continue
        fi
        # On macOS, if they gave an .app path, resolve to Contents/Resources
        if [[ "$user_path" == *.app ]]; then
            if [ -d "$user_path/Contents/Resources" ]; then
                user_path="$user_path/Contents/Resources"
                echo -e "${GREEN}✓${NC} Resolved to: $user_path"
            fi
        fi
        echo -e "${GREEN}✓${NC} Using Zen installation at: $user_path"
        ZEN_RESOURCES="$user_path"
        return 0
    done
}

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin)
            OS="macos"
            ZEN_RESOURCES=""
            if [ -n "$CUSTOM_ZEN_PATH" ]; then
                if [ -d "$CUSTOM_ZEN_PATH" ]; then
                    # If they gave an .app path, resolve to Contents/Resources
                    if [[ "$CUSTOM_ZEN_PATH" == *.app ]] && [ -d "$CUSTOM_ZEN_PATH/Contents/Resources" ]; then
                        ZEN_RESOURCES="$CUSTOM_ZEN_PATH/Contents/Resources"
                    else
                        ZEN_RESOURCES="$CUSTOM_ZEN_PATH"
                    fi
                else
                    echo -e "${RED}Error: Directory not found: $CUSTOM_ZEN_PATH${NC}"
                    exit 1
                fi
            elif [ -d "/Applications/Zen.app" ]; then
                ZEN_RESOURCES="/Applications/Zen.app/Contents/Resources"
            elif [ -d "/Applications/Zen Browser.app" ]; then
                ZEN_RESOURCES="/Applications/Zen Browser.app/Contents/Resources"
            else
                prompt_zen_path
            fi
            PROFILE_BASE="$HOME/Library/Application Support/zen/Profiles"
            ;;
        Linux)
            OS="linux"
            IS_FLATPAK=false
            ZEN_RESOURCES=""

            # Use custom path if provided
            if [ -n "$CUSTOM_ZEN_PATH" ]; then
                if [ -d "$CUSTOM_ZEN_PATH" ]; then
                    ZEN_RESOURCES="$CUSTOM_ZEN_PATH"
                else
                    echo -e "${RED}Error: Directory not found: $CUSTOM_ZEN_PATH${NC}"
                    exit 1
                fi
            fi

            # Auto-detect if no custom path provided
            if [ -z "$ZEN_RESOURCES" ]; then
                # Check standard install paths (deb, tar, generic, appimage-extracted)
                for candidate in \
                    "/opt/zen-browser" \
                    "/opt/zen-browser-bin" \
                    "/opt/zen" \
                    "/usr/lib/zen-browser" \
                    "/usr/lib/zen" \
                    "/usr/lib64/zen-browser" \
                    "/usr/lib64/zen" \
                    "$HOME/.local/share/zen" \
                    "$HOME/.local/share/zen-browser"; do
                    if [ -d "$candidate" ]; then
                        ZEN_RESOURCES="$candidate"
                        break
                    fi
                done

                # Fallback: find zen on PATH and resolve its directory
                if [ -z "$ZEN_RESOURCES" ]; then
                    local zen_bin
                    zen_bin=$(command -v zen 2>/dev/null || command -v zen-browser 2>/dev/null || true)
                    if [ -n "$zen_bin" ]; then
                        # Resolve symlinks to find the real installation directory
                        zen_bin=$(readlink -f "$zen_bin" 2>/dev/null || realpath "$zen_bin" 2>/dev/null || echo "$zen_bin")
                        local zen_dir
                        zen_dir=$(dirname "$zen_bin")
                        if [ -d "$zen_dir" ] && [ "$zen_dir" != "/usr/bin" ] && [ "$zen_dir" != "/usr/local/bin" ]; then
                            ZEN_RESOURCES="$zen_dir"
                        fi
                    fi
                fi

                # Check Flatpak install
                if [ -z "$ZEN_RESOURCES" ] && [ -d "$HOME/.var/app/app.zen_browser.zen" ]; then
                    IS_FLATPAK=true
                fi
                if [ -z "$ZEN_RESOURCES" ] && [ "$IS_FLATPAK" = false ]; then
                    # Check if flatpak has zen installed even without the .var directory
                    if command -v flatpak &> /dev/null && flatpak list 2>/dev/null | grep -q "app.zen_browser.zen"; then
                        IS_FLATPAK=true
                    fi
                fi
            fi

            if [ "$IS_FLATPAK" = true ]; then
                # Flatpak: browser dir is read-only, use systemconfig extension
                local flatpak_arch
                flatpak_arch=$(flatpak --default-arch 2>/dev/null || uname -m)
                case "$flatpak_arch" in
                    x86_64|amd64) flatpak_arch="x86_64" ;;
                    aarch64|arm64) flatpak_arch="aarch64" ;;
                    i386|i686) flatpak_arch="i386" ;;
                esac
                ZEN_RESOURCES="$HOME/.local/share/flatpak/extension/app.zen_browser.zen.systemconfig/$flatpak_arch/stable"
                PROFILE_BASE="$HOME/.var/app/app.zen_browser.zen/.zen"
                echo -e "${GREEN}✓${NC} Detected Flatpak installation"
            elif [ -n "$ZEN_RESOURCES" ]; then
                PROFILE_BASE="$HOME/.zen"
            else
                prompt_zen_path
                PROFILE_BASE="$HOME/.zen"
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
    echo -e "${GREEN}✓${NC} Detected OS: $OS"
}

# Find Zen profile directory
find_profiles() {
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

    # Build the list of profiles to operate on
    SELECTED_PROFILES=()

    if [ -n "$PROFILE_INDEX" ]; then
        # --profile flag: use specified profile index only
        if ! [[ "$PROFILE_INDEX" =~ ^[0-9]+$ ]] || [ "$PROFILE_INDEX" -lt 1 ] || [ "$PROFILE_INDEX" -gt ${#PROFILES[@]} ]; then
            echo -e "${RED}Error: Invalid profile index $PROFILE_INDEX (valid range: 1-${#PROFILES[@]})${NC}"
            exit 1
        fi
        SELECTED_PROFILES+=("${PROFILES[$((PROFILE_INDEX-1))]}")
        echo -e "${GREEN}✓${NC} Selected profile (index $PROFILE_INDEX): $(basename "${SELECTED_PROFILES[0]}")"
    else
        # No --profile flag: install to ALL profiles
        SELECTED_PROFILES=("${PROFILES[@]}")
        if [ ${#SELECTED_PROFILES[@]} -eq 1 ]; then
            echo -e "${GREEN}✓${NC} Found profile: $(basename "${SELECTED_PROFILES[0]}")"
        else
            echo -e "${GREEN}✓${NC} Found ${#SELECTED_PROFILES[@]} profiles (installing to all):"
            for p in "${SELECTED_PROFILES[@]}"; do
                local pname
                pname=$(basename "$p")
                if [ -f "$p/chrome/JS/zenleap.uc.js" ]; then
                    echo "    - $pname ${GREEN}(ZenLeap installed)${NC}"
                else
                    echo "    - $pname"
                fi
            done
        fi
    fi
}

# Set per-profile path variables for a given profile directory
set_profile_paths() {
    PROFILE_DIR="$1"
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

    local temp_dir
    temp_dir=$(mktemp -d)

    echo "  Downloading..."
    if command -v curl &> /dev/null; then
        if ! curl -sfL "$FXAUTOCONFIG_REPO" -o "$temp_dir/fxautoconfig.zip"; then
            echo -e "${RED}Error: Failed to download fx-autoconfig${NC}"
            rm -rf "$temp_dir"
            exit 1
        fi
    elif command -v wget &> /dev/null; then
        if ! wget -q "$FXAUTOCONFIG_REPO" -O "$temp_dir/fxautoconfig.zip"; then
            echo -e "${RED}Error: Failed to download fx-autoconfig${NC}"
            rm -rf "$temp_dir"
            exit 1
        fi
    else
        echo -e "${RED}Error: Neither curl nor wget found${NC}"
        rm -rf "$temp_dir"
        exit 1
    fi

    echo "  Extracting..."
    if ! unzip -q "$temp_dir/fxautoconfig.zip" -d "$temp_dir"; then
        echo -e "${RED}Error: Failed to extract fx-autoconfig${NC}"
        rm -rf "$temp_dir"
        exit 1
    fi

    # Find the extracted directory
    local extracted_dir
    extracted_dir=$(find "$temp_dir" -maxdepth 1 -type d -name "fx-autoconfig*" | head -1)

    if [ -z "$extracted_dir" ]; then
        echo -e "${RED}Error: Could not find extracted fx-autoconfig files${NC}"
        rm -rf "$temp_dir"
        exit 1
    fi

    # Install to Zen Resources (skip if config.js already exists — may be Sine or another loader)
    if [ -d "$extracted_dir/program" ]; then
        if [ -f "$ZEN_RESOURCES/config.js" ] && [ -f "$ZEN_RESOURCES/defaults/pref/config-prefs.js" ]; then
            echo "  App-level config already present (Sine or fx-autoconfig), skipping"
        elif [ "$IS_FLATPAK" = true ]; then
            echo "  Installing to Flatpak systemconfig extension..."
            mkdir -p "$ZEN_RESOURCES/defaults/pref"
            cp "$extracted_dir/program/config.js" "$ZEN_RESOURCES/config.js"
            cp "$extracted_dir/program/defaults/pref/config-prefs.js" "$ZEN_RESOURCES/defaults/pref/config-prefs.js"
        elif [ -w "$ZEN_RESOURCES" ] || [ -w "$(dirname "$ZEN_RESOURCES")" ]; then
            echo "  Installing to Zen Browser..."
            mkdir -p "$ZEN_RESOURCES/defaults/pref"
            cp "$extracted_dir/program/config.js" "$ZEN_RESOURCES/config.js"
            cp "$extracted_dir/program/defaults/pref/config-prefs.js" "$ZEN_RESOURCES/defaults/pref/config-prefs.js"
        else
            echo "  Installing to Zen Browser (may require admin password)..."
            sudo mkdir -p "$ZEN_RESOURCES/defaults/pref"
            sudo cp "$extracted_dir/program/config.js" "$ZEN_RESOURCES/config.js"
            sudo cp "$extracted_dir/program/defaults/pref/config-prefs.js" "$ZEN_RESOURCES/defaults/pref/config-prefs.js"
        fi
    fi

    # Install to profile (skip if fx-autoconfig profile files already exist to avoid overwriting customizations)
    mkdir -p "$CHROME_DIR"
    if [ -f "$CHROME_DIR/utils/boot.sys.mjs" ] || [ -f "$CHROME_DIR/utils/chrome.manifest" ]; then
        echo "  fx-autoconfig profile files already present, skipping profile copy"
    elif [ -d "$extracted_dir/profile/chrome" ] && ls "$extracted_dir/profile/chrome/"* &>/dev/null; then
        echo "  Installing to profile..."
        cp -r "$extracted_dir/profile/chrome/"* "$CHROME_DIR/"
    fi

    rm -rf "$temp_dir"
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
            backup_user_chrome
            # Remove old ZenLeap styles first
            if grep -q "ZenLeap Styles" "$CHROME_DIR/userChrome.css" 2>/dev/null; then
                if command -v perl &>/dev/null; then
                    perl -i -p0e 's/\n*\/\* === ZenLeap Styles === \*\/.*?\/\* === End ZenLeap Styles === \*\/\n?//s' "$CHROME_DIR/userChrome.css"
                else
                    echo -e "${YELLOW}⚠${NC} perl not found; old ZenLeap styles may be duplicated in userChrome.css"
                fi
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

    # Copy themes template if not already present (don't overwrite user customizations)
    if [ ! -f "$CHROME_DIR/zenleap-themes.json" ] && [ -f "$source_dir/zenleap-themes.json" ]; then
        cp "$source_dir/zenleap-themes.json" "$CHROME_DIR/zenleap-themes.json"
        echo -e "${GREEN}✓${NC} Created zenleap-themes.json template"
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
            backup_user_chrome
            if command -v perl &>/dev/null; then
                perl -i -p0e 's/\n*\/\* === ZenLeap Styles === \*\/.*?\/\* === End ZenLeap Styles === \*\/\n?//s' "$CHROME_DIR/userChrome.css"
            else
                echo -e "${YELLOW}⚠${NC} perl not found; please manually remove ZenLeap styles from userChrome.css"
            fi
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

    # Remove program-level files
    if [ -f "$ZEN_RESOURCES/config.js" ]; then
        if [ "$IS_FLATPAK" = true ] || [ -w "$ZEN_RESOURCES/config.js" ]; then
            rm -f "$ZEN_RESOURCES/config.js"
        else
            echo "  Removing config.js (may require admin password)..."
            sudo rm -f "$ZEN_RESOURCES/config.js"
        fi
        echo -e "${GREEN}✓${NC} Removed config.js"
        found_anything=true
    fi

    if [ -f "$ZEN_RESOURCES/defaults/pref/config-prefs.js" ]; then
        if [ "$IS_FLATPAK" = true ] || [ -w "$ZEN_RESOURCES/defaults/pref/config-prefs.js" ]; then
            rm -f "$ZEN_RESOURCES/defaults/pref/config-prefs.js"
        else
            sudo rm -f "$ZEN_RESOURCES/defaults/pref/config-prefs.js"
        fi
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

    local cleared=false

    if [ "$OS" = "macos" ]; then
        if [ -d "$HOME/Library/Caches/zen/startupCache" ]; then
            rm -rf "$HOME/Library/Caches/zen/startupCache" 2>/dev/null || true
            cleared=true
        fi
    else
        # Standard Linux cache
        if [ -d "$HOME/.cache/zen/startupCache" ]; then
            rm -rf "$HOME/.cache/zen/startupCache" 2>/dev/null || true
            cleared=true
        fi
        # Flatpak cache
        if [ -d "$HOME/.var/app/app.zen_browser.zen/cache/zen/startupCache" ]; then
            rm -rf "$HOME/.var/app/app.zen_browser.zen/cache/zen/startupCache" 2>/dev/null || true
            cleared=true
        fi
    fi

    # Also clear per-profile startup caches
    for profile in "${SELECTED_PROFILES[@]}"; do
        if [ -d "$profile/startupCache" ]; then
            rm -rf "$profile/startupCache" 2>/dev/null || true
            cleared=true
        fi
    done

    if [ "$cleared" = true ]; then
        echo -e "${GREEN}✓${NC} Startup cache cleared"
    else
        echo -e "${YELLOW}⚠${NC} No startup cache found (this is OK)"
    fi
}

# Launch Zen Browser
launch_zen() {
    if [ "$OS" = "macos" ]; then
        open "$ZEN_APP"
    elif [ "$IS_FLATPAK" = true ]; then
        flatpak run app.zen_browser.zen &
    elif command -v zen &>/dev/null; then
        zen &
    elif [ -x "$ZEN_RESOURCES/zen" ]; then
        "$ZEN_RESOURCES/zen" &
    else
        echo -e "${YELLOW}⚠${NC} Could not find zen executable to launch"
    fi
}

# Main install function
do_install() {
    detect_os
    find_profiles

    # Track if Zen was running before we close it
    ZEN_WAS_RUNNING=false
    if pgrep -x "zen" > /dev/null 2>&1 || pgrep -x "Zen Browser" > /dev/null 2>&1; then
        ZEN_WAS_RUNNING=true
    fi

    check_zen_running

    # Install fx-autoconfig once (uses first profile to check, installs to all)
    set_profile_paths "${SELECTED_PROFILES[0]}"
    if ! check_fxautoconfig; then
        install_fxautoconfig
    fi

    # Install ZenLeap to each selected profile
    for profile in "${SELECTED_PROFILES[@]}"; do
        set_profile_paths "$profile"
        echo ""
        echo -e "${BLUE}--- $(basename "$profile") ---${NC}"

        # Ensure fx-autoconfig profile files exist in this profile too
        if [ ! -f "$CHROME_DIR/utils/boot.sys.mjs" ] && [ ! -f "$CHROME_DIR/utils/chrome.manifest" ]; then
            install_fxautoconfig
        fi

        install_zenleap
    done

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
    if [ "$ZEN_WAS_RUNNING" = true ]; then
        echo -e "${BLUE}Restarting Zen Browser...${NC}"
        launch_zen
        echo -e "${GREEN}✓${NC} Zen Browser restarted"
    elif [ "$AUTO_YES" = true ]; then
        echo -e "${YELLOW}Please start Zen Browser to activate ZenLeap${NC}"
    else
        echo -n "Open Zen Browser now? (y/n): "
        read -r response <&3
        if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
            launch_zen
        else
            echo -e "${YELLOW}Please start Zen Browser to activate ZenLeap${NC}"
        fi
    fi
}

# Main uninstall function
do_uninstall() {
    detect_os
    find_profiles

    # Track if Zen was running before we closed it
    ZEN_WAS_RUNNING=false
    if pgrep -x "zen" > /dev/null 2>&1 || pgrep -x "Zen Browser" > /dev/null 2>&1; then
        ZEN_WAS_RUNNING=true
    fi

    check_zen_running

    # Uninstall ZenLeap from each selected profile
    for profile in "${SELECTED_PROFILES[@]}"; do
        set_profile_paths "$profile"
        echo ""
        echo -e "${BLUE}--- $(basename "$profile") ---${NC}"
        uninstall_zenleap
    done

    # Offer to uninstall fx-autoconfig
    local has_fxautoconfig=false
    for profile in "${SELECTED_PROFILES[@]}"; do
        set_profile_paths "$profile"
        if [ -f "$ZEN_RESOURCES/config.js" ] || [ -d "$CHROME_DIR/utils" ]; then
            has_fxautoconfig=true
            break
        fi
    done
    if [ "$has_fxautoconfig" = true ]; then
        if [ "$AUTO_YES" = true ]; then
            if [ "$REMOVE_FXAUTOCONFIG" = true ]; then
                for profile in "${SELECTED_PROFILES[@]}"; do
                    set_profile_paths "$profile"
                    uninstall_fxautoconfig
                done
            else
                echo -e "${YELLOW}Skipping fx-autoconfig removal (use --remove-fxautoconfig to include)${NC}"
            fi
        else
            echo ""
            echo -n "Also remove fx-autoconfig? Other userscripts may depend on it. (y/n): "
            read -r response <&3
            if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
                for profile in "${SELECTED_PROFILES[@]}"; do
                    set_profile_paths "$profile"
                    uninstall_fxautoconfig
                done
            fi
        fi
    fi

    clear_cache

    echo ""
    echo -e "${GREEN}Uninstallation complete!${NC}"
    echo ""
    echo -e "${BLUE}Note:${NC} A backup of your userChrome.css was saved as"
    echo "  userChrome.css.zenleap-backup in each profile's chrome/ directory."
    echo "  If Zen looks broken after uninstalling, restore it with:"
    echo "    cp chrome/userChrome.css.zenleap-backup chrome/userChrome.css"

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
                launch_zen
            fi
        fi
    else
        echo -e "${YELLOW}Please restart Zen Browser if it's running${NC}"
    fi
}

# Check version and report status
do_check() {
    detect_os
    find_profiles

    local remote_version=$(get_remote_version)
    local any_outdated=false

    for profile in "${SELECTED_PROFILES[@]}"; do
        set_profile_paths "$profile"
        local pname
        pname=$(basename "$profile")
        local installed_version=$(get_version "$JS_DIR/zenleap.uc.js")

        if [ -z "$installed_version" ]; then
            echo "$pname: NOT_INSTALLED"
        elif [ -z "$remote_version" ]; then
            echo "$pname: INSTALLED:$installed_version:UNKNOWN"
        elif version_gte "$installed_version" "$remote_version"; then
            echo "$pname: UP_TO_DATE:$installed_version:$remote_version"
        else
            echo "$pname: OUTDATED:$installed_version:$remote_version"
            any_outdated=true
        fi
    done

    if [ "$any_outdated" = true ]; then
        return 1
    fi
    return 0
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
        --zen-path)
            shift
            if [ -z "$1" ] || [[ "$1" == --* ]]; then
                echo -e "${RED}Error: --zen-path requires a directory argument${NC}"
                exit 1
            fi
            CUSTOM_ZEN_PATH="$1"
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
            echo "  --profile <index>       Select profile by index (1-based); omit for ALL profiles"
            echo "  --yes, -y               Auto-confirm all prompts (non-interactive mode)"
            echo "  --remove-fxautoconfig   Also remove fx-autoconfig during uninstall"
            echo "  --zen-path <dir>        Specify Zen Browser installation directory manually"
            echo ""
            echo "Non-interactive examples:"
            echo "  $0 install --remote --profile 1 --yes"
            echo "  $0 install --remote --zen-path /opt/zen-browser-bin --yes"
            echo "  $0 uninstall --profile 1 --yes --remove-fxautoconfig"
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
