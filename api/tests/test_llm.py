import time
from types import SimpleNamespace

from app.services import llm
from app.services.stream_chunks import StreamChunk


def test_llm_api_key_strips_configured_key(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "  sk-or-v1-test  ")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    monkeypatch.setattr(llm.settings, "default_platform_provider", "openrouter")

    assert llm.llm_api_key() == "sk-or-v1-test"
    assert llm.is_openrouter() is True


def test_openrouter_mode_uses_explicit_openrouter_key_only(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "")
    monkeypatch.setattr(llm.settings, "openai_api_key", "sk-openai-test")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    monkeypatch.setattr(llm.settings, "openai_default_model", "gpt-4o-mini")
    monkeypatch.setattr(llm.settings, "default_platform_provider", "openai")

    assert llm.is_openrouter() is False
    assert llm.resolve_model(None) == "gpt-4o-mini"


def test_openrouter_cooldown_skips_llm_json_without_calling_provider(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    llm._openrouter_rate_limited_until = 0.0

    called = {"count": 0}

    def fake_platform_client(**kwargs):
        called["count"] += 1
        return None

    monkeypatch.setattr(llm, "_platform_client", fake_platform_client)
    llm._mark_openrouter_rate_limited()

    assert llm.llm_json("system", "user") is None
    assert called["count"] == 0


def test_openrouter_client_uses_bounded_retries(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    monkeypatch.setattr(llm.settings, "default_platform_provider", "openrouter")
    llm._openai_client_cache.clear()

    captured: dict[str, object] = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setitem(
        __import__("sys").modules, "openai", type("openai", (), {"OpenAI": FakeOpenAI})
    )

    client = llm._platform_client()
    assert client is not None
    assert captured["max_retries"] == 2
    assert captured["base_url"] == llm.OPENROUTER_BASE_URL


def test_llm_text_stream_yields_stream_chunks_for_platform_client(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    llm._openrouter_rate_limited_until = 0.0

    stream = [
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(
                        content="Hello",
                        reasoning_details=None,
                    )
                )
            ]
        ),
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(
                        content=" world",
                        reasoning_details=None,
                    )
                )
            ]
        ),
    ]

    class FakeCompletions:
        def create(self, **_kwargs):
            return stream

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    monkeypatch.setattr(llm, "_platform_client", lambda **_kwargs: FakeClient())

    chunks = list(llm.llm_text_stream("system", "user"))
    assert chunks == [
        StreamChunk(kind="content", text="Hello"),
        StreamChunk(kind="content", text=" world"),
    ]


def test_llm_text_stream_wraps_byok_string_deltas(monkeypatch) -> None:
    override = llm.LlmOverride(provider="openai", api_key="sk-test")

    def fake_adapter_stream(*_args, **_kwargs):
        yield "Token "
        yield "one."

    monkeypatch.setattr(llm, "_run_with_adapter", lambda *_args, **_kwargs: fake_adapter_stream())

    chunks = list(llm.llm_text_stream("system", "user", override=override))
    assert chunks == [
        StreamChunk(kind="content", text="Token "),
        StreamChunk(kind="content", text="one."),
    ]


