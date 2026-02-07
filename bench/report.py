"""Report generation for benchmark results."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any

from bench.metrics import MetricsCollector, RunResult


@dataclass
class SuiteReport:
    """Summary report for a benchmark suite run."""

    suite_name: str
    total: int
    passed: int
    failed: int
    pass_rate: float
    total_cost_usd: float
    total_duration_ms: int
    avg_cost_per_scenario: float
    avg_duration_per_scenario: float
    by_category: dict[str, dict[str, Any]]
    failures: list[dict[str, Any]]
    regressions: list[dict[str, Any]]


class ReportGenerator:
    """Generates reports from benchmark results."""

    def __init__(self, collector: MetricsCollector):
        self.collector = collector

    def generate(
        self, results: list[RunResult], suite_name: str = ""
    ) -> SuiteReport:
        """Generate a report from a list of run results."""
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed
        total_cost = sum(r.total_cost_usd or 0 for r in results)
        total_duration = sum(r.duration_ms for r in results)

        # Group by category
        by_category: dict[str, dict[str, Any]] = {}
        for r in results:
            cat = r.category
            if cat not in by_category:
                by_category[cat] = {
                    "total": 0,
                    "passed": 0,
                    "cost": 0.0,
                    "duration": 0,
                }
            by_category[cat]["total"] += 1
            if r.passed:
                by_category[cat]["passed"] += 1
            by_category[cat]["cost"] += r.total_cost_usd or 0
            by_category[cat]["duration"] += r.duration_ms

        # Failures detail
        failures = [
            {
                "scenario_id": r.scenario_id,
                "scenario_name": r.scenario_name,
                "category": r.failure_category,
                "error": r.error,
                "verification_results": r.verification_results,
                "tool_call_count": r.tool_call_count,
            }
            for r in results
            if not r.passed
        ]

        # Regressions: scenarios that pass historically but failed now
        regressions = []
        for r in results:
            if not r.passed:
                historical_rate = self.collector.get_pass_rate(r.scenario_id)
                if historical_rate > 0.7:
                    regressions.append(
                        {
                            "scenario_id": r.scenario_id,
                            "historical_pass_rate": historical_rate,
                            "error": r.error,
                        }
                    )

        return SuiteReport(
            suite_name=suite_name,
            total=total,
            passed=passed,
            failed=failed,
            pass_rate=passed / total if total > 0 else 0,
            total_cost_usd=total_cost,
            total_duration_ms=total_duration,
            avg_cost_per_scenario=total_cost / total if total > 0 else 0,
            avg_duration_per_scenario=total_duration / total if total > 0 else 0,
            by_category=by_category,
            failures=failures,
            regressions=regressions,
        )

    def to_markdown(self, report: SuiteReport) -> str:
        """Render report as Markdown."""
        lines = [
            f"# Benchmark Report: {report.suite_name}",
            "",
            f"**Pass Rate:** {report.passed}/{report.total} ({report.pass_rate:.0%})",
            f"**Total Cost:** ${report.total_cost_usd:.4f}",
            f"**Total Duration:** {report.total_duration_ms / 1000:.1f}s",
            f"**Avg Cost/Scenario:** ${report.avg_cost_per_scenario:.4f}",
            f"**Avg Duration/Scenario:** {report.avg_duration_per_scenario / 1000:.1f}s",
            "",
            "## By Category",
            "",
            "| Category | Passed | Total | Rate | Cost |",
            "|----------|--------|-------|------|------|",
        ]
        for cat, data in report.by_category.items():
            rate = (
                data["passed"] / data["total"] if data["total"] > 0 else 0
            )
            lines.append(
                f"| {cat} | {data['passed']} | {data['total']} "
                f"| {rate:.0%} | ${data['cost']:.4f} |"
            )

        if report.failures:
            lines.extend(["", "## Failures", ""])
            for f in report.failures:
                lines.append(
                    f"- **{f['scenario_id']}** ({f['scenario_name']}): "
                    f"{f['category']} - {f['error']}"
                )

        if report.regressions:
            lines.extend(["", "## Regressions", ""])
            for r in report.regressions:
                lines.append(
                    f"- **{r['scenario_id']}**: was passing "
                    f"{r['historical_pass_rate']:.0%}, now failing: {r['error']}"
                )

        return "\n".join(lines)

    def to_json(self, report: SuiteReport) -> str:
        """Render report as JSON."""
        return json.dumps(asdict(report), indent=2)
