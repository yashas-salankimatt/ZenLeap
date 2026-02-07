"""Phase 6 feature benchmark scenarios.

Tests: wait_for_element, wait_for_text, navigation error detection,
iframe listing, dialog handling.
"""

from __future__ import annotations

from typing import Any

from bench.scenario import BrowserStateCheck, Scenario, ScenarioCategory


# --- Verification functions ---


async def verify_tab_exists(state: dict[str, Any]) -> bool:
    """Verify at least one non-blank tab exists."""
    tabs = state.get("tabs", [])
    return any(t.get("url", "") != "about:blank" for t in tabs)


async def verify_page_loaded(state: dict[str, Any]) -> bool:
    """Verify a page title is present."""
    info = state.get("active_page_info", {})
    return bool(info.get("title"))


PHASE6_SCENARIOS = [
    # --- 6.3: wait_for_element / wait_for_text ---
    Scenario(
        id="p6-001",
        name="Wait for element on a slow-loading page",
        category=ScenarioCategory.NAVIGATION,
        prompt=(
            "Open https://httpbin.org/delay/2 in a new tab. "
            "Use browser_wait_for_element with selector 'pre' and timeout 10 "
            "to wait for the JSON response body to appear. "
            "Then get the page text and tell me what it says."
        ),
        verifications=[
            BrowserStateCheck("tab exists", verify_tab_exists),
            BrowserStateCheck("page loaded", verify_page_loaded),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_wait_for_element",
            "mcp__zenleap-browser__browser_get_page_text",
        ],
        max_turns=12,
        max_budget_usd=0.30,
        difficulty="easy",
        tags=["smoke", "phase6", "wait"],
    ),
    Scenario(
        id="p6-002",
        name="Wait for specific text on page",
        category=ScenarioCategory.NAVIGATION,
        prompt=(
            "Open https://example.com in a new tab. "
            "Use browser_wait_for_text with text 'Example Domain' and timeout 10 "
            "to confirm the page content has loaded. "
            "Then tell me the result."
        ),
        verifications=[
            BrowserStateCheck("tab exists", verify_tab_exists),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_wait_for_text",
        ],
        max_turns=10,
        max_budget_usd=0.15,
        difficulty="easy",
        tags=["smoke", "phase6", "wait"],
    ),
    # --- 6.4: Navigation error detection ---
    Scenario(
        id="p6-003",
        name="Detect navigation status after load",
        category=ScenarioCategory.NAVIGATION,
        prompt=(
            "Open https://httpbin.org/status/200 in a new tab, wait for load, "
            "then use browser_get_navigation_status to check the HTTP status. "
            "Tell me the status code."
        ),
        verifications=[
            BrowserStateCheck("tab exists", verify_tab_exists),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_wait_for_load",
            "mcp__zenleap-browser__browser_get_navigation_status",
        ],
        max_turns=10,
        max_budget_usd=0.20,
        difficulty="easy",
        tags=["smoke", "phase6", "navigation"],
    ),
    # --- 6.2: iframe listing ---
    Scenario(
        id="p6-004",
        name="List frames on a page with iframes",
        category=ScenarioCategory.INFORMATION_EXTRACTION,
        prompt=(
            "Open https://www.w3schools.com/html/html_iframe.asp in a new tab, "
            "wait for it to load. Then use browser_list_frames to list all frames. "
            "Tell me how many frames you found and their URLs."
        ),
        verifications=[
            BrowserStateCheck("tab exists", verify_tab_exists),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_wait_for_load",
            "mcp__zenleap-browser__browser_list_frames",
        ],
        max_turns=12,
        max_budget_usd=0.25,
        difficulty="medium",
        tags=["smoke", "phase6", "iframe"],
    ),
]
