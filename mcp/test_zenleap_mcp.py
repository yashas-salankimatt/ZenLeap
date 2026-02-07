"""Tests for the ZenLeap MCP server.

Covers message formatting, connection management, tool definitions,
and error handling. Uses a mock WebSocket server to simulate the browser.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio

import zenleap_mcp_server as server


# ── Helpers ─────────────────────────────────────────────────────


class FakeWebSocket:
    """Simulates a websockets connection for testing."""

    def __init__(self, responses=None):
        self.sent = []
        self._responses = responses or []
        self._response_idx = 0
        self.closed = False

    async def send(self, data):
        self.sent.append(data)

    async def recv(self):
        if self._response_idx < len(self._responses):
            resp = self._responses[self._response_idx]
            self._response_idx += 1
            return json.dumps(resp) if isinstance(resp, dict) else resp
        raise asyncio.TimeoutError("No more responses")

    async def ping(self):
        if self.closed:
            raise ConnectionError("closed")

    async def close(self):
        self.closed = True


# ── text_result ─────────────────────────────────────────────────


class TestTextResult:
    def test_dict(self):
        result = server.text_result({"key": "value"})
        assert json.loads(result) == {"key": "value"}

    def test_list(self):
        result = server.text_result([1, 2, 3])
        assert json.loads(result) == [1, 2, 3]

    def test_string(self):
        assert server.text_result("hello") == "hello"

    def test_number(self):
        assert server.text_result(42) == "42"

    def test_nested(self):
        data = {"tabs": [{"id": "1", "title": "Test"}]}
        result = server.text_result(data)
        assert json.loads(result) == data


# ── browser_command ─────────────────────────────────────────────


class TestBrowserCommand:
    @pytest.mark.asyncio
    async def test_sends_correct_format(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "ignored", "result": {"ok": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_command("ping", {"foo": "bar"})

        assert len(fake_ws.sent) == 1
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "ping"
        assert msg["params"] == {"foo": "bar"}
        assert "id" in msg
        assert result == {"ok": True}

    @pytest.mark.asyncio
    async def test_default_empty_params(self):
        fake_ws = FakeWebSocket(responses=[{"id": "x", "result": {}}])
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_command("list_tabs")

        msg = json.loads(fake_ws.sent[0])
        assert msg["params"] == {}

    @pytest.mark.asyncio
    async def test_raises_on_error_response(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "error": {"message": "Tab not found"}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            with pytest.raises(Exception, match="Tab not found"):
                await server.browser_command("close_tab", {"tab_id": "bad"})

    @pytest.mark.asyncio
    async def test_raises_on_timeout(self):
        fake_ws = FakeWebSocket(responses=[])  # no responses -> timeout
        with patch.object(server, "get_ws", return_value=fake_ws):
            with pytest.raises(asyncio.TimeoutError):
                await server.browser_command("ping")

    @pytest.mark.asyncio
    async def test_returns_empty_dict_when_no_result_key(self):
        fake_ws = FakeWebSocket(responses=[{"id": "x"}])
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_command("ping")
        assert result == {}


# ── get_ws ──────────────────────────────────────────────────────


class TestGetWs:
    @pytest.mark.asyncio
    async def test_creates_new_connection(self):
        server._ws_connection = None
        fake_ws = FakeWebSocket()
        with patch("websockets.connect", new_callable=AsyncMock, return_value=fake_ws):
            ws = await server.get_ws()
        assert ws is fake_ws

    @pytest.mark.asyncio
    async def test_reuses_existing_connection(self):
        fake_ws = FakeWebSocket()
        server._ws_connection = fake_ws
        ws = await server.get_ws()
        assert ws is fake_ws
        server._ws_connection = None

    @pytest.mark.asyncio
    async def test_reconnects_on_dead_connection(self):
        dead_ws = FakeWebSocket()
        dead_ws.closed = True
        server._ws_connection = dead_ws

        new_ws = FakeWebSocket()
        with patch("websockets.connect", new_callable=AsyncMock, return_value=new_ws):
            ws = await server.get_ws()
        assert ws is new_ws
        server._ws_connection = None


# ── Tool Definitions ────────────────────────────────────────────


class TestToolDefinitions:
    """Verify all expected tools are registered and callable."""

    @pytest.mark.asyncio
    async def test_create_tab(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"tab_id": "panel1", "url": "https://example.com"}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_create_tab("https://example.com")
        data = json.loads(result)
        assert data["tab_id"] == "panel1"
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "create_tab"
        assert msg["params"]["url"] == "https://example.com"

    @pytest.mark.asyncio
    async def test_close_tab_default(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"success": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_close_tab()
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] is None

    @pytest.mark.asyncio
    async def test_list_tabs(self):
        tabs = [
            {"tab_id": "p1", "title": "Tab 1", "url": "https://a.com", "active": True},
            {"tab_id": "p2", "title": "Tab 2", "url": "https://b.com", "active": False},
        ]
        fake_ws = FakeWebSocket(responses=[{"id": "x", "result": tabs}])
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_list_tabs()
        data = json.loads(result)
        assert len(data) == 2
        assert data[0]["active"] is True

    @pytest.mark.asyncio
    async def test_navigate(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"success": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_navigate("https://example.com")
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "navigate"
        assert msg["params"]["url"] == "https://example.com"

    @pytest.mark.asyncio
    async def test_go_back(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"success": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_go_back()
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "go_back"

    @pytest.mark.asyncio
    async def test_go_forward(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"success": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_go_forward()
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "go_forward"

    @pytest.mark.asyncio
    async def test_reload(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"success": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_reload()
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "reload"

    @pytest.mark.asyncio
    async def test_get_page_info(self):
        info = {
            "url": "https://example.com",
            "title": "Example",
            "loading": False,
            "can_go_back": True,
            "can_go_forward": False,
        }
        fake_ws = FakeWebSocket(responses=[{"id": "x", "result": info}])
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_get_page_info()
        data = json.loads(result)
        assert data["title"] == "Example"

    @pytest.mark.asyncio
    async def test_wait(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"success": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_wait(0.1)
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["seconds"] == 0.1


# ── Error Paths ─────────────────────────────────────────────────


class TestErrorPaths:
    @pytest.mark.asyncio
    async def test_connection_refused(self):
        server._ws_connection = None
        with patch(
            "websockets.connect",
            new_callable=AsyncMock,
            side_effect=ConnectionRefusedError("refused"),
        ):
            with pytest.raises(ConnectionRefusedError):
                await server.get_ws()
        server._ws_connection = None

    @pytest.mark.asyncio
    async def test_error_response_unknown_message(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "error": {"code": -1}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            with pytest.raises(Exception, match="Unknown browser error"):
                await server.browser_command("bad_method")
