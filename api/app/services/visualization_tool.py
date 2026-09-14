"""Interactive visualization tool for chat: schema, engines, and execution."""

from __future__ import annotations

from typing import Any, Callable

RENDER_VISUALIZATION_TOOL_NAME = "render_visualization"

_MAX_FREEFORM_HTML_CHARS = 80_000
_MAX_FRAME_HTML_CHARS = 12_000
_MAX_FRAMES = 24
_MAX_SORT_ARRAY_LEN = 24
_MAX_SORT_VALUE = 10_000
_DEFAULT_SORT_ARRAY = [38, 27, 43, 3, 9, 82, 10]

VISUALIZATION_KINDS = ("diagram", "chart", "simulation", "step_demo")

THEME_HTML_INSTRUCTIONS = (
    "Each frame html is one ANIMATION SHOT (flipbook cell): draw the scene mid-action "
    "so Play looks like a movie. Examples of motion (not a closed list): objects moving, "
    "swapping, colliding, transforming, flowing, assembling — invent whatever fits the topic. "
    "Little or no text inside the scene — at most 1–3 tiny labels if needed. "
    "NO paragraphs, bullet lists, definitions, or 'what is X' copy. "
    "NO static labeled textbook diagrams that only name parts without showing motion. "
    "Consecutive frames must CHANGE. Keep each shot compact (simple SVG/CSS). "
    "Colors ONLY: var(--kv-bg), var(--kv-fg), var(--kv-card), var(--kv-muted), "
    "var(--kv-muted-fg), var(--kv-border), var(--kv-primary); accents kv-danger, kv-success, kv-info. "
    "Prefer SVG/CSS visuals with fill=var(--kv-primary) or stroke=currentColor."
)

SORT_ENGINE_IDS = (
    "bubble_sort",
    "insertion_sort",
    "selection_sort",
    "merge_sort",
    "quick_sort",
)

RENDER_VISUALIZATION_OPENAI_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": RENDER_VISUALIZATION_TOOL_NAME,
        "description": (
            "ANIMATION player (Prev/Play/Next) that DEMONSTRATES how something works for ANY "
            "subject — not limited to sorting, chemistry, or water cycles; those are only "
            "examples of the motion style. Invent the right animated shots for the user's topic. "
            "Show the process happening across frames; put guidance in each frame's message, "
            "not inside the HTML scene. "
            "DEFAULT: kind=step_demo, engine=frames, frames=[{message, html}] where each html is "
            "a visual SHOT of the scene at that moment (things move/change between shots). "
            "message = required one-line step guide shown under the player "
            "(what is happening now / what to notice), roughly 8–20 words. "
            "If the user needs a written explanation instead of a demo, skip this tool and use "
            "normal markdown (AI Elements chat). "
            "OPTIONAL verified array sorts: "
            f"{', '.join(SORT_ENGINE_IDS)} with input.array. "
            "engine=freeform only for one static picture (not an animation). "
            + THEME_HTML_INSTRUCTIONS
        ),
        "parameters": {
            "type": "object",
            "required": ["kind", "title", "engine"],
            "properties": {
                "kind": {
                    "type": "string",
                    "enum": list(VISUALIZATION_KINDS),
                },
                "title": {"type": "string"},
                "engine": {
                    "type": "string",
                    "description": (
                        "Usually 'frames' (any-topic animation shots). "
                        f"Optional verified sorts: {', '.join(SORT_ENGINE_IDS)}. "
                        "Or 'freeform' for one static picture only."
                    ),
                },
                "input": {
                    "type": "object",
                    "description": 'Optional. For sort engines: {"array":[5,2,8,1]}.',
                },
                "frames": {
                    "type": "array",
                    "description": (
                        "Ordered animation shots [{message, html}, …]. Each html shows the "
                        f"scene mid-process (not prose). Prefer 6–{_MAX_FRAMES} shots so Play animates. "
                        "Every shot needs a clear message guide for the control bar. "
                        "Use theme CSS variables."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "message": {
                                "type": "string",
                                "description": (
                                    "One-line step guide for the control bar: what is happening "
                                    "in this shot (about 8–20 words). Required for every frame."
                                ),
                            },
                            "html": {
                                "type": "string",
                                "description": "One visual shot of the animation (SVG/CSS scene).",
                            },
                            "array": {
                                "type": "array",
                                "items": {"type": "integer"},
                            },
                            "comparing": {
                                "type": "array",
                                "items": {"type": "integer"},
                            },
                            "swapping": {
                                "type": "array",
                                "items": {"type": "integer"},
                            },
                            "sorted_until": {"type": ["integer", "null"]},
                        },
                    },
                },
                "html": {
                    "type": "string",
                    "description": (
                        "Self-contained visual HTML/SVG for engine=freeform only "
                        "(static picture; not prose; not step_demo)."
                    ),
                },
                "caption": {"type": "string"},
            },
        },
    },
}


