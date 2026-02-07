"""LinkedIn VC tracker benchmark scenario.

Complex multi-step scenario: find VCs on LinkedIn, create Google Sheet, add them.
"""

from __future__ import annotations

from typing import Any

from bench.scenario import BrowserStateCheck, Scenario, ScenarioCategory


async def verify_google_sheets_open(state: dict[str, Any]) -> bool:
    """Verify a Google Sheets tab exists."""
    tabs = state.get("tabs", [])
    return any(
        "docs.google.com/spreadsheets" in t.get("url", "")
        for t in tabs
    )


async def verify_linkedin_visited(state: dict[str, Any]) -> bool:
    """Verify LinkedIn was visited (tab or navigation history)."""
    tabs = state.get("tabs", [])
    return any("linkedin.com" in t.get("url", "") for t in tabs)


LINKEDIN_VC_SCENARIOS = [
    Scenario(
        id="li-001",
        name="Find 10 VCs on LinkedIn and add to Google Sheets tracker",
        category=ScenarioCategory.MULTI_STEP,
        prompt=(
            "I need you to help me build a VC tracker. Here's what to do:\n\n"
            "1. Go to LinkedIn (linkedin.com). I should already be logged in.\n"
            "2. Search for venture capital investors. Use the search bar to search "
            "for 'venture capital' or 'VC investor' and filter to People.\n"
            "3. Look through the results and find 10 people who are VCs "
            "(partners, managing directors, principals at VC firms) that I am "
            "connected to (1st degree) or share connections with (2nd degree). "
            "For each person, note their: Name, Title, Company, Connection degree "
            "(1st or 2nd), and LinkedIn profile URL.\n"
            "4. Once you have 10 VCs, go to Google Sheets (sheets.google.com). "
            "I should already be logged in.\n"
            "5. Create a brand new blank spreadsheet.\n"
            "6. Name the spreadsheet 'VC Tracker'.\n"
            "7. Add headers in row 1: Name, Title, Company, Connection Degree, "
            "LinkedIn URL, Notes.\n"
            "8. Add all 10 VCs to the spreadsheet, one per row starting from row 2.\n"
            "9. Tell me the Google Sheets URL and list all 10 VCs you added.\n\n"
            "Take your time, be thorough. If LinkedIn shows a login wall or CAPTCHA, "
            "take a screenshot so I can see what's happening. "
            "Use screenshots frequently to verify what you see on each page."
        ),
        verifications=[
            BrowserStateCheck(
                "Google Sheets tab exists",
                verify_google_sheets_open,
            ),
        ],
        max_turns=80,
        max_budget_usd=8.00,
        timeout_seconds=600,
        max_attempts=1,
        difficulty="hard",
        tags=["regression", "linkedin", "multi_step", "sheets"],
        append_system_prompt=(
            "You are controlling a real browser where the user is already logged "
            "into LinkedIn and Google. Use screenshots frequently to see what's on "
            "the page. When searching LinkedIn, use the People filter. "
            "For Google Sheets, after creating a new blank sheet, click on the title "
            "'Untitled spreadsheet' to rename it. "
            "To type data into cells, click the cell first, then type the text, "
            "then press Tab or Enter to move to the next cell. "
            "Work methodically: collect all 10 VCs first, then create the sheet."
        ),
    ),
]
