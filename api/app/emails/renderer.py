from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

BRAND = {
    "name": "Knorvex",
    "tagline": "Modern exam prep for modern students",
    "primary": "#4B3D8F",
    "accent": "#7EE8D8",
    "background": "#F4FBF8",
    "surface": "#FFFFFF",
    "border": "#D8EEE8",
    "text": "#3D2E6B",
    "muted": "#6B5F8C",
    "button_text": "#E8FFF5",
    "danger": "#B42318",
    "font_stack": (
        "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "
        "'Segoe UI', Helvetica, Arial, sans-serif"
    ),
}

LOGO_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 32 32" fill="none" role="img" aria-label="Knorvex">
  <rect width="32" height="32" rx="7" fill="#4B3D8F"/>
  <path d="M10.5 9v14M10.5 16L16.5 9M10.5 16l9 8" stroke="#E8FFF5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="23" cy="9" r="2" fill="#7EE8D8"/>
</svg>"""

_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
)


def _base_context() -> dict[str, object]:
    app_url = settings.app_public_url.rstrip("/")
    return {
        "brand": BRAND,
        "app_url": app_url,
        "logo_url": f"{app_url}/logo.svg",
        "logo_svg": LOGO_SVG,
        "year": datetime.now(UTC).year,
        "support_email": settings.effective_email_reply_to or "support@support.knorvex.com",
    }


def render_template(template_name: str, **context: object) -> tuple[str, str, str]:
    """Render an email template. Returns (subject, html, text)."""
    merged = {**_base_context(), **context}
    template = _env.get_template(template_name)
    html = template.render(**merged)
    text_template_name = template_name.replace(".html", ".txt")
    try:
        text = _env.get_template(text_template_name).render(**merged)
    except Exception:
        text = _html_to_plain(html)
    subject = str(merged.get("subject", ""))
    return subject, html, text


def _html_to_plain(html: str) -> str:
    import re

    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.I | re.S)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
