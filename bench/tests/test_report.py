"""Tests for bench.report module."""

from pathlib import Path

import pytest

from bench.metrics import MetricsCollector, RunResult
from bench.report import ReportGenerator


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
        tool_names_used=["browser_create_tab"],
        verification_results={"check": True},
        error=None,
        failure_category=None,
        timestamp=1000.0,
    )
    defaults.update(overrides)
    return RunResult(**defaults)


class TestReportGenerator:
    def test_all_pass_report(self, collector: MetricsCollector):
        reporter = ReportGenerator(collector)
        results = [make_result() for _ in range(3)]
        report = reporter.generate(results, "test")
        assert report.total == 3
        assert report.passed == 3
        assert report.failed == 0
        assert report.pass_rate == 1.0

    def test_mixed_results(self, collector: MetricsCollector):
        reporter = ReportGenerator(collector)
        results = [
            make_result(),
            make_result(
                scenario_id="test-002",
                passed=False,
                error="fail",
                failure_category="agent_error",
            ),
        ]
        report = reporter.generate(results, "test")
        assert report.passed == 1
        assert report.failed == 1
        assert report.pass_rate == 0.5
        assert len(report.failures) == 1

    def test_cost_aggregation(self, collector: MetricsCollector):
        reporter = ReportGenerator(collector)
        results = [
            make_result(total_cost_usd=0.10),
            make_result(scenario_id="test-002", total_cost_usd=0.20),
        ]
        report = reporter.generate(results, "test")
        assert abs(report.total_cost_usd - 0.30) < 0.001
        assert abs(report.avg_cost_per_scenario - 0.15) < 0.001

    def test_by_category(self, collector: MetricsCollector):
        reporter = ReportGenerator(collector)
        results = [
            make_result(category="navigation"),
            make_result(scenario_id="test-002", category="form_filling"),
            make_result(
                scenario_id="test-003",
                category="navigation",
                passed=False,
                failure_category="agent_error",
            ),
        ]
        report = reporter.generate(results, "test")
        assert "navigation" in report.by_category
        assert report.by_category["navigation"]["total"] == 2
        assert report.by_category["navigation"]["passed"] == 1

    def test_markdown_output(self, collector: MetricsCollector):
        reporter = ReportGenerator(collector)
        results = [make_result()]
        report = reporter.generate(results, "test")
        md = reporter.to_markdown(report)
        assert "# Benchmark Report" in md
        assert "1/1" in md
        assert "100%" in md

    def test_json_output(self, collector: MetricsCollector):
        reporter = ReportGenerator(collector)
        results = [make_result()]
        report = reporter.generate(results, "test")
        import json
        data = json.loads(reporter.to_json(report))
        assert data["total"] == 1
        assert data["passed"] == 1

    def test_empty_results(self, collector: MetricsCollector):
        reporter = ReportGenerator(collector)
        report = reporter.generate([], "empty")
        assert report.total == 0
        assert report.pass_rate == 0