def _normalize_kind(raw: Any) -> str:
    kind = str(raw or "diagram").strip().lower().replace("-", "_")
    if kind not in VISUALIZATION_KINDS:
        return "diagram"
    return kind


def _normalize_title(raw: Any) -> str:
    title = str(raw or "Visualization").strip()
    return title[:200] or "Visualization"


def _normalize_caption(raw: Any) -> str | None:
    if raw is None:
        return None
    caption = str(raw).strip()
    return caption[:500] or None


def _parse_int_array(value: Any, *, allow_default: bool = True) -> list[int]:
    if (value is None or value == []) and allow_default:
        value = list(_DEFAULT_SORT_ARRAY)
    if not isinstance(value, list) or not value:
        raise ValueError("input.array must be a non-empty list of numbers.")
    if len(value) > _MAX_SORT_ARRAY_LEN:
        raise ValueError(f"input.array may have at most {_MAX_SORT_ARRAY_LEN} elements.")
    result: list[int] = []
    for item in value:
        try:
            number = int(item)
        except (TypeError, ValueError) as exc:
            raise ValueError("input.array must contain only integers.") from exc
        if abs(number) > _MAX_SORT_VALUE:
            raise ValueError(f"Array values must be between -{_MAX_SORT_VALUE} and {_MAX_SORT_VALUE}.")
        result.append(number)
    return result


def _sort_frame(
    array: list[int],
    *,
    comparing: list[int] | None = None,
    swapping: list[int] | None = None,
    sorted_until: int | None = None,
    message: str,
) -> dict[str, Any]:
    return {
        "array": list(array),
        "comparing": list(comparing or []),
        "swapping": list(swapping or []),
        "sorted_until": sorted_until,
        "message": message,
    }


def engine_bubble_sort(params: dict[str, Any]) -> dict[str, Any]:
    array = _parse_int_array(params.get("array"))
    working = list(array)
    frames: list[dict[str, Any]] = [
        _sort_frame(working, message="Start with the unsorted array.")
    ]
    n = len(working)
    for end in range(n - 1, 0, -1):
        swapped = False
        for i in range(end):
            frames.append(
                _sort_frame(
                    working,
                    comparing=[i, i + 1],
                    sorted_until=end + 1 if end + 1 < n else None,
                    message=f"Compare indexes {i} and {i + 1}.",
                )
            )
            if working[i] > working[i + 1]:
                working[i], working[i + 1] = working[i + 1], working[i]
                swapped = True
                frames.append(
                    _sort_frame(
                        working,
                        swapping=[i, i + 1],
                        sorted_until=end + 1 if end + 1 < n else None,
                        message=f"Swap indexes {i} and {i + 1}.",
                    )
                )
        frames.append(
            _sort_frame(
                working,
                sorted_until=end,
                message=f"Value at index {end} is in its final place.",
            )
        )
        if not swapped:
            break
    frames.append(_sort_frame(working, sorted_until=0, message="Array is sorted."))
    return {"frames": frames, "initial": list(array), "final": list(working)}


