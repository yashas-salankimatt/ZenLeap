"""Benchmark scenario definitions."""

from bench.scenarios.amazon_cart import AMAZON_SCENARIOS
from bench.scenarios.navigation import NAVIGATION_SCENARIOS
from bench.scenarios.youtube_history import YOUTUBE_SCENARIOS

ALL_SCENARIOS = [
    *NAVIGATION_SCENARIOS,
    *YOUTUBE_SCENARIOS,
    *AMAZON_SCENARIOS,
]
