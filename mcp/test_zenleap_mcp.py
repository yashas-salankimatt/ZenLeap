"""Tests for the ZenLeap MCP server.

Covers message formatting, connection management, tool definitions,
and error handling. Uses a mock WebSocket server to simulate the browser.
"""

import asyncio
import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio

from mcp.server.fastmcp.utilities.types import Image

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


# ── Observation Tools (Phase 2) ────────────────────────────────


# Minimal valid 1x1 white PNG (67 bytes)
_TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
    b"\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00"
    b"\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)
_TINY_PNG_B64 = base64.b64encode(_TINY_PNG).decode()
_TINY_DATA_URL = f"data:image/png;base64,{_TINY_PNG_B64}"


class TestScreenshot:
    @pytest.mark.asyncio
    async def test_returns_image(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"image": _TINY_DATA_URL, "width": 1, "height": 1}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_screenshot()
        assert isinstance(result, Image)
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "screenshot"

    @pytest.mark.asyncio
    async def test_sends_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"image": _TINY_DATA_URL, "width": 1, "height": 1}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_screenshot("panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"

    @pytest.mark.asyncio
    async def test_default_tab_id_none(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"image": _TINY_DATA_URL, "width": 1, "height": 1}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_screenshot()
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] is None


class TestGetDom:
    @pytest.mark.asyncio
    async def test_formats_elements(self):
        dom_result = {
            "elements": [
                {
                    "index": 0,
                    "tag": "a",
                    "text": "Click me",
                    "attributes": {"href": "https://example.com"},
                    "rect": {"x": 10, "y": 20, "w": 100, "h": 30},
                },
                {
                    "index": 1,
                    "tag": "button",
                    "text": "Submit",
                    "attributes": {"type": "submit"},
                    "rect": {"x": 50, "y": 100, "w": 80, "h": 40},
                },
            ],
            "url": "https://example.com",
            "title": "Example",
        }
        fake_ws = FakeWebSocket(responses=[{"id": "x", "result": dom_result}])
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_get_dom()
        assert "Page: https://example.com" in result
        assert "Title: Example" in result
        assert '[0] <a href="https://example.com">Click me</a>' in result
        assert '[1] <button type="submit">Submit</button>' in result
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "get_dom"

    @pytest.mark.asyncio
    async def test_empty_elements(self):
        dom_result = {
            "elements": [],
            "url": "about:blank",
            "title": "",
        }
        fake_ws = FakeWebSocket(responses=[{"id": "x", "result": dom_result}])
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_get_dom()
        assert "Page: about:blank" in result
        assert "Interactive elements:" in result

    @pytest.mark.asyncio
    async def test_sends_tab_id(self):
        dom_result = {"elements": [], "url": "", "title": ""}
        fake_ws = FakeWebSocket(responses=[{"id": "x", "result": dom_result}])
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_get_dom("panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"


class TestGetPageText:
    @pytest.mark.asyncio
    async def test_returns_text(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"text": "Hello World"}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_get_page_text()
        assert result == "Hello World"
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "get_page_text"

    @pytest.mark.asyncio
    async def test_empty_text(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"text": ""}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_get_page_text()
        assert result == ""

    @pytest.mark.asyncio
    async def test_sends_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"text": "test"}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_get_page_text("panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"


class TestGetPageHTML:
    @pytest.mark.asyncio
    async def test_returns_html(self):
        html = "<html><body><h1>Hello</h1></body></html>"
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"html": html}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_get_page_html()
        assert result == html
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "get_page_html"

    @pytest.mark.asyncio
    async def test_empty_html(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"html": ""}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_get_page_html()
        assert result == ""

    @pytest.mark.asyncio
    async def test_sends_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"html": "<html></html>"}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_get_page_html("panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"


# ── Interaction Tools (Phase 3) ─────────────────────────────────


class TestClick:
    @pytest.mark.asyncio
    async def test_click_element(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "tag": "button", "text": "Submit"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_click(0)
        data = json.loads(result)
        assert data["success"] is True
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "click_element"
        assert msg["params"]["index"] == 0

    @pytest.mark.asyncio
    async def test_click_with_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "tag": "a", "text": "Link"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_click(3, "panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"
        assert msg["params"]["index"] == 3

    @pytest.mark.asyncio
    async def test_click_coordinates(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "tag": "div", "text": ""}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_click_coordinates(100, 200)
        data = json.loads(result)
        assert data["success"] is True
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "click_coordinates"
        assert msg["params"]["x"] == 100
        assert msg["params"]["y"] == 200


class TestFill:
    @pytest.mark.asyncio
    async def test_fill_field(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "tag": "input", "value": "hello"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_fill(2, "hello")
        data = json.loads(result)
        assert data["success"] is True
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "fill_field"
        assert msg["params"]["index"] == 2
        assert msg["params"]["value"] == "hello"

    @pytest.mark.asyncio
    async def test_fill_with_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "tag": "textarea", "value": "text"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_fill(1, "text", "panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"

    @pytest.mark.asyncio
    async def test_select_option(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "value": "opt2"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_select_option(5, "opt2")
        data = json.loads(result)
        assert data["success"] is True
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "select_option"
        assert msg["params"]["index"] == 5
        assert msg["params"]["value"] == "opt2"


class TestType:
    @pytest.mark.asyncio
    async def test_type_text(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "length": 5}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_type("hello")
        data = json.loads(result)
        assert data["success"] is True
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "type_text"
        assert msg["params"]["text"] == "hello"

    @pytest.mark.asyncio
    async def test_press_key(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "key": "Enter"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_press_key("Enter")
        data = json.loads(result)
        assert data["key"] == "Enter"
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "press_key"
        assert msg["params"]["key"] == "Enter"

    @pytest.mark.asyncio
    async def test_press_key_with_modifiers(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "key": "a"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_press_key("a", ctrl=True, shift=True)
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["modifiers"]["ctrl"] is True
        assert msg["params"]["modifiers"]["shift"] is True
        assert msg["params"]["modifiers"]["alt"] is False
        assert msg["params"]["modifiers"]["meta"] is False


class TestScroll:
    @pytest.mark.asyncio
    async def test_scroll_default(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "scrollX": 0, "scrollY": 500}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_scroll()
        data = json.loads(result)
        assert data["scrollY"] == 500
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "scroll"
        assert msg["params"]["direction"] == "down"
        assert msg["params"]["amount"] == 500

    @pytest.mark.asyncio
    async def test_scroll_up(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "scrollX": 0, "scrollY": 0}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_scroll("up", 300)
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["direction"] == "up"
        assert msg["params"]["amount"] == 300


class TestHover:
    @pytest.mark.asyncio
    async def test_hover(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "tag": "a", "text": "Link"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_hover(1)
        data = json.loads(result)
        assert data["success"] is True
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "hover"
        assert msg["params"]["index"] == 1

    @pytest.mark.asyncio
    async def test_hover_with_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[
                {"id": "x", "result": {"success": True, "tag": "button", "text": "Menu"}}
            ]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_hover(0, "panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"
        assert msg["params"]["index"] == 0


# ── Console / Eval (Phase 4) ────────────────────────────────────


class TestConsoleSetup:
    @pytest.mark.asyncio
    async def test_setup(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"success": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_console_setup()
        data = json.loads(result)
        assert data["success"] is True
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "console_setup"

    @pytest.mark.asyncio
    async def test_setup_with_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"success": True}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_console_setup("panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"


class TestConsoleLogs:
    @pytest.mark.asyncio
    async def test_formats_logs(self):
        logs = [
            {"level": "log", "message": "hello world", "timestamp": "2025-01-01T00:00:00.000Z"},
            {"level": "warn", "message": "be careful", "timestamp": "2025-01-01T00:00:01.000Z"},
        ]
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"logs": logs}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_console_logs()
        assert "[log]" in result
        assert "hello world" in result
        assert "[warn]" in result
        assert "be careful" in result
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "console_get_logs"

    @pytest.mark.asyncio
    async def test_empty_logs(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"logs": []}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_console_logs()
        assert "no console logs" in result.lower()

    @pytest.mark.asyncio
    async def test_sends_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"logs": []}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_console_logs("panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"


class TestConsoleErrors:
    @pytest.mark.asyncio
    async def test_formats_errors(self):
        errors = [
            {
                "type": "uncaught_error",
                "message": "x is not defined",
                "filename": "script.js",
                "lineno": 42,
                "stack": "ReferenceError: x is not defined\n    at script.js:42",
                "timestamp": "2025-01-01T00:00:00.000Z",
            },
        ]
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"errors": errors}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_console_errors()
        assert "[uncaught_error]" in result
        assert "x is not defined" in result
        assert "script.js:42" in result

    @pytest.mark.asyncio
    async def test_empty_errors(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"errors": []}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_console_errors()
        assert "no errors" in result.lower()

    @pytest.mark.asyncio
    async def test_sends_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"errors": []}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_console_errors("panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"


class TestConsoleEval:
    @pytest.mark.asyncio
    async def test_eval_success(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"result": "2"}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_console_eval("1+1")
        assert result == "2"
        msg = json.loads(fake_ws.sent[0])
        assert msg["method"] == "console_evaluate"
        assert msg["params"]["expression"] == "1+1"

    @pytest.mark.asyncio
    async def test_eval_error(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"error": "x is not defined", "stack": "ReferenceError..."}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_console_eval("x.y.z")
        assert "Error:" in result
        assert "x is not defined" in result

    @pytest.mark.asyncio
    async def test_eval_with_tab_id(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"result": "hello"}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            await server.browser_console_eval("'hello'", "panel1")
        msg = json.loads(fake_ws.sent[0])
        assert msg["params"]["tab_id"] == "panel1"
        assert msg["params"]["expression"] == "'hello'"

    @pytest.mark.asyncio
    async def test_eval_returns_string(self):
        fake_ws = FakeWebSocket(
            responses=[{"id": "x", "result": {"result": "Example Domain"}}]
        )
        with patch.object(server, "get_ws", return_value=fake_ws):
            result = await server.browser_console_eval("document.title")
        assert result == "Example Domain"


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
