from __future__ import annotations

from collections.abc import Iterator

from app.services.providers.base import ProviderAdapter, default_model, map_provider_error


class OpenAIAdapter(ProviderAdapter):
    provider = "openai"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def _client(self):
        from openai import OpenAI

        return OpenAI(api_key=self.api_key)

    def validate_key(self, api_key: str) -> None:
        try:
            client = OpenAI(api_key=api_key)
            client.chat.completions.create(
                model=default_model("openai"),
                messages=[{"role": "user", "content": "Reply with OK."}],
                max_tokens=5,
            )
        except Exception as exc:
            raise map_provider_error(exc) from exc

    def complete(self, system: str, user: str, *, model: str | None = None) -> str:
        try:
            completion = self._client().chat.completions.create(
                model=model or default_model("openai"),
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.5,
            )
            return (completion.choices[0].message.content or "").strip()
        except Exception as exc:
            raise map_provider_error(exc) from exc

    def stream(self, system: str, user: str, *, model: str | None = None) -> Iterator[str]:
        try:
            stream = self._client().chat.completions.create(
                model=model or default_model("openai"),
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.5,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
        except Exception as exc:
            raise map_provider_error(exc) from exc
