#!/usr/bin/env python3
"""End-to-end test for Phase 5: Workspace scoping, wait_for_load, save_screenshot."""

import asyncio
import json
import os
import sys
import tempfile
from uuid import uuid4

import websockets

WS_URL = "ws://localhost:9876"
PASS = 0
FAIL = 0


async def send_command(ws, method, params=None, timeout=30):
    msg_id = str(uuid4())
    msg = {"id": msg_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(msg))
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    resp = json.loads(raw)
    if "error" in resp:
        raise Exception(f"{method} error: {resp['error'].get('message', resp['error'])}")
    return resp.get("result", {})


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        print(f"  ✗ {name} — {detail}")


async def main():
    global PASS, FAIL
    print("Connecting to browser WebSocket...")
    ws = await websockets.connect(WS_URL, max_size=10 * 1024 * 1024)
    print(f"Connected.\n")

    # --- 1. Ping ---
    print("1. Ping")
    r = await send_command(ws, "ping")
    check("pong received", r.get("pong") is True)
    check("version is 0.5.0", r.get("version") == "0.5.0", f"got {r.get('version')}")

    # --- 2. Create tab (should go into ZenLeap AI workspace) ---
    print("\n2. Create tab → example.com")
    r = await send_command(ws, "create_tab", {"url": "https://example.com"})
    tab1 = r.get("tab_id")
    check("tab created", tab1 is not None)

    # --- 3. wait_for_load ---
    print("\n3. Wait for load")
    r = await send_command(ws, "wait_for_load", {"tab_id": tab1, "timeout": 10})
    check("loaded successfully", r.get("success") is True)
    check("url is example.com", "example.com" in r.get("url", ""), f"got {r.get('url')}")
    check("title is Example Domain", "Example" in r.get("title", ""), f"got {r.get('title')}")
    check("not loading", r.get("loading") is False, f"loading={r.get('loading')}")

    # --- 4. List tabs (workspace-scoped) ---
    print("\n4. List tabs (workspace-scoped)")
    r = await send_command(ws, "list_tabs")
    check("got tabs list", isinstance(r, list), f"got {type(r)}")
    tab_ids = [t["tab_id"] for t in r]
    check("our tab in list", tab1 in tab_ids, f"tab_ids: {tab_ids}")
    our_tab = next((t for t in r if t["tab_id"] == tab1), None)
    if our_tab:
        check("tab url correct", "example.com" in our_tab.get("url", ""), f"got {our_tab.get('url')}")
        check("tab is active", our_tab.get("active") is True)
    # All tabs should be in ZenLeap AI workspace (no tabs from other workspaces)
    non_agent_urls = [t["url"] for t in r if "example.com" not in t["url"] and t["url"] != "about:blank"]
    check("no unrelated tabs leaked", len(non_agent_urls) == 0, f"non-agent: {non_agent_urls}")

    # --- 5. Create second tab ---
    print("\n5. Create second tab → httpbin.org")
    r = await send_command(ws, "create_tab", {"url": "https://httpbin.org/get"})
    tab2 = r.get("tab_id")
    check("second tab created", tab2 is not None)
    r = await send_command(ws, "wait_for_load", {"tab_id": tab2, "timeout": 10})
    check("second tab loaded", r.get("success") is True)

    # --- 6. List tabs again (should have both) ---
    print("\n6. List tabs (both tabs)")
    r = await send_command(ws, "list_tabs")
    tab_ids = [t["tab_id"] for t in r]
    check("tab1 present", tab1 in tab_ids, f"tab_ids: {tab_ids}")
    check("tab2 present", tab2 in tab_ids, f"tab_ids: {tab_ids}")

    # --- 7. Switch tab ---
    print("\n7. Switch back to tab1")
    r = await send_command(ws, "switch_tab", {"tab_id": tab1})
    check("switch success", r.get("success") is True)
    r = await send_command(ws, "list_tabs")
    active = [t for t in r if t.get("active")]
    check("tab1 is now active", len(active) == 1 and active[0]["tab_id"] == tab1,
          f"active: {[t['tab_id'] for t in active]}")

    # --- 8. wait_for_load on already-loaded page ---
    print("\n8. wait_for_load on already-loaded page (instant)")
    r = await send_command(ws, "wait_for_load", {"tab_id": tab1, "timeout": 2})
    check("instant return", r.get("success") is True)
    check("not loading", r.get("loading") is False)

    # --- 9. Navigate and wait_for_load ---
    print("\n9. Navigate then wait_for_load")
    await send_command(ws, "navigate", {"tab_id": tab1, "url": "https://httpbin.org/html"})
    await send_command(ws, "wait", {"seconds": 0.5})  # small delay for navigation to start
    r = await send_command(ws, "wait_for_load", {"tab_id": tab1, "timeout": 10})
    check("loaded after navigate", r.get("success") is True)
    check("url changed", "httpbin.org" in r.get("url", ""), f"got {r.get('url')}")

    # --- 10. Screenshot ---
    print("\n10. Screenshot")
    r = await send_command(ws, "screenshot", {"tab_id": tab1})
    check("has image", "image" in r and len(r["image"]) > 100)
    check("has width", r.get("width") is not None)
    check("has height", r.get("height") is not None)

    # --- 11. Get DOM ---
    print("\n11. Get DOM")
    r = await send_command(ws, "get_dom", {"tab_id": tab1})
    check("has elements", "elements" in r)
    check("has url", "url" in r)

    # --- 12. Get page text ---
    print("\n12. Get page text")
    r = await send_command(ws, "get_page_text", {"tab_id": tab1})
    check("has text", len(r.get("text", "")) > 0, f"text length: {len(r.get('text', ''))}")

    # --- 13. Tabs don't leak from other workspaces ---
    print("\n13. Verify workspace isolation")
    r = await send_command(ws, "list_tabs")
    # Count should be reasonable (our 2 tabs + possibly 1 default New Tab)
    check("tab count reasonable", len(r) <= 4, f"got {len(r)} tabs: {[t['url'] for t in r]}")

    # --- 14. Close tabs ---
    print("\n14. Close tabs")
    r = await send_command(ws, "close_tab", {"tab_id": tab2})
    check("tab2 closed", r.get("success") is True)
    r = await send_command(ws, "close_tab", {"tab_id": tab1})
    check("tab1 closed", r.get("success") is True)

    # --- 15. List tabs after close ---
    print("\n15. List tabs after close")
    r = await send_command(ws, "list_tabs")
    remaining = [t for t in r if t["tab_id"] in (tab1, tab2)]
    check("closed tabs gone", len(remaining) == 0, f"remaining: {[t['tab_id'] for t in remaining]}")

    # --- Summary ---
    print(f"\n{'='*50}")
    total = PASS + FAIL
    print(f"Results: {PASS}/{total} passed, {FAIL} failed")
    if FAIL == 0:
        print("ALL TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
    await ws.close()
    return FAIL == 0


if __name__ == "__main__":
    ok = asyncio.run(main())
    sys.exit(0 if ok else 1)
