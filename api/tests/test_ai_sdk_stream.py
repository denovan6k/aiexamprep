import json

from app.services.ai_sdk_stream import iter_tool_status_events
from app.services.ai_sdk_stream import sse_status


def test_sse_status_emits_data_status_event() -> None:
    frame = sse_status("Searching your materials...")
    assert frame.startswith("data: ")
    payload = json.loads(frame.removeprefix("data: ").strip())
    assert payload == {
        "type": "data-status",
        "data": {"message": "Searching your materials..."},
    }


def test_iter_tool_status_events_includes_tool_name_on_input_available() -> None:
    frames = list(
        iter_tool_status_events(
            [
                {
                    "tool": "render_visualization",
                    "input": {"kind": "html", "html": "<div>ok</div>"},
                    "result": "Rendered visualization.",
                    "visualization": {"kind": "html"},
                }
            ]
        )
    )
    payloads = [json.loads(frame.removeprefix("data: ").strip()) for frame in frames]
    assert payloads[0]["type"] == "tool-input-start"
    assert payloads[0]["toolName"] == "render_visualization"
    assert payloads[1]["type"] == "tool-input-available"
    assert payloads[1]["toolName"] == "render_visualization"
    assert payloads[1]["input"]["kind"] == "html"
    assert payloads[2]["type"] == "tool-output-available"
    assert payloads[2]["output"]["has_visualization"] is True
