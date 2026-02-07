#!/usr/bin/env python3
"""
ZenLeap Browser MCP Server
Exposes Zen Browser control tools to Claude Code via Model Context Protocol.
Connects to the ZenLeap Agent WebSocket server running in the browser.
"""

import asyncio
import json
import os
from uuid import uuid4

import websockets

from mcp.server.fastmcp import FastMCP

BROWSER_WS_URL = os.environ.get("ZENLEAP_WS_URL", "ws://localhost:9876")

mcp = FastMCP(
    "zenleap-browser",
    instructions=(
        "Browser control tools for Zen Browser via ZenLeap Agent. "
        "All tab operations are scoped to the 'ZenLeap AI' workspace."
    ),
)

_ws_connection = None
_ws_lock = asyncio.Lock()


async def get_ws():
    """Get or create WebSocket connection to browser."""
    global _ws_connection
    async with _ws_lock:
        if _ws_connection is not None:
            try:
                await _ws_connection.ping()
                return _ws_connection
            except Exception:
                _ws_connection = None

        _ws_connection = await websockets.connect(BROWSER_WS_URL)
        return _ws_connection


async def browser_command(method: str, params: dict | None = None) -> dict:
    """Send a command to the browser and return the response."""
    ws = await get_ws()
    msg_id = str(uuid4())
    msg = {"id": msg_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(msg))
    raw = await asyncio.wait_for(ws.recv(), timeout=30)
    resp = json.loads(raw)
    if "error" in resp:
        raise Exception(resp["error"].get("message", "Unknown browser error"))
    return resp.get("result", {})


def text_result(data) -> str:
    """Format result as string for MCP tool return."""
    if isinstance(data, (dict, list)):
        return json.dumps(data, indent=2)
    return str(data)


# ── Tab Management ──────────────────────────────────────────────


@mcp.tool()
async def browser_create_tab(url: str = "about:blank") -> str:
    """Create a new browser tab in the ZenLeap AI workspace and navigate to a URL."""
    return text_result(await browser_command("create_tab", {"url": url}))


@mcp.tool()
async def browser_close_tab(tab_id: str = "") -> str:
    """Close a browser tab. If no tab_id, closes the active tab."""
    return text_result(
        await browser_command("close_tab", {"tab_id": tab_id or None})
    )


@mcp.tool()
async def browser_switch_tab(tab_id: str) -> str:
    """Switch to a different tab in the ZenLeap AI workspace."""
    return text_result(await browser_command("switch_tab", {"tab_id": tab_id}))


@mcp.tool()
async def browser_list_tabs() -> str:
    """List all open tabs in the ZenLeap AI workspace with IDs, titles, and URLs."""
    return text_result(await browser_command("list_tabs"))


# ── Navigation ──────────────────────────────────────────────────


@mcp.tool()
async def browser_navigate(url: str, tab_id: str = "") -> str:
    """Navigate a tab to a URL. If no tab_id, navigates the active tab."""
    return text_result(
        await browser_command("navigate", {"url": url, "tab_id": tab_id or None})
    )


@mcp.tool()
async def browser_go_back(tab_id: str = "") -> str:
    """Navigate back in a tab's history."""
    return text_result(
        await browser_command("go_back", {"tab_id": tab_id or None})
    )


@mcp.tool()
async def browser_go_forward(tab_id: str = "") -> str:
    """Navigate forward in a tab's history."""
    return text_result(
        await browser_command("go_forward", {"tab_id": tab_id or None})
    )


@mcp.tool()
async def browser_reload(tab_id: str = "") -> str:
    """Reload a tab."""
    return text_result(
        await browser_command("reload", {"tab_id": tab_id or None})
    )


# ── Observation ─────────────────────────────────────────────────


@mcp.tool()
async def browser_get_page_info(tab_id: str = "") -> str:
    """Get info about a tab: URL, title, loading state, navigation history."""
    return text_result(
        await browser_command("get_page_info", {"tab_id": tab_id or None})
    )


# ── Control ─────────────────────────────────────────────────────


@mcp.tool()
async def browser_wait(seconds: float = 2.0) -> str:
    """Wait for a specified number of seconds. Useful after navigation or clicks
    to let the page load or animations complete."""
    return text_result(await browser_command("wait", {"seconds": seconds}))


# ── Entry Point ─────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
