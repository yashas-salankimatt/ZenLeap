# ZenLeap AI — Working Notes

Nuances, unexpected findings, and gotchas discovered while working on this project.
Keep this file concise — only record things that save future time. Prune aggressively.

---

## XPCOM Stream Reading — CRITICAL

**`nsIScriptableInputStream.read()` truncates at null bytes (0x00).** Binary data (like WebSocket frames with masked payloads) will silently lose bytes. Use `nsIBinaryInputStream.readByteArray(count)` instead — returns a JS Array of byte values, fully binary-safe. The method to initialize it is `.setInputStream(stream)`, NOT `.init(stream)`.

## XPCOM Networking

- `nsIServerSocket.init(port, loopbackOnly, backlog)` — second arg `true` restricts to localhost.
- `transport.openOutputStream(2, 0, 0)` — flag `2` is `OPEN_UNBUFFERED`, prevents output buffering.
- `nsIInputStreamPump` is the correct async reading pattern for XPCOM sockets.

## fx-autoconfig / .uc.js

- Scripts run per-window. Use `globalThis[key]` to prevent duplicate servers.
- After `gZenWorkspaces.createAndSaveWorkspace()`, the UI can block. Defer or avoid during command handling.

## Workspace API

- `gZenWorkspaces.getWorkspaces()` returns array of `{uuid, name, icon, ...}`.
- Property is `.name`, not `.label` (PLAN.md was wrong).
- `gZenWorkspaces.activeWorkspace` returns UUID string.

## Python / uv

- Use `uv` (not venv) for dependency management in `mcp/`.
- Project name in pyproject.toml must NOT match a dependency name (e.g., can't name project "mcp").

## JSWindowActor Registration — CRITICAL

- `file://` is **NOT a trusted scheme** for actor module URIs. Registration silently succeeds but `getActor()` fails with "System modules must be loaded from a trusted scheme".
- **Must use `resource://` URIs.** Register a custom substitution first:
  ```js
  const resProto = Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler);
  resProto.setSubstitution('zenleap-agent', Services.io.newFileURI(actorsDir));
  // Then use: resource://zenleap-agent/ZenLeapAgentChild.sys.mjs
  ```
- `ChromeUtils.registerWindowActor()` is browser-global — use `globalThis[key]` guard for multi-window.
- Re-registration throws `NotSupportedError` with "already been registered" — catch and ignore.
- `matches: ['*://*/*']` excludes `about:` and `chrome:` pages — `getActor()` throws on those.
- `sendQuery()` from parent→child returns the value from `receiveMessage()`. Return values must be structured-clone safe.

## Screenshots / Large Payloads

- `drawSnapshot(null, 1, 'white')` — null rect = full viewport, returns `ImageBitmap`.
- **Always call `bitmap.close()`** after use (ideally in `finally` block) to prevent memory leaks.
- `PageThumbs.captureToBlob()` is a viable fallback via `ChromeUtils.importESModule('resource://gre/modules/PageThumbs.sys.mjs')`.
- `String.fromCharCode.apply(null, arr)` stack-overflows for >64KB — chunk at 8192 bytes.
- **WebSocket 64-bit length encoding bug:** JS bitwise `>>` is 32-bit, so `x >> 56` wraps to `x >> 24`. For 64-bit frame lengths, write upper 4 bytes as `0,0,0,0` explicitly, then lower 4 bytes with `>> 24/16/8/0`.

## Phase 1 Status

- All Phase 1 commands working: ping, create_tab, close_tab, switch_tab, list_tabs, navigate, go_back, go_forward, reload, get_page_info, wait, get_agent_logs.
- 20-ping stress test passes. 17 e2e command tests pass. 24 pytest tests pass.
- Code review passes all 8 criteria.

## Phase 2 Status

- All Phase 2 commands working: screenshot, get_dom, get_page_text, get_page_html.
- 36 pytest tests pass (24 Phase 1 + 12 Phase 2). 29 e2e tests pass.
- Code review passes all 8 criteria.

## Phase 3 Status

- All Phase 3 commands working: click_element, click_coordinates, fill_field, select_option, type_text, press_key, scroll, hover.
- 49 pytest tests pass, 27 e2e tests pass, code review passes all 8 criteria.
- `#fillField` uses native setter (`HTMLInputElement.prototype.value.set`) to bypass React/framework value traps.
- `#selectOption` matches by value or visible text, lists available options on mismatch.
- `#getElement` validates WeakRef deref + isConnected to catch stale elements.

## Phase 4 Status

- All Phase 4 commands working: console_setup, console_get_logs, console_get_errors, console_evaluate.
- 61 pytest tests pass, 23 e2e tests pass, code review passes all 8 criteria.
- Console capture requires `Cu.exportFunction` + `wrappedJSObject` to cross Xray boundary.
- `contentWindow.eval()` runs at content principal (no privilege escalation).

## Xray Wrapper Gotcha — Console Override

Setting `win.console.log = fn` from a JSWindowActorChild does NOT work — the Xray wrapper prevents content code from seeing the chrome-scope assignment. Must use:
```js
const unwrapped = win.console.wrappedJSObject;
unwrapped.log = Cu.exportFunction(wrapperFn, win);
```
`Cu.exportFunction` makes chrome functions callable from content scope. `wrappedJSObject` accesses the content object directly. Both are required.

## JSWindowActor Trusted Events — CRITICAL

**KeyboardEvent dispatched from a JSWindowActorChild is TRUSTED** (system-privileged context). Special keys (Escape, Tab, Enter) trigger browser-level handlers that can crash/navigate tabs. Fix: defer dispatch via `win.setTimeout(() => { ... }, 0)` so `sendQuery` response returns before side effects. The `actorInteraction` wrapper in the parent also catches "actor destroyed" errors as a fallback.

Similarly, `#typeText` should NOT dispatch KeyboardEvent per character — use value setter + InputEvent instead (same pattern as `#fillField`).
