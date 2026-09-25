# Changelog

All notable changes to ZenLeap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Ready for Zen 1.22 (Firefox 156): plugins load again, verified updates and installers that find today's profile folders, safer destructive commands, and a keyboard layer that behaves next to web pages and next to ZenRipple's AI agents. The plugin API changes in ways plugin authors need to know about (see Breaking changes).

### Highlights
- **Works on Zen 1.22.3b / Firefox 156** — plugins load again (Firefox 155 blocked the old loader), split-view, folder and workspace commands follow Zen's current APIs, and the CSS works with Firefox 156
- **Safer destructive actions** — every bulk close, workspace/folder delete, session Replace and plugin uninstall asks first with Cancel preselected; Replace saves a backup session first; Undo Folder Delete rebuilds the real Zen folder with each tab's history
- **Verified updates and installers** — the self-updater and the one-line installers install only release tags whose `JS/zenleap.uc.js` matches the release's `CHECKSUMS.sha256`; the installers find profiles the way Zen does (including `~/.config/zen`) and never kill Zen
- **Plugins are opt-in** — newly found plugins stay disabled until enabled in Manage Plugins, and each plugin runs in its own sandbox so disabling it removes it cleanly
- **Multi-window and private windows** — settings changed in one window apply in all of them, plugin data is merged instead of overwritten, and nothing from a private window is written to disk
- **Keyboard you can trust** — layout-aware keys, no swallowed macOS Option characters, modes end when you click into a page, browse mode acts on the tab you see highlighted even while other tabs open and close
- **Plays well with ZenRipple** — bulk commands, deduplication and session saves leave AI agents' tabs alone

### Breaking changes

#### For plugin authors
- **New plugins start disabled** — a plugin ZenLeap has not seen before is registered disabled and marked "New"; its `plugin.js` is not read or run until the user enables it in Manage Plugins. Plugins enabled under 3.4.0 stay enabled (see Upgrade notes)
- **`plugin.js` runs in its own sandbox** — window globals (`gBrowser`, `document`, `Services`, timers) still resolve, but `ZenLeapPlugin` must be a property of the plugin's global: declare it with `var ZenLeapPlugin = { … }` (all four examples do). `const`, `let` or `class` declarations are not visible outside `plugin.js`, and the plugin then fails to load with an error saying so
  - The top level of `plugin.js` runs when the plugin is enabled, once per window, and again (re-read from disk) on every re-enable
  - Disabling a plugin nukes its sandbox: functions it left registered elsewhere become dead. Timers started with the plugin's own `setTimeout`/`setInterval` are cleared for it
