#!/bin/bash
# ZenLeap Plugin Installer
# Usage: ./install-plugin.sh <plugin-path> [OPTIONS]
#
# Installs a ZenLeap plugin from a local directory into the correct profile location.
#
# Arguments:
#   <plugin-path>           Path to the plugin directory (relative or absolute).
#                           Must contain manifest.json and plugin.js.
#
# Options:
#   --profile <index>       Select profile by index (1-based); omit to install to ALL profiles
#   --yes, -y               Auto-confirm all prompts (non-interactive mode)
#   --list                  List installed plugins for each profile
#   --uninstall <id>        Uninstall a plugin by its id
#
# Examples:
#   ./install-plugin.sh ./examples/plugins/tab-stats
#   ./install-plugin.sh ~/my-plugin --profile 1 --yes
#   ./install-plugin.sh --list
#   ./install-plugin.sh --uninstall tab-stats --profile 1

set -e

# Colors
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
DIM=$'\033[2m'
NC=$'\033[0m'

# Pre-scan for non-interactive flags (needed before tty setup)
_NON_INTERACTIVE=false
for _arg in "$@"; do
    case "$_arg" in
        --yes|-y) _NON_INTERACTIVE=true ;;
        --help|-h) _NON_INTERACTIVE=true ;;
        --list) _NON_INTERACTIVE=true ;;
    esac
done

# Open /dev/tty for interactive input (needed when piped from curl)
if [ "$_NON_INTERACTIVE" = true ]; then
    exec 3</dev/null
elif [ -t 0 ]; then
    exec 3<&0
else
    if [ -e /dev/tty ]; then
        exec 3</dev/tty
    else
        echo "Error: No terminal available for interactive input"
        echo "Try using --yes (-y) and --profile <index> for non-interactive mode"
        exit 1
    fi
fi

# Flags
PROFILE_INDEX=""
AUTO_YES=false
LIST_MODE=false
UNINSTALL_ID=""
PLUGIN_PATH=""

