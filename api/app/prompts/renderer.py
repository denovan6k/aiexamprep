"""Jinja2 prompt rendering with zero-trust untrusted-content helpers."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, TemplateNotFound

PROMPT_DIR = Path(__file__).resolve().parent

_UNTRUSTED_CLOSE_RE = re.compile(r"</?\s*untrusted_[a-z0-9_]+\s*>", re.I)


def sanitize_untrusted(text: str | None) -> str:
    """Neutralize fence-breaking sequences in untrusted payload text."""
    if not text:
        return ""
    return _UNTRUSTED_CLOSE_RE.sub(lambda m: m.group(0).replace("<", "‹").replace(">", "›"), text)


@lru_cache(maxsize=1)
def _env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(PROMPT_DIR)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["sanitize_untrusted"] = sanitize_untrusted
    return env


def render_prompt(name: str, *, fallback: str | None = None, **context: Any) -> str:
    """Render a prompt template. Returns fallback (or empty) if missing/empty."""
    try:
        template = _env().get_template(name)
        rendered = template.render(**context).strip()
        if rendered:
            return rendered
    except TemplateNotFound:
        pass
    except OSError:
        pass
    return (fallback or "").strip()


def untrusted_block(label: str, body: str | None) -> str:
    """Wrap sanitized text in a named untrusted fence (also available as a Jinja macro)."""
    safe = sanitize_untrusted(body)
    tag = re.sub(r"[^a-z0-9_]+", "_", label.strip().lower()) or "content"
    return f"<untrusted_{tag}>\n{safe}\n</untrusted_{tag}>"