def engine_insertion_sort(params: dict[str, Any]) -> dict[str, Any]:
    array = _parse_int_array(params.get("array"))
    working = list(array)
    frames: list[dict[str, Any]] = [
        _sort_frame(working, message="Start with the unsorted array.")
    ]
    for i in range(1, len(working)):
        key = working[i]
        j = i - 1
        frames.append(
            _sort_frame(
                working,
                comparing=[i],
                sorted_until=i,
                message=f"Take key {key} at index {i}.",
            )
        )
        while j >= 0 and working[j] > key:
            frames.append(
                _sort_frame(
                    working,
                    comparing=[j, j + 1],
                    sorted_until=i,
                    message=f"Shift {working[j]} one position right.",
                )
            )
            working[j + 1] = working[j]
            j -= 1
        working[j + 1] = key
        frames.append(
            _sort_frame(
                working,
                swapping=[j + 1],
                sorted_until=i + 1,
                message=f"Insert key {key} at index {j + 1}.",
            )
        )
    frames.append(_sort_frame(working, sorted_until=0, message="Array is sorted."))
    return {"frames": frames, "initial": list(array), "final": list(working)}


def engine_selection_sort(params: dict[str, Any]) -> dict[str, Any]:
    array = _parse_int_array(params.get("array"))
    working = list(array)
    frames: list[dict[str, Any]] = [
        _sort_frame(working, message="Start with the unsorted array.")
    ]
    n = len(working)
    for i in range(n - 1):
        min_idx = i
        frames.append(
            _sort_frame(
                working,
                comparing=[i],
                sorted_until=i,
                message=f"Find the minimum in the unsorted suffix starting at {i}.",
            )
        )
        for j in range(i + 1, n):
            frames.append(
                _sort_frame(
                    working,
                    comparing=[min_idx, j],
                    sorted_until=i,
                    message=f"Compare current min index {min_idx} with {j}.",
                )
            )
            if working[j] < working[min_idx]:
                min_idx = j
        if min_idx != i:
            working[i], working[min_idx] = working[min_idx], working[i]
            frames.append(
                _sort_frame(
                    working,
                    swapping=[i, min_idx],
                    sorted_until=i + 1,
                    message=f"Swap index {i} with minimum at {min_idx}.",
                )
            )
        else:
            frames.append(
                _sort_frame(
                    working,
                    sorted_until=i + 1,
                    message=f"Index {i} already holds the minimum.",
                )
            )
    frames.append(_sort_frame(working, sorted_until=0, message="Array is sorted."))
    return {"frames": frames, "initial": list(array), "final": list(working)}


def engine_merge_sort(params: dict[str, Any]) -> dict[str, Any]:
    array = _parse_int_array(params.get("array"))
    working = list(array)
    frames: list[dict[str, Any]] = [
        _sort_frame(working, message="Start with the unsorted array (merge sort).")
    ]

    def merge(left: int, mid: int, right: int) -> None:
        left_part = working[left : mid + 1]
        right_part = working[mid + 1 : right + 1]
        frames.append(
            _sort_frame(
                working,
                comparing=list(range(left, right + 1)),
                message=f"Merge ranges [{left}..{mid}] and [{mid + 1}..{right}].",
            )
        )
        i = j = 0
        k = left
        while i < len(left_part) and j < len(right_part):
            frames.append(
                _sort_frame(
                    working,
                    comparing=[left + i, mid + 1 + j],
                    message=f"Compare {left_part[i]} and {right_part[j]}.",
                )
            )
            if left_part[i] <= right_part[j]:
                working[k] = left_part[i]
                i += 1
            else:
                working[k] = right_part[j]
                j += 1
            frames.append(
                _sort_frame(
                    working,
                    swapping=[k],
                    message=f"Place {working[k]} at index {k}.",
                )
            )
            k += 1
        while i < len(left_part):
            working[k] = left_part[i]
            frames.append(
                _sort_frame(
                    working,
                    swapping=[k],
                    message=f"Copy remaining {working[k]} to index {k}.",
                )
            )
            i += 1
            k += 1
        while j < len(right_part):
            working[k] = right_part[j]
            frames.append(
                _sort_frame(
                    working,
                    swapping=[k],
                    message=f"Copy remaining {working[k]} to index {k}.",
                )
            )
            j += 1
            k += 1

    def sort_range(left: int, right: int) -> None:
        if left >= right:
            return
        mid = (left + right) // 2
        frames.append(
            _sort_frame(
                working,
                comparing=list(range(left, right + 1)),
                message=f"Divide [{left}..{right}] at mid {mid}.",
            )
        )
        sort_range(left, mid)
        sort_range(mid + 1, right)
        merge(left, mid, right)

    sort_range(0, len(working) - 1)
    frames.append(_sort_frame(working, sorted_until=0, message="Array is sorted."))
    return {"frames": frames, "initial": list(array), "final": list(working)}


