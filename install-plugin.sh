#!/bin/bash
# ZenLeap Plugin Installer
# Usage: ./install-plugin.sh <plugin-path> [OPTIONS]
#
# Installs a ZenLeap plugin from a local directory into <profile>/chrome/zenleap-plugins/<id>/.
# Run it from a ZenLeap checkout (it uses scripts/lib/zen-paths.sh).
#
# Arguments:
#   <plugin-path>           Path to the plugin directory (relative or absolute).
#                           Must contain manifest.json and plugin.js.
#
# Options:
#   --profile <sel>         Profile(s): a number from the list, a profile name, or "all";
#                           repeatable. Default: the profiles that have ZenLeap (else the
#                           default profile)
#   --profile-dir <dir>     Use this profile directory directly; repeatable
#   --yes, -y               Auto-confirm all prompts (non-interactive mode)
#   --list                  List installed plugins for each profile
#   --uninstall <id>        Uninstall a plugin by its id
#
# Plugins run with full browser (chrome) privileges. New plugins stay disabled
# until you enable them in ZenLeap's Plugin Manager.
#
# Examples:
#   ./install-plugin.sh ./examples/plugins/tab-stats
#   ./install-plugin.sh ~/my-plugin --profile 1 --yes
#   ./install-plugin.sh --list
#   ./install-plugin.sh --uninstall tab-stats --profile 1

if [ -z "${BASH_VERSION:-}" ]; then
    echo "This script needs bash: bash install-plugin.sh ..." >&2
    exit 1
fi
set +o posix   # `sh` on macOS is bash in POSIX mode, which has no <(...)

set -e

# Colors
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
DIM=$'\033[2m'
NC=$'\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/scripts/lib/zen-paths.sh" ]; then
    echo "Error: $SCRIPT_DIR/scripts/lib/zen-paths.sh not found; run this script from a ZenLeap checkout."
    exit 1
fi
# shellcheck source=scripts/lib/zen-paths.sh
. "$SCRIPT_DIR/scripts/lib/zen-paths.sh"

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
    if [ -e /dev/tty ] && { exec 3</dev/tty; } 2>/dev/null; then
        :
    else
        echo "Error: No terminal available for interactive input"
        echo "Try using --yes (-y) for non-interactive mode"
        exit 1
    fi
fi

# Flags
PROFILE_SPECS=()
PROFILE_DIR_ARGS=()
AUTO_YES=false
LIST_MODE=false
UNINSTALL_ID=""
PLUGIN_PATH=""

