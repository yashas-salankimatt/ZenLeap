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

## Phase 1 Status

- All Phase 1 commands working: ping, create_tab, close_tab, switch_tab, list_tabs, navigate, go_back, go_forward, reload, get_page_info, wait, get_agent_logs.
- 20-ping stress test passes. 17 e2e command tests pass. 24 pytest tests pass.
- Code review passes all 8 criteria.
