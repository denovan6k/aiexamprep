from __future__ import annotations


def _payload(code: str, message: str, detail: str) -> dict[str, str]:
    """User-facing LLM degradation payload.

    `detail` is shown in chat. `fallback` mirrors `detail` for older callers.
    """
    return {
        "code": code,
        "message": message,
        "detail": detail,
        "fallback": detail,
    }


def classify_llm_error(exc: Exception | str, *, is_first_interaction: bool = False) -> dict[str, str]:
    message = str(exc)
    lowered = message.lower()

    if any(token in lowered for token in ("401", "403", "auth", "unauthorized", "invalid api key")):
        return _payload(
            "auth",
            "API key invalid or expired",
            "The AI provider key is invalid or expired. Update the key in settings, or switch model source.",
        )
    if any(token in lowered for token in ("429", "rate limit", "too many requests")):
        return _payload(
            "rate_limit",
            "AI provider rate limit reached",
            "The AI provider is rate-limiting right now. Wait a minute and try again, or switch model.",
        )
    if any(token in lowered for token in ("context length", "maximum context", "too many tokens")):
        return _payload(
            "context_length",
            "AI context window exceeded",
            "The selected material is too large for the model. Try a smaller file, a narrower topic, or a different model.",
        )
    if any(token in lowered for token in ("timeout", "timed out")):
        return _payload(
            "timeout",
            "AI provider timed out",
            "The AI provider timed out before finishing. Try again, or switch to a faster model.",
        )
    if any(
        token in lowered
        for token in (
            "empty response",
            "unusable response",
            "expecting value",
            "json decode",
            "jsondecode",
            "invalid json",
        )
    ):
        return _payload(
            "empty_response",
            "AI model returned an unusable response",
            "The model returned an unusable response. Try again or pick a different model.",
        )
    if is_first_interaction:
        return _payload(
            "provider_error",
            "AI provider unavailable",
            "The AI provider couldn't complete the request. Try again shortly, switch model, or attach study materials.",
        )
    return _payload(
        "provider_error",
        "AI provider unavailable",
        "The AI provider couldn't complete the request. Try again or pick a different model.",
    )
