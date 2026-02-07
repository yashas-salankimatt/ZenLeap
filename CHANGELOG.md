# Changelog

All notable changes to ZenLeap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-02-05

### Added
- **Cross-Workspace Tab Search** - Search tabs across all workspaces
  - Toggle via `WS`/`All` button in search modal header
  - Configurable default in Settings > Display > Search All Workspaces
  - Workspace name badge shown next to tabs from other workspaces
- **Exact Search with Quotation Marks** - Use quotes for exact matching
  - `"YouTube"` finds tabs with exact word match (case-insensitive)
  - Multiple quoted terms: `"YouTube" "music"` requires BOTH terms (AND logic)
  - Mixed mode: `"YouTube" test` combines exact + fuzzy matching
- **Appearance Customization** - New settings tab with color pickers
  - Customize accent, badge, highlight, mark, and selection colors
  - Live preview: color changes apply immediately
  - 10 customizable color settings with hex input + color picker
  - All tab badge CSS now uses CSS custom properties for theming

### Changed
- Tab badge styles migrated from hardcoded colors to CSS custom properties (`--zl-*`)
- Search system uses `getSearchableTabs()` for workspace-aware tab enumeration
- `fuzzyMatch()` now parses quoted terms separately from fuzzy terms

## [2.5.0] - 2026-02-05

### Added
- **Settings Modal** - Full customization of all keybindings, timing, and display options
  - Accessible via help modal gear icon or command palette (`> settings`)
  - Tab-based organization: Keybindings, Timing, Display, Advanced
  - Intuitive key recorder for rebinding any keybinding
  - Search bar to filter settings
  - Per-setting reset buttons and "Reset All" option
  - Settings persist across browser restarts via `uc.zenleap.settings` pref
  - Glassmorphism UI matching ZenLeap design
- **Workspace Switching in Leap Mode** - `h`/`l` now enter browse mode and switch workspace
- **Active Tab Highlighting on Workspace Switch** - Highlights the active tab (not first) when switching workspaces with `h`/`l`
- **Updated Help Modal** - Comprehensive keybinding reference with all current features
  - Settings gear button in header
  - Browse mode multi-select section
  - Command palette section
  - Workspace switching documentation
- **Open Settings Command** - Added `> settings` to command palette

### Changed
- All keybindings and magic numbers now use centralized settings system (`SETTINGS_SCHEMA` + `S` object)
- Legacy `CONFIG` object maintained as getter-based compatibility layer
- Old `uc.zenleap.debug` and `uc.zenleap.current_indicator` prefs auto-migrated

## [2.4.1] - 2026-02-05

### Added
- **Browse Mode Multi-Select** - Select, yank, and move tabs with vim-style keys
  - `Space` = toggle selection on highlighted tab
  - `y` = yank (copy) selected tabs
  - `p` = paste yanked tabs after highlighted tab
  - `P` = paste yanked tabs before highlighted tab
  - `x` = close all selected tabs (or single highlighted tab if none selected)
  - Visual highlighting for selected tabs (purple outline)
- **Browse Mode gg/G Navigation**
  - `gg` = jump highlight to first tab
  - `G` = jump highlight to last tab
  - Single `g` falls back to relative distance jump after 500ms timeout

### Fixed
- Tab paste positioning now uses Zen's built-in `moveTabBefore`/`moveTabAfter` APIs instead of `moveTabTo` with global indices, which failed due to Zen's per-workspace DOM containers
- Various bug fixes and security improvements from code review
- Installer now works correctly when piped from curl (`curl | bash`)
- Help modal displays dynamic version from VERSION constant

## [2.4.0] - 2025-02-05

### Added
- **Help Modal** - Comprehensive keybinding reference
  - `Ctrl+Space` → `?` = open help modal
  - Shows all keybindings organized by mode
  - Glassmorphism UI matching search modal
  - Press any key to close
- **Tab Search Enhancements**
  - Multi-word fuzzy search (words can match in any order)
  - Recency-based ranking with exponential decay
  - `x` in normal mode or `Ctrl+X` in insert mode = close selected tab
  - `S` in normal mode = substitute entire search query
  - `j`/`k` navigation in normal mode
  - Improved cursor visibility with block cursor in normal mode

### Changed
- Search results now exclude current tab
- Increased search results window height for more results

## [2.3.0] - 2025-02-05