# Find Zen profiles and decide which ones to use (sets ZP_SELECTED).
# Usage: find_profiles <install|uninstall|list>
find_profiles() {
    local action="$1" i d suggested=()
    case "$(uname -s)" in
        Darwin|Linux) ;;
        MINGW*|MSYS*|CYGWIN*)
            echo -e "${RED}Windows is not currently supported.${NC}"
            exit 1
            ;;
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
        echo "Please run Zen Browser at least once to create a profile"
        exit 1
    fi

    if [ ${#PROFILE_DIR_ARGS[@]} -gt 0 ]; then
        for d in "${PROFILE_DIR_ARGS[@]}"; do
            if [ "$action" = install ]; then check_profile_dir "$d"; fi
            if ! zp_use_profile_dir "$d"; then
                echo -e "${RED}Error: $ZP_ERROR${NC}"
                exit 1
            fi
        done
        return 0
    fi
    if [ ${#PROFILE_SPECS[@]} -gt 0 ]; then
        if ! zp_select_specs "${PROFILE_SPECS[@]}"; then
            echo -e "${RED}Error: $ZP_ERROR${NC}"
            exit 1
        fi
        return 0
    fi
    if [ "$action" = "list" ]; then
        zp_select all
        return 0
    fi

    for ((i = 0; i < ${#ZP_PROFILE_DIRS[@]}; i++)); do
        if [ "$action" = "uninstall" ]; then
            if [ -d "${ZP_PROFILE_DIRS[$i]}/chrome/zenleap-plugins/$UNINSTALL_ID" ]; then suggested+=("$i"); fi
        elif [ -n "$(zp_zenleap_version "${ZP_PROFILE_DIRS[$i]}")" ]; then
            suggested+=("$i")
        fi
    done
    if [ "$action" = "install" ] && [ ${#suggested[@]} -eq 0 ] && [ "$ZP_DEFAULT" -ge 0 ]; then
        suggested=("$ZP_DEFAULT")
    fi

    if [ ${#ZP_PROFILE_DIRS[@]} -eq 1 ]; then
        if [ "$action" = "install" ] || [ ${#suggested[@]} -eq 1 ]; then ZP_SELECTED=(0); fi
    elif [ "$AUTO_YES" = true ] || { [ "$action" = "uninstall" ] && [ ${#suggested[@]} -eq 0 ]; }; then
        ZP_SELECTED=("${suggested[@]}")
    else
        echo "Zen profiles (in $ZP_ROOT):"
        if ! zp_menu plugin_profile_status "${suggested[@]}"; then
            echo "Aborted."
            exit 0
        fi
        echo ""
    fi
}

# --profile-dir must name a profile (a typo such as the home directory must not
# get a chrome/ folder): interactive runs may insist, --yes refuses.
check_profile_dir() {
    local ans
    if [ ! -d "$1" ] || zp_is_profile_dir "$1"; then
        return 0   # a missing folder is reported by zp_use_profile_dir
    fi
    echo -e "${YELLOW}⚠${NC} $1 does not look like a Zen profile (no prefs.js, times.json or compatibility.ini)."
    if [ "$AUTO_YES" = true ]; then
        echo -e "${RED}Error: Not installing into it with --yes; run without --yes to confirm.${NC}"
        exit 1
    fi
    echo -n "  Install into it anyway? (y/N): "
    read -r ans <&3 || ans="n"
    case "$ans" in
        y|Y|yes|Yes) return 0 ;;
    esac
    echo "Aborted."
    exit 1
}

# Plugin ids become folder names: ASCII letters, digits, "_" and "-" only.
# Checked character by character (independent of the locale; an id with a
# newline fails too).
valid_plugin_id() {
    case "$1" in
        ""|*[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-]*) return 1 ;;
    esac
    return 0
}

# Status note for the profile list
plugin_profile_status() {
    local dir="${ZP_PROFILE_DIRS[$1]}" v
    v=$(zp_zenleap_version "$dir")
    if [ -n "$v" ]; then
        printf 'ZenLeap %s' "$v"
    else
        printf 'no ZenLeap'
    fi
    if [ -n "$PLUGIN_ID" ] && [ -d "$dir/chrome/zenleap-plugins/$PLUGIN_ID" ]; then
        printf ', %s installed' "$PLUGIN_ID"
    fi
}

# Read a string field from a JSON file (python3 or node; grep as last resort)
json_field() {
    local file="$1" field="$2" default="$3"
    if command -v python3 &> /dev/null; then
        python3 -c "import json,sys; m=json.load(open(sys.argv[1])); v=m.get(sys.argv[2], sys.argv[3]); print(v if isinstance(v, str) else sys.argv[3])" "$file" "$field" "$default" 2>/dev/null
    elif command -v node &> /dev/null; then
        node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const v=m[process.argv[2]];console.log(typeof v==='string'?v:process.argv[3])" "$file" "$field" "$default" 2>/dev/null
    else
        # Imprecise, but workable for simple manifests
        grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$file" | head -n 1 | sed "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/"
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

    if ! command -v python3 &> /dev/null && ! command -v node &> /dev/null; then
        echo -e "${YELLOW}⚠${NC} Cannot fully validate manifest.json (no python3 or node)"
    fi

    # Validate manifest has required fields
    local id name
    id=$(json_field "$plugin_dir/manifest.json" id "")
    name=$(json_field "$plugin_dir/manifest.json" name "")

    if [ -z "$id" ]; then
        echo -e "${RED}Error: manifest.json is missing required 'id' field (or is not valid JSON)${NC}"
        return 1
    fi

    if [ -z "$name" ]; then
        echo -e "${RED}Error: manifest.json is missing required 'name' field${NC}"
        return 1
    fi

    # Validate id is a safe directory name (alphanumeric, hyphens, underscores)
    if ! valid_plugin_id "$id"; then
        echo -e "${RED}Error: Plugin id '$id' contains invalid characters (only a-z, 0-9, hyphens, underscores allowed)${NC}"
        return 1
    fi

    PLUGIN_ID="$id"
    PLUGIN_NAME="$name"
    return 0
}

# Install plugin to profile index $1
install_to_profile() {
    local profile_dir="${ZP_PROFILE_DIRS[$1]}"
    local source_dir="$2"
    local pname="${ZP_PROFILE_NAMES[$1]}"
    local response

    local plugins_dir="$profile_dir/chrome/zenleap-plugins"
    local dest_dir="$plugins_dir/$PLUGIN_ID"
    local src_phys dest_phys new old

    if [ -z "$(zp_zenleap_version "$profile_dir")" ]; then
        echo -e "  ${YELLOW}⚠${NC} ZenLeap is not installed in $pname; the plugin will load once it is"
    fi

    # The plugin folder given may be the installed copy itself (e.g. a plugin
    # edited in place), or contain it: never delete or copy into the source.
    mkdir -p "$plugins_dir"
    src_phys=$(zp__physical_dir "$source_dir")
    dest_phys="$(zp__physical_dir "$plugins_dir")/$PLUGIN_ID"
    if [ "$src_phys" = "$dest_phys" ]; then
        echo -e "  ${GREEN}✓${NC} $pname: that folder is the installed plugin already; nothing to copy"
        return 0
    fi
    case "$dest_phys/" in
        "$src_phys"/*)
            echo -e "  ${RED}Error: the plugin folder contains $pname's plugin folder; not copying it into itself${NC}"
            return 1
            ;;
    esac
    case "$src_phys/" in
        "$dest_phys"/*)
            echo -e "  ${RED}Error: the plugin folder is inside the installed copy in $pname; copy it somewhere else first${NC}"
            return 1
            ;;
    esac

    # Check if already installed
    if [ -d "$dest_dir" ]; then
        if [ "$AUTO_YES" = true ]; then
            echo -e "  ${YELLOW}⚠${NC} Plugin '$PLUGIN_ID' already exists in $pname, overwriting"
        else
            echo -e "  ${YELLOW}⚠${NC} Plugin '$PLUGIN_ID' already exists in $pname"
            echo -n "  Overwrite? (y/n): "
            read -r response <&3 || response="n"
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                echo -e "  ${DIM}Skipped${NC}"
                return 0
            fi
        fi
    fi

    # Copy next to the destination first, then swap it in, so a failed copy
    # never leaves the plugin half-copied or deleted. The temporary folders sit
    # in chrome/, not in zenleap-plugins/: ZenLeap loads every folder there that
    # has a manifest, so a leftover copy would load as a second plugin.
    new="$profile_dir/chrome/.zenleap-plugin-$PLUGIN_ID.new"
    old="$profile_dir/chrome/.zenleap-plugin-$PLUGIN_ID.old"
    rm -rf "$new" "$old"
    if ! cp -R "$source_dir" "$new"; then
        rm -rf "$new"
        echo -e "  ${RED}Error: could not copy the plugin into $pname${NC}"
        return 1
    fi
    if [ -d "$dest_dir" ] && ! mv "$dest_dir" "$old"; then
        rm -rf "$new"
        echo -e "  ${RED}Error: could not replace the installed copy in $pname${NC}"
        return 1
    fi
    if ! mv "$new" "$dest_dir"; then
        if [ -d "$old" ]; then mv "$old" "$dest_dir"; fi
        rm -rf "$new"
        echo -e "  ${RED}Error: could not install the plugin into $pname${NC}"
        return 1
    fi
    rm -rf "$old"

    echo -e "  ${GREEN}✓${NC} Installed to $pname"
}

# Uninstall plugin from profile index $1
uninstall_from_profile() {
    local profile_dir="${ZP_PROFILE_DIRS[$1]}"
    local plugin_id="$2"
    local pname="${ZP_PROFILE_NAMES[$1]}"

    local dest_dir="$profile_dir/chrome/zenleap-plugins/$plugin_id"

    if [ ! -d "$dest_dir" ]; then
        echo -e "  ${DIM}Not installed in $pname${NC}"
        return 0
    fi

    rm -rf "$dest_dir"
    echo -e "  ${GREEN}✓${NC} Removed from $pname"
}

# List installed plugins for profile index $1
list_plugins_for_profile() {
    local profile_dir="${ZP_PROFILE_DIRS[$1]}"
    local plugins_dir="$profile_dir/chrome/zenleap-plugins"

    echo -e "${BLUE}--- $(zp_describe "$1") ---${NC}"

    if [ ! -d "$plugins_dir" ]; then
        echo -e "  ${DIM}No plugins installed${NC}"
        return
    fi

    local found=false plugin_path manifest id name version
    for plugin_path in "$plugins_dir"/*/; do
        [ -d "$plugin_path" ] || continue
        manifest="$plugin_path/manifest.json"
        if [ -f "$manifest" ]; then
            id=$(json_field "$manifest" id "?")
            name=$(json_field "$manifest" name "?")
            version=$(json_field "$manifest" version "?")
            echo -e "  ${CYAN}${id:-?}${NC} — ${name:-?} ${DIM}v${version:-?}${NC}"
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
        --list)
            LIST_MODE=true
            ;;
        --uninstall)
            shift
            if [ -z "${1:-}" ] || [[ "$1" == --* ]]; then
                echo -e "${RED}Error: --uninstall requires a plugin id${NC}"
                exit 1
            fi
            UNINSTALL_ID="$1"
            ;;
        --help|-h)
            echo "Usage: $0 <plugin-path> [OPTIONS]"
            echo ""
            echo "Installs a ZenLeap plugin from a local directory."
            echo "Plugins run with full browser privileges: only install plugins you trust."
            echo "New plugins stay disabled until you enable them in ZenLeap's Plugin Manager."
            echo ""
            echo "Arguments:"
            echo "  <plugin-path>           Path to plugin directory (must have manifest.json + plugin.js)"
            echo ""
            echo "Options:"
            echo "  --profile <sel>         Profile(s): number from the list, profile name, or \"all\";"
            echo "                          repeatable (default: profiles that have ZenLeap, else the"
            echo "                          default profile)"
            echo "  --profile-dir <dir>     Use this profile directory directly; repeatable"
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

if [ ${#PROFILE_SPECS[@]} -gt 0 ] && [ ${#PROFILE_DIR_ARGS[@]} -gt 0 ]; then
    echo -e "${RED}Error: Use either --profile or --profile-dir, not both${NC}"
    exit 1
fi

# ─── Main ───

PLUGIN_ID=""

# List mode
if [ "$LIST_MODE" = true ]; then
    find_profiles list
    echo -e "${BLUE}Installed ZenLeap Plugins${NC}"
    echo ""
    for i in "${ZP_SELECTED[@]}"; do
        list_plugins_for_profile "$i"
        echo ""
    done
    exit 0
fi

# Uninstall mode
if [ -n "$UNINSTALL_ID" ]; then
    if ! valid_plugin_id "$UNINSTALL_ID"; then
        echo -e "${RED}Error: Invalid plugin id '$UNINSTALL_ID' (only a-z, 0-9, hyphens, underscores allowed)${NC}"
        exit 1
    fi
    PLUGIN_ID="$UNINSTALL_ID"
    find_profiles uninstall
    if [ ${#ZP_SELECTED[@]} -eq 0 ]; then
        echo "Plugin '$UNINSTALL_ID' is not installed in any Zen profile."
        exit 0
    fi
    echo -e "${BLUE}Uninstalling plugin '${UNINSTALL_ID}'...${NC}"
    for i in "${ZP_SELECTED[@]}"; do
        uninstall_from_profile "$i" "$UNINSTALL_ID"
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
echo ""

find_profiles install
if [ ${#ZP_SELECTED[@]} -eq 0 ]; then
    echo -e "${RED}Error: Could not tell which Zen profile to use; pass --profile <number|name|all>${NC}"
    exit 1
fi

# Show what we're about to do
if [ ${#ZP_SELECTED[@]} -eq 1 ]; then
    echo -e "Installing to profile: ${CYAN}$(zp_describe "${ZP_SELECTED[0]}")${NC}"
else
    echo -e "Installing to ${#ZP_SELECTED[@]} profiles"
fi
echo -e "${YELLOW}⚠${NC} Plugins run with full browser privileges. Only install plugins you trust."
echo ""

# Confirm unless auto-yes
if [ "$AUTO_YES" != true ]; then
    echo -n "Proceed? (y/n): "
    read -r response <&3 || response="n"
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi
    echo ""
fi

# Install to each profile
failed=false
for i in "${ZP_SELECTED[@]}"; do
    install_to_profile "$i" "$PLUGIN_PATH" || failed=true
done
if [ "$failed" = true ]; then
    exit 1
fi

echo ""
echo -e "${GREEN}Done.${NC} Restart Zen Browser, then enable the plugin in ZenLeap's Plugin Manager"
echo "(command palette: Ctrl+Shift+/ → \"Manage Plugins\"). New plugins start disabled."
