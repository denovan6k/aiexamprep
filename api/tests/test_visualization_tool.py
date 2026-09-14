"""Tests for chat visualization tool engines, frames path, and freeform validation."""

from __future__ import annotations

import pytest

from app.services.visualization_tool import (
    RENDER_VISUALIZATION_OPENAI_TOOL,
    RENDER_VISUALIZATION_TOOL_NAME,
    THEME_HTML_INSTRUCTIONS,
    _MAX_FRAMES,
    execute_visualization,
)


def test_tool_schema_name() -> None:
    assert RENDER_VISUALIZATION_OPENAI_TOOL["function"]["name"] == RENDER_VISUALIZATION_TOOL_NAME


def test_tool_description_covers_lanes_and_theme() -> None:
    description = RENDER_VISUALIZATION_OPENAI_TOOL["function"]["description"]
    assert "ANIMATION" in description or "animation" in description.lower()
    assert "paragraph" in description.lower() or "text" in description.lower()
    assert "frames" in description
    assert "merge_sort" in description
    assert "SHOT" in THEME_HTML_INSTRUCTIONS or "shot" in THEME_HTML_INSTRUCTIONS.lower()
    assert "var(--kv-fg)" in THEME_HTML_INSTRUCTIONS
    assert "kv-danger" in THEME_HTML_INSTRUCTIONS
    assert "paragraph" in THEME_HTML_INSTRUCTIONS.lower()


def test_bubble_sort_engine_is_deterministic() -> None:
    result = execute_visualization(
        {
            "kind": "step_demo",
            "title": "Bubble sort",
            "engine": "bubble_sort",
            "input": {"array": [5, 2, 8, 1]},
            "html": "<script>evil()</script>",
            "caption": "Watch swaps",
        }
    )
    assert result["engine"] == "bubble_sort"
    assert result["final"] == [1, 2, 5, 8]
    assert result["initial"] == [5, 2, 8, 1]
    assert "html" not in result
    assert len(result["frames"]) > 3
    assert result["frames"][0]["array"] == [5, 2, 8, 1]
    assert result["frames"][-1]["array"] == [1, 2, 5, 8]


def test_insertion_sort_engine() -> None:
    result = execute_visualization(
        {
            "kind": "step_demo",
            "title": "Insertion sort",
            "engine": "insertion_sort",
            "input": {"array": [3, 1, 2]},
        }
    )
    assert result["final"] == [1, 2, 3]
    assert all("message" in frame for frame in result["frames"])


@pytest.mark.parametrize(
    "engine",
    ["selection_sort", "merge_sort", "quick_sort"],
)
def test_additional_sort_engines(engine: str) -> None:
    result = execute_visualization(
        {
            "kind": "step_demo",
            "title": engine,
            "engine": engine,
            "input": {"array": [5, 2, 8, 1]},
        }
    )
    assert result["final"] == [1, 2, 5, 8]
    assert result["initial"] == [5, 2, 8, 1]
    assert len(result["frames"]) > 2
    assert result["frames"][-1]["array"] == [1, 2, 5, 8]


def test_sort_engine_defaults_array_when_missing() -> None:
    result = execute_visualization(
        {"kind": "step_demo", "title": "Default array", "engine": "bubble_sort"}
    )
    assert result["initial"] == [38, 27, 43, 3, 9, 82, 10]
    assert result["final"] == sorted(result["initial"])


def test_model_frames_html_steps() -> None:
    result = execute_visualization(
        {
            "kind": "step_demo",
            "title": "Photosynthesis steps",
            "engine": "frames",
            "frames": [
                {
                    "message": "Light absorption",
                    "html": '<div style="color: var(--kv-fg)">Chlorophyll absorbs light</div>',
                },
                {
                    "message": "ATP made",
                    "html": '<div class="kv-success">Energy stored</div>',
                },
            ],
        }
    )
    assert result["engine"] == "frames"
    assert len(result["frames"]) == 2
    assert "var(--kv-fg)" in result["frames"][0]["html"]
    assert result["frames"][1]["message"] == "ATP made"
    assert "html" not in result


def test_model_frames_cap() -> None:
    too_many = [
        {"message": f"Step {i}", "html": f"<div>{i}</div>"} for i in range(_MAX_FRAMES + 1)
    ]
    with pytest.raises(ValueError, match="at most"):
        execute_visualization(
            {
                "kind": "step_demo",
                "title": "Too many",
                "engine": "frames",
                "frames": too_many,
            }
        )


def test_step_demo_rejects_freeform() -> None:
    with pytest.raises(ValueError, match="engine=frames"):
        execute_visualization(
            {
                "kind": "step_demo",
                "title": "Bad merge essay",
                "engine": "freeform",
                "html": "<div>how to merge sort in text</div>",
            }
        )


def test_step_demo_with_frames_coerces_even_if_engine_freeform() -> None:
    result = execute_visualization(
        {
            "kind": "step_demo",
            "title": "Cell cycle",
            "engine": "freeform",
            "frames": [
                {"message": "Interphase", "html": "<div style='color:var(--kv-fg)'>G1 S G2</div>"},
                {"message": "Mitosis", "html": "<div class='kv-info'>PMAT</div>"},
            ],
        }
    )
    assert result["engine"] == "frames"
    assert len(result["frames"]) == 2


def test_step_demo_defaults_to_frames_engine() -> None:
    result = execute_visualization(
        {
            "kind": "step_demo",
            "title": "Water cycle",
            "frames": [
                {"message": "Evaporation", "html": "<div>Water rises</div>"},
                {"message": "Rain", "html": "<div>Water falls</div>"},
            ],
        }
    )
    assert result["engine"] == "frames"
    assert len(result["frames"]) == 2


def test_freeform_requires_html() -> None:
    with pytest.raises(ValueError, match="html is required"):
        execute_visualization({"kind": "diagram", "title": "X", "engine": "freeform"})


def test_freeform_rejects_javascript_urls() -> None:
    with pytest.raises(ValueError, match="javascript:"):
        execute_visualization(
            {
                "kind": "diagram",
                "title": "X",
                "engine": "freeform",
                "html": '<a href="javascript:alert(1)">x</a>',
            }
        )


def test_unknown_engine() -> None:
    with pytest.raises(ValueError, match="Unknown engine"):
        execute_visualization({"kind": "simulation", "title": "X", "engine": "quantum_sort"})
