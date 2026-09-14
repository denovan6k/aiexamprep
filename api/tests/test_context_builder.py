from app.services.context_builder import ContextBuilder


def test_context_builder_truncates_to_token_budget() -> None:
    chunks = [
        {
            "id": "chunk-1",
            "text": "photosynthesis " * 500,
            "material_title": "Biology",
            "source": "personal",
        }
    ]

    built = ContextBuilder(max_tokens=400).build(
        chunks,
        query="photosynthesis",
        inclusion_level="full_text",
    )

    assert built.chunks
    assert built.token_estimate <= 400
    assert built.truncated is True
    assert built.indicators[0]["material_title"] == "Biology"


def test_context_builder_prioritizes_matching_query() -> None:
    chunks = [
        {
            "id": "chunk-1",
            "text": "Stacks and queues are abstract data types.",
            "material_title": "Data structures",
            "source": "personal",
        },
        {
            "id": "chunk-2",
            "text": "Chlorophyll helps photosynthesis convert sunlight.",
            "material_title": "Biology",
            "source": "personal",
        },
    ]

    built = ContextBuilder(max_tokens=400).build(chunks, query="photosynthesis chlorophyll")

    assert built.chunks[0]["id"] == "chunk-2"
