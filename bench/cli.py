"""CLI entry point for ZenLeap AI benchmarks."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

from bench.improve import SelfImprover
from bench.metrics import MetricsCollector, RunResult
from bench.report import ReportGenerator
from bench.runner import BenchmarkRunner
from bench.scenario import ScenarioSuite
from bench.scenarios import ALL_SCENARIOS
from bench.verify import BrowserVerifier


def _rows_to_results(rows: list[dict]) -> list[RunResult]:
    """Convert stored database rows to RunResult objects."""
    results = []
    for row in rows:
        results.append(
            RunResult(
                scenario_id=row["scenario_id"],
                scenario_name=row["scenario_name"] or "",
                category=row["category"] or "",
                passed=bool(row["passed"]),
                attempt=row["attempt"] or 1,
                total_cost_usd=row["total_cost_usd"],
                duration_ms=row["duration_ms"] or 0,
                num_turns=row["num_turns"] or 0,
                tool_call_count=row["tool_call_count"] or 0,
                tool_names_used=json.loads(row["tool_names_used"] or "[]"),
                verification_results=json.loads(
                    row["verification_results"] or "{}"
                ),
                error=row["error"],
                failure_category=row["failure_category"],
                timestamp=row["timestamp"] or 0,
            )
        )
    return results


def get_suites() -> dict[str, ScenarioSuite]:
    """Define available benchmark suites."""
    smoke = [s for s in ALL_SCENARIOS if "smoke" in s.tags]
    regression = [s for s in ALL_SCENARIOS if "regression" in s.tags]
    return {
        "smoke": ScenarioSuite(
            name="smoke",
            description="Quick sanity checks for basic functionality",
            scenarios=smoke if smoke else ALL_SCENARIOS[:5],
        ),
        "regression": ScenarioSuite(
            name="regression",
            description="Real-world workflow regression tests (YouTube, Amazon, etc.)",
            scenarios=regression,
        ),
        "full": ScenarioSuite(
            name="full",
            description="Complete benchmark suite",
            scenarios=ALL_SCENARIOS,
        ),
    }


async def cmd_run(args: argparse.Namespace):
    """Run benchmark scenarios."""
    collector = MetricsCollector()
    verifier = BrowserVerifier()
    runner = BenchmarkRunner(collector, verifier)

    suites = get_suites()

    # Select scenarios
    if args.scenario:
        scenarios = [s for s in ALL_SCENARIOS if s.id == args.scenario]
        if not scenarios:
            print(f"Scenario '{args.scenario}' not found.")
            print(f"Available: {[s.id for s in ALL_SCENARIOS]}")
            return
    elif args.tag:
        scenarios = [s for s in ALL_SCENARIOS if args.tag in s.tags]
        if not scenarios:
            print(f"No scenarios with tag '{args.tag}'.")
            return
    else:
        suite = suites.get(args.suite, suites["smoke"])
        scenarios = suite.scenarios

    suite_name = args.suite if not args.scenario else f"single:{args.scenario}"
    print(f"Running {len(scenarios)} scenario(s) [{suite_name}]...\n")

    results = []
    for scenario in scenarios:
        print(f"--- {scenario.id}: {scenario.name} ---")
        # Clean tabs between scenarios
        await verifier.cleanup_tabs()
        result = await runner.run_scenario(scenario)
        status = "PASS" if result.passed else "FAIL"
        cost = (
            f"${result.total_cost_usd:.4f}"
            if result.total_cost_usd
            else "N/A"
        )
        print(
            f"  {status} | {result.duration_ms}ms | {cost} | "
            f"{result.tool_call_count} tools"
        )
        if not result.passed:
            print(f"  Error: {result.error}")
            for check, passed in result.verification_results.items():
                if not passed:
                    print(f"  Failed check: {check}")
        if args.trace:
            if result.tool_call_trace:
                print(f"\n  Tool Trace ({len(result.tool_call_trace)} calls):")
                print(f"  {'─' * 60}")
                for i, tc in enumerate(result.tool_call_trace, 1):
                    tool_short = tc["tool"].replace(
                        "mcp__zenleap-browser__browser_", ""
                    )
                    inp = json.dumps(tc["input"], default=str)
                    if len(inp) > 120:
                        inp = inp[:120] + "..."
                    preview = tc.get("result_preview", "") or ""
                    if len(preview) > 200:
                        preview = preview[:200] + "..."
                    print(f"  {i:3d}. {tool_short}")
                    print(f"       input: {inp}")
                    if preview:
                        print(f"       result: {preview}")
                print(f"  {'─' * 60}")
            # Print the agent's final response
            if result.agent_response:
                resp = result.agent_response
                if len(resp) > 500:
                    resp = resp[:500] + "..."
                print(f"\n  Agent Response: {resp}")
        print()
        results.append(result)

    # Summary
    reporter = ReportGenerator(collector)
    report = reporter.generate(results, suite_name)

    if args.format == "markdown":
        print(reporter.to_markdown(report))
    elif args.format == "json":
        print(reporter.to_json(report))
    else:
        print(f"{'=' * 50}")
        print(
            f"Results: {report.passed}/{report.total} passed "
            f"({report.pass_rate:.0%})"
        )
        print(f"Total cost: ${report.total_cost_usd:.4f}")
        print(
            f"Total duration: {report.total_duration_ms / 1000:.1f}s"
        )

    await verifier.close()


async def cmd_report(args: argparse.Namespace):
    """Generate report from stored results."""
    collector = MetricsCollector()
    recent = collector.get_recent_runs(last_n=args.last_n)

    if not recent:
        print("No benchmark results found. Run benchmarks first.")
        return

    reporter = ReportGenerator(collector)
    results = _rows_to_results(recent)
    report = reporter.generate(results, "stored")

    if args.format == "markdown":
        print(reporter.to_markdown(report))
    elif args.format == "json":
        print(reporter.to_json(report))
    else:
        print(reporter.to_markdown(report))


async def cmd_improve(args: argparse.Namespace):
    """Analyze failures and suggest improvements."""
    collector = MetricsCollector()
    recent = collector.get_recent_runs(last_n=50)

    if not recent:
        print("No benchmark results found. Run benchmarks first.")
        return

    results = _rows_to_results(recent)
    improver = SelfImprover(collector)
    tasks = improver.run_improvement_cycle(results)

    if not tasks:
        print("No improvement tasks generated (all scenarios passing!).")
        return

    print(f"Generated {len(tasks)} improvement task(s):\n")
    for task in tasks:
        print(f"[{task.priority.upper()}] {task.id}: {task.title}")
        print(f"  Category: {task.category}")
        print(f"  Impact: {task.estimated_impact}")
        print(f"  Scenarios: {', '.join(task.related_scenarios)}")
        print(f"  Suggestions:")
        for s in task.suggested_changes:
            print(f"    - {s}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="ZenLeap AI Benchmark Runner"
    )
    subparsers = parser.add_subparsers(dest="command")

    # Run benchmarks
    run_parser = subparsers.add_parser("run", help="Run benchmark scenarios")
    run_parser.add_argument(
        "--suite", choices=["smoke", "regression", "full"], default="smoke"
    )
    run_parser.add_argument("--scenario", help="Run a specific scenario by ID")
    run_parser.add_argument(
        "--tag", help="Run scenarios with a specific tag"
    )
    run_parser.add_argument(
        "--format",
        choices=["text", "json", "markdown"],
        default="text",
    )
    run_parser.add_argument(
        "--trace",
        action="store_true",
        help="Print detailed tool call traces for each scenario",
    )

    # View reports
    report_parser = subparsers.add_parser(
        "report", help="Generate reports from stored results"
    )
    report_parser.add_argument(
        "--last-n", type=int, default=20, help="Number of recent runs"
    )
    report_parser.add_argument(
        "--format",
        choices=["text", "json", "markdown"],
        default="markdown",
    )

    # Analyze for improvements
    subparsers.add_parser(
        "improve", help="Analyze failures and suggest improvements"
    )

    # List scenarios
    subparsers.add_parser("list", help="List available scenarios")

    args = parser.parse_args()

    if args.command == "run":
        asyncio.run(cmd_run(args))
    elif args.command == "report":
        asyncio.run(cmd_report(args))
    elif args.command == "improve":
        asyncio.run(cmd_improve(args))
    elif args.command == "list":
        for s in ALL_SCENARIOS:
            tags = ", ".join(s.tags) if s.tags else ""
            print(
                f"  {s.id:12s} [{s.difficulty:6s}] {s.name:40s} {tags}"
            )
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
