"""Amazon cart benchmark scenarios."""

from __future__ import annotations

from typing import Any

from bench.scenario import BrowserStateCheck, Scenario, ScenarioCategory


async def verify_on_amazon(state: dict[str, Any]) -> bool:
    """Verify a tab is on Amazon."""
    tabs = state.get("tabs", [])
    return any("amazon.com" in t.get("url", "") for t in tabs)


async def verify_on_amazon_cart(state: dict[str, Any]) -> bool:
    """Verify we're on the Amazon cart page."""
    tabs = state.get("tabs", [])
    return any(
        "amazon.com" in t.get("url", "") and "cart" in t.get("url", "").lower()
        for t in tabs
    )


async def verify_page_text_contains_cart(state: dict[str, Any]) -> bool:
    """Verify the page mentions cart/shopping."""
    text = state.get("page_text", "").lower()
    return "cart" in text or "shopping" in text


AMAZON_SCENARIOS = [
    Scenario(
        id="amz-001",
        name="Amazon - add protein shakes to cart",
        category=ScenarioCategory.MULTI_STEP,
        prompt=(
            "Go to Amazon (amazon.com) and find the protein shakes that I usually "
            "order. Check my order history or reorder page to find protein shake "
            "products I've previously purchased. Once you find them, add them to "
            "my cart. Confirm that the items were successfully added to the cart."
        ),
        verifications=[
            BrowserStateCheck(
                "on Amazon",
                verify_on_amazon,
            ),
        ],
        max_turns=35,
        max_budget_usd=2.00,
        timeout_seconds=240,
        difficulty="hard",
        tags=["regression", "amazon", "multi_step", "cart"],
    ),
    Scenario(
        id="amz-002",
        name="Amazon - remove items from cart",
        category=ScenarioCategory.MULTI_STEP,
        prompt=(
            "Go to the Amazon cart page (amazon.com/cart). "
            "Remove all items currently in the cart. "
            "Confirm the cart is empty after removing everything."
        ),
        verifications=[
            BrowserStateCheck(
                "on Amazon cart page",
                verify_on_amazon_cart,
            ),
        ],
        max_turns=25,
        max_budget_usd=1.50,
        timeout_seconds=180,
        difficulty="medium",
        tags=["regression", "amazon", "multi_step", "cart"],
    ),
]