# Detect OS and set profile base
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
        MINGW*|MSYS*|CYGWIN*)
            echo -e "${RED}Windows is not currently supported.${NC}"
            exit 1
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
        echo "Please run Zen Browser at least once to create a profile"
        exit 1
    fi

    PROFILES=()
    while IFS= read -r -d '' dir; do
        PROFILES+=("$dir")
    done < <(find "$PROFILE_BASE" -maxdepth 1 -type d ! -name "Profiles" ! -path "$PROFILE_BASE" -print0 2>/dev/null)

    if [ ${#PROFILES[@]} -eq 0 ]; then
        echo -e "${RED}Error: Could not find any Zen profiles${NC}"
        exit 1
    fi

    SELECTED_PROFILES=()

    if [ -n "$PROFILE_INDEX" ]; then
        if ! [[ "$PROFILE_INDEX" =~ ^[0-9]+$ ]] || [ "$PROFILE_INDEX" -lt 1 ] || [ "$PROFILE_INDEX" -gt ${#PROFILES[@]} ]; then
            echo -e "${RED}Error: Invalid profile index $PROFILE_INDEX (valid range: 1-${#PROFILES[@]})${NC}"
            exit 1
        fi
        SELECTED_PROFILES+=("${PROFILES[$((PROFILE_INDEX-1))]}")
    else
        SELECTED_PROFILES=("${PROFILES[@]}")
    fi
}

# Validate a plugin directory
validate_plugin() {
    local plugin_dir="$1"

    if [ ! -d "$plugin_dir" ]; then
        echo -e "${RED}Error: '$plugin_dir' is not a directory${NC}"
        return 1
    fi

    if [ ! -f "$plugin_dir/manifest.json" ]; then
        echo -e "${RED}Error: Missing manifest.json in '$plugin_dir'${NC}"
        return 1
    fi

    if [ ! -f "$plugin_dir/plugin.js" ]; then
        echo -e "${RED}Error: Missing plugin.js in '$plugin_dir'${NC}"
        return 1
    fi

    # Validate manifest has required fields
    local id name
    if command -v python3 &> /dev/null; then
        id=$(python3 -c "import json,sys; m=json.load(open(sys.argv[1])); print(m.get('id',''))" "$plugin_dir/manifest.json" 2>/dev/null)
        name=$(python3 -c "import json,sys; m=json.load(open(sys.argv[1])); print(m.get('name',''))" "$plugin_dir/manifest.json" 2>/dev/null)
    elif command -v node &> /dev/null; then
        id=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(m.id||'')" "$plugin_dir/manifest.json" 2>/dev/null)
        name=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(m.name||'')" "$plugin_dir/manifest.json" 2>/dev/null)
    else
        echo -e "${YELLOW}⚠${NC} Cannot validate manifest (no python3 or node); assuming valid"
        # Best-effort: just check that the file is valid JSON with grep
        if ! grep -q '"id"' "$plugin_dir/manifest.json" 2>/dev/null; then
            echo -e "${RED}Error: manifest.json appears to be missing 'id' field${NC}"
            return 1
        fi
        if ! grep -q '"name"' "$plugin_dir/manifest.json" 2>/dev/null; then
            echo -e "${RED}Error: manifest.json appears to be missing 'name' field${NC}"
            return 1
        fi
        # Fallback: extract id from JSON with grep/sed (imprecise but workable)
        id=$(grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' "$plugin_dir/manifest.json" | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        name=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$plugin_dir/manifest.json" | head -1 | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    fi

    if [ -z "$id" ]; then
        echo -e "${RED}Error: manifest.json is missing required 'id' field${NC}"
        return 1
    fi

    if [ -z "$name" ]; then
        echo -e "${RED}Error: manifest.json is missing required 'name' field${NC}"
        return 1
    fi

    # Validate id is a safe directory name (alphanumeric, hyphens, underscores)
    if ! echo "$id" | grep -qE '^[a-zA-Z0-9_-]+$'; then
        echo -e "${RED}Error: Plugin id '$id' contains invalid characters (only a-z, 0-9, hyphens, underscores allowed)${NC}"
        return 1
    fi

    PLUGIN_ID="$id"
    PLUGIN_NAME="$name"
    return 0
}

# Install plugin to a single profile
install_to_profile() {
    local profile_dir="$1"
    local source_dir="$2"
    local pname
    pname=$(basename "$profile_dir")

    local plugins_dir="$profile_dir/chrome/zenleap-plugins"
    local dest_dir="$plugins_dir/$PLUGIN_ID"

    # Check if already installed
    if [ -d "$dest_dir" ]; then
        if [ "$AUTO_YES" = true ]; then
            echo -e "  ${YELLOW}⚠${NC} Plugin '$PLUGIN_ID' already exists in $pname, overwriting"
        else
            echo -e "  ${YELLOW}⚠${NC} Plugin '$PLUGIN_ID' already exists in $pname"
            echo -n "  Overwrite? (y/n): "
            read -r response <&3
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                echo -e "  ${DIM}Skipped${NC}"
                return 0
            fi
        fi
        rm -rf "$dest_dir"
    fi

    # Create plugins directory if needed
    mkdir -p "$plugins_dir"

    # Copy the plugin directory
    cp -r "$source_dir" "$dest_dir"

    echo -e "  ${GREEN}✓${NC} Installed to $pname"
}

# Uninstall plugin from a single profile
uninstall_from_profile() {
    local profile_dir="$1"
    local plugin_id="$2"
    local pname
    pname=$(basename "$profile_dir")

    local dest_dir="$profile_dir/chrome/zenleap-plugins/$plugin_id"

    if [ ! -d "$dest_dir" ]; then
        echo -e "  ${DIM}Not installed in $pname${NC}"
        return 0
    fi

    rm -rf "$dest_dir"
    echo -e "  ${GREEN}✓${NC} Removed from $pname"
}

# List installed plugins for a profile
list_plugins_for_profile() {
    local profile_dir="$1"
    local pname
    pname=$(basename "$profile_dir")

    local plugins_dir="$profile_dir/chrome/zenleap-plugins"

    echo -e "${BLUE}--- $pname ---${NC}"

    if [ ! -d "$plugins_dir" ]; then
        echo -e "  ${DIM}No plugins installed${NC}"
        return
    fi

    local found=false
    for plugin_path in "$plugins_dir"/*/; do
        [ -d "$plugin_path" ] || continue
        local manifest="$plugin_path/manifest.json"
        if [ -f "$manifest" ]; then
            local id name version
            if command -v python3 &> /dev/null; then
                id=$(python3 -c "import json,sys; m=json.load(open(sys.argv[1])); print(m.get('id','?'))" "$manifest" 2>/dev/null)
                name=$(python3 -c "import json,sys; m=json.load(open(sys.argv[1])); print(m.get('name','?'))" "$manifest" 2>/dev/null)
                version=$(python3 -c "import json,sys; m=json.load(open(sys.argv[1])); print(m.get('version','?'))" "$manifest" 2>/dev/null)
            elif command -v node &> /dev/null; then
                id=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(m.id||'?')" "$manifest" 2>/dev/null)
                name=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(m.name||'?')" "$manifest" 2>/dev/null)
                version=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(m.version||'?')" "$manifest" 2>/dev/null)
            else
                id=$(basename "$plugin_path")
                name="$id"
                version="?"
            fi
            echo -e "  ${CYAN}$id${NC} — $name ${DIM}v$version${NC}"
            found=true
        fi
    done

    if [ "$found" = false ]; then
        echo -e "  ${DIM}No plugins installed${NC}"
    fi
}

# ─── Parse arguments ───

while [ $# -gt 0 ]; do
    case "$1" in
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
        --list)
            LIST_MODE=true
            ;;
        --uninstall)
            shift
            if [ -z "$1" ] || [[ "$1" == --* ]]; then
                echo -e "${RED}Error: --uninstall requires a plugin id${NC}"
                exit 1
            fi
            UNINSTALL_ID="$1"
            ;;
        --help|-h)
            echo "Usage: $0 <plugin-path> [OPTIONS]"
            echo ""
            echo "Installs a ZenLeap plugin from a local directory."
            echo ""
            echo "Arguments:"
            echo "  <plugin-path>           Path to plugin directory (must have manifest.json + plugin.js)"
            echo ""
            echo "Options:"
            echo "  --profile <index>       Select profile by index (1-based); omit for ALL profiles"
            echo "  --yes, -y               Auto-confirm all prompts"
            echo "  --list                  List installed plugins"
            echo "  --uninstall <id>        Uninstall a plugin by its id"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 ./examples/plugins/tab-stats"
            echo "  $0 ~/my-plugin --profile 1 --yes"
            echo "  $0 --list"
            echo "  $0 --uninstall tab-stats --profile 1"
            exit 0
            ;;
        -*)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            if [ -z "$PLUGIN_PATH" ]; then
                PLUGIN_PATH="$1"
            else
                echo -e "${RED}Error: Unexpected argument '$1' (plugin path already set to '$PLUGIN_PATH')${NC}"
                exit 1
            fi
            ;;
    esac
    shift
done

# ─── Main ───

detect_os
find_profiles

# List mode
if [ "$LIST_MODE" = true ]; then
    echo -e "${BLUE}Installed ZenLeap Plugins${NC}"
    echo ""
    for profile in "${SELECTED_PROFILES[@]}"; do
        list_plugins_for_profile "$profile"
        echo ""
    done
    exit 0
fi

# Uninstall mode
if [ -n "$UNINSTALL_ID" ]; then
    if ! echo "$UNINSTALL_ID" | grep -qE '^[a-zA-Z0-9_-]+$'; then
        echo -e "${RED}Error: Invalid plugin id '$UNINSTALL_ID' (only a-z, 0-9, hyphens, underscores allowed)${NC}"
        exit 1
    fi
    echo -e "${BLUE}Uninstalling plugin '${UNINSTALL_ID}'...${NC}"
    for profile in "${SELECTED_PROFILES[@]}"; do
        uninstall_from_profile "$profile" "$UNINSTALL_ID"
    done
    echo ""
    echo -e "${GREEN}Done.${NC} Restart Zen Browser for changes to take effect."
    exit 0
fi

# Install mode — require a path
if [ -z "$PLUGIN_PATH" ]; then
    echo -e "${RED}Error: No plugin path provided${NC}"
    echo "Usage: $0 <plugin-path> [OPTIONS]"
    echo "Use --help for more information"
    exit 1
fi

# Resolve relative path to absolute
if [[ "$PLUGIN_PATH" != /* ]]; then
    PLUGIN_PATH="$(cd "$(dirname "$PLUGIN_PATH")" 2>/dev/null && pwd)/$(basename "$PLUGIN_PATH")"
fi

# Remove trailing slash
PLUGIN_PATH="${PLUGIN_PATH%/}"

# Validate plugin
echo -e "${BLUE}Validating plugin...${NC}"
if ! validate_plugin "$PLUGIN_PATH"; then
    exit 1
fi
echo -e "${GREEN}✓${NC} Valid plugin: ${CYAN}$PLUGIN_NAME${NC} ${DIM}($PLUGIN_ID)${NC}"

# Show what we're about to do
echo ""
if [ ${#SELECTED_PROFILES[@]} -eq 1 ]; then
    echo -e "Installing to profile: ${CYAN}$(basename "${SELECTED_PROFILES[0]}")${NC}"
else
    echo -e "Installing to ${#SELECTED_PROFILES[@]} profiles"
fi
echo ""

# Confirm unless auto-yes
if [ "$AUTO_YES" != true ]; then
    echo -n "Proceed? (y/n): "
    read -r response <&3
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi
    echo ""
fi

# Install to each profile
for profile in "${SELECTED_PROFILES[@]}"; do
    install_to_profile "$profile" "$PLUGIN_PATH"
done

echo ""
echo -e "${GREEN}Done.${NC} Restart Zen Browser for the plugin to load."
