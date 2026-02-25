# ZenLeap - Vim-Powered Productivity for Zen Browser

A comprehensive vim-style navigation, command palette, and session management mod for [Zen Browser](https://zen-browser.app/).

<p align="center">
  <img src="assets/demo.gif" alt="ZenLeap Demo" width="640">
</p>

## Table of Contents

- [Features](#features)
  - [Relative Tab Numbers](#relative-tab-numbers)
  - [Keyboard Navigation](#keyboard-navigation) (Leap Mode, Browse Mode, G-Mode, Z-Mode)
  - [Marks](#marks)
  - [Jump History](#jump-history)
  - [Tab Search](#tab-search-spotlight-like-fuzzy-finder)
  - [Command Palette](#command-palette)
  - [Workspace Sessions](#workspace-sessions)
  - [Tab Sorting](#tab-sorting)
  - [Quick Navigation (Alt+HJKL)](#quick-navigation-althjkl)
  - [Split View Layout (gTile)](#split-view-layout-gtile)
  - [Help & Settings](#help--settings)
  - [Settings Modal](#settings-modal)
  - [Compact Mode Support](#compact-mode-support)
- [Visual Demo](#visual-demo)
- [Installation](#installation)
  - [Install via Sine (Recommended)](#install-via-sine-recommended)
  - [ZenLeap Manager App (macOS)](#option-1-zenleap-manager-app-macos)
  - [Command Line](#option-2-command-line)
  - [Manual Installation](#manual-installation)
- [Uninstallation](#uninstallation)
- [Usage Examples](#usage-examples)
- [Customization](#customization) (Themes, Appearance)
- [Debugging](#debugging)
- [Requirements](#requirements)
- [License](#license)

## Features

### Relative Tab Numbers
Like vim's relative line numbers, shows distance from current tab:
- Current tab: `·`
- All other tabs: plain multi-digit numbers (`1`, `2`, ... `10`, `15`, `42`, ...)

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
Navigate and manipulate tabs and folders visually:

| Keys | Action |
|------|--------|
| `j` / `k` / `↑` / `↓` | Move highlight |
| `gg` | Jump to first unpinned tab (configurable) |
| `G` | Jump to last tab |
| `h` / `l` | Switch workspace (prev/next) |
| `Enter` | Open highlighted tab / toggle folder |
| `x` | Close highlighted/selected tabs |
| `Space` | Toggle multi-select on highlighted tab or folder |
| `Shift+J` / `Shift+K` | Extend selection down/up |
| `y` / `Y` | Yank highlighted or selected items (tabs and folders) |
| `p` | Paste yanked items after highlighted position |
| `P` | Paste yanked items before highlighted position |
| `Ctrl+Shift+/` | Open command bar with selection |
| `0-9` | Multi-digit jump (300ms accumulation timeout) |
| `Escape` (1st) | Clear selection, yank buffer, and pending state |
| `Escape` (2nd) | Exit browse mode, return to original tab |

Yank/paste works across workspaces — yank tabs and folders in one workspace, switch with `h`/`l`, paste in another. Pasting onto a tab inside a folder nests yanked items as subfolders.

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
- Works in browse mode too — `m` marks the highlighted tab, `'` moves the highlight
- Marks on essential tabs persist across browser restarts

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
- **Essential tab support**:
  - Essential tabs can be included/excluded via Settings > Display > Search > Search Includes Essential Tabs
  - Essential tabs show an `Essential` badge in results (and suppress workspace badge when both apply)
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
- `jj` (typed rapidly) escapes to NORMAL mode from INSERT mode
- Movement: `h`, `l`, `w`, `b`, `e`, `0`, `$`, `j`, `k`
- Editing: `x`, `s`, `S`, `D`, `C`
- Insert switches: `i`, `a`, `I`, `A`
- Can be disabled in Settings > Display > Vim Mode in Search/Command (Escape will close the bar directly)
- jj threshold configurable in Settings > Timing

### Command Palette
A searchable command palette for quick access to any action:
- `Ctrl+Shift+/` — Open command palette directly
- `Ctrl+/` → type `>` — Switch to command mode from search

Available commands include: close/duplicate/pin/mute/unload/deduplicate/reload/bookmark tabs, rename tab, edit tab icon, add/remove essentials, reset pinned tab, replace pinned URL, reopen closed tab, select all tabs, switch/move to workspace, create/delete/rename workspace, add to/create/delete/rename folder, change folder icon, unload folder tabs, create subfolder, convert folder to workspace, unpack folder, move folder to workspace, sort tabs, group by domain, save/restore/list workspace sessions, split view controls (resize/rotate/remove tab), toggle fullscreen/reader mode/sidebar, zoom controls, and more. Commands have short alias tags (e.g., `del`, `mv`, `ws`) for fast fuzzy matching.

**Multi-step commands:** Some commands open sub-flows (hierarchical pick-action-then-pick-target):
- "Select matching tabs" → search tabs → pick action (close, unload, move to workspace, add to folder)
- "Split with tab" → pick a tab to split with
- "Move to workspace" → pick destination workspace
- "Add to folder" → pick folder or create new
- "Delete/Rename folder" → pick folder → confirm/input name
- "Delete/Rename workspace" → pick workspace → confirm/input name
- "Move folder to workspace" → pick folder → pick workspace
- "Sort tabs" → pick sort method
- "Deduplicate tabs" → preview duplicates → confirm

**Browse mode integration:** Press `Ctrl+Shift+/` in browse mode to open the command bar with your selected/highlighted tabs as context. Dynamic commands (close, move, folder, pin, mute, split view, reload, bookmark, etc.) operate on the browse selection.

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

### Quick Navigation (Alt+HJKL)
Navigate tabs, workspaces, and split panes without entering leap mode:
- `Alt+j` / `Alt+k` — switch to adjacent tab (or focus split pane below/above)
- `Alt+h` / `Alt+l` — switch workspace (or focus split pane left/right)
- In split view, pane focus is attempted first; at boundaries falls back to tab/workspace switching
- In compact mode, the sidebar temporarily peeks on `Alt+J/K` so you can see which tab is selected (configurable delay in Settings > Timing)

### Split View Layout (gTile)
Keyboard-driven grid overlay for resizing and rearranging split view tabs:
- `Alt+Space` — open the gTile overlay when split view is active
- **Move mode** (default): `hjkl` to navigate regions, `Shift+hjkl` or grab/drop to swap tabs
- **Resize mode** (`Tab` to switch): grid-cell cursor, selection anchoring, `1-9` presets for quick sizing
- `r` — rotate layout (cycles through all meaningful arrangements for 2-4 tabs)
- `Shift+R` — reset all tabs to equal sizes
- `Escape` — close the overlay
- Also available via command palette: "Split View: Resize (gTile)"

### Help & Settings
- `Ctrl+Space` → `?` — Open help modal with all keybindings
- Click the gear icon in the help modal to open **Settings**
- Or use the command palette: type `> settings`

### Settings Modal
Customize every keybinding, delay, and display option:
- **Keybindings** — Rebind all keys with an intuitive key recorder (leap mode, browse mode, global triggers including Alt+HJKL and gTile overlay)
- **Timing** — Adjust timeouts and delays (leap timeout, gg timeout, browse number timeout, jj escape threshold, preview delay, sidebar peek duration)
- **Appearance** — Color pickers for all tab badge, highlight, mark, and selection colors
- **Display** — Customize indicators, limits, cross-workspace search, essential-tab search scope, vim mode toggle, tab-as-enter
- **Advanced** — Debug mode, recency tuning
- Search bar to filter settings
- Per-setting reset buttons
- Settings persist across browser restarts

### Compact Mode Support
When using Zen's compact mode, ZenLeap automatically expands the floating sidebar when you enter leap mode, so you can see your tabs while navigating. The sidebar also temporarily peeks when using `Alt+J/K` quick navigation (configurable duration, 0 to disable).

## Visual Demo

```
Tab List (vertical):        With ZenLeap:
┌─────────────────┐        ┌──────────────────┐
│ GitHub          │        │ [3]  GitHub      │   ← 3 tabs above
│ YouTube         │        │ [2]  YouTube     │   ← 2 tabs above
│ Twitter         │        │ [1]  Twitter     │   ← 1 tab above
│ ► My Project    │  →     │ [·]  My Project  │   ← CURRENT TAB
│ Docs            │        │ [1]  Docs        │   ← 1 tab below
│ Stack Overflow  │        │ [2]  Stack Over..│   ← 2 tabs below
│ ... (8 more)    │        │ [10] Reddit      │   ← multi-digit
└─────────────────┘        └──────────────────┘

To jump to GitHub: Ctrl+Space → k → 3
To jump to Docs: Ctrl+Space → j → 1
To jump far: Ctrl+Space → j → 1 → 0   (jump 10 tabs down)
```

## Installation

### Install via Sine (Recommended)

> **Note:** ZenLeap is pending approval on the official Sine store. Until then, you need to temporarily enable unofficial JS sources to install. Once approved, it will be available directly in Sine's built-in marketplace and this step will no longer be needed.

1. Open Zen Browser and go to the **Sine mods settings page**
2. Click the **settings gear icon** (top right of the Sine panel)
3. Toggle on **"Enable installing JS from unofficial sources. (unsafe, use at your own risk)"**
4. In the install field, enter: `yashas-salankimatt/ZenLeap`
5. Click **Install** and restart Zen Browser

### Alternative Install Methods

<details>
<summary>Click to expand alternative installation methods</summary>

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

**macOS / Linux:**

```bash
curl -sfL https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.sh | bash -s -- install --remote
```

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 | iex"
```

Or clone the repo and run locally:

```bash
git clone https://github.com/yashas-salankimatt/ZenLeap.git
cd ZenLeap
./install.sh          # macOS/Linux
# powershell -ExecutionPolicy Bypass -File install.ps1   # Windows
```

If Zen Browser isn't found automatically (e.g. CachyOS `zen-browser-bin`), the installer will prompt you for the path. You can also specify it directly:

```bash
./install.sh install --zen-path /opt/zen-browser-bin
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

### Clean Legacy CSS
If you have old pre-3.1 ZenLeap CSS in your `userChrome.css` that conflicts with the runtime theme engine:
```bash
./clean-legacy-css.sh              # Interactive, all profiles
./clean-legacy-css.sh --yes        # Non-interactive, all profiles
./clean-legacy-css.sh --dry-run    # Preview what would change
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
Ctrl+Space → j → 1 → 5            (jump 15 tabs down with multi-digit)
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

**Quick navigation without leap mode:**
```
Alt+j                               (switch to next tab)
Alt+k                               (switch to previous tab)
Alt+l                               (switch to next workspace)
Alt+h                               (switch to previous workspace)
```

**Navigate split view panes:**
```
Alt+l                               (focus pane to the right)
Alt+h                               (focus pane to the left)
Alt+j                               (focus pane below)
Alt+k                               (focus pane above)
```

**Resize/rearrange split view (gTile):**
```
Alt+Space                           (open gTile overlay)
hjkl                                (navigate regions in move mode)
Shift+hjkl                          (swap tabs between regions)
Tab                                 (switch to resize mode)
1-9                                 (apply size preset)
r                                   (rotate layout)
Escape                              (close overlay)
```

**Split selected tabs into split view:**
```
Ctrl+Space → j → Space → j → Space  (select 2 tabs)
Ctrl+Shift+/                         (open command bar)
split                                (pick "Split into Split View")
```

**Yank a folder across workspaces:**
```
Ctrl+Space → j → (navigate to folder) → y    (yank the folder)
l                                              (switch workspace)
p                                              (paste folder here)
```

## Customization

### Settings Modal
Open the settings modal from the help screen (gear icon) or command palette (`> settings`). All keybindings, timing values, and display options can be customized.

### Themes

ZenLeap ships with 7 built-in themes: **Meridian** (default), **Meridian Transparent**, **Dracula**, **Gruvbox Dark**, **Nord**, **Catppuccin Mocha**, and **Tokyo Night**. Switch themes in Settings > Appearance.

#### Custom Themes
Create your own themes by extending a built-in theme:
1. **Visual Editor**: Settings > Appearance > Custom Themes > "Create Theme" — grouped color pickers with live preview
2. **JSON File**: Edit `zenleap-themes.json` in your profile's chrome directory (open via `:open-themes-file` command)

```json
{
  "my-theme": {
    "name": "My Theme",
    "extends": "meridian",
    "accent": "#ff6b6b",
    "bgBase": "#1a1a2e"
  }
}
```

Run `:reload-themes` after editing the JSON file. Themes support `extends` inheritance — only override properties you want to change.

### Appearance Customization

All 50+ colors are customizable through the Settings modal (Appearance tab) or via the visual theme editor. Changes apply instantly with live preview. All styles are injected at runtime via CSS custom properties (`--zl-*`).

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

## Privacy

**ZenLeap collects no telemetry, analytics, or user data of any kind.**

- All settings and data (marks, themes, plugin state) are stored locally in your browser's preference system (`about:config`) and never leave your machine
- The only network requests ZenLeap makes are to the [GitHub repository](https://github.com/yashas-salankimatt/ZenLeap) to check for updates and download new versions — no data is sent
- ZenLeap does not access or store passwords, cookies, browsing history, or web page content
- Third-party plugins loaded through the plugin system run locally and are not subject to any ZenLeap network activity

For more details, see [SECURITY.md](SECURITY.md).
