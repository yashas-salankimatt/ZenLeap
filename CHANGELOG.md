# Changelog

All notable changes to ZenLeap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.6] - 2026-02-27

### Fixed
- **Relative tab numbers with collapsed folders** (#42) — Numbers now properly exclude tabs inside collapsed folders, treat folders as navigable items with relative number badges, handle nested subfolders, and keep the active "peeking" tab numbered when its folder is collapsed
- **Rebound browse keys only working once** (#44) — Custom keybindings for browse up/down now work consistently by also checking leap mode key settings as fallbacks
- **Install script permission denied on macOS** (#43) — Replaced unreliable `-w` permission check with try-then-sudo pattern for both install and uninstall
- **Install script opening wrong app** — Fixed `launch_zen()` using undefined `$ZEN_APP` variable; now correctly derives `.app` path from `$ZEN_RESOURCES`
- **fx-autoconfig false "already installed"** — Global check now verifies both profile-level and app-level files exist before reporting installed

### Added
- **Folder relative number badges** — Collapsed folders display relative number badges matching tab badge styling, with direction coloring and highlight states
- **Stale badge cleanup** — Badges are cleaned from elements that leave the visible items list (prevents ghost badges from Zen's CSS animation approach)
- **`folder-active` attribute watching** — MutationObserver now tracks Zen's `folder-active` attribute changes to keep numbering in sync when tabs peek from collapsed folders

### Changed
- **Number jump to folder** — Pressing a number that lands on a folder now highlights it and stays in browse mode instead of auto-expanding/collapsing; use Enter to toggle the folder

## [3.3.5] - 2026-02-26

### Added
- **Sine Package Manager Compatibility** — ZenLeap now detects Sine-managed installations at runtime and disables self-update
  - Checks for the Sine mod directory on startup
  - Update checking and notifications are preserved — users are informed when new versions are available
  - Update toast shows "update via Sine" with an info shortcut instead of an update trigger
  - Update modal displays a prominent "Update through the Sine mod settings page" notice between version pills and changelog
  - "Update Now" button and Enter-to-update keyboard shortcut are removed when Sine-managed
  - Defense-in-depth: both `performUpdate()` and `downloadAndInstallUpdate()` have independent hard guards
  - About page shows "Update via Sine" hint instead of "Enter to update"

### Changed
- **Theme author** — Updated theme.json author to `yashas-salankimatt`

## [3.3.4] - 2026-02-25

### Added
- **Relative Numbers Display Modes** — The "Show Relative Numbers" setting is now a three-option select: Always, In Leap/Browse Mode, or Off
  - "In Leap/Browse Mode" shows numbers only when entering leap or browse mode, and hides them on exit
  - Migrates existing boolean setting automatically (true → Always, false → Off)
- **Browse Mode Marks** — `m`, `'`, and `M` now work in browse mode
  - `m{char}` sets a mark on the highlighted tab (not the selected tab)
  - `'{char}` moves the highlight to the marked tab
  - `M` clears all marks
  - Overlay shows MARK/GOTO indicators with contextual hints
  - Escape exits mark/goto sub-mode without leaving browse mode
- **Persistent Essential Tab Marks** — Marks on essential tabs are saved across browser restarts
  - Stored as URL mappings, restored on startup with retry logic for slow-loading tabs
  - New setting: Settings > Display > Tab Badges > "Persist Essential Tab Marks" (default: on)

## [3.3.3] - 2026-02-24

### Added
- **Show Relative Numbers setting** — New toggle in Settings > Display > Tab Badges to show/hide relative distance numbers on tab icons
  - When disabled, all relative number badges and mark badges are stripped from tabs
  - Marks remain stored internally and reappear when re-enabled
  - Setting takes effect immediately on toggle, reset, or import

### Fixed
- **Uninstaller fx-autoconfig cleanup** — Fixed fx-autoconfig removal to run on all selected profiles instead of only the first one

## [3.3.2] - 2026-02-24

### Added
- **Split View Session Save/Restore** — Workspace session save and restore now preserves split view arrangements
  - Saves split group membership and grid type (vertical, horizontal, grid) per tab
  - Restores split views automatically after tabs are created, including essential tabs in split groups
  - Backwards compatible with sessions saved before this version

### Fixed
- **Browse mode scroll on pinned/folder tabs** — Starting browse mode on a pinned tab or tab inside a folder and navigating down now properly scrolls the sidebar
  - Fixed scroll container resolution to try the target tab's parent chain first, with correct unwrapping of Zen's arrowscrollbox internal structure
- **Cross-workspace mark jumps** — Jumping to a marked tab in another workspace now switches to that workspace first
  - Essential tabs are exempt from workspace switching since they're globally visible
  - Jump list state is properly reverted on workspace switch failure
- **Cross-workspace jump list navigation** — `jumpBack` and `jumpForward` now switch workspaces when navigating to tabs in other workspaces
  - Includes re-entrancy guard, target tab validity checks after async workspace switch, and proper state recovery on failure
- **Split view tabs missing from session save** — Tabs in split views were silently dropped during session save because the DOM walk did not descend into split-view tab group elements

### Changed
- **Delete Workspace command** — Current workspace now appears first in the picker, so pressing Enter defaults to deleting the current workspace

## [3.3.1] - 2026-02-19

### Added
- **Find Playing Tab Command** — New command in the command palette to locate tabs currently playing audio/media
  - With one playing tab: directly navigates to it, switching workspaces if needed
  - With multiple playing tabs: opens a searchable sub-flow with workspace badges, fuzzy filtering, and j/k navigation
  - Supports Tab key to toggle cross-workspace scope, muted/playing icons

### Fixed
- **Browser theme not auto-applying on launch** — Fixed race condition where the browser chrome theme (`--zen-*` variables) would not persist across restarts, requiring manual re-toggle in settings
  - Reduced retry interval and increased max retries for `gZenThemePicker` hook installation
  - Added immediate re-apply when hook installs and safety net via `promiseInitialized`

## [3.3.0] - 2026-02-18

### Added
- **Essential Tab Search Scope Toggle** — New setting in Settings > Display > Search: "Search Includes Essential Tabs"
  - Default is enabled
  - Applies to both current-workspace and all-workspaces tab search
- **Essential Result Badge** — Essential tabs now show an "Essential" pill badge in tab search results and tab-based command sub-flows

### Changed
- Search result badges now use a shared pill styling system for workspace and essential metadata
- Essential tabs now suppress workspace badges in search results and show only the "Essential" badge

### Fixed
- Cross-workspace tab search no longer omits essential tabs when essential-tab search inclusion is enabled
- Search scope behavior is now consistent across main tab search, split tab picker, and select-matching tab sub-flows

## [3.2.0] - 2026-02-11

### Added
- **Apply Theme to Browser** — Optionally apply ZenLeap theme colors to Zen Browser chrome (toolbar, sidebar, URL bar)
  - New toggle in Settings > Appearance > Theme: "Apply Theme to Browser"
  - Overrides Zen's full CSS variable cascade (`--zen-primary-color`, `--zen-toolbar-element-bg`, `--zen-colors-*`, `--zen-branding-*`, etc.)
  - Injects targeted stylesheet for URL bar selectors with hardcoded `light-dark()` values
  - Covers collapsed/expanded URL bar states, result rows, selection, search mode indicator, favicon badges, and text colors
  - Cleanly reverts all overrides when toggled off
- **Switch Theme Command** — `Switch Theme...` in command palette with live preview
  - Theme picker subflow showing all built-in and custom themes
  - Live-preview: themes apply as you navigate with j/k, restoring original on Escape
  - Optional follow-up subflow to apply theme to browser chrome
- **14 New Built-in Themes** — Monokai, One Dark Pro, Solarized Dark, GitHub Dark, Material Palenight, Ayu Dark, Ayu Mirage, Synthwave '84, Everforest Dark, Kanagawa, Ros\u00e9 Pine, Vesper, Poimandres, Moonlight, Andromeda, Nightfox, Vitesse Dark
- **Theme Editor Annotations** — Property hints and browser badges in the custom theme editor
  - Every property shows a subtle hint describing where it appears in the UI
  - Properties that affect Zen Browser chrome (accent, bgBase, bgDeep) display a "B" badge
  - Group headers show descriptions and a "Browser" badge for groups that map to browser chrome

## [3.1.0] - 2026-02-10

### Added
- **Meridian Design System** — Complete visual overhaul with a cohesive design language
  - 7 built-in themes: Meridian, Meridian Transparent, Dracula, Gruvbox Dark, Nord, Catppuccin Mocha, Tokyo Night
  - 50+ CSS custom properties (`--zl-*`) for backgrounds, accents, text, borders, effects, and browse mode colors
  - All UI components (search, settings, command bar, gTile, help modal) now use theme variables
- **User Theme System** — Create custom themes via JSON or visual editor
  - Themes stored in `zenleap-themes.json` per profile (persists across updates)
  - `extends` inheritance: extend any built-in theme and override specific properties
  - `:reload-themes` and `:open-themes-file` commands in the command palette
- **Visual Theme Editor** — Create, edit, preview, and delete custom themes in Settings > Appearance
  - Grouped color pickers with common/advanced split per group
  - Live preview: browser UI updates as you change colors
  - Inherited value indicators show the base theme's value for each property
  - Clear-override button reverts individual properties to the base theme
  - Inline delete confirmation with 3-second timeout
  - Empty name validation with visual feedback
- **Legacy CSS Cleanup Script** — `clean-legacy-css.sh` for removing old ZenLeap CSS from userChrome.css
  - Interactive or `--yes` for batch mode
  - `--profile <index>` to target specific profiles
  - `--dry-run` to preview changes without modifying files
  - Uses perl marker-block removal, preserves all non-ZenLeap CSS

### Changed
- Theme selector in Settings is now dynamic (shows built-in + user themes)
- Installer CSS handling reverted to surgical perl marker-block removal (preserves non-ZenLeap userChrome.css content)
- Installer now downloads and copies `zenleap-themes.json` template to profiles
- Search/command/gTile hint bars shortened for single-line display (reduced gap, terse labels)
- Tab search `Tab` hint now shows the mode you'd switch to ("all ws" / "this ws") instead of static text

### Fixed
- **Badge contrast on unloaded tabs** — Up/down direction badges now use dark text on bright backgrounds (matches current tab badge pattern), remains readable even at Firefox's reduced opacity for `tab[pending]`
- **hexToRgba crash on non-hex user theme colors** — All color inputs normalized via `toHex6()` before alpha derivation
- **Extends chain ordering** — User themes resolved topologically so JSON key order doesn't matter; circular extends detected and warned
- **Hardcoded RGBA colors** — Replaced 15+ hardcoded color values with `color-mix()` or `var(--zl-backdrop)` for full theme support (gTile region borders, ws-toggle, update buttons, reset/delete buttons, backdrop overlays)
- **Fragile panelAlpha comparison** — Uses `parseFloat()` threshold instead of string equality
- **Input interception on about:newtab** — Browse mode and Alt+HJKL keys no longer leak to content (blurs active elements in content, moves focus to chrome, adds `stopImmediatePropagation` to keyup handler)
- **open-themes-file command** — Added error handling for `file.launch()` on Linux
- **Double settings re-render** — Removed redundant `renderSettingsContent()` in theme save
- **Hint bar wrapping** — Search and gTile hints shortened to fit single line; `flex-wrap: wrap` kept as safety fallback
- Help modal updated with Quick Navigation and Themes sections

## [3.0.0] - 2026-02-10

### Added
- **gTile Split-View Overlay** - Keyboard-driven grid overlay for managing split view layouts
  - `Alt+Space` opens the overlay when split view is active
  - **Move mode**: navigate regions (`hjkl`), grab/drop tabs (`Shift+hjkl` or Space to grab)
  - **Resize mode**: grid-cell cursor for precise tab sizing, selection anchoring, `1-9` presets
  - Layout rotation (`r`): cycles through all meaningful arrangements for 2-4 tabs
  - Reset sizes (`Shift+R`): normalizes all tabs to equal proportions
  - Tab/Shift+Tab to switch between Move and Resize modes
  - Command palette entries: "Split View: Resize (gTile)" and "Rotate Layout"
- **Command Bar Parity with Right-Click Menu** - 19 new commands covering all context menu actions
  - Tab commands: reload, bookmark, reopen closed tab, select all, rename tab, edit tab icon, add/remove essentials, reset pinned tab, replace pinned URL
  - Folder commands: change icon, unload all tabs (with progress UI), create subfolder, convert to workspace, unpack folder, move folder to workspace
  - Browse mode commands: reload selected tabs, bookmark selected tabs
- **Alt+HJKL Global Navigation** - Quick tab/workspace navigation without entering leap mode
  - `Alt+J/K` switch to adjacent tabs (or focus split panes when in split view)
  - `Alt+H/L` switch workspaces (or focus split panes)
  - Split view pane focus is attempted first; at boundaries falls back to tab/workspace switching
- **Browse Mode Split View** - Create split views from browse mode selections
  - Select 2-4 tabs with Space, then use command bar → "Split into Split View"
  - Uses Zen's native `splitTabs()` API
- **Sidebar Peek in Compact Mode** - Sidebar temporarily shows during Alt+J/K navigation
  - Auto-hides after configurable delay (default 1000ms)
  - Rapid presses reset the timer
  - New setting: `timing.quickNavSidebarPeek` (0 to disable)
- **Folder Selection, Yank/Paste** - Full folder support in browse mode
  - Folders can be selected (Space), yanked (y), and pasted (p/P) alongside tabs
  - Cross-workspace folder paste with circular nesting and max depth guards
  - Pasting onto a tab inside a folder nests yanked items as subfolders
  - Deduplication removes individual tabs whose parent folder is also yanked
- **Multi-Digit Browse Numbers** - Replaced letter/special-char numbering (A-Z, !@#) with plain multi-digit numbers
  - 300ms accumulation timeout for multi-digit jumps (configurable in Settings > Timing)
  - Cleaner, more intuitive display: `10`, `15`, `42` instead of `A`, `F`, `!`
- **Two-Stage Escape in Browse Mode** - First Escape clears selection, yank buffer, and pending state; second Escape exits browse mode
- **jj Normal Mode Escape** - Typing `jj` rapidly in search/command bar insert mode escapes to normal mode
  - Configurable threshold (Settings > Timing > jj Escape Threshold, default 150ms)
  - Searching for literal "jj" still works with a pause between presses
- **Tab Preview in Search Bars** - Preview panel generalized to all tab search contexts (not just browse mode and dedup)
- **"Remove Tab from Split View" Command** - Extract a tab from split view (searchable by unsplit, maximize, extract, detach, pop)
- **Input Interception for Alt+HJKL** - Prevents keydown/keyup events from leaking to web pages during quick navigation

### Changed
- Tab numbering now uses plain multi-digit numbers instead of A-Z and special characters
- Alt+H/J/K/L keybindings now function as general navigation (tab switching + workspace switching) rather than only split view focus
- Installer now installs to all profiles by default when `--profile` flag is omitted

### Fixed
- Folder nesting regression from folderAfterRef initialization placing yanked folders as siblings instead of children
- Multi-folder paste ordering and folder-anchor tab positioning
- jj normal mode moving selection down 3 instead of 2
- jj escape leaking first j into search query
- Shift-select in browse mode not deselecting on direction reversal
- Stale preview lingering during search tab navigation
- Frame script accumulation in content processes (replaced per-call loadFrameScript with static reusable script)
- Browse command targeting wrong tab when folders present (switched to getVisibleItems)
- Visible items cache not invalidated on folder collapse/expand
- Session load promise not cleaned up in finally block

### Performance
- O(1) browse mode j/k navigation via previous-highlighted-item tracking (was O(N) full-list scan)
- Search input debounced by 32ms to coalesce rapid keystrokes
- Relative numbers use reverse mark map for O(1) lookup and rAF coalescing for tab events
- Session restore uses event-driven `waitFor()` polling instead of fixed setTimeout sleeps
- Centralized tab recency field access via `getTabLastAccessed()` helper
- Command cache with 500ms TTL; visible items microtask-scoped cache; workspace name map cache
- Singleton init guard prevents duplicate listeners/styles on re-injection
- Lightweight `updateSelectionHighlight()` for search j/k (avoids full DOM rebuild)
- Event delegation for search result clicks and favicon errors

## [2.8.0] - 2026-02-09

### Added
- **Workspace Sessions** - Save, restore, and manage workspace tab sets
  - Command palette: "Save Workspace Session", "Restore Workspace Session", "List Saved Sessions"
  - Preserves full nested folder hierarchy (v2 schema with DOM tree walking)
  - Saves custom tab labels (`zenStaticLabel`)
  - Two restore modes: create new workspace(s) or replace current workspace
  - List view with tree-based detail showing folder structure
  - Delete sessions from list or detail view (`d` / `Ctrl+d`)
  - Backward compatible with v1 flat session format
- **Tab Sorting** - Sort and organize tabs from the command palette
  - "Sort Tabs..." with picker: by domain, title (A-Z / Z-A), recency (newest/oldest first)
  - "Group Tabs by Domain" auto-creates folders per domain (2+ tabs)
  - Respects pinned tabs and folder positions
- **Browse Mode Command Bar** - Press `Ctrl+Shift+/` in browse mode to open command palette with selected/highlighted tabs as context
  - Dynamic commands: close, move to workspace, add to folder, create folder, move top/bottom, pin/unpin, mute/unmute, duplicate, unload
  - Escape returns to browse mode with state preserved
- **Browse Mode Folder Interaction** - Enter expands/collapses folders in browse mode
  - Folder delete modal with options to delete folder + tabs or keep tabs
  - Undo folder delete with `Cmd+Shift+T`
- **Y Yanks Highlighted Tab** - `y`/`Y` in browse mode now yanks the highlighted tab without requiring explicit Space-selection first
- **Input Interception** - Keyboard input no longer leaks to web page content during Leap Mode
  - Prevents Space toggling video playback, j/k scrolling pages, etc.
  - Focus automatically stolen on entering leap/browse mode, restored on exit
- **Split View Keyboard Focus** - Navigate between split panes with keyboard
  - `Alt+h/j/k/l` to focus pane in that direction
  - Works globally when split view is active
  - Handles asymmetric pane layouts
- **Dedup Preview Sub-flow** - Tab deduplication now shows preview before closing
  - Inspect duplicates before confirming closure
  - Press `o`/`Ctrl+o` to jump to a tab for inspection
  - Press Enter to confirm closing all duplicates
- **Delete Folder / Delete Workspace** - New command palette commands with picker sub-flows
- **Rename Folder / Rename Workspace** - New command palette commands with input sub-flows
- **Hierarchical Command Trees** - Replaced per-entity commands with pick-action-then-pick-target flow
  - Cleaner command palette without hundreds of entity-specific commands
  - Consistent UX across workspace, folder, and tab operations
- **Short Alias Tags** - Command palette commands now have short tags (e.g., `del`, `mv`, `ws`, `fld`) for faster fuzzy matching
- **Vim Mode Toggle** - Setting to disable vim normal mode in search and command bars (Settings > Display > Vim Mode in Search/Command)
- **Tab-as-Enter Toggle** - Setting to disable Tab acting as Enter in command palette (Settings > Display > Tab Acts as Enter)

### Fixed
- Browse mode failing to start on new tab pages and excluded pages (falls back to first available tab)
- Split focus navigation in asymmetric pane layouts
- WS/All toggle visibility when vim mode is disabled
- Search ranking and rename data passing in sub-flows
- Merge errors restoring missing function boundaries

## [2.7.0] - 2026-02-07

### Added
- **Tab Deduplication** - Close duplicate tabs across all workspaces
  - Command palette: "Deduplicate Tabs (Close Duplicates)"
  - Groups tabs by URL, keeps the most recently accessed, closes the rest
  - Skips pinned, essential, and special tabs
- **Unload Matching Tabs** - Bulk unload tabs from the select-matching flow
  - New action in Select Matching Tabs: "Unload N matching tabs"
  - Switches away from current tab if it would be unloaded
  - Skips already-unloaded tabs
- **Browse Mode Tab Preview** - Floating thumbnail preview while navigating
  - Shows tab screenshot, title, URL, and favicon to the right of the sidebar
  - Captures via `drawSnapshot` API with debounced async loading
  - Configurable delay (Settings > Timing > Browse Preview Delay, default 500ms)
  - Toggle in Settings > Display > Browse Preview or command palette
  - Handles unloaded tabs with placeholder text
  - Cached thumbnails for fast re-display
- **Leap Mode 0 / $ Keys** - Jump to first unpinned tab / last tab
- **gg Skips Pinned Tabs** - Configurable in Settings > Display > Navigation

### Fixed
- Workspace badge clipped by long tab titles (now uses flexbox layout)
- Cross-workspace tab selection not focusing after workspace switch (async/await fix)
- WS/All toggle incorrectly shown in command mode
- Missing workspace badges in select-matching and split-tab-picker sub-flows
- Hardcoded CSS colors overriding theme variables in leap-active and highlight+selected states
- `0` key jumping to invisible `zen-empty-tab` placeholder
- Tab key in select-matching sub-flow acting as Enter instead of toggling workspace search
- Move-to-top/bottom not pulling tabs from other workspaces into current workspace
- Pinned tabs failing silently in move-to-top/bottom (now unpins before moving)
- Search scoring: exact substring matches now strongly favored over fuzzy matches

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
| 3.3.4 | 2026-02-25 | Relative numbers display modes, browse mode marks, persistent essential tab marks |
| 3.3.3 | 2026-02-24 | Show Relative Numbers toggle, uninstaller fx-autoconfig fix |
| 3.3.2 | 2026-02-24 | Split view session save/restore, browse mode scroll fix, cross-workspace marks & jumps, delete workspace defaults to current |
| 3.3.1 | 2026-02-19 | Find Playing Tab command, fix browser theme not auto-applying on launch |
| 3.3.0 | 2026-02-18 | Essential-tab search inclusion toggle, essential badge in search results, consistent WS/All search scope handling |
| 3.2.0 | 2026-02-11 | Apply theme to browser chrome, Switch Theme command with live preview, 14 new built-in themes, theme editor annotations |
| 3.1.0 | 2026-02-10 | Meridian design system, 7 built-in themes, user theme JSON + visual editor, badge contrast fix, input interception hardening |
| 3.0.0 | 2026-02-10 | gTile split overlay, command bar parity, Alt+HJKL navigation, folder yank/paste, multi-digit numbers, jj escape |
| 2.8.0 | 2026-02-09 | Workspace sessions, tab sorting, browse command bar, folder interaction, split focus, dedup preview |
| 2.7.0 | 2026-02-07 | Tab deduplication, bulk unload, browse preview, 0/$ keys, bug fixes |
| 2.6.0 | 2026-02-05 | Cross-workspace search, exact match quotes, appearance customization |
| 2.5.0 | 2026-02-05 | Settings modal, h/l workspace switching, configurable keybindings |
| 2.4.1 | 2026-02-05 | Browse mode multi-select (Space/y/p/P), gg/G navigation, paste fix |
| 2.4.0 | 2025-02-05 | Help modal (?), multi-word search, recency ranking, close tabs from search |
| 2.3.0 | 2025-02-05 | Tab Search (Ctrl+/) with fuzzy finder and vim mode |
| 2.2.0 | 2025-02-05 | Jump history (o/i), marks (m/') |
| 2.1.0 | 2025-02-05 | Manager app, compact mode, arrow keys |
| 2.0.0 | 2025-02-05 | Browse mode, g-mode, z-mode |
| 1.0.0 | 2025-02-05 | Initial release |
