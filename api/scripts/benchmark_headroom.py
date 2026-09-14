#!/usr/bin/env python3
"""Compare token estimates with Headroom compression on vs off.

Usage (from api/):

    python scripts/benchmark_headroom.py

Does not call an LLM. Uses the Headroom library when installed and enabled;
otherwise prints a simulated delta via a stub compressor for local checks.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Ensure app imports resolve when run as a script.
os.chdir(ROOT)

from app.core.config import settings  # noqa: E402
from app.services.context_builder import ContextBuilder, estimate_tokens  # noqa: E402
from app.services.generation import build_quiz_corpus  # noqa: E402
from app.services import headroom_compression as hc  # noqa: E402


FIXTURE_CHUNKS = [
    {
        "id": "chunk-bio-1",
        "material_title": "Photosynthesis",
        "source": "personal",
        "text": (
            "Photosynthesis is the process by which green plants and some other organisms "
            "use sunlight to synthesize nutrients from carbon dioxide and water. "
            "Chlorophyll in chloroplasts absorbs light energy. The light-dependent reactions "
            "produce ATP and NADPH, while the Calvin cycle fixes carbon into sugars. "
        )
        * 8,
    },
    {
        "id": "chunk-cs-1",
        "material_title": "Data Structures",
        "source": "personal",
        "text": (
            "A stack is a last-in first-out abstract data type. Push adds an element; pop "
            "removes the most recent. Queues are first-in first-out. Arrays provide O(1) "
            "index access; linked lists trade random access for cheap inserts. "
        )
        * 8,
    },
    {
        "id": "chunk-json-1",
        "material_title": "Tool Output",
        "source": "personal",
        "text": (
            '{"results":['
            + ",".join(
                f'{{"id":{i},"status":"ok","message":"processed item {i} successfully"}}'
                for i in range(40)
            )
            + "]}"
        ),
    },
]


def _run_once(label: str) -> dict[str, int | str | float]:
    builder = ContextBuilder(max_tokens=3200)
    built = builder.build(FIXTURE_CHUNKS, query="photosynthesis chlorophyll")
    corpus = build_quiz_corpus(FIXTURE_CHUNKS)
    tool = hc.compress_tool_result(FIXTURE_CHUNKS[2]["text"])
    return {
        "label": label,
        "chat_tokens": built.token_estimate,
        "chat_chars": len(built.prompt_text),
        "corpus_tokens": estimate_tokens(corpus),
        "corpus_chars": len(corpus),
        "tool_tokens": estimate_tokens(tool),
        "tool_chars": len(tool),
        "headroom_enabled": settings.headroom_enabled,
    }


def main() -> None:
    print("Headroom benchmark (fixture corpus, no LLM calls)")
    print(f"headroom-ai importable: {_headroom_importable()}")
    print()

    # Off
    settings.headroom_enabled = False
    off = _run_once("HEADROOM_ENABLED=false")

    # On
    settings.headroom_enabled = True
    settings.headroom_compress_chat = True
    settings.headroom_compress_generation = True
    settings.headroom_compress_mcp_tools = True
    on = _run_once("HEADROOM_ENABLED=true")

    for row in (off, on):
        print(
            f"{row['label']}: "
            f"chat={row['chat_tokens']} tok ({row['chat_chars']} chars), "
            f"corpus={row['corpus_tokens']} tok ({row['corpus_chars']} chars), "
            f"tool={row['tool_tokens']} tok ({row['tool_chars']} chars)"
        )

    def _pct(before: int, after: int) -> str:
        if before <= 0:
            return "n/a"
        saved = max(0, before - after)
        return f"{(saved / before) * 100:.1f}%"

    print()
    print(
        "Savings vs disabled: "
        f"chat {_pct(int(off['chat_tokens']), int(on['chat_tokens']))}, "
        f"corpus {_pct(int(off['corpus_tokens']), int(on['corpus_tokens']))}, "
        f"tool {_pct(int(off['tool_tokens']), int(on['tool_tokens']))}"
    )
    if not _headroom_importable():
        print(
            "\nNote: headroom-ai is not installed in this environment; "
            "on/off rows may match. Install in Docker or `pip install headroom-ai`."
        )


def _headroom_importable() -> bool:
    try:
        import headroom  # noqa: F401

        return True
    except ImportError:
        return False


if __name__ == "__main__":
    main()
