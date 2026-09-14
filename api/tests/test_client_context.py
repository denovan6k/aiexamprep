from unittest.mock import MagicMock

import pytest

from app.core.client_context import (
    build_login_client_info,
    format_user_agent,
    is_public_ip,
    lookup_ip_location,
    resolve_client_ip,
)


def test_resolve_client_ip_prefers_cf_connecting_ip() -> None:
    request = MagicMock()
    request.headers = {
        "cf-connecting-ip": "203.0.113.5",
        "x-forwarded-for": "127.0.0.1",
    }
    request.client = MagicMock(host="127.0.0.1")

    assert resolve_client_ip(request) == "203.0.113.5"


def test_format_user_agent_parses_browser_and_platform() -> None:
    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    assert format_user_agent(ua) == "Chrome on Windows"


def test_format_user_agent_ignores_node_fetch() -> None:
    assert format_user_agent("node") is None


def test_is_public_ip() -> None:
    assert is_public_ip("8.8.8.8") is True
    assert is_public_ip("127.0.0.1") is False


def test_build_login_client_info_marks_local_network(monkeypatch: pytest.MonkeyPatch) -> None:
    request = MagicMock()
    request.headers = {
        "x-forwarded-for": "127.0.0.1",
        "user-agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
    }
    request.client = MagicMock(host="127.0.0.1")
    monkeypatch.setattr("app.core.client_context.lookup_ip_location", lambda _ip: None)

    info = build_login_client_info(request)

    assert info["ip_address"] == "127.0.0.1"
    assert info["device"] == "Chrome on macOS"
    assert info["location"] == "Local network"


def test_lookup_ip_location_returns_none_for_private_ip() -> None:
    assert lookup_ip_location("127.0.0.1") is None
