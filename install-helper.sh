#!/bin/bash
# ZenLeap Installation Helper Script
# This script helps set up ZenLeap for Zen Browser on macOS

set -e

echo "==================================="
echo "ZenLeap Installation Helper"
echo "==================================="
echo ""

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Darwin)
        ZEN_PATH="/Applications/Zen Browser.app/Contents/Resources"
        ;;
    Linux)
        if [ -d "/opt/zen-browser" ]; then
            ZEN_PATH="/opt/zen-browser"
        elif [ -d "/usr/lib/zen" ]; then
            ZEN_PATH="/usr/lib/zen"
        else
            echo "Error: Could not find Zen Browser installation"
            echo "Please specify the path manually"
            exit 1
        fi
        ;;
    *)
        echo "This script is for macOS and Linux only"
        echo "For Windows, please follow the manual installation instructions in README.md"
        exit 1
        ;;
esac

echo "Detected OS: $OS"
echo "Zen Browser path: $ZEN_PATH"
echo ""

# Find profile directory
PROFILE_DIR=""
if [ -d "$HOME/Library/Application Support/Zen/Profiles" ]; then
    # macOS
    PROFILE_DIR=$(find "$HOME/Library/Application Support/Zen/Profiles" -maxdepth 1 -type d -name "*.default*" 2>/dev/null | head -1)
elif [ -d "$HOME/.zen" ]; then
    # Linux
    PROFILE_DIR=$(find "$HOME/.zen" -maxdepth 1 -type d -name "*.default*" 2>/dev/null | head -1)
fi

if [ -z "$PROFILE_DIR" ]; then
    echo "Could not automatically find your Zen profile directory."
    echo "Please find it manually:"
    echo "1. Open Zen Browser"
    echo "2. Go to about:profiles"
    echo "3. Look for 'Root Directory'"
    echo ""
    read -p "Enter your profile path: " PROFILE_DIR
fi

echo "Profile directory: $PROFILE_DIR"
echo ""

# Create chrome directory structure
CHROME_DIR="$PROFILE_DIR/chrome"
JS_DIR="$CHROME_DIR/JS"

echo "Creating directory structure..."
mkdir -p "$JS_DIR"
mkdir -p "$CHROME_DIR/utils"

# Check if fx-autoconfig is installed
if [ ! -f "$CHROME_DIR/utils/boot.sys.mjs" ]; then
    echo ""
    echo "fx-autoconfig is not installed."
    echo "Please download it from: https://github.com/MrOtherGuy/fx-autoconfig"
    echo ""
    echo "After downloading:"
    echo "1. Copy contents of 'program/' folder to: $ZEN_PATH"
    echo "2. Copy contents of 'profile/' folder to: $CHROME_DIR"
    echo ""
    read -p "Press Enter after installing fx-autoconfig, or Ctrl+C to exit..."
fi

# Copy ZenLeap files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Copying ZenLeap files..."

if [ -f "$SCRIPT_DIR/JS/zenleap.uc.js" ]; then
    cp "$SCRIPT_DIR/JS/zenleap.uc.js" "$JS_DIR/"
    echo "  Copied zenleap.uc.js to $JS_DIR/"
else
    echo "  Error: zenleap.uc.js not found in $SCRIPT_DIR/JS/"
    exit 1
fi

# Optionally append CSS to userChrome.css
if [ -f "$SCRIPT_DIR/chrome.css" ]; then
    echo ""
    read -p "Add ZenLeap styles to userChrome.css? (y/n): " ADD_CSS
    if [ "$ADD_CSS" = "y" ] || [ "$ADD_CSS" = "Y" ]; then
        echo "" >> "$CHROME_DIR/userChrome.css"
        echo "/* ZenLeap Styles */" >> "$CHROME_DIR/userChrome.css"
        cat "$SCRIPT_DIR/chrome.css" >> "$CHROME_DIR/userChrome.css"
        echo "  Added styles to userChrome.css"
    fi
fi

echo ""
echo "==================================="
echo "Installation Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Open Zen Browser"
echo "2. Go to about:config"
echo "3. Set these to 'true':"
echo "   - toolkit.legacyUserProfileCustomizations.stylesheets"
echo "   - devtools.chrome.enabled"
echo "   - devtools.debugger.remote-enabled"
echo "4. Go to about:support"
echo "5. Click 'Clear Startup Cache'"
echo "6. Completely restart Zen Browser"
echo ""
echo "Usage:"
echo "  Ctrl+Space  - Enter leap mode"
echo "  j or k      - Set direction (down/up)"
echo "  1-9 or a-f  - Jump that many tabs"
echo "  Escape      - Cancel"
echo ""
