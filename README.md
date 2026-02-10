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

#### Leap Mode
`Ctrl+Space` activates leap mode, giving access to all navigation commands:

| Keys | Action |
|------|--------|
| `j` / `↓` | Enter browse mode (down) |
| `k` / `↑` | Enter browse mode (up) |
| `h` / `l` | Browse + switch workspace (prev/next) |
| `g` | G-mode (absolute positioning) |
| `z` | Z-mode (scroll commands) |
| `m{char}` | Set mark on current tab |
| `M` | Clear all marks |
| `'{char}` | Jump to marked tab |
| `0` | Jump to first unpinned tab |
| `$` | Jump to last tab |
| `o` / `i` | Jump back / forward in history |
| `?` | Open help modal |
| `Escape` | Exit leap mode |

#### Browse Mode
Navigate and manipulate tabs visually:

| Keys | Action |
|------|--------|
| `j` / `k` / `↑` / `↓` | Move highlight |
| `gg` | Jump to first unpinned tab (configurable) |
| `G` | Jump to last tab |
| `h` / `l` | Switch workspace (prev/next) |
| `Enter` | Open highlighted tab / toggle folder |
| `x` | Close highlighted/selected tabs |
| `Space` | Toggle multi-select on highlighted tab |
| `Shift+J` / `Shift+K` | Extend selection down/up |
| `y` / `Y` | Yank highlighted or selected tabs |
| `p` | Paste yanked tabs after highlighted tab |
| `P` | Paste yanked tabs before highlighted tab |
| `Ctrl+Shift+/` | Open command bar with selection |
| `1-9, a-z` | Jump N tabs from origin |
| `Escape` | Cancel, return to original tab |

Yank/paste works across workspaces — yank tabs in one workspace, switch with `h`/`l`, paste in another.

**Tab Preview:** A floating thumbnail preview appears when you pause on a tab in browse mode, showing the page screenshot, title, and URL. Configurable delay in Settings > Timing.

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

### Marks
Set bookmarks on tabs for quick access:
- `Ctrl+Space` → `m{a-z,0-9}` — Set mark (repeat to toggle off)
- `Ctrl+Space` → `'{char}` — Jump to marked tab
- `Ctrl+' → {char}` — Quick jump without entering leap mode
- `Ctrl+Space` → `M` — Clear all marks

### Jump History
Like vim's Ctrl+O / Ctrl+I:
- `Ctrl+Space` → `o` — Jump back to previous tab
- `Ctrl+Space` → `i` — Jump forward in history

### Tab Search (Spotlight-like Fuzzy Finder)
Quickly find and switch to any tab with fuzzy search:
- `Ctrl+/` — Open search modal
- Type to fuzzy search through all open tabs by title and URL
- Multi-word search: words can match in any order (e.g., "git hub" matches "GitHub")
- **Exact match with quotes**: `"YouTube"` matches only tabs containing "YouTube"
  - Multiple exact terms: `"YouTube" "music"` requires BOTH (AND logic)
  - Mix exact + fuzzy: `"YouTube" test` — exact "YouTube" AND fuzzy "test"
- **Cross-workspace search**: Click `WS`/`All` toggle in search bar to search all workspaces
  - Tabs from other workspaces show a purple workspace badge
  - Toggle default in Settings > Display
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
- Can be disabled in Settings > Display > Vim Mode in Search/Command (Escape will close the bar directly)

### Command Palette
A searchable command palette for quick access to any action:
- `Ctrl+Shift+/` — Open command palette directly
- `Ctrl+/` → type `>` — Switch to command mode from search

Available commands include: close/duplicate/pin/mute/unload/deduplicate tabs, switch/move to workspace, create/delete/rename workspace, add to/create/delete/rename folder, sort tabs, save/restore/list workspace sessions, toggle fullscreen/reader mode/sidebar, zoom controls, split view, and more. Commands have short alias tags (e.g., `del`, `mv`, `ws`) for fast fuzzy matching.

**Multi-step commands:** Some commands open sub-flows (hierarchical pick-action-then-pick-target):
- "Select matching tabs" → search tabs → pick action (close, unload, move to workspace, add to folder)
- "Split with tab" → pick a tab to split with
- "Move to workspace" → pick destination workspace
- "Add to folder" → pick folder or create new
- "Delete/Rename folder" → pick folder → confirm/input name
- "Delete/Rename workspace" → pick workspace → confirm/input name
- "Sort tabs" → pick sort method
- "Deduplicate tabs" → preview duplicates → confirm

