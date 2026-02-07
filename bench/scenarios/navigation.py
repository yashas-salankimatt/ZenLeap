"""Navigation benchmark scenarios."""

from __future__ import annotations

from typing import Any

from bench.scenario import BrowserStateCheck, Scenario, ScenarioCategory


# --- Verification functions ---


async def verify_tab_with_url(state: dict[str, Any], url_fragment: str) -> bool:
    """Verify that a tab with the given URL fragment exists."""
    tabs = state.get("tabs", [])
    return any(url_fragment in t.get("url", "") for t in tabs)


async def verify_example_com(state: dict[str, Any]) -> bool:
    return await verify_tab_with_url(state, "example.com")


async def verify_httpbin(state: dict[str, Any]) -> bool:
    return await verify_tab_with_url(state, "httpbin.org")


async def verify_page_title_contains(
    state: dict[str, Any], text: str
) -> bool:
    info = state.get("active_page_info", {})
    return text in info.get("title", "")


async def verify_page_text_contains(
    state: dict[str, Any], text: str
) -> bool:
    return text in state.get("page_text", "")


async def verify_tab_count_at_least(
    state: dict[str, Any], count: int
) -> bool:
    return len(state.get("tabs", [])) >= count


# --- Scenarios ---

NAVIGATION_SCENARIOS = [
    Scenario(
        id="nav-001",
        name="Navigate to example.com",
        category=ScenarioCategory.NAVIGATION,
        prompt=(
            "Open example.com in a new browser tab and verify the page has loaded. "
            "Use browser_wait_for_load to ensure it's fully loaded."
        ),
        verifications=[
            BrowserStateCheck(
                "example.com tab exists",
                verify_example_com,
            ),
            BrowserStateCheck(
                "page title contains 'Example'",
                lambda s: verify_page_title_contains(s, "Example"),
            ),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_wait_for_load",
        ],
        expected_max_tools=6,
        max_turns=10,
        max_budget_usd=0.15,
        difficulty="easy",
        tags=["smoke", "navigation"],
    ),
    Scenario(
        id="nav-002",
        name="Navigate and go back",
        category=ScenarioCategory.NAVIGATION,
        prompt=(
            "Open example.com in a new tab, wait for it to load. "
            "Then navigate the same tab to httpbin.org/html and wait for it to load. "
            "Then go back to example.com. "
            "Confirm you're back on example.com by checking the page info."
        ),
        verifications=[
            BrowserStateCheck(
                "current page is example.com",
                verify_example_com,
            ),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_navigate",
            "mcp__zenleap-browser__browser_go_back",
        ],
        max_turns=15,
        max_budget_usd=0.25,
        difficulty="easy",
        tags=["smoke", "navigation", "history"],
    ),
    Scenario(
        id="nav-003",
        name="Open two tabs and switch",
        category=ScenarioCategory.TAB_MANAGEMENT,
        prompt=(
            "Open two new tabs: one to example.com and one to httpbin.org/get. "
            "Wait for both to load. Then switch to the example.com tab. "
            "List all open tabs to confirm both exist."
        ),
        verifications=[
            BrowserStateCheck(
                "example.com tab exists",
                verify_example_com,
            ),
            BrowserStateCheck(
                "httpbin tab exists",
                verify_httpbin,
            ),
            BrowserStateCheck(
                "at least 2 tabs",
                lambda s: verify_tab_count_at_least(s, 2),
            ),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_switch_tab",
            "mcp__zenleap-browser__browser_list_tabs",
        ],
        max_turns=15,
        max_budget_usd=0.25,
        difficulty="easy",
        tags=["smoke", "tabs"],
    ),
    Scenario(
        id="nav-004",
        name="Take a screenshot of a page",
        category=ScenarioCategory.NAVIGATION,
        prompt=(
            "Open example.com in a new tab, wait for it to load, "
            "and take a screenshot. Tell me the dimensions of the screenshot."
        ),
        verifications=[
            BrowserStateCheck(
                "example.com loaded",
                verify_example_com,
            ),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_wait_for_load",
            "mcp__zenleap-browser__browser_screenshot",
        ],
        max_turns=10,
        max_budget_usd=0.15,
        difficulty="easy",
        tags=["smoke", "observation"],
    ),
    Scenario(
        id="nav-005",
        name="Read page text content",
        category=ScenarioCategory.INFORMATION_EXTRACTION,
        prompt=(
            "Open example.com, wait for it to load, and get the page text. "
            "Tell me what the page says."
        ),
        verifications=[
            BrowserStateCheck(
                "page has text content",
                lambda s: verify_page_text_contains(s, "Example Domain"),
            ),
        ],
        expected_tools=[
            "mcp__zenleap-browser__browser_create_tab",
            "mcp__zenleap-browser__browser_wait_for_load",
            "mcp__zenleap-browser__browser_get_page_text",
        ],
        max_turns=10,
        max_budget_usd=0.15,
        difficulty="easy",
        tags=["smoke", "extraction"],
    ),
]