### Added
- **Tab Search** (Spotlight-like fuzzy finder)
  - `Ctrl+/` = open search modal
  - Fuzzy search through all open tabs by title and URL
  - Real-time results with match highlighting
  - Navigate with `↑`/`↓` or `Ctrl+j`/`Ctrl+k`
  - Quick jump with `1-9` keys in normal mode
  - `Enter` = open selected tab
  - **Vim Mode**:
    - Starts in INSERT mode for typing
    - `Escape` = toggle to NORMAL mode
    - Movement: `h`, `l`, `w`, `b`, `e`, `0`, `$`
    - Editing: `x`, `s`, `D`, `C`
    - Insert switches: `i`, `a`, `I`, `A`
  - Glassmorphism UI with smooth animations
  - Shows up to 9 results with quick-jump labels

## [2.2.0] - 2025-02-05

### Added
- **Jump History** (like vim's Ctrl+O / Ctrl+I)
  - `o` = jump back to previous tab in history
  - `i` = jump forward in history
  - Automatically tracks all tab switches
  - Handles closed tabs gracefully
- **Marks** (like vim marks)
  - `m{char}` = set mark on current tab (a-z, 0-9)
  - `m{char}` on same tab with same mark = toggle off (remove mark)
  - `M` (Shift+m) = clear all marks
  - `'{char}` = jump to marked tab
  - `Ctrl+'{char}` = quick jump to mark (outside leap mode)
  - Marked tabs display mark character instead of relative number
  - Distinct red/magenta styling for marked tabs
  - One tab can only have one mark (setting new mark removes old)

### Changed
- Updated overlay hints to show all available commands
- Improved keyboard handling for new modes

## [2.1.0] - 2025-02-05

### Added
- **ZenLeap Manager.app** - macOS GUI installer for easy install/update/uninstall
- **Compact mode support** - Automatically expands floating sidebar when entering leap mode
- **Arrow key navigation** - Use `↑`/`↓` in addition to `k`/`j` for navigation
- **Extended numbering** - Support for A-Z (10-35) and special characters (36-45)
- **Remote installation** - `install.sh --remote` downloads latest version from GitHub
- **Version checking** - Manager app detects when updates are available
- **Multi-profile support** - Installer handles multiple Zen Browser profiles

### Changed
- Close button now hidden by default, appears on hover (swaps with number badge)
- Improved sidebar visibility detection for compact mode
- Better error handling in install scripts

### Fixed
- Close button being pushed off edge of tab
- Sidebar toggle working incorrectly when floating sidebar already visible
- Profile selection in installer when multiple profiles exist

## [2.0.0] - 2025-02-05

### Added
- **Browse Mode** - Navigate with j/k, Enter to open, x to close, Escape to cancel
- **G-Mode** - Absolute positioning with `gg` (first), `G` (last), `g{num}` (go to #)
- **Z-Mode** - Scroll commands `zz` (center), `zt` (top), `zb` (bottom)
- Tab highlight visualization during browse mode
- Scroll-into-view when browsing tabs
- Direction-aware jump in browse mode (jump direction based on highlight position)

### Changed
- Removed direct number jump from initial leap mode (must enter browse mode first)
- Improved keyboard handling to ignore modifier keys pressed alone

### Fixed
- Shift key incorrectly triggering navigation
- G (shift+g) not working for last tab
- Pressing 'g' causing immediate jump instead of entering g-mode

## [1.0.0] - 2025-02-05

### Added
- Initial release
- Relative tab numbering (1-9, A-F for 10-15)
- Ctrl+Space chord to enter leap mode
- j/k direction selection
- Number/hex input to jump N tabs
- Visual overlay showing current mode
- CSS styling for expanded and compact sidebar modes
- fx-autoconfig integration
- Basic install script

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 2.6.0 | 2026-02-05 | Cross-workspace search, exact match quotes, appearance customization |
| 2.5.0 | 2026-02-05 | Settings modal, h/l workspace switching, configurable keybindings |
| 2.4.1 | 2026-02-05 | Browse mode multi-select (Space/y/p/P), gg/G navigation, paste fix |
| 2.4.0 | 2025-02-05 | Help modal (?), multi-word search, recency ranking, close tabs from search |
| 2.3.0 | 2025-02-05 | Tab Search (Ctrl+/) with fuzzy finder and vim mode |
| 2.2.0 | 2025-02-05 | Jump history (o/i), marks (m/') |
| 2.1.0 | 2025-02-05 | Manager app, compact mode, arrow keys |
| 2.0.0 | 2025-02-05 | Browse mode, g-mode, z-mode |
| 1.0.0 | 2025-02-05 | Initial release |
