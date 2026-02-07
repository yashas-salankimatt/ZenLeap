"""Self-improvement loop: analyze failures and generate improvement tasks."""

from __future__ import annotations

from dataclasses import dataclass, field

from bench.metrics import MetricsCollector, RunResult


@dataclass
class FailurePattern:
    """A recurring failure pattern across scenarios."""

    pattern_name: str
    frequency: int
    affected_scenarios: list[str]
    example_errors: list[str]
    root_cause_hypothesis: str


@dataclass
class ImprovementTask:
    """A concrete task generated from failure analysis."""

    id: str
    title: str
    description: str
    category: str  # prompt_engineering, tool_design, mcp_server, browser_agent, test_infra
    priority: str  # critical, high, medium, low
    related_scenarios: list[str]
    suggested_changes: list[str]
    estimated_impact: str


class SelfImprover:
    """Analyzes benchmark failures and generates improvement tasks."""

    def __init__(self, collector: MetricsCollector):
        self.collector = collector

    def analyze_failures(
        self, results: list[RunResult]
    ) -> list[FailurePattern]:
        """Identify recurring failure patterns from run results."""
        patterns: dict[str, FailurePattern] = {}

        for r in results:
            if r.passed:
                continue

            category = r.failure_category or "unknown"
            key = f"{category}:{self._error_signature(r.error)}"

            if key not in patterns:
                patterns[key] = FailurePattern(
                    pattern_name=key,
                    frequency=0,
                    affected_scenarios=[],
                    example_errors=[],
                    root_cause_hypothesis="",
                )

            p = patterns[key]
            p.frequency += 1
            p.affected_scenarios.append(r.scenario_id)
            if len(p.example_errors) < 3:
                p.example_errors.append(r.error or "")

        # Generate hypotheses
        for p in patterns.values():
            p.root_cause_hypothesis = self._hypothesize(p)

        return sorted(
            patterns.values(), key=lambda p: p.frequency, reverse=True
        )

    def generate_tasks(
        self, patterns: list[FailurePattern]
    ) -> list[ImprovementTask]:
        """Generate improvement tasks from failure patterns."""
        tasks = []

        for i, pattern in enumerate(patterns):
            if pattern.frequency == 0:
                continue

            priority = (
                "critical"
                if pattern.frequency >= 3
                else "high"
                if pattern.frequency >= 2
                else "medium"
            )

            tasks.append(
                ImprovementTask(
                    id=f"imp-{i + 1:03d}",
                    title=self._task_title(pattern),
                    description=self._task_description(pattern),
                    category=self._task_category(pattern),
                    priority=priority,
                    related_scenarios=pattern.affected_scenarios,
                    suggested_changes=self._suggest_changes(pattern),
                    estimated_impact=f"Would fix {pattern.frequency} failing scenario(s)",
                )
            )

        return tasks

    def run_improvement_cycle(
        self, results: list[RunResult]
    ) -> list[ImprovementTask]:
        """Full improvement cycle: analyze -> generate tasks."""
        patterns = self.analyze_failures(results)
        return self.generate_tasks(patterns)

    # --- Internal helpers ---

    def _error_signature(self, error: str | None) -> str:
        if not error:
            return "no_error"
        sig = error.lower()
        for prefix in [
            "tab not found",
            "timed out",
            "timeout",
            "connection refused",
            "element index",
            "no element at",
            "page not loaded",
            "cannot access",
        ]:
            if prefix in sig:
                return prefix.replace(" ", "_")
        return sig[:50]

    def _hypothesize(self, pattern: FailurePattern) -> str:
        name = pattern.pattern_name
        if "timeout" in name or "timed_out" in name:
            return (
                "Pages loading slowly or WebSocket responses timing out. "
                "Consider increasing timeouts or adding wait_for_load."
            )
        if "connection_refused" in name:
            return (
                "Browser WebSocket server not running or port conflict. "
                "Check that Zen Browser is open and zenleap_agent.uc.js is loaded."
            )
        if "element_index" in name or "no_element" in name:
            return (
                "DOM changed between get_dom and click. "
                "Agent should re-query DOM before interacting."
            )
        if "verification_failure" in name:
            return (
                "Agent completed without errors but browser state doesn't match. "
                "May need better prompting or additional verification steps."
            )
        if "page_not_loaded" in name or "cannot_access" in name:
            return (
                "Page content not accessible — may be about:blank, "
                "privileged page, or still loading."
            )
        return "Unknown pattern — manual investigation needed."

    def _task_title(self, pattern: FailurePattern) -> str:
        name = pattern.pattern_name
        if "timeout" in name or "timed_out" in name:
            return "Increase timeout handling and add wait strategies"
        if "element" in name:
            return "Improve DOM interaction reliability"
        if "verification" in name:
            return "Improve agent prompting for scenario completion"
        if "connection" in name:
            return "Improve WebSocket connection resilience"
        return f"Fix: {pattern.pattern_name}"

    def _task_description(self, pattern: FailurePattern) -> str:
        return (
            f"Pattern: {pattern.pattern_name}\n"
            f"Frequency: {pattern.frequency} occurrences\n"
            f"Affected scenarios: {', '.join(pattern.affected_scenarios)}\n"
            f"Hypothesis: {pattern.root_cause_hypothesis}\n"
            f"Example errors:\n"
            + "\n".join(f"  - {e}" for e in pattern.example_errors)
        )

    def _task_category(self, pattern: FailurePattern) -> str:
        name = pattern.pattern_name
        if "timeout" in name or "timed_out" in name or "connection" in name:
            return "test_infra"
        if "element" in name:
            return "browser_agent"
        if "verification" in name:
            return "prompt_engineering"
        return "mcp_server"

    def _suggest_changes(self, pattern: FailurePattern) -> list[str]:
        name = pattern.pattern_name
        if "timeout" in name or "timed_out" in name:
            return [
                "Add wait_for_load after every navigate",
                "Increase browser_command timeout from 30s to 45s",
                "Add retry logic in the MCP server for transient failures",
            ]
        if "element" in name:
            return [
                "Instruct agent to always call get_dom immediately before clicking",
                "Add element staleness detection with auto-recovery",
                "Consider adding a 'click_by_text' tool that combines get_dom + click",
            ]
        if "verification" in name:
            return [
                "Improve scenario prompts to be more specific about expected outcomes",
                "Add intermediate verification steps in multi-step scenarios",
                "Use append_system_prompt to add verification instructions",
            ]
        if "connection" in name:
            return [
                "Add WebSocket reconnection logic in the MCP server",
                "Ensure browser is running before starting benchmarks",
                "Add health check command before each scenario",
            ]
        return ["Manual investigation required"]
