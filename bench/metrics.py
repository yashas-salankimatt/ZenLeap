"""Metrics collection and storage for benchmark runs."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class ToolCallRecord:
    """Record of a single tool invocation."""

    tool_name: str
    tool_input: dict[str, Any]
    tool_result: Any
    timestamp: float
    duration_ms: float | None = None


@dataclass
class RunResult:
    """Summary result of a scenario run."""

    scenario_id: str
    scenario_name: str
    category: str
    passed: bool
    attempt: int
    total_cost_usd: float | None
    duration_ms: int
    num_turns: int
    tool_call_count: int
    tool_names_used: list[str]
    verification_results: dict[str, bool]
    error: str | None
    failure_category: str | None
    timestamp: float
    tool_call_trace: list[dict[str, Any]] = field(default_factory=list)
    agent_response: str | None = None


class MetricsCollector:
    """Collects and stores benchmark metrics in SQLite."""

    def __init__(self, db_path: str | Path = "bench/results/benchmarks.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_group TEXT,
                    scenario_id TEXT NOT NULL,
                    scenario_name TEXT,
                    category TEXT,
                    passed BOOLEAN,
                    attempt INTEGER,
                    total_cost_usd REAL,
                    duration_ms INTEGER,
                    num_turns INTEGER,
                    tool_call_count INTEGER,
                    tool_names_used TEXT,
                    verification_results TEXT,
                    error TEXT,
                    failure_category TEXT,
                    timestamp REAL,
                    tool_call_trace TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS suite_runs (
                    id TEXT PRIMARY KEY,
                    suite_name TEXT,
                    total_scenarios INTEGER,
                    passed INTEGER,
                    failed INTEGER,
                    total_cost_usd REAL,
                    total_duration_ms INTEGER,
                    started_at REAL,
                    ended_at REAL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_runs_scenario ON runs(scenario_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_runs_group ON runs(run_group)"
            )
            conn.commit()
        finally:
            conn.close()

    def store(self, result: RunResult, run_group: str | None = None):
        """Store a run result in the database."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                """INSERT INTO runs (
                    run_group, scenario_id, scenario_name, category, passed, attempt,
                    total_cost_usd, duration_ms, num_turns, tool_call_count,
                    tool_names_used, verification_results, error, failure_category,
                    timestamp, tool_call_trace
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    run_group,
                    result.scenario_id,
                    result.scenario_name,
                    result.category,
                    result.passed,
                    result.attempt,
                    result.total_cost_usd,
                    result.duration_ms,
                    result.num_turns,
                    result.tool_call_count,
                    json.dumps(result.tool_names_used),
                    json.dumps(result.verification_results),
                    result.error,
                    result.failure_category,
                    result.timestamp,
                    json.dumps(result.tool_call_trace),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def get_pass_rate(self, scenario_id: str, last_n: int = 10) -> float:
        """Get pass rate for a scenario over the last N runs."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                "SELECT passed FROM runs WHERE scenario_id = ? ORDER BY timestamp DESC LIMIT ?",
                (scenario_id, last_n),
            )
            rows = cursor.fetchall()
        finally:
            conn.close()
        if not rows:
            return 0.0
        return sum(1 for r in rows if r[0]) / len(rows)

    def get_cost_trend(self, scenario_id: str, last_n: int = 10) -> list[float]:
        """Get cost trend for a scenario."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                "SELECT total_cost_usd FROM runs WHERE scenario_id = ? "
                "AND total_cost_usd IS NOT NULL ORDER BY timestamp DESC LIMIT ?",
                (scenario_id, last_n),
            )
            rows = cursor.fetchall()
        finally:
            conn.close()
        return [r[0] for r in reversed(rows)]

    def get_recent_runs(
        self, scenario_id: str | None = None, last_n: int = 20
    ) -> list[dict[str, Any]]:
        """Get recent runs, optionally filtered by scenario."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.row_factory = sqlite3.Row
            if scenario_id:
                cursor = conn.execute(
                    "SELECT * FROM runs WHERE scenario_id = ? ORDER BY timestamp DESC LIMIT ?",
                    (scenario_id, last_n),
                )
            else:
                cursor = conn.execute(
                    "SELECT * FROM runs ORDER BY timestamp DESC LIMIT ?",
                    (last_n,),
                )
            rows = [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()
        return rows
