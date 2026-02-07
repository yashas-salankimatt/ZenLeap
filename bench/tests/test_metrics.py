"""Tests for bench.metrics module."""

import json
import tempfile
from pathlib import Path

import pytest

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
        tool_names_used=["browser_create_tab", "browser_wait_for_load"],
        verification_results={"tab exists": True},
        error=None,
        failure_category=None,
        timestamp=1000.0,
    )
    defaults.update(overrides)
    return RunResult(**defaults)


class TestMetricsCollector:
    def test_init_creates_db(self, tmp_path: Path):
        db_path = tmp_path / "sub" / "test.db"
        collector = MetricsCollector(db_path=db_path)
        assert db_path.exists()

    def test_store_and_retrieve(self, collector: MetricsCollector):
        result = make_result()
        collector.store(result)
        runs = collector.get_recent_runs(scenario_id="test-001")
        assert len(runs) == 1
        assert runs[0]["scenario_id"] == "test-001"
        assert runs[0]["passed"] == 1
        assert runs[0]["total_cost_usd"] == 0.01

    def test_store_with_run_group(self, collector: MetricsCollector):
        result = make_result()
        collector.store(result, run_group="group-1")
        runs = collector.get_recent_runs()
        assert runs[0]["run_group"] == "group-1"

    def test_store_failed_result(self, collector: MetricsCollector):
        result = make_result(
            passed=False,
            error="Tab not found",
            failure_category="agent_error",
        )
        collector.store(result)
        runs = collector.get_recent_runs()
        assert runs[0]["passed"] == 0
        assert runs[0]["error"] == "Tab not found"
        assert runs[0]["failure_category"] == "agent_error"

    def test_get_pass_rate(self, collector: MetricsCollector):
        # Store 3 passes and 1 failure
        for i in range(3):
            collector.store(make_result(timestamp=1000.0 + i))
        collector.store(
            make_result(
                passed=False,
                failure_category="agent_error",
                timestamp=1003.0,
            )
        )
        rate = collector.get_pass_rate("test-001")
        assert rate == 0.75

    def test_get_pass_rate_empty(self, collector: MetricsCollector):
        assert collector.get_pass_rate("nonexistent") == 0.0

    def test_get_cost_trend(self, collector: MetricsCollector):
        for i in range(5):
            collector.store(
                make_result(
                    total_cost_usd=0.01 * (i + 1),
                    timestamp=1000.0 + i,
                )
            )
        trend = collector.get_cost_trend("test-001")
        assert len(trend) == 5
        assert trend[0] == 0.01
        assert trend[4] == 0.05

    def test_get_recent_runs_limit(self, collector: MetricsCollector):
        for i in range(10):
            collector.store(make_result(timestamp=1000.0 + i))
        runs = collector.get_recent_runs(last_n=3)
        assert len(runs) == 3

    def test_get_recent_runs_all(self, collector: MetricsCollector):
        for i in range(3):
            collector.store(
                make_result(
                    scenario_id=f"test-{i:03d}",
                    timestamp=1000.0 + i,
                )
            )
        runs = collector.get_recent_runs()
        assert len(runs) == 3

    def test_tool_call_trace_stored(self, collector: MetricsCollector):
        result = make_result(
            tool_call_trace=[
                {"tool": "browser_create_tab", "input": {"url": "example.com"}}
            ]
        )
        collector.store(result)
        runs = collector.get_recent_runs()
        trace = json.loads(runs[0]["tool_call_trace"])
        assert len(trace) == 1
        assert trace[0]["tool"] == "browser_create_tab"
