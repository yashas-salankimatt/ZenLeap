# ZenLeap - Relative Tab Navigation for Zen Browser

A vim-style relative tab numbering and keyboard navigation mod for [Zen Browser](https://zen-browser.app/).

## Features

### Relative Tab Numbers
Like vim's relative line numbers, shows distance from current tab:
- Current tab: `·`
- Nearby tabs: `1`, `2`, `3`, ... `9`
- Extended range: `A`-`Z` (10-35)
- Special characters: `!@#$%^&*()` (36-45)
- Overflow: `+` (46+)

### Keyboard Navigation

#### Browse Mode
Navigate tabs visually with j/k or arrow keys:
- `Ctrl+Space` → `j` or `↓` — Start browsing down
- `Ctrl+Space` → `k` or `↑` — Start browsing up
- Continue with `j/k/↑/↓` to move selection
- `Enter` — Open selected tab
- `x` — Close selected tab
- `1-9, a-z` — Jump directly to tab N positions away
- `Escape` — Cancel and return to original tab

#### G-Mode (Absolute Positioning)
Jump to specific tab positions:
- `Ctrl+Space` → `gg` — Go to first tab
- `Ctrl+Space` → `G` — Go to last tab
- `Ctrl+Space` → `g` + `number` + `Enter` — Go to tab #N

#### Z-Mode (Scroll Commands)
Scroll the current tab into view:
- `Ctrl+Space` → `zz` — Center current tab
- `Ctrl+Space` → `zt` — Scroll current tab to top
- `Ctrl+Space` → `zb` — Scroll current tab to bottom

### Tab Search (Spotlight-like Fuzzy Finder)
Quickly find and switch to any tab with fuzzy search:
- `Ctrl+/` — Open search modal
- Type to fuzzy search through all open tabs by title and URL
- Multi-word search: words can match in any order (e.g., "git hub" matches "GitHub")
- Recency-weighted ranking: recently accessed tabs rank higher
- Real-time results with match highlighting
- Navigate with `↑`/`↓` or `Ctrl+j`/`Ctrl+k`
- Press `1-9` in normal mode to quick jump to a result
- `Enter` — Open selected tab
- `x` (normal) or `Ctrl+X` (insert) — Close selected tab
- `Escape` — Toggle between vim modes or close modal

**Vim Mode in Search:**
- Starts in INSERT mode for typing
- `Escape` toggles to NORMAL mode
- Movement: `h`, `l`, `w`, `b`, `e`, `0`, `$`, `j`, `k`
- Editing: `x`, `s`, `S`, `D`, `C`
- Insert switches: `i`, `a`, `I`, `A`

### Help
- `Ctrl+Space` → `?` — Open help modal with all keybindings
- Press any key to close

### Compact Mode Support
When using Zen's compact mode, ZenLeap automatically expands the floating sidebar when you enter leap mode, so you can see your tabs while navigating.

## Visual Demo

```
Tab List (vertical):        With ZenLeap:
┌─────────────────┐        ┌─────────────────┐
│ GitHub          │        │ [3] GitHub      │   ← 3 tabs above
│ YouTube         │        │ [2] YouTube     │   ← 2 tabs above
│ Twitter         │        │ [1] Twitter     │   ← 1 tab above
│ ► My Project    │  →     │ [·] My Project  │   ← CURRENT TAB
│ Docs            │        │ [1] Docs        │   ← 1 tab below
│ Stack Overflow  │        │ [2] Stack Over..│   ← 2 tabs below
└─────────────────┘        └─────────────────┘

To jump to GitHub: Ctrl+Space → k → 3
To jump to Docs: Ctrl+Space → j → 1
```

## Installation

### Easy Install (Recommended)

#### Option 1: ZenLeap Manager App (macOS)

1. Download `ZenLeap.Manager.app.zip` from the [latest release](https://github.com/yashas-salankimatt/ZenLeap/releases)
2. Extract and run `ZenLeap Manager.app`
3. Click **Install** and follow the prompts
4. Enter your admin password when asked (needed for fx-autoconfig)
5. Restart Zen Browser when prompted

The Manager app will:
- Automatically download and install fx-autoconfig
- Install the latest ZenLeap
- Set required preferences
- Notify you when updates are available

#### Option 2: Command Line

```bash
# Download and run the installer
curl -sL https://raw.githubusercontent.com/anthropics/claude-code/main/ZenLeap/install.sh | bash
```

Or clone the repo and run locally:

```bash
git clone https://github.com/yashas-salankimatt/ZenLeap.git
cd claude-code/ZenLeap
./install.sh
```

### Manual Installation

<details>
<summary>Click to expand manual installation steps</summary>

#### Step 1: Install fx-autoconfig

1. Download [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) from GitHub

2. Copy the **contents** of `program/` to your Zen installation:

   | OS | Path |
   |----|------|
   | **macOS** | `/Applications/Zen.app/Contents/Resources/` |
   | **Windows** | `C:\Program Files\Zen Browser\` |
   | **Linux** | `/opt/zen-browser/` or `/usr/lib/zen/` |

3. Copy the **contents** of `profile/` to `<your-profile>/chrome/`:

   Find your profile: `about:profiles` → "Root Directory"

#### Step 2: Install ZenLeap

1. Create `<profile>/chrome/JS/` directory
2. Copy `zenleap.uc.js` to `<profile>/chrome/JS/`
3. Append `chrome.css` to `<profile>/chrome/userChrome.css`

#### Step 3: Enable and Restart

1. In `about:config`, set to `true`:
   - `toolkit.legacyUserProfileCustomizations.stylesheets`

2. Go to `about:support` → **"Clear Startup Cache"**

3. Restart Zen Browser

</details>

## Uninstallation

### Using ZenLeap Manager (macOS)
1. Open `ZenLeap Manager.app`
2. Click **Uninstall**
3. Select the profile to uninstall from
4. Restart Zen Browser when prompted

### Using Command Line
```bash
./install.sh uninstall
```

### Manual Uninstall
1. Delete `<profile>/chrome/JS/zenleap.uc.js`
2. Remove ZenLeap styles from `userChrome.css` (between `/* === ZenLeap Styles === */` markers)
3. Clear startup cache and restart

## Usage Reference

### Quick Reference Card

| Mode | Keys | Action |
|------|------|--------|
| **Enter Leap Mode** | `Ctrl+Space` | Activate ZenLeap |
| **Browse Mode** | `j` / `↓` | Start browsing down |
| | `k` / `↑` | Start browsing up |
| | `j/k/↑/↓` | Move selection |
| | `Enter` | Open selected tab |
| | `x` | Close selected tab |
| | `1-9, a-z` | Jump N tabs from origin |
| | `Escape` | Cancel, return to original |
| **G-Mode** | `gg` | First tab |
| | `G` | Last tab |
| | `g{num}Enter` | Go to tab #{num} |
| **Z-Mode** | `zz` | Center current tab |
| | `zt` | Scroll to top |
| | `zb` | Scroll to bottom |
| **Marks** | `m{a-z,0-9}` | Set mark (repeat to toggle off) |
| | `M` | Clear all marks |
| | `'{a-z,0-9}` | Jump to marked tab |
| | `Ctrl+'{char}` | Quick jump (no leap mode) |
| **Jump History** | `o` | Jump back (like vim Ctrl+O) |
| | `i` | Jump forward (like vim Ctrl+I) |
| **Tab Search** | `Ctrl+/` | Open fuzzy search modal |
| | `↑/↓` or `Ctrl+j/k` | Navigate results |
| | `Enter` | Open selected tab |
| | `x` or `Ctrl+X` | Close selected tab |
| | `1-9` (normal) | Quick jump to result |
| | `Escape` | Toggle vim mode / close |
| **Help** | `?` | Open help modal |

### Examples

**Browse and select a tab:**
```
Ctrl+Space → j → j → j → Enter    (move down 3 tabs, open it)
```

**Quick jump in browse mode:**
```
Ctrl+Space → j → 5                 (jump 5 tabs down, open it)
```

**Go to first/last tab:**
```
Ctrl+Space → gg                    (first tab)
Ctrl+Space → G                     (last tab)
```

**Go to specific tab number:**
```
Ctrl+Space → g → 1 → 2 → Enter     (go to tab #12)
```

**Center current tab in view:**
```
Ctrl+Space → zz
```

**Set and jump to marks:**
```
Ctrl+Space → m → a             (mark current tab as 'a')
Ctrl+Space → m → a             (repeat same mark to remove it)
Ctrl+Space → M                  (clear all marks)
Ctrl+Space → ' → a             (jump to tab marked 'a')
Ctrl+' → a                      (quick jump without leap mode)
```

**Navigate jump history:**
```
Ctrl+Space → o                  (go back to previous tab)
Ctrl+Space → i                  (go forward in history)
```

**Search for a tab:**
```
Ctrl+/                          (open search modal)
git                             (type to fuzzy search)
↓ or Ctrl+j                     (select next result)
Enter                           (open selected tab)
```

**Quick jump in search:**
```
Ctrl+/                          (open search modal)
doc                             (type query)
3                               (press 3 in normal mode to jump to result #3)
```

## Customization

### CSS Variables

Add to your `userChrome.css`:

```css
:root {
  /* Number badge colors */
  --zenleap-bg: #505050;
  --zenleap-color: #e0e0e0;

  /* Current tab highlight */
  --zenleap-current-bg: #61afef;
  --zenleap-current-color: #1e1e1e;

  /* Direction colors */
  --zenleap-up-bg: #455a6f;
  --zenleap-down-bg: #455a6f;

  /* Font sizes */
  --zenleap-font-size: 80%;
  --zenleap-compact-font-size: 70%;
}
```

### Changing the Trigger Key

Edit `zenleap.uc.js` and modify:

```javascript
const CONFIG = {
  triggerKey: ' ',           // Space key
  triggerModifier: 'ctrlKey' // Options: 'ctrlKey', 'altKey', 'shiftKey', 'metaKey'
};
```

## Debugging

### Browser Console
Press `Ctrl+Shift+J` (Cmd+Shift+J on macOS). Look for `[ZenLeap]` messages.

### Common Issues

**Numbers not showing:**
- Ensure fx-autoconfig is installed
- Clear startup cache (`about:support`)
- Verify `zenleap.uc.js` is in `chrome/JS/` (not just `chrome/`)

**Keyboard shortcuts not working:**
- Check no extension is capturing `Ctrl+Space`
- Click somewhere in browser chrome first
- Check `about:addons` for conflicts

**Sidebar not expanding in compact mode:**
- Make sure you're using Zen Browser (not Firefox)
- Check Browser Console for errors

## Requirements

- [Zen Browser](https://zen-browser.app/) (Firefox-based)
- [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) (auto-installed by installer)
- macOS, Linux, or Windows

## License

MIT License

## Credits

- Inspired by vim's relative line numbers
- Built with [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig)
- For [Zen Browser](https://zen-browser.app/)
