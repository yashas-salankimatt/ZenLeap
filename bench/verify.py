"""Browser state verification via WebSocket connection."""

from __future__ import annotations

import asyncio
import json
from typing import Any
from uuid import uuid4

import websockets

WS_URL = "ws://localhost:9876"

MAX_RECV_ATTEMPTS = 10


class BrowserVerifier:
    """Connects to the browser WebSocket to verify state after scenarios."""

    def __init__(self, ws_url: str = WS_URL):
        self.ws_url = ws_url
        self._ws: websockets.WebSocketClientProtocol | None = None

    async def _get_ws(self):
        if self._ws is None:
            self._ws = await websockets.connect(
                self.ws_url, max_size=10 * 1024 * 1024
            )
        return self._ws

    async def _reconnect(self):
        """Drop cached connection and reconnect."""
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        return await self._get_ws()

    async def _send_command(
        self, method: str, params: dict | None = None, timeout: int = 15
    ) -> dict:
        for retry in range(2):
            try:
                ws = await self._get_ws()
                msg_id = str(uuid4())
                msg = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(msg))

                # Read responses until we get the matching ID
                for _ in range(MAX_RECV_ATTEMPTS):
                    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
                    resp = json.loads(raw)
                    if resp.get("id") == msg_id:
                        if "error" in resp:
                            raise Exception(
                                f"{method} error: {resp['error'].get('message', resp['error'])}"
                            )
                        return resp.get("result", {})

                raise Exception(f"{method}: no matching response after {MAX_RECV_ATTEMPTS} messages")
            except websockets.exceptions.ConnectionClosed:
                if retry == 0:
                    await self._reconnect()
                    continue
                raise
        raise Exception(f"{method}: failed after reconnect")

    async def capture_state(self) -> dict[str, Any]:
        """Capture full browser state for verification."""
        state: dict[str, Any] = {}

        # List tabs
        state["tabs"] = await self._send_command("list_tabs")

        # Get active tab info
        try:
            state["active_page_info"] = await self._send_command("get_page_info")
        except Exception:
            state["active_page_info"] = {}

        # Get active tab DOM
        try:
            dom_result = await self._send_command("get_dom")
            state["dom_elements"] = dom_result.get("elements", [])
        except Exception:
            state["dom_elements"] = []

        # Get page text
        try:
            text_result = await self._send_command("get_page_text")
            state["page_text"] = text_result.get("text", "")
        except Exception:
            state["page_text"] = ""

        return state

    async def cleanup_tabs(self):
        """Close all tabs in the agent workspace (cleanup between scenarios)."""
        try:
            tabs = await self._send_command("list_tabs")
        except Exception:
            return
        for tab in tabs:
            if tab.get("url") != "about:blank":
                try:
                    await self._send_command(
                        "close_tab", {"tab_id": tab["tab_id"]}
                    )
                except Exception:
                    pass

    async def close(self):
        """Close the WebSocket connection."""
        if self._ws:
            await self._ws.close()
            self._ws = None
