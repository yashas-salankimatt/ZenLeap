"""Tests for scenario definitions — validate all scenarios are well-formed."""

import pytest

from bench.scenarios import ALL_SCENARIOS
from bench.scenario import Scenario, ScenarioCategory


class TestScenarioDefinitions:
    def test_all_scenarios_have_ids(self):
        for s in ALL_SCENARIOS:
            assert s.id, f"Scenario missing id: {s.name}"
            assert isinstance(s.id, str)

    def test_all_ids_unique(self):
        ids = [s.id for s in ALL_SCENARIOS]
        assert len(ids) == len(set(ids)), f"Duplicate ids: {ids}"

    def test_all_scenarios_have_prompts(self):
        for s in ALL_SCENARIOS:
            assert len(s.prompt) > 10, f"{s.id}: prompt too short"

    def test_all_scenarios_have_verifications(self):
        for s in ALL_SCENARIOS:
            assert len(s.verifications) > 0, (
                f"{s.id}: no verifications"
            )

    def test_all_scenarios_have_valid_category(self):
        for s in ALL_SCENARIOS:
            assert isinstance(s.category, ScenarioCategory)

    def test_budget_within_limits(self):
        for s in ALL_SCENARIOS:
            limit = 2.0 if "regression" in s.tags else 1.0
            assert s.max_budget_usd <= limit, (
                f"{s.id}: budget ${s.max_budget_usd} exceeds ${limit:.2f} limit"
            )

    def test_turns_within_limits(self):
        for s in ALL_SCENARIOS:
            assert s.max_turns <= 50, (
                f"{s.id}: {s.max_turns} turns exceeds 50 limit"
            )

    def test_tags_are_strings(self):
        for s in ALL_SCENARIOS:
            for tag in s.tags:
                assert isinstance(tag, str)

    def test_smoke_suite_exists(self):
        smoke = [s for s in ALL_SCENARIOS if "smoke" in s.tags]
        assert len(smoke) >= 3, "Need at least 3 smoke scenarios"
