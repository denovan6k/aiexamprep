---
title: Chat visualizations
description: How Knorvex streams animated demos from the render_visualization tool.
---

# Chat visualizations

Knorvex can answer with an interactive **animation player**—Prev / Play / Next—when seeing a process beat reading about it. The model calls a server-side tool; the client renders a `data-visualization` part.

## Purpose

The visualizer **demonstrates** how something works as changing visual shots (Prev / Play / Next). Any subject — sorting, chemistry, and water cycles are **style examples only**, not a topic allowlist. Invent the motion that fits the user's ask.

**Do not use it for:** paragraphs, bullet definitions, “what is X” essays, or static labeled diagrams that only name parts.

Written explanations stay in normal AI Elements chat markdown (and quizzes / flashcards / artifacts when those fit). If the model cannot animate the process across frames, it should skip `render_visualization`.

Sorting engines are an optional verified shortcut for classic array sorts (same Play controls).

## Three lanes

| Lane | When | Who owns correctness | UI |
|---|---|---|---|
| **Generic frames (default)** | Any subject **animation** (changing shots) | Model draws each shot; host plays | Prev / Play / Next |
| **Known sort engine** | Classic array sorts only | Server | Bar React UI + same controls |
| **Static freeform** | One still picture | Model | Single sandboxed iframe (not an animation) |

`kind=step_demo` with only `engine=freeform` and no `frames` is **rejected**. If `frames` are present, the server coerces to `engine=frames` even when the model mislabels the engine.

## Tool: `render_visualization`

Defined in `api/app/services/visualization_tool.py` and always offered on the chat tool loop (alongside any professor-agent MCP tools).

| Argument | Purpose |
|---|---|
| `kind` | Prefer `step_demo` for animations |
| `title` | Widget heading |
| `engine` | Usually `frames`; optional sort id; or `freeform` for one still |
| `input` | Engine parameters (e.g. `{ "array": [5, 2, 8, 1] }`) |
| `frames` | Ordered `{ message, html }` **shots** (max 24; prefer enough shots that Play feels like motion). Each `message` is a one-line step guide under the player. |
| `html` | Still picture — **only** when `engine` is `freeform` |
| `caption` | Optional short subtitle |

### Generic frames (`engine=frames`) — default

Any subject as an animation. Each `html` is one visual shot mid-process; consecutive shots must change. Each `message` is a clear one-line guide shown under Prev / Play / Next (what is happening / what to notice)—not prose inside the SVG:

```json
{
  "kind": "step_demo",
  "title": "Acid–base neutralization",
  "engine": "frames",
  "frames": [
    { "message": "H+ and OH− approach from opposite sides.", "html": "<svg>…H+ and OH− apart…</svg>" },
    { "message": "The ions collide and begin to bond.", "html": "<svg>…ions meet…</svg>" },
    { "message": "Neutralization forms a water molecule.", "html": "<svg>…H2O forms…</svg>" }
  ]
}
```

After the tool returns, the model should not lecture—at most invite the user to press Play.

### Known sort engines (optional shortcut)

Verified on the server for classic array sorts only: `bubble_sort`, `insertion_sort`, `selection_sort`, `merge_sort`, `quick_sort`. Pass `kind=step_demo` and `input.array` (a default array is used if missing).

### Static freeform

Use `engine=freeform` only for a **single** still (`kind` should not be `step_demo`). Size-limited, lightly validated, sandboxed iframe (`sandbox="allow-scripts"`).

### Theme contract for HTML

Host-injected tokens only:

- `var(--kv-bg)`, `var(--kv-fg)`, `var(--kv-card)`, `var(--kv-muted)`, `var(--kv-muted-fg)`, `var(--kv-border)`, `var(--kv-primary)`
- Accents: `kv-danger`, `kv-success`, `kv-info`

Do **not** hardcode `#fff`, `#000`, cream, or light-theme purple. Prefer SVG with `stroke="currentColor"` or `fill="var(--kv-primary)"`.

Add verified engines to `ENGINE_REGISTRY` in `visualization_tool.py`. Bar frames use `array`, `comparing`, `swapping`, `sorted_until`, `message`; animation shots use `message` + `html`.

## Stream and persistence

1. Chat stream builds OpenAI-style messages and runs `run_tool_loop` with `extra_tools=[render_visualization]`.
2. On a visualization call, the API emits AI SDK `tool-*` lifecycle events, then a `data-visualization` SSE part with the resolved payload.
3. The assistant message stores `metadata.visualization` (last viz in the turn) so history reloads the widget via `data_parts_from_assistant_payload` / `apiMessageToUIMessage`.

Tool calling is not supported on the Anthropic platform path yet; those turns fall back to normal text streaming without the tool.

## Client UI

- Types: `PrepwiseDataParts.visualization` in `client/lib/chat-ui-message.ts`.
- Renderer: `client/components/chat/visualization-widget.tsx`
  - Frames with `array` → React bar chrome + controls
  - Frames with `html` → themed shot iframes + same controls
  - Frame `message` → one-line step guide above the Prev / Play / Next bar
  - Static freeform → single themed iframe (+ “View full diagram” when clipped)
- Theme tokens sync with `useLayoutEffect` before paint; iframes wait for sync and remount on light/dark so `srcDoc` isn’t stuck on SSR light defaults. Browser extension attributes such as `bis_skin_checked` are unrelated noise—not app hydration bugs.
- Mounted from `PrepwiseChatMessage` next to other generative cards. MCP `tool_calls` UI skips `render_visualization` so the widget is not duplicated as collapsed JSON.

## Minimal examples

### Bubble sort (known engine)

```json
{
  "name": "render_visualization",
  "arguments": {
    "kind": "step_demo",
    "title": "Bubble sort",
    "engine": "bubble_sort",
    "input": { "array": [5, 2, 8, 1] },
    "caption": "Watch adjacent swaps."
  }
}
```

### Any-subject animation (`engine=frames`)

```json
{
  "name": "render_visualization",
  "arguments": {
    "kind": "step_demo",
    "title": "Water cycle",
    "engine": "frames",
    "frames": [
      { "message": "Liquid water evaporates as vapor rises.", "html": "<svg>…droplet rising…</svg>" },
      { "message": "Vapor cools and gathers into a cloud.", "html": "<svg>…vapor gathers…</svg>" },
      { "message": "Droplets fall as rain back to the surface.", "html": "<svg>…droplets falling…</svg>" }
    ]
  }
}
```
