#!/usr/bin/env python3
"""End-to-end test for Phase 2: Observation (Screenshots + DOM)."""

import asyncio
import base64
import json
import sys
import time
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
    check("version is 0.2.0", r.get("version") == "0.2.0", f"got {r.get('version')}")

    # --- 2. Create tab ---
    print("\n2. Create tab")
    r = await send_command(ws, "create_tab", {"url": "https://example.com"})
    tab_id = r.get("tab_id")
    check("tab_id returned", tab_id is not None)
    check("url returned", r.get("url") == "https://example.com")

    # --- 3. Wait for page load ---
    print("\n3. Wait for page load")
    await send_command(ws, "wait", {"seconds": 3})
    check("wait completed", True)

    # --- 4. Get page info ---
    print("\n4. Get page info")
    r = await send_command(ws, "get_page_info", {"tab_id": tab_id})
    check("has URL", "example.com" in r.get("url", ""), f"got {r.get('url')}")
    check("has title", len(r.get("title", "")) > 0, f"got '{r.get('title')}'")
    check("not loading", r.get("loading") is False)

    # --- 5. Screenshot ---
    print("\n5. Screenshot")
    r = await send_command(ws, "screenshot", {"tab_id": tab_id})
    image = r.get("image", "")
    check("image is data URL", image.startswith("data:image/png;base64,"), f"starts with: {image[:40]}")
    check("has width", isinstance(r.get("width"), int) and r["width"] > 0, f"width={r.get('width')}")
    check("has height", isinstance(r.get("height"), int) and r["height"] > 0, f"height={r.get('height')}")
    check("width <= 1568", r.get("width", 9999) <= 1568, f"width={r.get('width')}")
    # Verify it's valid base64 PNG
    b64 = image.split(",", 1)[1] if "," in image else image
    raw = base64.b64decode(b64)
    check("valid PNG header", raw[:4] == b"\x89PNG", f"got {raw[:4]}")
    check("image size reasonable", len(raw) > 1000, f"got {len(raw)} bytes")
    print(f"    (screenshot: {len(raw)} bytes, {r.get('width')}x{r.get('height')})")

    # --- 6. Get DOM ---
    print("\n6. Get DOM")
    r = await send_command(ws, "get_dom", {"tab_id": tab_id})
    check("has elements list", isinstance(r.get("elements"), list))
    check("has url", "example.com" in r.get("url", ""), f"got {r.get('url')}")
    check("has title", len(r.get("title", "")) > 0, f"got '{r.get('title')}'")
    elements = r.get("elements", [])
    check("found interactive elements", len(elements) > 0, f"got {len(elements)}")
    if elements:
        el = elements[0]
        check("element has index", "index" in el)
        check("element has tag", "tag" in el)
        check("element has rect", "rect" in el)
        print(f"    ({len(elements)} interactive elements found)")
        for e in elements[:5]:
            text = e.get("text", "")[:50]
            tag = e.get("tag", "?")
            attrs = e.get("attributes", {})
            print(f"    [{e['index']}] <{tag}> {attrs} \"{text}\"")

    # --- 7. Get page text ---
    print("\n7. Get page text")
    r = await send_command(ws, "get_page_text", {"tab_id": tab_id})
    text = r.get("text", "")
    check("has text content", len(text) > 0, f"got {len(text)} chars")
    check("contains 'Example Domain'", "Example Domain" in text, f"text starts with: {text[:80]}")
    print(f"    ({len(text)} chars)")
    for line in text.split("\n")[:5]:
        if line.strip():
            print(f"    > {line.strip()[:80]}")

    # --- 8. Get page HTML ---
    print("\n8. Get page HTML")
    r = await send_command(ws, "get_page_html", {"tab_id": tab_id})
    html = r.get("html", "")
    check("has HTML content", len(html) > 0, f"got {len(html)} chars")
    check("starts with <html", html.strip().lower().startswith("<html") or html.strip().lower().startswith("<!doctype"), f"starts with: {html[:40]}")
    check("contains <body", "<body" in html.lower())
    check("contains example.com content", "Example Domain" in html)
    print(f"    ({len(html)} chars)")

    # --- 9. Test error handling: about:blank tab ---
    print("\n9. Error handling: about:blank")
    r2 = await send_command(ws, "create_tab", {"url": "about:blank"})
    blank_tab = r2.get("tab_id")
    await send_command(ws, "wait", {"seconds": 1})
    try:
        await send_command(ws, "get_dom", {"tab_id": blank_tab})
        check("about:blank get_dom errors", False, "should have thrown")
    except Exception as e:
        check("about:blank get_dom errors gracefully", "not supported" in str(e).lower() or "cannot access" in str(e).lower(), str(e))
    # Clean up blank tab
    await send_command(ws, "close_tab", {"tab_id": blank_tab})

    # --- 10. Close tab ---
    print("\n10. Close tab")
    r = await send_command(ws, "close_tab", {"tab_id": tab_id})
    check("tab closed", r.get("success") is True)

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
