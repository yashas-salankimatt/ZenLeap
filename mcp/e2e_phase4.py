#!/usr/bin/env python3
"""End-to-end test for Phase 4: Developer Console (JS Eval, Console Logs, Error Capture)."""

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
    check("version is 0.5.0", r.get("version") == "0.5.0", f"got {r.get('version')}")

    # --- 2. Create tab ---
    print("\n2. Create tab → example.com")
    r = await send_command(ws, "create_tab", {"url": "https://example.com"})
    tab_id = r.get("tab_id")
    check("tab created", tab_id is not None)
    await send_command(ws, "wait", {"seconds": 3})

    # --- 3. Setup console capture ---
    print("\n3. Setup console capture")
    r = await send_command(ws, "console_setup", {"tab_id": tab_id})
    check("capture setup", r.get("success") is True)

    # --- 4. Setup again (idempotent) ---
    print("\n4. Setup again (idempotent)")
    r = await send_command(ws, "console_setup", {"tab_id": tab_id})
    check("already setup", r.get("success") is True)

    # --- 5. Eval simple expression ---
    print("\n5. Eval: 1 + 1")
    r = await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "1 + 1"})
    check("result is 2", r.get("result") == "2", f"got {r.get('result')}")

    # --- 6. Eval document.title ---
    print("\n6. Eval: document.title")
    r = await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "document.title"})
    check("got title", "Example" in str(r.get("result", "")), f"got {r.get('result')}")

    # --- 7. Eval that triggers console.log ---
    print("\n7. Eval: console.log('zenleap-test-msg')")
    r = await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "console.log('zenleap-test-msg'); 'logged'"})
    check("eval returned", r.get("result") == "logged", f"got {r.get('result')}")

    # --- 8. Get console logs ---
    print("\n8. Get console logs")
    r = await send_command(ws, "console_get_logs", {"tab_id": tab_id})
    logs = r.get("logs", [])
    check("has logs", len(logs) > 0, f"got {len(logs)}")
    found = any("zenleap-test-msg" in log.get("message", "") for log in logs)
    check("contains our message", found, f"logs: {[l.get('message') for l in logs]}")
    if logs:
        log = logs[-1]
        check("log has level", "level" in log)
        check("log has timestamp", "timestamp" in log)
        check("log has message", "message" in log)
        print(f"    Last log: [{log.get('level')}] {log.get('message')}")

    # --- 9. Eval that triggers console.warn ---
    print("\n9. Eval: console.warn('zenleap-warn')")
    await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "console.warn('zenleap-warn')"})
    r = await send_command(ws, "console_get_logs", {"tab_id": tab_id})
    logs = r.get("logs", [])
    warn_found = any(l.get("level") == "warn" and "zenleap-warn" in l.get("message", "") for l in logs)
    check("warn captured", warn_found)

    # --- 10. Eval that triggers console.error ---
    print("\n10. Eval: console.error('zenleap-err')")
    await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "console.error('zenleap-err')"})
    r = await send_command(ws, "console_get_errors", {"tab_id": tab_id})
    errors = r.get("errors", [])
    err_found = any("zenleap-err" in e.get("message", "") for e in errors)
    check("console.error captured in errors", err_found, f"errors: {[e.get('message') for e in errors]}")

    # --- 11. Eval with error ---
    print("\n11. Eval: x.y.z (ReferenceError)")
    r = await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "x.y.z"})
    check("has error", "error" in r, f"got {r}")
    check("error message", "not defined" in r.get("error", "").lower() or "is not defined" in r.get("error", "").lower(), f"got {r.get('error')}")
    print(f"    Error: {r.get('error')}")

    # --- 12. Eval object ---
    print("\n12. Eval: {a:1, b:'hello'}")
    r = await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "({a:1, b:'hello'})"})
    check("got result", "result" in r)
    result_str = r.get("result", "")
    check("result has a:1", "1" in result_str and "hello" in result_str, f"got {result_str}")

    # --- 13. Eval DOM manipulation ---
    print("\n13. Eval: document.querySelectorAll('a').length")
    r = await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "document.querySelectorAll('a').length"})
    check("got count", r.get("result") is not None, f"got {r}")
    print(f"    Links on page: {r.get('result')}")

    # --- 14. Trigger uncaught error via eval ---
    print("\n14. Eval: setTimeout throw (uncaught error)")
    await send_command(ws, "console_evaluate", {"tab_id": tab_id, "expression": "setTimeout(() => { throw new Error('zenleap-uncaught') }, 0)"})
    await send_command(ws, "wait", {"seconds": 1})
    r = await send_command(ws, "console_get_errors", {"tab_id": tab_id})
    errors = r.get("errors", [])
    uncaught = any(e.get("type") == "uncaught_error" and "zenleap-uncaught" in e.get("message", "") for e in errors)
    check("uncaught error captured", uncaught, f"errors: {[e.get('type') + ': ' + e.get('message', '') for e in errors]}")

    # --- 15. Empty logs/errors before setup on new tab ---
    print("\n15. Console logs without setup (empty)")
    r2 = await send_command(ws, "create_tab", {"url": "https://example.com"})
    tab2 = r2.get("tab_id")
    await send_command(ws, "wait", {"seconds": 2})
    r = await send_command(ws, "console_get_logs", {"tab_id": tab2})
    check("empty logs without setup", len(r.get("logs", [])) == 0)
    await send_command(ws, "close_tab", {"tab_id": tab2})

    # --- 16. Close tab ---
    print("\n16. Close tab")
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
