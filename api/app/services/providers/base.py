from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import Any


class ProviderError(Exception):
    pass


class ProviderAuthError(ProviderError):
    pass


class ProviderRateLimitError(ProviderError):
    pass


class ProviderAdapter(ABC):
    provider: str

    @abstractmethod
    def validate_key(self, api_key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def complete(self, system: str, user: str, *, model: str | None = None) -> str:
        raise NotImplementedError

    @abstractmethod
    def stream(self, system: str, user: str, *, model: str | None = None) -> Iterator[str]:
        raise NotImplementedError


def default_model(provider: str) -> str:
    if provider == "anthropic":
        return "claude-3-5-haiku-latest"
    return "gpt-4o-mini"


def get_adapter(provider: str, api_key: str) -> ProviderAdapter:
    if provider == "openai":
        from app.services.providers.openai import OpenAIAdapter

        return OpenAIAdapter(api_key)
    if provider == "anthropic":
        from app.services.providers.anthropic import AnthropicAdapter

        return AnthropicAdapter(api_key)
    raise ProviderError(f"Unsupported provider: {provider}")


def map_provider_error(exc: Exception) -> ProviderError:
    message = str(exc).lower()
    status_code = getattr(exc, "status_code", None)
    response = getattr(exc, "response", None)
    if response is not None:
        status_code = getattr(response, "status_code", status_code)
    if status_code == 429 or "rate limit" in message or "429" in message:
        return ProviderRateLimitError(
            "Your API provider is rate-limiting requests. Wait a moment and try again."
        )
    if status_code in {401, 403} or "invalid api key" in message or "authentication" in message:
        return ProviderAuthError("Your API key is invalid or expired. Update it in Settings.")
    return ProviderError(str(exc) or "The AI provider returned an unexpected error.")
