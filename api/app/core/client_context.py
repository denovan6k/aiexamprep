from __future__ import annotations

import ipaddress
import logging

import httpx
from fastapi import Request

logger = logging.getLogger(__name__)

_IP_HEADERS = (
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
    "x-vercel-forwarded-for",
)


def resolve_client_ip(request: Request) -> str | None:
    for header in _IP_HEADERS:
        value = request.headers.get(header)
        if not value:
            continue
        candidate = value.split(",", 1)[0].strip()
        if candidate:
            return candidate
    if request.client is not None:
        return request.client.host
    return None


def is_public_ip(ip: str | None) -> bool:
    if not ip:
        return False
    try:
        return ipaddress.ip_address(ip).is_global
    except ValueError:
        return False


def format_user_agent(user_agent: str | None) -> str | None:
    if not user_agent:
        return None

    ua = user_agent.strip()
    if not ua:
        return None

    lowered = ua.lower()
    if lowered.startswith("node") or lowered == "undici":
        return None

    browser = _detect_browser(lowered)
    platform = _detect_platform(lowered)
    if browser and platform:
        return f"{browser} on {platform}"
    return ua[:120]


def lookup_ip_location(ip: str | None) -> str | None:
    if not ip or not is_public_ip(ip):
        return None

    try:
        response = httpx.get(
            f"https://ipwho.is/{ip}",
            timeout=3.0,
            headers={"User-Agent": "Knorvex/1.0"},
        )
        if response.status_code != 200:
            return None
        payload = response.json()
        if not payload.get("success"):
            return None

        city = str(payload.get("city") or "").strip()
        region = str(payload.get("region") or "").strip()
        country = str(payload.get("country") or "").strip()
        parts = [part for part in (city, region, country) if part]
        return ", ".join(parts) if parts else None
    except Exception:
        logger.debug("IP geolocation lookup failed for ip=%s", ip, exc_info=True)
        return None


def build_login_client_info(request: Request) -> dict[str, str | None]:
    ip_address = resolve_client_ip(request)
    user_agent = request.headers.get("user-agent")
    device = format_user_agent(user_agent)
    location = lookup_ip_location(ip_address)

    if ip_address and not is_public_ip(ip_address):
        location = location or "Local network"

    return {
        "ip_address": ip_address,
        "device": device,
        "location": location,
    }


def _detect_browser(lowered: str) -> str | None:
    if "edg/" in lowered or "edge/" in lowered:
        return "Microsoft Edge"
    if "opr/" in lowered or "opera" in lowered:
        return "Opera"
    if "firefox/" in lowered:
        return "Firefox"
    if "chrome/" in lowered or "crios/" in lowered:
        return "Chrome"
    if "safari/" in lowered:
        return "Safari"
    return None


def _detect_platform(lowered: str) -> str | None:
    if "iphone" in lowered:
        return "iPhone"
    if "ipad" in lowered:
        return "iPad"
    if "android" in lowered:
        return "Android"
    if "windows" in lowered:
        return "Windows"
    if "mac os x" in lowered or "macintosh" in lowered:
        return "macOS"
    if "cros" in lowered:
        return "ChromeOS"
    if "linux" in lowered:
        return "Linux"
    return None
