"""Scenario and suite definitions for ZenLeap AI benchmarks."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any, Awaitable, Callable

if TYPE_CHECKING:
    pass


class ScenarioCategory(Enum):
    NAVIGATION = "navigation"
    FORM_FILLING = "form_filling"
    INFORMATION_EXTRACTION = "info_extraction"
    MULTI_STEP = "multi_step"
    TAB_MANAGEMENT = "tab_management"
    ERROR_RECOVERY = "error_recovery"
    WORKSPACE = "workspace"


@dataclass
class BrowserStateCheck:
    """A single assertion about browser state after the scenario."""

    description: str
    check_fn: Callable[[dict[str, Any]], Awaitable[bool]]


@dataclass
class Scenario:
    """A benchmark scenario definition."""

    id: str
    name: str
    category: ScenarioCategory
    prompt: str

    # Expected outcomes
    verifications: list[BrowserStateCheck] = field(default_factory=list)
    expected_tools: list[str] | None = None
    expected_max_tools: int | None = None

    # Guardrails
    max_turns: int = 20
    max_budget_usd: float = 0.50
    timeout_seconds: int = 120
    max_attempts: int = 2

    # Setup and teardown
    setup_fn: Callable[[], Awaitable[None]] | None = None
    teardown_fn: Callable[[], Awaitable[None]] | None = None

    # Metadata
    tags: list[str] = field(default_factory=list)
    difficulty: str = "medium"

    # Optional system prompt addition
    append_system_prompt: str | None = None


@dataclass
class ScenarioSuite:
    """A collection of scenarios to run together."""

    name: str
    description: str
    scenarios: list[Scenario]
    tags: list[str] = field(default_factory=list)
