"""YouTube history benchmark scenario."""

from __future__ import annotations

import glob
from pathlib import Path
from typing import Any

from bench.scenario import BrowserStateCheck, Scenario, ScenarioCategory

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SAVE_DIR = PROJECT_ROOT / "bench" / "results" / "artifacts"


async def verify_on_youtube(state: dict[str, Any]) -> bool:
    """Verify a tab is on YouTube."""
    tabs = state.get("tabs", [])
    return any("youtube.com" in t.get("url", "") for t in tabs)


async def verify_screenshot_saved(state: dict[str, Any]) -> bool:
    """Verify at least one screenshot file was saved."""
    matches = glob.glob(str(SAVE_DIR / "youtube_history_*.png"))
    return len(matches) > 0


YOUTUBE_SCENARIOS = [
    Scenario(
        id="yt-001",
        name="YouTube history - find 3rd last watched and save screenshot",
        category=ScenarioCategory.MULTI_STEP,
        prompt=(
            f"Go to YouTube watch history at youtube.com/feed/history. "
            f"Look at the watch history list (most recent first). "
            f"Find the third video in the list (the 3rd most recently watched). "
            f"Save a full page screenshot of the history page to "
            f"{SAVE_DIR}/youtube_history_page.png using the browser_save_screenshot tool. "
            f"Then navigate to that third video's page and save a screenshot to "
            f"{SAVE_DIR}/youtube_history_thumbnail.png. "
            f"Tell me the title and channel of the video you found."
        ),
        verifications=[
            BrowserStateCheck(
                "navigated to YouTube",
                verify_on_youtube,
            ),
            BrowserStateCheck(
                "screenshot files saved",
                verify_screenshot_saved,
            ),
        ],
        max_turns=30,
        max_budget_usd=1.50,
        timeout_seconds=180,
        difficulty="hard",
        tags=["regression", "youtube", "multi_step"],
    ),
]
