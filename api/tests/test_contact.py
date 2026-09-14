from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.rate_limit import reset_rate_limits_for_tests


@pytest.fixture(autouse=True)
def _reset_limits() -> None:
    reset_rate_limits_for_tests()
    yield
    reset_rate_limits_for_tests()


def test_contact_happy_path(client: TestClient) -> None:
    mock_provider = MagicMock()
    with patch("app.routes.contact.get_email_provider", return_value=mock_provider):
        response = client.post(
            "/contact",
            json={
                "name": "Ada Lovelace",
                "email": "ada@example.com",
                "message": "Hello, I have a question about study groups.",
                "topic": "partnerships",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "sent successfully" in body["message"]

        mock_provider.send.assert_called_once()
        msg = mock_provider.send.call_args[0][0]
        assert msg.to == settings.effective_contact_inbox
        assert msg.reply_to == "ada@example.com"
        assert "[Contact Form]" in msg.subject
        assert "Ada Lovelace" in msg.text
        assert "ada@example.com" in msg.text
        assert "partnerships" in msg.text
        assert "study groups" in msg.text


def test_contact_validation(client: TestClient) -> None:
    # Invalid email
    res1 = client.post(
        "/contact",
        json={
            "name": "Ada",
            "email": "invalidemail",
            "message": "Hello there",
        },
    )
    assert res1.status_code == 422

    # Too short message
    res2 = client.post(
        "/contact",
        json={
            "name": "Ada",
            "email": "ada@example.com",
            "message": "Hi",
        },
    )
    assert res2.status_code == 422

    # Empty name
    res3 = client.post(
        "/contact",
        json={
            "name": "  ",
            "email": "ada@example.com",
            "message": "Hello there long enough message",
        },
    )
    assert res3.status_code == 422


def test_contact_rate_limiting(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_contact_per_hour", 2)

    mock_provider = MagicMock()
    with patch("app.routes.contact.get_email_provider", return_value=mock_provider):
        # 1st attempt - OK
        res1 = client.post(
            "/contact",
            json={
                "name": "Ada",
                "email": "user@example.com",
                "message": "Message number one",
            },
        )
        assert res1.status_code == 200

        # 2nd attempt - OK
        res2 = client.post(
            "/contact",
            json={
                "name": "Ada",
                "email": "user@example.com",
                "message": "Message number two",
            },
        )
        assert res2.status_code == 200

        # 3rd attempt - Rate limited
        res3 = client.post(
            "/contact",
            json={
                "name": "Ada",
                "email": "user@example.com",
                "message": "Message number three",
            },
        )
        assert res3.status_code == 429
        assert "Rate limit exceeded" in res3.json()["error"]["message"]