def engine_quick_sort(params: dict[str, Any]) -> dict[str, Any]:
    array = _parse_int_array(params.get("array"))
    working = list(array)
    frames: list[dict[str, Any]] = [
        _sort_frame(working, message="Start with the unsorted array (quick sort).")
    ]

    def partition(low: int, high: int) -> int:
        pivot = working[high]
        frames.append(
            _sort_frame(
                working,
                comparing=[high],
                message=f"Pivot is {pivot} at index {high}.",
            )
        )
        i = low
        for j in range(low, high):
            frames.append(
                _sort_frame(
                    working,
                    comparing=[j, high],
                    message=f"Compare {working[j]} with pivot {pivot}.",
                )
            )
            if working[j] < pivot:
                working[i], working[j] = working[j], working[i]
                frames.append(
                    _sort_frame(
                        working,
                        swapping=[i, j],
                        message=f"Swap indexes {i} and {j} (smaller than pivot).",
                    )
                )
                i += 1
        working[i], working[high] = working[high], working[i]
        frames.append(
            _sort_frame(
                working,
                swapping=[i, high],
                message=f"Place pivot at index {i}.",
            )
        )
        return i

    def sort_range(low: int, high: int) -> None:
        if low >= high:
            return
        frames.append(
            _sort_frame(
                working,
                comparing=list(range(low, high + 1)),
                message=f"Partition range [{low}..{high}].",
            )
        )
        pivot_index = partition(low, high)
        sort_range(low, pivot_index - 1)
        sort_range(pivot_index + 1, high)

    sort_range(0, len(working) - 1)
    frames.append(_sort_frame(working, sorted_until=0, message="Array is sorted."))
    return {"frames": frames, "initial": list(array), "final": list(working)}


ENGINE_REGISTRY: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "bubble_sort": engine_bubble_sort,
    "insertion_sort": engine_insertion_sort,
    "selection_sort": engine_selection_sort,
    "merge_sort": engine_merge_sort,
    "quick_sort": engine_quick_sort,
}

KNOWN_ENGINE_IDS = frozenset(ENGINE_REGISTRY) | {"freeform", "frames"}


def _validate_html_snippet(html: str, *, max_chars: int, label: str) -> str:
    cleaned = html.strip()
    if not cleaned:
        raise ValueError(f"{label} html is required.")
    if len(cleaned) > max_chars:
        raise ValueError(f"{label} html must be at most {max_chars} characters.")
    if "javascript:" in cleaned.lower():
        raise ValueError(f"{label} html must not use javascript: URLs.")
    return cleaned


def _validate_freeform_html(html: str) -> str:
    return _validate_html_snippet(html, max_chars=_MAX_FREEFORM_HTML_CHARS, label="freeform")


