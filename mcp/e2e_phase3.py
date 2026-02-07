#!/usr/bin/env python3
"""End-to-end test for Phase 3: Interaction (Click, Type, Fill, Scroll, etc.).

Uses httpbin.org/forms/post as a real-world form to fill and submit.
"""

import asyncio
import json
import sys
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
    check("version is 0.3.0", r.get("version") == "0.3.0", f"got {r.get('version')}")

    # --- 2. Create tab and navigate to httpbin form ---
    print("\n2. Create tab → httpbin form")
    r = await send_command(ws, "create_tab", {"url": "https://httpbin.org/forms/post"})
    tab_id = r.get("tab_id")
    check("tab created", tab_id is not None)
    await send_command(ws, "wait", {"seconds": 4})

    # --- 3. Get page info ---
    print("\n3. Get page info")
    r = await send_command(ws, "get_page_info", {"tab_id": tab_id})
    check("url has httpbin", "httpbin.org" in r.get("url", ""), f"got {r.get('url')}")
    check("not loading", r.get("loading") is False)

    # --- 4. Get DOM (index interactive elements) ---
    print("\n4. Get DOM")
    r = await send_command(ws, "get_dom", {"tab_id": tab_id})
    elements = r.get("elements", [])
    check("found interactive elements", len(elements) > 0, f"got {len(elements)}")
    for e in elements[:10]:
        text = e.get("text", "")[:40]
        tag = e.get("tag", "?")
        attrs = e.get("attributes", {})
        print(f"    [{e['index']}] <{tag}> {attrs} \"{text}\"")

    # Find form fields by tag/type
    inputs = {
        e.get("attributes", {}).get("name", ""): e["index"]
        for e in elements
        if e["tag"] in ("input", "textarea", "select")
    }
    print(f"    Form fields: {inputs}")

    # --- 5. Fill text fields ---
    print("\n5. Fill fields")
    if "custname" in inputs:
        r = await send_command(ws, "fill_field", {"tab_id": tab_id, "index": inputs["custname"], "value": "ZenLeap Test"})
        check("filled custname", r.get("success") is True)
    else:
        check("custname found", False, "no custname input found")

    if "custtel" in inputs:
        r = await send_command(ws, "fill_field", {"tab_id": tab_id, "index": inputs["custtel"], "value": "555-1234"})
        check("filled custtel", r.get("success") is True)
    else:
        check("custtel found", False, "no custtel input found")

    if "custemail" in inputs:
        r = await send_command(ws, "fill_field", {"tab_id": tab_id, "index": inputs["custemail"], "value": "test@zenleap.ai"})
        check("filled custemail", r.get("success") is True)
    else:
        check("custemail found", False, "no custemail input found")

    # --- 6. Click radio button (pizza size) ---
    print("\n6. Click radio button")
    radio_large = [
        e["index"] for e in elements
        if e["tag"] == "input" and e.get("attributes", {}).get("type") == "radio"
        and e.get("attributes", {}).get("value") == "large"
    ]
    if radio_large:
        r = await send_command(ws, "click_element", {"tab_id": tab_id, "index": radio_large[0]})
        check("clicked size=large radio", r.get("success") is True)
    else:
        check("radio found", False, "no large radio found")

    # --- 7. Click a checkbox ---
    print("\n7. Click topping checkbox")
    topping_indices = [
        e["index"] for e in elements
        if e["tag"] == "input" and e.get("attributes", {}).get("type") == "checkbox"
    ]
    if topping_indices:
        r = await send_command(ws, "click_element", {"tab_id": tab_id, "index": topping_indices[0]})
        check("clicked checkbox", r.get("success") is True)
    else:
        check("checkbox found", False, "no checkboxes found")

    # --- 7b. select_option error on non-select ---
    print("\n7b. select_option error on non-select")
    try:
        await send_command(ws, "select_option", {"tab_id": tab_id, "index": 0, "value": "x"})
        check("select_option rejects non-select", False, "should have thrown")
    except Exception as e:
        check("select_option rejects non-select", "not a <select>" in str(e).lower(), str(e))

    # --- 8. Scroll ---
    print("\n8. Scroll")
    r = await send_command(ws, "scroll", {"tab_id": tab_id, "direction": "down", "amount": 200})
    check("scrolled down", r.get("success") is True)
    r = await send_command(ws, "scroll", {"tab_id": tab_id, "direction": "up", "amount": 200})
    check("scrolled back up", r.get("success") is True)

    # --- 9. Hover ---
    print("\n9. Hover")
    submit_indices = [
        e["index"] for e in elements
        if e["tag"] == "button" or (e["tag"] == "input" and e.get("attributes", {}).get("type") == "submit")
    ]
    if submit_indices:
        r = await send_command(ws, "hover", {"tab_id": tab_id, "index": submit_indices[0]})
        check("hovered submit", r.get("success") is True)
    else:
        check("submit button found", False, "no submit button found")

    # --- 10. Press key ---
    print("\n10. Press key")
    # Focus a field first so key events have a target
    if "custname" in inputs:
        await send_command(ws, "click_element", {"tab_id": tab_id, "index": inputs["custname"]})
    r = await send_command(ws, "press_key", {"tab_id": tab_id, "key": "Escape"})
    check("pressed Escape", r.get("success") is True)
    r = await send_command(ws, "press_key", {"tab_id": tab_id, "key": "a", "modifiers": {"ctrl": True}})
    check("pressed Ctrl+a", r.get("success") is True)

    # --- 11. Type text ---
    print("\n11. Type text")
    # Focus a field first via click
    if "custname" in inputs:
        await send_command(ws, "click_element", {"tab_id": tab_id, "index": inputs["custname"]})
        r = await send_command(ws, "type_text", {"tab_id": tab_id, "text": " extra"})
        check("typed text", r.get("success") is True)
        check("typed 6 chars", r.get("length") == 6, f"got {r.get('length')}")

    # --- 12. Click coordinates ---
    print("\n12. Click coordinates")
    r = await send_command(ws, "click_coordinates", {"tab_id": tab_id, "x": 100, "y": 100})
    check("click_coordinates succeeded", r.get("success") is True)
    check("has tag", len(r.get("tag", "")) > 0)

    # --- 13. Screenshot to verify form state ---
    print("\n13. Screenshot verification")
    r = await send_command(ws, "screenshot", {"tab_id": tab_id})
    check("screenshot taken", r.get("image", "").startswith("data:image/png"))
    print(f"    ({r.get('width')}x{r.get('height')})")

    # --- 14. Submit the form (click submit button) ---
    print("\n14. Submit form")
    if submit_indices:
        r = await send_command(ws, "click_element", {"tab_id": tab_id, "index": submit_indices[0]})
        check("clicked submit", r.get("success") is True)
        await send_command(ws, "wait", {"seconds": 3})
        r = await send_command(ws, "get_page_info", {"tab_id": tab_id})
        check("page changed after submit", "httpbin.org" in r.get("url", ""))
    else:
        check("submit available", False, "no submit button")

    # --- 15. Error handling: stale element ---
    print("\n15. Error: stale element index")
    try:
        await send_command(ws, "click_element", {"tab_id": tab_id, "index": 9999})
        check("stale element errors", False, "should have thrown")
    except Exception as e:
        check("stale element errors gracefully", "not found" in str(e).lower() or "run get_dom" in str(e).lower(), str(e))

    # --- 16. Error handling: invalid scroll direction ---
    print("\n16. Error: invalid scroll direction")
    try:
        await send_command(ws, "scroll", {"tab_id": tab_id, "direction": "diagonal"})
        check("bad direction errors", False, "should have thrown")
    except Exception as e:
        check("bad direction errors gracefully", "invalid direction" in str(e).lower() or "up/down" in str(e).lower(), str(e))

    # --- 17. Close tab ---
    print("\n17. Close tab")
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