- **Exactly one destroy hook runs** — the object returned by `init()`, if it has its own `destroy()` (called without arguments), otherwise `ZenLeapPlugin.destroy(api)`; none if `init()` threw. 3.4.0 called both
- **`api.browser.getSelectedText()` is async** — it returns a Promise of the whole selection (with line breaks; text hidden with CSS inside the selection may be included). Inside a page's text field only the first 150 characters can be read; the new `api.browser.getSelection()` resolves to `{ text, truncated }` and flags that with `truncated: true`
- **Events are delivered asynchronously** — handlers run in a later task, never in the middle of a tab switch; a handler removed in the meantime is skipped. `workspace:changed` now actually fires, once per change, with `{ workspaceId, workspace }` (3.4.0 listened for a DOM event Zen no longer sends)
- **While a Glance is open, `tabs.getCurrent()` is the Glance's parent tab** — and so is the default tab of every `tabs.*` method; `browser.*` still acts on the page on screen
- **Return values**
  - `tabs.closeTabs/closeOthers/closeToLeft/closeToRight` close as one reopenable batch and return how many closed (0 if the user cancels Firefox's "close N tabs?" prompt); `closeOthers/closeToLeft/closeToRight` leave pinned tabs and ZenRipple's agent tabs open
  - `tabs.select()` switches workspace when needed and resolves to a boolean; `tabs.unload()` resolves to the number unloaded; `tabs.addToEssentials()` returns `false` when Zen refuses; `tabs.bookmark(tab)` bookmarks that tab (3.4.0 always bookmarked the current page)
  - `workspaces.create(name, { icon, switchTo })` returns Zen's workspace object (with `uuid`) or `null` and no longer switches to the new workspace unless `switchTo: true`; `workspaces.switchTo/rename` resolve to booleans; `workspaces.delete(ws, { timeoutMs })` resolves `false` when Zen doesn't confirm in time
  - `folders.create()` returns the folder element; `folders.delete()` resolves to a boolean
  - `commands.execute(key)` returns `false` for an unknown key; commands that need input open the palette at that step, and commands that ask for confirmation in the palette run directly
  - `browser.zoomIn/zoomOut/zoomReset` use Firefox's page zoom (remembered per site) and resolve once applied
- **`storage.get()/getAll()` and `settings.get()` return copies** — change stored data with `set()`
- **Private windows** — `storage` writes stay in that window's memory and are never saved; plugin `settings` are saved
- **Manifests are checked before any plugin code runs** — `id` must match `[A-Za-z0-9_-]+`, `name` must be set, command keys must match `[\w.:-]+`, and only `toggle`, `number` and `text` settings are kept; the manifest's `builtIn` flag is ignored
- **Plugin data and the enabled state are shared by all windows** — enabling, disabling or uninstalling in one window applies to all

#### For users
- **Zen 1.21.7b or newer** — tested on 1.22.3b. Older builds still load ZenLeap but log a warning; `install.sh` and `install.ps1` warn too
- **Installers: `--yes` no longer means "every profile"** — without `--profile`, they update the profiles that already have ZenLeap, or else install into the profile Zen opens by default. `--profile` takes a number (1 is the default profile, then `profiles.ini` order), a profile or folder name, or `all`, and can be repeated; `--profile-dir` targets profiles started with `-profile`. Exit status: 0 installed, 1 error, 2 nothing installed
- **Updates install release tags only** — the self-updater and `curl | bash` / `irm | iex` / ZenLeap Manager install the latest release only if its `JS/zenleap.uc.js` matches the release's `CHECKSUMS.sha256` and its version matches the tag; otherwise they install nothing (the installers print how to install from a clone)
- **`userChrome.css` is no longer used** — the installers stop appending to it and remove the old ZenLeap block (keeping a backup); the updater no longer downloads `chrome.css`
- **Undo Folder Delete defaults to Ctrl+Shift+T on Linux and Windows** (Cmd+Shift+T on macOS, unchanged) — 3.4.0's Meta+Shift+T default never matched. It only takes over Firefox's "Reopen Closed Tab" while a folder deleted in the last 30 seconds can be restored
- **macOS, non-US keyboard layouts** — an Option shortcut whose key types a character on your layout (for example `@` or `ł`) no longer fires, so you can type that character; this can include the default Option+H/J/K/L. A one-time hint names Settings > Keybindings > **Match Option Shortcuts by Physical Key (macOS)**, which brings the old behaviour back
- **Legacy prefs** `uc.zenleap.debug` and `uc.zenleap.current_indicator` are moved into Settings once and then cleared; Sine's settings page no longer offers them
- **Two Timing settings were removed** — "Workspace Switch Delay" and "Unload Tab Delay" no longer did anything

### Added
- **Confirmations for destructive actions** (Cancel first and preselected) — Close Other/Left/Right Tabs (more than one tab), Delete Workspace (with tab, pinned and folder counts; the current workspace is listed last), Delete Folder, Deduplicate Tabs, delete session, Restore > Replace Current Workspace, plugin uninstall, and browse-mode `x` on a selection that contains folders (`1` everything, `2` folders only; Enter, Space or Escape cancel)
- **Backup before Replace** — "Replace Current Workspace" first saves the current tabs as a backup session (the 5 newest are kept) and cancels if that fails
- **Undo Folder Delete rebuilds the Zen folder** — subfolders, order, position, workspace and collapsed state, with each tab's history, scroll position and form data; up to 10 deletions, each for 30 seconds, from browse mode or the palette. A toast after each delete says which shortcut brings it back
- **Settings > Display > Vim Mode in URL Bar** — turn URL-bar vim off while keeping it in the search and command bars
- **Settings > Keybindings > Match Option Shortcuts by Physical Key (macOS)**
- **Key conflict warnings** — the key recorder refuses global shortcuts without Ctrl/Alt/Cmd (or an F-key), AltGr and dead keys, and shows "Also used by …" for other ZenLeap bindings, Zen shortcuts and ZenRipple's spawn shortcut; a console warning at startup lists global bindings that collide
- **Help and the leap/browse hints follow your key bindings** — the help also lists all 24 themes and has a URL-bar vim section
- **Plugin Manager** — keyboard control (`j`/`k`, Enter/`l` details, Space/`e` enable, `u` uninstall, `h`/Backspace back, Escape), "New" and "Error" badges with the load error, and a full-privileges warning
- **Plugin API** — `browser.isPrivate()`, `browser.getSelection()`, `tabs.getAll/findByUrl/findByTitle({ allWorkspaces: true })`, `tabs.create(url, { skipRoute })` and `browser.openUrl(url, { skipRoute })`, `workspaces.create(name, { icon, switchTo })`, `workspaces.delete(ws, { timeoutMs })`, `ui.showPrompt(title, placeholder, value, { password })`, and `fs` paths with sub-folders (`'notes/today.txt'`, built with `fs.joinPath()`)
- **Update toast** with Update (Details on Sine) and Dismiss buttons; it hides after 15 seconds (hovering pauses it) and when leap mode opens; only Dismiss or Escape skips that version
- **Reorganize Workspaces** has Cancel and Apply Order buttons
- **Sine hot-unload** — with Sine versions that support it, disabling or updating ZenLeap in Sine removes it completely without a restart
- **ZenRipple coexistence** (detected at runtime, never required) — Deduplicate, Close Other/Left/Right, Sort Tabs, Group by Domain and session save leave ZenRipple's agent tabs and pages alone and say so; restoring a session never creates a second "ZenRipple" space; moving your own tabs into the ZenRipple space notes that its agents can see and use them
- **Feedback for commands with nothing to do** — "No tab is playing audio", "No duplicate tabs found", Reload Themes reports how many custom themes loaded (or that the file has an error), one toast for several newly found plugins
- **Installers** — `--loader auto|fx-autoconfig|sine`, `--all-profiles`, repeatable `--profile-dir`; `check` prints `name [profile folder]: STATUS`; leftovers of older installers are offered for removal (listed only with `--yes`); experimental Flatpak support

### Changed
- **Modes end on click-away** — clicking outside ZenLeap's UI, the window losing focus, or focus moving to the URL bar or find bar ends leap mode, browse mode, search and the other overlays; focus goes back where it was (the update dialog included)
- **Browse mode follows the highlighted tab** — tabs opened, closed or moved above the highlight (by a page, window sync or an AI agent) no longer change what Enter, `x`, Space, `y`, `p` and `m` act on; if the highlighted tab itself goes away, the highlight moves to its neighbour, the overlay says so, and that key press does nothing
- **Closing pinned tabs and Essentials** — browse-mode `x` and Tab Search's Ctrl+X / `x` follow Zen's close-shortcut setting (by default reset and unload, not close); several tabs close as one reopenable batch
- **Relative numbering follows Zen's visibility rules** — collapsed pinned sections, split views inside collapsed folders, Glance, and Zen's empty tab in a new space (numbering then counts from above the first unpinned tab); after `h`/`l`, digits count from the new space's current tab
- **Keyboard layouts** — on non-Latin layouts, letters, digits and punctuation work by key position (like Vim's langmap), including marks and the Reorganize dialog; AltGr never triggers a shortcut outside macOS; holding a mode chord no longer toggles it repeatedly (Alt+J/K still repeat); g/z/mark sub-modes time out after 60 seconds; Alt+Space is only taken while a split view is open
- **URL bar Escape** — with nothing typed, one Escape closes the URL bar; after typing (autofill included) it switches to NORMAL mode
- **Palette** — an exact or prefix command-name match ranks first, and in the workspace, folder and session pickers a name typed in full ranks first; failing commands show a toast and log to the Browser Console; "Find Playing Tab" searches every workspace; "New Tab" opens a real, selected tab; "Duplicate Tab" places the copy next to the source; Zoom In/Out/Reset use Firefox's per-site zoom; Rename Tab and Edit Tab Icon are only offered where Zen has them (not in private windows)
- **Settings sync across windows** — each window writes only the keys it changed; invalid saved values are dropped per key with a warning; reopening Settings shows current values; "Reset All to Defaults" asks for a second click and leaves internal state alone; keyboard focus stays inside Settings; the import confirmation works from the keyboard
- **Sessions** — restored tabs load lazily and ignore Space Routing; Essentials are restored through Zen; custom tab icons are saved; Replace no longer waits 2.5 s re-checking the tab order
- **Update checks** read a few KB from the GitHub releases API instead of downloading the whole script, run in one window only, and "On Startup" means once per browser session; Retry after a failed check checks again
- **Browse previews** use Firefox's `drawSnapshot`; nothing is injected into pages. Unloaded tabs show "Tab not loaded"
- **Themes** — user themes always start from Meridian; named and `hsl()` colors are normalized; invalid colors fall back to Meridian's
- **Tab switches are faster with many tabs** — badge attributes are written only when they change, and the close-button rule no longer uses `:has()`
- **Installers** find profiles like Zen (`profiles.ini`/`installs.ini`, `~/.config/zen`, `$XDG_CONFIG_HOME`, `MOZ_LEGACY_HOME`, legacy `~/.zen`), never touch non-profile folders, never run `sudo` themselves, never replace an existing `config.js`, copy only fx-autoconfig's `chrome/utils` from a pinned, hash-checked commit, and clear the startup cache with `InvalidateCaches`. ZenLeap Manager (macOS) is released as `ZenLeap-Manager-vX.Y.Z-macos.zip` and has a profile picker

### Fixed
- **Plugins didn't load on Zen 1.22 / Firefox 155+** — Firefox blocks `loadSubScript` of `file://` URLs; plugins now run in sandboxes
- **Zen 1.22 compatibility** — "Remove Tab from Split View" works again; "Convert Folder to Workspace" keeps every tab and subfolder in the new workspace after a restart; moving several tabs to another workspace keeps their order; SVG space icons show as icons; the update dialog's success and Sine screens were blank; compact mode was detected when it was off; `ui.getAccentColor()`/`getThemeColors()` returned `undefined`
- **Typing into a page after clicking it ran ZenLeap commands** — typing "fox" in browse mode could close a tab
- **macOS Option characters** (`@`, `ł`, non-breaking space) were swallowed
- **Keys** meant for prompts, tab-modal dialogs and input methods are left alone; pages no longer get keyups for keys ZenLeap consumed; the URL-bar vim no longer swallows the first character after `i`/`a`/`A`; the update toast no longer takes Enter/Escape from pages
- **Data between windows** — plugin data and settings are merged instead of overwritten; a corrupt plugin data file or settings value is kept aside instead of being replaced; Essential marks from two windows no longer overwrite each other
- **Hand-edited `zenleap-themes.json`** — the theme editor overwrote a file with a syntax error (losing every theme in it) and the startup template could replace a file that couldn't be read; both now leave it alone and say so
- **Themes wiped Zen's space colors** — with "Apply Theme to Browser" off, previewing or switching a ZenLeap theme (or disabling ZenLeap in Sine) removed Zen's own gradient and accent until the next space switch
- **A tab title with a control character blanked Tab Search**
- **Switch Theme** kept a previewed theme after stepping back into the picker; the caret jumped to the start of the query after going back a step
- **`getSelectedText()`** returned at most 150 characters with whitespace collapsed
- **Plugin API** — `fs` paths with a `/` failed; `folders.addTab()` refused tabs from deeply nested folders; `commands.execute()` used command conditions from its first call
- **Settings** — a key recorder interrupted by a click outside stayed on "Press key…"; the browse preview covered the delete-confirm dialogs; Settings reopened with stale values; the theme editor's color fields ignored valid CSS colors such as `#abc`, `red` or `rgb()`
- **Sessions** — damaged or old session files no longer break the pickers and are reported in the console; a failure while saving a folder or split view is reported instead of silently dropping its tabs
- **Installers** — profiles in `~/.config/zen` (current Zen on Linux) are found; `Profile Groups`, `Crash Reports` and `Pending Pings` are no longer treated as profiles; startup-cache paths are right on every platform; `install.ps1` under `irm | iex` no longer closes the PowerShell window, writes no profile files as Administrator and enables TLS 1.2 on Windows PowerShell 5.1; ZenLeap Manager's dialogs no longer show a literal `\n`
- **Tab-timer example** no longer rewrites plugin data every 5 seconds in every window

### Security
- **Verified self-update** — release tag only, SHA-256 against the tag's `CHECKSUMS.sha256`, `@version` must equal the tag, at most 10 MB, written atomically over the file ZenLeap was loaded from, with the previous version kept as `.bak` and restored if the written file doesn't verify; a release without a checksum is refused
- **Installers** apply the same verification, take fx-autoconfig from a pinned commit with hash-checked files, never kill Zen and never run `sudo`
- **Plugins are opt-in** — a disabled plugin's code is never evaluated, and the manifest is validated first. The sandbox is for clean unloading, not isolation: plugins still run with full browser privileges, as the Plugin Manager says
- **Private windows** — sessions, Essential marks and plugin storage from private windows are never written to disk
- **Fewer privileged loads** — the URL-bar fallback, palette "New Tab" and the About page's GitHub link no longer load with the system principal; session restores refuse `javascript:` URLs
- **Untrusted text** (titles, URLs, space names and icons, plugin manifests, session files) is escaped or built with DOM calls, including characters XML forbids; ZenLeap injects nothing into web pages

### Upgrade notes (from 3.4.0)
- **Your last update from 3.4.0 runs 3.4.0's updater** — it downloads the script unverified and re-adds an empty ZenLeap block to `userChrome.css`; running the installer or `clean-legacy-css.sh` removes it. Later updates are verified
- **Plugins** — plugins enabled under 3.4.0 stay enabled and run at startup; plugins ZenLeap never registered (for example ones added while 3.4.0 couldn't load plugins on Zen 1.22) appear disabled with a "New" badge. `zenleap-plugin-data.json` keeps its format. Update plugins that call `getSelectedText()` synchronously, declare `const ZenLeapPlugin`, or rely on both destroy hooks
- **Settings, marks, sessions and themes** keep their formats — settings stay in `uc.zenleap.settings` (only new keys were added), Essential marks in `uc.zenleap.essentialMarks`, sessions in `zenleap-sessions/` (older files load too), themes in `chrome/zenleap-themes.json`
- **One-liners** (`curl | bash`, `irm | iex`, ZenLeap Manager) install the latest verified release tag or nothing, and print how to install from a clone
- **`--yes` without `--profile`** updates the profiles that already have ZenLeap (or installs into Zen's default profile); profile numbers changed (1 is the default profile), so use names in scripts
- **fx-autoconfig** — an existing installation is left as it is (interactive runs offer to update an old loader); its example files are no longer copied and old copies are offered for removal; `--remove-fxautoconfig` keeps it where other scripts still need it
- **Sine** — where Sine manages ZenLeap, `--yes` leaves Sine's copy alone (`--loader sine` updates it); profiles that only run Sine are skipped
- **The installers never close Zen** — restart Zen after installing

## [3.4.0] - 2026-03-22

### Fixed
- **Browser freeze on quit** (#48) — Removed the `profileBeforeChange` shutdown blocker that awaited promises which could never resolve during that shutdown phase (both `setTimeout` and `IOUtils.writeJSON` hang when the timer service is already shut down). Plugin data is now flushed via fire-and-forget write in the window `unload` handler instead
- **jj escape swallowing next character in URL bar** (#47) — The `urlbarSuppressKeypress` flag was not cleared after flushing a pending single `j`, causing the subsequent character's keypress event to be blocked

### Added
- **`jj Escape to Normal Mode` toggle** — New `timing.jjEscape` setting (default: off) lets users opt in to the jj escape behavior in search and URL bars. Previously this was always on with no way to disable it
- **Proper shutdown cleanup** — `destroy()` function removes keyboard listeners, disconnects MutationObserver, and aborts gTile document-level listeners via AbortController on window unload

## [3.3.9] - 2026-03-14

### Fixed
- **Folder badge off-center and overlapping label text** (#45) — Folder relative number badges are now positioned inside `.tab-group-label-container` instead of on the `zen-folder` element, fixing vertical centering and horizontal alignment with tab badges
- **Long folder names clashing with badges** (#45) — Folder labels now fade out via `mask-image` gradient before reaching the badge area, matching the text clipping behavior of tab labels

## [3.3.8] - 2026-03-13

### Fixed
- **Browser theme not applying on Zen 1.19+** — Zen moved `--zen-main-browser-background` and `--zen-main-browser-background-toolbar` from `:root` to dedicated `#zen-browser-background` and `#zen-toolbar-background` elements. ZenLeap now sets these properties on the correct element targets while maintaining backwards compatibility with older Zen versions
- **Workspace switch animation flash** — The `onWorkspaceChange` wrapper now passes `duringAnimation` to avoid clobbering Zen's cross-fade spring animation mid-transition, preventing brief flashes of native Zen colors during workspace switches
- **Stale element references** — Background element targets are now resolved at call time via `gZenThemePicker` getters (with `getElementById` fallback) instead of being cached once at script load

### Changed
- **Element-target property lists** — Managed properties for each background element are now in declarative lists (`_zenBgElProps`, `_zenToolbarBgElProps`) for cleaner revert logic
- **Complete revert path** — Disabling "Apply Theme to Browser" now clears all overrides from both `:root` and element targets, including `-old` variants and `--zen-background-opacity`

## [3.3.7] - 2026-03-04

### Changed
- **Plugin data persistence moved to file** — Plugin data (enabled state, settings, scoped storage) is now stored in `zenleap-plugin-data.json` instead of a Firefox preference, eliminating the `uc.zenleap.plugins` pref size warning and improving scalability
- **Automatic migration** — Existing plugin data is migrated from the old pref to the new file on first launch; the pref is then cleaned up
- **Shutdown safety** — Plugin data writes are flushed via `IOUtils.profileBeforeChange` shutdown blocker, preventing data loss on browser exit
- **Write serialization** — Concurrent plugin data writes are serialized through a promise chain to prevent race conditions

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

## [2.4.0] - 2026-02-05

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

## [2.3.0] - 2026-02-05

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

## [2.2.0] - 2026-02-05

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

## [2.1.0] - 2026-02-05

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

## [2.0.0] - 2026-02-05

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

## [1.0.0] - 2026-02-05

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
| 3.4.0 | 2026-03-22 | Fix browser freeze on quit, jj escape now an opt-in setting, URL-bar jj fix |
| 3.3.9 | 2026-03-14 | Folder badge alignment, long folder names fade before the badge |
| 3.3.8 | 2026-03-13 | Browser theme on Zen 1.19+, no color flash on workspace switch |
| 3.3.7 | 2026-03-04 | Plugin data moved from a pref to zenleap-plugin-data.json |
| 3.3.6 | 2026-02-27 | Collapsed-folder numbering and folder badges, rebound browse keys, installer fixes |
| 3.3.5 | 2026-02-26 | Sine package manager compatibility (self-update disabled for Sine installs) |
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
| 2.4.0 | 2026-02-05 | Help modal (?), multi-word search, recency ranking, close tabs from search |
| 2.3.0 | 2026-02-05 | Tab Search (Ctrl+/) with fuzzy finder and vim mode |
| 2.2.0 | 2026-02-05 | Jump history (o/i), marks (m/') |
| 2.1.0 | 2026-02-05 | Manager app, compact mode, arrow keys |
| 2.0.0 | 2026-02-05 | Browse mode, g-mode, z-mode |
| 1.0.0 | 2026-02-05 | Initial release |