def _normalize_model_frames(raw_frames: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_frames, list) or not raw_frames:
        raise ValueError(
            "engine=frames requires a non-empty frames array of {message, html} steps "
            f"(at most {_MAX_FRAMES})."
        )
    if len(raw_frames) > _MAX_FRAMES:
        raise ValueError(f"frames may have at most {_MAX_FRAMES} steps.")

    frames: list[dict[str, Any]] = []
    for index, item in enumerate(raw_frames):
        if not isinstance(item, dict):
            raise ValueError(f"frames[{index}] must be an object.")
        message = str(item.get("message") or f"Step {index + 1}").strip()[:300]
        frame: dict[str, Any] = {"message": message or f"Step {index + 1}"}

        if "array" in item and item.get("array") is not None:
            frame["array"] = _parse_int_array(item.get("array"), allow_default=False)
            if isinstance(item.get("comparing"), list):
                frame["comparing"] = [int(x) for x in item["comparing"][:_MAX_SORT_ARRAY_LEN]]
            if isinstance(item.get("swapping"), list):
                frame["swapping"] = [int(x) for x in item["swapping"][:_MAX_SORT_ARRAY_LEN]]
            if item.get("sorted_until") is not None:
                try:
                    frame["sorted_until"] = int(item["sorted_until"])
                except (TypeError, ValueError):
                    frame["sorted_until"] = None
        else:
            html = _validate_html_snippet(
                str(item.get("html") or ""),
                max_chars=_MAX_FRAME_HTML_CHARS,
                label=f"frames[{index}]",
            )
            frame["html"] = html
        frames.append(frame)
    return frames


def _raw_frames_from_payload(payload: dict[str, Any], params: dict[str, Any]) -> Any:
    raw_frames = payload.get("frames")
    if raw_frames is None:
        raw_frames = params.get("frames")
    return raw_frames


def execute_visualization(args: dict[str, Any] | None) -> dict[str, Any]:
    """Resolve a render_visualization tool call into a client-ready payload."""
    payload = args if isinstance(args, dict) else {}
    kind = _normalize_kind(payload.get("kind"))
    title = _normalize_title(payload.get("title"))
    caption = _normalize_caption(payload.get("caption"))
    engine = str(payload.get("engine") or "").strip().lower().replace("-", "_")
    raw_input = payload.get("input")
    params = raw_input if isinstance(raw_input, dict) else {}
    raw_frames = _raw_frames_from_payload(payload, params)

    # Prefer model-supplied frames whenever present (any subject demo).
    has_frames = isinstance(raw_frames, list) and len(raw_frames) > 0
    if has_frames and engine not in ENGINE_REGISTRY:
        engine = "frames"
    elif not engine:
        # Default: interactive frames demo for step_demo; static freeform otherwise.
        engine = "frames" if kind == "step_demo" else "freeform"

    result: dict[str, Any] = {
        "kind": kind,
        "title": title,
        "engine": engine,
        "caption": caption,
    }

    # step_demo must not be a single freeform HTML dump.
    if kind == "step_demo" and engine == "freeform" and not has_frames:
        raise ValueError(
            "kind=step_demo needs engine=frames with frames[{message, html}] for any topic "
            f"(or a verified sort engine: {', '.join(SORT_ENGINE_IDS)}). "
            "Do not use freeform for demos — skip the tool and explain in markdown instead."
        )

    if engine == "freeform":
        html = _validate_freeform_html(str(payload.get("html") or ""))
        result["html"] = html
        return result

    if engine == "frames":
        result["frames"] = _normalize_model_frames(raw_frames)
        result.pop("html", None)
        return result

    runner = ENGINE_REGISTRY.get(engine)
    if runner is None:
        known = ", ".join(sorted(KNOWN_ENGINE_IDS))
        raise ValueError(f"Unknown engine '{engine}'. Known engines: {known}.")

    computed = runner(params)
    result.update(computed)
    result.pop("html", None)
    return result


def visualization_tool_result_text(payload: dict[str, Any]) -> str:
    """Short string fed back to the model after a successful visualization resolve."""
    engine = payload.get("engine") or "unknown"
    title = payload.get("title") or "Visualization"
    frame_count = len(payload.get("frames") or [])
    extra = f", {frame_count} steps" if frame_count else ""
    return (
        f"Animation ready: {title} (engine={engine}{extra}). "
        "Do NOT explain the topic in text — at most one short line inviting the user to press Play. "
        "The UI shows the animated demo."
    )