def test_openrouter_completion_passes_provider_and_cache_extras(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    monkeypatch.setattr(llm.settings, "default_platform_provider", "openrouter")
    llm._openrouter_rate_limited_until = 0.0
    monkeypatch.setattr(llm.settings, "openrouter_provider_ignore", "slow-provider, another-slug")
    monkeypatch.setattr(llm.settings, "openrouter_service_tier", "priority")
    monkeypatch.setattr(llm.settings, "openrouter_cache_enabled", True)

    captured: dict[str, object] = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return []

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    monkeypatch.setattr(llm, "_platform_client", lambda **_kwargs: FakeClient())

    list(llm.llm_text_stream("system", "user"))

    assert captured["stream"] is True
    assert captured["extra_body"] == {
        "provider": {"ignore": ["slow-provider", "another-slug"]},
        "service_tier": "priority",
    }
    assert captured["extra_headers"] == {"X-OpenRouter-Cache": "true"}


class _FakeApiError(Exception):
    def __init__(self, headers: dict[str, str]) -> None:
        super().__init__("api error")
        self.response = SimpleNamespace(headers=headers)


def test_extract_retry_after_seconds_reads_header() -> None:
    assert llm._extract_retry_after_seconds(_FakeApiError({"retry-after": "37"})) == 37.0


def test_extract_retry_after_seconds_handles_missing_or_invalid() -> None:
    assert llm._extract_retry_after_seconds(None) is None
    assert llm._extract_retry_after_seconds(RuntimeError("boom")) is None
    assert llm._extract_retry_after_seconds(_FakeApiError({"retry-after": "soon"})) is None


def test_mark_openrouter_rate_limited_uses_retry_after_header(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    llm._openrouter_rate_limited_until = 0.0

    before = time.monotonic()
    llm._mark_openrouter_rate_limited(_FakeApiError({"retry-after": "300"}))

    assert llm._openrouter_rate_limited_until >= before + 295
    assert llm._openrouter_rate_limited_until <= time.monotonic() + 301


def test_mark_openrouter_rate_limited_clamps_extreme_retry_after(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    llm._openrouter_rate_limited_until = 0.0

    before = time.monotonic()
    llm._mark_openrouter_rate_limited(_FakeApiError({"retry-after": "99999"}))

    assert (
        llm._openrouter_rate_limited_until
        >= before + llm.OPENROUTER_RATE_LIMIT_MAX_COOLDOWN_SECONDS - 5
    )
    assert (
        llm._openrouter_rate_limited_until
        <= time.monotonic() + llm.OPENROUTER_RATE_LIMIT_MAX_COOLDOWN_SECONDS + 1
    )
    assert (
        llm._openrouter_rate_limited_until
        <= time.monotonic() + llm.OPENROUTER_RATE_LIMIT_MAX_COOLDOWN_SECONDS + 1
    )


def test_mark_openrouter_rate_limited_defaults_without_header(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    llm._openrouter_rate_limited_until = 0.0

    before = time.monotonic()
    llm._mark_openrouter_rate_limited()

    assert (
        llm._openrouter_rate_limited_until
        >= before + llm.OPENROUTER_RATE_LIMIT_COOLDOWN_SECONDS - 5
    )
    assert (
        llm._openrouter_rate_limited_until
        <= time.monotonic() + llm.OPENROUTER_RATE_LIMIT_COOLDOWN_SECONDS + 1
    )


def test_resolve_thread_title_model_prefers_configured(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "thread_title_model", " openai/gpt-4.1-nano ")
    assert llm.resolve_thread_title_model() == "openai/gpt-4.1-nano"

    monkeypatch.setattr(llm.settings, "thread_title_model", "")
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    assert llm.resolve_thread_title_model() == "openai/gpt-4o-mini"


def test_resolve_thread_title_model_uses_gemini_default(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "thread_title_model", "")
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "gem-test")
    monkeypatch.setattr(llm.settings, "gemini_default_model", "gemini-2.5-flash")
    assert llm.resolve_thread_title_model() == "gemini-2.5-flash"

    monkeypatch.setattr(llm.settings, "gemini_default_model", "")
    assert llm.resolve_thread_title_model() == "gemini-2.5-flash"


def test_serialize_tool_calls_preserves_gemini_thought_signature() -> None:
    from openai.types.chat.chat_completion_message import ChatCompletionMessage

    message = ChatCompletionMessage.model_validate(
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {
                        "name": "render_visualization",
                        "arguments": '{"kind":"step_demo","title":"Bubble sort","engine":"bubble_sort"}',
                    },
                    "extra_content": {
                        "google": {"thought_signature": "sig-abc"},
                    },
                }
            ],
        }
    )

    serialized = llm._serialize_tool_calls_for_provider(message)
    assert serialized is not None
    assert serialized[0]["function"]["name"] == "render_visualization"
    assert serialized[0]["extra_content"]["google"]["thought_signature"] == "sig-abc"


def test_ensure_thought_signatures_injects_skip_for_gemini() -> None:
    calls = [
        {
            "id": "call_1",
            "type": "function",
            "function": {"name": "render_visualization", "arguments": "{}"},
        }
    ]
    ensured = llm._ensure_thought_signatures(calls, provider="gemini")
    assert ensured is not None
    assert (
        ensured[0]["extra_content"]["google"]["thought_signature"]
        == "skip_thought_signature_validator"
    )

    preserved = llm._ensure_thought_signatures(
        [
            {
                "id": "call_1",
                "type": "function",
                "function": {"name": "render_visualization", "arguments": "{}"},
                "extra_content": {"google": {"thought_signature": "real-sig"}},
            }
        ],
        provider="gemini",
    )
    assert preserved is not None
    assert preserved[0]["extra_content"]["google"]["thought_signature"] == "real-sig"