**Browse mode integration:** Press `Ctrl+Shift+/` in browse mode to open the command bar with your selected/highlighted tabs as context. Dynamic commands (close, move, folder, pin, mute, etc.) operate on the browse selection.

### Workspace Sessions
Save and restore sets of tabs for context-switching:
- Command palette: "Save Workspace Session" — snapshot all tabs + folder structure
- Command palette: "Restore Workspace Session" — reload a saved session (create new workspace or replace current)
- Command palette: "List Saved Sessions" — browse, inspect, or delete saved sessions
- Full nested folder hierarchy preserved on save/restore
- Delete sessions from list view with `d` or `Ctrl+d`

### Tab Sorting
Organize tabs from the command palette:
- "Sort Tabs..." — picker with options: by domain, title (A-Z / Z-A), recency (newest/oldest first)
- "Group Tabs by Domain" — auto-creates folders per domain (for domains with 2+ tabs)
- Preserves pinned tab and folder positions

### Split View Navigation
Navigate between split panes without a mouse:
- `Alt+h` — focus pane to the left
- `Alt+j` — focus pane below
- `Alt+k` — focus pane above
- `Alt+l` — focus pane to the right
- Works globally when Zen's split view is active

### Help & Settings
- `Ctrl+Space` → `?` — Open help modal with all keybindings
- Click the gear icon in the help modal to open **Settings**
- Or use the command palette: type `> settings`

### Settings Modal
Customize every keybinding, delay, and display option:
- **Keybindings** — Rebind all keys with an intuitive key recorder
- **Timing** — Adjust timeouts and delays
- **Appearance** — Color pickers for all tab badge, highlight, mark, and selection colors
- **Display** — Customize indicators, limits, and cross-workspace search
- **Advanced** — Debug mode, recency tuning
- Search bar to filter settings
- Per-setting reset buttons
- Settings persist across browser restarts

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

## Usage Examples

**Browse and select a tab:**
```
Ctrl+Space → j → j → j → Enter    (move down 3 tabs, open it)
```

**Quick jump in browse mode:**
```
Ctrl+Space → j → 5                 (jump 5 tabs down, open it)
```

**Switch workspace in browse mode:**
```
Ctrl+Space → j → l                 (browse down, switch to next workspace)
Ctrl+Space → k → h                 (browse up, switch to prev workspace)
```

**Multi-select and move tabs:**
```
Ctrl+Space → j → Space → j → Space → y   (select 2 tabs, yank them)
l                                          (switch to next workspace)
p                                          (paste yanked tabs here)
```

**Go to first/last tab:**
```
Ctrl+Space → gg                    (first tab)
Ctrl+Space → G                     (last tab)
```

**Center current tab in view:**
```
Ctrl+Space → zz
```

**Set and jump to marks:**
```
Ctrl+Space → m → a             (mark current tab as 'a')
Ctrl+Space → ' → a             (jump to tab marked 'a')
Ctrl+' → a                      (quick jump without leap mode)
```

**Search for a tab:**
```
Ctrl+/ → git → Enter              (search and open matching tab)
```

**Yank highlighted tab (no selection needed):**
```
Ctrl+Space → j → j → y            (move down 2, yank that tab)
l → p                              (switch workspace, paste)
```

**Browse mode with command bar:**
```
Ctrl+Space → j → Space → j → Space   (select 2 tabs)
Ctrl+Shift+/                          (open command bar with selection)
move to workspace                      (pick action)
```

**Use the command palette:**
```
Ctrl+Shift+/                       (open command palette)
close                              (type to filter commands)
Enter                              (execute selected command)
```

**Select matching tabs and act on them:**
```
Ctrl+Shift+/ → select matching     (pick "Select Matching Tabs")
github                              (search for tabs)
Enter                               (confirm selection)
close                               (choose "Close all matching")
```

**Save and restore a workspace session:**
```
Ctrl+Shift+/ → save session        (pick "Save Workspace Session")
current workspace                   (choose scope)
my research tabs → Enter            (add a comment)
...later...
Ctrl+Shift+/ → restore session     (pick a saved session)
```

**Sort tabs by domain:**
```
Ctrl+Shift+/ → sort tabs           (open sort picker)
domain                              (sort by domain)
```

**Navigate split view panes:**
```
Alt+l                               (focus pane to the right)
Alt+h                               (focus pane to the left)
```

## Customization

### Settings Modal
Open the settings modal from the help screen (gear icon) or command palette (`> settings`). All keybindings, timing values, and display options can be customized.

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
