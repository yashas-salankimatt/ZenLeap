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
  - [URL Bar Vim Mode](#url-bar-vim-mode)
  - [Folders](#folders)
  - [Plugins](#plugins)
  - [Help & Settings](#help--settings)
  - [Settings Modal](#settings-modal)
  - [Compact Mode Support](#compact-mode-support)
- [Visual Demo](#visual-demo)
- [Installation](#installation)
  - [Install via Sine](#install-via-sine)
  - [Installer Script](#installer-script)
  - [ZenLeap Manager (macOS)](#zenleap-manager-macos)
  - [Manual Installation](#manual-installation)
  - [Updating](#updating)
- [Uninstallation](#uninstallation)
- [Usage Examples](#usage-examples)
- [Customization](#customization) (Themes, Appearance)
- [Troubleshooting](#troubleshooting)
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
- `jj` (typed rapidly) escapes to NORMAL mode from INSERT mode, if enabled (Settings > Timing > jj Escape to Normal Mode; off by default)
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

### URL Bar Vim Mode
With vim mode on (Settings > Display), the URL bar gets it too:
- `Escape` switches to NORMAL mode (a badge shows the mode); `Escape` again closes the URL bar
- Movement and editing: `h`, `l`, `w`, `b`, `e`, `0`, `$`, `x`, `d`, `D`, `s`, `S`, `C`, `p`, `u`
- `j` / `k` move through the suggestions, `g` / `G` jump to the first / last one
- `i`, `a`, `I`, `A` go back to INSERT mode; `Enter` navigates as usual

### Folders
- In browse mode, `x` on a folder asks what to delete: `1` the folder and all its tabs, `2` the folder only (tabs stay), `Escape` cancels
- The command palette has create, rename, delete, unpack, change-icon, unload and move-to-workspace commands for folders, plus "Create Subfolder" and "Convert Folder to Workspace"
- "Undo Folder Delete" (Settings > Keybindings > Global Triggers) restores the last deleted folder

### Plugins
Plugins add commands to the palette. A plugin is a folder with `manifest.json` and `plugin.js` in `<profile>/chrome/zenleap-plugins/<id>/`; four examples live in [`examples/plugins/`](examples/plugins) (tab stats, tab timer, quick notes, Readwise Reader).

```bash
./install-plugin.sh ./examples/plugins/tab-stats   # install (into the profiles that have ZenLeap)
./install-plugin.sh --list                         # list installed plugins
./install-plugin.sh --uninstall tab-stats          # remove
```

Restart Zen, then open the command palette and run **Manage Plugins** to enable the plugin: newly found plugins stay disabled until you enable them.

> **Plugins run with full browser privileges**, like ZenLeap itself: they can read your tabs, files and network traffic. Only install plugins you trust.

### Help & Settings
- `Ctrl+Space` → `?` — Open help modal with all keybindings
- Click the gear icon in the help modal to open **Settings**
- Or use the command palette (`Ctrl+Shift+/`) and run **Open Settings**

### Settings Modal
Customize every keybinding, delay, and display option:
- **Keybindings** — Rebind all keys with an intuitive key recorder (leap mode, browse mode, global triggers including Alt+HJKL and gTile overlay)
- **Timing** — Adjust timeouts and delays (leap timeout, gg timeout, browse number timeout, jj escape threshold, preview delay, sidebar peek duration)
- **Appearance** — Theme picker (24 built-in themes), visual editor for custom themes, optional theming of the Zen browser itself
- **Display** — Customize indicators, limits, cross-workspace search, essential-tab search scope, vim mode toggle, tab-as-enter
- **Advanced** — Debug mode, recency tuning, update checks
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

ZenLeap is a script for Zen's browser UI, so it needs a script loader: [Sine](https://github.com/CosmoCreeper/Sine) or [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig). The installer script and the macOS app set up fx-autoconfig for you.

### Install via Sine

> ZenLeap is not listed in Sine's built-in marketplace yet, so Sine must be allowed to install JavaScript mods from other sources first.

1. Open Zen Browser and go to the **Sine mods settings page**
2. Click the **settings gear icon** (top right of the Sine panel)
3. Toggle on **"Enable installing JS from unofficial sources. (unsafe, use at your own risk)"**
4. In the install field, enter: `yashas-salankimatt/ZenLeap`
5. Click **Install** and restart Zen Browser

Sine keeps ZenLeap up to date (ZenLeap's own updater is off for Sine installs).

### Installer Script

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.sh | bash
```

Options go after `bash -s --`, for example `... | bash -s -- --yes` (no questions) or `... | bash -s -- --profile 2`.

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 | iex
```

With options, download the script first:

```powershell
irm https://raw.githubusercontent.com/yashas-salankimatt/ZenLeap/main/install.ps1 -OutFile install.ps1
powershell -ExecutionPolicy Bypass -File install.ps1 -Profile 2 -Yes
```

**From a clone** (installs the checkout's files instead of the latest release):

```bash
git clone https://github.com/yashas-salankimatt/ZenLeap.git
cd ZenLeap
./install.sh                                            # macOS / Linux
# powershell -ExecutionPolicy Bypass -File install.ps1  # Windows
```

What the installer does:

- **Finds your profiles the way Zen does**, from `profiles.ini`:
  - Linux: `~/.config/zen` on current Zen (or `$XDG_CONFIG_HOME/zen`); `~/.zen` for installs that already have it, or with `MOZ_LEGACY_HOME=1`
  - macOS: `~/Library/Application Support/zen`
  - Windows: `%APPDATA%\zen`

  Without `--profile` it uses the profile Zen opens by default plus every profile that already has ZenLeap; interactive runs show the list first. `--profile` takes a number from that list (1 is the default profile), a profile name, or `all`; `--profile-dir <dir>` targets a profile you start with `zen -profile <dir>`.
- **Installs fx-autoconfig if it is missing**: its loader goes into `<profile>/chrome/utils`, and `config.js` + `defaults/pref/config-prefs.js` go into Zen's installation directory. It uses a tested fx-autoconfig version and checks every file's SHA-256. An existing fx-autoconfig (for example one installed by ZenRipple) is left as it is; interactive runs offer to update a loader older than the tested one.
- **Never uses `sudo` by itself.** If Zen's installation directory is not writable (for example under `/opt` or `C:\Program Files`), it prints the exact commands to run (on Windows it can ask for administrator rights for just those two files). ZenLeap is still installed in the profile and loads once those files are in place.
- **Installs the latest release** (`curl | bash`, `irm | iex`, or `--remote`), verified against the release's `CHECKSUMS.sha256`, and copies `zenleap.uc.js` to `<profile>/chrome/JS/`.
- **Never closes Zen.** Zen loads ZenLeap when it starts: quit Zen first, or restart it afterwards. The installer asks Zen to clear its startup cache on the next start.
- If the profile runs Sine, it points you to Sine instead (Sine does not run scripts from `chrome/JS`).

If Zen isn't found automatically, pass its installation directory (the folder with the `zen` binary; on macOS the `.app`):

```bash
./install.sh install --zen-path /opt/zen-browser-bin
```

`./install.sh --help` lists all options; `./install.sh check` compares the installed version with the latest release.

**Flatpak** support is experimental: fx-autoconfig goes into the Flatpak's system-config extension (`~/.local/share/flatpak/extension/app.zen_browser.zen.systemconfig/…`), which Zen reads from `/app/etc/zen`; this has not been tested with current Zen releases. **Snap** and **AppImage** builds are not supported (their installation directory is read-only).

### ZenLeap Manager (macOS)

1. Download `ZenLeap-Manager-vX.Y.Z-macos.zip` from the [latest release](https://github.com/yashas-salankimatt/ZenLeap/releases/latest)
2. Extract it and open `ZenLeap Manager.app`. The app is not signed: if macOS blocks it, allow it under **System Settings → Privacy & Security** (**Open Anyway**)
3. Click **Install** and pick the profile (the one Zen opens by default is preselected)
4. Enter your password if macOS asks (only needed when Zen.app is not writable for your user)

The Manager installs the latest release (SHA-256 verified), sets up fx-autoconfig when needed, tells you when an update is available, and uninstalls.

### Manual Installation

<details>
<summary>Click to expand manual installation steps</summary>

#### Step 1: Install fx-autoconfig

1. Download [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) from GitHub

2. Copy the **contents** of its `program/` folder (`config.js` and `defaults/`) into Zen's installation directory:

   | OS | Path |
   |----|------|
   | **macOS** | `/Applications/Zen.app/Contents/Resources/` |
   | **Windows** | `C:\Program Files\Zen Browser\` |
   | **Linux** | the folder with the `zen` binary, e.g. `~/.tarball-installations/zen/` (official install script), `/opt/zen-browser/`, `/opt/zen-browser-bin/` or `/usr/lib/zen/` |

   `about:support` → **Application Binary** shows where Zen is installed.

3. Copy its `profile/chrome/utils/` folder to `<your-profile>/chrome/utils/` (only `utils`: the other folders are examples)

   `about:support` → **Profile Folder** shows your profile. Profiles live in:

   | OS | Path |
   |----|------|
   | **Linux** | `~/.config/zen/<profile>` (current Zen), or `~/.zen/<profile>` (older installs) |
   | **macOS** | `~/Library/Application Support/zen/Profiles/<profile>` |
   | **Windows** | `%APPDATA%\zen\Profiles\<profile>` |

#### Step 2: Install ZenLeap

1. Create `<profile>/chrome/JS/`
2. Copy `JS/zenleap.uc.js` into it

#### Step 3: Restart

In `about:support`, click **Clear startup cache…** (Zen restarts and loads ZenLeap).

</details>

### Updating

- **Installer script or Manager:** ZenLeap checks for new releases (Settings > Advanced > Updates, or the "Check for Updates" command) and can install them itself. Every download is checked against the release's SHA-256 and version before it is written. Running the installer again also updates.
- **Sine:** Sine updates ZenLeap.

## Uninstallation

### Using ZenLeap Manager (macOS)
1. Open `ZenLeap Manager.app`
2. Click **Uninstall**
3. Select the profile to uninstall from
4. Restart Zen Browser when prompted

### Using Command Line
```bash
./install.sh uninstall                        # asks which profiles; offers to remove fx-autoconfig too
./install.sh uninstall --yes                  # every profile that has ZenLeap, keeps fx-autoconfig
./install.sh uninstall --yes --remove-fxautoconfig
```

Windows: `powershell -ExecutionPolicy Bypass -File install.ps1 -Action uninstall`.

Your ZenLeap data is kept: settings in `about:config` (`uc.zenleap.*`), and `chrome/zenleap-themes.json`, `chrome/zenleap-plugins/` and `zenleap-sessions/` in the profile. fx-autoconfig is only removed when you ask (other scripts, such as ZenRipple, may use it). ZenLeap installed through Sine is removed from Sine's mods page.

### Clean Legacy CSS
Installers up to 3.4 appended ZenLeap's CSS to `userChrome.css`; the installer removes that block when you update. To remove it on its own (a backup is saved as `userChrome.css.zenleap-backup`):
```bash
./clean-legacy-css.sh              # Interactive
./clean-legacy-css.sh --yes        # Non-interactive
./clean-legacy-css.sh --dry-run    # Preview what would change
```

### Manual Uninstall
1. Delete `<profile>/chrome/JS/zenleap.uc.js`
2. If `userChrome.css` still has a block between `/* === ZenLeap Styles === */` markers, remove it
3. Restart Zen

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
Open the settings modal from the help screen (gear icon) or the command palette ("Open Settings"). All keybindings, timing values, and display options can be customized.

### Themes

ZenLeap ships with 24 built-in themes: **Meridian** (default), Meridian Transparent, Dracula, Gruvbox Dark, Nord, Catppuccin Mocha, Tokyo Night, Monokai, One Dark Pro, Solarized Dark, GitHub Dark, Material Palenight, Ayu Dark, Ayu Mirage, Synthwave '84, Everforest Dark, Kanagawa, Rosé Pine, Vesper, Poimandres, Moonlight, Andromeda, Nightfox and Vitesse Dark. Switch themes in Settings > Appearance or with the "Switch Theme" command (live preview). "Apply Theme to Browser" also recolors Zen itself.

#### Custom Themes
Create your own themes by extending a built-in theme:
1. **Visual Editor**: Settings > Appearance > Custom Themes > "Create Theme" — grouped color pickers with live preview
2. **JSON File**: Edit `zenleap-themes.json` in your profile's `chrome` folder (the "Open Themes File" command opens it)

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

Run the "Reload Themes" command after editing the JSON file. Themes support `extends` inheritance — only override properties you want to change.

### Appearance Customization

All 50+ colors can be changed in a custom theme, with the visual theme editor (live preview) or in `zenleap-themes.json`. All styles are injected at runtime via CSS custom properties (`--zl-*`); ZenLeap does not use `userChrome.css`.

## Troubleshooting

### Browser Console
Press `Ctrl+Shift+J` (Cmd+Shift+J on macOS). Look for `[ZenLeap]` messages; "Toggle Debug Logging" in the command palette adds more.

### Common Issues

**Nothing happens / numbers not showing:**
- Restart Zen: ZenLeap loads when Zen starts
- Run `./install.sh check` to see which profiles have ZenLeap, and check `about:support` → **Profile Folder** is one of them
- Make sure `zenleap.uc.js` is in `<profile>/chrome/JS/` (not just `chrome/`) and that fx-autoconfig is installed (`<profile>/chrome/utils/boot.sys.mjs`, and `config.js` next to the Zen binary); run the installer again to repair both
- If the installer printed `sudo` or administrator commands for fx-autoconfig, run them
- Clear the startup cache: `about:support` → **Clear startup cache…**
- Installed through Sine? Check that the mod is enabled on Sine's mods page

**Keyboard shortcuts not working:**
- Check no extension is capturing `Ctrl+Space`
- `Ctrl+Space` is also the default "switch input source" shortcut on macOS and in fcitx/fcitx5 on Linux; change one of them (ZenLeap: Settings > Keybindings)
- Click somewhere in browser chrome first

**Sidebar not expanding in compact mode:**
- Make sure you're using Zen Browser (not Firefox)
- Check Browser Console for errors

## Requirements

- [Zen Browser](https://zen-browser.app/) **1.21.7b or newer** (tested on 1.22.3b)
- A script loader: [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) (installed by the installer script and the macOS app) or [Sine](https://github.com/CosmoCreeper/Sine)
- macOS, Linux, or Windows
- Installer script: bash 3.2 or newer, `curl` (or `wget`) and `unzip`; Windows installer: PowerShell 5.1 or newer

## License

MIT License

## Credits

- Inspired by vim's relative line numbers
- Built with [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig)
- For [Zen Browser](https://zen-browser.app/)

## Privacy

**ZenLeap collects no telemetry, analytics, or user data of any kind.**

- Settings, essential-tab marks and update-check state are stored in your profile's preferences (`uc.zenleap.*` in `about:config`); custom themes, plugin data and saved workspace sessions are files in your profile (`chrome/zenleap-themes.json`, `chrome/zenleap-plugin-data.json`, `chrome/zenleap-plugins/`, `zenleap-sessions/`). Nothing leaves your machine.
- Saved workspace sessions contain the titles and URLs of the tabs you chose to save. Tab previews in browse mode are screenshots taken by the browser and kept in memory only.
- ZenLeap's own network requests go only to GitHub: checking for a new release, downloading it with its checksum, and loading the changelog shown in the update dialog. Nothing is sent.
- ZenLeap does not access or store passwords or cookies.
- Plugins you install run with full browser privileges and may make their own network requests (for example the Readwise Reader example talks to Readwise).

For more details, see [SECURITY.md](SECURITY.md).
