"""Benchmark execution engine using Claude Agent SDK."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    UserMessage,
    query,
)
from claude_agent_sdk.types import ResultMessage, ToolResultBlock, ToolUseBlock

from bench.metrics import MetricsCollector, RunResult, ToolCallRecord
from bench.scenario import Scenario, ScenarioSuite
from bench.verify import BrowserVerifier

PROJECT_ROOT = Path(__file__).resolve().parent.parent

MCP_CONFIG = {
    "command": str(PROJECT_ROOT / "mcp" / ".venv" / "bin" / "python"),
    "args": [str(PROJECT_ROOT / "mcp" / "zenleap_mcp_server.py")],
}

# All MCP tools the agent is allowed to use
ALLOWED_TOOLS = [
    "mcp__zenleap-browser__browser_create_tab",
    "mcp__zenleap-browser__browser_close_tab",
    "mcp__zenleap-browser__browser_switch_tab",
    "mcp__zenleap-browser__browser_list_tabs",
    "mcp__zenleap-browser__browser_navigate",
    "mcp__zenleap-browser__browser_go_back",
    "mcp__zenleap-browser__browser_go_forward",
    "mcp__zenleap-browser__browser_reload",
    "mcp__zenleap-browser__browser_get_page_info",
    "mcp__zenleap-browser__browser_screenshot",
    "mcp__zenleap-browser__browser_get_dom",
    "mcp__zenleap-browser__browser_get_page_text",
    "mcp__zenleap-browser__browser_get_page_html",
    "mcp__zenleap-browser__browser_click",
    "mcp__zenleap-browser__browser_click_coordinates",
    "mcp__zenleap-browser__browser_fill",
    "mcp__zenleap-browser__browser_select_option",
    "mcp__zenleap-browser__browser_type",
    "mcp__zenleap-browser__browser_press_key",
    "mcp__zenleap-browser__browser_scroll",
    "mcp__zenleap-browser__browser_hover",
    "mcp__zenleap-browser__browser_console_setup",
    "mcp__zenleap-browser__browser_console_logs",
    "mcp__zenleap-browser__browser_console_errors",
    "mcp__zenleap-browser__browser_console_eval",
    "mcp__zenleap-browser__browser_wait",
    "mcp__zenleap-browser__browser_wait_for_load",
    "mcp__zenleap-browser__browser_save_screenshot",
    "mcp__zenleap-browser__browser_list_frames",
    "mcp__zenleap-browser__browser_wait_for_element",
    "mcp__zenleap-browser__browser_wait_for_text",
    "mcp__zenleap-browser__browser_get_tab_events",
    "mcp__zenleap-browser__browser_get_dialogs",
    "mcp__zenleap-browser__browser_handle_dialog",
    "mcp__zenleap-browser__browser_get_navigation_status",
    "mcp__zenleap-browser__browser_clipboard_read",
    "mcp__zenleap-browser__browser_clipboard_write",
]


@dataclass
class ScenarioRun:
    """Full record of a single scenario execution."""

    scenario_id: str
    attempt: int
    started_at: float
    ended_at: float | None = None
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    result_message: dict[str, Any] | None = None
    verification_results: dict[str, bool] = field(default_factory=dict)
    error: str | None = None
    failure_category: str | None = None


class BenchmarkRunner:
    """Runs benchmark scenarios against a live browser via Claude Code."""

    def __init__(
        self,
        collector: MetricsCollector,
        verifier: BrowserVerifier,
    ):
        self.collector = collector
        self.verifier = verifier

    def _build_options(self, scenario: Scenario) -> ClaudeAgentOptions:
        """Build Claude Agent SDK options for a scenario."""
        system_prompt: dict[str, str] = {
            "type": "preset",
            "preset": "claude_code",
        }
        if scenario.append_system_prompt:
            system_prompt["append"] = scenario.append_system_prompt

        return ClaudeAgentOptions(
            mcp_servers={"zenleap-browser": MCP_CONFIG},
            allowed_tools=ALLOWED_TOOLS,
            max_turns=scenario.max_turns,
            max_budget_usd=scenario.max_budget_usd,
            permission_mode="bypassPermissions",
            system_prompt=system_prompt,
            cwd=str(PROJECT_ROOT),
        )

    def _build_result(
        self, scenario: Scenario, run: ScenarioRun
    ) -> RunResult:
        """Convert a ScenarioRun into a RunResult."""
        result_msg = run.result_message or {}
        tool_names = [tc.tool_name for tc in run.tool_calls]

        result = RunResult(
            scenario_id=scenario.id,
            scenario_name=scenario.name,
            category=scenario.category.value,
            passed=run.failure_category is None,
            attempt=run.attempt,
            total_cost_usd=result_msg.get("total_cost_usd"),
            duration_ms=int(
                ((run.ended_at or time.time()) - run.started_at) * 1000
            ),
            num_turns=result_msg.get("num_turns", 0),
            tool_call_count=len(run.tool_calls),
            tool_names_used=list(set(tool_names)),
            verification_results=run.verification_results,
            error=run.error,
            failure_category=run.failure_category,
            timestamp=run.started_at,
            tool_call_trace=[
                {
                    "tool": tc.tool_name,
                    "input": tc.tool_input,
                    "result_preview": (
                        str(tc.tool_result)[:500] if tc.tool_result else None
                    ),
                    "timestamp": tc.timestamp,
                }
                for tc in run.tool_calls
            ],
            agent_response=result_msg.get("result") if result_msg else None,
        )
        self.collector.store(result)
        return result

    async def run_scenario(self, scenario: Scenario) -> RunResult:
        """Run a single scenario with up to max_attempts tries."""
        result: RunResult | None = None

        for attempt in range(1, scenario.max_attempts + 1):
            run = ScenarioRun(
                scenario_id=scenario.id,
                attempt=attempt,
                started_at=time.time(),
            )
            tool_calls: list[ToolCallRecord] = []
            # Track pending tool uses by ID to match with results
            pending_tools: dict[str, ToolCallRecord] = {}

            try:
                # Setup
                if scenario.setup_fn:
                    await scenario.setup_fn()

                # Execute via Claude Agent SDK
                options = self._build_options(scenario)
                result_msg = None

                async for message in query(
                    prompt=scenario.prompt,
                    options=options,
                ):
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, ToolUseBlock):
                                record = ToolCallRecord(
                                    tool_name=block.name,
                                    tool_input=block.input or {},
                                    tool_result=None,
                                    timestamp=time.time(),
                                )
                                tool_calls.append(record)
                                pending_tools[block.id] = record
                    elif isinstance(message, UserMessage):
                        for block in message.content:
                            if isinstance(block, ToolResultBlock):
                                record = pending_tools.get(
                                    block.tool_use_id
                                )
                                if record:
                                    record.tool_result = (
                                        block.content
                                        if hasattr(block, "content")
                                        else str(block)
                                    )
                    elif isinstance(message, ResultMessage):
                        result_msg = message
                        run.result_message = {
                            "duration_ms": message.duration_ms,
                            "num_turns": message.num_turns,
                            "total_cost_usd": message.total_cost_usd,
                            "is_error": message.is_error,
                            "result": message.result,
                            "session_id": message.session_id,
                        }

                run.tool_calls = tool_calls
                run.ended_at = time.time()

                # Check for agent error
                if not result_msg or result_msg.is_error:
                    run.error = (
                        result_msg.result if result_msg else "No result message"
                    )
                    run.failure_category = "agent_error"
                else:
                    # Verify browser state
                    browser_state = await self.verifier.capture_state()
                    for check in scenario.verifications:
                        passed = await check.check_fn(browser_state)
                        run.verification_results[check.description] = passed

                    if not all(run.verification_results.values()):
                        run.failure_category = "verification_failure"

            except asyncio.TimeoutError:
                run.ended_at = time.time()
                run.error = "Scenario timed out"
                run.failure_category = "infrastructure"
            except ConnectionRefusedError:
                run.ended_at = time.time()
                run.error = "Browser WebSocket connection refused"
                run.failure_category = "infrastructure"
            except Exception as e:
                run.ended_at = time.time()
                run.error = str(e)
                run.failure_category = "agent_error"
            finally:
                # Teardown
                if scenario.teardown_fn:
                    try:
                        await scenario.teardown_fn()
                    except Exception:
                        pass

            result = self._build_result(scenario, run)

            # Retry only on infrastructure failures
            if run.failure_category is None or run.failure_category != "infrastructure":
                break
            if attempt < scenario.max_attempts:
                await asyncio.sleep(2)

        assert result is not None
        return result

    async def run_suite(self, suite: ScenarioSuite) -> list[RunResult]:
        """Run all scenarios in a suite sequentially."""
        results = []
        for scenario in suite.scenarios:
            # Clean up tabs between scenarios
            await self.verifier.cleanup_tabs()
            result = await self.run_scenario(scenario)
            results.append(result)
        return results
