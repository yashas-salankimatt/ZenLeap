#!/usr/bin/env python3
"""
ZenLeap Browser MCP Server
Exposes Zen Browser control tools to Claude Code via Model Context Protocol.
Connects to the ZenLeap Agent WebSocket server running in the browser.
"""

import asyncio
import base64
import json
import os
from uuid import uuid4

import websockets

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.utilities.types import Image

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


@mcp.tool()
async def browser_screenshot(tab_id: str = "") -> Image:
    """Take a screenshot of a browser tab. Returns the image so you can see the page.
    Use this to verify page state, understand layouts, or see visual content."""
    result = await browser_command("screenshot", {"tab_id": tab_id or None})
    data_url = result.get("image", "")
    # Strip data URL prefix: "data:image/png;base64,..."
    if data_url.startswith("data:"):
        b64 = data_url.split(",", 1)[1]
    else:
        b64 = data_url
    raw_bytes = base64.b64decode(b64)
    return Image(data=raw_bytes, format="png")


@mcp.tool()
async def browser_get_dom(tab_id: str = "") -> str:
    """Get all interactive elements on the current page with indices.
    Returns elements like buttons, links, inputs, selects with their index numbers.
    Use these indices with click/fill tools in the future."""
    result = await browser_command("get_dom", {"tab_id": tab_id or None})
    if isinstance(result, dict) and "elements" in result:
        lines = [
            f"Page: {result.get('url', '?')}",
            f"Title: {result.get('title', '?')}",
            "",
            "Interactive elements:",
        ]
        for el in result["elements"]:
            attrs = " ".join(
                f'{k}="{v}"' for k, v in (el.get("attributes") or {}).items()
            )
            text = el.get("text", "").strip()
            tag = el["tag"]
            rect = el.get("rect", {})
            pos = (
                f"({rect.get('x', 0)},{rect.get('y', 0)} "
                f"{rect.get('w', 0)}x{rect.get('h', 0)})"
            )
            lines.append(f"[{el['index']}] <{tag} {attrs}>{text}</{tag}> {pos}")
        return "\n".join(lines)
    return text_result(result)


@mcp.tool()
async def browser_get_page_text(tab_id: str = "") -> str:
    """Get the full visible text content of the current page."""
    result = await browser_command("get_page_text", {"tab_id": tab_id or None})
    if isinstance(result, dict) and "text" in result:
        return result["text"]
    return text_result(result)


@mcp.tool()
async def browser_get_page_html(tab_id: str = "") -> str:
    """Get the full HTML source of the current page."""
    result = await browser_command("get_page_html", {"tab_id": tab_id or None})
    if isinstance(result, dict) and "html" in result:
        return result["html"]
    return text_result(result)


# ── Interaction ────────────────────────────────────────────────


@mcp.tool()
async def browser_click(index: int, tab_id: str = "") -> str:
    """Click an interactive element by its index from browser_get_dom.
    Always call browser_get_dom first to get element indices."""
    return text_result(
        await browser_command(
            "click_element", {"tab_id": tab_id or None, "index": index}
        )
    )


@mcp.tool()
async def browser_click_coordinates(x: int, y: int, tab_id: str = "") -> str:
    """Click at specific x,y coordinates on the page.
    Use browser_screenshot + browser_get_dom to identify coordinates."""
    return text_result(
        await browser_command(
            "click_coordinates", {"tab_id": tab_id or None, "x": x, "y": y}
        )
    )


@mcp.tool()
async def browser_fill(index: int, value: str, tab_id: str = "") -> str:
    """Fill a form field (input/textarea) with a value by its index from browser_get_dom.
    Clears existing content and sets the new value, dispatching input/change events."""
    return text_result(
        await browser_command(
            "fill_field", {"tab_id": tab_id or None, "index": index, "value": value}
        )
    )


@mcp.tool()
async def browser_select_option(index: int, value: str, tab_id: str = "") -> str:
    """Select an option in a <select> dropdown by its index from browser_get_dom.
    The value can be the option's value attribute or visible text."""
    return text_result(
        await browser_command(
            "select_option",
            {"tab_id": tab_id or None, "index": index, "value": value},
        )
    )


@mcp.tool()
async def browser_type(text: str, tab_id: str = "") -> str:
    """Type text character-by-character into the currently focused element.
    Dispatches keydown/keypress/keyup and input events for each character.
    Focus an element first with browser_click."""
    return text_result(
        await browser_command(
            "type_text", {"tab_id": tab_id or None, "text": text}
        )
    )


@mcp.tool()
async def browser_press_key(
    key: str, ctrl: bool = False, shift: bool = False, alt: bool = False, meta: bool = False, tab_id: str = ""
) -> str:
    """Press a keyboard key (Enter, Tab, Escape, ArrowDown, a, etc.) with optional modifiers.
    Dispatches keydown/keypress/keyup events on the focused element."""
    modifiers = {"ctrl": ctrl, "shift": shift, "alt": alt, "meta": meta}
    return text_result(
        await browser_command(
            "press_key",
            {"tab_id": tab_id or None, "key": key, "modifiers": modifiers},
        )
    )


