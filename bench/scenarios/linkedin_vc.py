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


async def verify_sheet_has_vc_data(state: dict[str, Any]) -> bool:
    """Verify the sheet contains VC data (at least headers + some entries)."""
    text = state.get("page_text", "")
    # Check for header row keywords
    has_headers = "Name" in text and "Company" in text
    # Check for at least a few names (the page text should contain VC names)
    # We just check the text is substantial (> 200 chars means data was entered)
    has_data = len(text) > 200
    return has_headers and has_data


LINKEDIN_VC_SCENARIOS = [
    Scenario(
        id="li-001",
        name="Find 10 VCs on LinkedIn and add to Google Sheets tracker",
        category=ScenarioCategory.MULTI_STEP,
        prompt=(
            "I need you to help me build a VC tracker. Here's what to do:\n\n"
            "1. Go to LinkedIn (linkedin.com). I should already be logged in.\n"
            "2. Search for venture capital investors. Use the search bar to search "
            "for 'venture capital' and filter to People.\n"
            "3. Look through the search results page. Find 10 people who are VCs "
            "(partners, managing directors, principals at VC firms) that I am "
            "connected to (1st degree) or share connections with (2nd degree). "
            "You can gather names/titles/companies directly from the search results "
            "page — you do NOT need to visit each profile individually. Use get_dom "
            "and get_page_text to extract info from the search results listing. "
            "Scroll down if needed to find more results. "
            "For each person, note: Name, Title, Company, Connection degree "
            "(1st or 2nd), and LinkedIn profile URL.\n"
            "4. Once you have 10 VCs, go to Google Sheets by navigating to "
            "https://sheets.new to create a brand new blank spreadsheet.\n"
            "5. Name the spreadsheet 'VC Tracker' by clicking on the title area "
            "at the top left.\n"
            "6. IMPORTANT: To enter data into Google Sheets efficiently, use "
            "browser_console_eval to run JavaScript that sets cell values. "
            "Here is the pattern:\n"
            "   - First click on cell A1 to select it\n"
            "   - Type the headers: Name, then press Tab, Title, Tab, Company, "
            "Tab, Connection Degree, Tab, LinkedIn URL, Tab, Notes, then Enter\n"
            "   - For each VC row, type Name, Tab, Title, Tab, Company, Tab, "
            "Degree, Tab, URL, Tab, any notes, Enter\n"
            "   - Use Tab to move between columns and Enter to move to next row\n"
            "7. After entering all data, take a screenshot to verify.\n"
            "8. Tell me the Google Sheets URL and list all 10 VCs you added."
        ),
        verifications=[
            BrowserStateCheck(
                "Google Sheets tab exists",
                verify_google_sheets_open,
            ),
            BrowserStateCheck(
                "Sheet contains VC data",
                verify_sheet_has_vc_data,
            ),
        ],
        max_turns=150,
        max_budget_usd=10.00,
        timeout_seconds=600,
        max_attempts=1,
        difficulty="hard",
        tags=["regression", "linkedin", "multi_step", "sheets"],
        append_system_prompt=(
            "You are controlling a real browser where the user is already logged "
            "into LinkedIn and Google. Use screenshots to verify what you see.\n\n"
            "EFFICIENCY TIPS:\n"
            "- On LinkedIn search results, extract info directly from the results "
            "page using get_page_text or get_dom — do NOT visit each profile.\n"
            "- Scroll down on the search results to see more people.\n"
            "- For Google Sheets, use https://sheets.new to create a new sheet.\n"
            "- To rename the sheet, find the title input at the top and use "
            "browser_fill to set it to 'VC Tracker'.\n"
            "- To enter data, click cell A1, then type using browser_type with "
            "Tab characters between columns and Enter for new rows. You can type "
            "an entire row in one browser_type call like: "
            "'Name\\tTitle\\tCompany\\t1st\\thttps://linkedin.com/in/...\\tNotes\\n'\n"
            "- Alternatively, type each cell value then press Tab to advance.\n"
            "- Take a final screenshot to verify all data was entered."
        ),
    ),
]
