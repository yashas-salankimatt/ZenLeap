"""Tests for bench.improve module."""

from pathlib import Path

import pytest

from bench.improve import SelfImprover
from bench.metrics import MetricsCollector, RunResult


@pytest.fixture
def collector(tmp_path: Path) -> MetricsCollector:
    return MetricsCollector(db_path=tmp_path / "test.db")


def make_result(**overrides) -> RunResult:
    defaults = dict(
        scenario_id="test-001",
        scenario_name="Test Scenario",
        category="navigation",
        passed=True,
        attempt=1,
        total_cost_usd=0.01,
        duration_ms=5000,
        num_turns=3,
        tool_call_count=2,
        tool_names_used=[],
        verification_results={},
        error=None,
        failure_category=None,
        timestamp=1000.0,
    )
    defaults.update(overrides)
    return RunResult(**defaults)


class TestSelfImprover:
    def test_no_failures_no_tasks(self, collector: MetricsCollector):
        improver = SelfImprover(collector)
        results = [make_result() for _ in range(3)]
        tasks = improver.run_improvement_cycle(results)
        assert len(tasks) == 0

    def test_single_failure_one_task(self, collector: MetricsCollector):
        improver = SelfImprover(collector)
        results = [
            make_result(),
            make_result(
                scenario_id="test-002",
                passed=False,
                failure_category="agent_error",
                error="Tab not found: xyz",
            ),
        ]
        tasks = improver.run_improvement_cycle(results)
        assert len(tasks) == 1
        assert tasks[0].priority == "medium"
        assert "test-002" in tasks[0].related_scenarios

    def test_multiple_same_failure_higher_priority(
        self, collector: MetricsCollector
    ):
        improver = SelfImprover(collector)
        results = [
            make_result(
                scenario_id=f"test-{i:03d}",
                passed=False,
                failure_category="infrastructure",
                error="Connection refused",
            )
            for i in range(3)
        ]
        tasks = improver.run_improvement_cycle(results)
        assert len(tasks) == 1
        assert tasks[0].priority == "critical"
        assert tasks[0].category == "test_infra"

    def test_timeout_failure_hypothesis(self, collector: MetricsCollector):
        improver = SelfImprover(collector)
        results = [
            make_result(
                passed=False,
                failure_category="infrastructure",
                error="Scenario timed out",
            ),
        ]
        patterns = improver.analyze_failures(results)
        assert len(patterns) == 1
        assert "timeout" in patterns[0].root_cause_hypothesis.lower()

    def test_verification_failure_category(self, collector: MetricsCollector):
        improver = SelfImprover(collector)
        results = [
            make_result(
                passed=False,
                failure_category="verification_failure",
                error="Browser state mismatch",
            ),
        ]
        tasks = improver.run_improvement_cycle(results)
        assert len(tasks) == 1
        assert tasks[0].category == "prompt_engineering"

    def test_element_failure_suggestions(self, collector: MetricsCollector):
        improver = SelfImprover(collector)
        results = [
            make_result(
                passed=False,
                failure_category="agent_error",
                error="Element index 5 not found — run get_dom first",
            ),
        ]
        tasks = improver.run_improvement_cycle(results)
        assert len(tasks) == 1
        assert any("get_dom" in s for s in tasks[0].suggested_changes)

    def test_different_failures_grouped(self, collector: MetricsCollector):
        improver = SelfImprover(collector)
        results = [
            make_result(
                scenario_id="a",
                passed=False,
                failure_category="agent_error",
                error="Tab not found",
            ),
            make_result(
                scenario_id="b",
                passed=False,
                failure_category="infrastructure",
                error="Connection refused",
            ),
        ]
        tasks = improver.run_improvement_cycle(results)
        assert len(tasks) == 2
