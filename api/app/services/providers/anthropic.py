from __future__ import annotations

from collections.abc import Iterator

import httpx

from app.services.providers.base import ProviderAdapter, default_model, map_provider_error


class AnthropicAdapter(ProviderAdapter):
    provider = "anthropic"
    _base_url = "https://api.anthropic.com/v1/messages"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    def validate_key(self, api_key: str) -> None:
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    self._base_url,
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": default_model("anthropic"),
                        "max_tokens": 5,
                        "messages": [{"role": "user", "content": "Reply with OK."}],
                    },
                )
                if response.status_code >= 400:
                    raise httpx.HTTPStatusError(
                        "Anthropic validation failed",
                        request=response.request,
                        response=response,
                    )
        except httpx.HTTPStatusError as exc:
            raise map_provider_error(exc) from exc
        except Exception as exc:
            raise map_provider_error(exc) from exc

    def complete(self, system: str, user: str, *, model: str | None = None) -> str:
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    self._base_url,
                    headers=self._headers(),
                    json={
                        "model": model or default_model("anthropic"),
                        "max_tokens": 2048,
                        "system": system,
                        "messages": [{"role": "user", "content": user}],
                    },
                )
                response.raise_for_status()
                payload = response.json()
                parts = payload.get("content") or []
                text = "".join(part.get("text", "") for part in parts if part.get("type") == "text")
                return text.strip()
        except Exception as exc:
            raise map_provider_error(exc) from exc

    def stream(self, system: str, user: str, *, model: str | None = None) -> Iterator[str]:
        try:
            with httpx.Client(timeout=60.0) as client:
                with client.stream(
                    "POST",
                    self._base_url,
                    headers={**self._headers(), "accept": "text/event-stream"},
                    json={
                        "model": model or default_model("anthropic"),
                        "max_tokens": 2048,
                        "stream": True,
                        "system": system,
                        "messages": [{"role": "user", "content": user}],
                    },
                ) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:].strip()
                        if not data or data == "[DONE]":
                            continue
                        import json

                        event = json.loads(data)
                        if event.get("type") != "content_block_delta":
                            continue
                        delta = event.get("delta") or {}
                        text = delta.get("text")
                        if text:
                            yield text
        except Exception as exc:
            raise map_provider_error(exc) from exc
