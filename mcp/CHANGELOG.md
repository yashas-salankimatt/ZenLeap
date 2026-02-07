# Changelog

All notable changes to the ZenLeap AI MCP server and browser agent.

## [0.5.0] - 2026-02-07

### Added
- **Workspace scoping**: All tabs created by the agent are placed in a dedicated "ZenLeap AI" workspace. `list_tabs` returns only workspace-scoped tabs. `switch_tab` auto-switches workspace context.
- **`wait_for_load` command**: Polls `webProgress.isLoadingDocument` with configurable timeout — more reliable than fixed `wait` delays after navigation.
- **`browser_wait_for_load` MCP tool**: Exposes `wait_for_load` to Claude Code.
- **`browser_save_screenshot` MCP tool**: Takes a screenshot and saves the PNG to a file path on disk.
- **`.mcp.json`**: Claude Code auto-discovers the MCP server when starting in the project directory.
- **Phase 5 e2e tests**: 32 tests covering workspace scoping, wait_for_load, navigation, screenshots, and tab lifecycle.
- 67 pytest unit tests (6 new for wait_for_load and save_screenshot).

### Fixed
- Concurrent workspace creation race condition: `ensureAgentWorkspace()` uses a promise lock to prevent duplicate workspaces.
- `list_tabs` now calls `ensureAgentWorkspace()` to recover workspace ID after browser restart.

## [0.4.0] - 2026-02-07

### Added
- **Console capture**: `console_setup`, `console_get_logs`, `console_get_errors` commands intercept `console.log/warn/error/info`, uncaught errors, and unhandled promise rejections.
- **JS evaluation**: `console_evaluate` runs JavaScript in the page's content scope via `contentWindow.eval()`.
- **MCP tools**: `browser_console_setup`, `browser_console_logs`, `browser_console_errors`, `browser_console_eval`.
- 12 new pytest tests, 23 e2e tests.

### Fixed
- Console override now uses `Cu.exportFunction` + `wrappedJSObject` to cross Xray wrapper boundary (chrome-scope assignments were invisible to content code).

## [0.3.0] - 2026-02-07

### Added
- **Interaction commands**: `click_element`, `click_coordinates`, `fill_field`, `select_option`, `type_text`, `press_key`, `scroll`, `hover`.
- **MCP tools**: `browser_click`, `browser_click_coordinates`, `browser_fill`, `browser_select_option`, `browser_type`, `browser_press_key`, `browser_scroll`, `browser_hover`.
- `actorInteraction` wrapper catches "actor destroyed" errors for commands that may trigger navigation.
- `#fillField` uses native value setter to bypass React/framework value traps.
- `#selectOption` matches by value or visible text.
- 13 new pytest tests, 27 e2e tests.

### Fixed
- **Trusted KeyboardEvent crash**: Events from JSWindowActorChild are system-privileged. Special keys (Escape, Tab, Enter) crashed tabs. Fixed with `setTimeout` deferral.
- `#typeText` uses value setter + InputEvent instead of per-character KeyboardEvent.

## [0.2.0] - 2026-02-07

### Added
- **Screenshot**: `drawSnapshot` with `PageThumbs` fallback, resized to 1568px max width.
- **DOM extraction**: JSWindowActor (`ZenLeapAgentChild`) indexes interactive elements with bounding rects.
- **Page content**: `get_page_text` (innerText, 200K limit), `get_page_html` (outerHTML, 500K limit).
- **MCP tools**: `browser_screenshot`, `browser_get_dom`, `browser_get_page_text`, `browser_get_page_html`.
- Actor registration via `resource://` URIs (not `file://` — silently fails).
- Binary frame chunking (8192 bytes) to prevent stack overflow for large payloads.
- WebSocket 64-bit frame length encoding fix.
- 12 new pytest tests, 29 e2e tests.

## [0.1.0] - 2026-02-07

### Added
- **WebSocket server**: XPCOM `nsIServerSocket` on localhost:9876 with RFC 6455 handshake.
- **Tab management**: `create_tab`, `close_tab`, `switch_tab`, `list_tabs`.
- **Navigation**: `navigate`, `go_back`, `go_forward`, `reload`.
- **Observation**: `get_page_info`, `get_agent_logs`.
- **Control**: `ping`, `wait`.
- **MCP server**: Python FastMCP bridge connecting Claude Code to the browser via WebSocket JSON-RPC.
- 24 pytest tests, 17 e2e tests.