@mcp.tool()
async def browser_scroll(
    direction: str = "down", amount: int = 500, tab_id: str = ""
) -> str:
    """Scroll the page in a direction (up/down/left/right) by a pixel amount.
    Default is 500 pixels down."""
    return text_result(
        await browser_command(
            "scroll",
            {"tab_id": tab_id or None, "direction": direction, "amount": amount},
        )
    )


@mcp.tool()
async def browser_hover(index: int, tab_id: str = "") -> str:
    """Hover over an interactive element by its index from browser_get_dom.
    Dispatches mouseenter/mouseover/mousemove events. Useful for revealing tooltips or dropdown menus."""
    return text_result(
        await browser_command(
            "hover", {"tab_id": tab_id or None, "index": index}
        )
    )


# ── Console / Eval ─────────────────────────────────────────────


@mcp.tool()
async def browser_console_setup(tab_id: str = "") -> str:
    """Start capturing console output (log/warn/error/info) and uncaught errors on a tab.
    Must be called before browser_console_logs or browser_console_errors will return data.
    Capture persists until the page navigates away."""
    return text_result(
        await browser_command(
            "console_setup", {"tab_id": tab_id or None}
        )
    )


@mcp.tool()
async def browser_console_logs(tab_id: str = "") -> str:
    """Get captured console messages (log/warn/info/error) from the current page.
    Call browser_console_setup first to start capturing. Returns up to 500 most recent entries."""
    result = await browser_command(
        "console_get_logs", {"tab_id": tab_id or None}
    )
    if isinstance(result, dict) and "logs" in result:
        if not result["logs"]:
            return "(no console logs captured)"
        lines = []
        for log in result["logs"]:
            ts = log.get("timestamp", "")
            level = log.get("level", "log")
            msg = log.get("message", "")
            lines.append(f"[{level}] {ts} {msg}")
        return "\n".join(lines)
    return text_result(result)


@mcp.tool()
async def browser_console_errors(tab_id: str = "") -> str:
    """Get captured errors: console.error calls, uncaught exceptions, and unhandled promise rejections.
    Call browser_console_setup first to start capturing. Returns up to 100 most recent entries."""
    result = await browser_command(
        "console_get_errors", {"tab_id": tab_id or None}
    )
    if isinstance(result, dict) and "errors" in result:
        if not result["errors"]:
            return "(no errors captured)"
        lines = []
        for err in result["errors"]:
            ts = err.get("timestamp", "")
            etype = err.get("type", "error")
            msg = err.get("message", "")
            stack = err.get("stack", "")
            entry = f"[{etype}] {ts} {msg}"
            if stack:
                entry += "\n" + stack
            lines.append(entry)
        return "\n\n".join(lines)
    return text_result(result)


@mcp.tool()
async def browser_console_eval(expression: str, tab_id: str = "") -> str:
    """Execute JavaScript in the current page and return the result.
    Runs in the page's global scope — can access page variables, DOM, etc.
    May be blocked by Content Security Policy on some pages."""
    result = await browser_command(
        "console_evaluate",
        {"tab_id": tab_id or None, "expression": expression},
    )
    if isinstance(result, dict):
        if "error" in result:
            stack = result.get("stack", "")
            return f"Error: {result['error']}" + (f"\n{stack}" if stack else "")
        if "result" in result:
            return str(result["result"])
    return text_result(result)


# ── Control ─────────────────────────────────────────────────────


@mcp.tool()
async def browser_wait(seconds: float = 2.0) -> str:
    """Wait for a specified number of seconds. Useful after navigation or clicks
    to let the page load or animations complete."""
    return text_result(await browser_command("wait", {"seconds": seconds}))


@mcp.tool()
async def browser_wait_for_load(tab_id: str = "", timeout: int = 15) -> str:
    """Wait for the current page to finish loading (up to timeout seconds).
    More reliable than browser_wait for navigation — polls the browser's loading state.
    Returns the final URL and title once loaded."""
    return text_result(
        await browser_command(
            "wait_for_load",
            {"tab_id": tab_id or None, "timeout": timeout},
        )
    )


@mcp.tool()
async def browser_save_screenshot(file_path: str, tab_id: str = "") -> str:
    """Take a screenshot and save it as a PNG file to the given path.
    Use this to save visual evidence of page state to disk.
    The file_path can be absolute or relative to the server's working directory."""
    result = await browser_command("screenshot", {"tab_id": tab_id or None})
    data_url = result.get("image", "")
    if data_url.startswith("data:"):
        b64 = data_url.split(",", 1)[1]
    else:
        b64 = data_url
    raw = base64.b64decode(b64)
    # Ensure parent directory exists
    parent = os.path.dirname(os.path.abspath(file_path))
    os.makedirs(parent, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(raw)
    width = result.get("width", "?")
    height = result.get("height", "?")
    return f"Screenshot saved to {file_path} ({len(raw)} bytes, {width}x{height})"


# ── Entry Point ─────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
